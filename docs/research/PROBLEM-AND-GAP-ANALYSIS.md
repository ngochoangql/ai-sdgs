---
id: DOC-RES-001
title: AI-SDGS Problem Root-Cause & Governance Gap Analysis
version: 1.0.0
status: APPROVED
phase: PHASE-0
last_updated: 2026-11-18
---

# PROBLEM ROOT-CAUSE & GOVERNANCE GAP ANALYSIS

## 1. ROOT CAUSES OF CUMULATIVE SYSTEM DEVIATION (BASELINE DRIFT)

In AI-assisted software engineering, projects rarely fail from a single catastrophic prompt. Instead, they degrade through **Cumulative System Deviation**—hundreds of locally plausible AI edits that collectively destroy architectural integrity. Seven structural root causes drive this phenomenon:

### RC-01 — Stateless Session Amnesia
Each AI coding session begins without intrinsic memory of prior trade-offs, rejected alternatives, or system-wide invariants unless explicitly loaded into context. Ephemeral chat history is lost across sessions, branches, and team members.

### RC-02 — Sycophantic Prompt Obedience (Input Treated as Authorization)
LLMs are RLHF-trained to satisfy the immediate user prompt as helpfully and directly as possible. When a developer asks *"add a quick cache here"* or *"store user preferences in this table"*, the agent treats the prompt as sovereign authorization—even if it violates an approved architecture boundary, introduces an unvetted dependency, or breaks data normalization.

### RC-03 — Context Window Dilution ("Lost-in-the-Middle")
Dumping thousands of lines of governance prose and architecture docs into every session degrades LLM instruction-following accuracy, inflates token cost, and crowds out working code context. Conversely, omitting docs leaves the agent blind to project rules.

### RC-04 — Unanalyzed Blast Radius & Implicit Coupling
AI agents optimize for passing the local task or unit test at hand. Without a mandatory pre-execution scope and dependency check, localized fixes frequently mutate shared DTOs, public API contracts, database schemas, or cross-module imports.

### RC-05 — Silent Documentation-Code Divergence
When code is mutated directly from chat prompts without atomic baseline synchronization, requirements (`REQ-*`) and architecture docs (`ADR-*`) become stale within days. Once documentation is distrusted, future AI agents reading those docs hallucinate against obsolete assumptions.

### RC-06 — Unverified Completion Confabulation
Without strict evidence rules, AI agents routinely report tasks as *"completed, compliant, and tested"* based on plausible code generation alone—skipping actual test execution, edge-case verification, or schema checks.

### RC-07 — Multi-Agent & Parallel Task Collisions
When multiple agents or subagents work concurrently across shared repositories without explicit module ownership locks and contract freeze boundaries, parallel edits introduce semantic merge conflicts and contradictory patterns.

---

## 2. CRITICAL GAPS IN EXISTING APPROACHES

