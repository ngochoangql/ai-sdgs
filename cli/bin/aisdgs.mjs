#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist/aisdgs-standalone.mjs');
const srcPath = path.resolve(__dirname, '../src/main.ts');

// Prefer pre-bundled pure ESM JS for universal Node >= 20.0.0 support without TS runtime
const entryPath = fs.existsSync(distPath) ? distPath : srcPath;
const { executeCli } = await import(pathToFileURL(entryPath).href);

const out = executeCli(process.argv.slice(2));
if (out.stdout) process.stdout.write(out.stdout);
if (out.stderr) process.stderr.write(out.stderr);
process.exitCode = out.exitCode;
