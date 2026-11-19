---
id: DOC-PLT-002
title: AI-SDGS Progressive Context & Multi-Tool Adapter Specification
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-010
  - STD-011
  - STD-012
  - DOC-PLT-001
last_updated: 2026-11-18
---

# PROGRESSIVE CONTEXT & MULTI-TOOL ADAPTER SPECIFICATION

## 1. PURPOSE & DESIGN INVARIANTS

`DOC-PLT-002` specifies how `aisdgs adapter sync` renders and verifies AI agent entrypoints across heterogeneous coding tools from `.aisdgs/config.yaml` while strictly enforcing Context Tier line budgets and Ring 1 sandbox protections.

---

## 2. SUPPORTED ADAPTER TARGETS & BUDGET CONTRACT

| Target Key (`adapters.targets`) | Materialized Target Path in `TARGET-PROJECT/` | Source Template in `ai-sdgs` | Hard Line Ceiling | Sync Check Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| `agents` *(Mandatory Root)* | `AGENTS.md` | `adapters/AGENTS.template.md` | **≤ 150 lines** | `<!-- aisdgs-sync: ... config_sha256=... -->` |
| `claude` | `CLAUDE.md` (+ optional `.claude/settings.json` merge) | `adapters/CLAUDE.template.md` + `claude-settings-permissions.template.json` | **≤ 40 lines** | `<!-- aisdgs-sync: bridge=claude ... -->` |
| `gemini` | `GEMINI.md` | `adapters/GEMINI.template.md` | **≤ 40 lines** | `<!-- aisdgs-sync: bridge=gemini ... -->` |
| `cursor` | `.cursor/rules/aisdgs.mdc` | `adapters/cursor-aisdgs.template.mdc` | **≤ 40 lines** | `<!-- aisdgs-sync: bridge=cursor ... -->` |
| `copilot` | `.github/copilot-instructions.md` | `adapters/copilot-instructions.template.md` | **≤ 40 lines** | `<!-- aisdgs-sync: bridge=copilot ... -->` |
| `kilocode` | `.kilocode/rules/aisdgs.md` | `adapters/kilocode-aisdgs.template.md` | **≤ 40 lines** | `<!-- aisdgs-sync: bridge=kilocode ... -->` |

---

## 3. DETERMINISTIC SYNCHRONIZATION & DRIFT DETECTION (`STD-011-R08`)

1. **Config Digest Computation (`CONFIG_SHA256`):**
   - Read `.aisdgs/config.yaml`, normalize line endings (`\r\n` → `\n`, UTF-8 per `DEC-013`), and compute its 64-character lowercase hex SHA-256 digest (`CONFIG_SHA256`).
2. **Rendering `AGENTS.md` & Enabled Bridges:**
   - Substitute `{{PROJECT_ID}}`, `{{PROJECT_NAME}}`, `{{STANDARD_VERSION}}`, `{{ADOPTION_TIER}}`, `{{ONBOARDING_MODE}}`, `{{HUM_OWNER}}`, `{{HUM_PROD}}`, `{{HUM_ARCH}}`, `{{HUM_SEC}}`, and `{{CONFIG_SHA256}}`.
   - If custom project `protected_paths` entries exist beyond the 4 default groups, summarize up to 10 custom globs inline under `AGENTS.md` §3; if > 10 custom globs exist, display the first 8 plus `+ N additional globs in .aisdgs/config.yaml` so `AGENTS.md` NEVER exceeds 150 lines (`STD-011-R03`).
3. **Drift & Budget Verification (`aisdgs validate` / `aisdgs adapter sync --check`):**
   - Confirm `AGENTS.md` exists, line count `≤ 150`, and embedded `config_sha256` matches current `.aisdgs/config.yaml` digest.
   - For each target listed in `.aisdgs/config.yaml` `adapters.targets`: confirm target file exists, line count `≤ 40` (for bridges), contains explicit reference to `AGENTS.md`, and embedded `config_sha256` matches current `.aisdgs/config.yaml` digest.
   - Any mismatch or line-budget overflow returns `Exit Code 1` (`NON_COMPLIANT`) with remediation hint: `Run 'aisdgs adapter sync'`.

---

## 4. RING 1 SANDBOX PERMISSION PROJECTION (`STD-010-R08`, `DEC-007`)

When `claude` is enabled in `adapters.targets` and `--with-permissions` is requested (or by default in `STRICT` tier without clobbering existing user keys):
- Merge `adapters/claude-settings-permissions.template.json` rules non-destructively into `.claude/settings.json` (unioning `permissions.deny` and `permissions.ask` arrays while preserving unrelated user hooks/env settings):
  - **`deny`:** Direct autonomous edits to `.aisdgs/{standard,schemas,policies}/**` and `.aisdgs/standard-lock.yaml`; reading `.env` / private keys; running `git commit --no-verify`, `git push --force`, `git reset --hard`.
  - **`ask`:** Edits to `governance/**`, `.aisdgs/config.yaml`, `.github/workflows/**`, and running `aisdgs baseline lock`.
