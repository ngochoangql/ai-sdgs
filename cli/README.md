# ai-sdgs

Deterministic AI Software Development Governance Standard (`AI-SDGS`) CLI and enforcement platform.

## Quick Start via npx

```bash
# Initialize AI-SDGS in any project
npx ai-sdgs init --tier standard --owner <your-name>

# Lock project baseline
npx ai-sdgs baseline lock --approver <your-name>

# Validate compliance (< 200ms across 8 stages)
npx ai-sdgs validate

# Start Model Context Protocol (MCP) server for Claude / Cursor
npx ai-sdgs mcp

# Start local web dashboard
npx ai-sdgs ui --port 4040 --open
```

## Features

- **Zero Runtime Dependencies**: Runs directly on Node.js (>=24.0.0).
- **Native MCP Server**: Exposes 8 structured tools over stdio for AI coding agents.
- **8-Stage L2 Validator**: Schema, cryptographic DAG, waivers, and Ring 2 anti-spoofing.
- **Local Web Dashboard**: Interactive UI with topology graph and live validation.
