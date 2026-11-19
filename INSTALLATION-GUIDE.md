# AI-SDGS INSTALLATION & DISTRIBUTION GUIDE (`v1.0.0`)

**AI-SDGS** ships with **zero external npm dependencies** (`"dependencies": {}`) and embeds all 44 normative standards, JSON Schemas, Tier 1 playbooks, project templates, and multi-tool AI adapters directly inside its standalone CLI distribution.

---

## 1. Prerequisites

- **For Target Governed Projects:** **Any programming language or stack** (Rust, Go, C/C++, Python, Java, C#, TypeScript, Embedded, Mobile) + `Git` (recommended for working-tree diff guards and hooks).
- **For Running `aisdgs` CLI:** `Node.js >= 24.0` (or `>= 20.0` when running the pre-stripped JavaScript bundle `dist/aisdgs-standalone.mjs`, or **zero runtime** if compiled via Node SEA into a native `.exe`/binary).

---

## 2. Option A — Portable Single-File Installation (Recommended, Zero Dependencies)

Copy the single self-contained file `dist/aisdgs-standalone.mjs` (338 KB — requires **no `node_modules`** and **no companion folders**) alongside `dist/aisdgs` (POSIX) or `dist/aisdgs.cmd` (Windows) into a directory on your system `PATH`:

### Windows (PowerShell)
```powershell
New-Item -ItemType Directory -Force "$HOME\.local\bin" | Out-Null
Copy-Item .\dist\aisdgs-standalone.mjs, .\dist\aisdgs.cmd "$HOME\.local\bin\"
# Verify installation:
& "$HOME\.local\bin\aisdgs.cmd" --version
```

### Linux / macOS
```bash
mkdir -p "$HOME/.local/bin"
cp ./dist/aisdgs-standalone.mjs ./dist/aisdgs "$HOME/.local/bin/"
chmod +x "$HOME/.local/bin/aisdgs" "$HOME/.local/bin/aisdgs-standalone.mjs"
aisdgs --version
```

---

## 3. Option B — Local Developer Link from Source Monorepo

```bash
cd cli
npm link
aisdgs --version   # Prints 1.0.0
npm test           # Runs all 22 automated unit & E2E verification tests
```

To rebuild `dist/aisdgs-standalone.mjs` and `dist/RELEASE-MANIFEST.json` after modifying standards or CLI code:
```bash
cd cli
npm run build:release
```

---

## 4. Option C — Compiling a Native Standalone OS Binary (Node SEA)

For CI runners or C++/Rust/Embedded environments without Node installed, inject `dist/aisdgs-standalone.mjs` into a native executable using built-in Node `v24` Single Executable Applications (`dist/sea-config.json`):

```bash
cd dist
node --experimental-sea-config sea-config.json
# Copy host node binary to aisdgs(.exe) and inject aisdgs-sea.blob per Node SEA docs
```

---

## 5. Installing Local Git Hooks & CI Ring 3 Gates

Inside any initialized target project:

```bash
# 1. Install non-destructive pre-commit & pre-push hooks (preserves existing Husky/custom hooks)
aisdgs hooks install

# 2. Copy Ring 3 CI workflow (GitHub Actions or GitLab CI)
mkdir -p .github/workflows
cp <path-to-ai-sdgs>/templates/ci/github-aisdgs-gate.yml .github/workflows/aisdgs-governance-gate.yml
```
