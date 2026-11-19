---
id: DOC-RES-002
title: AI-SDGS Normative & Industry Reference Register
version: 1.0.0
status: APPROVED
phase: PHASE-0
last_updated: 2026-11-18
---

# AI-SDGS REFERENCE REGISTER

## 1. PURPOSE AND COMPLIANCE DISCLAIMER

This register catalogs the external international standards, risk frameworks, engineering specifications, and original architectural mechanisms informing **AI-SDGS (AI Software Development Governance Standard & Platform)**.

> **Normative Disclaimer:** AI-SDGS adapts structural engineering concepts from ISO/IEC, IEEE, NIST, and IETF publications to govern AI-assisted software development. Adopting AI-SDGS **does NOT** constitute formal legal or regulatory certification against ISO/IEC 12207, ISO 9001, ISO/IEC 27001, ISO/IEC 42001, or NIST frameworks without an independent accredited assessment.

---

## 2. CLASSIFICATION TAXONOMY

Every design element in AI-SDGS is classified by provenance into one of three categories:

- **`ADAPTED-STANDARD`** — Normative concepts or lifecycle controls adapted from published international standards or IETF RFCs.
- **`INDUSTRY-PRACTICE`** — Proven software engineering conventions widely established in modern production engineering.
- **`ORIGINAL-AISDGS`** — Novel governance mechanisms designed specifically by AI-SDGS to solve LLM-driven development failure modes.

---

## 3. EXTERNAL STANDARDS & SPECIFICATIONS REGISTER

### 3.1 Normative Keyword & Schema Specifications

| Ref ID | Source Specification | Provenance | Relevant Scope | Mapped AI-SDGS Targets |
| :--- | :--- | :--- | :--- | :--- |
| `REF-001` | **IETF RFC 2119 & RFC 8174** — *Key words for use in RFCs to Indicate Requirement Levels* | `ADAPTED-STANDARD` | Exact uppercase normative semantics (`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`). | Phase 1 Normative Model; All `STD-001`..`STD-012` |
| `REF-002` | **JSON Schema (Draft 2020-12)** | `ADAPTED-STANDARD` | Deterministic validation of YAML frontmatter, configuration manifests, baselines, and Change Requests. | `STD-004`, Phase 4 `schemas/*.schema.json`, Milestone 2 CLI |
| `REF-003` | **Semantic Versioning 2.0.0 (SemVer)** | `INDUSTRY-PRACTICE` | `MAJOR.MINOR.PATCH` compatibility contracts for standard releases, schemas, and adapters. | `STD-003`, `STD-009`, Platform Distribution & Migration |

### 3.2 Software, Systems & Quality Engineering Standards

| Ref ID | Source Standard | Provenance | Adapted Engineering Principles | Mapped AI-SDGS Targets |
| :--- | :--- | :--- | :--- | :--- |
| `REF-004` | **ISO/IEC/IEEE 12207:2017** — *Systems and software engineering — Software life cycle processes* | `ADAPTED-STANDARD` | Separation of Configuration Management, Implementation, Verification, Validation, and Quality Assurance processes. | `STD-005`, `STD-007`, `STD-008`, `STD-009` |
| `REF-005` | **ISO/IEC/IEEE 15288:2023** — *System life cycle processes* | `ADAPTED-STANDARD` | Architecture definition boundaries, decision management, baseline establishment, and controlled system evolution. | `STD-001`, `STD-005`, `STD-008` |
| `REF-006` | **ISO/IEC/IEEE 29148:2018** — *Requirements engineering* | `ADAPTED-STANDARD` | Requirement attributes: unambiguous, atomic, singular, feasible, verifiable, and bidirectionally traceable (`REQ-*`). | `STD-004`, `STD-005`, `STD-006` |
| `REF-007` | **ISO/IEC 25010:2023** — *Systems and software Quality Requirements and Evaluation (SQuaRE)* | `ADAPTED-STANDARD` | Non-functional quality characteristics (functional suitability, security, maintainability, compatibility, reliability). | `STD-005`, `STD-008`, `STD-009` |
| `REF-008` | **ISO 9001:2015** — *Quality management systems* | `ADAPTED-STANDARD` | Control of documented information, evidence-based verification, nonconformity handling, and exception waivers. | `STD-002`, `STD-003`, `STD-009` |

### 3.3 AI Governance, Security & Risk Frameworks

