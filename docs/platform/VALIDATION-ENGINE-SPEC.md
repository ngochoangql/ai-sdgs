---
id: DOC-PLT-005
title: AI-SDGS Deterministic Validation & Semantic Audit Engine Specification
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-002
  - STD-004
  - STD-005
  - STD-006
  - STD-009
  - STD-010
  - STD-011
  - STD-012
  - DOC-PLT-004
last_updated: 2026-11-18
---

# DETERMINISTIC VALIDATION (`L2`) & SEMANTIC AUDIT (`L3`) ENGINE SPECIFICATION

## 1. DESIGN PRINCIPLES

1. **100% Determinism (`L2`):** Given identical repository files and Git tree state, `aisdgs validate` MUST produce identical diagnostics and exit codes (`0`, `1`, `2`, `3`) in `< 500ms` on typical repositories without calling LLMs or external network APIs.
2. **Collect-All Diagnostics (Non-Fail-Fast Reporting):** Aside from missing workspace configuration (`Exit Code 2`), the engine executes all applicable stages and aggregates all `ERROR` and `WARNING` diagnostics into a single pass so developers and AI agents fix everything in one iteration.
3. **Precedence of Exit Codes:** If any diagnostic raises `INTEGRITY_COMPROMISED`, final exit code is **`3`**; else if any `ERROR` (or `WARNING` promoted under `--strict` / `STRICT` tier) exists, exit code is **`1`**; else exit code is **`0`**.

---

## 2. EIGHT-STAGE DETERMINISTIC `L2` VALIDATION PIPELINE

### Stage 1 — Workspace Initialization & Standard Lockfile Integrity (`STD-001-R05`, `STD-007-R01`)
1. Check `.aisdgs/config.yaml` and `.aisdgs/standard-lock.yaml` exist (`Exit Code 2` if uninitialized).
2. Validate `.aisdgs/standard-lock.yaml` against `standard-lock.schema.json`.
3. Enumerate every file on disk under `.aisdgs/standard/`, `.aisdgs/schemas/`, and `.aisdgs/policies/`:
   - Compute `SHA256(UTF8(replace(bytes, "\r\n", "\n")))` (`DEC-013`).
   - Flag any missing file, modified digest, or unexpected extra file as `ERROR [STD-001-R05]` (`INTEGRITY_COMPROMISED` → `Exit Code 3`).

### Stage 2 — Configuration & Adoption Profile Validation (`STD-001-R06`, `STD-002-R01`, `STD-010-R02`)
1. Validate `.aisdgs/config.yaml` against `config.schema.json` (checking valid Tier, Mode, and non-AI `HUM-*` assignees per `DEC-018`).
2. Verify `protected_paths` covers all 4 mandatory path groups (`DEC-015`: `.aisdgs/**`, `governance/**` + `AGENTS.md`, package manifests, migrations/CI).
3. Validate `.aisdgs/adoption-profile.yaml` against `adoption-profile.schema.json` (ensuring all 12 `STD-001`..`012` entries exist and any `NOT_APPLICABLE` item has a `≥ 10` char `justification`).

### Stage 3 — Tier Topology, Anti-Bloat & Anti-Stub Scan (`STD-003-R07`, `STD-007-R02`)
1. Verify required governance files for the active `adoption_tier` exist (`DOC-PLT-001` §2).
2. Scan `governance/`, `docs/`, `changes/`, and `quality/` for empty directories (containing zero files) → emit `ERROR [STD-007-R02]`.
3. Scan Markdown body of any document whose frontmatter `status == APPROVED` for standalone unresolved `TODO` or `TBD` placeholder tokens (ignoring inline code spans/fences) or empty body → emit `ERROR [STD-003-R07]`.

### Stage 4 — YAML Frontmatter & Domain Schema Validation (`STD-003`, `STD-004-R02`)
Parse opening `--- ... ---` YAML frontmatter on every governed `.md` file and validate against its domain schema:
- `governance/PROJECT-BASELINE.md` → `baseline.schema.json`
- `governance/EXCEPTIONS.md` (if present) → `exception.schema.json`
- `changes/records/CR-*.md` → `change-request.schema.json` (`FAST` / `FULL` / `EMERGENCY` conditional rules)
- `governance/PROJECT-CONSTITUTION.md`, `docs/**.md`, `quality/reports/**.md` → `frontmatter.schema.json`.

### Stage 5 — Global Symbol Table, Cross-Reference Graph & Cycle Detector (`STD-004-R03..05`)
1. Register every entity ID from `.aisdgs/standard/STD-*.md` (plus `STD-XXX-Rnn` rules), `governance/**`, `docs/**`, `changes/records/**`, and inline `REQ-*` tables in `PROJECT-BASELINE.md` (`LITE` tier).
2. Flag duplicate project IDs (`ERROR [STD-004-R03]`).
3. Verify every referenced ID in `normative_references`, `affected_requirements`, `affected_adrs`, `supersedes`, `superseded_by`, and `waives_rules` resolves in the symbol table (`ERROR [STD-004-R04]` on dangling ID).
4. Run Depth-First Search (3-color cycle detection) over `normative_references` edges (`ERROR [STD-004-R05]` if cycle found).
5. Verify active CRs (`APPROVED`/`IN_PROGRESS`/`VERIFIED`) in `STANDARD`/`STRICT` tiers do not implement `DRAFT`, `SUPERSEDED`, or `DEPRECATED` `REQ-*` targets (`STD-003-R03`).

