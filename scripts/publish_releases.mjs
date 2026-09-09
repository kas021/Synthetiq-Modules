import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensurePublicPackage, downloadPublic } from './public_release_guard.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, 'catalogue.json'), 'utf8'),
);
const index = JSON.parse(
  fs.readFileSync(path.join(root, 'repository.json'), 'utf8'),
);

function releaseTag(packageUrl) {
  const match = new URL(packageUrl).pathname.match(/\/releases\/download\/([^/]+)\//);
  if (!match) throw new Error(`Package URL has no release tag: ${packageUrl}`);
  return decodeURIComponent(match[1]);
}

function run(args, options = {}) {
  return execFileSync('gh', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

function readRelease(tag) {
  try {
    return JSON.parse(run(['release', 'view', tag, '--json', 'isDraft,isPrerelease,assets']));
  } catch (error) {
    if (/release not found|HTTP 404|Not Found/i.test(String(error.stderr || error.message))) return null;
    throw error;
  }
}

async function publish({ tag, file, title, notes, packageUrl, sha256 }) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) throw new Error(`Missing release asset: ${file}`);
  const assetName = path.basename(file);
  const bytes = fs.readFileSync(absolute);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`Local package differs from signed index: ${file}`);
  await ensurePublicPackage({ name: assetName, url: packageUrl, sha256, size: bytes.length }, {
    read: () => readRelease(tag),
    create: () => run(['release', 'create', tag, absolute, '--draft', '--title', title, '--notes', notes], { stdio: 'inherit' }),
    upload: () => run(['release', 'upload', tag, absolute], { stdio: 'inherit' }),
    publishDraft: () => run(['release', 'edit', tag, '--draft=false', '--latest=false'], { stdio: 'inherit' }),
    download: downloadPublic,
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
  });
  console.log(`Verified public package: ${tag}/${assetName}`);
}

await publish({
  tag: releaseTag(index.bundle.packageUrl),
  file: catalogue.bundleFile,
  packageUrl: index.bundle.packageUrl,
  sha256: index.bundle.sha256,
  title: `Synthetiq Module Bundle ${index.bundle.version}`,
  notes: `Signed bootstrap bundle containing ${index.modules.length} modules.`,
});

for (const [position, module] of index.modules.entries()) {
  const source = catalogue.modules[position];
  if (!source) throw new Error(`No catalogue package for ${module.moduleId}`);
  await publish({
    tag: releaseTag(module.packageUrl),
    file: source.file,
    packageUrl: module.packageUrl,
    sha256: module.sha256,
    title: `${module.moduleId} ${module.version}`,
    notes: module.changelog.join('\n') || 'Module update.',
  });
}
