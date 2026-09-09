import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ensurePublicPackage } from './public_release_guard.mjs';

function fixture(draft = false) {
  const bytes = Buffer.from('test package');
  const pkg = { name: 'test.zip', url: 'https://github.com/owner/repo/releases/download/v1/test.zip', size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  const asset = { name: pkg.name, state: 'uploaded', digest: `sha256:${pkg.sha256}` };
  const state = { release: { isDraft: draft, isPrerelease: false, assets: [asset] }, published: 0, downloaded: 0, created: 0, uploaded: 0 };
  const io = {
    read: async () => state.release,
    create: async () => { state.created++; state.release = { isDraft: true, isPrerelease: false, assets: [asset] }; },
    upload: async () => { state.uploaded++; state.release.assets.push(asset); },
    publishDraft: async () => { state.published++; state.release.isDraft = false; },
    download: async url => { assert.equal(url, pkg.url); assert.equal(state.release.isDraft, false); state.downloaded++; return bytes; },
    wait: async () => {},
  };
  return { pkg, io, state };
}
test('recovers a draft with an uploaded ZIP', async () => {
  const { pkg, io, state } = fixture(true); await ensurePublicPackage(pkg, io);
  assert.equal(state.published, 1); assert.equal(state.uploaded, 0); assert.equal(state.downloaded, 1);
});
test('existing public release requires exact-URL download', async () => {
  const { pkg, io, state } = fixture(); await ensurePublicPackage(pkg, io); assert.equal(state.downloaded, 1);
});
test('new release and missing asset paths are verified', async () => {
  for (const missingRelease of [true, false]) {
    const { pkg, io, state } = fixture();
    if (missingRelease) state.release = null; else state.release.assets = [];
    await ensurePublicPackage(pkg, io);
    assert.equal(missingRelease ? state.created : state.uploaded, 1); assert.equal(state.downloaded, 1);
  }
});
test('persistent 404 fails closed after bounded retries', async () => {
  const { pkg, io } = fixture(); let attempts = 0;
  io.download = async () => { attempts++; throw Error('HTTP 404'); };
  await assert.rejects(ensurePublicPackage(pkg, io), /404/); assert.equal(attempts, 3);
});
test('wrong public bytes fail despite matching API digest', async () => {
  const { pkg, io } = fixture(); io.download = async () => Buffer.from('wrong bytes');
  await assert.rejects(ensurePublicPackage(pkg, io), /checksum/);
});
test('immutable digest mismatch fails without overwrite', async () => {
  const { pkg, io, state } = fixture(); state.release.assets[0].digest = 'sha256:wrong';
  await assert.rejects(ensurePublicPackage(pkg, io), /checksum/); assert.equal(state.downloaded, 0);
});
test('remaining draft or prerelease blocks success', async () => {
  for (const prerelease of [true, false]) {
    const { pkg, io, state } = fixture(!prerelease);
    state.release.isPrerelease = prerelease; io.publishDraft = async () => {};
    await assert.rejects(ensurePublicPackage(pkg, io), /not public/);
  }
});
test('interrupted create recovers on retry without recreating', async () => {
  const { pkg, io, state } = fixture(); state.release = null;
  const create = io.create; io.create = async () => { await create(); throw Error('HTTP 500'); };
  await assert.rejects(ensurePublicPackage(pkg, io), /500/);
  await ensurePublicPackage(pkg, io); assert.equal(state.created, 1); assert.equal(state.published, 1);
});
