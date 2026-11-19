import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runGit } from '../src/core/git-vcs.ts';
import { CLI_VERSION } from '../src/core/constants.ts';
import { executeCli } from '../src/main.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_MJS = path.resolve(__dirname, '../bin/aisdgs.mjs');

const tempDirs: string[] = [];

function createTempDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'aisdgs-p9-'));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 9 — All 11 aisdgs CLI Lifecycle Commands', () => {
  it('initializes GREENFIELD STANDARD repo, locks baseline, validates, and generates reports', () => {
    const ws = createTempDir();
    runGit(ws, ['init']);
    runGit(ws, ['config', 'user.name', 'hoang-doan']);
    runGit(ws, ['config', 'user.email', 'hoang@example.com']);

    // 1. aisdgs init
    const initRes = executeCli([
      'init',
      '--cwd', ws,
      '--tier', 'standard',
      '--mode', 'greenfield',
      '--id', 'orders-api',
      '--name', 'Orders API',
      '--owner', 'hoang-doan',
      '--targets', 'agents,claude,gemini,cursor,copilot,kilocode'
    ]);
    assert.equal(initRes.exitCode, 0, initRes.stderr);
    assert.ok(fs.existsSync(path.join(ws, 'AGENTS.md')));
    assert.ok(fs.existsSync(path.join(ws, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(ws, '.github/copilot-instructions.md')));
    assert.ok(fs.existsSync(path.join(ws, '.kilocode/rules/aisdgs.md')));

    // 2. aisdgs standard list / show / verify-lock
    const stdList = executeCli(['standard', 'list', '--cwd', ws, '--json']);
    assert.equal(stdList.exitCode, 0);
    assert.equal(JSON.parse(stdList.stdout).data.standards.length, 12);

    const stdRule = executeCli(['standard', 'show', 'STD-001', '--rule', 'STD-001-R01', '--cwd', ws]);
    assert.equal(stdRule.exitCode, 0);
    assert.match(stdRule.stdout, /STD-001-R01/);

    const stdVerify = executeCli(['standard', 'verify-lock', '--cwd', ws]);
    assert.equal(stdVerify.exitCode, 0);

    // 3. aisdgs baseline lock (rejects AI approver, accepts human approver)
    const badLock = executeCli(['baseline', 'lock', '--cwd', ws, '--approver', 'claude-bot']);
    assert.equal(badLock.exitCode, 1);

    const goodLock = executeCli(['baseline', 'lock', '--cwd', ws, '--approver', 'hoang-doan']);
    assert.equal(goodLock.exitCode, 0, goodLock.stderr);

    // Commit baseline in Git
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'chore: lock initial AI-SDGS baseline']);

    // 4. aisdgs baseline verify & status
    const bVerify = executeCli(['baseline', 'verify', '--cwd', ws]);
    assert.equal(bVerify.exitCode, 0, bVerify.stderr);

    const stRes = executeCli(['status', '--cwd', ws, '--json']);
    assert.equal(stRes.exitCode, 0);
    const stData = JSON.parse(stRes.stdout).data;
    assert.equal(stData.baseline_state, 'LOCKED');
    assert.equal(stData.baseline_version, '1.0.0');

    // 5. aisdgs validate & report
    const valRes = executeCli(['validate', '--cwd', ws]);
    assert.equal(valRes.exitCode, 0, valRes.stderr);

    const repRes = executeCli(['report', '--cwd', ws, '--output', 'quality/reports/posture.md']);
    assert.equal(repRes.exitCode, 0);
    assert.ok(fs.existsSync(path.join(ws, 'quality/reports/posture.md')));
  });

  it('auto-detects BROWNFIELD mode, installs/uninstalls Git hooks, enforces CR scope & escalation, and runs L3 audit + safe update', () => {
    const ws = createTempDir();
    runGit(ws, ['init']);
    runGit(ws, ['config', 'user.name', 'hoang-doan']);
    runGit(ws, ['config', 'user.email', 'hoang@example.com']);

    // Pre-existing legacy file triggers BROWNFIELD auto-detection
    fs.mkdirSync(path.join(ws, 'src'), { recursive: true });
    fs.writeFileSync(path.join(ws, 'src/legacy.ts'), 'export const x = 1;\n', 'utf8');

    const initRes = executeCli(['init', '--cwd', ws, '--owner', 'hoang-doan']);
    assert.equal(initRes.exitCode, 0, initRes.stderr);
    const statusJson = JSON.parse(executeCli(['status', '--cwd', ws, '--json']).stdout).data;
    assert.equal(statusJson.onboarding_mode, 'BROWNFIELD');

    // Anchor baseline (< 30 min Brownfield flow)
    assert.equal(
      executeCli(['baseline', 'lock', '--anchor', '--approver', 'hoang-doan', '--cwd', ws]).exitCode,
      0
    );

    // Install, check, and preserve existing Git hooks
    fs.mkdirSync(path.join(ws, '.git/hooks'), { recursive: true });
    fs.writeFileSync(path.join(ws, '.git/hooks/pre-commit'), '#!/bin/sh\necho "custom-user-hook"\n', 'utf8');

    const hookInst = executeCli(['hooks', 'install', '--cwd', ws]);
    assert.equal(hookInst.exitCode, 0);
    const hookContent = fs.readFileSync(path.join(ws, '.git/hooks/pre-commit'), 'utf8');
    assert.match(hookContent, /custom-user-hook/);
    assert.match(hookContent, /AI-SDGS-HOOK/);

    runGit(ws, ['add', '.']);
    // Commit with --no-verify only in test setup or let pre-commit pass via node!
    const commitRes = runGit(ws, ['commit', '-m', 'chore: anchor brownfield baseline']);
    assert.equal(commitRes.ok, true, commitRes.stderr);

    // Create FAST CR attempting to touch package.json in STANDARD tier -> STD-006-R05 Escalation Error!
    const crCreate = executeCli([
      'change', 'create',
      '--cwd', ws,
      '--track', 'fast',
      '--title', 'Install moment package',
      '--files', 'package.json,src/legacy.ts'
    ]);
    assert.equal(crCreate.exitCode, 0);

    const crVerifyFail = executeCli(['change', 'verify', 'CR-0001', '--cwd', ws]);
    assert.equal(crVerifyFail.exitCode, 1);
    assert.match(crVerifyFail.stderr, /STD-006-R05/);

    // Create valid FAST CR for src/legacy.ts, then modify an OUT-OF-SCOPE file src/other.ts -> STD-006-R02 Error!
    const cr2 = executeCli([
      'change', 'create',
      '--cwd', ws,
      '--track', 'fast',
      '--title', 'Add helper in legacy.ts',
      '--files', 'src/legacy.ts'
    ]);
    assert.equal(cr2.exitCode, 0);
    fs.writeFileSync(path.join(ws, 'src/other.ts'), 'export const sneak = true;\n', 'utf8');

    const cr2ScopeFail = executeCli(['change', 'verify', 'CR-0002', '--cwd', ws]);
    assert.equal(cr2ScopeFail.exitCode, 1);
    assert.match(cr2ScopeFail.stderr, /STD-006-R02/);
    fs.rmSync(path.join(ws, 'src/other.ts'));

    // Generate L3 Semantic Audit Bundle
    const auditRes = executeCli([
      'audit',
      '--cwd', ws,
      '--cr', 'CR-0002',
      '--output', 'quality/reports/AUDIT-CR-0002.md'
    ]);
    assert.equal(auditRes.exitCode, 0, auditRes.stderr);
    assert.ok(fs.existsSync(path.join(ws, 'quality/reports/AUDIT-CR-0002.md')));

    // Safe update plan & apply preserves governance/PROJECT-CONSTITUTION.md untouched
    fs.appendFileSync(
      path.join(ws, 'governance/PROJECT-CONSTITUTION.md'),
      '\n- **PROJ-R99:** Custom local project invariant.\n',
      'utf8'
    );
    const planRes = executeCli(['update', 'plan', '--promote-tier', 'strict', '--cwd', ws]);
    assert.equal(planRes.exitCode, 0);
    assert.match(planRes.stdout, /Tier Promotion Checklist/);

    const applyRes = executeCli(['update', 'apply', '--approver', 'hoang-doan', '--cwd', ws]);
    assert.equal(applyRes.exitCode, 0, applyRes.stderr);
    assert.match(
      fs.readFileSync(path.join(ws, 'governance/PROJECT-CONSTITUTION.md'), 'utf8'),
      /PROJ-R99/
    );

    // Uninstall hooks preserves custom-user-hook
    assert.equal(executeCli(['hooks', 'uninstall', '--cwd', ws]).exitCode, 0);
    const afterUninst = fs.readFileSync(path.join(ws, '.git/hooks/pre-commit'), 'utf8');
    assert.match(afterUninst, /custom-user-hook/);
    assert.doesNotMatch(afterUninst, /AI-SDGS-HOOK/);
  });

  it('executes bin/aisdgs.mjs cleanly as an OS subprocess with exact exit codes', () => {
    const sub = spawnSync(process.execPath, [BIN_MJS, '--version'], { encoding: 'utf8' });
    assert.equal(sub.status, 0);
    assert.equal(sub.stdout.trim(), CLI_VERSION);
  });
});
