---
id: DOC-PLT-006
title: "ADR-PLT-001 — aisdgs CLI Implementation Stack Selection"
version: 1.0.0
status: APPROVED
artifact_class: NORMATIVE_SPEC
domain: platform-architecture
normative_references:
  - DOC-RES-001
  - DOC-PLT-003
  - DOC-PLT-004
  - DOC-PLT-005
  - DEC-004
last_updated: 2026-11-18
---

# ADR-PLT-001 — `aisdgs` CLI IMPLEMENTATION STACK SELECTION

## 1. CONTEXT & ARCHITECTURAL PROBLEM

Per `SYSTEM_PROMPT_DOC.md` §3.2 and `DEC-004`, while **AI-SDGS governs target projects of any programming language**, Milestone 2 (Phases 8–10) must implement the `aisdgs` CLI and 8-Stage `L2` Validation Engine as real, working, tested software (`STD-009-R01` strictly forbids claiming CLI verification without executing real builds and tests on the host machine).

### Empirical Host Environment Constraint (Verified `2026-11-18` on Windows Workspace)
- **Installed & Runnable Immediately:**
  - `.NET SDK 11.0.100` (`C:\Program Files\dotnet\dotnet.exe`)
  - `Node.js v24.20.0` + `npm 11.19.0` (`C:\Program Files\nodejs\node.exe`)
  - `Python 3.14.7` (`C:\Python314\python.exe`)
  - `Git` (`C:\Program Files\Git\cmd\git.exe`)
- **Not Currently Installed on Host:** `Go` (`go`), `Rust` (`cargo` / `rustc`).

---

## 2. EVALUATION OF CANDIDATE IMPLEMENTATION STACKS

| Criterion | **Option A: .NET 11 (`C#`) Self-Contained Single-File / NativeAOT** | **Option B: Node.js `v24` (TypeScript / Zero-External-Dep ESM + SEA)** | **Option C: Go (`1.23+` Single Binary + `embed.FS`)** | **Option D: Python `3.14` CLI (`stdlib` + PyInstaller)** |
| :--- | :--- | :--- | :--- | :--- |
| **1. Zero Target Runtime Dependency** | **Excellent:** `dotnet publish --self-contained -p:PublishSingleFile=true` (or `PublishAot=true`) produces a **single standalone native `.exe` / Linux / macOS binary** requiring zero runtime on target repos. | **Good (Dual-Mode):** Runs directly via Node OR compiles via native Node `v24` Single Executable Application (`node --build-sea`) into a standalone `.exe` (~80 MB). | **Excellent:** Native ~8–12 MB standalone static binary across OS/CPU targets. | **Moderate:** Requires Python on target machine unless bundled via PyInstaller (~25–40 MB, slower cold extract). |
| **2. Embedded Offline Standard Bundle** | Built-in (`<EmbeddedResource>` compiles `standard/`, `schemas/`, `policies/`, `templates/`, `adapters/` into the single binary). | Built-in (bundled VFS map / SEA asset blob). | Built-in (`//go:embed`). | Built-in (`importlib.resources`). |
| **3. Offline / Zero-External-Package Feasibility** | **High:** Built-in `System.Text.Json`, `SHA256`, `Regex`, `Process` (`git`), plus clean deterministic YAML-subset/frontmatter parser & Draft 2020-12 validator in pure C# (zero NuGet internet dependency needed). | **Very High:** Built-in `node:fs`, `node:crypto`, `node:child_process`, `node:util` (`parseArgs`), `node:test` — **zero `npm install` packages required**, 100% air-gapped build & test! | **Moderate-High:** Needs Go install + JSON Schema / YAML module or pure stdlib validator. | **High:** Pure Python `stdlib` (`argparse`, `hashlib`, `json`, `unittest`), needs clean YAML-subset parser if offline. |
| **4. Startup Latency (`pre-commit` UX)** | **~15–40 ms** (compiled native / AOT). | **~35–60 ms** (Node v24 fast boot). | **~5–15 ms** (fastest). | **~60–150 ms**. |
| **5. Static Type Safety & Maintainability** | **Strong (`C#` strict nullable types)**. | **Strong (`TypeScript` / Node v24 native type-stripping)**. | **Strong (`Go`)**. | Moderate (`typing` hints, runtime dynamic). |
| **6. Host Build & Test Readiness (`STD-009-R01`)** | **READY NOW (`dotnet 11.0.100` installed)** | **READY NOW (`node v24.20.0` installed)** | **BLOCKED until user installs Go SDK** | **READY NOW (`python 3.14.7` installed)** |

