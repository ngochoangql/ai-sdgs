# AI-SDGS — AI Software Development Governance Standard & Platform

**Version:** `1.0.0` (`ai-sdgs-core-1.0.0`)  
**Release Status:** **`VERIFIED` — Normative Standard + Executable `aisdgs` CLI & Enforcement Platform (`22/22` Automated Tests Passing)**

> **Central Principle (`STD-001-R01`):** A natural-language user prompt is an input signal, **never** automatic authorization to mutate an approved project baseline, public contract, dependency manifest, or architectural boundary.

---

## 1. What Is AI-SDGS?

**AI-SDGS** is a technology-independent software engineering governance standard and zero-dependency enforcement CLI that prevents **Cumulative System Deviation (Baseline Drift)** when building software with AI coding agents—scaling proportionally from solo MVPs to regulated enterprise systems.

### Core Highlights
- **12 Orthogonal Core Standards (`STD-001`..`STD-012`):** `96` uniquely numbered requirements (`48` `[NON-WAIVABLE]` invariants + `48` `[WAIVABLE]` rules) organized in a verified acyclic dependency graph.
- **3-Tier Progressive Context Architecture (`STD-011`):**
  - **Tier 0 (`AGENTS.md`):** **58 lines** (≤ 150 ceiling) — ~550 tokens loaded at session start; zero bloat on read-only questions.
  - **Tier 0b (Thin Vendor Bridges):** **8–13 lines** (`CLAUDE.md` + Ring 1 `.claude/settings.json`, `GEMINI.md`, `.cursor/rules/aisdgs.mdc`, GitHub Copilot, Kilo Code).
  - **Tier 1 (Task Playbooks):** **56–72 lines** (`policies/*.md`), loaded conditionally only when a mutating prompt triggers them.
- **Proportional Governance (`STD-002`, `STD-006`, `STD-007`):**
  - **3 Tiers:** `LITE` (Solo/MVP), `STANDARD` (Product Teams), `STRICT` (Enterprise/Regulated).
  - **3 Onboarding Modes:** `GREENFIELD`, `BROWNFIELD` (`< 30 min` `ANCHORED` baseline + *Govern-on-Touch*), and `ITERATIVE` (Vertical-Slice baselining).
  - **Multi-Track Change Control:** Zero-CR path for read-only & spec-restoring bug fixes, 5-field `CR-FAST`, 14-field `CR-FULL`, and `< 2 min` `CR-EMERGENCY` (`72h`/`48h` reconciliation clock).
- **Executable `aisdgs` CLI & 8-Stage `L2` Validation Engine (`cli/`, `dist/`):**
  - **Zero External Dependencies (`"dependencies": {}`):** Built on `Node.js v24` native TypeScript AND packaged into a single portable **338 KB** standalone bundle (`dist/aisdgs-standalone.mjs`) embedding all 44 standards, Draft 2020-12 JSON Schemas, policies, templates, and CI workflows for **100% offline execution**.

---

## 2. Quick Start

```bash
# 1. Initialize any new or existing repository (auto-detects Greenfield vs. Brownfield)
node ./dist/aisdgs-standalone.mjs init --tier standard --owner <your-name>

# 2. Lock initial cryptographic baseline (SHA256-UTF8-LF) & install Git hooks
node ./dist/aisdgs-standalone.mjs baseline lock --approver <your-name>
node ./dist/aisdgs-standalone.mjs hooks install

# 3. Validate compliance (< 200ms across all 8 deterministic stages)
node ./dist/aisdgs-standalone.mjs validate
```

See:
- **[INSTALLATION-GUIDE.md](INSTALLATION-GUIDE.md)** — Portable single-file setup, `npm link`, Node SEA binary compilation, and CI gates.
- **[USER-GUIDE.md](USER-GUIDE.md)** — Greenfield, Brownfield (`< 30 min`), `CR-FAST` / `CR-FULL` / `CR-EMERGENCY`, and `aisdgs audit` workflows.
- **[MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)** — Safe standard upgrades (with hard write-barrier) and `LITE` → `STANDARD` → `STRICT` promotion.

---

## 3. Repository Structure

```text
ai-sdgs/
├── standard/             # STD-001..012 Universal Normative Standards (96 atomic rules)
├── schemas/              # 7 JSON Schemas (Draft 2020-12) for deterministic L2 validation
├── policies/             # 4 Context Tier 1 operational playbooks for AI coding agents
├── templates/            # Project scaffolds, CR/REQ/ADR/Audit kits & GitHub/GitLab CI gates
├── adapters/             # Context Tier 0 AGENTS.md router + 5 vendor bridges + Ring 1 preset
├── cli/                  # Zero-dependency Node.js v24 TypeScript CLI + 22 automated tests
├── dist/                 # Portable single-file aisdgs-standalone.mjs + RELEASE-MANIFEST.json
├── docs/                 # Research, Architecture, Adoption & Platform/Validator specifications
├── quality/              # Consistency audit, 14-scenario trace, Known Limitations & Release Report
├── INSTALLATION-GUIDE.md # Cross-platform setup & CI hook instructions
├── USER-GUIDE.md         # Daily developer & AI agent operational manual
└── MIGRATION-GUIDE.md    # Standard upgrade & Tier promotion manual
```
