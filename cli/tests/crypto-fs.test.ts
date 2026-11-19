import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  assertUpdateWriteBarrier,
  countLinesLf,
  matchesAnyGlob,
  matchGlob,
  renderTemplate,
  sha256Lf
} from '../src/core/crypto-fs.ts';

describe('crypto-fs deterministic utilities', () => {
  it('computes identical SHA256-UTF8-LF digest for CRLF and LF inputs (DEC-013)', () => {
    const lf = 'id: STD-001\ntitle: Constitution\n---\nBody line\n';
    const crlf = 'id: STD-001\r\ntitle: Constitution\r\n---\r\nBody line\r\n';
    assert.equal(sha256Lf(lf), sha256Lf(crlf));
    assert.equal(sha256Lf(lf).length, 64);
  });

  it('counts logical lines accurately across LF and CRLF', () => {
    assert.equal(countLinesLf(''), 0);
    assert.equal(countLinesLf('one\ntwo\nthree\n'), 3);
    assert.equal(countLinesLf('one\r\ntwo\r\nthree'), 3);
  });

  it('matches protected_paths globs accurately across Windows and POSIX separators', () => {
    assert.equal(matchGlob('.aisdgs/standard/STD-001.md', '.aisdgs/**'), true);
    assert.equal(matchGlob('package.json', '**/package.json'), true);
    assert.equal(matchGlob('services/api/package.json', '**/package.json'), true);
    assert.equal(matchGlob('src\\Billing\\Billing.csproj', '**/*.csproj'), true);
    assert.equal(matchGlob('db/migrations/001_init.sql', '**/migrations/**'), true);
    assert.equal(matchGlob('src/utils/helper.ts', '**/migrations/**'), false);
    assert.equal(matchesAnyGlob('AGENTS.md', ['governance/**', 'AGENTS.md']), true);
  });

  it('substitutes {{TOKEN}} placeholders deterministically while preserving unknown tokens (DEC-017)', () => {
    const out = renderTemplate('Project: {{PROJECT_ID}} ({{ADOPTION_TIER}}) {{UNKNOWN}}', {
      PROJECT_ID: 'billing-core',
      ADOPTION_TIER: 'STANDARD'
    });
    assert.equal(out, 'Project: billing-core (STANDARD) {{UNKNOWN}}');
  });

  it('enforces STD-007-R07 write-barrier blocking governance/ and docs/ mutations', () => {
    const root = path.resolve('C:/mock-repo');
    assert.doesNotThrow(() =>
      assertUpdateWriteBarrier(root, path.join(root, '.aisdgs/standard/STD-001.md'))
    );
    assert.doesNotThrow(() =>
      assertUpdateWriteBarrier(root, path.join(root, 'AGENTS.md'), true)
    );
    assert.throws(
      () => assertUpdateWriteBarrier(root, path.join(root, 'governance/PROJECT-CONSTITUTION.md'), true),
      /Write-Barrier Violation/
    );
    assert.throws(
      () => assertUpdateWriteBarrier(root, path.join(root, 'docs/requirements/REQ-FUNC-001.md'), true),
      /Write-Barrier Violation/
    );
  });
});
