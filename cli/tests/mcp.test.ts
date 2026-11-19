import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleMcpMessage, MCP_PROTOCOL_VERSION, MCP_TOOL_DEFINITIONS } from '../src/commands/mcp.ts';
import { runInit } from '../src/commands/init.ts';
import { runBaselineLock } from '../src/commands/baseline.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(__dirname, '../bin/aisdgs.mjs');

describe('MCP (Model Context Protocol) Server', () => {
  test('handles initialize, ping, and tools/list requests correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisdgs-mcp-init-'));
    try {
      // 1. initialize
      const initReq = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };
      const initRes = handleMcpMessage(tmpDir, initReq);
      assert.ok(initRes);
      assert.equal(initRes.id, 1);
      assert.equal(initRes.jsonrpc, '2.0');
      assert.equal((initRes.result as any).protocolVersion, MCP_PROTOCOL_VERSION);
      assert.ok((initRes.result as any).capabilities.tools);
      assert.ok((initRes.result as any).serverInfo.name, 'ai-sdgs-mcp');

      // 2. ping
      const pingReq = { jsonrpc: '2.0', id: 2, method: 'ping' };
      const pingRes = handleMcpMessage(tmpDir, pingReq);
      assert.ok(pingRes);
      assert.equal(pingRes.id, 2);
      assert.deepEqual(pingRes.result, {});

      // 3. tools/list
      const listReq = { jsonrpc: '2.0', id: 3, method: 'tools/list' };
      const listRes = handleMcpMessage(tmpDir, listReq);
      assert.ok(listRes);
      assert.equal(listRes.id, 3);
      const tools = (listRes.result as any).tools as Array<{ name: string }>;
      assert.equal(tools.length, MCP_TOOL_DEFINITIONS.length);
      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes('aisdgs_status'));
      assert.ok(toolNames.includes('aisdgs_validate'));
      assert.ok(toolNames.includes('aisdgs_change_create'));
      assert.ok(toolNames.includes('aisdgs_change_verify'));
      assert.ok(toolNames.includes('aisdgs_baseline_status'));
      assert.ok(toolNames.includes('aisdgs_baseline_diff'));
      assert.ok(toolNames.includes('aisdgs_adapter_sync'));
      assert.ok(toolNames.includes('aisdgs_audit'));

      // 4. notifications/initialized returns null (no response for notifications)
      const notifReq = { jsonrpc: '2.0', method: 'notifications/initialized' };
      const notifRes = handleMcpMessage(tmpDir, notifReq);
      assert.equal(notifRes, null);

      // 5. unknown method returns error -32601
      const unknownReq = { jsonrpc: '2.0', id: 99, method: 'non_existent_method' };
      const unknownRes = handleMcpMessage(tmpDir, unknownReq);
      assert.ok(unknownRes);
      assert.equal(unknownRes.error?.code, -32601);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('executes tools/call on initialized workspace (status, validate, change_create, verify)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisdgs-mcp-tools-'));
    try {
      // Initialize STANDARD workspace and lock baseline
      runInit(tmpDir, { tier: 'STANDARD', mode: 'GREENFIELD', owner: 'Test Lead' });
      runBaselineLock(tmpDir, { approver: 'Test Lead' });

      // 1. tools/call -> aisdgs_status
      const statusCall = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: { name: 'aisdgs_status', arguments: {} }
      };
      const statusRes = handleMcpMessage(tmpDir, statusCall);
      assert.ok(statusRes);
      assert.equal(statusRes.id, 10);
      assert.equal((statusRes.result as any).isError, false);
      const statusText = (statusRes.result as any).content[0].text;
      assert.match(statusText, /Tier:\s*STANDARD/);
      assert.match(statusText, /Baseline:\s*LOCKED/);

      // 2. tools/call -> aisdgs_validate
      const validateCall = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: { name: 'aisdgs_validate', arguments: { strict: false } }
      };
      const valRes = handleMcpMessage(tmpDir, validateCall);
      assert.ok(valRes);
      assert.equal(valRes.id, 11);
      assert.equal((valRes.result as any).isError, false);
      const valText = (valRes.result as any).content[0].text;
      assert.match(valText, /State:\s*COMPLIANT/);

      // 3. tools/call -> aisdgs_change_create
      const crCall = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'aisdgs_change_create',
          arguments: {
            track: 'fast',
            title: 'Add MCP native interface',
            affects: ['src/mcp/*.ts']
          }
        }
      };
      const crRes = handleMcpMessage(tmpDir, crCall);
      assert.ok(crRes);
      assert.equal(crRes.id, 12);
      assert.equal((crRes.result as any).isError, false);
      const crText = (crRes.result as any).content[0].text;
      assert.match(crText, /Created FAST Change Request 'CR-0001'/);

      // 4. tools/call -> aisdgs_change_verify
      const verifyCall = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'aisdgs_change_verify',
          arguments: { crId: 'CR-0001' }
        }
      };
      const verRes = handleMcpMessage(tmpDir, verifyCall);
      assert.ok(verRes);
      assert.equal(verRes.id, 13);
      assert.equal((verRes.result as any).isError, false);

      // 5. resources/list and resources/read
      const resListReq = { jsonrpc: '2.0', id: 14, method: 'resources/list' };
      const resListRes = handleMcpMessage(tmpDir, resListReq);
      assert.ok(resListRes);
      const resources = (resListRes.result as any).resources;
      assert.ok(resources.length >= 3);

      const resReadReq = {
        jsonrpc: '2.0',
        id: 15,
        method: 'resources/read',
        params: { uri: 'aisdgs://agents' }
      };
      const resReadRes = handleMcpMessage(tmpDir, resReadReq);
      assert.ok(resReadRes);
      assert.ok((resReadRes.result as any).contents[0].text.includes('AGENTS.md'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('runs aisdgs mcp as a subprocess over stdio JSON-RPC', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisdgs-mcp-proc-'));
    try {
      runInit(tmpDir, { tier: 'LITE', mode: 'GREENFIELD', owner: 'Solo Dev' });

      const proc = spawn('node', [CLI_ENTRY, 'mcp', '--cwd', tmpDir], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const responsePromise = new Promise<any>((resolve, reject) => {
        let buffer = '';
        proc.stdout.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line) {
              try {
                const parsed = JSON.parse(line);
                resolve(parsed);
                return;
              } catch (e) {
                reject(e);
              }
            }
          }
          buffer = lines[lines.length - 1];
        });

        proc.on('error', reject);
        setTimeout(() => reject(new Error('MCP subprocess timed out')), 4000);
      });

      // Send initialize request over stdin
      const initReq = {
        jsonrpc: '2.0',
        id: 100,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-runner', version: '1.0.0' }
        }
      };
      proc.stdin.write(JSON.stringify(initReq) + '\n');

      const response = await responsePromise;
      assert.equal(response.id, 100);
      assert.equal(response.result.serverInfo.name, 'ai-sdgs-mcp');
      assert.equal(response.result.protocolVersion, '2024-11-05');

      proc.kill();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
