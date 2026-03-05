/**
 * Centralised platform utilities — avoids scattered `process.platform` checks.
 */
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ── Platform booleans ───────────────────────────────────────────
export const isWin = process.platform === 'win32';
export const isMac = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';

// ── PATH separator ──────────────────────────────────────────────
export const PATH_SEP = path.delimiter; // ';' on Windows, ':' on Unix

// ── which / where ───────────────────────────────────────────────
/**
 * Resolve the full path of a command.
 * Uses `where.exe` on Windows, `which` on Unix.
 */
export async function whichCommand(cmd: string): Promise<string> {
  if (isWin) {
    const { stdout } = await execFileAsync('where.exe', [cmd], { timeout: 5000 });
    // `where` can return multiple lines; take the first match
    return stdout.trim().split(/\r?\n/)[0];
  }
  const { stdout } = await execFileAsync('which', [cmd], { timeout: 5000 });
  return stdout.trim();
}

// ── Default shell ───────────────────────────────────────────────
export function defaultShell(): string {
  if (isWin) return process.env.COMSPEC || 'cmd.exe';
  return process.env.SHELL || '/bin/bash';
}

// ── Shell args ──────────────────────────────────────────────────
export function shellArgs(shell: string): string[] {
  if (isWin) {
    if (/powershell|pwsh/i.test(shell)) return ['-NoLogo'];
    return [];
  }
  return ['-il'];
}

// ── Claude CLI candidate paths ──────────────────────────────────
export function claudeCliCandidates(): string[] {
  const home = os.homedir();
  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'claude.exe'),
      path.join(appData, 'npm', 'claude.cmd'),
      path.join(appData, 'npm', 'claude'),
      path.join(home, '.local', 'bin', 'claude.exe'),
    ];
  }
  return [
    path.join(home, '.local/bin/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ];
}

// ── cat command ─────────────────────────────────────────────────
/**
 * Returns a shell command string that prints a file's contents to stdout.
 */
export function catCommand(filePath: string): string {
  if (isWin) return `type "${filePath}"`;
  return `cat "${filePath}"`;
}

// ── User environment variables ──────────────────────────────────
/**
 * Returns platform-appropriate user env vars for a minimal PTY environment.
 */
export function userEnvVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (isWin) {
    vars.USERPROFILE = os.homedir();
    vars.USERNAME = os.userInfo().username;
    vars.HOME = os.homedir();
    if (process.env.APPDATA) vars.APPDATA = process.env.APPDATA;
    if (process.env.LOCALAPPDATA) vars.LOCALAPPDATA = process.env.LOCALAPPDATA;
  } else {
    vars.HOME = os.homedir();
    vars.USER = os.userInfo().username;
  }
  return vars;
}