| Ref ID | Source Standard / Framework | Provenance | Adapted Risk & Security Controls | Mapped AI-SDGS Targets |
| :--- | :--- | :--- | :--- | :--- |
| `REF-009` | **ISO/IEC 42001:2023** — *Artificial Intelligence Management System (AIMS)* | `ADAPTED-STANDARD` | Explicit human oversight, bounded AI autonomy, AI impact assessment, and auditable AI lifecycle records. | `STD-001`, `STD-010`, `STD-011` |
| `REF-010` | **NIST AI RMF 1.0 & NIST AI 600-1** (*Generative AI Profile*) | `ADAPTED-STANDARD` | *Govern, Map, Measure, Manage* functions; mitigation of confabulation (hallucinated completion) and excessive agency. | `STD-002`, `STD-010`, `STD-011` |
| `REF-011` | **NIST SP 800-218 (SSDF v1.1)** — *Secure Software Development Framework* | `ADAPTED-STANDARD` | Protecting code/build integrity, third-party dependency vetting, secret isolation, and provenance verification. | `STD-008`, `STD-012` |
| `REF-012` | **ISO/IEC 27001:2022** — *Information security management* | `ADAPTED-STANDARD` | Least-privilege access boundaries, environment separation, emergency change procedures, and audit logging. | `STD-010`, `STD-012` |

### 3.4 Established Software Architecture & Tooling Practices

| Ref ID | Engineering Practice | Provenance | Applied Pattern | Mapped AI-SDGS Targets |
| :--- | :--- | :--- | :--- | :--- |
| `REF-013` | **Architecture Decision Records (MADR / Nygard ADR)** | `INDUSTRY-PRACTICE` | Recording architectural context, considered alternatives, decision rationale, and consequences in `ADR-*` files. | `STD-008`, Phase 4 Templates |
| `REF-014` | **Deterministic Content-Addressable Lockfiles** | `INDUSTRY-PRACTICE` | Pinning immutable dependency/standard snapshots using SHA-256 digests (`standard-lock.yaml`) for offline reproducibility. | `STD-007`, Platform Spec, CLI `verify-lock` |
| `REF-015` | **Policy-as-Code & Git/CI Gatekeeping** | `INDUSTRY-PRACTICE` | Enforcing structural invariants via pre-commit hooks, exit-code CLI checks, and CI pipeline blockers. | `STD-002`, `STD-009`, Milestone 2 CLI |
| `REF-016` | **Open `AGENTS.md` & Multi-Agent Instruction Conventions** | `INDUSTRY-PRACTICE` | Standardized root instruction file (`AGENTS.md`) complemented by tool-specific thin adapters (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules`). | `STD-011`, Phase 5 Adapter Kit |

---

## 4. ORIGINAL AI-SDGS GOVERNANCE MECHANISMS

The following mechanisms are **`ORIGINAL-AISDGS`** innovations addressing gaps not covered by legacy ISO standards or standalone AI coding rules:

1. **Prompt-as-Signal Principle (`MECH-001`):** Formalizing natural-language user prompts as untrusted change signals that must pass mandatory classification (`QUESTION` through `ARCHITECTURAL_CHANGE`) before mutating baselined files (`STD-006`, `STD-011`).
2. **Analysis Authority vs. Execution Authority Split (`MECH-002`):** Granting AI unrestricted analytical capability (conflict detection, impact analysis, CR drafting) while gating write/execute actions by risk tier (`STD-001`, `STD-010`).
3. **3-Tier Progressive Context Architecture (`MECH-003`):** Enforcing strict line/token budgets (`Tier 0 ≤ 150 lines` root router → `Tier 1 ≤ 250 lines` task playbooks → `Tier 2` reference & CLI schemas) to prevent LLM lost-in-the-middle degradation (`STD-011`).
4. **3-Layer Governance Control Taxonomy (`MECH-004`):** Requiring every rule to map explicitly to `L1-Advisory` (prompt instructions), `L2-Deterministic` (schema, graph, hash, and diff checks), or `L3-Semantic-Audit` (bundled diff-vs-spec review) (`STD-002`, `STD-009`).
5. **Proportional Two-Track Change Control & Multi-Pathway Onboarding (`MECH-005`):** Combining `CR-FAST` (5 fields) and `CR-FULL` (14 fields) across `Lite`/`Standard`/`Strict` tiers and `Greenfield`/`Brownfield`/`Iterative` pathways (`STD-006`, `STD-007`).
6. **Defense-in-Depth Against Agent Self-Approval (`MECH-006`):** Mitigating local file-write spoofing via protected path globs, baseline lock digests, Git history verification, and out-of-band CI branch enforcement (`STD-010`, `STD-012`, Phase 6 Validation Engine).
