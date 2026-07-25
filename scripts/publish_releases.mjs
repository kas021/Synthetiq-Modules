import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

function releaseExists(tag) {
  try {
    run(['release', 'view', tag]);
    return true;
  } catch (_) {
    return false;
  }
}

function publishedAssets(tag) {
  if (!releaseExists(tag)) return new Set();
  const output = run([
    'release',
    'view',
    tag,
    '--json',
    'assets',
    '--jq',
    '.assets[].name',
  ]);
  return new Set(output.split('\n').map((line) => line.trim()).filter(Boolean));
}

function publish({ tag, file, title, notes }) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) throw new Error(`Missing release asset: ${file}`);
  const assetName = path.basename(file);
  const assets = publishedAssets(tag);
  if (assets.has(assetName)) {
    console.log(`Release asset already published: ${tag}/${assetName}`);
    return;
  }
  if (releaseExists(tag)) {
    run(['release', 'upload', tag, absolute], { stdio: 'inherit' });
  } else {
    run([
      'release',
      'create',
      tag,
      absolute,
      '--title',
      title,
      '--notes',
      notes,
    ], { stdio: 'inherit' });
  }
}

publish({
  tag: releaseTag(index.bundle.packageUrl),
  file: catalogue.bundleFile,
  title: `Synthetiq Module Bundle ${index.bundle.version}`,
  notes: `Signed bootstrap bundle containing ${index.modules.length} modules.`,
});

index.modules.forEach((module, position) => {
  const source = catalogue.modules[position];
  if (!source) throw new Error(`No catalogue package for ${module.moduleId}`);
  publish({
    tag: releaseTag(module.packageUrl),
    file: source.file,
    title: `${module.moduleId} ${module.version}`,
    notes: module.changelog.join('\n') || 'Module update.',
  });
});

