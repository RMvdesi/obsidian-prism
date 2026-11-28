// Obsidian Prism custom.css RPC handlers & zero-AV safe OS file opener (L3 Daemon helper)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { isAutomatedTestRuntime } from './pid-lock.mjs';

const require = createRequire(import.meta.url);
const {
  CUSTOM_CSS_FILENAME,
  MAX_CUSTOM_CSS_BYTES,
  readCustomCssSafe,
  createDefaultCustomCssTemplate,
} = require('../channels/custom-css-loader.cjs');

const ALLOWED_OPEN_STATUSES = new Set(['active', 'empty']);

function isPathStrictlyInside(rootReal, targetReal) {
  const rel = path.relative(rootReal, targetReal);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isRemoteUncOrDevicePath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath) return true;
  if (/^[\\/]{2}/.test(targetPath)) {
    const rest = targetPath.replace(/^[\\/]+/, '');
    if (/^\?[\\/][A-Za-z]:[\\/]/.test(rest)) return false;
    return true;
  }
  return false;
}

/**
 * Zero-AV OS file opener matching omni-server.mjs (Windows explorer.exe, macOS open, Linux xdg-open).
 * Uses child_process.spawn with detached:true, stdio:'ignore', windowsHide:true, .unref(), 0 shell:true.
 * Only opens verified regular .css files on local paths; suppresses real GUI spawn during automated tests.
 */
