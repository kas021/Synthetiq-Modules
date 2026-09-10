const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'catalogue.json'), 'utf8'));
const entry = catalogue.modules.find(item => /\/Anikage-[^/]+\.zip$/.test(item.file));
assert.ok(entry, 'AniKage catalogue entry missing');
const source = execFileSync('unzip', ['-p', path.join(root, entry.file), 'index.js'], { encoding: 'utf8' });
function load(fetcher) {
  const context = { setTimeout, clearTimeout, fetchv2: fetcher, console: { log() {} } };
  vm.createContext(context);
  vm.runInContext(source.replace('// ---------- Exports on globalThis ----------',
    'globalThis.helpers = { subtitleEntries, marker, mediaUrl, validateStreamPlayback };'), context);
  return context;
}
function response(body, type = 'application/json', status = 200) {
  return { status, contentType: type, headers: { 'content-type': type },
    json: typeof body === 'object' ? body : null,
    body: typeof body === 'string' ? body : JSON.stringify(body) };
}
test('recover real captions from all supported embed query formats, never tokens', () => {
  const { subtitleEntries } = load().helpers;
  const data = { subtitles: [{ file: 'opaque-token', label: 'English' }] };
  for (const query of ['sub=https://captions.test/en.vtt',
    'caption_1=https%3A%2F%2Fcaptions.test%2Fen.vtt&sub_1=English',
    'c1_file=https://captions.test/en.vtt&c1_label=English']) {
    const tracks = subtitleEntries(data, 'https://embed.test/?' + query);
    assert.equal(tracks.length, 1); assert.equal(tracks[0].url, 'https://captions.test/en.vtt');
    assert.equal(tracks[0].lang, 'en'); assert.deepEqual(Object.keys(tracks[0].headers), ['User-Agent']);
  }
  assert.equal(subtitleEntries(data, '').length, 0);
});
test('preserve multiple captions and scope metadata to selected embed', () => {
  const { subtitleEntries } = load().helpers;
  const url = 'https://embed.test/?caption_1=https://c.test/en.vtt&sub_1=English&caption_2=https://c.test/fr.vtt&sub_2=French';
  const tracks = subtitleEntries({ subtitles: [
    { file: 'https://c.test/en.vtt', label: 'English' },
    { file: 'https://c.test/wrong.vtt', embedUrl: 'https://other.test' },
  ] }, url);
  assert.equal(tracks.length, 2); assert.equal(tracks[1].label, 'French');
});
test('marker zero is valid; reversed, incomplete and nonfinite markers are rejected', () => {
  const { marker } = load().helpers;
  assert.equal(marker({ start: 0, end: 90 }).start, 0);
  for (const value of [{ start: 10, end: 1 }, { start: 1 }, { start: NaN, end: 90 }, { start: 0, end: Infinity }]) {
    assert.equal(marker(value), null);
  }
});
test('resolve relative manifests without corrupting parent paths or queries', () => {
  const { mediaUrl } = load().helpers;
  assert.equal(mediaUrl('../video/a.m3u8?sig=x', 'https://cdn.test/hls/master.m3u8?t=y'), 'https://cdn.test/video/a.m3u8?sig=x');
  assert.equal(mediaUrl('/seg.ts', 'https://cdn.test/a/master.m3u8'), 'https://cdn.test/seg.ts');
  assert.equal(mediaUrl('javascript:bad', 'https://cdn.test/a'), '');
});
test('reject bad episode references without silently playing episode one', async () => {
  let calls = 0;
  const context = load(async () => { calls++; });
  for (const reference of ['title', 'id:ep:no', 'id:ep:1junk', 'id:ep:0', 'id:ep:1.5']) {
    await assert.rejects(context.extractStreamUrl(reference, 'sub'), /invalid episode/);
  }
  assert.equal(calls, 0);
});
test('HLS image/HTML/JSON segments rejected and recursion bounded', async () => {
  for (const type of ['image/jpeg', 'text/html', 'application/json']) {
    const context = load(async url => response(url.endsWith('.m3u8') ? '#EXTM3U\nseg.ts' : 'bad', url.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : type));
    assert.equal(await context.helpers.validateStreamPlayback('https://cdn.test/master.m3u8', {}, true), false);
  }
  let calls = 0;
  const context = load(async () => { calls++; return response('#EXTM3U\nmaster.m3u8', 'application/vnd.apple.mpegurl'); });
  assert.equal(await context.helpers.validateStreamPlayback('https://cdn.test/master.m3u8', {}, true), false);
  assert.equal(calls, 5);
});
test('retain more than four checked alternatives with route-specific headers and captions', async () => {
  let inFlight = 0, peak = 0;
  const requested = [];
  const context = load(async (url, headers) => {
    requested.push(url); inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 1)); inFlight--;
    if (url.includes('/sources?')) return response({ slug: 'title', number: 1, subType: 'sub',
      sources: [{ url: 'opaque-token' }], intro: { start: 0, end: 90 },
      embeds: Array.from({ length: 6 }, (_, i) => ({ server: 'Server ' + i, type: 'softsub',
        url: `https://otakuhg.test/e/${i}?caption_1=https://captions.test/${i}.vtt&sub_1=English` })) });
    if (url.includes('otakuhg.test')) return response(`https://cdn.test/${url.match(/\/e\/(\d+)/)[1]}.m3u8`, 'text/html');
    if (url.endsWith('.m3u8')) return response('#EXTM3U\nseg.ts', 'application/vnd.apple.mpegurl');
    assert.match(headers.Referer, /otakuhg/);
    return response('video bytes', 'video/mp2t');
  });
  const result = await context.extractStreamUrl('title:ep:1', 'sub');
  assert.equal(result.servers.length, 6); assert.equal(peak, 2);
  assert.equal(result.url, result.servers[0].url); assert.equal(result.lang, 'sub');
  result.servers.forEach((server, i) => {
    assert.equal(server.subtitles[0].url, `https://captions.test/${i}.vtt`);
    assert.equal(server.intro.start, 0); assert.match(server.headers.Referer, new RegExp('/e/' + i));
  });
  assert.equal(requested.some(url => url.includes('bakayaro')), false);
});
test('wrong language or episode response is never accepted as the requested stream', async () => {
  let embedRequests = 0;
  const context = load(async url => {
    if (!url.includes('/sources?')) embedRequests++;
    return response({ slug: 'other-title', number: 2, subType: 'sub', embeds: [{ url: 'https://otakuhg.test/e/a', type: 'sub' }] });
  });
  await assert.rejects(context.extractStreamUrl('title:ep:1', 'dub'), /no checked dub stream/);
  assert.equal(embedRequests, 0);
});
test('false Dub flags stay false; unknown availability is not fabricated', async () => {
  const context = load(async url => response(url.endsWith('/episodes') ? [
    { number: 1, hasDub: false }, { number: 2, hasDub: true }, { number: 3 },
  ] : { anime: {} }));
  const episodes = await context.extractEpisodes('title');
  assert.equal(episodes[0].hasDub, false); assert.equal(episodes[1].hasDub, true);
  assert.equal(episodes[2].hasDub, undefined);
});
test('runtime without clearTimeout still resolves successful requests', async () => {
  const context = load(async url => {
    if (url.includes('/sources?')) return response({ subType: 'sub', sources: [{ url: 'https://cdn.test/video.mp4', isM3U8: false }] });
    return response('video bytes', 'video/mp4');
  });
  context.clearTimeout = undefined;
  const timers = [];
  context.setTimeout = fn => { timers.push(fn); return timers.length; };
  const result = await context.extractStreamUrl('title:ep:1', 'sub');
  assert.equal(result.url, 'https://cdn.test/video.mp4');
  timers.forEach(fn => fn());
});
