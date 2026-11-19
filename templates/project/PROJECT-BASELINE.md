---
id: BASELINE-001
title: "{{PROJECT_NAME}} — Approved Project Baseline Manifest"
version: 1.0.0
status: DRAFT
artifact_class: CONSTITUTIONAL
baseline_version: 0.1.0
baseline_state: UNINITIALIZED
hash_normalization: SHA256-UTF8-LF
last_updated: "{{DATE_ISO}}"
artifacts: []
---

# PROJECT BASELINE MANIFEST — {{PROJECT_NAME}}

## 1. BASELINE GOVERNANCE STATUS

- **Current Baseline State:** `UNINITIALIZED` *(Transitions to `ANCHORED` or `LOCKED` via `aisdgs baseline lock` following `HUM-OWNER` sign-off)*
- **Adoption Tier / Mode:** `{{ADOPTION_TIER}}` / `{{ONBOARDING_MODE}}`

---

## 2. FOUNDATIONAL ARCHITECTURE & REQUIREMENTS SUMMARY

*(In `LITE` tier or `BROWNFIELD` Anchor mode, core requirements and `ADR-001` invariants MAY be maintained concisely here; in `STANDARD` and `STRICT` tiers, discrete files under `docs/requirements/`, `docs/architecture/`, and `docs/contracts/` are hashed directly in the YAML `artifacts` manifest above.)*

### 2.1 Core Architectural Invariants (`ADR-001` Summary)
- **System Topology & Stack:** Document primary entrypoints, modules, and persistence boundaries.
- **Protected Contract Surfaces:** List public APIs, database schemas, or CLI contracts guarded by `STD-008`.

### 2.2 Initial Baseline Requirements (`LITE` Compact Table)

| Req ID | Category | Priority | Normative Requirement Statement | Verifiable Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-FUNC-001` | Functional | `MUST` | Define initial core capability before locking baseline. | Automated test or reproducible verification step. |
| `REQ-SEC-001` | Security | `MUST` | Enforce credential non-exposure and boundary validation. | Zero secrets committed; auth/input checks verified. |
