// Obsidian Prism Native Sidecar Daemon (sidecars/daemon/main.mjs)
// - Auto-discovers DevToolsActivePort across Windows/macOS/Linux + fast Target.setDiscoverTargets push
// - Registers Page.addScriptToEvaluateOnNewDocument + Runtime.evaluate (survives Ctrl+Shift+R reloads with zero app.asar touch!)
// - Hot-upgrades legacy instances to Obsidian Prism v1.0.5
// - Lazily serves real MetricsStore + DesktopUsage snapshots over __agPrismMetricsCall only when requested (0 idle CPU)
// - Registers __agPrismRepoCall (paired with window.__agPrismRepoBridge) for live Git status & safe git pull --ff-only + hot-reload!

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OmniServer, OMNI_BINDING, isBlockedUncPath } from '../../vendor/omni-viewer/omni-server.mjs';
import {
  buildRendererRpcExpression,
  extractModelLabelMap,
  normalizeRendererUserStatus,
  normalizeRendererQuotaSummary,
  normalizeRendererSummaries,
  normalizeRendererTrajectory,
} from '../../vendor/pulse-dashboard/sidecars/panel/renderer-rpc-adapter.mjs';
import { discoverLocalConversations } from '../../vendor/pulse-dashboard/sidecars/panel/local-conversations.mjs';
import { UpdateService, RELEASES_PAGE_URL } from './update-service.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..', '..');
const defaultCdp = require(path.join(DEFAULT_ROOT_DIR, 'cdp.js'));

export const METRICS_BINDING = '__agPrismMetricsCall';
export const REPO_BINDING = '__agPrismRepoCall';
export const THOUGHT_BINDING = '__agPrismThoughtCall';
export const USAGE_BINDING = '__agPrismUsageCall';
export const SIDEBAR_BINDING = '__agPrismSidebarCall';
export { OmniServer, OMNI_BINDING };
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function execGit(args, cwd, timeoutMs = 12000, extraConfigs = []) {
  const cfgFlags = ['-c', 'protocol.ext.allow=never', '-c', 'submodule.recurse=false'];
  for (const flag of extraConfigs) cfgFlags.push(flag);
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...cfgFlags, ...args],
      { cwd, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = String(stderr || err.message || 'git command failed').trim();
          reject(new Error(msg));
          return;
        }
        resolve(String(stdout || '').trim());
      }
    );
  });
}

const SECRET_TOKEN_RE =
  /(sk-[A-Za-z0-9_\-]{6,}|AIza[A-Za-z0-9_\-]{12,}|xai-[A-Za-z0-9_\-]{8,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|Bearer\s+[A-Za-z0-9._\-]{8,})/gi;

function sanitizeSecretText(text) {
  return String(text || '')
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, 'https://***@')
    .replace(SECRET_TOKEN_RE, '***REDACTED***');
}

function serializeJsonForEval(val) {
  const raw = JSON.stringify(val === undefined ? null : val);
  return String(raw).replace(/[<>/\u2028\u2029]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

export function sanitizeGitRemoteUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      u.username = '';
      u.password = '';
      u.search = '';
      u.hash = '';
      return u.toString();
    }
  } catch {}
  return s.replace(/\/\/[^/\s:@]+:[^/\s@]+@/, '//');
}

function assertNotSymlinkSync(targetPath, label = 'path') {
  try {
    const st = fs.lstatSync(targetPath);
    if (st.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link ${label}: ${targetPath}`);
    }
    return st;
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export function writeFileAtomicSync(targetPath, content, { mode = 0o600 } = {}) {
  const resolvedTarget = path.resolve(targetPath);
  const dir = path.dirname(resolvedTarget);
  const dirStat = assertNotSymlinkSync(dir, 'target directory');
  if (dirStat && !dirStat.isDirectory()) {
    throw new Error(`Target parent is not a directory: ${dir}`);
  }
  assertNotSymlinkSync(resolvedTarget, 'target file');

  const base = path.basename(resolvedTarget);
  const tmpName = `.${base}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tmpPath = path.join(dir, tmpName);
  let fd = null;
  try {
    fd = fs.openSync(tmpPath, 'wx', mode);
    fs.writeFileSync(fd, content, 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
    try { fs.chmodSync(tmpPath, mode); } catch {}
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }

  try {
    assertNotSymlinkSync(dir, 'target directory');
    assertNotSymlinkSync(resolvedTarget, 'target file');
    let renamed = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.renameSync(tmpPath, resolvedTarget);
        renamed = true;
        break;
      } catch (err) {
        lastErr = err;
        if (process.platform !== 'win32' || !['EBUSY', 'EPERM', 'EACCES', 'EEXIST'].includes(err?.code)) {
          throw err;
        }
      }
    }
    if (!renamed) {
      // Windows 兼容回退：句柄短暂占用导致 renameSync 失败时先复核非符号链接再覆盖目标并清理临时文件
      if (process.platform === 'win32' && ['EBUSY', 'EPERM', 'EACCES', 'EEXIST'].includes(lastErr?.code)) {
        assertNotSymlinkSync(dir, 'target directory');
        assertNotSymlinkSync(resolvedTarget, 'target file');
        fs.copyFileSync(tmpPath, resolvedTarget);
        try { fs.unlinkSync(tmpPath); } catch {}
      } else {
        throw lastErr;
      }
    }
    assertNotSymlinkSync(resolvedTarget, 'target file');
    try { fs.chmodSync(resolvedTarget, mode); } catch {}
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

function isSafeRelativeSyncPath(rel) {
  if (typeof rel !== 'string') return false;
  const trimmed = rel.trim();
  if (!trimmed || trimmed.includes('\0') || path.isAbsolute(trimmed)) return false;
  const parts = trimmed.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return false;
  return !parts.some((p) => p === '.' || p === '..');
}

function isPathWithinRoot(rootPath, candidatePath, allowEqual = false) {
  const rel = path.relative(rootPath, candidatePath);
  if (rel === '') return allowEqual;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function hasSymlinkSegment(rootDir, targetPath) {
  const rel = path.relative(rootDir, targetPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return true;
  const parts = rel.split(path.sep).filter(Boolean);
  let cur = rootDir;
  for (const part of parts) {
    cur = path.join(cur, part);
    try {
      const st = fs.lstatSync(cur);
      if (st.isSymbolicLink()) return true;
    } catch (err) {
      if (err && err.code === 'ENOENT') break;
      return true;
    }
  }
  return false;
}

export function copyUpdatedRuntimeFromRepo(repoDir, pluginDir, syncFilesList) {
  if (!repoDir || !pluginDir) return 0;
  const repoRoot = path.resolve(repoDir);
  const pluginRoot = path.resolve(pluginDir);
  if (repoRoot.toLowerCase() === pluginRoot.toLowerCase()) return 0;

  let repoRootStat;
  try {
    repoRootStat = fs.lstatSync(repoRoot);
  } catch {
    return 0;
  }
  if (repoRootStat.isSymbolicLink() || !repoRootStat.isDirectory()) return 0;

  try {
    const pluginRootStat = fs.lstatSync(pluginRoot);
    if (pluginRootStat.isSymbolicLink() || !pluginRootStat.isDirectory()) return 0;
  } catch (err) {
    if (err && err.code !== 'ENOENT') return 0;
    fs.mkdirSync(pluginRoot, { recursive: true });
  }

  let realRepoRoot;
  let realPluginRoot;
  try {
    realRepoRoot = fs.realpathSync(repoRoot);
    realPluginRoot = fs.realpathSync(pluginRoot);
  } catch {
    return 0;
  }
  if (realRepoRoot.toLowerCase() === realPluginRoot.toLowerCase()) return 0;

  let resolvedFiles = null;
  const repoCdpPath = path.join(repoRoot, 'cdp.js');
  try {
    const cdpStat = fs.lstatSync(repoCdpPath);
    if (!cdpStat.isSymbolicLink() && cdpStat.isFile()) {
      const realCdp = fs.realpathSync(repoCdpPath);
      if (isPathWithinRoot(realRepoRoot, realCdp)) {
        const reqKey = require.resolve(repoCdpPath);
        delete require.cache[reqKey];
        const freshRepoCdp = require(repoCdpPath);
        if (Array.isArray(freshRepoCdp?.SYNC_ROOT_FILES) && freshRepoCdp.SYNC_ROOT_FILES.length > 0) {
          resolvedFiles = freshRepoCdp.SYNC_ROOT_FILES;
        }
      }
    }
  } catch {}

  const safeCopyFile = (rel) => {
    if (!isSafeRelativeSyncPath(rel)) return false;
    const src = path.resolve(repoRoot, rel);
    const dst = path.resolve(pluginRoot, rel);
    if (!isPathWithinRoot(repoRoot, src) || !isPathWithinRoot(pluginRoot, dst)) return false;
    if (hasSymlinkSegment(repoRoot, src)) return false;

    let srcStat;
    try {
      srcStat = fs.lstatSync(src);
    } catch {
      return false;
    }
    if (srcStat.isSymbolicLink() || !srcStat.isFile()) return false;
    try {
      const realSrc = fs.realpathSync(src);
      if (!isPathWithinRoot(realRepoRoot, realSrc)) return false;
    } catch {
      return false;
    }

    if (hasSymlinkSegment(pluginRoot, dst)) return false;
    try {
      const dstStat = fs.lstatSync(dst);
      if (dstStat.isSymbolicLink() || !dstStat.isFile()) return false;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') return false;
    }

    const dstParent = path.dirname(dst);
    fs.mkdirSync(dstParent, { recursive: true });
    if (hasSymlinkSegment(pluginRoot, dst)) return false;
    try {
      const realDstParent = fs.realpathSync(dstParent);
      if (!isPathWithinRoot(realPluginRoot, realDstParent, true)) return false;
      try {
        const dstStatAfter = fs.lstatSync(dst);
        if (dstStatAfter.isSymbolicLink() || !dstStatAfter.isFile()) return false;
      } catch (err) {
        if (!err || err.code !== 'ENOENT') return false;
      }
    } catch {
      return false;
    }

    fs.copyFileSync(src, dst);
    return true;
  };

  let synced = 0;
  const files =
    resolvedFiles ||
    (Array.isArray(syncFilesList) && syncFilesList.length > 0 ? syncFilesList : ['cdp.js', 'style.css', 'ui-runtime.js']);
  for (const rel of files) {
    if (safeCopyFile(rel)) synced += 1;
  }
  const syncSubDir = (sub) => {
    if (!isSafeRelativeSyncPath(sub)) return;
    const sDir = path.resolve(repoRoot, sub);
    const dDir = path.resolve(pluginRoot, sub);
    if (!isPathWithinRoot(repoRoot, sDir) || !isPathWithinRoot(pluginRoot, dDir)) return;
    if (hasSymlinkSegment(repoRoot, sDir)) return;

    let sDirStat;
    try {
      sDirStat = fs.lstatSync(sDir);
    } catch {
      return;
    }
    if (sDirStat.isSymbolicLink() || !sDirStat.isDirectory()) return;
    try {
      const realSDir = fs.realpathSync(sDir);
      if (!isPathWithinRoot(realRepoRoot, realSDir)) return;
    } catch {
      return;
    }

    if (hasSymlinkSegment(pluginRoot, dDir)) return;
    try {
      const dDirStat = fs.lstatSync(dDir);
      if (dDirStat.isSymbolicLink() || !dDirStat.isDirectory()) return;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') return;
    }
    fs.mkdirSync(dDir, { recursive: true });
    if (hasSymlinkSegment(pluginRoot, dDir)) return;
    try {
      const realDDir = fs.realpathSync(dDir);
      if (!isPathWithinRoot(realPluginRoot, realDDir)) return;
    } catch {
      return;
    }

    for (const ent of fs.readdirSync(sDir, { withFileTypes: true })) {
      if (ent.name === '__pycache__' || ent.name === '.DS_Store') continue;
      if (ent.isSymbolicLink()) continue;
      const childRel = path.join(sub, ent.name);
      const childSrc = path.join(sDir, ent.name);
      let childStat;
      try {
        childStat = fs.lstatSync(childSrc);
      } catch {
        continue;
      }
      if (childStat.isSymbolicLink()) continue;
      if (childStat.isDirectory()) syncSubDir(childRel);
      else if (childStat.isFile()) {
        if (safeCopyFile(childRel)) synced += 1;
      }
    }
  };
  syncSubDir('assets');
  syncSubDir('vendor');
  syncSubDir('sidecars');
  return synced;
}

export function resolvePortFileCandidates() {
  const candidates = [];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    candidates.push(path.join(appData, 'Antigravity', 'DevToolsActivePort'));
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort'));
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    candidates.push(path.join(xdg, 'Antigravity', 'DevToolsActivePort'));
  }
  return candidates;
}

export function discoverActivePort(overridePort = null, customPortFile = null) {
  if (overridePort && Number.isInteger(Number(overridePort)) && Number(overridePort) > 0) {
    return Number(overridePort);
  }
  if (process.env.AG_CDP_PORT) {
    const p = parseInt(process.env.AG_CDP_PORT, 10);
    if (Number.isInteger(p) && p > 0 && p <= 65535) return p;
  }
  const files = customPortFile ? [customPortFile] : resolvePortFileCandidates();
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (text.length > 2048) continue;
      const port = parseInt(text.split(/\r?\n/)[0].trim(), 10);
      if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
    } catch {}
  }
  return null;
}

export function isEligibleTarget(target) {
  return defaultCdp.isEligibleTarget(target);
}

export function isPluginEnabledInHostConfig(customConfigPath = null) {
  try {
    const cfgPath = customConfigPath || path.join(os.homedir(), '.gemini', 'config', 'config.json');
    if (!fs.existsSync(cfgPath)) return true;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
    if (raw?.plugins?.['obsidian-prism']?.enabled === false) return false;
    if (raw?.plugins?.['antigravity-prism']?.enabled === false && !raw?.plugins?.['obsidian-prism']) return false;
    return true;
  } catch {
    return true;
  }
}

function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    return Boolean(err && err.code === 'EPERM');
  }
}

function isAutomatedTestRuntime() {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.NODE_TEST_CONTEXT) return true;
  return Array.isArray(process.execArgv) && process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'));
}

