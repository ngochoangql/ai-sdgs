# AI-SDGS USER & OPERATIONS GUIDE (`v1.0.0`)

This guide covers daily workflows for human engineers, architects, and AI coding assistants operating under **AI-SDGS**.

---

## 1. Choosing Your Adoption Tier & Onboarding Mode

| Scenario | Recommended Command | Setup Time |
| :--- | :--- | :--- |
| **Solo MVP / Hackathon / Prototype** | `aisdgs init --tier lite --mode greenfield --owner <your-name>` | ~5–10 min |
| **New Production SaaS / Team Service** | `aisdgs init --tier standard --mode greenfield --owner <your-name>` | ~30 min |
| **Existing / Legacy Undocumented Repo** | `aisdgs init --tier standard --mode brownfield --owner <your-name>` | **< 30 min** |
| **Regulated / Fintech / Critical Platform** | `aisdgs init --tier strict --mode iterative --owner <your-name>` | ~60 min |

---

## 2. Quickstart Workflows

### 2.1 Onboarding an Existing Legacy Repo (`BROWNFIELD` < 30 Minutes)
1. **Initialize snapshot & AI routers:**
   ```bash
   aisdgs init --tier standard --mode brownfield --owner hoang-doan
   ```
2. **Customize boundaries:** Review `.aisdgs/config.yaml` (`protected_paths`, `roles`), `governance/PROJECT-CONSTITUTION.md`, and `docs/architecture/ADR-001.md`.
3. **Lock Anchor Baseline (`ANCHORED`):**
   ```bash
   aisdgs baseline lock --anchor --approver hoang-doan
   aisdgs hooks install
   git add . && git commit -m "chore: anchor AI-SDGS brownfield baseline"
   ```
4. **Operate with Govern-on-Touch:** Spec-restoring bug fixes proceed immediately; when adding features to an old module, include a micro-baseline `REQ-*` inside that feature's Change Request.

### 2.2 Greenfield Project Initialization
```bash
aisdgs init --tier standard --mode greenfield --owner hoang-doan
# Edit governance/PROJECT-CONSTITUTION.md, docs/architecture/ADR-001.md, docs/requirements/REQ-FUNC-001.md
aisdgs baseline lock --approver hoang-doan
git add . && git commit -m "chore: lock initial v1.0.0 project baseline"
```

---

## 3. Daily Change Workflows with AI Coding Agents

Once `AGENTS.md` (58 lines) and thin bridges (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/aisdgs.mdc`) are in your repo, any compliant AI coding agent automatically classifies prompts:

1. **Questions & Spec-Restoring Bug Fixes (`Zero-CR`):**
   - Ask questions freely (`0` files touched).
   - Ask for bug fixes matching approved specs → agent fixes code, adds regression test, runs `aisdgs validate`, and reports `VERIFIED`.
2. **Bounded Enhancements (`CR-FAST`):**
   ```bash
   aisdgs change create --track fast --title "Add CSV export to audit table" --files "src/ui/audit/**"
   ```
   - Human confirms (`approved_by` set, committed in `STRICT` mode) → AI implements inside `src/ui/audit/**` → `aisdgs change verify CR-0001` → `aisdgs validate`.
3. **New Features, Dependencies, DB Migrations & Architecture (`CR-FULL`):**
   ```bash
   aisdgs change create --track full --class technical_change --title "Add Redis rate-limiter"
   ```
   - AI completes 6-Dimension Impact Analysis (`ANALYZED`) and waits for `HUM-ARCH` / `HUM-PROD` approval before installing packages or writing migrations.
   - Upon completion: update `REQ-*`/`ADR-*` atomically, verify tests + `aisdgs audit --cr CR-0002`, and run:
     ```bash
     aisdgs baseline lock --approver hoang-doan --bump minor --cr CR-0002
     ```
4. **P0 Production Outage (`CR-EMERGENCY`):**
   ```bash
   aisdgs change create --track emergency --incident INC-501 --title "Null guard on webhook" --approver hoang-doan
   ```
   - Ship surgical fix immediately; reconcile regression test + specs + `aisdgs baseline lock` within **72h** (`48h` in `STRICT`).

---

## 4. Auditing & Diagnostics Reference

| Command | Purpose |
| :--- | :--- |
| `aisdgs status` | View Tier, Lockfile health, Baseline state, open CRs & emergency countdowns |
| `aisdgs validate [--strict] [--json]` | Run all 8 deterministic `L2` validation stages (`< 200ms`) |
| `aisdgs baseline diff \| verify` | Inspect or verify cryptographic `SHA256-UTF8-LF` baseline hashes |
| `aisdgs audit --cr CR-0001 --output quality/reports/AUDIT-CR-0001.md` | Package diff + linked `REQ-*`/`ADR-*` + `AUD-01..06` rubric for `L3` review |
| `aisdgs adapter sync` | Re-synchronize `AGENTS.md` and vendor bridges after editing `.aisdgs/config.yaml` |
| `aisdgs report --format md` | Generate executive compliance posture summary |
