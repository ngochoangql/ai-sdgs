import fs from 'node:fs';
import path from 'node:path';
import {
  matchesAnyGlob,
  toPosixPath,
  walkFiles,
  writeFileAtomicLf
} from '../core/crypto-fs.ts';
import {
  getUnifiedDiff,
  getWorkingTreeChangedFiles,
  isGitRepository
} from '../core/git-vcs.ts';
import type { ExitCode, ProjectConfig } from '../core/types.ts';
import { runValidation } from '../core/validator.ts';
import { parseMarkdownFrontmatter, parseYaml } from '../core/yaml-frontmatter.ts';
import { runStatus } from './status-standard.ts';

export interface AuditOptions {
  crId?: string;
  baseRef?: string;
  outputPath?: string;
}

export function runAudit(
  workspaceRootInput: string,
  options: AuditOptions = {}
): {
  ok: boolean;
  exitCode: ExitCode;
  bundleMarkdown: string;
  outputPath?: string;
  l2ComplianceState: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const cfgPath = path.join(workspaceRoot, '.aisdgs', 'config.yaml');
  if (!fs.existsSync(cfgPath)) {
    return {
      ok: false,
      exitCode: 2,
      bundleMarkdown: "Workspace not initialized. Run 'aisdgs init'.",
      l2ComplianceState: 'NON_COMPLIANT'
    };
  }

  const cfg = parseYaml(fs.readFileSync(cfgPath, 'utf8')) as unknown as ProjectConfig;
  const l2Report = runValidation(workspaceRoot);
  const dateIso = new Date().toISOString().slice(0, 10);
  const targetCrId = options.crId ? options.crId.toUpperCase() : 'WORKING-TREE';

  const changedFiles = isGitRepository(workspaceRoot)
    ? getWorkingTreeChangedFiles(workspaceRoot)
    : [];
  const touchedProtected = changedFiles.filter((f) =>
    matchesAnyGlob(f, cfg.protected_paths)
  );
  const diffText = isGitRepository(workspaceRoot)
    ? getUnifiedDiff(workspaceRoot, options.baseRef)
    : '(Not a Git repository — diff unavailable)';

  const linkedSpecsText: string[] = [];
  if (options.crId) {
    const crAbs = path.join(workspaceRoot, 'changes', 'records', `${targetCrId}.md`);
    if (fs.existsSync(crAbs)) {
      const crRaw = fs.readFileSync(crAbs, 'utf8');
      linkedSpecsText.push(`### Change Request: \`${targetCrId}\`\n\n\`\`\`markdown\n${crRaw.trim()}\n\`\`\``);
      const fm = parseMarkdownFrontmatter(crRaw).frontmatter;
      const reqIds = Array.isArray(fm.affected_requirements) ? (fm.affected_requirements as string[]) : [];
      const adrIds = Array.isArray(fm.affected_adrs) ? (fm.affected_adrs as string[]) : [];
      const targetIds = new Set([...reqIds, ...adrIds]);

      for (const sub of ['requirements', 'architecture']) {
        for (const f of walkFiles(path.join(workspaceRoot, 'docs', sub))) {
          if (!f.endsWith('.md')) continue;
          const raw = fs.readFileSync(f, 'utf8');
          const sfm = parseMarkdownFrontmatter(raw).frontmatter;
          if (typeof sfm.id === 'string' && targetIds.has(sfm.id)) {
            linkedSpecsText.push(`### Linked Spec: \`${sfm.id}\` (\`${toPosixPath(path.relative(workspaceRoot, f))}\`)\n\n\`\`\`markdown\n${raw.trim()}\n\`\`\``);
          }
        }
      }
    }
  }

  const diagLines =
    l2Report.diagnostics.length === 0
      ? '- Zero deterministic `L2` diagnostics reported (`COMPLIANT`).'
      : l2Report.diagnostics
          .map((d) => `- **[${d.severity}] \`${d.rule_id}\`** (${d.file ?? 'workspace'}): ${d.message}`)
          .join('\n');

  const md = `---
id: "AUDIT-${targetCrId}"
title: "L3 Semantic Governance Audit — ${targetCrId}"
version: 1.0.0
status: DRAFT
artifact_class: GOVERNANCE_RECORD
last_updated: "${dateIso}"
---

# LAYER 3 SEMANTIC GOVERNANCE AUDIT — ${targetCrId}

- **Project:** \`${cfg.project.name}\` (\`${cfg.project.id}\`) | **Tier:** \`${cfg.governance.adoption_tier}\`
- **Deterministic \`L2\` Pre-Check Verdict:** \`${l2Report.compliance_state}\` (Exit Code \`${l2Report.exit_code}\`)
- **Changed Working-Tree Files (${changedFiles.length}):** ${changedFiles.length > 0 ? changedFiles.map((c) => `\`${c}\``).join(', ') : '*None*'}
- **Touched Protected Paths (${touchedProtected.length}):** ${touchedProtected.length > 0 ? touchedProtected.map((c) => `\`${c}\``).join(', ') : '*None*'}

---

## 1. DETERMINISTIC \`L2\` DIAGNOSTICS SNAPSHOT

${diagLines}

---

## 2. LINKED NORMATIVE SPECIFICATIONS CONTEXT

${linkedSpecsText.length > 0 ? linkedSpecsText.join('\n\n') : '*No specific CR/REQ/ADR linked (pass `--cr CR-XXXX` to bundle linked specifications).*'}

---

## 3. REPOSITORY UNIFIED DIFF (\`${options.baseRef ?? 'HEAD'}\`)

