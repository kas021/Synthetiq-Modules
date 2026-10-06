'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(id, expose) {
  const code = fs.readFileSync(path.join(__dirname, '../sources', id, 'index.js'), 'utf8');
  const context = vm.createContext({ console: {log() {}}, setTimeout, clearTimeout });
  assert.ok(code.includes('  globalThis.searchResults = searchResults;'));
  vm.runInContext(code.replace('  globalThis.searchResults = searchResults;', expose + '\n  globalThis.searchResults = searchResults;'), context);
  return context;
}
function movie() {
  return load('moviedb-wiki-v1', `globalThis.qa = {resolveStream, qualityLabel, buildResult, probeRoute,
    parseCards, parseDetailsPage, validateSource, requestPlaylist, probeSegment,
    setResolve: f => resolveFresh = f, setRequest: f => request = f};`).qa;
}
const ref = {kind: 'tv', id: '5920', season: 1, episode: 1};
const tsProbe = '\x47\x40\x00\x10' + '\x00'.repeat(184);
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise, resolve, reject}; }

test('MovieDB keeps ordinary cache but explicit fresh requests refetch', async () => {
  const m = movie(); let calls = 0;
  m.setResolve(async () => ({url: 'route-' + ++calls, headers:{Referer:'provider'}, subtitles:[]}));
  const first = await m.resolveStream(ref);
  assert.equal(await m.resolveStream(ref), first);
  assert.equal((await m.resolveStream(ref, false, true)).url, 'route-2');
  assert.equal(calls, 2);
});
test('MovieDB bypass ignores negative cache', async () => {
  const m = movie(); let calls=0;
  m.setResolve(async () => { if (++calls === 1) throw Error('expired'); return {url:'new'}; });
  await assert.rejects(m.resolveStream(ref), /expired/);
  await assert.rejects(m.resolveStream(ref), /expired/);
  assert.equal(calls, 1);
  assert.equal((await m.resolveStream(ref, false, true)).url, 'new');
});
for (const failOld of [false, true]) test('MovieDB obsolete inflight cannot clobber retry: ' + failOld, async () => {
  const m = movie(); const a=deferred(), b=deferred(); let calls=0;
  m.setResolve(() => ++calls === 1 ? a.promise : b.promise);
  const old = m.resolveStream(ref).catch(e => e);
  const fresh = m.resolveStream(ref, false, true);
  b.resolve({url:'fresh'}); await fresh;
  if (failOld) a.reject(Error('old')); else a.resolve({url:'old'});
  await old;
  assert.equal((await m.resolveStream(ref)).url, 'fresh');
  assert.equal(calls, 2);
});
test('MovieDB manifest dimensions, not width buckets, determine quality', () => {
  const m=movie();
  assert.equal(m.qualityLabel(640,360), '360p');
  assert.equal(m.qualityLabel(1280,720), '720p');
  assert.equal(m.qualityLabel(1920,1080), '1080p');
  assert.equal(m.qualityLabel(3840,2160), '2160p');
  const result = m.buildResult({ variants:[{url:'https://test/720',width:1280,height:720}], headers:{Referer:'https://test/'}, subs:[] }, []);
  assert.equal(result.streams[0], '720p');
  assert.equal(result.qualities[0].height, 720);
  assert.equal(result.qualities[0].headers.Referer, 'https://test/');
});
test('MovieDB drops broken high rung, resolves relative URLs and keeps verified lower rung', async () => {
  const m=movie();
  m.setRequest(async url => {
    if (url.endsWith('master.m3u8')) return {ok:true,text:'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000,RESOLUTION=1920x1080\nhigh.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720\nlow.m3u8'};
    if (/\.m3u8$/.test(url)) return {ok:true,text:'#EXTM3U\n#EXTINF:5,\n' + (url.includes('high') ? 'bad.ts' : 'ok.ts')};
    return url.endsWith('ok.ts') ? {ok:true,text:tsProbe} : {ok:false,status:403,text:'<html>denied</html>'};
  });
  const result=await m.probeRoute('https://test/master.m3u8',{},Date.now()+1000);
  assert.equal(result.variants.length,1);
  assert.equal(result.variants[0].height,720);
  assert.equal(result.variants[0].url,'https://test/low.m3u8');
});
test('MovieDB rejects playlist-only routes with no verified media', async () => {
  const m=movie();
  m.setRequest(async url => url.endsWith('.m3u8') ? {ok:true,text:'#EXTM3U\n#EXTINF:5,\nbad.ts'} : {ok:false,status:403,text:'<html>denied</html>'});
  assert.equal(await m.probeRoute('https://test/media.m3u8',{},Date.now()+1000),null);
});
test('MovieDB catalogue artwork remains attached to the exact title', () => {
  const m=movie();
  const cards=m.parseCards('<article class="poster-card" data-id="5920" data-type="tv" data-title="The Mentalist" data-poster="https://image.tmdb.org/t/p/w342/poster.jpg"><a href="/home/tv/5920-the-mentalist">The Mentalist</a></article>');
  assert.equal(cards[0].image,'https://image.tmdb.org/t/p/w342/poster.jpg');
});

test('MovieDB never returns unverified inline-manifest routes', async () => {
  const m=movie(); m.setRequest(async () => ({ok:false,status:403,text:'denied'}));
  assert.equal(await m.validateSource({source:{url:'https://test/master.m3u8',manifest:'#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1920x1080\nhttps://test/high.m3u8'}},Date.now()+1000),null);
});
test('MovieDB picks the highest verified provider with its own headers/captions', () => {
  const m=movie(); const source=(h,name)=>({srcName:name,variants:[{height:h,url:'https://test/'+name}],headers:{Referer:name},subs:[{label:name}]});
  const r=m.buildResult(source(360,'low'),[source(1080,'high')]);
  assert.equal(r.quality,'1080p'); assert.equal(r.headers.Referer,'high');
  assert.equal(r.subtitles[0].label,'high'); assert.equal(r.servers[1].headers.Referer,'low');
});
test('MovieDB retries transient playlist 503 once, never 403 or 429', async () => {
  const m=movie(); let calls=0;
  m.setRequest(async () => ({status:++calls===1?503:200}));
  assert.equal((await m.requestPlaylist('https://test',{},Date.now()+2000)).status,200);
  assert.equal(calls,2);
  for (const status of [403,429]) {
    calls=0; m.setRequest(async () => {calls++;return {status};});
    assert.equal((await m.requestPlaylist('https://test',{},Date.now()+2000)).status,status);
    assert.equal(calls,1);
  }
});
function xstream() {
  return load('xstream-v1', `globalThis.qa = {collectStreams, setProviders: f => {
    resolveProviderWithRetries = f; softProbeStreams = async x => x;
    preferReliableStreams = x => x; orderHdFirst = x => x;
  }};`).qa;
}
const parsed={type:'tv', id:'5920', season:1, episode:1};