export function openExternalFileSafe(
  verifiedFilePath,
  { platform = process.platform, spawnFn = spawn, allowInTest = false } = {}
) {
  if (typeof verifiedFilePath !== 'string') return false;
  const targetPath = verifiedFilePath.trim();
  if (!targetPath || /[\x00-\x1f\x7f]/.test(targetPath)) return false;
  if (!path.isAbsolute(targetPath) || isRemoteUncOrDevicePath(targetPath)) return false;
  if (path.extname(targetPath).toLowerCase() !== '.css') return false;

  try {
    const st = fs.lstatSync(targetPath);
    if (st.isSymbolicLink() || !st.isFile() || st.size > MAX_CUSTOM_CSS_BYTES) return false;
  } catch {
    return false;
  }

  if (spawnFn === spawn && !allowInTest && isAutomatedTestRuntime()) {
    return false;
  }

  try {
    const spawnOpts = { detached: true, stdio: 'ignore', windowsHide: true };
    let child;
    if (platform === 'win32') {
      const winPath = targetPath.replace(/\//g, '\\');
      child = spawnFn('explorer.exe', [winPath], spawnOpts);
    } else if (platform === 'darwin') {
      child = spawnFn('open', [targetPath], spawnOpts);
    } else {
      child = spawnFn('xdg-open', [targetPath], spawnOpts);
    }
    child?.on?.('error', () => {});
    child?.unref?.();
    return true;
  } catch {
    return false;
  }
}

export function resolvePluginRootFromRpc(rpc, deps = null) {
  if (typeof deps?.pluginRoot === 'string' && deps.pluginRoot.trim()) return deps.pluginRoot.trim();
  if (typeof deps?.rootDir === 'string' && deps.rootDir.trim()) return deps.rootDir.trim();
  const fromGetter = typeof rpc?.getRootDir === 'function' ? rpc.getRootDir() : '';
  if (typeof fromGetter === 'string' && fromGetter.trim()) return fromGetter.trim();
  if (typeof rpc?.rootDir === 'string' && rpc.rootDir.trim()) return rpc.rootDir.trim();
  const fromCh = rpc?.channelOrchestrator?._rootDir || rpc?.channelOrchestrator?.rootDir || '';
  if (typeof fromCh === 'string' && fromCh.trim()) return fromCh.trim();
  const cfgPath = rpc?.getCdp?.()?.CONFIG_PATH;
  if (typeof cfgPath === 'string' && cfgPath.trim()) return path.dirname(cfgPath);
  return '';
}

function verifyCustomCssForOpen(pluginRoot) {
  const info = readCustomCssSafe(pluginRoot);
  const status = info?.status || 'missing';
  const filePath = info?.filePath || '';
  const sizeBytes = Number(info?.rawBytes ?? info?.bytes ?? 0) || 0;
  const blockedImports = Number(info?.blockedImports) || 0;

  if (!ALLOWED_OPEN_STATUSES.has(status)) {
    return {
      allowed: false,
      status,
      blocked: status.startsWith('rejected-'),
      filePath,
      realPath: '',
      sizeBytes,
      blockedImports,
    };
  }

  try {
    const absRoot = path.resolve(pluginRoot);
    const rootStat = fs.lstatSync(absRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return { allowed: false, status: 'rejected-symlink', blocked: true, filePath, realPath: '', sizeBytes, blockedImports };
    }
    const st = fs.lstatSync(filePath);
    if (st.isSymbolicLink()) {
      return { allowed: false, status: 'rejected-symlink', blocked: true, filePath, realPath: '', sizeBytes: Number(st.size) || sizeBytes, blockedImports };
    }
    if (!st.isFile()) {
      return { allowed: false, status: 'rejected-non-file', blocked: true, filePath, realPath: '', sizeBytes: Number(st.size) || sizeBytes, blockedImports };
    }
    if (st.size > MAX_CUSTOM_CSS_BYTES) {
      return { allowed: false, status: 'rejected-too-large', blocked: true, filePath, realPath: '', sizeBytes: st.size, blockedImports };
    }
    const realRoot = fs.realpathSync(absRoot);
    const realPath = fs.realpathSync(filePath);
    if (!isPathStrictlyInside(realRoot, realPath) || path.basename(realPath).toLowerCase() !== CUSTOM_CSS_FILENAME) {
      return { allowed: false, status: 'rejected-symlink', blocked: true, filePath, realPath: '', sizeBytes, blockedImports };
    }
    return {
      allowed: true,
      status,
      blocked: false,
      filePath,
      realPath,
      sizeBytes,
      blockedImports,
    };
  } catch {
    return { allowed: false, status: 'error', blocked: false, filePath, realPath: '', sizeBytes, blockedImports };
  }
}

async function invokeExternalOpener(verifiedRealPath, rpc, deps = null) {
  const customOpener =
    typeof deps?.openExternalFile === 'function'
      ? deps.openExternalFile
      : typeof rpc?.openExternalFile === 'function'
        ? rpc.openExternalFile
        : null;
  if (customOpener) {
    try {
      const res = await customOpener(verifiedRealPath);
      if (res === false) return false;
      if (res && typeof res === 'object' && (res.ok === false || res.opened === false)) return false;
      return true;
    } catch {
      return false;
    }
  }
  return openExternalFileSafe(verifiedRealPath);
}

export async function handleCustomCssOpen(rpc, deps = null) {
  const pluginRoot = resolvePluginRootFromRpc(rpc, deps);
  const check = verifyCustomCssForOpen(pluginRoot);
  if (!check.allowed) {
    return {
      ok: false,
      status: check.status,
      opened: false,
      blocked: check.blocked,
      filePath: check.filePath,
      sizeBytes: check.sizeBytes,
      blockedImports: check.blockedImports,
    };
  }
  const opened = await invokeExternalOpener(check.realPath, rpc, deps);
  return {
    ok: opened,
    status: check.status,
    opened,
    blocked: false,
    filePath: check.filePath,
    sizeBytes: check.sizeBytes,
    blockedImports: check.blockedImports,
  };
}

export async function handleCustomCssCreateTemplate(rpc, deps = null) {
  const pluginRoot = resolvePluginRootFromRpc(rpc, deps);
  const ch = rpc?.channelOrchestrator || null;
  const res = createDefaultCustomCssTemplate(pluginRoot);
  const status = res?.status || 'error';

  if (!res || !res.ok) {
    if (typeof ch?.refreshCustomStyleChannel === 'function') {
      await ch.refreshCustomStyleChannel({ forceEval: true }).catch(() => null);
    }
    return {
      ok: false,
      created: false,
      opened: false,
      blocked: status.startsWith('rejected-'),
      status,
    };
  }

  if (typeof ch?.refreshCustomStyleChannel === 'function') {
    await ch.refreshCustomStyleChannel({ forceEval: true });
  }

  const check = verifyCustomCssForOpen(pluginRoot);
  if (!check.allowed) {
    return {
      ok: false,
      created: false,
      opened: false,
      blocked: check.blocked,
      status: check.status,
    };
  }

  const opened = await invokeExternalOpener(check.realPath, rpc, deps);
  return {
    ok: true,
    created: Boolean(res.created),
    exists: Boolean(res.exists),
    status: check.status,
    opened,
    blocked: false,
    filePath: check.filePath,
    sizeBytes: check.sizeBytes,
    blockedImports: check.blockedImports,
  };
}

export async function handleCustomCssSettingAction(rpc, action, deps = null) {
  if (action === 'custom-css-open') {
    return handleCustomCssOpen(rpc, deps);
  }
  if (action === 'custom-css-create-template') {
    return handleCustomCssCreateTemplate(rpc, deps);
  }
  if (action === 'custom-css-reload') {
    if (typeof rpc?.channelOrchestrator?.refreshCustomStyleChannel === 'function') {
      return rpc.channelOrchestrator.refreshCustomStyleChannel({ forceEval: true });
    }
    return { ok: false, reason: 'channel-orchestrator-unavailable' };
  }
  return null;
}

const SETTINGS_COMPANION_PROBE_EXPR =
  '(() => { const hasSet = Boolean(window.__agPrismSettingsPanel || globalThis.__agPrismSettingsPanel); if (!hasSet) return { hasSet: false }; const ui = window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi; return { hasSet: true, hash: String(ui?.__prismUiRuntimeHash || "") }; })()';

export async function deliverCustomStyleSettingsUiToEntry(orch, entry, { cfg = null } = {}) {
  if (!orch || !entry || entry.session?.closed) return false;
  const cdp = orch.getCdp();
  if (typeof cdp?.buildCustomStyleSettingsUiExpression !== 'function') return false;
  const uiExpr = cdp.buildCustomStyleSettingsUiExpression(cfg || (typeof cdp.readConfig === 'function' ? cdp.readConfig() : null));
  if (!uiExpr || entry.session.closed) return false;
  let res = null;
  try {
    res = await entry.session.evaluate(uiExpr, false, 3500);
  } catch {
    res = null;
  }
  if (res && res.ok) {
    entry.settingsChannelDelivered = true;
    return true;
  }
  return false;
}

export async function syncStaleCustomStyleSettingsUiOnEntry(orch, entry, getCurrentCfg) {
  if (!orch || !entry || entry.session?.closed) return false;
  const cdp = orch.getCdp();
  const expectedUiHash = typeof cdp?.getCustomStyleSettingsUiRuntimeHash === 'function' ? cdp.getCustomStyleSettingsUiRuntimeHash() : '';
  if (!expectedUiHash) return false;
  const probe = await entry.session.evaluate(SETTINGS_COMPANION_PROBE_EXPR, false, 1800).catch(() => null);
  if (!probe || !probe.hasSet) return false;
  entry.settingsChannelDelivered = true;
  if (probe.hash === expectedUiHash) return false;
  return deliverCustomStyleSettingsUiToEntry(orch, entry, { cfg: typeof getCurrentCfg === 'function' ? getCurrentCfg() : null });
}
