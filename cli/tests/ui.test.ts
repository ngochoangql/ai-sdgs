import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { runInit } from '../src/commands/init.ts';
import { runBaselineLock } from '../src/commands/baseline.ts';
import { startUiServer } from '../src/commands/ui.ts';

function httpGet(url: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

describe('AI-SDGS UI Local Web Dashboard', () => {
  test('starts HTTP server and serves HTML dashboard and JSON APIs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisdgs-ui-test-'));
    const testPort = 4141;
    let server: http.Server | null = null;

    try {
      runInit(tmpDir, { tier: 'STANDARD', mode: 'GREENFIELD', owner: 'UI Lead' });
      runBaselineLock(tmpDir, { approver: 'UI Lead' });

      server = startUiServer(tmpDir, { port: testPort, open: false });

      // Wait a bit for server to listen
      await new Promise((resolve) => setTimeout(resolve, 200));

      const baseUrl = `http://localhost:${testPort}`;

      // 1. GET / -> HTML dashboard
      const homeRes = await httpGet(`${baseUrl}/`);
      assert.equal(homeRes.statusCode, 200);
      assert.ok(homeRes.headers['content-type']?.includes('text/html'));
      assert.ok(homeRes.body.includes('<!DOCTYPE html>'));
      assert.ok(homeRes.body.includes('Governance & Architecture Dashboard'));

      // 2. GET /api/status -> JSON
      const statusRes = await httpGet(`${baseUrl}/api/status`);
      assert.equal(statusRes.statusCode, 200);
      assert.ok(statusRes.headers['content-type']?.includes('application/json'));
      const statusJson = JSON.parse(statusRes.body);
      assert.equal(statusJson.ok, true);
      assert.equal(statusJson.data.adoption_tier, 'STANDARD');

      // 3. GET /api/standards -> JSON
      const stdRes = await httpGet(`${baseUrl}/api/standards`);
      assert.equal(stdRes.statusCode, 200);
      const stdJson = JSON.parse(stdRes.body);
      assert.equal(stdJson.ok, true);
      assert.ok(stdJson.data.standards.length >= 12);

      // 4. GET /api/validate -> JSON
      const valRes = await httpGet(`${baseUrl}/api/validate`);
      assert.equal(valRes.statusCode, 200);
      const valJson = JSON.parse(valRes.body);
      assert.equal(valJson.ok, true);
      assert.equal(valJson.data.compliance_state, 'COMPLIANT');

      // 5. GET /api/baseline -> JSON
      const baseRes = await httpGet(`${baseUrl}/api/baseline`);
      assert.equal(baseRes.statusCode, 200);
      const baseJson = JSON.parse(baseRes.body);
      assert.equal(baseJson.ok, true);
      assert.ok(baseJson.data.baseline.artifacts.length > 0);

      // 6. GET /api/changes -> JSON
      const changeRes = await httpGet(`${baseUrl}/api/changes`);
      assert.equal(changeRes.statusCode, 200);
      const changeJson = JSON.parse(changeRes.body);
      assert.equal(changeJson.ok, true);

      // 7. GET /api/nonexistent -> 404
      const notFoundRes = await httpGet(`${baseUrl}/api/unknown`);
      assert.equal(notFoundRes.statusCode, 404);
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
