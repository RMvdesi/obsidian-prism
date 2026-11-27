// 跨平台 Antigravity 快捷方式 CDP 参数补齐与卸载还原统一门面（Windows .lnk / Linux XDG .desktop）
'use strict';

const fs = require('fs');
const path = require('path');
const {
  PATCHED_SHORTCUTS_FILENAME,
  appendCdpFlagToArguments,
  stripCdpFlagFromArguments,
  isAntigravityShortcutTarget,
  readPatchedShortcutsRecord,
  writePatchedShortcutsRecord,
} = require('./shortcut-flags.cjs');
const {
  runWindowsShortcutAdapter,
  runWindowsShortcutAdapterAsync,
} = require('./win-lnk.cjs');
const {
  ensureLinuxDesktopShortcutsCdpFlag,
  restoreLinuxDesktopShortcutsCdpFlag,
} = require('./linux-desktop.cjs');

// 异步非阻塞版：供常驻 Daemon 事件循环后台巡检快捷方式，避免 execFileSync 卡死 CDP RPC 与 Omni 流式媒体
async function ensureAntigravityShortcutsCdpFlagAsync(opts = {}) {
  const effectivePlatform = opts.platformOverride || process.platform;
  if (effectivePlatform === 'linux' && typeof opts.shortcutAdapter !== 'function') {
    return ensureLinuxDesktopShortcutsCdpFlag(opts);
  }
  const isWinPlatform = effectivePlatform === 'win32';
  if (!isWinPlatform && typeof opts.shortcutAdapter !== 'function') {
    return { supported: false, scanned: 0, matched: 0, patched: [], alreadySet: [], skipped: [] };
  }
  try {
    const adapter =
      typeof opts.shortcutAdapter === 'function'
        ? await opts.shortcutAdapter(opts.searchDirs || null, [])
        : await runWindowsShortcutAdapterAsync(opts.searchDirs || null, []);
    const entries = Array.isArray(adapter?.entries) ? adapter.entries : [];
    const updates = [];
    const alreadySet = [];
    let matched = 0;
    for (const item of entries) {
      if (!item || !isAntigravityShortcutTarget(item.targetPath)) continue;
      matched += 1;
      const next = appendCdpFlagToArguments(item.arguments);
      if (next.changed) {
        updates.push({ lnkPath: item.lnkPath, arguments: next.args });
      } else {
        alreadySet.push(item.lnkPath);
      }
    }
    const writeRes = updates.length > 0 ? await adapter.applyUpdates(updates) : { applied: [], skipped: [] };
    if (opts.pluginDir && writeRes.applied.length > 0) {
      const prev = readPatchedShortcutsRecord(opts.pluginDir);
      writePatchedShortcutsRecord(opts.pluginDir, [...prev, ...writeRes.applied]);
    }
    return {
      supported: true,
      scanned: entries.length,
      matched,
      patched: writeRes.applied,
      alreadySet,
      skipped: writeRes.skipped,
    };
  } catch (err) {
    return {
      supported: true,
      scanned: 0,
      matched: 0,
      patched: [],
      alreadySet: [],
      skipped: [],
      error: String(err && err.message ? err.message : err),
    };
  }
}

// 扫描并无损为 Antigravity 快捷方式（Windows .lnk / Linux XDG .desktop）补齐 --remote-debugging-port=0
function ensureAntigravityShortcutsCdpFlag(opts = {}) {
  const effectivePlatform = opts.platformOverride || process.platform;
  if (effectivePlatform === 'linux' && typeof opts.shortcutAdapter !== 'function') {
    return ensureLinuxDesktopShortcutsCdpFlag(opts);
  }
  const isWinPlatform = effectivePlatform === 'win32';
  if (!isWinPlatform && typeof opts.shortcutAdapter !== 'function') {
    return { supported: false, scanned: 0, matched: 0, patched: [], alreadySet: [], skipped: [] };
  }
  try {
    const adapter =
      typeof opts.shortcutAdapter === 'function'
        ? opts.shortcutAdapter(opts.searchDirs || null, [])
        : runWindowsShortcutAdapter(opts.searchDirs || null, []);
    const entries = Array.isArray(adapter?.entries) ? adapter.entries : [];
    const updates = [];
    const alreadySet = [];
    let matched = 0;
    for (const item of entries) {
      if (!item || !isAntigravityShortcutTarget(item.targetPath)) continue;
      matched += 1;
      const next = appendCdpFlagToArguments(item.arguments);
      if (next.changed) {
        updates.push({ lnkPath: item.lnkPath, arguments: next.args });
      } else {
        alreadySet.push(item.lnkPath);
      }
    }
    const writeRes = updates.length > 0 ? adapter.applyUpdates(updates) : { applied: [], skipped: [] };
    if (opts.pluginDir && writeRes.applied.length > 0) {
      const prev = readPatchedShortcutsRecord(opts.pluginDir);
      writePatchedShortcutsRecord(opts.pluginDir, [...prev, ...writeRes.applied]);
    }
    return {
      supported: true,
      scanned: entries.length,
      matched,
      patched: writeRes.applied,
      alreadySet,
      skipped: writeRes.skipped,
    };
  } catch (err) {
    return {
      supported: true,
      scanned: 0,
      matched: 0,
      patched: [],
      alreadySet: [],
      skipped: [],
      error: String(err && err.message ? err.message : err),
    };
  }
}

// 卸载时精准剥离 Antigravity 快捷方式（Windows .lnk / Linux XDG .desktop + Shadow Copy 撤回）中的 --remote-debugging-port=0
function restoreAntigravityShortcutsCdpFlag(opts = {}) {
  const effectivePlatform = opts.platformOverride || process.platform;
  if (effectivePlatform === 'linux' && typeof opts.shortcutAdapter !== 'function') {
    return restoreLinuxDesktopShortcutsCdpFlag(opts);
  }
  const isWinPlatform = effectivePlatform === 'win32';
  if (!isWinPlatform && typeof opts.shortcutAdapter !== 'function') {
    return { supported: false, restored: [], skipped: [] };
  }
  try {
    const recorded = opts.pluginDir ? readPatchedShortcutsRecord(opts.pluginDir) : [];
    const adapter =
      typeof opts.shortcutAdapter === 'function'
        ? opts.shortcutAdapter(opts.searchDirs || null, recorded)
        : runWindowsShortcutAdapter(opts.searchDirs || null, recorded);
    const entries = Array.isArray(adapter?.entries) ? adapter.entries : [];
    const updates = [];
    for (const item of entries) {
      if (!item || !isAntigravityShortcutTarget(item.targetPath)) continue;
      const next = stripCdpFlagFromArguments(item.arguments);
      if (next.changed) {
        updates.push({ lnkPath: item.lnkPath, arguments: next.args });
      }
    }
    const writeRes = updates.length > 0 ? adapter.applyUpdates(updates) : { applied: [], skipped: [] };
    if (opts.pluginDir) {
      try {
        const recFile = path.join(opts.pluginDir, PATCHED_SHORTCUTS_FILENAME);
        if (fs.existsSync(recFile)) fs.unlinkSync(recFile);
      } catch {}
    }
    return {
      supported: true,
      restored: writeRes.applied,
      skipped: writeRes.skipped,
    };
  } catch (err) {
    return {
      supported: true,
      restored: [],
      skipped: [],
      error: String(err && err.message ? err.message : err),
    };
  }
}

module.exports = {
  ensureAntigravityShortcutsCdpFlagAsync,
  ensureAntigravityShortcutsCdpFlag,
  restoreAntigravityShortcutsCdpFlag,
};
