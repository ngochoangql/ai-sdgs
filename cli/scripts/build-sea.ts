import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLI_VERSION } from '../src/core/constants.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

console.log('[AI-SDGS SEA] Starting Node Single Executable Application build...');

// 1. Generate dist/aisdgs-sea.blob
console.log('[AI-SDGS SEA] Generating SEA preparation blob...');
const blobGen = spawnSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], {
  cwd: DIST_DIR,
  stdio: 'inherit'
});
if (blobGen.status !== 0) {
  console.error('[AI-SDGS SEA] Failed to generate SEA blob.');
  process.exit(1);
}

// 2. Determine target binary path
const isWindows = process.platform === 'win32';
const targetBinary = path.join(DIST_DIR, isWindows ? 'aisdgs.exe' : 'aisdgs-bin');
const blobPath = path.join(DIST_DIR, 'aisdgs-sea.blob');

console.log(`[AI-SDGS SEA] Copying runtime executable from ${process.execPath} to ${targetBinary}...`);
fs.copyFileSync(process.execPath, targetBinary);

// 3. Inject blob via postject
console.log('[AI-SDGS SEA] Injecting SEA blob into binary with postject...');
const postjectArgs = [
  '--yes',
  'postject',
  targetBinary,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  '--overwrite'
];

if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA');
}

const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const injectRes = spawnSync(npxCmd, postjectArgs, {
  stdio: 'inherit',
  shell: true
});

if (injectRes.status !== 0) {
  console.error('[AI-SDGS SEA] Failed to inject SEA blob.');
  process.exit(1);
}

// 4. Test the generated executable
console.log('[AI-SDGS SEA] Testing standalone binary...');
const testRes = spawnSync(targetBinary, ['--version'], { encoding: 'utf8' });
if (testRes.status === 0 && testRes.stdout.includes(CLI_VERSION)) {
  console.log(`[AI-SDGS SEA] SUCCESS: Standalone executable created at ${targetBinary}`);
  console.log(`[AI-SDGS SEA] Output: ${testRes.stdout.trim()}`);
} else {
  console.error(`[AI-SDGS SEA] Standalone binary test failed with exit code ${testRes.status}`);
  console.error(testRes.stderr || testRes.stdout);
  process.exit(1);
}