function queryProcessCommandLineSync(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return null;
  try {
    if (process.platform === 'linux') {
      const raw = fs.readFileSync(`/proc/${n}/cmdline`);
      if (!raw || raw.length === 0) return '';
      return raw.toString('utf8').replace(/\0+/g, ' ').trim();
    }
    if (process.platform === 'win32') {
      const psScript = `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${n}' -ErrorAction SilentlyContinue).CommandLine`;
      const out = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psScript],
        { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      return String(out || '').trim();
    }
    const out = execFileSync('ps', ['-p', String(n), '-o', 'command='], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(out || '').trim();
  } catch {
    return null;
  }
}

export function isObsidianPrismDaemonCommandLine(commandLine) {
  const cmd = String(commandLine || '').replace(/\\/g, '/').trim().toLowerCase();
  if (!cmd) return false;
  if (/--type=/.test(cmd)) return false;
  const hasPrismBrand = /(?:obsidian-prism|antigravity-prism|agy-claude-style)/.test(cmd);
  const hasDaemonScript = /(?:sidecars\/daemon\/main\.mjs|\/daemon\/main\.mjs|\/watch\.js)\b/.test(cmd);
  if (hasPrismBrand && hasDaemonScript) return true;
  // 宿主以 sidecars/daemon 为工作目录拉起时，命令行为 node main.mjs 或 Antigravity --import=.../sidecar_sdk/register_loader.js main.mjs
  const hasRelativeMain = /(?:^|[\s"'=])main\.mjs(?:$|[\s"'])/.test(cmd);
  if (
    hasRelativeMain &&
    /(?:^|\s|\/)(?:node|nodejs)(?:\.exe)?(?:\s|"|'|$)|sidecar_sdk\/register_loader\.js\b/.test(cmd)
  ) {
    return true;
  }
  return false;
}

export class PrismDaemon {
  constructor({
    rootDir = DEFAULT_ROOT_DIR,
    gitRepoDir = null,
    overridePort = null,
    portFile = null,
    pollIntervalMs = 2200,
    enabledCheck = () => isPluginEnabledInHostConfig(),
    metricsProvider = null,
    thoughtService = null,
    omniExecHooks = null,
    sidebarService = null,
    relaunchHooks = null,
    daemonPidVerifier = null,
    noPortRelaunchThresholdMs = 8000,
    shortcutCheckIntervalMs = 300000,
    _testUpdateService = null,
    updateCheckInitialDelayMs = 45000,
    updateCheckIntervalMs = 6 * 60 * 60 * 1000,
    enableAutoUpdateTimer = true,
    silent = false,
  } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.gitRepoDir = gitRepoDir ? path.resolve(gitRepoDir) : null;
    this.overridePort = overridePort;
    this.portFile = portFile;
    this.pollIntervalMs = Math.max(200, Number(pollIntervalMs) || 2200);
    this.enabledCheck = enabledCheck;
    this.silent = Boolean(silent);
    this.cdp = require(path.join(this.rootDir, 'cdp.js'));
    this._loadedCdpVerifier = typeof this.cdp?.isExpectedDaemonProcess === 'function' ? this.cdp.isExpectedDaemonProcess : null;
    this._daemonPidVerifier = typeof daemonPidVerifier === 'function' ? daemonPidVerifier : null;
    this._cdpFileSig = this._readCdpFileSig();
    this._selfConfigWriteUntil = 0;
    this._configSeq = 0;
    this._broadcastRunning = false;
    this._broadcastPending = false;
    this._broadcastWaiters = [];
    this.sessions = new Map();
    this.ignoredTargets = new Map();
    this.browserSession = null;
    this.browserPort = null;
    this._discoverTimer = null;
    this._reloadTimer = null;
    this._managedTimers = new Set();
    this._pendingTick = false;
    this.running = false;
    this.busy = false;
    this.timer = null;
    this.fsw = null;
    this.injectExpr = '';
    this.omniExpr = '';
    this.sidebarExpr = '';
    this.codeHash = '';
    this.ownerToken = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.pidFile = path.join(this.rootDir, '.daemon.pid');
    this.logFile = path.join(this.rootDir, 'daemon.log');
    this._lazyStore = null;
    this._lazyUsage = null;
    this._lazyLsClient = null;
    this._backendSummariesCache = null;
    this._backendSummariesAt = 0;
    this._storageHealthCache = null;
    this._storageHealthAt = 0;
    this._lastTelemetryActivityAt = 0;
    this._telemetryInFlight = 0;
    this._customMetricsProvider = metricsProvider;
    this._lazyThoughtService = thoughtService;
    this.omniServer = null;
    this._omniServerPromise = null;
    this._omniExecHooks = omniExecHooks;
    this.sidebarService = sidebarService;
    this._sidebarServicePromise = null;
    this._sidebarStopped = false;
    this._relaunchHooks = relaunchHooks;
    this.noPortRelaunchThresholdMs = Math.max(50, Number(noPortRelaunchThresholdMs) || 8000);
    this.shortcutCheckIntervalMs = Math.max(1000, Number(shortcutCheckIntervalMs) || 300000);
    this._noPortSinceMs = 0;
    this._promptInFlight = false;
    this._lastShortcutCheckAt = 0;
    this._lastObservedHostPid = 0;
    this._enableAutoUpdateTimer = enableAutoUpdateTimer !== false;
    const initDelayNum = Number(updateCheckInitialDelayMs);
    this._updateCheckInitialDelayMs = Number.isFinite(initDelayNum) ? Math.max(0, initDelayNum) : 45000;
    const intervalNum = Number(updateCheckIntervalMs);
    this._updateCheckIntervalMs = Number.isFinite(intervalNum) ? Math.max(1000, intervalNum) : 6 * 60 * 60 * 1000;
    this._updateInitialTimer = null;
    this._updateIntervalTimer = null;
    this._lastUpdateState = null;
    this._updateCheckInFlight = null;
    this.updateService =
      _testUpdateService ||
      new UpdateService({
        currentVersion: this.cdp?.PLUGIN_VERSION || '1.0.5',
      });
  }

  log(msg) {
    if (!this.silent) {
      try {
        const fi = fs.existsSync(this.logFile) ? fs.statSync(this.logFile) : null;
        if (fi && fi.size > 512 * 1024) fs.writeFileSync(this.logFile, '', 'utf8');
        fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
      } catch {}
    }
  }

  resolveGitRepoDir() {
    const candidates = [];
    if (this.gitRepoDir) candidates.push(this.gitRepoDir);
    candidates.push(this.rootDir);

    const repoMetaPath = path.join(this.rootDir, 'repo-meta.json');
    if (fs.existsSync(repoMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(repoMetaPath, 'utf8'));
        if (meta && meta.sourceRepoDir) {
          const src = path.resolve(meta.sourceRepoDir);
          candidates.push(src);
          const parent = path.dirname(src);
          candidates.push(path.join(parent, 'obsidian-prism'));
        }
      } catch {}
    }

    for (const cand of candidates) {
      try {
        if (cand && fs.existsSync(path.join(cand, '.git'))) {
          return cand;
        }
      } catch {}
    }
    return null;
  }

  async _handleStorageAction(action, _testOverrides = null) {
    try {
      const modUrl = new URL('./conversation-archive.mjs', import.meta.url);
      const arch = await import(modUrl.href);
      const now = Number.isFinite(_testOverrides?.now) ? _testOverrides.now : Date.now();
      if (action === 'storage-health' && this._storageHealthCache && now - this._storageHealthAt < 300000) {
        return this._storageHealthCache;
      }
      const convDir = _testOverrides?.convDir || arch.getDefaultConversationsDir();
      const archiveDir = _testOverrides?.archiveDir || arch.getDefaultArchiveDir();
      let liveSummaries = null;
      const existingIdx = arch.loadCatalogIndex(archiveDir);
      const parsedUpdatedAt = existingIdx?.updatedAt ? Date.parse(existingIdx.updatedAt) : NaN;
      const idxAgeMs = Number.isFinite(parsedUpdatedAt) ? Math.max(0, now - parsedUpdatedAt) : Infinity;

      if (action === 'prepare-archive' || !existingIdx || idxAgeMs > 1800000) {
        // Reuse already-warm in-memory summaries first to avoid extra RPC traffic
        const warmReaderSums = this._lazyStore?.client?.reader?.summaries;
        if (action !== 'prepare-archive' && warmReaderSums && Object.keys(warmReaderSums).length > 0) {
          liveSummaries = warmReaderSums;
        } else {
          this._telemetryInFlight = (this._telemetryInFlight || 0) + 1;
          this._lastTelemetryActivityAt = Date.now();
          try {
            const client = await this.ensureLsClient();
            const raw = await client.call('GetAllCascadeTrajectories', { excludeSubtrajectories: false });
            if (raw?.trajectorySummaries && Object.keys(raw.trajectorySummaries).length > 0) {
              liveSummaries = raw.trajectorySummaries;
            }
          } catch {
          } finally {
            this._telemetryInFlight = Math.max(0, (this._telemetryInFlight || 1) - 1);
            this._lastTelemetryActivityAt = Date.now();
          }
        }
        if (liveSummaries) {
          try { arch.saveCatalogIndex(archiveDir, liveSummaries); } catch {}
        }
      }

      const scan = arch.scanConversationStorage({
        convDir,
        archiveDir,
        summaries: liveSummaries,
        subagentMaxAgeHours: action === 'prepare-archive' ? 1 : 6,
        now,
      });
      const base = {
        ok: true,
        action,
        totalMb: scan.totalMb,
        conversationCount: scan.conversationCount,
        mainCount: scan.mainCount,
        mainMb: scan.mainMb,
        subagentCount: scan.subagentCount,
        subagentMb: scan.subagentMb,
        archivableSubagentCount: scan.archivableSubagentCount,
        archivableSubagentMb: scan.archivableSubagentMb,
        warn: scan.warn,
        archiveDir: scan.archiveDir,
      };
      if (action === 'prepare-archive') {
        const scriptPath = path.join(this.rootDir, 'sidecars', 'daemon', 'conversation-archive.mjs');
        const helpers = arch.writeHelperScripts({ scriptPath, archiveDir });
        // Do not overwrite 6h storage-health cache with prepare-archive's 1h threshold view
        this._storageHealthCache = null;
        this._storageHealthAt = 0;
        return { ...base, ...helpers };
      }
      this._storageHealthCache = base;
      this._storageHealthAt = now;
      return base;
    } catch (err) {
      return { ok: false, action, error: sanitizeSecretText(err?.message || err) };
    }
  }

  async _handleUninstallAction(rawInput = {}) {
    if (rawInput?.confirm !== true) {
      return { ok: false, action: 'uninstall', error: 'confirmation_required' };
    }
    const purgeData = rawInput?.purgeData === true;
    const ov = rawInput?._testOverrides && typeof rawInput._testOverrides === 'object' ? rawInput._testOverrides : null;
    const platform = ov?.platform || process.platform;
    const lstatFn = typeof ov?.lstatSync === 'function' ? ov.lstatSync : fs.lstatSync;
    const spawnFn = typeof ov?.spawn === 'function' ? ov.spawn : spawn;

    let installerPath = null;
    if (ov && Object.prototype.hasOwnProperty.call(ov, 'installerPath')) {
      installerPath = ov.installerPath || null;
    } else if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      installerPath = path.join(localAppData, 'obsidian-prism', 'obsidian-prism-installer.exe');
    } else if (platform === 'darwin') {
      installerPath = path.join(os.homedir(), 'Library', 'Application Support', 'obsidian-prism', 'obsidian-prism-installer');
    }

    let engine = null;
    let spawnCmd = null;
    let spawnArgs = [];
    let spawnEnv = null;

    if (installerPath) {
      try {
        const lst = lstatFn(installerPath);
        if (lst && typeof lst.isSymbolicLink === 'function' && lst.isSymbolicLink()) {
          return { ok: false, action: 'uninstall', error: 'refused_symlink_installer' };
        }
        if (lst && typeof lst.isFile === 'function' && lst.isFile()) {
          engine = 'installer';
          spawnCmd = installerPath;
          spawnArgs = ['--uninstall', '--silent', ...(purgeData ? ['--purge-data'] : [])];
        }
      } catch (err) {
        if (err && err.code !== 'ENOENT') {
          return { ok: false, action: 'uninstall', error: sanitizeSecretText(err?.message || err) };
        }
      }
    }

    if (!spawnCmd) {
      engine = 'source-script';
      let scriptPath = null;
      if (ov && Object.prototype.hasOwnProperty.call(ov, 'installScriptPath')) {
        scriptPath = ov.installScriptPath || null;
      } else {
        const repoDir = this.resolveGitRepoDir();
        const candidates = [
          repoDir ? path.join(repoDir, 'tools', 'install-plugin.cjs') : null,
          path.join(this.rootDir, 'tools', 'install-plugin.cjs'),
        ].filter(Boolean);
        for (const cand of candidates) {
          try {
            const st = lstatFn(cand);
            if (st && !st.isSymbolicLink() && st.isFile()) {
              scriptPath = cand;
              break;
            }
          } catch {}
        }
      }

      const inlineRunner = scriptPath
        ? "setTimeout(async()=>{try{const m=require(process.env.AG_PRISM_UNINSTALL_SCRIPT);await m.uninstallPlugin({targetDir:process.env.AG_PRISM_UNINSTALL_TARGET,purgeData:process.env.AG_PRISM_PURGE_DATA==='1',cdpPort:Number(process.env.AG_PRISM_CDP_PORT)||undefined});}catch{}process.exit(0);},400);"
        : "setTimeout(()=>{try{const fs=require('fs'),path=require('path'),os=require('os');const t=process.env.AG_PRISM_UNINSTALL_TARGET;if(t){const r=path.resolve(t),h=path.resolve(os.homedir()),segs=r.split(/[\\\\/]+/).map(s=>s.toLowerCase()),rl=['conversations_archive','prism-knowledge-space','antigravity-spark'],prot=[path.parse(r).root,h,path.join(h,'.gemini'),path.join(h,'.gemini','config'),path.join(h,'.gemini','antigravity')].map(p=>p.toLowerCase());if(!prot.includes(r.toLowerCase())&&!rl.some(k=>segs.includes(k))&&fs.existsSync(r)&&!fs.lstatSync(r).isSymbolicLink())fs.rmSync(r,{recursive:true,force:true});}const cfgDir=path.join(os.homedir(),'.gemini','config'),cfg=path.join(cfgDir,'config.json');if(fs.existsSync(cfg)&&!fs.lstatSync(cfg).isSymbolicLink()){const d=JSON.parse(fs.readFileSync(cfg,'utf8'));if(d&&typeof d==='object'){if(d.plugins)delete d.plugins['obsidian-prism'];if(d.sidecars)delete d.sidecars['obsidian-prism/daemon'];const tmp=cfg+'.tmp.'+process.pid;fs.writeFileSync(tmp,JSON.stringify(d,null,2)+'\\n',{mode:0o600});fs.renameSync(tmp,cfg);}}}catch{}process.exit(0);},400);";
      spawnCmd = process.execPath;
      spawnArgs = ['-e', inlineRunner];
      spawnEnv = {
        ...process.env,
        AG_PRISM_UNINSTALL_TARGET: this.rootDir,
        AG_PRISM_PURGE_DATA: purgeData ? '1' : '0',
        ...(scriptPath ? { AG_PRISM_UNINSTALL_SCRIPT: scriptPath } : {}),
        ...(this.cdpPort ? { AG_PRISM_CDP_PORT: String(this.cdpPort) } : {}),
      };
    }

    const spawnOpts = {
      detached: true,
      cwd: os.tmpdir(),
      stdio: 'ignore',
      windowsHide: true,
      ...(spawnEnv ? { env: spawnEnv } : {}),
    };
    const child = spawnFn(spawnCmd, spawnArgs, spawnOpts);
    child?.unref?.();

    if (!ov?.skipStop) {
      const stopDelayMs = Number.isFinite(ov?.stopDelayMs) ? ov.stopDelayMs : 150;
      const stopFn = typeof ov?.stop === 'function' ? ov.stop : () => this.stop(!installerPath || engine !== 'installer');
      const exitFn = typeof ov?.exit === 'function' ? ov.exit : (code) => process.exit(code);
      const timer = setTimeout(() => {
        Promise.resolve(stopFn()).catch(() => {}).finally(() => exitFn(0));
      }, stopDelayMs);
      timer.unref?.();
    }

    return {
      ok: true,
      action: 'uninstall',
      scheduled: true,
      purgeData,
      engine,
    };
  }

  _getAutoUpdateSetting() {
    try {
      const cfg = typeof this.cdp?.readConfig === 'function' ? this.cdp.readConfig() : null;
      return cfg?.autoUpdate === 'on' ? 'on' : 'off';
    } catch {
      return 'off';
    }
  }

  async _inspectGitRepoState({ fetchRemote = false } = {}) {
    const repoDir = this.resolveGitRepoDir();
    if (!repoDir) {
      return {
        isGitRepo: false,
        repoDir: null,
        repoPath: path.basename(this.rootDir),
        branch: 'standalone',
        commit: this.cdp.PLUGIN_VERSION,
        dirty: false,
        remoteName: '',
        remoteUrl: '',
        hasRemote: false,
        noRemote: true,
        ahead: 0,
        behind: 0,
        netGitCfg: [],
        blockedUnc: false,
      };
    }

    let branch = 'HEAD';
    let commit = '';
    let dirty = false;
    let remoteName = '';
    let remoteUrl = '';

    try {
      branch = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir, 5000)) || 'HEAD';
    } catch {
      branch = 'main';
    }
    try {
      commit = await execGit(['rev-parse', '--short', 'HEAD'], repoDir, 5000);
    } catch {
      commit = 'uncommitted';
    }
    try {
      const porcelain = await execGit(['status', '--porcelain'], repoDir, 5000);
      dirty = Boolean(porcelain.trim());
    } catch {}

    let isNetworkRemote = false;
    let blockedUnc = false;
    try {
      const remotesRaw = await execGit(['remote'], repoDir, 4000);
      const remotes = remotesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (remotes.length > 0) {
        remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
        const rawRemoteUrl = await execGit(['remote', 'get-url', remoteName], repoDir, 4000).catch(() => '');
        if (rawRemoteUrl && isBlockedUncPath(rawRemoteUrl)) {
          blockedUnc = true;
        } else {
          isNetworkRemote = /^(?:https?|ssh|git):\/\/|^[^/\\:\s]+@[^/\\:\s]+:/i.test(rawRemoteUrl);
          remoteUrl = sanitizeGitRemoteUrl(rawRemoteUrl);
        }
      }
    } catch {}

    const netGitCfg = isNetworkRemote ? ['-c', 'protocol.file.allow=never'] : [];
    const safeRepoName = path.basename(repoDir);
    const hasRemote = Boolean(!blockedUnc && remoteName && remoteUrl);

    let ahead = 0;
    let behind = 0;
    if (hasRemote) {
      if (fetchRemote) {
        try {
          await execGit(['fetch', '--quiet', '--no-recurse-submodules', remoteName], repoDir, 8000, netGitCfg);
        } catch {}
      }
      try {
        const targetRef = branch && branch !== 'HEAD' ? `${remoteName}/${branch}` : '@{u}';
        const counts = await execGit(['rev-list', '--left-right', '--count', `HEAD...${targetRef}`], repoDir, 5000);
        const parts = counts.split(/\s+/).map((x) => parseInt(x, 10));
        if (Number.isInteger(parts[0])) ahead = parts[0];
        if (Number.isInteger(parts[1])) behind = parts[1];
      } catch {}
    }

    return {
      isGitRepo: true,
      repoDir,
      repoPath: safeRepoName,
      branch,
      commit,
      dirty,
      remoteName,
      remoteUrl,
      hasRemote,
      noRemote: !hasRemote,
      ahead,
      behind,
      netGitCfg,
      blockedUnc,
    };
  }

  async _executeGitPullHotReload(gitState, actionName = 'pull') {
    const { repoDir, repoPath, branch, commit: prevCommit, dirty, remoteName, remoteUrl, netGitCfg } = gitState;
    try {
      const prevFullSha = await execGit(['rev-parse', 'HEAD'], repoDir, 5000).catch(() => '');
      const pullArgs =
        branch && branch !== 'HEAD'
          ? ['pull', '--ff-only', '--no-recurse-submodules', remoteName, branch]
          : ['pull', '--ff-only', '--no-recurse-submodules'];
      const pullOut = await execGit(pullArgs, repoDir, 15000, netGitCfg);
      const nextCommit = await execGit(['rev-parse', '--short', 'HEAD'], repoDir, 5000).catch(() => prevCommit);
      const nextFullSha = await execGit(['rev-parse', 'HEAD'], repoDir, 5000).catch(() => prevFullSha);
      const updated = Boolean(nextCommit && nextCommit !== prevCommit);

      let changedFiles = [];
      if (prevFullSha && nextFullSha && prevFullSha !== nextFullSha) {
        try {
          const diffOut = await execGit(['diff', '--name-only', `${prevFullSha}..${nextFullSha}`], repoDir, 5000);
          changedFiles = diffOut.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        } catch {}
      }
      const needsHardReload = changedFiles.some((f) => /^(?:sidecars\/|installer\/|cdp\.js$)/.test(f));

      let hotReloaded = false;
      if (updated) {
        copyUpdatedRuntimeFromRepo(repoDir, this.rootDir, this.cdp.SYNC_ROOT_FILES);
      }
      this.rebuildBundle({ forceReloadCdp: updated });
      const activeItems = [...this.sessions.values()].filter((item) => item && !item.session.closed);
      if (activeItems.length > 0) {
        await Promise.allSettled(activeItems.map((item) => this.applyToEntry(item)));
        hotReloaded = true;
      }

      return {
        ok: true,
        action: actionName,
        isGitRepo: true,
        repoPath,
        branch,
        prevCommit,
        commit: nextCommit,
        shortHash: nextCommit,
        dirty,
        remoteName,
        remoteUrl,
        hasRemote: true,
        noRemote: false,
        ahead: 0,
        behind: 0,
        hasUpdates: false,
        upToDate: true,
        updated,
        hotReloaded,
        needsHardReload,
        needsHardReloadHint: needsHardReload,
        changedFiles,
        version: this.cdp.PLUGIN_VERSION,
        message: sanitizeSecretText(pullOut || (updated ? `Updated ${prevCommit} -> ${nextCommit}` : 'Already up to date')),
      };
    } catch (err) {
      const safeErr = sanitizeSecretText(err?.message || 'git pull --ff-only failed');
      return {
        ok: false,
        action: actionName,
        isGitRepo: true,
        repoPath,
        branch,
        commit: prevCommit,
        shortHash: prevCommit,
        dirty,
        remoteName,
        remoteUrl,
        hasRemote: true,
        noRemote: false,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        error: safeErr,
        message: safeErr,
      };
    }
  }

  _buildCombinedUpdateStatus({ relState = null, gitState = null, action = 'update-status' } = {}) {
    const currentVersion = this.cdp?.PLUGIN_VERSION || this.updateService?.currentVersion || '1.0.5';
    const rel = relState || this.updateService?.getStatus?.() || {};
    const autoUpdate = this._getAutoUpdateSetting();
    const isGitRemote = Boolean(gitState?.hasRemote);
    const gitHasUpdate = Boolean(isGitRemote && gitState.behind > 0);
    const relHasUpdate = Boolean(rel.hasUpdate);
    const hasUpdate = gitHasUpdate || relHasUpdate;
    const mode = isGitRemote ? 'git' : rel.mode || (process.platform === 'win32' ? 'installer' : 'manual');
    const hotReloadCapable = isGitRemote ? true : Boolean(rel.hotReloadCapable);
    const manualRequired = isGitRemote ? false : Boolean(rel.manualRequired);
    return {
      ok: true,
      action,
      currentVersion,
      latestVersion: rel.latestVersion || currentVersion,
      latestTag: rel.latestTag || null,
      hasUpdate,
      autoUpdate,
      mode,
      hotReloadCapable,
      manualRequired,
      releaseUrl: rel.releaseUrl || RELEASES_PAGE_URL,
      downloadUrl: rel.downloadUrl || null,
      checkedAt: rel.checkedAt || (isGitRemote ? Date.now() : null),
      applying: Boolean(this.updateService?.applying),
      lastError: rel.lastError || rel.error || null,
      isGitRepo: Boolean(gitState?.isGitRepo),
      hasRemote: isGitRemote,
      behind: Number(gitState?.behind || 0),
      branch: gitState?.branch || 'standalone',
      commit: gitState?.commit || currentVersion,
    };
  }

  async runUpdateCheck({ force = false, manual = false, allowAutoApply = false } = {}) {
    if (this._updateCheckInFlight) {
      return this._updateCheckInFlight;
    }
    const run = async () => {
      try {
        const gitState = await this._inspectGitRepoState({ fetchRemote: true });
        let relState = null;
        try {
          relState = await this.updateService.checkForUpdates({ force, manual });
        } catch (err) {
          relState = {
            ...(this.updateService?.getStatus?.() || {}),
            ok: false,
            lastError: String(err?.message || err || 'check_failed'),
          };
        }
        const combined = this._buildCombinedUpdateStatus({ relState, gitState, action: manual ? 'check-update' : 'update-status' });
        this._lastUpdateState = combined;

        if (allowAutoApply && this._getAutoUpdateSetting() === 'on' && combined.hasUpdate) {
          if (gitState.hasRemote && gitState.behind > 0) {
            const pullRes = await this._executeGitPullHotReload(gitState, 'apply-update');
            this._lastUpdateState = {
              ...combined,
              hasUpdate: false,
              behind: 0,
              commit: pullRes.commit || combined.commit,
              lastAutoApply: pullRes,
            };
          } else if (!gitState.hasRemote && relState?.hasUpdate) {
            const applyRes = await this.updateService.applyReleaseUpdate({ confirm: true, auto: true });
            this._lastUpdateState = {
              ...combined,
              lastError: applyRes.ok ? null : applyRes.error || combined.lastError,
              lastAutoApply: applyRes,
            };
          }
        }
        return this._lastUpdateState;
      } finally {
        this._updateCheckInFlight = null;
      }
    };
    this._updateCheckInFlight = run();
    return this._updateCheckInFlight;
  }

  async executeRepoAction(rawInput = {}) {
    if (rawInput?.action === 'storage-health' || rawInput?.action === 'prepare-archive') {
      return this._handleStorageAction(rawInput.action);
    }
    if (rawInput?.action === 'uninstall') {
      return this._handleUninstallAction(rawInput);
    }
    if (rawInput?.action === 'update-status') {
      const gitState = await this._inspectGitRepoState({ fetchRemote: false });
      const relState = this.updateService?.getStatus?.() || null;
      const state = this._lastUpdateState
        ? { ...this._lastUpdateState, action: 'update-status', autoUpdate: this._getAutoUpdateSetting(), applying: Boolean(this.updateService?.applying) }
        : this._buildCombinedUpdateStatus({ relState, gitState, action: 'update-status' });
      if (!state.checkedAt) {
        void this.runUpdateCheck({ force: false, manual: false, allowAutoApply: false }).catch(() => {});
      }
      return state;
    }
    if (rawInput?.action === 'check-update') {
      const res = await this.runUpdateCheck({
        force: rawInput?.force !== false,
        manual: Boolean(rawInput?.manual),
        allowAutoApply: false,
      });
      return { ...res, action: 'check-update' };
    }
    if (rawInput?.action === 'apply-update') {
      if (rawInput?.confirm !== true) {
        return { ok: false, action: 'apply-update', error: 'confirmation_required' };
      }
      const gitState = await this._inspectGitRepoState({ fetchRemote: false });
      if (gitState.blockedUnc) {
        return { ok: false, action: 'apply-update', error: 'Remote UNC Git paths are blocked' };
      }
      if (gitState.hasRemote) {
        const pullRes = await this._executeGitPullHotReload(gitState, 'apply-update');
        return {
          ...pullRes,
          mode: 'git',
          hotReloadCapable: true,
          targetVersion: pullRes.commit,
        };
      }
      const applyRes = await this.updateService.applyReleaseUpdate({ confirm: true, auto: false });
      return {
        ...applyRes,
        action: 'apply-update',
        currentVersion: this.cdp?.PLUGIN_VERSION || this.updateService?.currentVersion || '1.0.5',
      };
    }

    const action = rawInput?.action === 'pull' || rawInput?.action === 'sync' ? 'pull' : 'status';
    const gitState = await this._inspectGitRepoState({ fetchRemote: action === 'status' });
    if (!gitState.isGitRepo) {
      return {
        ok: true,
        action,
        isGitRepo: false,
        repoPath: path.basename(this.rootDir),
        branch: 'standalone',
        commit: this.cdp.PLUGIN_VERSION,
        shortHash: this.cdp.PLUGIN_VERSION,
        dirty: false,
        remoteUrl: '',
        hasRemote: false,
        noRemote: true,
        ahead: 0,
        behind: 0,
        hasUpdates: false,
        upToDate: true,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        message: 'Installed standalone plugin (no linked Git repository)',
      };
    }
    if (gitState.blockedUnc) {
      return {
        ok: false,
        action,
        isGitRepo: true,
        repoPath: gitState.repoPath,
        branch: gitState.branch,
        commit: gitState.commit,
        shortHash: gitState.commit,
        dirty: gitState.dirty,
        error: 'Remote UNC Git paths are blocked',
        message: 'Remote UNC Git paths are blocked',
      };
    }
    if (!gitState.hasRemote) {
      return {
        ok: true,
        action,
        isGitRepo: true,
        repoPath: gitState.repoPath,
        branch: gitState.branch,
        commit: gitState.commit,
        shortHash: gitState.commit,
        dirty: gitState.dirty,
        remoteName: '',
        remoteUrl: '',
        hasRemote: false,
        noRemote: true,
        ahead: 0,
        behind: 0,
        hasUpdates: false,
        upToDate: true,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        message: 'Local Git repository (no remote configured)',
      };
    }
    if (action === 'status') {
      return {
        ok: true,
        action: 'status',
        isGitRepo: true,
        repoPath: gitState.repoPath,
        branch: gitState.branch,
        commit: gitState.commit,
        shortHash: gitState.commit,
        dirty: gitState.dirty,
        remoteName: gitState.remoteName,
        remoteUrl: gitState.remoteUrl,
        hasRemote: true,
        noRemote: false,
        ahead: gitState.ahead,
        behind: gitState.behind,
        hasUpdates: gitState.behind > 0,
        upToDate: gitState.behind === 0,
        updated: false,
        version: this.cdp.PLUGIN_VERSION,
        message: gitState.behind > 0 ? `${gitState.behind} commit(s) available from ${gitState.remoteName}` : 'Already up to date',
      };
    }
    return this._executeGitPullHotReload(gitState, 'pull');
  }

  _readCdpFileSig() {
    try {
      const st = fs.statSync(path.join(this.rootDir, 'cdp.js'));
      return `${st.mtimeMs}:${st.size}`;
    } catch {
      return '';
    }
  }

  rebuildBundle({ forceReloadCdp = false } = {}) {
    const cdpPath = path.join(this.rootDir, 'cdp.js');
    const nextSig = this._readCdpFileSig();
    if (forceReloadCdp || !this.cdp || (nextSig && nextSig !== this._cdpFileSig)) {
      try {
        delete require.cache[require.resolve(cdpPath)];
      } catch {}
      this.cdp = require(cdpPath);
      this._loadedCdpVerifier = typeof this.cdp?.isExpectedDaemonProcess === 'function' ? this.cdp.isExpectedDaemonProcess : null;
      this._cdpFileSig = nextSig;
    }
    this.injectExpr = this.cdp.buildInjectExpression();
    const m = this.injectExpr.match(/"codeHash":"([^"]+)"/);
    this.codeHash = m ? m[1] : '';
    if (typeof this.cdp.buildOmniClientExpression === 'function') {
      const meta = this.omniServer && this.omniServer.running ? this.omniServer.getServerInfo() : null;
      this.omniExpr = this.cdp.buildOmniClientExpression(meta);
    } else {
      this.omniExpr = '';
    }
    const shouldBuildSidebar =
      typeof this.cdp.buildSidebarStudioExpression === 'function' &&
      (typeof this.cdp.readConfig !== 'function' || this._isSidebarStudioEnabled());
    if (shouldBuildSidebar) {
      this.sidebarExpr = this._buildSidebarExprForCurrentClient();
    } else {
      this.sidebarExpr = '';
    }
    const shouldBuildHostI18n =
      typeof this.cdp.buildHostI18nExpression === 'function' &&
      this._isHostI18nEnabled();
    if (shouldBuildHostI18n) {
      this.hostI18nExpr = this.cdp.buildHostI18nExpression();
    } else {
      this.hostI18nExpr = '';
    }
    return this.injectExpr;
  }

  _hasOmniClientFile() {
    try {
      return fs.existsSync(path.join(this.rootDir, 'vendor', 'omni-viewer', 'omni-client.js'));
    } catch {
      return false;
    }
  }

  _hasSafeV2SidebarClientFile() {
    try {
      const p = path.join(this.rootDir, 'vendor', 'sidebar-studio', 'sidebar-client.js');
      if (!fs.existsSync(p)) return false;
      const src = fs.readFileSync(p, 'utf8');
      if (typeof this.cdp?.isSafeV2SidebarClientSource === 'function') {
        return this.cdp.isSafeV2SidebarClientSource(src);
      }
      // 严禁挂载任何含旧版全局权限写入（setPrefValue/setPrefValues 任意形式）的客户端，仅放行 v2 零全局写渲染端
      if (!src.includes('SIDEBAR_STUDIO_CLIENT_V2')) return false;
      if (/setPrefValues?/i.test(src)) return false;
      return true;
    } catch {
      return false;
    }
  }

  _isSidebarStudioEnabled() {
    try {
      return this.cdp?.readConfig?.()?.sidebarStudio === 'on';
    } catch {
      return false;
    }
  }

  _isHostI18nEnabled(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.();
      if (typeof this.cdp?.shouldEnableHostI18n === 'function') {
        return Boolean(this.cdp.shouldEnableHostI18n(cfg));
      }
      return false;
    } catch {
      return false;
    }
  }

  _getHostI18nCfgSig(cfgOverride = null) {
    try {
      const cfg = cfgOverride || this.cdp?.readConfig?.() || {};
      return `${cfg.hostLocalization || 'auto'}:${cfg.language || cfg.lang || 'zh-CN'}`;
    } catch {
      return '';
    }
  }

  _getHostI18nCleanupExpression() {
    return (
      this.cdp?.HOST_I18N_REMOVE_EXPRESSION ||
      "(() => { try { window.__agPrismHostI18n?.destroy?.(); } catch {} return { ok: true, status: 'off' }; })()"
    );
  }

  _isTelemetryDisabled() {
    try {
      return this.cdp?.readConfig?.()?.telemetryModule === 'off';
    } catch {
      return false;
    }
  }

  _releaseIdleTelemetry(force = false) {
    if (!this._lazyStore && !this._lazyUsage && !this._lazyLsClient && !this._backendSummariesCache) {
      return false;
    }
    if ((this._telemetryInFlight || 0) > 0) {
      return false;
    }
    if (!force) {
      const idleMs = Date.now() - (this._lastTelemetryActivityAt || 0);
      if (idleMs < 120000) return false;
      if (
        this._lazyUsage?.syncing ||
        this._lazyUsage?.ledger?.diskWrites > 0 ||
        this._lazyUsage?.ledger?.diskSummaryPending ||
        this._lazyStore?.background?.active
      ) {
        return false;
      }
    }
    const storeClient = this._lazyStore?.client || null;
    const lsClient = this._lazyLsClient && this._lazyLsClient !== storeClient ? this._lazyLsClient : null;
    const targets = [this._lazyUsage, this._lazyStore, lsClient];
    this._lazyUsage = null;
    this._lazyStore = null;
    this._lazyLsClient = null;
    this._backendSummariesCache = null;
    this._backendSummariesAt = 0;
    for (const svc of targets) {
      if (!svc) continue;
      try {
        if (typeof svc.dispose === 'function') svc.dispose();
        else if (typeof svc.close === 'function') svc.close();
      } catch {}
    }
    return true;
  }

  _buildSidebarCleanupExpression(force = false) {
    const residueGuard = force
      ? ''
      : `const hasResidue = Boolean(
          window.__agPrismSidebar ||
          document.getElementById('ag-prism-sidebar-studio-css') ||
          document.querySelector('[data-ag-prism-sidebar-owned="1"], .ag-prism-sidebar-studio, .ag-prism-sidebar-rail, .ag-prism-sidebar-popover, .ag-prism-sidebar-modal')
        );
        if (!hasResidue) return { ok: true, status: 'clean' };`;
    return `(() => {
      try {
        ${residueGuard}
        if (document.documentElement) {
          document.documentElement.setAttribute('data-ag-prism-sidebar-studio', 'off');
        }
        try { window.__agPrismSidebar?.destroy?.({ preserveRuntimeState: false }); } catch {}
        try { delete window.__agPrismSidebar; } catch {}
        try { delete window.${SIDEBAR_BINDING}; } catch {}
        document.getElementById('ag-prism-sidebar-studio-css')?.remove();
        document.querySelectorAll('[data-ag-prism-sidebar-owned="1"], .ag-prism-sidebar-studio, .ag-prism-sidebar-rail, .ag-prism-sidebar-popover, .ag-prism-sidebar-modal').forEach((n) => n.remove());
        if (document.documentElement) {
          ['data-ag-prism-mode', 'data-ag-prism-chat-kind', 'data-ag-prism-chat-telemetry', 'data-ag-cs-space', 'data-ag-cs-space-palette', 'data-ag-cs-space-accent'].forEach((a) => document.documentElement.removeAttribute(a));
        }
        return { ok: true, status: 'cleaned' };
      } catch {}
      return { ok: true, status: 'disabled' };
    })()`;
  }

  _findCurrentMainDefaultContextId(entry) {
    if (!entry?.contextFrames || !entry.mainFrameId) return null;
    let found = null;
    for (const [id, meta] of entry.contextFrames.entries()) {
      if (
        meta &&
        meta.isDefault === true &&
        meta.type === 'default' &&
        meta.frameId === entry.mainFrameId &&
        (typeof meta.docGen !== 'number' || meta.docGen === entry.sidebarDocument)
      ) {
        found = id;
      }
    }
    return found;
  }

  _markSidebarHostVerified(entry, expectedDoc, ok) {
    if (!entry || expectedDoc !== entry.sidebarDocument) return;
    if (ok) {
      entry.sidebarHostVerified = true;
      entry.sidebarVerifiedDocument = expectedDoc;
      entry.sidebarHostContextId = this._findCurrentMainDefaultContextId(entry);
    } else {
      entry.sidebarHostVerified = false;
      entry.sidebarVerifiedDocument = -1;
      entry.sidebarHostContextId = null;
    }
  }

  _buildSidebarExprForCurrentClient() {
    if (typeof this.cdp.buildSidebarStudioExpression !== 'function') return '';
    const meta = this._getSidebarServerMeta();
    return this._hasSafeV2SidebarClientFile()
      ? this.cdp.buildSidebarStudioExpression(meta)
      : this.cdp.buildSidebarStudioExpression(meta, '');
  }

  _pickActiveSidebarHostEntry() {
    for (const entry of this.sessions.values()) {
      if (entry && !entry.session?.closed && entry.sidebarHostVerified === true) {
        return entry;
      }
    }
    return null;
  }

  _getSidebarServerMeta() {
    return {
      binding: SIDEBAR_BINDING,
      version: this.cdp?.PLUGIN_VERSION || '1.0.5',
      schemaVersion: 2,
      serviceReady: !this._sidebarStopped && typeof this.sidebarService?.handleRpc === 'function' &&
        !this.sidebarService.getBootDiagnostic?.(),
    };
  }

  async _ensureSidebarBinding(entry, timeoutMs = 2600, force = false) {
    if (!entry || entry.session.closed) return false;
    if (!force && entry.sidebarBindingAdded) return true;
    const ok = await entry.session
      .send('Runtime.addBinding', { name: SIDEBAR_BINDING }, timeoutMs)
      .then(() => true)
      .catch(() => false);
    if (ok) entry.sidebarBindingAdded = true;
    return ok;
  }

  async _removeSidebarBinding(entry, timeoutMs = 2000) {
    if (!entry || entry.session.closed) return;
    if (!entry.sidebarBindingAdded) return;
    await entry.session
      .send('Runtime.removeBinding', { name: SIDEBAR_BINDING }, timeoutMs)
      .catch(() => {});
    entry.sidebarBindingAdded = false;
  }

  async ensureSidebarService() {
    if (this._sidebarStopped) return null;
    if (this.sidebarService) return this.sidebarService;
    if (this._sidebarServicePromise) return this._sidebarServicePromise;
    this._sidebarServicePromise = (async () => {
      const svcPath = path.join(this.rootDir, 'vendor', 'sidebar-studio', 'sidebar-service.mjs');
      if (!fs.existsSync(svcPath)) {
        return null;
      }
      const mod = await import(pathToFileURL(svcPath).href);
      const Ctor = mod?.SidebarStudioService || mod?.default;
      if (this._sidebarStopped || typeof Ctor !== 'function') return null;

      let hostAdapter = null;
      const adapterPath = path.join(this.rootDir, 'vendor', 'sidebar-studio', 'live-host-adapter.mjs');
      if (fs.existsSync(adapterPath)) {
        try {
          const adapterMod = await import(pathToFileURL(adapterPath).href);
          if (typeof adapterMod?.createLiveHostAdapter === 'function') {
            hostAdapter = adapterMod.createLiveHostAdapter({
              logger: (m) => this.log(m),
              evaluateInHost: async (expr, timeoutMs = 4500) => {
                const entry = this._pickActiveSidebarHostEntry();
                if (!entry || entry.session.closed) {
                  return { ok: false, error: 'no-verified-host-window' };
                }
                return entry.session.evaluate(expr, true, timeoutMs);
              },
            });
          }
        } catch {}
      }

      const svc = new Ctor({ logger: (m) => this.log(m), hostAdapter });
      this.sidebarService = svc;
      if (typeof this.cdp.buildSidebarStudioExpression === 'function') {
        this.sidebarExpr = this._buildSidebarExprForCurrentClient();
      }
      return svc;
    })();
    try {
      return await this._sidebarServicePromise;
    } finally {
      this._sidebarServicePromise = null;
    }
  }

  async ensureOmniServer() {
    if (this.omniServer && this.omniServer.running) return this.omniServer;
    if (this._omniServerPromise) return this._omniServerPromise;
    this._omniServerPromise = (async () => {
      const srv = new OmniServer({
        rootDir: this.rootDir,
        execHooks: this._omniExecHooks,
      });
      await srv.start();
      this.omniServer = srv;
      if (typeof this.cdp.buildOmniClientExpression === 'function') {
        this.omniExpr = this.cdp.buildOmniClientExpression(srv.getServerInfo());
      }
      return srv;
    })();
    try {
      return await this._omniServerPromise;
    } finally {
      this._omniServerPromise = null;
    }
  }

  resolveTelemetryDataDir() {
    if (this._telemetryDataDir) return this._telemetryDataDir;
    const dir = path.join(os.homedir(), '.gemini', 'antigravity', 'sidecar_data', 'obsidian-prism', 'telemetry');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    this._telemetryDataDir = dir;
    return dir;
  }

  syncClientCdpPort(clientOrStore) {
    if (!clientOrStore) return null;
    const activePort = discoverActivePort(this.overridePort, this.portFile);
    if (activePort) {
      if (typeof clientOrStore.setCdpPort === 'function') {
        clientOrStore.setCdpPort(activePort);
      } else {
        clientOrStore.cdpPort = activePort;
        if (clientOrStore.client) clientOrStore.client.cdpPort = activePort;
      }
    }
    return activePort;
  }

  async _ensureLazyDesktopUsage() {
    if (this._lazyUsage || !this._lazyStore) return this._lazyUsage;
    const telemetryDataDir = this.resolveTelemetryDataDir();
    const usageModUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/usage.mjs', import.meta.url);
    const { DesktopUsage } = await import(usageModUrl.href);
    this._lazyUsage = new DesktopUsage(this._lazyStore, { dataDir: telemetryDataDir });
    this._lazyStore.onTrajectory = (scope, id, raw, options) =>
      typeof this._lazyUsage.ingestLive === 'function'
        ? this._lazyUsage.ingestLive(scope, id, raw, options)
        : this._lazyUsage.ingest(scope, id, raw);
    this._lazyStore.onBackgroundResult = (scope, id, jobDb, options) =>
      typeof this._lazyUsage.ingestDisk === 'function'
        ? this._lazyUsage.ingestDisk(scope, id, jobDb, options)
        : undefined;
    return this._lazyUsage;
  }

  _getRendererRpcCandidates() {
    const out = [];
    for (const entry of this.sessions.values()) {
      if (!entry || !entry.session || entry.session.closed) continue;
      const url = String(entry.url || '');
      if (/^(?:devtools|chrome-extension|chrome|about):/i.test(url)) continue;
      const isLocalHost = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(url);
      out.push({ entry, score: (isLocalHost ? 2 : 0) + (entry.healthyStreak > 0 ? 1 : 0) });
    }
    out.sort((a, b) => b.score - a.score);
    return out.map((x) => x.entry);
  }

  async _invokeRendererLsRpc(method, body = {}) {
    const candidates = this._getRendererRpcCandidates();
    if (!candidates.length) {
      throw new Error('等待 Antigravity 主窗口连接');
    }
    const expr = buildRendererRpcExpression(method, body);
    const timeoutMs = method === 'Probe' ? 2600 : 12000;
    let lastErr = null;
    for (const entry of candidates) {
      try {
        const res = await entry.session.evaluate(expr, true, timeoutMs);
        if (!res || res.ok !== true) {
          lastErr = new Error(String(res?.error || 'renderer_ls_unavailable'));
          continue;
        }
        const raw = res.data;
        if (method === 'Probe') return raw;
        if (method === 'GetUserStatus') {
          const normalized = normalizeRendererUserStatus(raw);
          const labels = extractModelLabelMap(normalized);
          if (labels.size > 0) {
            if (!this._rendererModelLabels) this._rendererModelLabels = new Map();
            for (const [k, v] of labels.entries()) {
              if (this._rendererModelLabels.size >= 256 && !this._rendererModelLabels.has(k)) break;
              this._rendererModelLabels.set(k, v);
            }
          }
          return normalized;
        }
        if (method === 'RetrieveUserQuotaSummary') {
          return normalizeRendererQuotaSummary(raw);
        }
        if (method === 'GetAllCascadeTrajectories') {
          return normalizeRendererSummaries(raw);
        }
        if (method === 'GetCascadeTrajectory') {
          return normalizeRendererTrajectory(raw, body?.cascadeId, this._rendererModelLabels || null);
        }
        return raw;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Antigravity 渲染器遥测通道暂不可用');
  }

  async ensureMetricsCollector() {
    if (this._customMetricsProvider) return this._customMetricsProvider;
    if (this._lazyStore) {
      return async (input) => {
        this.syncClientCdpPort(this._lazyStore);
        const safeId = input?.conversationId && GUID_RE.test(input.conversationId) ? input.conversationId : null;
        const base = await this._lazyStore.snapshot({ conversationId: safeId, force: Boolean(input?.force) });
        let usageSnap = null;
        if (input?.includeUsage === true) {
          if (!this._lazyUsage) {
            await this._ensureLazyDesktopUsage().catch(() => null);
          }
          if (this._lazyUsage) {
            if (input?.force) void this._lazyUsage.sync(true);
            usageSnap = await this._lazyUsage
              .snapshot({ groups: Array.isArray(base?.groups) ? base.groups : null })
              .catch(() => null);
          }
        }
        return { ...base, usage: usageSnap };
      };
    }
    const telemetryDataDir = this.resolveTelemetryDataDir();
    const activePort = discoverActivePort(this.overridePort, this.portFile);
    const storeModUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/store.mjs', import.meta.url);
    const { MetricsStore } = await import(storeModUrl.href);
    this._lazyStore = new MetricsStore({
      dataDir: telemetryDataDir,
      rendererRpc: (m, b) => this._invokeRendererLsRpc(m, b),
      ...(activePort ? { cdpPort: activePort } : {}),
    });
    return this.ensureMetricsCollector();
  }

  async ensureThoughtService() {
    if (this._lazyThoughtService) return this._lazyThoughtService;
    const modUrl = new URL('../../vendor/thought-translator/translator-service.mjs', import.meta.url);
    const { ThoughtTranslatorService } = await import(modUrl.href);
    this._lazyThoughtService = new ThoughtTranslatorService();
    return this._lazyThoughtService;
  }

  async ensureLsClient() {
    if (this._lazyLsClient) {
      this.syncClientCdpPort(this._lazyLsClient);
      return this._lazyLsClient;
    }
    if (this._lazyStore && this._lazyStore.client) {
      this._lazyLsClient = this._lazyStore.client;
      this.syncClientCdpPort(this._lazyLsClient);
      return this._lazyLsClient;
    }
    const activePort = discoverActivePort(this.overridePort, this.portFile);
    const clientModUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/client.mjs', import.meta.url);
    const { AntigravityClient } = await import(clientModUrl.href);
    this._lazyLsClient = new AntigravityClient({
      rendererRpc: (m, b) => this._invokeRendererLsRpc(m, b),
      ...(activePort ? { cdpPort: activePort } : {}),
    });
    return this._lazyLsClient;
  }

  async _fetchFullGeneratorMetadata(client, id) {
    if (typeof client._fetchMetadataOnly === 'function') {
      return await client._fetchMetadataOnly(id);
    }
    const allItems = [];
    let curOffset = 0;
    let totalGm = null;
    let totalSteps = 0;
    while (true) {
      const page = await client.call('GetCascadeTrajectoryGeneratorMetadata', {
        cascadeId: id,
        generatorMetadataOffset: curOffset,
        includeMessages: false,
      });
      const chunk = page?.generatorMetadata || page?.generatorMetadatas || [];
      if (page?.numTotalGeneratorMetadata !== undefined && page?.numTotalGeneratorMetadata !== null) {
        totalGm = Number(page.numTotalGeneratorMetadata);
      }
      if (page?.numTotalSteps !== undefined && page?.numTotalSteps !== null) {
        totalSteps = Math.max(totalSteps, Number(page.numTotalSteps) || 0);
      }
      if (!chunk.length) break;
      allItems.push(...chunk);
      curOffset += chunk.length;
      if (totalGm !== null && curOffset >= totalGm) break;
    }
    return {
      numTotalSteps: totalSteps,
      numTotalGeneratorMetadata: totalGm !== null ? totalGm : allItems.length,
      trajectory: {
        cascadeId: id,
        steps: [],
        generatorMetadata: allItems,
      },
    };
  }

  async _fetchBackendTrajectorySummaries(client, usageCore, force = false) {
    const now = Date.now();
    if (!force && this._backendSummariesCache && now - this._backendSummariesAt < 15000) {
      return this._backendSummariesCache;
    }
    try {
      const raw = await client.call('GetAllCascadeTrajectories', {});
      const mapOrList = raw?.trajectorySummaries || {};
      const entries = Array.isArray(mapOrList)
        ? mapOrList.map((sum) => [sum?.cascadeId || sum?.id || '', sum])
        : Object.entries(mapOrList);
      const list = [];
      const byId = new Map();
      const toSec = (v) => {
        if (!v) return 0;
        if (typeof usageCore?.tsSec === 'function') {
          const n = Number(usageCore.tsSec(v) || 0);
          if (n > 0) return Math.floor(n);
        }
        if (typeof v === 'object' && v.seconds !== undefined) return Math.max(0, Math.floor(Number(v.seconds) || 0));
        if (typeof v === 'string') {
          const ms = Date.parse(v);
          if (Number.isFinite(ms) && ms > 0) return Math.floor(ms / 1000);
        }
        return 0;
      };
      const extractWs = (sum) => {
        const wsArr = sum?.workspaces || sum?.trajectoryMetadata?.workspaces;
        const out = [];
        if (Array.isArray(wsArr)) {
          for (const w of wsArr) {
            const uri = String(
              w?.workspaceFolderAbsoluteUri || w?.gitRootAbsoluteUri || w?.uri || w?.path || ''
            ).trim();
            if (uri) out.push(uri);
          }
        }
        const single = String(sum?.workspaceUri || sum?.workspacePath || sum?.trajectoryMetadata?.workspaceUri || '').trim();
        if (single && !out.includes(single)) out.push(single);
        let workspace = '';
        if (out.length > 0) {
          try {
            const decoded = decodeURIComponent(out[0].replace(/^file:\/\//i, '')).replace(/[\\/]+$/, '');
            workspace = decoded.split(/[\\/]/).filter(Boolean).pop() || '';
          } catch {
            workspace = out[0].replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || '';
          }
        }
        return { workspace, workspaces: out };
      };

      for (const [rawId, sum] of entries) {
        const id = String(rawId || sum?.cascadeId || sum?.id || '').trim();
        if (!GUID_RE.test(id) || !sum || typeof sum !== 'object') continue;
        const meta = sum.trajectoryMetadata && typeof sum.trajectoryMetadata === 'object' ? sum.trajectoryMetadata : {};
        const parentId = String(
          sum.parentConversationId ||
            meta.parentConversationId ||
            sum.parentCascadeId ||
            sum.parentTrajectoryId ||
            meta.parentCascadeId ||
            meta.parentTrajectoryId ||
            ''
        ).trim();
        const rootId = String(
          sum.rootConversationId || meta.rootConversationId || sum.rootCascadeId || meta.rootCascadeId || ''
        ).trim();
        const subagent = Boolean(
          (typeof usageCore?.isSubagentSummary === 'function' && usageCore.isSubagentSummary(sum)) ||
            parentId ||
            Number(meta.nestingDepth || sum.nestingDepth || 0) > 0 ||
            sum.isSubagent ||
            meta.isSubagent ||
            meta.subagentName
        );
        const stepCount = Math.max(0, Number(sum.stepCount ?? sum.numTotalSteps ?? 0) || 0);
        const lastModifiedSec = toSec(sum.lastModifiedTime || sum.modifiedAt || sum.updatedAt);
        const createdSec = toSec(sum.createdTime || sum.createdAt) || lastModifiedSec;
        const { workspace, workspaces } = extractWs(sum);
        const item = {
          id,
          stepCount,
          lastModifiedSec,
          createdSec,
          subagent,
          ...(parentId ? { parentId } : {}),
          ...(rootId ? { rootId } : {}),
          ...(workspace ? { workspace } : {}),
          ...(workspaces.length ? { workspaces } : {}),
          title: String(sum.summary || sum.title || '').slice(0, 140),
          status: String(sum.status || ''),
        };
        list.push(item);
        byId.set(id.toLowerCase(), item);
      }
      if (client?.server?.mode === 'renderer-proxy') {
        const subMap = this._discoveredSubagents || null;
        try {
          const localRes = await discoverLocalConversations({ host: 'app' });
          const convRoot = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');
          const convRootStat = await fs.promises.lstat(convRoot).catch(() => null);
          const rootSafe = Boolean(convRootStat && !convRootStat.isSymbolicLink() && convRootStat.isDirectory());
          for (const entry of localRes?.conversations || []) {
            const lid = String(entry?.id || '').toLowerCase();
            if (!GUID_RE.test(lid) || byId.has(lid)) continue;
            let mtimeSec = 0;
            if (rootSafe) {
              const dbFile = path.join(convRoot, `${lid}.db`);
              const st = await fs.promises.lstat(dbFile).catch(() => null);
              if (st && !st.isSymbolicLink() && st.isFile() && Number.isFinite(st.mtimeMs) && st.mtimeMs > 0) {
                mtimeSec = Math.floor(st.mtimeMs / 1000);
              }
            }
            const knownSub = subMap?.get(lid) || null;
            const localItem = {
              id: lid,
              stepCount: 0,
              lastModifiedSec: mtimeSec,
              createdSec: mtimeSec,
              subagent: Boolean(knownSub),
              ...(knownSub?.parentId ? { parentId: knownSub.parentId } : {}),
              ...(knownSub?.workspace ? { workspace: knownSub.workspace } : {}),
              title: '',
              status: '',
            };
            list.push(localItem);
            byId.set(lid, localItem);
          }
        } catch {}
        if (subMap && subMap.size > 0) {
          for (const item of list) {
            const info = subMap.get(item.id.toLowerCase());
            if (!info) continue;
            if (!item.subagent) item.subagent = true;
            if (!item.parentId && info.parentId) item.parentId = info.parentId;
            if (!item.workspace && info.workspace) item.workspace = info.workspace;
          }
        }
        list.sort((a, b) => (b.lastModifiedSec || 0) - (a.lastModifiedSec || 0));
      }
      const pack = { list, byId };
      this._backendSummariesCache = pack;
      this._backendSummariesAt = now;
      return pack;
    } catch {
      return { list: [], byId: new Map() };
    }
  }

  _recordDiscoveredSubagents(parentId, traj, parentWorkspace = '') {
    const steps = traj?.trajectory?.steps;
    if (!Array.isArray(steps) || !GUID_RE.test(String(parentId || ''))) return;
    const pid = String(parentId).toLowerCase();
    if (!this._discoveredSubagents) this._discoveredSubagents = new Map();
    const register = (rawChildId) => {
      const cid = String(rawChildId || '').toLowerCase();
      if (!GUID_RE.test(cid) || cid === pid) return;
      this._discoveredSubagents.delete(cid);
      this._discoveredSubagents.set(cid, { parentId: pid, workspace: String(parentWorkspace || '') });
      while (this._discoveredSubagents.size > 512) {
        this._discoveredSubagents.delete(this._discoveredSubagents.keys().next().value);
      }
    };
    for (const s of steps) {
      const inv = s?.invokeSubagent;
      if (!inv || typeof inv !== 'object') continue;
      register(inv.conversationId);
      if (Array.isArray(inv.results)) {
        for (const r of inv.results) register(r?.conversationId);
      }
    }
  }

  async fetchUsageRollupBatch(rawItems, opts = {}) {
    const usageCore = require(path.join(this.rootDir, 'usage-core.js'));
    const client = await this.ensureLsClient();
    const action = opts?.action || 'fetch-batch';
    const wantSummaries = action === 'list-summaries' || Boolean(opts?.includeSummaries);
    const backendPack = await this._fetchBackendTrajectorySummaries(client, usageCore, action === 'list-summaries');

    if (action === 'list-summaries') {
      return { ok: true, records: [], summaries: backendPack.list };
    }

    const list = Array.isArray(rawItems) ? rawItems.slice(0, 16) : [];
    if (list.length === 0) {
      return wantSummaries ? { ok: true, records: [], summaries: backendPack.list } : { ok: true, records: [] };
    }

    const records = [];
    for (const item of list) {
      const id = String(item?.id || '');
      if (!GUID_RE.test(id)) continue;
      const backendSum = backendPack.byId.get(id.toLowerCase()) || null;
      const stepCount = Math.max(0, Number(item.stepCount || backendSum?.stepCount || 0));
      const lastModifiedSec = Math.max(0, Number(item.lastModifiedSec || backendSum?.lastModifiedSec || 0));
      const createdSec = Math.max(0, Number(item.createdSec || backendSum?.createdSec || lastModifiedSec || 0));
      const subagent = Boolean(item.subagent || backendSum?.subagent);
      const parentId = String(item.parentId || backendSum?.parentId || '').trim();
      const rootId = String(item.rootId || backendSum?.rootId || '').trim();
      const workspace = String(item.workspace || backendSum?.workspace || '');
      const workspaces = Array.isArray(item.workspaces) && item.workspaces.length
        ? item.workspaces
        : backendSum?.workspaces || [];
      const gmOffset = Math.max(0, Math.floor(Number(item.gmOffset || 0)));
      const wsMeta = workspaces.map((uri) => ({ workspaceFolderAbsoluteUri: uri }));
      const summaryStub = {
        stepCount,
        lastModifiedTime: lastModifiedSec > 0 ? { seconds: lastModifiedSec } : undefined,
        createdTime: createdSec > 0 ? { seconds: createdSec } : undefined,
        ...(parentId ? { parentConversationId: parentId, parentId } : {}),
        ...(rootId ? { rootConversationId: rootId, rootId } : {}),
        ...(wsMeta.length ? { workspaces: wsMeta } : {}),
        trajectoryMetadata: {
          ...(subagent ? { nestingDepth: 1 } : {}),
          ...(parentId ? { parentConversationId: parentId } : {}),
          ...(rootId ? { rootConversationId: rootId } : {}),
          ...(wsMeta.length ? { workspaces: wsMeta } : {}),
        },
      };
      try {
        if (client?.server?.mode === 'renderer-proxy' && typeof client.trajectory === 'function') {
          const fullTraj = await client.trajectory(id, { force: false, summary: summaryStub });
          this._recordDiscoveredSubagents(id, fullTraj, workspace);
          const allSteps = Array.isArray(fullTraj?.trajectory?.steps) ? fullTraj.trajectory.steps : [];
          const allGms = Array.isArray(fullTraj?.trajectory?.generatorMetadata) ? fullTraj.trajectory.generatorMetadata : [];
          const realStepCount = Math.max(stepCount, Number(fullTraj?.numTotalSteps || 0), allSteps.length);
          const totalGm = Math.max(Number(fullTraj?.numTotalGeneratorMetadata || 0), allGms.length);
          const firstStepTs = allSteps.find((s) => s?.metadata?.createdAt)?.metadata?.createdAt;
          const lastStepTs = [...allSteps].reverse().find((s) => s?.metadata?.completedAt || s?.metadata?.createdAt);
          const realLastModSec =
            lastModifiedSec ||
            (lastStepTs ? Math.floor((Date.parse(lastStepTs.metadata.completedAt || lastStepTs.metadata.createdAt) || 0) / 1000) : 0);
          const realCreatedSec =
            (firstStepTs ? Math.floor((Date.parse(firstStepTs) || 0) / 1000) : 0) || createdSec || realLastModSec;
          const enrichedStub = {
            ...summaryStub,
            stepCount: realStepCount,
            ...(realLastModSec > 0 ? { lastModifiedTime: { seconds: realLastModSec } } : {}),
            ...(realCreatedSec > 0 ? { createdTime: { seconds: realCreatedSec } } : {}),
          };
          if (gmOffset > 0 && totalGm >= gmOffset) {
            const deltaItems = allGms.slice(gmOffset);
            const deltaRec = usageCore.analyzeTrajectoryForUsage(
              {
                numTotalSteps: realStepCount,
                numTotalGeneratorMetadata: totalGm,
                trajectory: { cascadeId: id, steps: allSteps, generatorMetadata: deltaItems },
              },
              enrichedStub,
              id
            );
            if (workspace && deltaRec && typeof deltaRec === 'object' && !deltaRec.workspace) deltaRec.workspace = workspace;
            if (parentId && deltaRec && typeof deltaRec === 'object' && !deltaRec.parentId) deltaRec.parentId = parentId;
            records.push({
              id,
              mode: 'delta',
              gmCount: totalGm,
              stepCount: realStepCount,
              lastModifiedSec: realLastModSec,
              subagent,
              ...(parentId ? { parentId } : {}),
              ...(workspace ? { workspace } : {}),
              delta: deltaRec,
            });
          } else {
            const fullRec = usageCore.analyzeTrajectoryForUsage(fullTraj, enrichedStub, id);
            if (workspace && fullRec && typeof fullRec === 'object' && !fullRec.workspace) fullRec.workspace = workspace;
            if (parentId && fullRec && typeof fullRec === 'object' && !fullRec.parentId) fullRec.parentId = parentId;
            records.push({
              id,
              mode: 'full',
              subagent,
              ...(parentId ? { parentId } : {}),
              ...(workspace ? { workspace } : {}),
              record: fullRec,
            });
          }
        } else if (gmOffset > 0) {
          const deltaItems = [];
          let curOffset = gmOffset;
          let totalGm = null;
          while (true) {
            const page = await client.call('GetCascadeTrajectoryGeneratorMetadata', {
              cascadeId: id,
              generatorMetadataOffset: curOffset,
              includeMessages: false,
            });
            const chunk = page?.generatorMetadata || page?.generatorMetadatas || [];
            if (page?.numTotalGeneratorMetadata !== undefined && page?.numTotalGeneratorMetadata !== null) {
              totalGm = Number(page.numTotalGeneratorMetadata);
            }
            if (!chunk.length) break;
            deltaItems.push(...chunk);
            curOffset += chunk.length;
            if (totalGm !== null && curOffset >= totalGm) break;
          }
          if (totalGm !== null && totalGm < gmOffset) {
            // Rewound/reverted conversation: rebuild cleanly from offset 0
            const fullMeta = await this._fetchFullGeneratorMetadata(client, id);
            const fullRec = usageCore.analyzeTrajectoryForUsage(fullMeta, summaryStub, id);
            if (workspace && fullRec && typeof fullRec === 'object' && !fullRec.workspace) fullRec.workspace = workspace;
            if (parentId && fullRec && typeof fullRec === 'object' && !fullRec.parentId) fullRec.parentId = parentId;
            records.push({
              id,
              mode: 'full',
              subagent,
              ...(parentId ? { parentId } : {}),
              ...(workspace ? { workspace } : {}),
              record: fullRec,
            });
          } else {
            const nextGmCount = totalGm !== null ? Math.max(gmOffset + deltaItems.length, totalGm) : gmOffset + deltaItems.length;
            const deltaSummary = {
              stepCount,
              lastModifiedTime: lastModifiedSec > 0 ? { seconds: lastModifiedSec } : { seconds: Math.floor(Date.now() / 1000) },
              createdTime: lastModifiedSec > 0 ? { seconds: lastModifiedSec } : undefined,
              ...(parentId ? { parentConversationId: parentId, parentId } : {}),
              ...(rootId ? { rootConversationId: rootId, rootId } : {}),
              ...(wsMeta.length ? { workspaces: wsMeta } : {}),
              trajectoryMetadata: {
                ...(subagent ? { nestingDepth: 1 } : {}),
                ...(parentId ? { parentConversationId: parentId } : {}),
                ...(rootId ? { rootConversationId: rootId } : {}),
                ...(wsMeta.length ? { workspaces: wsMeta } : {}),
              },
            };
            const deltaRec = usageCore.analyzeTrajectoryForUsage(
              { numTotalSteps: stepCount, numTotalGeneratorMetadata: nextGmCount, trajectory: { cascadeId: id, steps: [], generatorMetadata: deltaItems } },
              deltaSummary,
              id
            );
            if (workspace && deltaRec && typeof deltaRec === 'object' && !deltaRec.workspace) deltaRec.workspace = workspace;
            if (parentId && deltaRec && typeof deltaRec === 'object' && !deltaRec.parentId) deltaRec.parentId = parentId;
            records.push({
              id,
              mode: 'delta',
              gmCount: nextGmCount,
              stepCount,
              lastModifiedSec,
              subagent,
              ...(parentId ? { parentId } : {}),
              ...(workspace ? { workspace } : {}),
              delta: deltaRec,
            });
          }
        } else {
          const fullMeta = await this._fetchFullGeneratorMetadata(client, id);
          const fullRec = usageCore.analyzeTrajectoryForUsage(fullMeta, summaryStub, id);
          if (workspace && fullRec && typeof fullRec === 'object' && !fullRec.workspace) fullRec.workspace = workspace;
          if (parentId && fullRec && typeof fullRec === 'object' && !fullRec.parentId) fullRec.parentId = parentId;
          records.push({
            id,
            mode: 'full',
            subagent,
            ...(parentId ? { parentId } : {}),
            ...(workspace ? { workspace } : {}),
            record: fullRec,
          });
        }
      } catch (err) {
        records.push({ id, mode: 'error', error: sanitizeSecretText(err?.message || 'fetch failed') });
      }
    }
    return wantSummaries ? { ok: true, records, summaries: backendPack.list } : { ok: true, records };
  }

  updateConfigBatch(entriesObj) {
    if (!entriesObj || typeof entriesObj !== 'object' || Array.isArray(entriesObj)) return false;
    const validPatch = {};
    let count = 0;
    for (const [k, v] of Object.entries(entriesObj)) {
      if (this.cdp.validateConfigEntry(k, v)) {
        validPatch[k] = v;
        count += 1;
      }
    }
    if (count === 0) return false;
    const cfgPath = path.join(this.rootDir, 'config.json');
    const current = this.cdp.readConfig();
    const expandedPatch =
      typeof this.cdp.reconcileConfigAliases === 'function' ? this.cdp.reconcileConfigAliases(validPatch) : validPatch;
    const next = { ...current, ...expandedPatch };
    this._selfConfigWriteUntil = Date.now() + 650;
    writeFileAtomicSync(cfgPath, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    this._configSeq += 1;
    return true;
  }

  updateConfigSetting(key, value) {
    return this.updateConfigBatch({ [key]: value });
  }

  _runEntryExclusive(entry, fn) {
    if (!entry) return Promise.resolve();
    const prev = entry._opChain || Promise.resolve();
    const next = prev.then(() => fn(), () => fn());
    entry._opChain = next.catch(() => {});
    return next;
  }

  _isTrustedMainFrameBindingCall(entry, executionContextId) {
    if (!entry) return false;
    const hasCtxId = typeof executionContextId === 'number';
    const contexts = entry.contextFrames instanceof Map ? entry.contextFrames : null;
    const meta = hasCtxId && contexts ? contexts.get(executionContextId) : null;

    if (meta) {
      if (meta.isDefault !== true) return false;
      if (meta.type && meta.type !== 'default') return false;
      if (!entry.mainFrameId || !meta.frameId || meta.frameId !== entry.mainFrameId) {
        return false;
      }
      return true;
    }

    // 真实帧树、已识别主帧、已登记上下文映射或带有未登记/已销毁 executionContextId 时一律 fail-closed
    if (entry.hasFrameTree || entry.mainFrameId) {
      return false;
    }
    if (contexts && contexts.size > 0) {
      return false;
    }
    if (hasCtxId) {
      return false;
    }
    // 非测试运行时未拿到帧树时 fail-closed；仅兼容无帧树且无上下文 ID 的极简单测 mock
    if (!isAutomatedTestRuntime()) {
      return false;
    }
    return true;
  }

  async broadcastConfigRefresh() {
    this._broadcastPending = true;
    if (this._broadcastRunning) {
      return new Promise((resolve) => {
        this._broadcastWaiters.push(resolve);
      });
    }

    this._broadcastRunning = true;
    try {
      while (this._broadcastPending) {
        this._broadcastPending = false;
        const snapSeq = this._configSeq;
        const activeItems = [...this.sessions.values()].filter((item) => item && !item.session.closed);
        const perEntryAck = new Map();
        for (const item of activeItems) {
          const entryAck = Number.isSafeInteger(item.pendingAckEpoch) && item.pendingAckEpoch > 0 ? item.pendingAckEpoch : 0;
          item.pendingAckEpoch = 0;
          perEntryAck.set(item, entryAck);
        }

        const restoreAllAcks = () => {
          for (const [item, ack] of perEntryAck.entries()) {
            if (ack > 0) {
              item.pendingAckEpoch = Math.max(Number(item.pendingAckEpoch || 0), ack);
            }
          }
        };

        await this.ensureOmniServer().catch(() => null);
        if (this._configSeq !== snapSeq) {
          restoreAllAcks();
          this._broadcastPending = true;
          continue;
        }
        const preCfg = typeof this.cdp.readConfig === 'function' ? this.cdp.readConfig() : {};
        const preSidebarEnabled = preCfg?.sidebarStudio === 'on';
        if (preSidebarEnabled) {
          await this.ensureSidebarService().catch(() => null);
          if (this._configSeq !== snapSeq) {
            restoreAllAcks();
            this._broadcastPending = true;
            continue;
          }
        }
        // Warm-cache rebuild updates `this.injectExpr` bootCfg in < 3ms without re-minifying modules!
        this.rebuildBundle();
        const injectSnap = this.injectExpr;
        const omniSnap = this.omniExpr;
        const sidebarSnap = this.sidebarExpr;
        const hostI18nSnap = this.hostI18nExpr;
        const currentCfg = typeof this.cdp.readConfig === 'function' ? this.cdp.readConfig() : {};
        if (currentCfg?.telemetryModule === 'off') {
          this._releaseIdleTelemetry(true);
        }
        const sidebarEnabled = currentCfg?.sidebarStudio === 'on';
        const hostI18nEnabled = this._isHostI18nEnabled(currentCfg);
        const hostI18nSig = hostI18nEnabled ? this._getHostI18nCfgSig(currentCfg) : '';
        const canFastRefresh = typeof this.cdp.buildConfigRefreshExpression === 'function';
        const baseRefreshExpr = canFastRefresh ? this.cdp.buildConfigRefreshExpression() : null;
        if (activeItems.length === 0) continue;

        await Promise.allSettled(
          activeItems.map((entry) =>
            this._runEntryExclusive(entry, async () => {
              if (!entry || entry.session.closed) return;
              const entryAck = perEntryAck.get(entry) || 0;
              const abortIfStale = () => {
                if (this._configSeq !== snapSeq) {
                  if (entryAck > 0) {
                    entry.pendingAckEpoch = Math.max(Number(entry.pendingAckEpoch || 0), entryAck);
                  }
                  this._broadcastPending = true;
                  return true;
                }
                return entry.session.closed;
              };
              if (abortIfStale()) return;

              const refreshExpr =
                canFastRefresh && entryAck > 0
                  ? this.cdp.buildConfigRefreshExpression(null, { __ackEpoch: entryAck })
                  : baseRefreshExpr;
              // Fast live refresh first for immediate UI responsiveness
              let refreshedFast = false;
              let skippedStale = false;
              if (refreshExpr) {
                if (abortIfStale()) return;
                const fastRes = await entry.session.evaluate(refreshExpr).catch(() => null);
                if (fastRes && fastRes.refreshed) {
                  refreshedFast = true;
                  skippedStale = Boolean(fastRes.skippedStale);
                }
              }
              if (abortIfStale()) return;
              if (!refreshedFast && !entry.session.closed) {
                await entry.session.evaluate(injectSnap).catch(() => {});
              }
              if (abortIfStale()) return;
              const omniChanged = Boolean(omniSnap && (entry.lastOmniExpr !== omniSnap || !entry.omniScriptId));
              if (omniSnap && !skippedStale && !entry.session.closed && (!refreshedFast || omniChanged)) {
                await entry.session.evaluate(omniSnap).catch(() => {});
              }
              if (abortIfStale()) return;
              const hadSidebar = Boolean(entry.sidebarScriptId || entry.sidebarMounted || entry.sidebarBindingAdded);
              if (sidebarEnabled) {
                if (!skippedStale && !entry.session.closed) {
                  await this._ensureSidebarBinding(entry);
                  if (sidebarSnap && !entry.session.closed) {
                    await entry.session.evaluate(sidebarSnap).catch(() => {});
                    entry.sidebarMounted = true;
                  }
                }
              } else if (hadSidebar && !skippedStale && !entry.session.closed) {
                // on -> off 切换：移除绑定并仅下发轻量清理脚本，绝不下发完整 sidebar-client.js 载荷
                await this._removeSidebarBinding(entry);
                await entry.session.evaluate(this._buildSidebarCleanupExpression(true)).catch(() => {});
                entry.sidebarMounted = false;
              } else {
                await this._removeSidebarBinding(entry);
                entry.sidebarMounted = false;
              }
              if (abortIfStale()) return;
              const hadHostI18n = Boolean(entry.hostI18nScriptId || entry.hostI18nMounted);
              const hostI18nChanged = Boolean(
                hostI18nEnabled &&
                  hostI18nSnap &&
                  (entry.lastHostI18nSig !== hostI18nSig || !entry.hostI18nScriptId || !entry.hostI18nMounted)
              );
              if (hostI18nEnabled && hostI18nSnap) {
                if (!skippedStale && !entry.session.closed && (!refreshedFast || hostI18nChanged)) {
                  const evalRes = await entry.session.evaluate(hostI18nSnap).catch(() => null);
                  if (evalRes && evalRes.ok) {
                    entry.hostI18nMounted = true;
                    entry.lastHostI18nSig = hostI18nSig;
                  }
                }
              } else if (hadHostI18n && !skippedStale && !entry.session.closed) {
                await entry.session.evaluate(this._getHostI18nCleanupExpression()).catch(() => {});
                entry.hostI18nMounted = false;
                entry.lastHostI18nSig = '';
              }

              // Coalesce persistent NewDocument script replacement if a newer mutation is already queued!
              if (this._broadcastPending || this._configSeq !== snapSeq || entry.session.closed) {
                return;
              }
              if (entry.scriptId) {
                await entry.session
                  .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
                  .catch(() => {});
                entry.scriptId = null;
              }
              const addRes = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: injectSnap })
                .catch(() => null);
              if (addRes && addRes.identifier) {
                entry.scriptId = addRes.identifier;
              }
              if (!omniSnap) {
                if (entry.omniScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
                    .catch(() => {});
                  entry.omniScriptId = null;
                }
                entry.lastOmniExpr = '';
              } else if (omniChanged && !entry.session.closed) {
                if (entry.omniScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
                    .catch(() => {});
                  entry.omniScriptId = null;
                }
                const omniAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: omniSnap })
                  .catch(() => null);
                if (omniAdd && omniAdd.identifier) {
                  entry.omniScriptId = omniAdd.identifier;
                  entry.lastOmniExpr = omniSnap;
                }
              }
              if (entry.sidebarScriptId) {
                await entry.session
                  .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
                  .catch(() => {});
                entry.sidebarScriptId = null;
              }
              if (sidebarSnap && sidebarEnabled && !entry.session.closed) {
                const sbAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: sidebarSnap })
                  .catch(() => null);
                if (sbAdd && sbAdd.identifier) {
                  entry.sidebarScriptId = sbAdd.identifier;
                }
              }
              if (!hostI18nEnabled || !hostI18nSnap) {
                if (entry.hostI18nScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
                    .catch(() => {});
                  entry.hostI18nScriptId = null;
                }
                entry.lastHostI18nScriptSig = '';
              } else if ((entry.lastHostI18nScriptSig !== hostI18nSig || !entry.hostI18nScriptId) && !entry.session.closed) {
                if (entry.hostI18nScriptId) {
                  await entry.session
                    .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
                    .catch(() => {});
                  entry.hostI18nScriptId = null;
                }
                const hiAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: hostI18nSnap })
                  .catch(() => null);
                if (hiAdd && hiAdd.identifier) {
                  entry.hostI18nScriptId = hiAdd.identifier;
                  entry.lastHostI18nScriptSig = hostI18nSig;
                }
              }
            })
          )
        );
      }
    } finally {
      this._broadcastRunning = false;
      const waiters = this._broadcastWaiters.splice(0);
      for (const resolve of waiters) {
        try {
          resolve();
        } catch {}
      }
    }
  }

  _targetKey(target) {
    if (!target || typeof target !== 'object') return '';
    return String(target.id || target.targetId || target.webSocketDebuggerUrl || '').trim();
  }

  _normalizeIgnoreUrl(rawUrl) {
    const s = String(rawUrl || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname}`;
    } catch {
      return s.split(/[?#]/)[0].toLowerCase();
    }
  }

  _markTargetIgnored(target, urlOverride = '') {
    const key = this._targetKey(target);
    if (!key) return;
    const normUrl = this._normalizeIgnoreUrl(urlOverride || target?.url || '');
    if (this.ignoredTargets.has(key)) {
      this.ignoredTargets.delete(key);
    } else if (this.ignoredTargets.size >= 256) {
      const oldest = this.ignoredTargets.keys().next().value;
      if (oldest !== undefined) this.ignoredTargets.delete(oldest);
    }
    this.ignoredTargets.set(key, normUrl);
  }

  isTargetIgnored(target) {
    const key = this._targetKey(target);
    if (!key || !this.ignoredTargets.has(key)) return false;
    const prevNorm = this.ignoredTargets.get(key);
    const curNorm = this._normalizeIgnoreUrl(target?.url || '');
    if (curNorm && prevNorm && curNorm !== prevNorm) {
      this.ignoredTargets.delete(key);
      return false;
    }
    return true;
  }

  _isEligibleDaemonTarget(target) {
    const checkFn = typeof this.cdp?.isEligibleTarget === 'function' ? this.cdp.isEligibleTarget : isEligibleTarget;
    if (!checkFn(target)) return false;
    return !this.isTargetIgnored(target);
  }

  async applyToEntry(entry) {
    return this._runEntryExclusive(entry, async () => {
      if (!entry || entry.session.closed) return null;
      await this.ensureOmniServer().catch(() => null);
      const sidebarEnabledInit = this._isSidebarStudioEnabled();
      if (sidebarEnabledInit) {
        await this.ensureSidebarService().catch(() => null);
      }
      if (!this.injectExpr) this.rebuildBundle();
      else {
        if (this.omniServer && !this.omniExpr && typeof this.cdp.buildOmniClientExpression === 'function') {
          this.omniExpr = this.cdp.buildOmniClientExpression(this.omniServer.getServerInfo());
        }
        if (sidebarEnabledInit && !this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
          this.sidebarExpr = this._buildSidebarExprForCurrentClient();
        }
        if (!this.hostI18nExpr && this._isHostI18nEnabled() && typeof this.cdp.buildHostI18nExpression === 'function') {
          this.hostI18nExpr = this.cdp.buildHostI18nExpression();
        }
      }
      if (entry.scriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
          .catch(() => {});
        entry.scriptId = null;
      }
      const addRes = await entry.session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: this.injectExpr,
      });
      if (addRes && addRes.identifier) {
        entry.scriptId = addRes.identifier;
      }
      const sidebarDocument = entry.sidebarDocument;
      const mainRes = await entry.session.evaluate(this.injectExpr);
      this._markSidebarHostVerified(entry, sidebarDocument, mainRes?.status === 'ok');

      if (mainRes && mainRes.status === 'skipped-non-host') {
        if (entry.scriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId })
            .catch(() => {});
          entry.scriptId = null;
        }
        if (entry.omniScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
            .catch(() => {});
          entry.omniScriptId = null;
        }
        if (entry.sidebarScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
            .catch(() => {});
          entry.sidebarScriptId = null;
        }
        if (entry.hostI18nScriptId) {
          await entry.session
            .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
            .catch(() => {});
          entry.hostI18nScriptId = null;
        }
        entry.sidebarMounted = false;
        entry.hostI18nMounted = false;
        entry.lastHostI18nSig = '';
        entry.lastHostI18nScriptSig = '';
        return mainRes;
      }

      if (entry.omniScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId })
          .catch(() => {});
        entry.omniScriptId = null;
      }
      if (this.omniExpr) {
        const omniAdd = await entry.session
          .send('Page.addScriptToEvaluateOnNewDocument', { source: this.omniExpr })
          .catch(() => null);
        if (omniAdd && omniAdd.identifier) {
          entry.omniScriptId = omniAdd.identifier;
          entry.lastOmniExpr = this.omniExpr;
        }
        await entry.session.evaluate(this.omniExpr).catch(() => null);
      } else {
        entry.lastOmniExpr = '';
      }
      const hadSidebarBefore = Boolean(entry.sidebarScriptId || entry.sidebarMounted);
      if (entry.sidebarScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId })
          .catch(() => {});
        entry.sidebarScriptId = null;
      }
      const sidebarEnabledNow = this._isSidebarStudioEnabled();
      if (sidebarEnabledNow) {
        if (!this.sidebarService) {
          await this.ensureSidebarService().catch(() => null);
        }
        await this._ensureSidebarBinding(entry);
        if (!this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
          this.sidebarExpr = this._buildSidebarExprForCurrentClient();
        }
        if (this.sidebarExpr) {
          const sbAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.sidebarExpr })
            .catch(() => null);
          if (sbAdd && sbAdd.identifier) {
            entry.sidebarScriptId = sbAdd.identifier;
          }
          await entry.session.evaluate(this.sidebarExpr).catch(() => null);
          entry.sidebarMounted = true;
        }
      } else {
        await this._removeSidebarBinding(entry);
        // 关闭态免向新页面下发完整 sidebar-client.js 载荷；仅对已有残留或此前已挂载页面执行轻量清理
        await entry.session.evaluate(this._buildSidebarCleanupExpression(hadSidebarBefore)).catch(() => null);
        entry.sidebarMounted = false;
      }
      const hadHostI18nBefore = Boolean(entry.hostI18nScriptId || entry.hostI18nMounted);
      if (entry.hostI18nScriptId) {
        await entry.session
          .send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId })
          .catch(() => {});
        entry.hostI18nScriptId = null;
      }
      const hostI18nEnabledNow = this._isHostI18nEnabled();
      if (hostI18nEnabledNow) {
        if (!this.hostI18nExpr && typeof this.cdp.buildHostI18nExpression === 'function') {
          this.hostI18nExpr = this.cdp.buildHostI18nExpression();
        }
        if (this.hostI18nExpr) {
          const hiAdd = await entry.session
            .send('Page.addScriptToEvaluateOnNewDocument', { source: this.hostI18nExpr })
            .catch(() => null);
          if (hiAdd && hiAdd.identifier) {
            entry.hostI18nScriptId = hiAdd.identifier;
          }
          const evalRes = await entry.session.evaluate(this.hostI18nExpr).catch(() => null);
          const hiSig = this._getHostI18nCfgSig();
          if (evalRes && evalRes.ok) {
            entry.hostI18nMounted = true;
            entry.lastHostI18nSig = hiSig;
          }
          if (hiAdd && hiAdd.identifier) {
            entry.lastHostI18nScriptSig = hiSig;
          }
        }
      } else {
        if (hadHostI18nBefore) {
          await entry.session.evaluate(this._getHostI18nCleanupExpression()).catch(() => null);
        }
        entry.hostI18nMounted = false;
        entry.lastHostI18nSig = '';
        entry.lastHostI18nScriptSig = '';
      }
      entry.lastVerifyAt = Date.now();
      entry.healthyStreak = 1;
      entry.verifyDirty = false;
      entry.lastVerifiedCodeHash = this.codeHash || '';
      return mainRes;
    });
  }

  async handleBindingCall(entry, { name, payload, executionContextId }) {
    if (!this._isTrustedMainFrameBindingCall(entry, executionContextId)) return;
    if (name === this.cdp.SETTING_BINDING || name === this.cdp.LEGACY_SETTING_BINDING) {
      if (typeof payload !== 'string' || payload.length > 8192) return;
      try {
        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed !== 'object') return;
        const updated =
          parsed.action === 'patch-batch' && parsed.entries && typeof parsed.entries === 'object'
            ? this.updateConfigBatch(parsed.entries)
            : this.updateConfigSetting(parsed.key, parsed.value);
        if (updated) {
          if (entry && Number.isSafeInteger(parsed.clientEpoch) && parsed.clientEpoch > 0) {
            entry.pendingAckEpoch = parsed.clientEpoch;
          }
          await this.broadcastConfigRefresh();
        }
      } catch {}
      return;
    }

    if (name === REPO_BINDING) {
      if (typeof payload !== 'string' || payload.length > 4096) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      const action =
        parsed?.action ||
        parsed?.type ||
        parsed?.input?.action ||
        parsed?.payload?.action ||
        'status';

      const inputPayload =
        parsed?.input && typeof parsed.input === 'object' && !Array.isArray(parsed.input)
          ? { ...parsed.input }
          : parsed?.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
            ? { ...parsed.payload }
            : {};
      delete inputPayload._testOverrides;
      if (inputPayload.confirm === undefined && parsed?.confirm !== undefined) inputPayload.confirm = parsed.confirm;
      if (inputPayload.purgeData === undefined && parsed?.purgeData !== undefined) inputPayload.purgeData = parsed.purgeData;
      if (inputPayload.force === undefined && parsed?.force !== undefined) inputPayload.force = parsed.force;
      if (inputPayload.manual === undefined && parsed?.manual !== undefined) inputPayload.manual = parsed.manual;

      const result = await this.executeRepoAction({ ...inputPayload, action });
      if (reqId !== null) {
        const safeId = Number(reqId) | 0;
        const jsonRes = serializeJsonForEval(result);
        const expr = `(() => {
          if (window.__agPrismRepoBridge && typeof window.__agPrismRepoBridge.resolve === 'function') {
            window.__agPrismRepoBridge.resolve(${safeId}, ${jsonRes});
          } else if (typeof window.__agPrismRepoResolve === 'function') {
            window.__agPrismRepoResolve(${safeId}, ${jsonRes});
          }
        })()`;
        const evalParams = { expression: expr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === METRICS_BINDING) {
      if (typeof payload !== 'string' || payload.length > 4096) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (!reqId) return;

      let result;
      if (!this._customMetricsProvider && this._isTelemetryDisabled()) {
        this._releaseIdleTelemetry(true);
        result = {
          connection: 'disabled',
          speed: null,
          groups: [],
        };
      } else {
        this._telemetryInFlight = (this._telemetryInFlight || 0) + 1;
        this._lastTelemetryActivityAt = Date.now();
        try {
          const collector = await this.ensureMetricsCollector();
          result = await collector(parsed.input || {});
        } catch (err) {
          result = {
            connection: 'offline',
            error: err?.message || 'Metrics unavailable',
            speed: null,
            groups: [],
          };
        } finally {
          this._telemetryInFlight = Math.max(0, (this._telemetryInFlight || 1) - 1);
          this._lastTelemetryActivityAt = Date.now();
          if (!this._customMetricsProvider && this._isTelemetryDisabled() && this._telemetryInFlight === 0) {
            this._releaseIdleTelemetry(true);
          }
        }
      }
      const safeId = Number(reqId) | 0;
      const expr = `window.__agPrismMetricsResolve && window.__agPrismMetricsResolve(${safeId}, ${serializeJsonForEval(result)})`;
      const evalParams = { expression: expr, returnByValue: true };
      if (executionContextId) evalParams.contextId = executionContextId;
      await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      return;
    }

    if (name === THOUGHT_BINDING) {
      if (typeof payload !== 'string' || payload.length > 131072) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (reqId === null) return;
      const input = parsed?.input && typeof parsed.input === 'object' ? parsed.input : {};
      const action = parsed?.action || input.action || 'get-config';

      let result;
      try {
        const svc = await this.ensureThoughtService();
        if (action === 'get-config') {
          result = svc.getSanitizedConfig();
        } else if (action === 'save-config') {
          result = svc.saveConfig(input);
        } else if (action === 'get-cache') {
          result = svc.getWarmCacheSnapshot(
            Number(input.limit) > 0 ? Number(input.limit) : 40,
            Number(input.maxChars) > 0 ? Number(input.maxChars) : 80000
          );
        } else if (action === 'cache-stats') {
          result = svc.getCacheStats();
        } else if (action === 'clear-cache') {
          result = svc.clearCache();
        } else if (action === 'cancel-translate') {
          result = svc.cancelPending(
            input.requestId !== undefined || input.key !== undefined
              ? input
              : parsed?.requestId ?? parsed?.key ?? input
          );
        } else if (action === 'fetch-models') {
          result = await svc.fetchModels(input);
        } else if (action === 'test-connection') {
          result = await svc.testConnection(input);
        } else if (action === 'translate-stream') {
          let lastSent = '';
          let pendingPartial = null;
          let sendingPartial = false;
          const flushPartial = async () => {
            if (sendingPartial) return;
            sendingPartial = true;
            try {
              while (pendingPartial !== null) {
                if (!entry || entry.session.closed) {
                  pendingPartial = null;
                  break;
                }
                const target = pendingPartial;
                pendingPartial = null;
                if (target === lastSent) continue;
                const payload =
                  lastSent.length > 0 && target.startsWith(lastSent)
                    ? { a: target.slice(lastSent.length), o: lastSent.length }
                    : target;
                const safeId = Number(reqId) | 0;
                const chunkExpr = `window.__agPrismThoughtOnChunk && window.__agPrismThoughtOnChunk(${safeId}, ${serializeJsonForEval(payload)})`;
                const chunkParams = { expression: chunkExpr, returnByValue: true };
                if (executionContextId) chunkParams.contextId = executionContextId;
                try {
                  await entry.session.send('Runtime.evaluate', chunkParams);
                  lastSent = target;
                } catch {
                  // Delivery failed: reset cursor so the next chunk resyncs cleanly via full-string reset frame
                  lastSent = '';
                }
              }
            } finally {
              sendingPartial = false;
            }
          };
          result = await svc.translateThought({
            text: input.text || '',
            mode: input.mode || 'ai',
            priority: Number(input.priority || 0),
            requestId: input.requestId ? String(input.requestId) : '',
            force: Boolean(input.force),
            bypassCache: Boolean(input.bypassCache),
            targetLang: input.targetLang || input.lang || '',
            onPartial: (partialText) => {
              if (!entry || entry.session.closed) return;
              pendingPartial = String(partialText || '');
              void flushPartial();
            },
          });
        } else {
          result = { ok: false, error: `Unknown thought action: ${action}` };
        }
      } catch (err) {
        result = { ok: false, error: sanitizeSecretText(err?.message || err) };
      }

      if (!entry.session.closed) {
        const safeId = Number(reqId) | 0;
        const safeJson = serializeJsonForEval(result);
        const payloadExpr = safeJson.length > 4096 ? `JSON.parse(${serializeJsonForEval(safeJson)})` : safeJson;
        const resolveExpr = `window.__agPrismThoughtResolve && window.__agPrismThoughtResolve(${safeId}, ${payloadExpr})`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === USAGE_BINDING) {
      if (typeof payload !== 'string' || payload.length > 65536) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (reqId === null) return;
      this._telemetryInFlight = (this._telemetryInFlight || 0) + 1;
      this._lastTelemetryActivityAt = Date.now();
      let result;
      try {
        result = await this.fetchUsageRollupBatch(parsed.items, {
          action: parsed.action || 'fetch-batch',
          includeSummaries: Boolean(parsed.includeSummaries),
        });
      } catch (err) {
        result = { ok: false, error: sanitizeSecretText(err?.message || err), records: [] };
      } finally {
        this._telemetryInFlight = Math.max(0, (this._telemetryInFlight || 1) - 1);
        this._lastTelemetryActivityAt = Date.now();
      }
      if (!entry.session.closed) {
        const safeId = Number(reqId) | 0;
        const resolveExpr = `window.__agPrismUsageResolve && window.__agPrismUsageResolve(${safeId}, ${serializeJsonForEval(result)})`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === OMNI_BINDING) {
      if (typeof payload !== 'string' || payload.length > 65536) return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const reqId = parsed && Number.isSafeInteger(parsed.id) ? parsed.id : null;
      if (reqId === null) return;
      const action = typeof parsed.action === 'string' ? parsed.action : '';
      const mergedParams = {
        ...parsed,
        ...(parsed.params && typeof parsed.params === 'object' ? parsed.params : {}),
        ...(parsed.input && typeof parsed.input === 'object' ? parsed.input : {}),
        ...(parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {}),
      };
      let result;
      try {
        const srv = await this.ensureOmniServer();
        result = await srv.handleRpcAction(action, mergedParams);
      } catch (err) {
        result = { ok: false, error: sanitizeSecretText(err?.message || err) };
      }
      if (!entry.session.closed) {
        const safeId = Number(reqId) | 0;
        const jsonRes = serializeJsonForEval(result);
        const resolveExpr = `(() => { const r = ${jsonRes}; const b = window.__agPrismOmniBridge; if (b && typeof b.resolve === 'function') b.resolve(${safeId}, r); if (typeof window.__agPrismOmniResolve === 'function' && (!b || window.__agPrismOmniResolve !== b.resolve)) window.__agPrismOmniResolve(${safeId}, r); })()`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return;
    }

    if (name === SIDEBAR_BINDING) {
      const context = typeof executionContextId === 'number' ? entry.contextFrames?.get(executionContextId) : undefined;
      const isCurrentHost = () => {
        if (this._sidebarStopped || entry.session.closed || entry.sidebarHostVerified !== true) return false;
        if (!context || context.isDefault !== true || context.type !== 'default') return false;
        if (!entry.mainFrameId || context.frameId !== entry.mainFrameId) return false;
        if (entry.contextFrames.get(executionContextId) !== context) return false;
        if (typeof entry.sidebarDocument === 'number') {
          if (typeof entry.sidebarVerifiedDocument === 'number' && entry.sidebarVerifiedDocument !== entry.sidebarDocument) {
            return false;
          }
          if (typeof context.docGen === 'number' && context.docGen !== entry.sidebarDocument) {
            return false;
          }
        }
        if (typeof entry.sidebarHostContextId === 'number' && entry.sidebarHostContextId !== executionContextId) {
          return false;
        }
        return true;
      };
      if (!isCurrentHost()) return;
      // 关闭态在 JSON.parse 之前直接硬拦截，杜绝关闭态触发解析或拉起后台服务
      if (this.cdp?.readConfig?.()?.sidebarStudio !== 'on') {
        return { ok: false, error: 'Chat Beta is disabled' };
      }
      if (typeof payload !== 'string') return;
      const SIDEBAR_MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;
      if (payload.length > SIDEBAR_MAX_PAYLOAD_BYTES) return;
      const payloadBytes = Buffer.byteLength(payload, 'utf8');
      if (payloadBytes > SIDEBAR_MAX_PAYLOAD_BYTES) return;
      let parsed;
      try { parsed = JSON.parse(payload); } catch { return; }
      if (!parsed || typeof parsed !== 'object' || !Number.isSafeInteger(parsed.id) || parsed.id < 1) return;
      if (parsed.action !== 'import-spark-file' && payloadBytes > 128 * 1024) return;
      const { id, input: _transportCopy, ...request } = parsed;
      const safeId = serializeJsonForEval(Math.trunc(Number(id)));
      const unavailable = { ok: false, error: {
        code: 'CAPABILITY_UNAVAILABLE', message: 'Sidebar Studio service unavailable', retryable: true,
      } };
      let result = unavailable;
      try {
        if (this.cdp?.readConfig?.()?.sidebarStudio === 'on') {
          const svc = await this.ensureSidebarService();
          if (!isCurrentHost()) return;
          if (typeof svc?.handleRpc === 'function') result = await svc.handleRpc(request);
        } else {
          result = { ok: false, error: 'Chat Beta is disabled' };
        }
      } catch {
        // 异常不把宿主栈、命令参数或本地路径回传到渲染进程。
      }
      if (isCurrentHost()) {
        const jsonRes = serializeJsonForEval(result);
        const resolveExpr = `(() => { const r = ${jsonRes}; const b = window.__agPrismSidebarBridge; if (b && typeof b.resolve === 'function') b.resolve(${safeId}, r); if (typeof window.__agPrismSidebarResolve === 'function' && (!b || window.__agPrismSidebarResolve !== b.resolve)) window.__agPrismSidebarResolve(${safeId}, r); })()`;
        const evalParams = { expression: resolveExpr, returnByValue: true };
        if (executionContextId) evalParams.contextId = executionContextId;
        await entry.session.send('Runtime.evaluate', evalParams).catch(() => {});
      }
      return result;
    }
  }

  async attachTarget(target) {
    const wsUrl = target.webSocketDebuggerUrl;
    if (this.isTargetIgnored(target)) return null;
    if (this.sessions.has(wsUrl)) return this.sessions.get(wsUrl);

    const session = await this.cdp.CdpSession.connect(wsUrl, 3500);
    const entry = {
      wsUrl,
      pageId: target.id,
      url: String(target.url || ''),
      title: target.title || target.url || 'Antigravity',
      session,
      scriptId: null,
      omniScriptId: null,
      sidebarScriptId: null,
      sidebarBindingAdded: false,
      sidebarMounted: false,
      hostI18nScriptId: null,
      hostI18nMounted: false,
      lastHostI18nSig: '',
      lastHostI18nScriptSig: '',
      sidebarHostVerified: false,
      sidebarVerifiedDocument: -1,
      sidebarHostContextId: null,
      sidebarDocument: 0,
      lastOmniExpr: '',
      lastVerifyAt: 0,
      healthyStreak: 0,
      verifyDirty: true,
      lastVerifiedCodeHash: '',
      mainFrameId: null,
      hasFrameTree: false,
      contextFrames: new Map(),
      pendingAckEpoch: 0,
      _healTimer: null,
      _opChain: Promise.resolve(),
    };
    this.sessions.set(wsUrl, entry);

    session.onClose = () => {
      if (entry._healTimer) {
        clearTimeout(entry._healTimer);
        this._managedTimers?.delete(entry._healTimer);
        entry._healTimer = null;
      }
      if (this.sessions.get(wsUrl) === entry) {
        this.sessions.delete(wsUrl);
      }
    };

    try {
      const revokeSidebarHost = () => {
        entry.sidebarHostVerified = false;
        entry.sidebarVerifiedDocument = -1;
        entry.sidebarHostContextId = null;
        entry.sidebarDocument += 1;
      };
      session.on('Runtime.executionContextCreated', (params) => {
        const ctx = params?.context;
        if (!ctx || typeof ctx.id !== 'number') return;
        const aux = ctx.auxData && typeof ctx.auxData === 'object' ? ctx.auxData : {};
        const frameId = typeof aux.frameId === 'string' ? aux.frameId : '';
        const isDefault = aux.isDefault === true;
        const type = typeof aux.type === 'string' && aux.type ? aux.type : (isDefault ? 'default' : '');
        const isMainDefault = Boolean(entry.mainFrameId && frameId === entry.mainFrameId && isDefault && type === 'default');
        if (isMainDefault) {
          // 同帧新建默认上下文时撤销旧文档授权并递增文档代际，防止新上下文继承旧授权
          if (
            entry.sidebarHostVerified ||
            (typeof entry.sidebarHostContextId === 'number' && entry.sidebarHostContextId !== ctx.id)
          ) {
            revokeSidebarHost();
            entry.verifyDirty = true;
            entry.healthyStreak = 0;
          }
        }
        entry.contextFrames.set(ctx.id, {
          frameId,
          isDefault,
          type,
          docGen: entry.sidebarDocument,
        });
      });
      session.on('Runtime.executionContextDestroyed', (params) => {
        if (typeof params?.executionContextId === 'number') {
          const destroyedId = params.executionContextId;
          const destroyedMeta = entry.contextFrames.get(destroyedId);
          entry.contextFrames.delete(destroyedId);
          const wasMainDefault = Boolean(
            destroyedMeta &&
            destroyedMeta.isDefault === true &&
            destroyedMeta.type === 'default' &&
            entry.mainFrameId &&
            destroyedMeta.frameId === entry.mainFrameId
          );
          if (destroyedId === entry.sidebarHostContextId || wasMainDefault) {
            revokeSidebarHost();
            entry.verifyDirty = true;
            entry.healthyStreak = 0;
          }
        }
      });
      session.on('Runtime.executionContextsCleared', () => {
        entry.contextFrames.clear();
        revokeSidebarHost();
        entry.pendingAckEpoch = 0;
      });
      session.on('Page.frameNavigated', (params) => {
        const frame = params?.frame;
        if (frame && !frame.parentId && typeof frame.id === 'string' && frame.id) {
          entry.mainFrameId = frame.id;
          entry.hasFrameTree = true;
          revokeSidebarHost();
          entry.pendingAckEpoch = 0;
          entry.verifyDirty = true;
          entry.healthyStreak = 0;
          if (typeof frame.url === 'string' && frame.url) {
            entry.url = frame.url;
          }
        }
      });
      await session.send('Page.enable');
      const ft = await session.send('Page.getFrameTree', {}, 2000).catch(() => null);
      const topFrameId = ft?.frameTree?.frame?.id;
      if (typeof topFrameId === 'string' && topFrameId) {
        entry.mainFrameId = topFrameId;
        entry.hasFrameTree = true;
      }
      await session.send('Runtime.enable');
      session.on('Runtime.bindingCalled', (params) => {
        void this.handleBindingCall(entry, params || {});
      });
      await session.send('Runtime.addBinding', { name: this.cdp.SETTING_BINDING });
      await session.send('Runtime.addBinding', { name: this.cdp.LEGACY_SETTING_BINDING }).catch(() => {});
      await session.send('Runtime.addBinding', { name: METRICS_BINDING });
      await session.send('Runtime.addBinding', { name: REPO_BINDING });
      await session.send('Runtime.addBinding', { name: THOUGHT_BINDING });
      await session.send('Runtime.addBinding', { name: USAGE_BINDING });
      await session.send('Runtime.addBinding', { name: OMNI_BINDING });
      if (this._isSidebarStudioEnabled()) {
        await session.send('Runtime.addBinding', { name: SIDEBAR_BINDING });
        entry.sidebarBindingAdded = true;
      }

      const healOnNav = () => {
        if (!this.running || entry.session.closed) return;
        entry.verifyDirty = true;
        entry.healthyStreak = 0;
        if (entry._healTimer) {
          clearTimeout(entry._healTimer);
          this._managedTimers?.delete(entry._healTimer);
          entry._healTimer = null;
        }
        const t = setTimeout(() => {
          entry._healTimer = null;
          this._managedTimers?.delete(t);
          if (!this.running || entry.session.closed) return;
          void this.verifyAndHealEntry(entry, true);
        }, 50);
        if (typeof t.unref === 'function') t.unref();
        entry._healTimer = t;
        this._managedTimers?.add(t);
      };
      session.on('Page.domContentLoadedEventFired', healOnNav);
      session.on('Page.loadEventFired', healOnNav);

      const res = await this.applyToEntry(entry);
      if (res && res.status === 'skipped-non-host') {
        this._markTargetIgnored(target, entry.url || target.url);
        session.close();
        this.sessions.delete(wsUrl);
        this.log(`[↷] Ignored non-host target: ${entry.title}`);
        return null;
      }
      this.log(`[✓] Attached & injected Obsidian Prism v${this.cdp.PLUGIN_VERSION}: ${entry.title} (${res?.status || 'ok'})`);
      return entry;
    } catch (err) {
      try {
        if (entry.scriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId });
        }
        if (entry.omniScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId });
        }
        if (entry.sidebarScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId });
        }
        if (entry.hostI18nScriptId) {
          await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId });
        }
      } catch {}
      session.close();
      this.sessions.delete(wsUrl);
      throw err;
    }
  }

  async verifyAndHealEntry(entry, force = false) {
    if (!entry || entry.session.closed) return { alive: false, ready: false, isHostDom: false };
    return this._runEntryExclusive(entry, () => this._verifyAndHealEntryUnlocked(entry, force));
  }

  async _verifyAndHealEntryUnlocked(entry, force = false) {
    if (!entry || entry.session.closed) return { alive: false, ready: false, isHostDom: false };
    const now = Date.now();
    const hashMatches = !this.codeHash || entry.lastVerifiedCodeHash === this.codeHash;
    if (!force && !entry.verifyDirty && hashMatches && entry.lastVerifyAt > 0 && entry.healthyStreak > 0) {
      const browserLive = Boolean(this.browserSession && !this.browserSession.closed);
      const backoffMs = browserLive
        ? Math.min(15000, 3000 * Math.pow(2, Math.min(3, entry.healthyStreak - 1)))
        : 4000;
      if (now - entry.lastVerifyAt < backoffMs) {
        return { alive: true, ready: true, isHostDom: true, skipped: true };
      }
    }
    try {
      const probe = await entry.session.evaluate(
        `(() => {
        const root = typeof document !== 'undefined' && document.documentElement;
        if (!root || document.readyState === 'loading') return { ready: false };
        const isHostDom = Boolean(
          (document.body &&
            document.body.classList &&
            (document.body.classList.contains('theme-standalone') || document.body.classList.contains('monaco-workbench'))) ||
            document.querySelector(
              '.agy-shell, .agy-home, [data-testid="aux-pane-split"], [data-testid="conversation-view"], [data-testid="agent-input-box"], [data-testid="model-selector-trigger"], .monaco-workbench'
            )
        );
        const api = window.__agPrism;
        const st = api && typeof api.getState === 'function' ? api.getState() : null;
        const telMode = st?.cfg?.telemetryModule || 'auto';
        const omniMode = st?.cfg?.omniModule || 'on';
        const sidebarMode = st?.cfg?.sidebarStudio === 'on' ? 'on' : 'off';
        const isHome = Boolean(document.querySelector('.agy-home, [data-testid="home-greeting"]'));
        const hasModelBtn = Boolean(document.querySelector('[data-testid="model-selector-trigger"]'));
        const hasPulseBar = Boolean(
          document.querySelector(
            '[data-ag-prism-pulse-bar="true"], #ag-prism-pulse-bar, [data-ag-pulse-bar="true"], #ag-pulse-status-bar'
          )
        );
        return {
          ready: true,
          isHostDom,
          href: (typeof location !== 'undefined' && location && typeof location.href === 'string') ? location.href : '',
          prismAttr: root.getAttribute('data-ag-prism') || '',
          hasPrism: Boolean(api),
          hasRepoBridge: Boolean(window.__agPrismRepoBridge),
          hasThoughtBridge: Boolean(window.__agPrismThoughtBridge && typeof window.__agPrismThoughtBridge.cacheStats === 'function'),
          hasUsageBridge: Boolean(window.__agPrismUsageBridge && typeof window.__agPrismUsageBridge.listSummaries === 'function'),
          hasOmniBridge: Boolean(window.__agPrismOmniBridge && typeof window.__agPrismOmniBridge.call === 'function'),
          hasOmniServerMeta: Boolean(window.__agPrismOmniServerMeta && window.__agPrismOmniServerMeta.baseUrl && window.__agPrismOmniServerMeta.token),
          hasOmni: Boolean(window.__agPrismOmni),
          omniMode,
          hasSidebarBridge: Boolean(window.__agPrismSidebarBridge && typeof window.__agPrismSidebarBridge.call === 'function'),
          hasSidebar: Boolean(window.__agPrismSidebar),
          sidebarMode,
          hasHostI18n: Boolean(window.__agPrismHostI18n),
          codeHash: (api && api.codeHash) || '',
          hasLegacyCss: Boolean(document.getElementById('ag-claude-style-css')),
          needsDashboardSync: Boolean(api && telMode !== 'off' && !isHome && hasModelBtn && !hasPulseBar),
        };
      })()`,
        false,
        2600
      );
      if (!probe || !probe.ready) return { alive: true, ready: false, isHostDom: true };
      if (probe.href) entry.url = probe.href;
      const hasClientOnDisk = this._hasOmniClientFile();
      const needsOmniHeal =
        !probe.hasOmniBridge ||
        !probe.hasOmniServerMeta ||
        (hasClientOnDisk && probe.omniMode !== 'off' && !probe.hasOmni);
      const sidebarEnabled = this._isSidebarStudioEnabled();
      const hasSafeSidebarOnDisk = this._hasSafeV2SidebarClientFile();
      const needsSidebarHeal =
        sidebarEnabled && (!probe.hasSidebarBridge || (hasSafeSidebarOnDisk && !probe.hasSidebar));
      const needsSidebarCleanup =
        !sidebarEnabled && Boolean(probe.hasSidebar || entry.sidebarScriptId || entry.sidebarMounted || entry.sidebarBindingAdded);
      const hostI18nEnabled = this._isHostI18nEnabled();
      const needsHostI18nHeal = hostI18nEnabled && (!probe.hasHostI18n || !entry.hostI18nScriptId);
      const needsHostI18nCleanup =
        !hostI18nEnabled && Boolean(probe.hasHostI18n || entry.hostI18nScriptId || entry.hostI18nMounted);
      let healed = false;
      if (
        (entry.sidebarHostVerified === false && probe.isHostDom) ||
        !probe.hasPrism ||
        !probe.hasRepoBridge ||
        !probe.hasThoughtBridge ||
        !probe.hasUsageBridge ||
        probe.prismAttr !== this.cdp.PLUGIN_VERSION ||
        probe.hasLegacyCss ||
        (this.codeHash && probe.codeHash && probe.codeHash !== this.codeHash)
      ) {
        healed = true;
        await this.ensureOmniServer().catch(() => null);
        if (sidebarEnabled) {
          await this.ensureSidebarService().catch(() => null);
        }
        await entry.session.send('Runtime.addBinding', { name: this.cdp.SETTING_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: METRICS_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: REPO_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: THOUGHT_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: USAGE_BINDING }, 2600).catch(() => {});
        await entry.session.send('Runtime.addBinding', { name: OMNI_BINDING }, 2600).catch(() => {});
        if (sidebarEnabled) {
          await this._ensureSidebarBinding(entry, 2600, true);
        }
        const sidebarDocument = entry.sidebarDocument;
        const healRes = await entry.session.evaluate(this.injectExpr, false, 4500);
        this._markSidebarHostVerified(entry, sidebarDocument, healRes?.status === 'ok');
        if (healRes && healRes.status === 'skipped-non-host') {
          if (entry.scriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
            entry.scriptId = null;
          }
          if (entry.omniScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
            entry.omniScriptId = null;
          }
          if (entry.sidebarScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            entry.sidebarScriptId = null;
          }
          if (entry.hostI18nScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            entry.hostI18nScriptId = null;
          }
          await this._removeSidebarBinding(entry);
          entry.sidebarMounted = false;
          entry.hostI18nMounted = false;
          this._markTargetIgnored({ id: entry.pageId, webSocketDebuggerUrl: entry.wsUrl }, probe.href || entry.url);
          entry.session.close();
          this.sessions.delete(entry.wsUrl);
          this.log(`[↷] Detached & ignored deferred non-host target: ${entry.title}`);
          return { alive: false, ready: true, isHostDom: false };
        }
        if (this.omniExpr) {
          await entry.session.evaluate(this.omniExpr, false, 3500).catch(() => {});
        }
        if (sidebarEnabled) {
          if (!this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
            this.sidebarExpr = this._buildSidebarExprForCurrentClient();
          }
          if (this.sidebarExpr) {
            await entry.session.evaluate(this.sidebarExpr, false, 3500).catch(() => {});
            entry.sidebarMounted = true;
          }
        } else if (needsSidebarCleanup) {
          if (entry.sidebarScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            entry.sidebarScriptId = null;
          }
          await this._removeSidebarBinding(entry);
          await entry.session.evaluate(this._buildSidebarCleanupExpression(true), false, 3500).catch(() => {});
          entry.sidebarMounted = false;
        }
        if (hostI18nEnabled) {
          if (!probe.hasHostI18n || !entry.hostI18nScriptId) {
            if (!this.hostI18nExpr && typeof this.cdp.buildHostI18nExpression === 'function') {
              this.hostI18nExpr = this.cdp.buildHostI18nExpression();
            }
            if (this.hostI18nExpr) {
              const hiSig = this._getHostI18nCfgSig();
              if (!entry.hostI18nScriptId) {
                const hiAdd = await entry.session
                  .send('Page.addScriptToEvaluateOnNewDocument', { source: this.hostI18nExpr })
                  .catch(() => null);
                if (hiAdd && hiAdd.identifier) {
                  entry.hostI18nScriptId = hiAdd.identifier;
                  entry.lastHostI18nScriptSig = hiSig;
                }
              }
              if (!probe.hasHostI18n) {
                const evalRes = await entry.session.evaluate(this.hostI18nExpr, false, 4500).catch(() => null);
                if (evalRes && evalRes.ok) {
                  entry.hostI18nMounted = true;
                  entry.lastHostI18nSig = hiSig;
                }
              }
            }
          }
        } else if (needsHostI18nCleanup) {
          if (entry.hostI18nScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            entry.hostI18nScriptId = null;
          }
          await entry.session.evaluate(this._getHostI18nCleanupExpression(), false, 3500).catch(() => {});
          entry.hostI18nMounted = false;
          entry.lastHostI18nSig = '';
          entry.lastHostI18nScriptSig = '';
        }
        this.log(`[↻] Hot-healed window to Obsidian Prism v${this.cdp.PLUGIN_VERSION}: ${entry.title}`);
      } else {
        if (needsOmniHeal) {
          healed = true;
          await this.ensureOmniServer().catch(() => null);
          await entry.session.send('Runtime.addBinding', { name: OMNI_BINDING }, 2600).catch(() => {});
          if (this.omniExpr) {
            await entry.session.evaluate(this.omniExpr, false, 3500).catch(() => {});
          }
        }
        if (needsSidebarHeal) {
          healed = true;
          await this.ensureSidebarService().catch(() => null);
          await this._ensureSidebarBinding(entry, 2600, true);
          if (!this.sidebarExpr && typeof this.cdp.buildSidebarStudioExpression === 'function') {
            this.sidebarExpr = this._buildSidebarExprForCurrentClient();
          }
          if (this.sidebarExpr) {
            await entry.session.evaluate(this.sidebarExpr, false, 3500).catch(() => {});
            entry.sidebarMounted = true;
          }
        } else if (needsSidebarCleanup) {
          healed = true;
          if (entry.sidebarScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            entry.sidebarScriptId = null;
          }
          await this._removeSidebarBinding(entry);
          await entry.session.evaluate(this._buildSidebarCleanupExpression(true), false, 3500).catch(() => {});
          entry.sidebarMounted = false;
        }
        if (needsHostI18nHeal) {
          healed = true;
          if (!this.hostI18nExpr && typeof this.cdp.buildHostI18nExpression === 'function') {
            this.hostI18nExpr = this.cdp.buildHostI18nExpression();
          }
          if (this.hostI18nExpr) {
            const hiSig = this._getHostI18nCfgSig();
            if (!entry.hostI18nScriptId) {
              const hiAdd = await entry.session
                .send('Page.addScriptToEvaluateOnNewDocument', { source: this.hostI18nExpr })
                .catch(() => null);
              if (hiAdd && hiAdd.identifier) {
                entry.hostI18nScriptId = hiAdd.identifier;
                entry.lastHostI18nScriptSig = hiSig;
              }
            }
            if (!probe.hasHostI18n) {
              const evalRes = await entry.session.evaluate(this.hostI18nExpr, false, 4500).catch(() => null);
              if (evalRes && evalRes.ok) {
                entry.hostI18nMounted = true;
                entry.lastHostI18nSig = hiSig;
              }
            }
          }
        } else if (needsHostI18nCleanup) {
          healed = true;
          if (entry.hostI18nScriptId) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            entry.hostI18nScriptId = null;
          }
          await entry.session.evaluate(this._getHostI18nCleanupExpression(), false, 3500).catch(() => {});
          entry.hostI18nMounted = false;
          entry.lastHostI18nSig = '';
          entry.lastHostI18nScriptSig = '';
        }
        if (probe.needsDashboardSync) {
          healed = true;
          await entry.session
            .evaluate(
              `(() => {
                const cfg = window.__agPrism?.getState?.()?.cfg || {};
                window.__agPrismTelemetry?.sync?.(cfg);
                window.__agPrism?.sync?.();
                return true;
              })()`,
              false,
              2200
            )
            .catch(() => {});
        }
      }
      entry.lastVerifyAt = Date.now();
      entry.verifyDirty = false;
      entry.lastVerifiedCodeHash = this.codeHash || '';
      entry.healthyStreak = healed ? 0 : Math.min(8, (entry.healthyStreak || 0) + 1);
      return { alive: true, ready: true, isHostDom: Boolean(probe.isHostDom), href: probe.href || '' };
    } catch {
      entry.session.close();
      this.sessions.delete(entry.wsUrl);
      return { alive: false, ready: false, isHostDom: false };
    }
  }

  closeBrowserDiscovery() {
    if (this._discoverTimer) {
      clearTimeout(this._discoverTimer);
      this._discoverTimer = null;
    }
    if (this.browserSession) {
      const bs = this.browserSession;
      this.browserSession = null;
      this.browserPort = null;
      try {
        bs.close();
      } catch {}
    }
  }

  scheduleImmediateTick(delayMs = 45) {
    if (!this.running) return;
    if (this.busy) {
      this._pendingTick = true;
      return;
    }
    if (this._discoverTimer) clearTimeout(this._discoverTimer);
    this._discoverTimer = setTimeout(() => {
      this._discoverTimer = null;
      if (this.running) void this.tick();
    }, delayMs);
    if (this._discoverTimer && typeof this._discoverTimer.unref === 'function') {
      this._discoverTimer.unref();
    }
  }

  async ensureBrowserDiscovery(port) {
    if (!this.running || !port || typeof this.cdp.getBrowserWsUrl !== 'function') return;
    if (this.browserSession && !this.browserSession.closed && this.browserPort === port) return;
    this.closeBrowserDiscovery();
    try {
      const browserWs = await this.cdp.getBrowserWsUrl(port);
      if (!browserWs || !this.running) return;
      const bSession = await this.cdp.CdpSession.connect(browserWs, 1800);
      if (!this.running) {
        bSession.close();
        return;
      }
      this.browserSession = bSession;
      this.browserPort = port;
      bSession.onClose = () => {
        if (this.browserSession === bSession) {
          this.browserSession = null;
          this.browserPort = null;
        }
      };
      const onTargetEvent = (params) => {
        const info = params?.targetInfo;
        if (!info || info.type !== 'page') return;
        const tid = info.targetId || info.id || '';
        // If this page is already attached and healthy, only mark it dirty on URL shift rather than waking all pages
        for (const existing of this.sessions.values()) {
          if (tid && existing.pageId === tid) {
            if (typeof info.url === 'string' && info.url && info.url !== existing.url) {
              existing.verifyDirty = true;
              existing.healthyStreak = 0;
              this.scheduleImmediateTick(45);
            }
            return;
          }
        }
        if (!this._isEligibleDaemonTarget({ ...info, id: tid, webSocketDebuggerUrl: 'ws://check' })) return;
        this.scheduleImmediateTick(45);
      };
      bSession.on('Target.targetCreated', onTargetEvent);
      bSession.on('Target.targetInfoChanged', onTargetEvent);
      await bSession.send('Target.setDiscoverTargets', { discover: true }, 1500).catch(() => {});
    } catch {}
  }

  async detachAll(cleanPageDom = false) {
    this.closeBrowserDiscovery();
    const entries = [...this.sessions.values()];
    await Promise.allSettled(
      entries.map(async (entry) => {
        try {
          if (entry.scriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
          }
          if (entry.omniScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
          }
          if (entry.sidebarScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
          }
          if (entry.hostI18nScriptId && !entry.session.closed) {
            await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
          }
          if (cleanPageDom && !entry.session.closed) {
            await entry.session.evaluate(this.cdp.REMOVE_EXPRESSION).catch(() => {});
          }
        } catch {}
        entry.session.close();
      })
    );
    this.sessions.clear();
  }

  _isRelaunchGuardAllowed() {
    if (this._relaunchHooks) return true;
    if (isAutomatedTestRuntime()) return false;
    if (process.env.PRISM_NO_RELAUNCH_PROMPT === '1') return false;
    if (this.overridePort) return false;
    return true;
  }

  _readDiskRawConfig() {
    try {
      const cfgPath = path.join(this.rootDir, 'config.json');
      if (!fs.existsSync(cfgPath)) return {};
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) || {};
    } catch {
      return {};
    }
  }

  _maybeSyncShortcuts(force = false) {
    if (!this._isRelaunchGuardAllowed()) return null;
    if (process.env.PRISM_DISABLE_SHORTCUT_SYNC === '1' && !this._relaunchHooks?.syncShortcuts) return null;
    if (this._shortcutSyncInFlight) {
      if (force) this._shortcutForcePending = true;
      return null;
    }
    const now = Date.now();
    if (!force && this._lastShortcutCheckAt > 0 && now - this._lastShortcutCheckAt < this.shortcutCheckIntervalMs) {
      return null;
    }
    const onDone = (res) => {
      if (res && !res.error) this._lastShortcutCheckAt = Date.now();
      if (res && Array.isArray(res.patched) && res.patched.length > 0) {
        this.log(`[shortcut-guard] Ensured --remote-debugging-port=0 on ${res.patched.length} shortcut(s)`);
      }
      return res;
    };
    const onFinally = () => {
      this._shortcutSyncInFlight = false;
      if (this._shortcutForcePending && this.running) {
        this._shortcutForcePending = false;
        void this._maybeSyncShortcuts(true);
      }
    };
    try {
      if (typeof this._relaunchHooks?.syncShortcuts === 'function') {
        const res = this._relaunchHooks.syncShortcuts({ pluginDir: this.rootDir });
        if (res && typeof res.then === 'function') {
          this._shortcutSyncInFlight = true;
          return res.then(onDone).catch(() => null).finally(onFinally);
        }
        return onDone(res);
      }
      if (typeof this.cdp.ensureAntigravityShortcutsCdpFlagAsync === 'function') {
        this._shortcutSyncInFlight = true;
        return this.cdp
          .ensureAntigravityShortcutsCdpFlagAsync({ pluginDir: this.rootDir })
          .then(onDone)
          .catch(() => null)
          .finally(onFinally);
      }
      if (typeof this.cdp.ensureAntigravityShortcutsCdpFlag === 'function') {
        return onDone(this.cdp.ensureAntigravityShortcutsCdpFlag({ pluginDir: this.rootDir }));
      }
      return null;
    } catch {
      this._shortcutSyncInFlight = false;
      return null;
    }
  }

  async _handleMissingCdpPort() {
    if (!this.running || !this.timer || this._promptInFlight) return;
    if (!this._isRelaunchGuardAllowed()) return;

    const now = Date.now();
    if (this._noPortSinceMs <= 0) {
      this._noPortSinceMs = now;
    }
    this._maybeSyncShortcuts(false);

    if (now - this._noPortSinceMs < this.noPortRelaunchThresholdMs) {
      return;
    }

    const rawCfg = this._readDiskRawConfig();
    if (rawCfg.autoPromptCdpRelaunch === false) {
      return;
    }

    const detectFn =
      typeof this._relaunchHooks?.detectHost === 'function'
        ? this._relaunchHooks.detectHost
        : typeof this.cdp.detectRunningAntigravityHost === 'function'
        ? () => this.cdp.detectRunningAntigravityHost()
        : null;
    if (!detectFn) return;

    const host = await detectFn();
    if (!this.running) return;
    if (!host || !host.pid) {
      this._noPortSinceMs = Date.now();
      return;
    }

    if (host.pid !== this._lastObservedHostPid) {
      this._lastObservedHostPid = host.pid;
      this._maybeSyncShortcuts(true);
    }

    if (host.hasDebugPortSwitch) {
      return;
    }

    const hostAgeMs = host.startMs > 0 ? Math.max(0, Date.now() - host.startMs) : now - this._noPortSinceMs;
    if (hostAgeMs < this.noPortRelaunchThresholdMs) {
      return;
    }

    const extraDirs = Array.isArray(this._relaunchHooks?.stateExtraDirs) ? this._relaunchHooks.stateExtraDirs : [];
    const alreadyPrompted =
      typeof this.cdp.hasRelaunchBeenPromptedForHost === 'function'
        ? this.cdp.hasRelaunchBeenPromptedForHost(this.rootDir, host.pid, host.startMs, extraDirs)
        : false;
    if (alreadyPrompted) {
      return;
    }

    this._promptInFlight = true;
    try {
      if (typeof this.cdp.recordRelaunchPromptState === 'function') {
        this.cdp.recordRelaunchPromptState(this.rootDir, host.pid, host.startMs, 'prompted', extraDirs);
      }
      this.log(`[relaunch-guard] Host pid=${host.pid} running without CDP port; prompting user once`);
      const lang = rawCfg.language || rawCfg.lang || 'zh-CN';
      const promptFn =
        typeof this._relaunchHooks?.promptUser === 'function'
          ? this._relaunchHooks.promptUser
          : typeof this.cdp.promptUserForHostRelaunch === 'function'
          ? (o) => this.cdp.promptUserForHostRelaunch(o)
          : async () => false;
      const confirmed = await promptFn({ lang, host });
      if (!this.running) return;
      if (!confirmed) {
        if (typeof this.cdp.recordRelaunchPromptState === 'function') {
          this.cdp.recordRelaunchPromptState(this.rootDir, host.pid, host.startMs, 'no', extraDirs);
        }
        this.log(`[relaunch-guard] User declined immediate relaunch for pid=${host.pid}; shortcuts ready for next launch`);
        return;
      }
      // 二次复核：若用户在等待点击期间已自行重开带参实例，则直接挂载不再重复重启
      const portNow = discoverActivePort(this.overridePort, this.portFile);
      if (portNow) {
        this._noPortSinceMs = 0;
        return;
      }
      if (typeof this.cdp.recordRelaunchPromptState === 'function') {
        this.cdp.recordRelaunchPromptState(this.rootDir, host.pid, host.startMs, 'yes', extraDirs);
      }
      const spawnFn =
        typeof this._relaunchHooks?.spawnRelaunch === 'function'
          ? this._relaunchHooks.spawnRelaunch
          : typeof this.cdp.spawnDetachedHostRelaunchHelper === 'function'
          ? (t) => this.cdp.spawnDetachedHostRelaunchHelper(t)
          : () => ({ spawned: false });
      const spawnRes = await spawnFn({
        hostPid: host.pid,
        exePath: host.exePath || '',
        pluginDir: this.rootDir,
      });
      this.log(
        `[relaunch-guard] Triggered detached relaunch helper for pid=${host.pid} (spawned=${Boolean(spawnRes?.spawned)}, method=${spawnRes?.method || 'custom'})`
      );
    } finally {
      this._promptInFlight = false;
    }
  }

  async tick() {
    if (!this.running) return { attached: this.sessions.size };
    if (this.busy) {
      this._pendingTick = true;
      return { attached: this.sessions.size };
    }
    this.busy = true;
    this._pendingTick = false;
    try {
      if (!this.isCurrentOwner()) {
        await this.stop(false);
        return { attached: 0, superseded: true };
      }

      if (!this.enabledCheck()) {
        this._noPortSinceMs = 0;
        if (this.sessions.size > 0 || this.browserSession) {
          await this.detachAll(true);
        }
        return { attached: 0, disabled: true };
      }

      const port = discoverActivePort(this.overridePort, this.portFile);
      if (!port) {
        await this._handleMissingCdpPort();
        return { attached: 0, port: null };
      }

      let rawPages = [];
      try {
        rawPages = await this.cdp.listPages(port);
      } catch {
        this.closeBrowserDiscovery();
        if (this.sessions.size === 0) {
          await this._handleMissingCdpPort();
        }
        return { attached: this.sessions.size, port, unreachable: true };
      }

      this._noPortSinceMs = 0;
      if (this.timer) {
        this._maybeSyncShortcuts(false);
      }

      // Subscribe to Browser-level Target.setDiscoverTargets when persistent daemon is running
      if (this.timer) {
        void this.ensureBrowserDiscovery(port);
      }

      const eligible = rawPages.filter((t) => this._isEligibleDaemonTarget(t));
      const activeUrls = new Set(eligible.map((t) => t.webSocketDebuggerUrl));

      for (const [wsUrl, entry] of this.sessions.entries()) {
        if (entry.session.closed) {
          this.sessions.delete(wsUrl);
          continue;
        }
        if (!activeUrls.has(wsUrl)) {
          // Guard live workbench sessions against transient SPA title shifts (e.g. Swarm "Full View" -> "Untitled Conversation"):
          // verify actual in-page DOM before ever issuing REMOVE_EXPRESSION!
          const check = await this.verifyAndHealEntry(entry, true);
          if (check && check.alive && (!check.ready || check.isHostDom)) {
            continue;
          }
          if (!entry.session.closed) {
            if (entry.scriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.scriptId }).catch(() => {});
            }
            if (entry.omniScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.omniScriptId }).catch(() => {});
            }
            if (entry.sidebarScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.sidebarScriptId }).catch(() => {});
            }
            if (entry.hostI18nScriptId) {
              await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.hostI18nScriptId }).catch(() => {});
            }
            await entry.session.evaluate(this.cdp.REMOVE_EXPRESSION).catch(() => {});
          }
          entry.session.close();
          this.sessions.delete(wsUrl);
        }
      }

      if (!this.injectExpr) this.rebuildBundle();

      await Promise.allSettled(
        eligible.map((target) => {
          if (!this.sessions.has(target.webSocketDebuggerUrl)) {
            return this.attachTarget(target);
          }
          return this.verifyAndHealEntry(this.sessions.get(target.webSocketDebuggerUrl));
        })
      );

      if (this._isTelemetryDisabled()) {
        this._releaseIdleTelemetry(true);
      } else {
        this._releaseIdleTelemetry(false);
      }

      return { attached: this.sessions.size, port, pages: eligible.map((p) => p.title || p.url) };
    } finally {
      this.busy = false;
      if (this._pendingTick && this.running) {
        this._pendingTick = false;
        this.scheduleImmediateTick(40);
      }
    }
  }

  stopExistingDaemon({ verifyPid = null, inspectCommandLine = null, killProcess = null } = {}) {
    try {
      if (!this.pidFile) return false;
      let pidStat;
      try {
        pidStat = fs.lstatSync(this.pidFile);
      } catch {
        return false;
      }
      if (pidStat.isSymbolicLink() || !pidStat.isFile()) return false;

      const prevPid =
        typeof this.cdp?.readPidFromLockFile === 'function'
          ? this.cdp.readPidFromLockFile(this.pidFile)
          : (() => {
              const raw = fs.readFileSync(this.pidFile, 'utf8').trim();
              if (/^\d+$/.test(raw)) return parseInt(raw, 10);
              return Number(JSON.parse(raw)?.pid);
            })();
      if (!Number.isInteger(prevPid) || prevPid <= 0 || prevPid === process.pid || !isPidAlive(prevPid)) {
        return false;
      }

      const customVerifier =
        typeof verifyPid === 'function'
          ? verifyPid
          : typeof this._daemonPidVerifier === 'function'
          ? this._daemonPidVerifier
          : null;

      let safeToKill = false;
      if (customVerifier) {
        safeToKill = Boolean(customVerifier(prevPid, this.pidFile));
      } else if (typeof this.cdp?.isExpectedDaemonProcess === 'function') {
        const isDefaultVerifier =
          this.cdp.isExpectedDaemonProcess === this._loadedCdpVerifier ||
          this.cdp.isExpectedDaemonProcess === defaultCdp.isExpectedDaemonProcess;
        const cdpVerified = Boolean(this.cdp.isExpectedDaemonProcess(prevPid, this.pidFile));
        if (!cdpVerified) {
          safeToKill = false;
        } else if (!isDefaultVerifier) {
          // 兼容单测显式覆写 this.cdp.isExpectedDaemonProcess 注入校验钩子
          safeToKill = true;
        } else {
          // 标准 cdp.isExpectedDaemonProcess 对 node.exe 仅核对映像名，补充命令行身份复核防误杀无关 node 进程
          const cmd =
            typeof inspectCommandLine === 'function'
              ? inspectCommandLine(prevPid)
              : queryProcessCommandLineSync(prevPid);
          safeToKill = isObsidianPrismDaemonCommandLine(cmd);
        }
      } else {
        // 无有效身份校验钩子时严格 fail-closed，绝不盲杀无关 PID
        safeToKill = false;
      }

      if (!safeToKill) return false;
      const killer = typeof killProcess === 'function' ? killProcess : (pid) => process.kill(pid);
      try {
        killer(prevPid);
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  claimOwnership() {
    this.stopExistingDaemon();
    try {
      try {
        const st = fs.lstatSync(this.pidFile);
        if (st.isSymbolicLink()) return;
      } catch (err) {
        if (err && err.code !== 'ENOENT') return;
      }
      writeFileAtomicSync(
        this.pidFile,
        JSON.stringify({ pid: process.pid, token: this.ownerToken, startedAt: Date.now() }),
        { mode: 0o600 }
      );
    } catch {}
  }

  isCurrentOwner() {
    try {
      if (!fs.existsSync(this.pidFile)) return true;
      const cur = JSON.parse(fs.readFileSync(this.pidFile, 'utf8'));
      return !cur || !cur.token || cur.token === this.ownerToken;
    } catch {
      return true;
    }
  }

  releaseOwnership() {
    try {
      let st;
      try {
        st = fs.lstatSync(this.pidFile);
      } catch {
        return;
      }
      if (st.isSymbolicLink() || !st.isFile()) return;
      const cur = JSON.parse(fs.readFileSync(this.pidFile, 'utf8'));
      if (cur && cur.token === this.ownerToken) {
        fs.unlinkSync(this.pidFile);
      }
    } catch {}
  }

  start({ claimPid = true, watchFiles = true } = {}) {
    if (this.running) return;
    this._sidebarStopped = false;
    this.running = true;
    if (claimPid) this.claimOwnership();
    const initialPort = discoverActivePort(this.overridePort, this.portFile);
    this.log(`[boot] PrismDaemon started (pid=${process.pid}, activePort=${initialPort || 'none'}, root=${this.rootDir})`);
    this.rebuildBundle();

    if (watchFiles) {
      let pendingCodeChange = false;
      try {
        this.fsw = fs.watch(this.rootDir, { recursive: true }, (_, filename) => {
          if (!this.running) return;
          const base = filename ? path.basename(filename) : '';
          if (!base || base.startsWith('.') || !/\.(css|c?js|mjs|json)$/i.test(base)) return;
          if (base === 'daemon.log' || base === 'watch.log' || base === 'repo-meta.json') return;
          if (base === 'config.json') {
            // Suppress duplicate rebuild right after SETTING_BINDING already broadcasted config refresh!
            if (Date.now() < this._selfConfigWriteUntil) return;
          } else {
            pendingCodeChange = true;
          }
          if (this._reloadTimer) {
            clearTimeout(this._reloadTimer);
            this._reloadTimer = null;
          }
          const delayMs = pendingCodeChange ? 180 : 120;
          this._reloadTimer = setTimeout(async () => {
            this._reloadTimer = null;
            if (!this.running) return;
            const isCodeChange = pendingCodeChange;
            pendingCodeChange = false;
            try {
              if (!isCodeChange) {
                await this.broadcastConfigRefresh();
                return;
              }
              this.rebuildBundle();
              const activeItems = [...this.sessions.values()].filter((e) => e && !e.session.closed);
              await Promise.allSettled(activeItems.map((entry) => this.applyToEntry(entry)));
            } catch {}
          }, delayMs);
          if (this._reloadTimer && typeof this._reloadTimer.unref === 'function') {
            this._reloadTimer.unref();
          }
        });
        if (this.fsw && typeof this.fsw.unref === 'function') this.fsw.unref();
      } catch {}
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    void this.tick();

    if (this._enableAutoUpdateTimer) {
      this._updateInitialTimer = setTimeout(() => {
        this._updateInitialTimer = null;
        if (this.running) {
          void this.runUpdateCheck({ force: false, manual: false, allowAutoApply: true }).catch(() => {});
        }
      }, this._updateCheckInitialDelayMs);
      this._updateInitialTimer?.unref?.();

      this._updateIntervalTimer = setInterval(() => {
        if (this.running) {
          void this.runUpdateCheck({ force: false, manual: false, allowAutoApply: true }).catch(() => {});
        }
      }, this._updateCheckIntervalMs);
      this._updateIntervalTimer?.unref?.();
    }
  }

  async stop(cleanPageDom = false) {
    this._sidebarStopped = true;
    this.running = false;
    if (this._updateInitialTimer) {
      clearTimeout(this._updateInitialTimer);
      this._updateInitialTimer = null;
    }
    if (this._updateIntervalTimer) {
      clearInterval(this._updateIntervalTimer);
      this._updateIntervalTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this._reloadTimer) {
      clearTimeout(this._reloadTimer);
      this._reloadTimer = null;
    }
    if (this._discoverTimer) {
      clearTimeout(this._discoverTimer);
      this._discoverTimer = null;
    }
    if (this._managedTimers) {
      for (const t of this._managedTimers) {
        clearTimeout(t);
      }
      this._managedTimers.clear();
    }
    if (this.sessions && typeof this.sessions.values === 'function') {
      for (const entry of this.sessions.values()) {
        if (entry && entry._healTimer) {
          clearTimeout(entry._healTimer);
          entry._healTimer = null;
        }
      }
    }
    if (this.fsw) {
      try { this.fsw.close(); } catch {}
      this.fsw = null;
    }
    await this.detachAll(cleanPageDom);
    const standaloneLsClient = this._lazyLsClient && this._lazyLsClient !== this._lazyStore?.client ? this._lazyLsClient : null;
    for (const svc of [this._lazyUsage, this._lazyStore, standaloneLsClient, this._lazyThoughtService]) {
      if (!svc) continue;
      try {
        if (typeof svc.dispose === 'function') await svc.dispose();
        else if (typeof svc.close === 'function') await svc.close();
        else if (typeof svc.stop === 'function') await svc.stop();
      } catch {}
    }
    this._lazyUsage = null;
    this._lazyStore = null;
    this._lazyLsClient = null;
    this._backendSummariesCache = null;
    this._backendSummariesAt = 0;
    this._lazyThoughtService = null;
    if (this.omniServer) {
      const srv = this.omniServer;
      this.omniServer = null;
      this._omniServerPromise = null;
      await srv.stop().catch(() => {});
    }
    await this._sidebarServicePromise?.catch(() => null);
    if (this.sidebarService) {
      const sb = this.sidebarService;
      this.sidebarService = null;
      try {
        if (typeof sb.dispose === 'function') await sb.dispose();
      } catch {}
    }
    this.releaseOwnership();
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let once = false;
  let port = null;
  let rootDir = DEFAULT_ROOT_DIR;
  let gitRepoDir = null;
  let outFile = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--once') once = true;
    else if (a === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
    else if (a === '--root' && args[i + 1]) rootDir = path.resolve(args[++i]);
    else if (a === '--repo' && args[i + 1]) gitRepoDir = path.resolve(args[++i]);
    else if (a === '--out' && args[i + 1]) outFile = path.resolve(args[++i]);
  }
  return { once, port, rootDir, gitRepoDir, outFile };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const cli = parseArgs(process.argv);
  const daemon = new PrismDaemon({
    rootDir: cli.rootDir,
    gitRepoDir: cli.gitRepoDir,
    overridePort: cli.port,
  });

  if (cli.once) {
    daemon.running = true;
    daemon.rebuildBundle();
    daemon
      .tick()
      .then(async (res) => {
        if (cli.outFile) {
          fs.writeFileSync(cli.outFile, JSON.stringify({ ok: true, ...res }, null, 2), 'utf8');
        } else {
          console.log(JSON.stringify({ ok: true, ...res }, null, 2));
        }
        await daemon.stop(false);
        process.exit(0);
      })
      .catch(async (err) => {
        console.error('[obsidian-prism daemon] error:', err.message);
        await daemon.stop(false);
        process.exitCode = 1;
      });
  } else {
    daemon.start({ claimPid: true, watchFiles: true });
    const shutdown = async () => {
      await daemon.stop(false);
      process.exit(0);
    };
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
      process.on(sig, () => {
        void shutdown();
      });
    }
    process.on('uncaughtException', (err) => {
      daemon.log(`[!] uncaughtException: ${err?.stack || err}`);
    });
    process.on('unhandledRejection', (err) => {
      daemon.log(`[!] unhandledRejection: ${err?.stack || err}`);
    });
  }
}
