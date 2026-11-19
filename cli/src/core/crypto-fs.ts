import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Normalizes CRLF / CR line endings to LF in memory (DEC-013).
 */
export function normalizeLf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Computes deterministic SHA256-UTF8-LF hex digest (DEC-013).
 */
export function sha256Lf(content: string | Buffer): string {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  const normalized = normalizeLf(text);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function sha256FileLf(filePath: string): string {
  const raw = fs.readFileSync(filePath, 'utf8');
  return sha256Lf(raw);
}

export function countLinesLf(text: string): number {
  const norm = normalizeLf(text);
  if (norm.length === 0) return 0;
  const trimmed = norm.endsWith('\n') ? norm.slice(0, -1) : norm;
  return trimmed.split('\n').length;
}

export function toPosixPath(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Converts a repository glob pattern (.aisdgs/**, ** /package.json, src/*.ts) into a RegExp.
 */
export function globToRegExp(globPattern: string): RegExp {
  const p = toPosixPath(globPattern.trim());
  let re = '^';
  let i = 0;
  while (i < p.length) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*') {
        if (p[i + 2] === '/') {
          // "**/foo" matches "foo" or "a/b/foo"
          re += '(?:.*/)?';
          i += 3;
          continue;
        } else {
          // "dir/**" or "**" matches anything
          re += '.*';
          i += 2;
          continue;
        }
      } else {
        re += '[^/]*';
        i += 1;
        continue;
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else if ('+^$()[]{}|.\\'.includes(ch)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
    i += 1;
  }
  re += '$';
  return new RegExp(re);
}

export function matchGlob(relPath: string, globPattern: string): boolean {
  const posix = toPosixPath(relPath);
  return globToRegExp(globPattern).test(posix);
}

export function matchesAnyGlob(relPath: string, globs: readonly string[]): boolean {
  const posix = toPosixPath(relPath);
  return globs.some((g) => matchGlob(posix, g));
}

export function walkFiles(rootDir: string, ignoreDirs: ReadonlySet<string> = new Set(['.git', 'node_modules'])): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const results: string[] = [];
  function visit(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        visit(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  visit(rootDir);
  return results.sort();
}

export function findEmptyDirs(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const empty: string[] = [];
  function visit(dir: string): boolean {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.length === 0) {
      if (path.resolve(dir) !== path.resolve(rootDir)) empty.push(dir);
      return true;
    }
    let hasAnyChild = false;
    for (const ent of entries) {
      if (ent.isFile()) {
        hasAnyChild = true;
      } else if (ent.isDirectory()) {
        const subEmpty = visit(path.join(dir, ent.name));
        if (!subEmpty) hasAnyChild = true;
      }
    }
    return !hasAnyChild;
  }
  visit(rootDir);
  return empty.sort();
}

/**
 * Deterministic {{TOKEN_NAME}} substitution (DEC-017).
 */
export function renderTemplate(templateText: string, tokens: Readonly<Record<string, string>>): string {
  return normalizeLf(templateText).replace(/\{\{([A-Z0-9_]+)\}\}/g, (full, key: string) => {
    return Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : full;
  });
}

/**
 * Enforces STD-007-R07 write-barrier during standard upgrades:
 * Level 1 standard updates may ONLY write inside .aisdgs/ (and adapter files when explicitly requested).
 */
export function assertUpdateWriteBarrier(workspaceRoot: string, targetFilePath: string, allowAdapters = false): void {
  const rel = toPosixPath(path.relative(workspaceRoot, path.resolve(targetFilePath)));
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Write-barrier violation: path '${rel}' escapes workspace root.`);
  }
  if (
    rel.startsWith('.aisdgs/standard/') ||
    rel.startsWith('.aisdgs/schemas/') ||
    rel.startsWith('.aisdgs/policies/') ||
    rel === '.aisdgs/standard-lock.yaml'
  ) {
    return;
  }
  if (allowAdapters) {
    const allowedAdapterFiles = new Set([
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.cursor/rules/aisdgs.mdc',
      '.github/copilot-instructions.md',
      '.kilocode/rules/aisdgs.md',
      '.claude/settings.json'
    ]);
    if (allowedAdapterFiles.has(rel)) return;
  }
  throw new Error(`STD-007-R07 Write-Barrier Violation: Standard update attempted to modify protected project path '${rel}'.`);
}

export function writeFileAtomicLf(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, normalizeLf(content), 'utf8');
}