\`\`\`diff
${diffText.slice(0, 16000) || '(No uncommitted diff against HEAD)'}
\`\`\`

---

## 4. SEMANTIC COMPLIANCE RUBRIC (\`STD-009-R05\`)

| Check ID | Audit Dimension | Verdict | Reviewer Evidence |
| :--- | :--- | :--- | :--- |
| \`AUD-01\` | **Scope Containment (\`STD-006-R02\`):** Zero undeclared feature smuggling or drive-by edits. | \`PENDING_REVIEW\` | |
| \`AUD-02\` | **Requirement Fidelity (\`STD-005-R02\`):** Code logic satisfies all acceptance criteria of linked \`REQ-*\`. | \`PENDING_REVIEW\` | |
| \`AUD-03\` | **Architecture Invariants (\`STD-008-R02\`):** Zero forbidden cross-module couplings or ADR violations. | \`PENDING_REVIEW\` | |
| \`AUD-04\` | **Contract & Migration Safety (\`STD-008-R04..05\`):** Backward compatibility & rollback safety verified. | \`PENDING_REVIEW\` | |
| \`AUD-05\` | **Test Integrity (\`STD-009-R02..03\`):** Meaningful assertions added; zero skipped/weakened tests. | \`PENDING_REVIEW\` | |
| \`AUD-06\` | **Security & Secret Hygiene (\`STD-012-R01..04\`):** Zero hardcoded secrets, auth bypasses, or unsafe sinks. | \`PENDING_REVIEW\` | |
`;

  let savedRel: string | undefined;
  if (options.outputPath) {
    const absOut = path.resolve(workspaceRoot, options.outputPath);
    writeFileAtomicLf(absOut, md);
    savedRel = toPosixPath(path.relative(workspaceRoot, absOut));
  }

  return {
    ok: true,
    exitCode: 0,
    bundleMarkdown: md,
    outputPath: savedRel,
    l2ComplianceState: l2Report.compliance_state
  };
}

export function runExecutiveReport(
  workspaceRootInput: string,
  format: 'md' | 'json' = 'md',
  outputPath?: string
): {
  ok: boolean;
  exitCode: ExitCode;
  output: string;
  savedPath?: string;
} {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const status = runStatus(workspaceRoot);
  if (!status.ok) {
    return {
      ok: false,
      exitCode: 2,
      output: "Workspace not initialized. Run 'aisdgs init'."
    };
  }
  const val = runValidation(workspaceRoot);

  // Count governed entities
  const countInDir = (sub: string) =>
    walkFiles(path.join(workspaceRoot, sub)).filter((f) => f.endsWith('.md')).length;
  const reqCount = countInDir('docs/requirements');
  const adrCount = countInDir('docs/architecture');
  const crCount = countInDir('changes/records');

  const payload = {
    generated_at: new Date().toISOString(),
    project: {
      id: status.project_id,
      name: status.project_name,
      tier: status.adoption_tier,
      mode: status.onboarding_mode,
      standard_version: status.standard_version
    },
    compliance: {
      state: val.compliance_state,
      exit_code: val.exit_code,
      lockfile_intact: status.lockfile_intact,
      errors: val.summary.errors,
      warnings: val.summary.warnings,
      active_waivers: val.summary.active_waivers
    },
    baseline: {
      state: status.baseline_state,
      version: status.baseline_version,
      locked_artifacts: status.baseline_artifacts_count
    },
    inventory: {
      requirements: reqCount,
      adrs: adrCount,
      change_requests: crCount,
      active_crs: status.active_crs.length
    },
    hooks: status.hooks_installed,
    diagnostics: val.diagnostics
  };

  let rendered: string;
  if (format === 'json') {
    rendered = JSON.stringify(payload, null, 2) + '\n';
  } else {
    const diagMd =
      val.diagnostics.length === 0
        ? '- Zero active compliance errors or warnings.'
        : val.diagnostics
            .map((d) => `- **[${d.severity}] \`${d.rule_id}\`** (${d.file ?? 'workspace'}): ${d.message}`)
            .join('\n');

    rendered = `# AI-SDGS GOVERNANCE & COMPLIANCE POSTURE REPORT

- **Project:** \`${status.project_name}\` (\`${status.project_id}\`)
- **Adoption Tier / Mode:** \`${status.adoption_tier}\` / \`${status.onboarding_mode}\`
- **Pinned Standard Version:** \`${status.standard_version}\` (Lockfile Intact: \`${status.lockfile_intact}\`)
- **Overall Compliance State:** **\`${val.compliance_state}\`** (Errors: \`${val.summary.errors}\`, Warnings: \`${val.summary.warnings}\`, Active Waivers: \`${val.summary.active_waivers}\`)
- **Baseline State:** \`${status.baseline_state}\` (\`v${status.baseline_version}\`, \`${status.baseline_artifacts_count}\` locked artifacts)
- **Git Hooks Installed:** pre-commit=\`${status.hooks_installed.preCommit}\`, pre-push=\`${status.hooks_installed.prePush}\`

## Artifact Inventory
- **Discrete Requirements (\`REQ-*\`):** ${reqCount}
- **Architecture Decisions (\`ADR-*\`):** ${adrCount}
- **Total Change Requests (\`CR-*\`):** ${crCount} (${status.active_crs.length} currently open)

## Validation Diagnostics
${diagMd}
`;
  }

  let savedPath: string | undefined;
  if (outputPath) {
    const absOut = path.resolve(workspaceRoot, outputPath);
    writeFileAtomicLf(absOut, rendered);
    savedPath = toPosixPath(path.relative(workspaceRoot, absOut));
  }

  return {
    ok: true,
    exitCode: 0,
    output: rendered,
    savedPath
  };
}