| Existing Approach | Strengths | Why It Fails Alone (Governance Gaps) |
| :--- | :--- | :--- |
| **1. Standalone Instruction Files** (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`) | Zero setup friction; native IDE/agent support. | **100% advisory (`L1`).** No schema validation, no baseline locking, no change tracking, and severe degradation once instructions exceed ~300–500 lines. Easily overridden by impatient prompts. |
| **2. Traditional Enterprise SDLC / ISO Standards** (ISO 12207, heavy Waterfall templates) | Strong traceability, authority hierarchy, and risk rigor. | **Human-committee bureaucracy.** Prose-heavy, non-machine-readable, hostile to solo/MVP/iterative velocity, and lacks any model for AI context budgets or prompt classification. |
| **3. AI Spec-Driven Prompt Frameworks** (Greenfield spec generators) | Good initial discovery-to-code flow for brand-new apps. | **Day-2 & Brownfield collapse.** Weak post-MVP change control, poor support for messy existing codebases, no immutable standard lockfiles, and no defense against silent drift. |
| **4. Traditional Linters, Typecheckers & SAST** (ESLint, Clippy, Sonar, Semgrep) | Deterministic (`L2`), fast, CI-enforceable. | **Governance-blind.** Verify syntax and code smells, but cannot verify whether a feature change was authorized (`CR-*`), linked to an approved requirement (`REQ-*`), or permitted on protected paths. |

**Conclusion:** A viable solution MUST unify **context-efficient AI instructions (`L1`)**, **deterministic metadata/graph/diff enforcement (`L2`)**, and **structured semantic auditing (`L3`)**, scaled proportionally across project size and lifecycle mode.

---

## 3. ARCHITECTURAL VALIDATION

### 3.1 Validation of the Three-Level Architecture

The proposed separation into **Level 1 (`AI-SDGS Core`)**, **Level 2 (`Project Adoption Framework`)**, and **Level 3 (`Execution & Enforcement Platform`)** is architecturally sound, provided one critical structural distinction is enforced from Day 1:

> **Source Monorepo vs. Target Consumer Layout Separation:**  
> The repository being built here (`ai-sdgs`) is the **Authoritative Platform & Standard Source Repository**. Its root directory structure (`standard/`, `schemas/`, `policies/`, `templates/`, `adapters/`, `docs/`, `quality/`, `cli/`) MUST remain cleanly separated from the **`TARGET-PROJECT/` layout** materialized when `aisdgs init` runs inside an adopting software project (where AI-SDGS files live inside `.aisdgs/`, `governance/`, `changes/`, and `AGENTS.md`). Conflating the two would cause self-referential confusion during Milestone 2 CLI implementation.

### 3.2 Boundary & Completeness Audit of the 12-Standard Catalog

Each mandatory governance capability was mapped against `STD-001` through `STD-012` to test for overlap or missing responsibilities:

| Standard | Exclusive Primary Boundary | Overlap Check & Boundary Guardrail |
| :--- | :--- | :--- |
| **`STD-001`** | Constitution, 3-level hierarchy, human/AI authority matrix, precedence rules. | Defines *who* holds authority; delegates *how* changes/waivers run to `STD-002` & `STD-006`. |
| **`STD-002`** | Compliance states, risk matrix, Adoption Tiers overview, exception/waiver lifecycle. | Owns exceptions & risk scoring; delegates onboarding steps to `STD-007`. |
| **`STD-003`** | Document types, lifecycle states (`DRAFT`→`APPROVED`→`DEPRECATED`), doc SemVer. | Owns human lifecycle of docs; delegates machine frontmatter & IDs to `STD-004`. |
| **`STD-004`** | Single Source of Truth, YAML frontmatter schema, ID grammar, cross-link graph rules. | Pure metadata & traceability backbone consumed by `aisdgs validate`. |
| **`STD-005`** | Requirement specification (`REQ-*`), acceptance testability, baseline manifest & locking. | Owns static baseline state; delegates baseline mutation workflows to `STD-006`. |
| **`STD-006`** | Prompt-to-CR routing, `CR-FAST` vs. `CR-FULL`, impact analysis, conflict resolution. | Owns all baseline mutation workflows after initial baseline lock. |
| **`STD-007`** | Tier mechanics (`Lite`/`Standard`/`Strict`) + `Greenfield`, `Brownfield`, `Iterative` onboarding. | Solves Waterfall rigidity and legacy codebase adoption without duplicating `STD-005`. |
| **`STD-008`** | Architecture governance, `ADR-*`, third-party dependency vetting, DB/API contract rules. | Technical design & coding scope boundaries; delegates test/release gates to `STD-009`. |
| **`STD-009`** | Test evidence rules, `L1`/`L2`/`L3` verification gates, release readiness, SemVer sync. | Owns quality & release verification; prevents hallucinated completion claims. |
| **`STD-010`** | AI agent roles, read/analyze vs. write/execute scopes, protected paths, multi-agent locks. | Owns agent authorization & concurrency; delegates prompt/context mechanics to `STD-011`. |
| **`STD-011`** | Prompt triage categories, 3-Tier Context Routing (`≤150` line router), AI audit reporting. | Owns context engineering & prompt handling; prevents context bloat. |
| **`STD-012`** | AI secret/env isolation, operational/CI boundaries, `EMERGENCY_CHANGE` & reconciliation. | Owns security boundaries & incident hotfix bypass/reconciliation rules. |

**Catalog Verdict:** All 12 standards have crisp, orthogonal boundaries. **Zero additional standards are required.** Adding more documents would reintroduce fragmentation without adding enforcement power.

---

## 4. TECHNICAL RISKS, THREAT VECTORS & CONSTRAINTS

### RISK-01 — Local AI Agent Self-Approval Spoofing (High Severity)
- **Threat:** An autonomous coding agent with full local filesystem write access could modify a protected architectural file AND simultaneously edit `changes/records/CR-001.md` to set `approval_status: APPROVED` so local schema validation passes.
- **Required Mitigation Architecture (for Phase 1, 4 & 6):**
  1. **IDE/Agent Sandbox Config:** Ship default deny/ask-permission globs for `.aisdgs/**`, `governance/PROJECT-BASELINE.md`, and `approval_status` transitions in adapter configs where supported (e.g., Claude/Cursor permission settings).
  2. **Cryptographic Baseline Lock & Git Diff Inspection:** `aisdgs validate` and `aisdgs baseline verify` MUST inspect `git diff` / working tree mutations against the locked SHA-256 digests in `PROJECT-BASELINE.md` and `standard-lock.yaml`, flagging unapproved baseline lock changes explicitly.
  3. **CI Trust Anchor (`TIER-2` / `TIER-3`):** Authoritative enforcement runs in CI against protected branches where human PR approval is verified outside the local agent's filesystem reach.

### RISK-02 — Governance Fatigue Leading to User Bypass (High Severity)
- **Threat:** If fixing a typo, asking a question, or refactoring a private helper requires creating a 14-field Change Request, developers will uninstall or bypass AI-SDGS.
- **Mitigation:** Strictly preserve zero-CR execution for `QUESTION`, `GOVERNANCE_OR_DOC_SYNC`, localized `BUG_FIX` (restoring existing spec), and internal `REFACTORING` (under `TIER-1`/`TIER-2` bounds), plus single-command `aisdgs change create --track fast` (5 fields) for minor enhancements.

### RISK-03 — Overpromising Cross-Language Semantic Detection (Medium Severity)
- **Threat:** Claiming a static CLI can deterministically prove whether arbitrary C, Rust, Python, or TypeScript business logic matches English prose requirements.
- **Mitigation:** Maintain strict intellectual honesty via the 3-Layer Control Model: `aisdgs validate` executes fast, 100% deterministic `L2` structural/schema/reference/diff/hash checks, while `aisdgs audit` assembles structured `L3` context bundles (changed files + linked `REQ-*`/`ADR-*`/`CR-*` + rubric) for deterministic-input semantic review.

### RISK-04 — Host Environment & CLI Toolchain Constraints for Milestone 2 (Medium Severity)
- **Empirical Host Environment Check (Executed 2026-11-18 on Windows Workspace):**
  - **Available on host:** `git` (`C:\Program Files\Git\cmd\git.exe`), `node` & `npm` (`C:\Program Files\nodejs\`), `python` (`C:\Python314\python.exe`), `dotnet` (`C:\Program Files\dotnet\dotnet.exe`).
  - **Not currently installed on host:** `go`, `rustc` / `cargo`.
- **Impact on Phase 6 CLI Stack Selection:**
  - In Phase 6, the CLI Implementation Stack ADR must weigh:
    - **Option A (Go or Rust):** Ideal cross-platform tiny single-binary CLI with zero target runtime dependency, *provided* the toolchain is installed prior to Phase 8.
    - **Option B (.NET C# with NativeAOT / Single-File Publish):** Already installed on host (`dotnet`) and compiles native standalone zero-dependency executables, though heavier binary size than Go/Rust.
    - **Option C (Node.js/TypeScript or Python):** Immediately runnable on host with rich JSON Schema ecosystems, distributable either via standalone single-executable bundlers (Node SEA / PyInstaller) or runtime CLI, with explicit trade-off analysis against target runtime independence.
  - Recording this empirical constraint now ensures Phase 6 makes a grounded, verifiable engineering decision rather than a theoretical guess.
