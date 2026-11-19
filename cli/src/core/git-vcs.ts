import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { toPosixPath } from './crypto-fs.ts';

export interface GitExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export function runGit(cwd: string, args: string[]): GitExecResult {
  const res = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true
  });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? '').replace(/\r\n/g, '\n'),
    stderr: (res.stderr ?? '').replace(/\r\n/g, '\n')
  };
}

export function isGitRepository(cwd: string): boolean {
  if (fs.existsSync(path.join(cwd, '.git'))) return true;
  const res = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  return res.ok && res.stdout.trim() === 'true';
}

export function hasHeadCommit(cwd: string): boolean {
  return runGit(cwd, ['rev-parse', '--verify', 'HEAD']).ok;
}

/**
 * Returns modified, added, deleted, and untracked paths in working tree relative to cwd (POSIX slashes).
 */
export function getWorkingTreeChangedFiles(cwd: string): string[] {
  if (!isGitRepository(cwd)) return [];
  const res = runGit(cwd, ['status', '--porcelain', '-uall']);
  if (!res.ok) return [];
  const changed = new Set<string>();
  for (const line of res.stdout.split('\n')) {
    if (line.length < 4) continue;
    let filePart = line.slice(3).trim();
    if (filePart.includes(' -> ')) {
      const parts = filePart.split(' -> ');
      filePart = parts[parts.length - 1].trim();
    }
    if (filePart.startsWith('"') && filePart.endsWith('"')) {
      filePart = filePart.slice(1, -1);
    }
    if (filePart) changed.add(toPosixPath(filePart));
  }
  return [...changed].sort();
}

export function getUnifiedDiff(cwd: string, baseRef?: string): string {
  if (!isGitRepository(cwd)) return '';
  if (baseRef) {
    const res = runGit(cwd, ['diff', baseRef]);
    if (res.ok) return res.stdout;
  }
  if (hasHeadCommit(cwd)) {
    const res = runGit(cwd, ['diff', 'HEAD']);
    if (res.ok) return res.stdout;
  }
  const staged = runGit(cwd, ['diff', '--cached']);
  const unstaged = runGit(cwd, ['diff']);
  return `${staged.stdout}\n${unstaged.stdout}`.trim();
}

export function getDiffAddedLinesByFile(diffText: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let currentFile: string | null = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = toPosixPath(line.slice(6).trim());
      if (!result.has(currentFile)) result.set(currentFile, []);
    } else if (line.startsWith('+++ /dev/null')) {
      currentFile = null;
    } else if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      result.get(currentFile)!.push(line.slice(1));
    }
  }
  return result;
}
