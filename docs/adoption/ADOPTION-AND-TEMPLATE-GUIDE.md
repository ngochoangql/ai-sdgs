---
id: DOC-PLT-001
title: AI-SDGS Project Adoption, Schema & Template Materialization Guide
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
normative_references:
  - STD-002
  - STD-004
  - STD-005
  - STD-006
  - STD-007
last_updated: 2026-11-18
---

# PROJECT ADOPTION, SCHEMA & TEMPLATE MATERIALIZATION GUIDE

## 1. DETERMINISTIC TOKEN SUBSTITUTION CONTRACT

All templates in `templates/project/` and `templates/artifacts/` use strict `{{TOKEN_NAME}}` placeholders so `aisdgs init` and `aisdgs change create` render files deterministically without third-party template engines:

| Placeholder Token | Source / Default | Example Value |
| :--- | :--- | :--- |
| `{{PROJECT_ID}}` | `--id` flag or slugified directory basename | `payment-gateway` |
| `{{PROJECT_NAME}}` | `--name` flag or title-cased basename | `Payment Gateway Service` |
| `{{PROJECT_DESCRIPTION}}` | `--description` flag or interactive prompt | `Core billing & webhook processing API` |
| `{{ADOPTION_TIER}}` | `--tier` flag (`LITE` \| `STANDARD` \| `STRICT`, default `STANDARD`) | `STANDARD` |
| `{{ONBOARDING_MODE}}` | `--mode` flag (`GREENFIELD` \| `BROWNFIELD` \| `ITERATIVE`, default auto-detected) | `BROWNFIELD` |
| `{{STRICT_VALIDATION}}` | `true` when `ADOPTION_TIER == STRICT`, else `false` | `false` |
| `{{HUM_OWNER}}` | `--owner` flag or `git config user.name` fallback | `hoang-doan` |
| `{{HUM_PROD}}` / `{{HUM_ARCH}}` / `{{HUM_SEC}}` | Role flags or Role Collapse to `{{HUM_OWNER}}` (`STD-001-R06`) | `hoang-doan` |
| `{{DATE_ISO}}` | Current UTC/local date (`YYYY-MM-DD`) | `2026-11-18` |
| `{{TIMESTAMP_ISO}}` | Current ISO-8601 timestamp (`YYYY-MM-DDTHH:mm:ssZ`) | `2026-11-18T11:20:00+07:00` |
| `{{CR_ID}}` / `{{REQ_ID}}` / `{{ADR_ID}}` | Next monotonic sequence ID scanned from target folder | `CR-0001` |

---

## 2. PROPORTIONAL TIER MATERIALIZATION MATRIX (`STD-007-R02`)

`aisdgs init` MUST materialize ONLY the paths marked **Materialized** for the chosen tier (zero empty directories):

| Target Path in `TARGET-PROJECT/` | `TIER-1: LITE` | `TIER-2: STANDARD` | `TIER-3: STRICT` | Governing Schema |
| :--- | :--- | :--- | :--- | :--- |
| `AGENTS.md` (+ enabled vendor bridges) | **Materialized** | **Materialized** | **Materialized** | Line-budget & sync validator |
| `.aisdgs/config.yaml` | **Materialized** | **Materialized** | **Materialized** | `config.schema.json` |
| `.aisdgs/standard-lock.yaml` | **Materialized** | **Materialized** | **Materialized** | `standard-lock.schema.json` |
| `.aisdgs/adoption-profile.yaml` | **Materialized** | **Materialized** | **Materialized** | `adoption-profile.schema.json` |
| `.aisdgs/{standard,schemas,policies}/*` | **Materialized** | **Materialized** | **Materialized** | Verified by `standard-lock.yaml` |
| `governance/PROJECT-CONSTITUTION.md` | **Materialized** | **Materialized** | **Materialized** | `frontmatter.schema.json` |
| `governance/PROJECT-BASELINE.md` | **Materialized** | **Materialized** | **Materialized** | `baseline.schema.json` |
| `governance/EXCEPTIONS.md` | On-demand (1st waiver) | **Materialized** | **Materialized** | `exception.schema.json` |
| `changes/CHANGELOG-GOVERNANCE.md` | **Materialized** | **Materialized** | **Materialized** | Markdown table check |
| `changes/records/` | On-demand (`change create`) | **Materialized** (with `.gitkeep` or initial CR) | **Materialized** | `change-request.schema.json` |
| `docs/requirements/` & `docs/architecture/` | Optional (inline allowed) | **Materialized** (`ADR-001` starter in Greenfield) | **Materialized** | `frontmatter.schema.json` |
| `quality/reports/` | Optional | On-demand (`audit`/`report`) | **Materialized** | `frontmatter.schema.json` |

---

## 3. CANONICAL `[NON-WAIVABLE]` RULE REGISTRY (FOR `L2` VALIDATOR)

Out of the 96 normative rules across `STD-001`..`STD-012`, the following **48 rules** are tagged **`[NON-WAIVABLE]`** (leaving 48 `[WAIVABLE]` rules eligible for controlled `EXC-*` waivers). Any `EXC-*` waiver in `governance/EXCEPTIONS.md` listing any ID below MUST be rejected immediately by `aisdgs validate` (`STD-002-R04`):

- **`STD-001`:** `STD-001-R01`, `STD-001-R02`, `STD-001-R03`, `STD-001-R04`, `STD-001-R05`, `STD-001-R07`
- **`STD-002`:** `STD-002-R01`, `STD-002-R02`, `STD-002-R03`, `STD-002-R04`, `STD-002-R07`
- **`STD-003`:** `STD-003-R01`, `STD-003-R02`, `STD-003-R05`
- **`STD-004`:** `STD-004-R01`, `STD-004-R02`, `STD-004-R03`, `STD-004-R04`
- **`STD-005`:** `STD-005-R03`, `STD-005-R04`, `STD-005-R05`, `STD-005-R07`
- **`STD-006`:** `STD-006-R01`, `STD-006-R02`, `STD-006-R05`, `STD-006-R08`
- **`STD-007`:** `STD-007-R01`, `STD-007-R03`, `STD-007-R04`, `STD-007-R07`
- **`STD-008`:** `STD-008-R02`, `STD-008-R03`, `STD-008-R04`
- **`STD-009`:** `STD-009-R01`, `STD-009-R02`, `STD-009-R04`
- **`STD-010`:** `STD-010-R01`, `STD-010-R02`, `STD-010-R03`
- **`STD-011`:** `STD-011-R01`, `STD-011-R02`, `STD-011-R03`, `STD-011-R06`
- **`STD-012`:** `STD-012-R01`, `STD-012-R02`, `STD-012-R03`, `STD-012-R06`, `STD-012-R07`
