import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeFileAtomicLf } from '../src/core/crypto-fs.ts';
import { runGit } from '../src/core/git-vcs.ts';
import {
  parseMarkdownFrontmatter,
  serializeMarkdownWithFrontmatter
} from '../src/core/yaml-frontmatter.ts';
import { executeCli } from '../src/main.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_STANDALONE = path.resolve(__dirname, '../../dist/aisdgs-standalone.mjs');

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function initGitRepo(ws: string): void {
  runGit(ws, ['init']);
  runGit(ws, ['config', 'user.name', 'hoang-doan']);
  runGit(ws, ['config', 'user.email', 'hoang@example.com']);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 10 — End-to-End Governance Scenarios & Standalone Packaging', () => {
  it('E2E-01: TIER-1 LITE solo MVP lifecycle (init -> lock -> CR-FAST -> verify -> relock)', () => {
    const ws = makeTempDir('aisdgs-e2e-lite-');
    initGitRepo(ws);

    assert.equal(
      executeCli(['init', '--cwd', ws, '--tier', 'lite', '--mode', 'greenfield', '--owner', 'hoang-doan']).exitCode,
      0
    );
    // LITE tier does not materialize governance/EXCEPTIONS.md or docs/ upfront (STD-007-R02)
    assert.equal(fs.existsSync(path.join(ws, 'governance/EXCEPTIONS.md')), false);
    assert.equal(fs.existsSync(path.join(ws, 'docs')), false);

    assert.equal(executeCli(['baseline', 'lock', '--cwd', ws, '--approver', 'hoang-doan']).exitCode, 0);
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'chore: initial LITE baseline']);

    // Create CR-FAST for new MVP feature
    assert.equal(
      executeCli([
        'change', 'create',
        '--cwd', ws,
        '--track', 'fast',
        '--class', 'feature_request',
        '--title', 'Add healthcheck endpoint',
        '--files', 'src/health.ts'
      ]).exitCode,
      0
    );

    // Human approves CR-0001 and commits approval
    const crPath = path.join(ws, 'changes/records/CR-0001.md');
    const crParsed = parseMarkdownFrontmatter(fs.readFileSync(crPath, 'utf8'));
    crParsed.frontmatter.cr_status = 'IN_PROGRESS';
    crParsed.frontmatter.approved_by = ['hoang-doan'];
    writeFileAtomicLf(crPath, serializeMarkdownWithFrontmatter(crParsed.frontmatter, crParsed.body));
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'chore: approve CR-0001']);

    // Implement within scope
    writeFileAtomicLf(path.join(ws, 'src/health.ts'), 'export const health = () => "ok";\n');
    assert.equal(executeCli(['change', 'verify', 'CR-0001', '--cwd', ws]).exitCode, 0);

    // Record verification evidence & close CR
    crParsed.frontmatter.cr_status = 'CLOSED';
    crParsed.frontmatter.verification_evidence = ['node --test passed (1/1)'];
    writeFileAtomicLf(crPath, serializeMarkdownWithFrontmatter(crParsed.frontmatter, crParsed.body));

    assert.equal(
      executeCli(['baseline', 'lock', '--cwd', ws, '--approver', 'hoang-doan', '--bump', 'minor', '--cr', 'CR-0001']).exitCode,
      0
    );
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'feat: add healthcheck [CR-0001]']);

    const finalVal = executeCli(['validate', '--cwd', ws, '--json']);
    assert.equal(finalVal.exitCode, 0);
    assert.equal(JSON.parse(finalVal.stdout).compliance_state, 'COMPLIANT');
  });

  it('E2E-02: TIER-3 STRICT blocks Ring 2 self-approval spoofing, test-skipping, and shadow dependencies', () => {
    const ws = makeTempDir('aisdgs-e2e-strict-');
    initGitRepo(ws);
    writeFileAtomicLf(path.join(ws, 'package.json'), '{\n  "name": "strict-svc",\n  "dependencies": {}\n}\n');
    writeFileAtomicLf(path.join(ws, 'tests/auth.spec.ts'), 'it("checks token", () => {});\n');

    assert.equal(
      executeCli(['init', '--cwd', ws, '--tier', 'strict', '--mode', 'brownfield', '--owner', 'hoang-doan']).exitCode,
      0
    );
    // STRICT auto-generates Ring 1 .claude/settings.json permissions (DEC-020)
    assert.equal(fs.existsSync(path.join(ws, '.claude/settings.json')), true);

    assert.equal(
      executeCli(['baseline', 'lock', '--anchor', '--cwd', ws, '--approver', 'hoang-doan']).exitCode,
      0
    );
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'chore: lock STRICT anchor baseline']);

    // Attack 1: Ring 2 Local Self-Approval Spoofing (uncommitted CR set to APPROVED + uncommitted src edit)
    executeCli([
      'change', 'create',
      '--cwd', ws,
      '--track', 'fast',
      '--title', 'Sneaky self-approved edit',
      '--files', 'src/service.ts'
    ]);
    const cr1Path = path.join(ws, 'changes/records/CR-0001.md');
    const cr1 = parseMarkdownFrontmatter(fs.readFileSync(cr1Path, 'utf8'));
    cr1.frontmatter.cr_status = 'APPROVED';
    cr1.frontmatter.approved_by = ['hoang-doan'];
    writeFileAtomicLf(cr1Path, serializeMarkdownWithFrontmatter(cr1.frontmatter, cr1.body));
    writeFileAtomicLf(path.join(ws, 'src/service.ts'), 'export const hacked = true;\n');

    const spoofCheck = executeCli(['validate', '--cwd', ws, '--json']);
    assert.equal(spoofCheck.exitCode, 3);
    const spoofBody = JSON.parse(spoofCheck.stdout);
    assert.equal(spoofBody.compliance_state, 'INTEGRITY_COMPROMISED');
    assert.ok(spoofBody.diagnostics.some((d: { rule_id: string }) => d.rule_id === 'STD-001-R03'));

    // Clean working tree
    fs.rmSync(cr1Path, { force: true });
    fs.rmSync(path.join(ws, 'src'), { recursive: true, force: true });

    // Attack 2: Test-Skipping Sabotage (STD-009-R02) + Attack 3: Shadow Dependency in package.json (STD-010-R02)
    writeFileAtomicLf(
      path.join(ws, 'tests/auth.spec.ts'),
      'it.skip("checks token", () => {});\n'
    );
    writeFileAtomicLf(
      path.join(ws, 'package.json'),
      '{\n  "name": "strict-svc",\n  "dependencies": { "left-pad": "1.0.0" }\n}\n'
    );

    const attackCheck = executeCli(['validate', '--cwd', ws, '--json']);
    assert.equal(attackCheck.exitCode, 1);
    const attackBody = JSON.parse(attackCheck.stdout);
    assert.ok(attackBody.diagnostics.some((d: { rule_id: string }) => d.rule_id === 'STD-009-R02'));
    assert.ok(attackBody.diagnostics.some((d: { rule_id: string }) => d.rule_id === 'STD-010-R02'));
  });

  it('E2E-03: CR-EMERGENCY P0 hotfix mitigation and post-incident baseline reconciliation', () => {
    const ws = makeTempDir('aisdgs-e2e-emerg-');
    initGitRepo(ws);

    executeCli(['init', '--cwd', ws, '--tier', 'standard', '--mode', 'greenfield', '--owner', 'hoang-doan']);
    executeCli(['baseline', 'lock', '--cwd', ws, '--approver', 'hoang-doan']);
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'chore: initial baseline']);

    // P0 Outage strikes -> create EMERGENCY CR
    const emCreate = executeCli([
      'change', 'create',
      '--cwd', ws,
      '--track', 'emergency',
      '--incident', 'INC-909',
      '--title', 'Null guard on webhook payload',
      '--approver', 'hoang-doan',
      '--files', 'src/webhook.ts,tests/webhook.test.ts,docs/requirements/REQ-FUNC-001.md'
    ]);
    assert.equal(emCreate.exitCode, 0);
    runGit(ws, ['add', 'changes/records/CR-0001.md']);
    runGit(ws, ['commit', '-m', 'hotfix: open emergency CR-0001']);

    writeFileAtomicLf(path.join(ws, 'src/webhook.ts'), 'export const handle = (p: unknown) => Boolean(p);\n');
    const duringOutage = executeCli(['validate', '--cwd', ws, '--json']);
    assert.equal(duringOutage.exitCode, 0);
    assert.equal(JSON.parse(duringOutage.stdout).summary.warnings, 1);

    // Reconcile within 72h: add regression test, update REQ-FUNC-001, record evidence, close & re-lock
    writeFileAtomicLf(path.join(ws, 'tests/webhook.test.ts'), 'it("handles null payload", () => {});\n');
    fs.appendFileSync(
      path.join(ws, 'docs/requirements/REQ-FUNC-001.md'),
      '\n- **AC-03:** Null webhook payloads MUST be rejected safely without throwing.\n',
      'utf8'
    );
    const crPath = path.join(ws, 'changes/records/CR-0001.md');
    const cr = parseMarkdownFrontmatter(fs.readFileSync(crPath, 'utf8'));
    cr.frontmatter.cr_status = 'CLOSED';
    cr.frontmatter.verification_evidence = ['node --test tests/webhook.test.ts (PASS)'];
    writeFileAtomicLf(crPath, serializeMarkdownWithFrontmatter(cr.frontmatter, cr.body));

    assert.equal(
      executeCli(['baseline', 'lock', '--cwd', ws, '--approver', 'hoang-doan', '--bump', 'patch', '--cr', 'CR-0001']).exitCode,
      0
    );
    runGit(ws, ['add', '.']);
    runGit(ws, ['commit', '-m', 'chore: reconcile emergency CR-0001']);

    const afterReconcile = executeCli(['validate', '--cwd', ws, '--json']);
    assert.equal(afterReconcile.exitCode, 0);
    assert.equal(JSON.parse(afterReconcile.stdout).summary.warnings, 0);
  });

  it('E2E-04: Standalone single-file dist/aisdgs-standalone.mjs runs 100% isolated outside source repo', () => {
    assert.equal(fs.existsSync(DIST_STANDALONE), true, 'dist/aisdgs-standalone.mjs must exist');
    const isolatedBinDir = makeTempDir('aisdgs-isolated-bin-');
    const isolatedTargetRepo = makeTempDir('aisdgs-isolated-repo-');

    const copiedMjs = path.join(isolatedBinDir, 'aisdgs-standalone.mjs');
    fs.copyFileSync(DIST_STANDALONE, copiedMjs);

    const runStandalone = (args: string[]) =>
      spawnSync(process.execPath, [copiedMjs, ...args], {
        cwd: isolatedTargetRepo,
        encoding: 'utf8'
      });

    const initOut = runStandalone(['init', '--tier', 'standard', '--owner', 'hoang-doan']);
    assert.equal(initOut.status, 0, initOut.stderr);

    const lockOut = runStandalone(['baseline', 'lock', '--approver', 'hoang-doan']);
    assert.equal(lockOut.status, 0, lockOut.stderr);

    const valOut = runStandalone(['validate', '--json']);
    assert.equal(valOut.status, 0, valOut.stderr);
    const parsed = JSON.parse(valOut.stdout);
    assert.equal(parsed.compliance_state, 'COMPLIANT');
    assert.equal(parsed.exit_code, 0);
  });
});
