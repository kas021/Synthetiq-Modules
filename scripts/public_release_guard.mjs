import crypto from 'node:crypto';

export async function ensurePublicPackage(pkg, io) {
  let release = await io.read();
  if (!release) await io.create();
  else if (!release.assets.some(asset => asset.name === pkg.name)) await io.upload();
  release = await io.read();
  if (!release) throw new Error(`Release missing: ${pkg.name}`);
  if (release.isDraft) {
    await io.publishDraft();
    release = await io.read();
  }
  const asset = release?.assets.find(item => item.name === pkg.name);
  if (!release || release.isDraft || release.isPrerelease || !asset || asset.state !== 'uploaded') {
    throw new Error(`Release is not public/stable/uploaded: ${pkg.name}`);
  }
  if (asset.digest && asset.digest !== `sha256:${pkg.sha256}`) throw new Error(`Immutable asset checksum mismatch: ${pkg.name}`);
  // Verify the exact signed-index URL anonymously, even for existing assets.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const bytes = await io.download(pkg.url, pkg.size);
      if (bytes.length !== pkg.size || crypto.createHash('sha256').update(bytes).digest('hex') !== pkg.sha256) {
        throw new Error(`Public download checksum mismatch: ${pkg.name}`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await io.wait(2000 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function downloadPublic(url, expectedSize) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Public package HTTP ${response.status}: ${url}`);
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > expectedSize) throw new Error('Public package exceeds expected size');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
