#!/usr/bin/env node
import { executeCli } from '../src/main.ts';

const out = executeCli(process.argv.slice(2));
if (out.stdout) process.stdout.write(out.stdout);
if (out.stderr) process.stderr.write(out.stderr);
process.exitCode = out.exitCode;
