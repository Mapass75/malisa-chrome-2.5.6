#!/usr/bin/env node
/**
 * Build distributable packages for Malisa.
 *
 *   node scripts/build-dist.mjs
 *
 * Outputs:
 *   dist/chrome/                    unpacked Chrome extension
 *   dist/firefox/                   unpacked Firefox extension (unsigned, for AMO)
 *   release/malisa-chrome-<v>.zip   Chrome Web Store upload package
 *   release/malisa-firefox-<v>.zip  AMO submission package (unsigned)
 *   release/malisa-source-<v>.zip   reviewable source + build instructions
 *
 * manifest.json sits at the root of every ZIP.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const RELEASE = join(ROOT, 'release');

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;

// Runtime files shipped inside the extension packages.
// Everything else (previews, docs, package.json, build script) stays out.
const INCLUDE = [
  'manifest.json',
  'background',
  'content',
  'options',
  'popup',
  'privacy',
  'shared',
  'icons',
  'assets',
  'mic.html',
  'mic.js',
];
const EXCLUDE_NAMES = new Set(['options-preview.html']);

function copyTree(src, dest, { exclude = () => false } = {}) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (exclude(entry.name)) continue;
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) copyTree(s, d, { exclude });
    else if (entry.isFile()) cpSync(s, d);
  }
}

function isForbiddenName(name) {
  return /^(nul|con|aux|prn|com[1-9]|lpt[1-9])(\..*)?$/i.test(name);
}

function assertNoForbiddenNames(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (isForbiddenName(entry.name)) {
      throw new Error(`Forbidden file/dir name in package: ${join(dir, entry.name)}`);
    }
    if (entry.isDirectory()) assertNoForbiddenNames(join(dir, entry.name));
  }
}

// ---------- Chrome ----------
const chromeDir = join(DIST, 'chrome');
rmSync(chromeDir, { recursive: true, force: true });
for (const item of INCLUDE) {
  const src = join(ROOT, item);
  if (!existsSync(src)) continue;
  const dest = join(chromeDir, item);
  if (statSync(src).isDirectory()) {
    copyTree(src, dest, { exclude: (n) => EXCLUDE_NAMES.has(n) });
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
}
assertNoForbiddenNames(chromeDir);

// ---------- Firefox ----------
const ffDir = join(DIST, 'firefox');
rmSync(ffDir, { recursive: true, force: true });
copyTree(chromeDir, ffDir);

const ffManifest = { ...manifest };
delete ffManifest.minimum_chrome_version;
if (ffManifest.options_page) {
  ffManifest.options_ui = { page: ffManifest.options_page, open_in_tab: true };
  delete ffManifest.options_page;
}
// Chrome service_worker -> Firefox module event page (requires Firefox 128+).
ffManifest.background = {
  scripts: ['background/background.js'],
  type: 'module',
};
// No existing add-on ID was found in the source — AMO assigns one on first
// submission. Owner must confirm the final ID before signing/submission.
ffManifest.browser_specific_settings = {
  gecko: {
    // Generated once for this project — CONFIRM with the owner before AMO
    // submission; the ID becomes permanent once the add-on is listed.
    id: '{4f2c9a1e-7b3d-4e5f-9a6c-2d8b1f0e3a47}',
    // 142+ is required for data_collection_permissions on Firefox for
    // Android (140 on desktop); keeps the AMO consent flow working.
    strict_min_version: '142.0',
    // Declared to match actual behaviour: page/selection text and chat
    // messages are sent to user-configured providers (websiteContent is
    // core; the rest are optional user-initiated features).
    data_collection_permissions: {
      required: ['websiteContent'],
      optional: [
        'personalCommunications',
        'personallyIdentifyingInfo',
        'authenticationInfo',
      ],
    },
  },
};
writeFileSync(join(ffDir, 'manifest.json'), JSON.stringify(ffManifest, null, 2) + '\n');
assertNoForbiddenNames(ffDir);

// ---------- ZIPs (bsdtar ships with Windows 10+) ----------
function zipDir(srcDir, outFile) {
  rmSync(outFile, { force: true });
  execFileSync('tar', ['--force-local', '-acf', outFile, '-C', srcDir, '.'], { stdio: 'inherit' });
}

mkdirSync(RELEASE, { recursive: true });
const zips = [
  [chromeDir, join(RELEASE, `malisa-chrome-${VERSION}.zip`)],
  [ffDir, join(RELEASE, `malisa-firefox-${VERSION}.zip`)],
];
for (const [dir, out] of zips) zipDir(dir, out);

// ---------- Source ZIP (reviewable source, no dev artifacts) ----------
const SRC_EXCLUDE_DIRS = new Set(['node_modules', '.git', '.devin', 'dist', 'release']);
const SRC_EXCLUDE_FILES = new Set([
  'chat-preview.html',
  'chat-preview.css',
  'popup-preview.html',
  'options-preview.html',
]);
const srcStage = join(DIST, '_source');
rmSync(srcStage, { recursive: true, force: true });
copyTree(ROOT, srcStage, {
  exclude: (name) => SRC_EXCLUDE_DIRS.has(name) || SRC_EXCLUDE_FILES.has(name),
});
// Guard: never ship secrets/dev junk in the source bundle either.
const banned = [/\.env($|\.)/i, /secret/i, /credential/i];
(function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (banned.some((re) => re.test(e.name))) {
      throw new Error(`Potentially sensitive file in source package: ${p}`);
    }
  }
})(srcStage);
zipDir(srcStage, join(RELEASE, `malisa-source-${VERSION}.zip`));
rmSync(srcStage, { recursive: true, force: true });

console.log('Built:');
for (const [, out] of zips) console.log('  ' + relative(ROOT, out));
console.log(`  ${relative(ROOT, join(RELEASE, `malisa-source-${VERSION}.zip`))}`);
