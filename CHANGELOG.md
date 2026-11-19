# CHANGELOG

All notable changes and official releases of **AI-SDGS** are documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning 2.0.0](https://semver.org/).

---

## [1.0.0] — 2026-11-18 *(Official Universal Standard & Executable Platform Release)*

### Added — Milestone 2 (`Phases 8–10`: Executable CLI & Enforcement Engine)
- **Zero-Dependency `aisdgs` CLI (`cli/`):** Implemented all 11 CLI command groups (`init`, `status`, `standard`, `adapter`, `validate`, `baseline`, `change`, `audit`, `hooks`, `update`, `report`) in `Node.js v24` native TypeScript with zero third-party packages (`"dependencies": {}`).
- **8-Stage Deterministic `L2` Validation Engine (`cli/src/core/validator.ts`):** `SHA256-UTF8-LF` lockfile & baseline verification, Draft 2020-12 JSON Schema & YAML frontmatter engine, symbol-table & 3-color DFS cycle detection, 48-rule `[NON-WAIVABLE]` waiver guard, `72h`/`48h` `EMERGENCY_ACTIVE` deadline enforcement, Context line-budget checks, Ring 2 local self-approval spoofing detection (`Exit Code 3`), and secret/test-skipping diff scanners.
- **`L3` Semantic Audit Bundler (`aisdgs audit`):** Deterministic packaging of `git diff`, protected-path touches, linked `CR-*`/`REQ-*`/`ADR-*` specs, and the `AUD-01..06` review rubric.
- **Git & CI Enforcement (`aisdgs hooks`, `templates/ci/*`):** Non-destructive chained `pre-commit` / `pre-push` hooks plus GitHub Actions & GitLab CI Ring 3 workflow templates.
- **Portable Single-File Distribution (`dist/`):** `dist/aisdgs-standalone.mjs` (`338.6 KB`, embedding all 44 bundle artifacts offline), `dist/RELEASE-MANIFEST.json`, OS shims, and `dist/sea-config.json`.
- **Automated Verification Suite (`cli/tests/`):** `22 / 22` passing unit and E2E integration tests across 5 test suites (`quality/RELEASE-REPORT.md`).
- **Operational Manuals:** `INSTALLATION-GUIDE.md`, `USER-GUIDE.md`, and `MIGRATION-GUIDE.md`.

### Added — Milestone 1 (`Phases 0–7`: Normative Standard, Schemas, Templates & Adapter Kit)
- **12 Core Universal Standards (`STD-001`..`STD-012`):** `96` atomic normative requirements across Foundation, Documentation, Requirements/Change, Software Lifecycle, AI Governance, and Security/Operations.
- **7 Draft 2020-12 JSON Schemas (`schemas/*.schema.json`)** & **12 Project/Artifact Templates (`templates/**`)**.
- **3-Tier Progressive Context Kit (`adapters/*`, `policies/*.md`):** 58-line `AGENTS.md` router + thin bridges for Claude Code, Gemini/Antigravity, Cursor, GitHub Copilot, and Kilo Code.
