import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLI_VERSION, RELEASE_ID, STANDARD_VERSION } from '../src/core/constants.ts';
import { normalizeLf, sha256Lf, writeFileAtomicLf } from '../src/core/crypto-fs.ts';
import { EMBEDDED_BUNDLE_FILES } from '../src/generated/embedded-bundle.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CLI_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

const MODULE_ORDER = [
  'src/core/constants.ts',
  'src/generated/embedded-bundle.ts',
  'src/core/crypto-fs.ts',
  'src/core/yaml-frontmatter.ts',
  'src/core/json-schema.ts',
  'src/core/bundle.ts',
  'src/core/git-vcs.ts',
  'src/core/validator.ts',
  'src/commands/adapter.ts',
  'src/commands/init.ts',
  'src/commands/status-standard.ts',
  'src/commands/baseline.ts',
  'src/commands/change.ts',
  'src/commands/audit-report.ts',
  'src/commands/hooks-update.ts',
  'src/commands/mcp.ts',
  'src/main.ts'
] as const;

fs.mkdirSync(DIST_DIR, { recursive: true });

// 1. Build dist/RELEASE-MANIFEST.json with SHA256-UTF8-LF digests of all 44 bundle files
const manifestEntries = Object.entries(EMBEDDED_BUNDLE_FILES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([relPath, content]) => ({
    path: relPath,
    sha256: sha256Lf(content),
    bytes: Buffer.byteLength(content, 'utf8')
  }));

const releaseManifest = {
  product: 'AI-SDGS',
  cli_version: CLI_VERSION,
  standard_version: STANDARD_VERSION,
  release_id: RELEASE_ID,
  hash_normalization: 'SHA256-UTF8-LF',
  generated_at: new Date().toISOString(),
  bundle_file_count: manifestEntries.length,
  files: manifestEntries
};

writeFileAtomicLf(
  path.join(DIST_DIR, 'RELEASE-MANIFEST.json'),
  JSON.stringify(releaseManifest, null, 2) + '\n'
);

// 2. Concatenate & strip TypeScript into single zero-dependency dist/aisdgs-standalone.mjs
const preamble = `#!/usr/bin/env node
// AI-SDGS Standalone Single-File Executable Bundle v${CLI_VERSION} (${RELEASE_ID})
// Zero external dependencies — embeds Standard v${STANDARD_VERSION}, Schemas, Policies, Templates & Adapters.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
`;

const bundledChunks: string[] = [preamble];

for (const relMod of MODULE_ORDER) {
  const absMod = path.join(CLI_ROOT, relMod);
  const tsSource = normalizeLf(fs.readFileSync(absMod, 'utf8'));
  let jsCode = stripTypeScriptTypes(tsSource);

  // Strip import statements (multi-line & single-line) since built-ins are in preamble and internal modules are in-order
  jsCode = jsCode.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  jsCode = jsCode.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');

  // Strip export modifiers on declarations & export { ... } blocks except keep export function executeCli
  jsCode = jsCode.replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '');
  jsCode = jsCode.replace(/^\s*export\s+(const|let|var|function|async\s+function|class)\b/gm, (_, kw: string) => {
    return kw;
  });

  bundledChunks.push(`// --- MODULE: ${relMod} ---\n${jsCode.trim()}\n`);
}

bundledChunks.push(`\nexport { executeCli };\n`);

const standaloneMjsPath = path.join(DIST_DIR, 'aisdgs-standalone.mjs');
const finalMjs = bundledChunks.join('\n');
writeFileAtomicLf(standaloneMjsPath, finalMjs);
try {
  fs.chmodSync(standaloneMjsPath, 0o755);
} catch {
  // Windows NTFS
}

// 3. Emit cross-platform launcher shims in dist/ + Node SEA configuration
writeFileAtomicLf(
  path.join(DIST_DIR, 'aisdgs.cmd'),
  `@echo off\nnode "%~dp0\\aisdgs-standalone.mjs" %*\nexit /b %ERRORLEVEL%\n`
);
writeFileAtomicLf(
  path.join(DIST_DIR, 'aisdgs.ps1'),
  `#!/usr/bin/env pwsh\n$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent\n& node "$basedir\\aisdgs-standalone.mjs" @args\nexit $LASTEXITCODE\n`
);
writeFileAtomicLf(
  path.join(DIST_DIR, 'aisdgs'),
  `#!/bin/sh\nSCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec node "$SCRIPT_DIR/aisdgs-standalone.mjs" "$@"\n`
);
writeFileAtomicLf(
  path.join(DIST_DIR, 'sea-config.json'),
  JSON.stringify(
    {
      main: './aisdgs-standalone.mjs',
      output: './aisdgs-sea.blob',
      disableExperimentalSEAWarning: true,
      useCodeCache: false
    },
    null,
    2
  ) + '\n'
);

const sizeKb = (Buffer.byteLength(finalMjs, 'utf8') / 1024).toFixed(1);
console.log(
  `Built dist/aisdgs-standalone.mjs (${sizeKb} KB, 0 dependencies, ${manifestEntries.length} embedded files) + dist/RELEASE-MANIFEST.json`
);