---

## 3. RATIFIED ARCHITECTURAL DECISION (`DEC-021`)

**Chosen Stack:** **Option B — `Node.js v24` Zero-External-Dependency Native TypeScript (`cli/`), with Dual-Mode Execution (`node`/`npx` + Node Single Executable Application `--build-sea`)** *(Ratified by `HUM-OWNER` at Phase 6 Gate).*

### Rationale for Ratified Option B
1. **Immediate Zero-Install Verification (`STD-009-R01`):** `Node.js v24.20.0` is natively installed on the host and executes `.ts` files directly with built-in `node:test`, `node:crypto`, `node:fs`, `node:child_process`, and `node:util.parseArgs`.
2. **Zero `node_modules` Bloat:** By implementing the deterministic YAML-subset/frontmatter parser and Draft 2020-12 JSON Schema evaluator directly against `node:*` standard library modules, `cli/` has **zero third-party runtime dependencies** (`dependencies: {}`), eliminating supply-chain risk (`STD-008-R03`) and working 100% air-gapped.
3. **Flexible Distribution:** Can run instantly as a portable CLI script/package AND compile into a standalone executable via Node `v24` SEA (`--build-sea`) while embedding the `standard/`, `schemas/`, `policies/`, `templates/`, and `adapters/` snapshot offline (`DEC-022`).

---

## 4. SHARED INTERNAL ARCHITECTURE OF `cli/` (REGARDLESS OF CHOSEN LANGUAGE)

To keep Milestone 2 clean, modular, and testable, `cli/` MUST be structured into six decoupled internal modules:

1. **`bundle` (Embedded Resource Provider):** Exposes read-only access to embedded `standard/STD-001..012.md`, `schemas/*.schema.json`, `policies/*.md`, `templates/**`, and `adapters/**` (with `--bundle <dir>` override).
2. **`crypto_fs` (Deterministic Hash & Safe I/O):** Implements `SHA256-UTF8-LF` hashing (`DEC-013`), glob matching (`**`, `*`), atomic file writes, and Level 1 write-barrier protection (`STD-007-R07`).
3. **`parser_schema` (YAML Frontmatter & Draft 2020-12 Schema Engine):** Parses AI-SDGS YAML config/lock/frontmatter documents into typed ASTs and validates `required`, `type`, `enum`, `const`, `pattern`, `not.pattern`, `minItems`/`uniqueItems`, and conditional `allOf`/`if`/`then` rules from `schemas/*.schema.json`.
4. **`validator` (8-Stage `L2` Engine):** Implements Stages 1–8 (`DOC-PLT-005`), returning structured `Diagnostic[]` + canonical compliance state & exit code (`0`, `1`, `2`, `3`).
5. **`git_vcs` (Git Inspection & Hooks):** Wraps read-only `git status --porcelain`, `git diff`, and safe `.git/hooks/{pre-commit,pre-push}` installation (`STD-009-R08`, `DEC-007` Ring 2).
6. **`commands` (11 CLI Command Handlers):** Implements `init`, `status`, `standard`, `adapter`, `validate`, `baseline`, `change`, `audit`, `hooks`, `update`, and `report` with both human-readable and `--json` formatters (`DOC-PLT-004`).
