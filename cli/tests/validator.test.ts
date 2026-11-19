import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { loadStandardBundle } from '../src/core/bundle.ts';
import {
  renderTemplate,
  sha256FileLf,
  sha256Lf,
  writeFileAtomicLf
} from '../src/core/crypto-fs.ts';
import { runValidation } from '../src/core/validator.ts';
import {
  serializeMarkdownWithFrontmatter,
  stringifyYaml
} from '../src/core/yaml-frontmatter.ts';

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisdgs-p8-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Helper building a clean, valid STANDARD-tier workspace fixture to test Stage 1..8 mutations.
 */
function scaffoldValidFixture(ws: string): void {
  const bundle = loadStandardBundle();
  const lockEntries: Array<{ path: string; category: string; sha256: string }> = [];

  for (const [rel, content] of Object.entries(bundle.files)) {
    if (rel.startsWith('standard/') || rel.startsWith('schemas/') || rel.startsWith('policies/')) {
      const targetRel = `.aisdgs/${rel}`;
      writeFileAtomicLf(path.join(ws, targetRel), content);
      const category = rel.startsWith('standard/')
        ? 'STANDARD'
        : rel.startsWith('schemas/')
          ? 'SCHEMA'
          : 'POLICY';
      lockEntries.push({ path: targetRel, category, sha256: sha256Lf(content) });
    }
  }

  writeFileAtomicLf(
    path.join(ws, '.aisdgs/standard-lock.yaml'),
    stringifyYaml({
      lockfile_version: 1,
      standard_version: bundle.standardVersion,
      release_id: bundle.releaseId,
      hash_normalization: 'SHA256-UTF8-LF',
      installed_at: '2026-11-18',
      files: lockEntries
    })
  );

  const tokens = {
    PROJECT_ID: 'fixture-app',
    PROJECT_NAME: 'Fixture App',
    PROJECT_DESCRIPTION: 'Unit test fixture repository',
    DATE_ISO: '2026-11-18',
    TIMESTAMP_ISO: '2026-11-18T10:00:00Z',
    STANDARD_VERSION: '1.0.0',
    ADOPTION_TIER: 'STANDARD',
    ONBOARDING_MODE: 'GREENFIELD',
    STRICT_VALIDATION: 'false',
    HUM_OWNER: 'hoang-doan',
    HUM_PROD: 'hoang-doan',
    HUM_ARCH: 'hoang-doan',
    HUM_SEC: 'hoang-doan'
  };

  const cfgText = renderTemplate(bundle.files['templates/project/aisdgs-config.yaml'], tokens);
  const cfgPath = path.join(ws, '.aisdgs/config.yaml');
  writeFileAtomicLf(cfgPath, cfgText);
  const cfgSha = sha256FileLf(cfgPath);

  const profPath = path.join(ws, '.aisdgs/adoption-profile.yaml');
  writeFileAtomicLf(
    profPath,
    renderTemplate(bundle.files['templates/project/adoption-profile.yaml'], tokens)
  );

  const allTokens = { ...tokens, CONFIG_SHA256: cfgSha };
  writeFileAtomicLf(
    path.join(ws, 'AGENTS.md'),
    renderTemplate(bundle.files['adapters/AGENTS.template.md'], allTokens)
  );
  writeFileAtomicLf(
    path.join(ws, 'CLAUDE.md'),
    renderTemplate(bundle.files['adapters/CLAUDE.template.md'], allTokens)
  );
  writeFileAtomicLf(
    path.join(ws, 'GEMINI.md'),
    renderTemplate(bundle.files['adapters/GEMINI.template.md'], allTokens)
  );
  writeFileAtomicLf(
    path.join(ws, '.cursor/rules/aisdgs.mdc'),
    renderTemplate(bundle.files['adapters/cursor-aisdgs.template.mdc'], allTokens)
  );

  const constContent = renderTemplate(bundle.files['templates/project/PROJECT-CONSTITUTION.md'], allTokens).replace(
    'status: DRAFT',
    'status: APPROVED'
  );
  const constPath = path.join(ws, 'governance/PROJECT-CONSTITUTION.md');
  writeFileAtomicLf(constPath, constContent);

  writeFileAtomicLf(
    path.join(ws, 'governance/EXCEPTIONS.md'),
    renderTemplate(bundle.files['templates/project/EXCEPTIONS.md'], allTokens)
  );
  writeFileAtomicLf(
    path.join(ws, 'changes/CHANGELOG-GOVERNANCE.md'),
    renderTemplate(bundle.files['templates/project/CHANGELOG-GOVERNANCE.md'], allTokens)
  );

  const reqPath = path.join(ws, 'docs/requirements/REQ-FUNC-001.md');
  writeFileAtomicLf(
    reqPath,
    serializeMarkdownWithFrontmatter(
      {
        id: 'REQ-FUNC-001',
        title: 'User Authentication',
        version: '1.0.0',
        status: 'APPROVED',
        artifact_class: 'NORMATIVE_SPEC',
        priority: 'MUST',
        normative_references: ['STD-005'],
        acceptance_criteria: ['Given valid credentials, login returns HTTP 200.'],
        last_updated: '2026-11-18'
      },
      '# REQ-FUNC-001\n\nSystem MUST authenticate users deterministically.\n'
    )
  );

  writeFileAtomicLf(
    path.join(ws, 'governance/PROJECT-BASELINE.md'),
    serializeMarkdownWithFrontmatter(
      {
        id: 'BASELINE-001',
        title: 'Fixture App Baseline',
        version: '1.0.0',
        status: 'APPROVED',
        artifact_class: 'CONSTITUTIONAL',
        baseline_version: '1.0.0',
        baseline_state: 'LOCKED',
        hash_normalization: 'SHA256-UTF8-LF',
        approved_by: 'hoang-doan',
        locked_at: '2026-11-18T10:00:00Z',
        last_updated: '2026-11-18',
        artifacts: [
          {
            path: 'governance/PROJECT-CONSTITUTION.md',
            id: 'CONST-001',
            version: '1.0.0',
            kind: 'CONSTITUTION',
            sha256: sha256FileLf(constPath)
          },
          {
            path: 'docs/requirements/REQ-FUNC-001.md',
            id: 'REQ-FUNC-001',
            version: '1.0.0',
            kind: 'REQUIREMENT',
            sha256: sha256FileLf(reqPath)
          }
        ]
      },
      '# Locked Baseline\n\nAll baseline hashes verified.\n'
    )
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('8-Stage Deterministic L2 Validation Engine', () => {
  it('returns Exit Code 2 on uninitialized workspace', () => {
    const ws = createTempWorkspace();
    const res = runValidation(ws);
    assert.equal(res.exit_code, 2);
    assert.equal(res.ok, false);
  });

  it('passes clean STANDARD workspace with Exit Code 0 (COMPLIANT)', () => {
    const ws = createTempWorkspace();
    scaffoldValidFixture(ws);
    const res = runValidation(ws, { now: new Date('2026-11-18T12:00:00Z') });
    assert.equal(res.exit_code, 0, JSON.stringify(res.diagnostics, null, 2));
    assert.equal(res.compliance_state, 'COMPLIANT');
  });

  it('detects tampered Level 1 standard snapshot with Exit Code 3 (INTEGRITY_COMPROMISED)', () => {
    const ws = createTempWorkspace();
    scaffoldValidFixture(ws);
    fs.appendFileSync(path.join(ws, '.aisdgs/standard/STD-001.md'), '\nTampered locally!\n', 'utf8');
    const res = runValidation(ws);
    assert.equal(res.exit_code, 3);
    assert.equal(res.compliance_state, 'INTEGRITY_COMPROMISED');
    assert.ok(res.diagnostics.some((d) => d.rule_id === 'STD-001-R05'));
  });

  it('rejects waivers targeting [NON-WAIVABLE] rules and expired waivers, while allowing valid waivers', () => {
    const ws = createTempWorkspace();
    scaffoldValidFixture(ws);

    // Valid [WAIVABLE] waiver -> COMPLIANT_WITH_WAIVERS (Exit 0)
    writeFileAtomicLf(
      path.join(ws, 'governance/EXCEPTIONS.md'),
      serializeMarkdownWithFrontmatter(
        {
          id: 'EXCEPTIONS-001',
          title: 'Waivers',
          version: '1.0.0',
          status: 'APPROVED',
          artifact_class: 'CONSTITUTIONAL',
          last_updated: '2026-11-18',
          waivers: [
            {
              id: 'EXC-0001',
              status: 'ACTIVE',
              waives_rules: ['STD-008-R05'],
              affected_scope: ['src/legacy/**'],
              risk_level: 'LOW',
              justification: 'Legacy internal endpoint migration.',
              compensating_control: 'Integration test suite guards payloads.',
              remediation_plan: 'Extract OpenAPI spec in Sprint 4.',
              expires_at: '2027-01-15',
              approved_by: 'hoang-doan',
              approved_at: '2026-11-18'
            }
          ]
        },
        '# Waivers\n'
      )
    );
    const validRes = runValidation(ws, { now: new Date('2026-11-18T12:00:00Z') });
    assert.equal(validRes.exit_code, 0, JSON.stringify(validRes.diagnostics));
    assert.equal(validRes.compliance_state, 'COMPLIANT_WITH_WAIVERS');

    // Attempt to waive [NON-WAIVABLE] STD-001-R02 + expired date -> Exit 1
    writeFileAtomicLf(
      path.join(ws, 'governance/EXCEPTIONS.md'),
      serializeMarkdownWithFrontmatter(
        {
          id: 'EXCEPTIONS-001',
          title: 'Waivers',
          version: '1.0.0',
          status: 'APPROVED',
          artifact_class: 'CONSTITUTIONAL',
          last_updated: '2026-11-18',
          waivers: [
            {
              id: 'EXC-0002',
              status: 'ACTIVE',
              waives_rules: ['STD-001-R02'],
              affected_scope: ['governance/**'],
              risk_level: 'HIGH',
              justification: 'Let AI approve everything.',
              compensating_control: 'None.',
              remediation_plan: 'Never.',
              expires_at: '2026-11-01',
              approved_by: 'hoang-doan',
              approved_at: '2026-10-01'
            }
          ]
        },
        '# Waivers\n'
      )
    );
    const badRes = runValidation(ws, { now: new Date('2026-11-18T12:00:00Z') });
    assert.equal(badRes.exit_code, 1);
    assert.ok(badRes.diagnostics.some((d) => d.rule_id === 'STD-002-R04'));
    assert.ok(badRes.diagnostics.some((d) => d.rule_id === 'STD-002-R06'));
  });

  it('enforces 72h deadline on EMERGENCY_ACTIVE CRs and 150-line budget on AGENTS.md', () => {
    const ws = createTempWorkspace();
    scaffoldValidFixture(ws);

    writeFileAtomicLf(
      path.join(ws, 'changes/records/CR-0001.md'),
      serializeMarkdownWithFrontmatter(
        {
          id: 'CR-0001',
          title: 'EMERGENCY HOTFIX — Webhook crash',
          version: '1.0.0',
          artifact_class: 'GOVERNANCE_RECORD',
          track: 'EMERGENCY',
          classification: 'EMERGENCY_CHANGE',
          cr_status: 'EMERGENCY_ACTIVE',
          incident_id: 'INC-500',
          created_at: '2026-11-18T00:00:00Z',
          affected_files: ['src/webhook.ts'],
          approved_by: ['hoang-doan'],
          last_updated: '2026-11-18'
        },
        '# Emergency\n'
      )
    );

    // At +10 hours -> PASS with warning (Exit 0)
    const withinWindow = runValidation(ws, { now: new Date('2026-11-18T10:00:00Z') });
    assert.equal(withinWindow.exit_code, 0);
    assert.equal(withinWindow.summary.warnings, 1);

    // At +80 hours (> 72h) + AGENTS.md bloated to 160 lines -> FAIL (Exit 1)
    const bloatedAgents = fs.readFileSync(path.join(ws, 'AGENTS.md'), 'utf8') + '\n'.repeat(110) + 'Extra line';
    writeFileAtomicLf(path.join(ws, 'AGENTS.md'), bloatedAgents);

    const overdue = runValidation(ws, { now: new Date('2026-11-21T08:00:00Z') });
    assert.equal(overdue.exit_code, 1);
    assert.ok(overdue.diagnostics.some((d) => d.rule_id === 'STD-012-R07' && d.severity === 'ERROR'));
    assert.ok(overdue.diagnostics.some((d) => d.rule_id === 'STD-011-R03'));
  });

  it('catches dangling links, normative cycles, unauthorized baseline drift, and permits authorized CR AMENDING', () => {
    const ws = createTempWorkspace();
    scaffoldValidFixture(ws);

    // Mutate baselined REQ-FUNC-001 without CR -> Exit 1 (STD-005-R05)
    const reqPath = path.join(ws, 'docs/requirements/REQ-FUNC-001.md');
    fs.appendFileSync(reqPath, '\nSilent unapproved requirement edit!\n', 'utf8');
    const driftRes = runValidation(ws);
    assert.equal(driftRes.exit_code, 1);
    assert.ok(driftRes.diagnostics.some((d) => d.rule_id === 'STD-005-R05' && d.severity === 'ERROR'));

    // Authorize mutation via IN_PROGRESS CR covering docs/requirements/REQ-FUNC-001.md -> Exit 0 (AMENDING INFO)
    writeFileAtomicLf(
      path.join(ws, 'changes/records/CR-0002.md'),
      serializeMarkdownWithFrontmatter(
        {
          id: 'CR-0002',
          title: 'Update login MFA requirement',
          version: '1.0.0',
          artifact_class: 'GOVERNANCE_RECORD',
          track: 'FULL',
          classification: 'FEATURE_REQUEST',
          cr_status: 'IN_PROGRESS',
          request_source: 'hoang-doan',
          risk_level: 'MEDIUM',
          affected_requirements: ['REQ-FUNC-001'],
          affected_docs: ['docs/requirements/REQ-FUNC-001.md'],
          affected_files: ['src/auth/**', 'docs/requirements/REQ-FUNC-001.md'],
          dependency_impact: 'None',
          rollback_summary: 'Revert commit and re-lock baseline.',
          required_approvals: ['HUM-PROD'],
          approved_by: ['hoang-doan'],
          last_updated: '2026-11-18'
        },
        '# CR-0002\n'
      )
    );
    const amendingRes = runValidation(ws);
    assert.equal(amendingRes.exit_code, 0, JSON.stringify(amendingRes.diagnostics, null, 2));
    assert.ok(amendingRes.diagnostics.some((d) => d.severity === 'INFO' && d.message.includes('AMENDING')));

    // Add circular ADR-001 <-> ADR-002 + dangling REQ-FUNC-999 + leaked GitHub PAT -> Exit 1
    writeFileAtomicLf(
      path.join(ws, 'docs/architecture/ADR-001.md'),
      serializeMarkdownWithFrontmatter(
        {
          id: 'ADR-001',
          title: 'Cycle A',
          version: '1.0.0',
          status: 'APPROVED',
          artifact_class: 'NORMATIVE_SPEC',
          normative_references: ['ADR-002', 'REQ-FUNC-999'],
          last_updated: '2026-11-18'
        },
        '# ADR-001\n\nLeaked token ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD\n'
      )
    );
    writeFileAtomicLf(
      path.join(ws, 'docs/architecture/ADR-002.md'),
      serializeMarkdownWithFrontmatter(
        {
          id: 'ADR-002',
          title: 'Cycle B',
          version: '1.0.0',
          status: 'APPROVED',
          artifact_class: 'NORMATIVE_SPEC',
          normative_references: ['ADR-001'],
          last_updated: '2026-11-18'
        },
        '# ADR-002\n\nBody.\n'
      )
    );
    const graphErrRes = runValidation(ws);
    assert.equal(graphErrRes.exit_code, 1);
    assert.ok(graphErrRes.diagnostics.some((d) => d.rule_id === 'STD-004-R04'));
    assert.ok(graphErrRes.diagnostics.some((d) => d.rule_id === 'STD-004-R05'));
    assert.ok(graphErrRes.diagnostics.some((d) => d.rule_id === 'STD-012-R01'));
  });
});
