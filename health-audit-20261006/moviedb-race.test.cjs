'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(cancelTimer = clearTimeout) {
  const code = fs.readFileSync(path.join(__dirname, '../sources/moviedb-wiki-v1/index.js'), 'utf8');
  const ctx = vm.createContext({setTimeout, clearTimeout: cancelTimer, console: {log() {}}});
  vm.runInContext(code.replace('  globalThis.searchResults = searchResults;', `
    globalThis.qa = {firstUsable, resolveFresh, vidloveAttempt, setValidation: (api, validate) => {
      callApi = api; validateSource = validate;
    }, setProviders: (love, zen) => {
      vidloveAttempt = love; vidzenAttempt = zen;
    }, setBudget: n => INTERNAL_DEADLINE = n};
    globalThis.searchResults = searchResults;`), ctx);
  return ctx.qa;
}
const pending = () => new Promise(() => {});
const ref = {kind: 'tv', id: 5920, season: 1, episode: 1};
const route = (name, height = 720) => ({srcName: name, variants: [{url: 'https://example.test/' + name, height, width: 1280}], headers: {Referer: name}, subs: []});
test('verified backup wins despite permanently pending primary', async () => {
  const q = load(); q.setBudget(100);
  q.setProviders(pending, async (_, server) => server === 'sv-ps' ? route('backup') : null);
  const result = await q.resolveFresh(ref);
  assert.equal(result.url, 'https://example.test/backup');
  assert.equal(result.headers.Referer, 'backup');
});
test('primary remains preferred when all routes settle, with higher quality promoted', async () => {
  const q = load();
  q.setProviders(async () => route('primary'), async (_, server) => server === 'sv-ps' ? route('higher', 1080) : null);
  const result = await q.resolveFresh(ref);
  assert.equal(result.url, 'https://example.test/higher');
  assert.equal(result.servers.length, 2);
  assert.equal(result.headers.Referer, 'higher');
});
test('all pending routes time out without starting more provider batches', async () => {
  const q = load(); q.setBudget(30); let calls = 0;
  q.setProviders(() => { calls++; return pending(); }, pending);
  await assert.rejects(q.resolveFresh(ref), /budget exceeded/);
  assert.equal(calls, 1);
});
test('initial failures still reach later source keys', async () => {
  const q = load(); const keys = [];
  q.setProviders(async (_, key) => {keys.push(key); return key === 'vidapi' ? route('fallback') : null;}, async () => null);
  assert.equal((await q.resolveFresh(ref)).url, 'https://example.test/fallback');
  assert.deepEqual(keys, [null, 'vidapi']);
});
test('late loser cannot mutate returned results and rejection is handled', async () => {
  const q = load(); let done;
  const loser = new Promise(resolve => {done = resolve;});
  const result = await q.firstUsable([Promise.resolve(route('first')), loser], 0, Date.now() + 100);
  done(route('late')); await Promise.resolve();
  assert.equal(result[1], undefined);
  const rejected = await q.firstUsable([Promise.reject(Error('provider failed'))], 0, Date.now() + 100);
  assert.equal(rejected[0], null);
});
test('invalid results and empty input do not hang or count as usable', async () => {
  const q = load();
  assert.equal((await q.firstUsable([], 0)).length, 0);
  const result = await q.firstUsable([Promise.resolve({variants: []}), Promise.resolve({url: 'unverified'})], 0);
  assert.ok(result.every(x => x === null));
});
test('timer cancellation missing or throwing cannot strand a verified result', async () => {
  for (const cancel of [null, () => {throw Error('unsupported');}]) {
    const q = load(cancel);
    const result = await q.firstUsable([Promise.resolve(route('first'))], 0, Date.now() + 10);
    assert.equal(result[0].srcName, 'first');
  }
});
test('stalled optional subtitles cannot hide a verified video', async () => {
  const q = load(); let calls = 0;
  q.setValidation(() => ++calls === 1 ? Promise.resolve({subtitles: []}) : pending(), async () => route('verified'));
  const result = await q.vidloveAttempt(ref, null, Date.now() + 50);
  assert.equal(result.srcName, 'verified');
  assert.equal(calls, 2);
});
