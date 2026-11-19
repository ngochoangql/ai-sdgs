---
id: CONST-001
title: "{{PROJECT_NAME}} — Project Governance Constitution"
version: 1.0.0
status: DRAFT
artifact_class: CONSTITUTIONAL
applies_to_tiers:
  - "{{ADOPTION_TIER}}"
normative_references:
  - STD-001
  - STD-002
last_updated: "{{DATE_ISO}}"
---

# PROJECT GOVERNANCE CONSTITUTION — {{PROJECT_NAME}}

## 1. PROJECT IDENTITY & MISSION BOUNDARY

- **Project ID:** `{{PROJECT_ID}}`
- **Adoption Tier:** `{{ADOPTION_TIER}}`
- **Onboarding Pathway:** `{{ONBOARDING_MODE}}`
- **Primary Mission:** {{PROJECT_DESCRIPTION}}

> **Constitutional Law (`STD-001-R01`):** A natural-language prompt is an input signal, NEVER automatic authorization to mutate approved baselines, public contracts, dependencies, or architectural invariants.

---

## 2. HUMAN AUTHORITY MATRIX (`STD-001-R02`, `STD-001-R06`)

| Authority Role | Designated Human Holder | Scope of Final Sign-Off |
| :--- | :--- | :--- |
| **`HUM-OWNER`** | `{{HUM_OWNER}}` | Constitution, Baseline locks, Tier transitions, budget/scope waivers |
| **`HUM-PROD`** | `{{HUM_PROD}}` | Functional requirements (`REQ-FUNC-*`), feature Change Requests |
| **`HUM-ARCH`** | `{{HUM_ARCH}}` | `ADR-*` architecture boundaries, dependencies, DB/API contracts |
| **`HUM-SEC`** | `{{HUM_SEC}}` | Security/auth boundaries, CI/CD pipelines, emergency reconciliation |

No AI agent profile (`AI-ANALYST`, `AI-IMPL`, `AI-VERIFY`, `AI-STEWARD`) may assume or simulate any `HUM-*` approval role.

---

## 3. PROJECT-SPECIFIC ARCHITECTURAL & SECURITY INVARIANTS

*(Tightening Level 1 rules per `STD-001-R04`; project clauses MUST NOT weaken Level 1 `[NON-WAIVABLE]` requirements.)*

- **`PROJ-R01` — Core Stack & Module Boundary:** Define primary language/runtime stack and forbidden cross-module import directions (or link to `ADR-001`).
- **`PROJ-R02` — Data & Contract Ownership:** Identify authoritative schema/API files protected against unapproved mutation.
- **`PROJ-R03` — Secret & Environment Isolation:** Plaintext credentials, `.env` secrets, and live production endpoints MUST NEVER enter version control or AI prompts (`STD-012-R01`, `STD-012-R02`).
- **`PROJ-R04` — Required Verification Command(s):** Declare the canonical build/test command(s) required before any task claims `VERIFIED` status (`STD-009-R01`).
