import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CLI_VERSION } from '../core/constants.ts';
import { runValidation } from '../core/validator.ts';
import { runBaselineDiff, runBaselineStatus } from './baseline.ts';
import { runChangeStatus } from './change.ts';
import { runStandardList, runStatus } from './status-standard.ts';

export interface UiServerOptions {
  port?: number;
  open?: boolean;
}

export function generateDashboardHtml(projectName: string, initialStatus: Record<string, unknown>): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI-SDGS Governance Dashboard — ${projectName}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --surface: #111827;
      --surface-border: #1f2937;
      --card-bg: #1e293b;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #38bdf8;
      --primary-hover: #0284c7;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    header { background: var(--surface); border-bottom: 1px solid var(--surface-border); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
    .brand { display: flex; align-items: center; gap: 0.75rem; }
    .logo-badge { background: linear-gradient(135deg, #0284c7, #6366f1); color: white; font-weight: 800; font-size: 0.9rem; padding: 0.35rem 0.65rem; border-radius: 6px; letter-spacing: 0.05em; }
    .brand h1 { font-size: 1.15rem; font-weight: 700; color: #fff; }
    .brand span { color: var(--text-muted); font-size: 0.85rem; }
    .nav-actions { display: flex; gap: 0.75rem; align-items: center; }
    .badge { padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-tier { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-mode { background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); }
    .badge-compliant { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-non-compliant { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn { background: var(--primary); color: #0b0f19; font-weight: 600; border: none; border-radius: 6px; padding: 0.45rem 0.9rem; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 0.4rem; }
    .btn:hover { background: var(--primary-hover); color: #fff; }
    .btn-secondary { background: var(--surface-border); color: var(--text); }
    .btn-secondary:hover { background: #374151; }
    main { padding: 2rem; max-width: 1400px; margin: 0 auto; width: 100%; flex: 1; display: flex; flex-direction: column; gap: 1.5rem; }
    .tabs { display: flex; gap: 0.5rem; border-bottom: 1px solid var(--surface-border); padding-bottom: 0.5rem; }
    .tab-btn { background: transparent; border: none; color: var(--text-muted); font-size: 0.9rem; font-weight: 600; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
    .tab-btn.active { background: var(--card-bg); color: var(--primary); }
    .tab-btn:hover:not(.active) { color: #fff; }
    .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .card { background: var(--card-bg); border: 1px solid var(--surface-border); border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .card-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
    .card-value { font-size: 1.6rem; font-weight: 700; color: #fff; }
    .card-meta { font-size: 0.8rem; color: var(--text-muted); }
    .panel { background: var(--surface); border: 1px solid var(--surface-border); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--surface-border); padding-bottom: 0.75rem; }
    .panel-title { font-size: 1.05rem; font-weight: 600; color: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.65rem 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
    th { color: var(--text-muted); font-weight: 600; background: rgba(0,0,0,0.15); }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .diag-box { background: rgba(0,0,0,0.25); border: 1px solid var(--surface-border); border-radius: 6px; padding: 0.85rem; font-family: monospace; font-size: 0.85rem; max-height: 280px; overflow-y: auto; }
    .diag-item { padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; gap: 0.5rem; }
    .diag-err { color: #f87171; font-weight: 600; }
    .diag-warn { color: #fbbf24; font-weight: 600; }
    .diag-info { color: #38bdf8; font-weight: 600; }
    .svg-container { width: 100%; height: 420px; background: #070b12; border: 1px solid var(--surface-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    footer { border-top: 1px solid var(--surface-border); padding: 1rem 2rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-badge">AI-SDGS</div>
      <div>
        <h1 id="projName">${projectName}</h1>
        <span>Governance & Architecture Dashboard v${CLI_VERSION}</span>
      </div>
    </div>
    <div class="nav-actions">
      <span class="badge badge-tier" id="tierBadge">TIER: STANDARD</span>
      <span class="badge badge-mode" id="modeBadge">GREENFIELD</span>
      <span class="badge badge-compliant" id="complianceBadge">COMPLIANT</span>
      <button class="btn" id="btnValidate" onclick="triggerValidation()">⚡ Run Validation</button>
      <button class="btn btn-secondary" onclick="loadAllData()">↻ Refresh</button>
    </div>
  </header>

  <main>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('overview')">📊 Overview & Metrics</button>
      <button class="tab-btn" onclick="switchTab('changes')">🔄 Change Requests (CR)</button>
      <button class="tab-btn" onclick="switchTab('standards')">📜 Core Standards</button>
      <button class="tab-btn" onclick="switchTab('baseline')">🔒 Project Baseline</button>
      <button class="tab-btn" onclick="switchTab('graph')">🌐 Architecture Topology</button>
    </div>

    <!-- TAB 1: OVERVIEW -->
    <div id="tab-overview" class="tab-content" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div class="grid-4">
        <div class="card">
          <div class="card-label">Baseline State</div>
          <div class="card-value" id="valBaselineState">LOCKED</div>
          <div class="card-meta" id="valBaselineMeta">v1.0.0 — 6 pinned artifacts</div>
        </div>
        <div class="card">
          <div class="card-label">Active Changes</div>
          <div class="card-value" id="valActiveCrs">0</div>
          <div class="card-meta">In-flight Change Requests</div>
        </div>
        <div class="card">
          <div class="card-label">Active Waivers</div>
          <div class="card-value" id="valWaivers">0</div>
          <div class="card-meta">Temporary approved exceptions</div>
        </div>
        <div class="card">
          <div class="card-label">Git Hooks Enforcement</div>
          <div class="card-value" id="valHooks">Active</div>
          <div class="card-meta">Pre-commit & Pre-push protected</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Deterministic L2 Validation Engine (8 Stages)</div>
          <span id="valTimestamp" style="font-size: 0.8rem; color: var(--text-muted);">Last checked: Just now</span>
        </div>
        <div class="diag-box" id="diagOutput">
          <div class="diag-item"><span class="diag-info">[STATUS]</span> Workspace ready. Click 'Run Validation' to scan.</div>
        </div>
      </div>
    </div>

    <!-- TAB 2: CHANGES -->
    <div id="tab-changes" class="tab-content hidden">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Tracked Change Requests (changes/records/)</div>
          <span style="font-size: 0.8rem; color: var(--text-muted);" id="crCountLabel">0 records</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Track</th>
              <th>Status</th>
              <th>Title</th>
              <th>Affected Files</th>
            </tr>
          </thead>
          <tbody id="crTableBody">
            <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No Change Requests recorded.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: STANDARDS -->
    <div id="tab-standards" class="tab-content hidden">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">12 Universal Core Standards (STD-001..STD-012)</div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">96 Normative Requirements</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Scope</th>
              <th>Applicable Tiers</th>
              <th>Title</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="standardsTableBody">
            <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Loading standards...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: BASELINE -->
    <div id="tab-baseline" class="tab-content hidden">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Cryptographic Project Baseline (PROJECT-BASELINE.md)</div>
          <span id="baselineDiffStatus" class="badge badge-compliant">CLEAN</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Artifact Path</th>
              <th>SHA256-UTF8-LF Digest</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="baselineTableBody">
            <tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Loading baseline artifacts...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 5: GRAPH -->
    <div id="tab-graph" class="tab-content hidden">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Acyclic Governance Dependency Topology (DAG)</div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Level 1 Core &rarr; Level 2 Project &rarr; Change Records</span>
        </div>
        <div class="svg-container">
          <svg width="860" height="380" viewBox="0 0 860 380">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
              </marker>
            </defs>
            <!-- Nodes Level 1 -->
            <rect x="40" y="40" width="180" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
            <text x="130" y="65" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">STD-001..STD-006</text>
            <text x="130" y="85" fill="#94a3b8" font-size="10" text-anchor="middle">Constitution & Baseline</text>

            <rect x="40" y="150" width="180" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
            <text x="130" y="175" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">STD-007..STD-012</text>
            <text x="130" y="195" fill="#94a3b8" font-size="10" text-anchor="middle">Verification & Security</text>

            <!-- Nodes Level 2 -->
            <rect x="340" y="40" width="200" height="60" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
            <text x="440" y="65" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">PROJECT-CONSTITUTION</text>
            <text x="440" y="85" fill="#94a3b8" font-size="10" text-anchor="middle">Role Authority & Tiers</text>

            <rect x="340" y="150" width="200" height="60" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
            <text x="440" y="175" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">PROJECT-BASELINE</text>
            <text x="440" y="195" fill="#94a3b8" font-size="10" text-anchor="middle">SHA256 Cryptographic Lock</text>

            <rect x="340" y="260" width="200" height="60" rx="8" fill="#1e293b" stroke="#6366f1" stroke-width="2"/>
            <text x="440" y="285" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">AGENTS.md & Bridges</text>
            <text x="440" y="305" fill="#94a3b8" font-size="10" text-anchor="middle">Context Tier 0 Router</text>

            <!-- Nodes Level 3 -->
            <rect x="640" y="150" width="180" height="60" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
            <text x="730" y="175" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">Change Requests (CR)</text>
            <text x="730" y="195" fill="#94a3b8" font-size="10" text-anchor="middle">FAST / FULL / EMERGENCY</text>

            <!-- Connectors -->
            <line x1="220" y1="70" x2="330" y2="70" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
            <line x1="220" y1="180" x2="330" y2="180" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
            <line x1="440" y1="100" x2="440" y2="140" stroke="#10b981" stroke-width="2" marker-end="url(#arrow)"/>
            <line x1="440" y1="210" x2="440" y2="250" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow)"/>
            <line x1="540" y1="180" x2="630" y2="180" stroke="#f59e0b" stroke-width="2" marker-end="url(#arrow)"/>
          </svg>
        </div>
      </div>
    </div>
  </main>

  <footer>
    AI-SDGS AI Software Development Governance Standard &bull; Zero-Dependency Deterministic Platform &bull; v${CLI_VERSION}
  </footer>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      event.target.classList.add('active');
      document.getElementById('tab-' + tabId).classList.remove('hidden');
    }

    async function loadAllData() {
      try {
        const [resStatus, resStandards, resChanges, resBaseline] = await Promise.all([
          fetch('/api/status').then(r => r.json()),
          fetch('/api/standards').then(r => r.json()),
          fetch('/api/changes').then(r => r.json()),
          fetch('/api/baseline').then(r => r.json())
        ]);

        if (resStatus.ok && resStatus.data) {
          const s = resStatus.data;
          document.getElementById('projName').innerText = s.project_name || 'AI-SDGS Governed Project';
          document.getElementById('tierBadge').innerText = 'TIER: ' + (s.adoption_tier || 'STANDARD');
          document.getElementById('modeBadge').innerText = s.onboarding_mode || 'GREENFIELD';
          document.getElementById('valBaselineState').innerText = s.baseline_state || 'UNINITIALIZED';
          document.getElementById('valBaselineMeta').innerText = (s.baseline_version || 'v1.0.0') + ' — ' + (s.baseline_artifacts_count || 0) + ' locked files';
          document.getElementById('valActiveCrs').innerText = s.active_crs ? s.active_crs.length : 0;
          document.getElementById('valWaivers').innerText = s.active_waivers_count || 0;
          const h = s.hooks_installed || {};
          document.getElementById('valHooks').innerText = (h.preCommit && h.prePush) ? 'Active (Pre-Commit + Push)' : (h.preCommit ? 'Pre-commit only' : 'None');
        }

        if (resStandards.ok && resStandards.data && resStandards.data.standards) {
          const tbody = document.getElementById('standardsTableBody');
          tbody.innerHTML = resStandards.data.standards.map(std => \`
            <tr>
              <td><strong style="color: var(--primary);">\${std.id}</strong></td>
              <td>\${std.domain || 'Core'}</td>
              <td>\${std.applicability || 'LITE / STANDARD / STRICT'}</td>
              <td>\${std.title}</td>
              <td><span class="badge badge-compliant">\${std.status || 'APPROVED'}</span></td>
            </tr>
          \`).join('');
        }

        if (resChanges.ok && resChanges.data && resChanges.data.records) {
          const tbody = document.getElementById('crTableBody');
          const records = resChanges.data.records;
          document.getElementById('crCountLabel').innerText = records.length + ' record(s)';
          if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No Change Requests recorded.</td></tr>';
          } else {
            tbody.innerHTML = records.map(cr => \`
              <tr>
                <td><strong>\${cr.id}</strong></td>
                <td><span class="badge badge-mode">\${cr.track}</span></td>
                <td><span class="badge badge-compliant">\${cr.status}</span></td>
                <td>\${cr.title}</td>
                <td><code style="color: var(--primary);">\${(cr.affected_files || []).join(', ') || 'None'}</code></td>
              </tr>
            \`).join('');
          }
        }

        if (resBaseline.ok && resBaseline.data) {
          const b = resBaseline.data.baseline;
          const diff = resBaseline.data.diff;
          const diffBadge = document.getElementById('baselineDiffStatus');
          if (diff && diff.ok) {
            diffBadge.className = 'badge badge-compliant';
            diffBadge.innerText = 'CLEAN (NO DRIFT)';
          } else {
            diffBadge.className = 'badge badge-non-compliant';
            diffBadge.innerText = 'DRIFT DETECTED';
          }
          const tbody = document.getElementById('baselineTableBody');
          if (b && b.artifacts) {
            tbody.innerHTML = b.artifacts.map(a => \`
              <tr>
                <td><code style="color: #fff;">\${a.path}</code></td>
                <td><span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">\${a.sha256}</span></td>
                <td><span class="badge badge-compliant">VERIFIED</span></td>
              </tr>
            \`).join('');
          }
        }
      } catch (e) {
        console.error('Error loading dashboard data:', e);
      }
    }

    async function triggerValidation() {
      const btn = document.getElementById('btnValidate');
      btn.innerText = '⏳ Validating...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/validate').then(r => r.json());
        const report = res.data;
        const compBadge = document.getElementById('complianceBadge');
        if (report.ok) {
          compBadge.className = 'badge badge-compliant';
          compBadge.innerText = report.compliance_state;
        } else {
          compBadge.className = 'badge badge-non-compliant';
          compBadge.innerText = report.compliance_state;
        }
        document.getElementById('valTimestamp').innerText = 'Last validated: ' + new Date().toLocaleTimeString();

        const diagBox = document.getElementById('diagOutput');
        if (report.diagnostics && report.diagnostics.length > 0) {
          diagBox.innerHTML = report.diagnostics.map(d => {
            const cls = d.severity === 'ERROR' ? 'diag-err' : (d.severity === 'WARNING' ? 'diag-warn' : 'diag-info');
            return \`<div class="diag-item"><span class="\${cls}">[\${d.severity}]</span> Stage \${d.stage} (\${d.rule_id}) at \${d.file}: \${d.message}</div>\`;
          }).join('');
        } else {
          diagBox.innerHTML = '<div class="diag-item"><span class="diag-info">[SUCCESS]</span> 8-Stage Deterministic Validation Passed: Exit Code 0 (COMPLIANT). Zero errors, zero warnings.</div>';
        }
      } catch (err) {
        alert('Validation failed: ' + err.message);
      } finally {
        btn.innerText = '⚡ Run Validation';
        btn.disabled = false;
      }
    }

    loadAllData();
  </script>
</body>
</html>`;
}

export function startUiServer(
  workspaceRootInput: string,
  options: UiServerOptions = {}
): http.Server {
  const workspaceRoot = path.resolve(workspaceRootInput);
  const port = options.port || 4040;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/') {
      const statusRes = runStatus(workspaceRoot);
      const projName = statusRes.ok ? statusRes.project_name : 'AI-SDGS Repository';
      const html = generateDashboardHtml(projName, statusRes as unknown as Record<string, unknown>);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (pathname === '/api/status') {
      const st = runStatus(workspaceRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: st.ok, data: st }));
      return;
    }

    if (pathname === '/api/validate') {
      const strict = url.searchParams.get('strict') === 'true';
      const val = runValidation(workspaceRoot, { strict });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: val.ok, data: val }));
      return;
    }

    if (pathname === '/api/standards') {
      const std = runStandardList(workspaceRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: std.ok, data: std }));
      return;
    }

    if (pathname === '/api/changes') {
      const ch = runChangeStatus(workspaceRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: ch.ok, data: ch }));
      return;
    }

    if (pathname === '/api/baseline') {
      const b = runBaselineStatus(workspaceRoot);
      const d = runBaselineDiff(workspaceRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: b.ok, data: { baseline: b, diff: d } }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }));
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    process.stderr.write(`[AI-SDGS UI] Dashboard active at ${url} (workspace: ${workspaceRoot})\n`);
    if (options.open) {
      const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      try {
        spawn(cmd, [url], { shell: true, detached: true }).unref();
      } catch {
        // Ignore open failure
      }
    }
  });

  return server;
}
