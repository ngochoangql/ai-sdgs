---
id: DOC-QA-003
title: AI-SDGS Known Architectural & Technical Limitations
version: 1.0.0
status: APPROVED
artifact_class: GOVERNANCE_RECORD
normative_references:
  - STD-001
  - STD-009
  - STD-010
  - STD-012
  - DOC-PLT-005
last_updated: 2026-11-18
---

# KNOWN ARCHITECTURAL & TECHNICAL LIMITATIONS

In strict accordance with `STD-009-R01` and `SYSTEM_PROMPT_DOC.md` §13, this document records the honest technical boundaries of AI-SDGS so adopters understand exactly what is deterministically guaranteed versus advisory or review-assisted.

---

## 1. INSTRUCTION LAYER (`L1`) IS PREVENTIVE, NOT CRYPTOGRAPHICALLY BINDING

Natural-language instructions in `AGENTS.md`, vendor bridges (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules`), and `.aisdgs/policies/*.md` significantly reduce baseline drift by guiding compliant coding agents before actions occur, **but cannot by themselves guarantee compliance** against model confabulation, context truncation, or adversarial prompt injection. Technical compliance relies on pairing `L1` with `L2` (`aisdgs validate` + Git/CI gates).

---

## 2. LOCAL OS PRIVILEGE BOUNDARY VS. OUT-OF-BAND CI TRUST ANCHOR

When an AI coding agent executes locally under the same operating-system user account as the human developer without IDE/OS sandboxing (`Ring 1`), that process possesses physical write access to local files (including `.git/hooks/` and `CR-*.md`).
- **Local Mitigation (`Ring 1` + `Ring 2`):** Adapter permission presets (`claude-settings-permissions.template.json`), `standard-lock.yaml` integrity checks, and working-tree simultaneous self-approval detection (`DOC-PLT-005` Stage 7) catch accidental or naive agent self-approval locally.
- **Residual Boundary:** In `TIER-2: STANDARD` and `TIER-3: STRICT` projects, **authoritative tamper-proof enforcement requires `Ring 3`**—running `aisdgs validate` inside an out-of-band CI pipeline on protected branches with platform-enforced human Pull Request reviews (`CODEOWNERS`).

---

## 3. LANGUAGE-AGNOSTIC SEMANTIC EQUIVALENCE (`L2` VS. `L3`)

Because AI-SDGS governs arbitrary languages (from embedded C and Rust to Python, Go, TypeScript, and SQL), `aisdgs validate` (`L2`) intentionally validates **structural, schema, graph, hash, line-budget, and file-scope invariants**—it does NOT parse ASTs of every programming language to mathematically prove business logic matches English prose.
- Behavioral fidelity between code and `REQ-*` / `ADR-*` prose is governed by **project test suites (`STD-009-R03`)**, **native language linters (`STD-008-R08`)**, and **`L3` `aisdgs audit` context bundles (`STD-009-R05`)**.

---

## 4. SECRET & TEST-TAMPERING SCANNER SCOPE

Stage 8 of `aisdgs validate` scans for `.gitignore` misconfigurations, high-confidence credential patterns, and common test-skipping directives (`.skip`, `xit`, `#[ignore]`, `@pytest.mark.skip`). It is a fast governance safety net, **not a replacement** for dedicated enterprise secret-scanning or SAST suites (e.g., Gitleaks, Trivy, Semgrep) in `STRICT` environments.

---

## 5. RELEASE MATURITY STATUS AT v1.0.0 RELEASE (MILESTONE 1 & 2 VERIFIED)

- **Milestone 1 Artifacts (`VERIFIED` Specification & Kit Release):** All 12 Core Standards (`STD-001`..`012`), 7 Draft 2020-12 JSON Schemas, 12 Project/Operational Templates, 4 Context Tier 1 Playbooks, 6 Adapter Templates, and Platform/CLI/Validator Specifications are **complete and verified** (`DOC-QA-001`, `DOC-QA-002`).
- **Milestone 2 Executable Software (`VERIFIED` Phases 8–10):** Full source code implementation and automated test verification of the `aisdgs` CLI (`cli/` in `Node.js v24` TypeScript per `DEC-021`), 8-stage deterministic `L2` validation engine, standalone single-file distribution bundle (`dist/aisdgs-standalone.mjs`), and 5 test suites (`22/22` automated tests passing) are **complete and verified** (`DOC-QA-004`, `RELEASE-REPORT.md`).
