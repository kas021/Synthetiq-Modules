import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'catalogue.json'), 'utf8'));
const privateJwkRaw = process.env.MODULE_REPOSITORY_SIGNING_JWK;
if (!privateJwkRaw) throw new Error('MODULE_REPOSITORY_SIGNING_JWK is required');
const privateKey = crypto.createPrivateKey({ key: JSON.parse(privateJwkRaw), format: 'jwk' });
const existingIndexPath = path.join(root, 'repository.json');
const existingIndex = fs.existsSync(existingIndexPath)
  ? JSON.parse(fs.readFileSync(existingIndexPath, 'utf8'))
  : null;
const existingPublishedAtMs = existingIndex?.publishedAtMs ?? null;
const publishedAtMs = Number(process.env.PUBLISHED_AT_MS || existingPublishedAtMs || Date.now());
const releaseBase = 'https://github.com/kas021/Synthetiq-Modules/releases/download';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sign(message) {
  return crypto.sign('sha256', Buffer.from(message, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');
}

function zipEntries(file) {
  return execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' })
    .split('\n').map((line) => line.trim()).filter(Boolean);
}

function readManifest(file) {
  const entries = zipEntries(file);
  for (const entry of entries) {
    if (entry.includes('..') || entry.startsWith('/') || entry.includes('\\')) {
      throw new Error(`${path.basename(file)} contains an unsafe path: ${entry}`);
    }
  }
  const candidates = entries.filter((entry) => {
    const depth = entry.split('/').filter(Boolean).length;
    return entry.endsWith('.json') && depth <= 2 &&
      !entry.toLowerCase().includes('metadata');
  });
  for (const entry of candidates) {
    try {
      const decoded = JSON.parse(execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8' }));
      if (decoded.id || decoded.moduleId) return decoded;
    } catch (_) {}
  }
  throw new Error(`${path.basename(file)} has no valid root module manifest`);
}

function text(value) {
  const result = value == null ? '' : String(value).trim();
  return result || null;
}

function versionOf(manifest) {
  return text(manifest.moduleVersion) || text(manifest.version) || text(manifest.config?.moduleVersion);
}

function valueOf(manifest, key) {
  return manifest[key] ?? manifest.config?.[key];
}

function compareVersions(left, right) {
  const a = String(left).split(/[^0-9]+/).filter(Boolean).map(Number);
  const b = String(right).split(/[^0-9]+/).filter(Boolean).map(Number);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function packagePath(tag, file) {
  return `/kas021/Synthetiq-Modules/releases/download/${tag}/${encodeURIComponent(path.basename(file))}`;
}

const ids = new Set();
const identities = new Set();
const identityNumbers = new Set();
const modules = catalogue.modules.map((item) => {
  const absolute = path.join(root, item.file);
  if (!fs.existsSync(absolute)) throw new Error(`Missing ${item.file}`);
  if (fs.statSync(absolute).size > 15 * 1024 * 1024) throw new Error(`${item.file} exceeds 15 MB`);
  const manifest = readManifest(absolute);
  const moduleId = text(manifest.id) || text(manifest.moduleId);
  const moduleVersion = versionOf(manifest);
  const moduleFamilyId = text(valueOf(manifest, 'moduleFamilyId'));
  const moduleIdentity = text(valueOf(manifest, 'moduleIdentity'));
  const rawNumber = valueOf(manifest, 'moduleIdentityNumber');
  const moduleIdentityNumber = rawNumber == null ? null : Number(rawNumber);
  const contentType = (text(manifest.contentType) || 'video').toLowerCase();
  if (!moduleId || !moduleVersion) throw new Error(`${item.file} lacks id or version`);
  if (!['video', 'image', 'text', 'music'].includes(contentType)) throw new Error(`${item.file} has invalid contentType`);
  if (ids.has(moduleId)) throw new Error(`Duplicate module id: ${moduleId}`);
  ids.add(moduleId);
  if (moduleIdentity && identities.has(moduleIdentity)) throw new Error(`Duplicate identity: ${moduleIdentity}`);
  if (moduleIdentity) identities.add(moduleIdentity);
  const numberKey = moduleIdentityNumber == null ? null : `${contentType}:${moduleIdentityNumber}`;
  if (numberKey && identityNumbers.has(numberKey)) throw new Error(`Duplicate identity number: ${numberKey}`);
  if (numberKey) identityNumbers.add(numberKey);
  const digest = sha256(absolute);
  const tag = `module-${moduleId}-v${moduleVersion}`;
  const assetPath = packagePath(tag, item.file);
  const signedMessage = [moduleId, moduleVersion, moduleFamilyId ?? '', moduleIdentity ?? '',
    moduleIdentityNumber?.toString() ?? '', contentType, catalogue.minAppVersion,
    String(publishedAtMs), assetPath, digest].join('\n');
  return {
    moduleId,
    moduleFamilyId,
    moduleIdentity,
    moduleIdentityNumber,
    contentType,
    version: moduleVersion,
    minAppVersion: catalogue.minAppVersion,
    packageUrl: `${releaseBase}/${tag}/${encodeURIComponent(path.basename(item.file))}`,
    packagePath: assetPath,
    sha256: digest,
    signature: sign(signedMessage),
    publishedAtMs,
    changelog: item.changelog ?? [],
  };
});

const defaultModules = Object.fromEntries(
  Object.entries(catalogue.defaultModules ?? {})
    .map(([mode, moduleId]) => [String(mode).trim().toLowerCase(), String(moduleId).trim()]),
);
for (const [mode, moduleId] of Object.entries(defaultModules)) {
  if (!['video', 'image', 'music'].includes(mode)) {
    throw new Error(`Unsupported default module mode: ${mode}`);
  }
  const module = modules.find((candidate) => candidate.moduleId === moduleId);
  const validType = mode === 'image'
    ? module && ['image', 'text'].includes(module.contentType)
    : module?.contentType === mode;
  if (!validType) {
    throw new Error(`Default ${mode} module is missing or has the wrong content type: ${moduleId}`);
  }
}

const bundleAbsolute = path.join(root, catalogue.bundleFile);
const bundleHash = sha256(bundleAbsolute);
const bundleTag = `bundle-${catalogue.bundleVersion}`;
const bundlePath = packagePath(bundleTag, catalogue.bundleFile);
const bundleMessage = ['bundle', String(catalogue.bundleVersion), catalogue.minAppVersion,
  String(publishedAtMs), bundlePath, bundleHash].join('\n');
const index = {
  schemaVersion: catalogue.schemaVersion,
  repositoryId: catalogue.repositoryId,
  name: catalogue.name,
  enabled: catalogue.enabled !== false,
  publishedAtMs,
  bundle: {
    version: catalogue.bundleVersion,
    minAppVersion: catalogue.minAppVersion,
    packageUrl: `${releaseBase}/${bundleTag}/${encodeURIComponent(path.basename(catalogue.bundleFile))}`,
    packagePath: bundlePath,
    sha256: bundleHash,
    signature: sign(bundleMessage),
  },
  modules,
};
if (Object.keys(defaultModules).length > 0) {
  index.defaultModules = defaultModules;
  const defaultsMessage = [index.repositoryId, String(index.publishedAtMs),
    defaultModules.video ?? '', defaultModules.image ?? '', defaultModules.music ?? ''].join('\n');
  index.defaultModulesSignature = sign(defaultsMessage);
}
if (existingIndex) {
  if (Number(catalogue.bundleVersion) < Number(existingIndex.bundle.version)) {
    throw new Error(`Bundle version downgrade rejected: ${existingIndex.bundle.version} -> ${catalogue.bundleVersion}`);
  }
  const previousById = new Map(existingIndex.modules.map((module) => [module.moduleId, module]));
  for (const module of modules) {
    const previous = previousById.get(module.moduleId);
    if (previous && compareVersions(module.version, previous.version) < 0) {
      throw new Error(`Module version downgrade rejected for ${module.moduleId}: ${previous.version} -> ${module.version}`);
    }
  }
}
const indexMessage = [String(index.schemaVersion), index.repositoryId, index.name,
  String(index.enabled), String(index.publishedAtMs), index.bundle.signature,
  ...index.modules.map((module) => module.signature)].join('\n');
index.signature = sign(indexMessage);
fs.writeFileSync(path.join(root, 'repository.json'), `${JSON.stringify(index, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'SHA256SUMS'), [
  `${bundleHash}  ${catalogue.bundleFile}`,
  ...modules.map((module, i) => `${module.sha256}  ${catalogue.modules[i].file}`),
].join('\n') + '\n');
console.log(`Validated and signed ${modules.length} modules for Bundle ${catalogue.bundleVersion}`);