### Stage 6 — Waiver Legality, Emergency Clock & Context Budget Gate (`STD-002`, `STD-011`, `STD-012`)
1. **Waiver Enforcement (`governance/EXCEPTIONS.md`):**
   - Reject any `waives_rules` entry matching the canonical 48 `[NON-WAIVABLE]` rule set (`ERROR [STD-002-R04]`).
   - Check `ACTIVE` waivers: if `expires_at < current_date` → `ERROR [STD-002-R06]`; if duration exceeds Tier cap (`180d` / `90d` / `60d`) → `ERROR [STD-002-R06]`; if expiring `≤ 14d` → `WARNING`.
2. **Emergency Reconciliation Clock (`STD-012-R07`):**
   - For any `CR-*` with `cr_status == EMERGENCY_ACTIVE`: compute `elapsed_hours = now - created_at`. If `elapsed_hours > 72` (`LITE`/`STANDARD`) or `> 48` (`STRICT`) → `ERROR [STD-012-R07]`.
3. **Progressive Context Budgets & Sync (`STD-011-R03..05`, `R08`):**
   - Verify `lines(AGENTS.md) <= 150`, enabled bridges `<= 40` (and contain `AGENTS.md` pointer), `.aisdgs/policies/*.md <= 250`, and embedded `config_sha256` in `AGENTS.md` + bridges matches current `.aisdgs/config.yaml` SHA-256 digest (`DEC-019`).

### Stage 7 — Baseline Cryptographic Hash, Scope Lease & Ring 2 Anti-Spoofing (`STD-005`, `STD-006`, `DEC-007`)
1. **Baseline Artifact Digest Verification (`STD-005-R04..05`):**
   - When `baseline_state` is `ANCHORED` or `LOCKED`, recompute `SHA256-UTF8-LF` for every entry in `PROJECT-BASELINE.md` `artifacts`.
   - If a file hash differs from `PROJECT-BASELINE.md`: check whether an active (`APPROVED` or `IN_PROGRESS`) `CR-*` lists that path in `affected_docs` or `affected_files`. If covered, emit informational `AMENDING (Authorized by CR-XXXX)` locally (still requires `baseline lock` prior to `CLOSED`/release); if uncovered, emit `ERROR [STD-005-R05] (DRIFT_DETECTED)`.
2. **Git Protected-Path & Concurrent Lease Check (When `.git` Present):**
   - Query `git status --porcelain` / `git diff --name-only HEAD`.
   - Flag any modified path matching `protected_paths` not covered by an active `APPROVED`/`IN_PROGRESS`/`EMERGENCY_ACTIVE` `CR-*` (`ERROR [STD-010-R02]`).
   - Check all concurrent `IN_PROGRESS` CRs for overlapping `affected_files` globs (`ERROR/WARNING [STD-006-R07]`).
3. **Ring 2 Local Self-Approval Spoofing Guard (`DEC-007`):**
   - Inspect uncommitted diff on `changes/records/CR-*.md` and `governance/PROJECT-BASELINE.md`: if an uncommitted edit transitions `cr_status` to `APPROVED` (or mutates `PROJECT-BASELINE.md` `artifacts` hashes) *simultaneously* alongside uncommitted source code mutations in `src/` without passing through an explicit `aisdgs baseline lock` / committed approval state, flag `WARNING/ERROR [STD-001-R03] SELF_APPROVAL_SUSPECTED` (`Exit Code 3` under `--strict` / CI).

### Stage 8 — Secret Hygiene & Test-Tampering Diff Scanner (`STD-009-R02`, `STD-012-R01`)
1. Verify `.gitignore` (when `.git` exists) excludes `.env` (while allowing `.env.example`) and `*.pem`/`*.key` (`WARNING` in `LITE`, `ERROR` in `STANDARD`/`STRICT`).
2. Scan governed files and staged Git diffs for high-confidence credential patterns (`-----BEGIN .* PRIVATE KEY-----`, `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, `sk-[A-Za-z0-9]{20,}`) → `ERROR [STD-012-R01]`.
3. Scan `git diff` on test files (`*test*`, `*spec*`) for newly added skip directives (`.skip(`, `xit(`, `xdescribe(`, `#[ignore]`, `@pytest.mark.skip`, `[Fact(Skip=`) unlinked to an active CR → `ERROR [STD-009-R02]`.

---

## 3. `L3` SEMANTIC AUDIT BUNDLER (`aisdgs audit`)

Because cross-language business-logic equivalence cannot be proved by static regexes alone, `aisdgs audit` automates **deterministic context assembly** for human or independent `AI-VERIFY` review:
1. Resolve target scope (`--cr CR-XXXX` or `--base <git-ref>`).
2. Run Stages 1–8 (`L2`) and embed the deterministic compliance verdict at the top of the bundle.
3. Extract `git diff --stat` and unified diff hunks, highlighting touched `protected_paths`.
4. Inline the exact normative text of `CR-XXXX` + every linked `REQ-*`, `ADR-*`, and `CONTRACT-*` artifact.
5. Append the 6-dimension `AUD-01..06` verification rubric (`SEMANTIC-AUDIT-REPORT.template.md`) ready for independent reviewer completion.
