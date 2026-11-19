import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadStandardBundle } from '../src/core/bundle.ts';
import { validateJsonSchema } from '../src/core/json-schema.ts';
import {
  parseMarkdownFrontmatter,
  parseYaml,
  serializeMarkdownWithFrontmatter,
  stringifyYaml
} from '../src/core/yaml-frontmatter.ts';

describe('yaml-frontmatter & Draft 2020-12 json-schema engine', () => {
  const bundle = loadStandardBundle();
  const getSchema = (name: string) =>
    JSON.parse(bundle.files[`schemas/${name}`]) as Record<string, unknown>;

  it('round-trips complex nested YAML maps and arrays-of-objects with nested lists', () => {
    const sample = {
      id: 'EXCEPTIONS-001',
      title: 'Project Waivers',
      version: '1.0.0',
      status: 'APPROVED',
      artifact_class: 'CONSTITUTIONAL',
      last_updated: '2026-11-18',
      waivers: [
        {
          id: 'EXC-0001',
          status: 'ACTIVE',
          waives_rules: ['STD-003-R03', 'STD-008-R05'],
          affected_scope: ['experiments/**'],
          risk_level: 'LOW',
          justification: 'Temporary spike branch exploration.',
          compensating_control: 'Excluded from production CI build.',
          remediation_plan: 'Promote to REQ-* before merge.',
          expires_at: '2026-12-31',
          approved_by: 'hoang-doan',
          approved_at: '2026-11-18'
        }
      ]
    };
    const yaml = stringifyYaml(sample);
    const parsed = parseYaml(yaml);
    assert.deepEqual(parsed, sample);
    const schemaErrs = validateJsonSchema(parsed, getSchema('exception.schema.json'));
    assert.equal(schemaErrs.length, 0);
  });

  it('blocks AI agent identifiers in roles and approved_by fields (DEC-018)', () => {
    const badConfig = {
      schema_version: '1.0.0',
      project: { id: 'demo-app', name: 'Demo', registered_at: '2026-11-18' },
      governance: { standard_version: '1.0.0', adoption_tier: 'STANDARD', onboarding_mode: 'GREENFIELD' },
      roles: {
        'HUM-OWNER': 'AI-ARCHITECT',
        'HUM-PROD': 'claude-agent',
        'HUM-ARCH': 'hoang',
        'HUM-SEC': 'hoang'
      },
      protected_paths: ['.aisdgs/**', 'governance/**', 'AGENTS.md', '**/package.json'],
      adapters: { root_router: 'AGENTS.md', targets: ['agents'] }
    };
    const errs = validateJsonSchema(badConfig, getSchema('config.schema.json'));
    assert.ok(errs.length >= 2);
    assert.ok(errs.some((e) => e.path === '/roles/HUM-OWNER'));
  });

  it('enforces conditional if/then rules on adoption-profile NOT_APPLICABLE and CR tracks', () => {
    const profileMissingJust = {
      profile_version: '1.0.0',
      adoption_tier: 'LITE',
      onboarding_mode: 'GREENFIELD',
      approved_by: 'hoang',
      standards: Array.from({ length: 12 }, (_, idx) => ({
        id: `STD-${String(idx + 1).padStart(3, '0')}`,
        applicability: idx === 11 ? 'NOT_APPLICABLE' : 'MANDATORY'
      }))
    };
    const profErrs = validateJsonSchema(profileMissingJust, getSchema('adoption-profile.schema.json'));
    assert.equal(profErrs.length, 1);
    assert.match(profErrs[0].message, /justification/);

    const crFullMissingImpact = {
      id: 'CR-0001',
      title: 'Add payment service',
      version: '1.0.0',
      artifact_class: 'GOVERNANCE_RECORD',
      track: 'FULL',
      classification: 'FEATURE_REQUEST',
      cr_status: 'APPROVED',
      affected_files: ['src/pay.ts'],
      last_updated: '2026-11-18'
    };
    const crErrs = validateJsonSchema(crFullMissingImpact, getSchema('change-request.schema.json'));
    assert.ok(crErrs.some((e) => e.message.includes('risk_level')));
    assert.ok(crErrs.some((e) => e.message.includes('approved_by')));
  });

  it('parses and serializes Markdown frontmatter cleanly', () => {
    const md = serializeMarkdownWithFrontmatter(
      { id: 'ADR-001', title: 'Modular Monolith', version: '1.0.0', status: 'APPROVED', last_updated: '2026-11-18' },
      '# ADR-001\n\nBody content.\n'
    );
    const parsed = parseMarkdownFrontmatter(md);
    assert.equal(parsed.hasFrontmatter, true);
    assert.equal(parsed.frontmatter.id, 'ADR-001');
    assert.match(parsed.body, /# ADR-001/);
  });
});
