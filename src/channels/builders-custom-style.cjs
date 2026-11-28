// Channel 18 builder: Global UI Font & Local custom.css On-Demand Channel (L1, zero external deps)
'use strict';

const fs = require('fs');
const path = require('path');
const {
  getFileSig,
  sha256Text,
  computeHash,
  serializeJsonForEval,
} = require('../utils/fs-safe.cjs');
const { reconcileConfigAliases } = require('../config/schema.cjs');
const { resolveBundleCachePathOption } = require('../compiler/cache-validate.cjs');
const { minifySingleSource } = require('../compiler/js-string-pool.cjs');
const { CHANNEL_MAIN_FRAME_HOST_GUARD } = require('./host-guard.cjs');
const { readCustomCssSafe } = require('./custom-css-loader.cjs');

const CUSTOM_STYLE_FILES = Object.freeze([
  'vendor/custom-style/custom-style-client.js',
]);
const CUSTOM_STYLE_SETTINGS_UI_FILES = Object.freeze([
  'vendor/custom-style/custom-style-i18n.js',
  'vendor/custom-style/font-picker-ui.js',
  'vendor/custom-style/custom-style-settings-ui.js',
]);

function pickCustomStyleBootPatch(cfg) {
  return {
    uiFont: cfg.uiFont,
    uiFontCustom: cfg.uiFontCustom,
    customCss: cfg.customCss,
    chatFont: cfg.chatFont,
    chatFontCustom: cfg.chatFontCustom,
    codeFont: cfg.codeFont,
    codeFontCustom: cfg.codeFontCustom,
    language: cfg.language,
    lang: cfg.lang,
  };
}

function readCustomCssMetadata(rootDir) {
  const snap = readCustomCssSafe(rootDir);
  return {
    status: snap.status || 'missing',
    bytes: snap.bytes || 0,
    rawBytes: snap.rawBytes || 0,
    maxBytes: snap.maxBytes || 256 * 1024,
    sha256: snap.sha256 || '',
    blockedImports: snap.blockedImports || 0,
    fileName: 'custom.css',
  };
}

function unwrapConfigAndOpts(config, opts) {
  let resolvedCfg = config;
  let resolvedOpts = opts;
  if (
    !resolvedOpts &&
    config &&
    typeof config === 'object' &&
    ('cachePath' in config || 'noDiskCache' in config || 'deferCacheWrite' in config) &&
    !('uiFont' in config || 'uiFontCustom' in config || 'customCss' in config || 'chatFont' in config || 'chatFontCustom' in config || 'codeFont' in config || 'codeFontCustom' in config || 'language' in config || 'lang' in config)
  ) {
    resolvedOpts = config;
    resolvedCfg = null;
  }
  return { resolvedCfg, resolvedOpts };
}

function createCustomStyleChannelBuilders({ rootDir, readConfig, bundleCache }) {
  let _settingsUiCache = { sig: '', minUi: '', codeHash: '' };

  function shouldEnableCustomStyle(config = null) {
    const cfg = config && typeof config === 'object' ? reconcileConfigAliases(config) : readConfig();
    const cssOn = cfg.customCss !== 'off' && cfg.customCss !== false;
    const uiFontActive = typeof cfg.uiFont === 'string' && cfg.uiFont.trim() !== '' && cfg.uiFont.trim() !== 'default';
    return cssOn || uiFontActive;
  }

  function readCompiledSettingsUiAssets() {
    const absPaths = CUSTOM_STYLE_SETTINGS_UI_FILES.map((rel) => path.join(rootDir, ...rel.split('/')));
    if (absPaths.some((p) => !fs.existsSync(p))) {
      return { sig: '', minUi: '', codeHash: '' };
    }
    const sig = absPaths.map((p) => getFileSig(p)).join('|');
    if (_settingsUiCache.sig === sig && _settingsUiCache.codeHash) {
      return _settingsUiCache;
    }
    const minUi = absPaths
      .map((p) => minifySingleSource(fs.readFileSync(p, 'utf8'), { allowMemberProps: false }))
      .join(';\n');
    const codeHash = computeHash(minUi);
    _settingsUiCache = { sig, minUi, codeHash };
    return _settingsUiCache;
  }

  function readCompiledCustomStyleAssets(opts = null) {
    const absPaths = CUSTOM_STYLE_FILES.map((rel) => path.join(rootDir, ...rel.split('/')));
    if (absPaths.some((p) => !fs.existsSync(p))) {
      return { sig: '', minRuntime: '', codeHash: '' };
    }
    const sig = absPaths.map((p) => getFileSig(p)).join('|');
    const cachePath = resolveBundleCachePathOption(opts);
    const curMem = bundleCache.getChannelMemCache('customStyle');
    if (!cachePath && curMem && curMem.sig === sig && curMem.codeHash) {
      return curMem;
    }
    const fileEntries = CUSTOM_STYLE_FILES.map((rel, i) => ({ rel, fullPath: absPaths[i] }));
    return bundleCache.resolveChannelAssetsWithDiskCache({
      channelName: 'customStyle',
      sig,
      fileEntries,
      opts,
      compileFn: () => {
        const minRuntime = absPaths
          .map((p) => minifySingleSource(fs.readFileSync(p, 'utf8'), { allowMemberProps: false }))
          .join(';\n');
        const codeHash = computeHash(minRuntime);
        return { minRuntime, codeHash };
      },
      toCacheEntry: (assets, sourceHash) => ({
        sourceHash,
        codeHash: assets.codeHash,
        minRuntime: assets.minRuntime,
        payloadSha256: sha256Text(`${assets.codeHash}\0${assets.minRuntime}`),
        updatedAt: Date.now(),
      }),
      fromCacheEntry: (entry) => ({
        minRuntime: entry.minRuntime,
        codeHash: entry.codeHash,
      }),
    });
  }

  function buildCustomStyleChannelExpression(config = null, opts = null) {
    const { resolvedCfg, resolvedOpts } = unwrapConfigAndOpts(config, opts);
    const cfg = resolvedCfg && typeof resolvedCfg === 'object' ? reconcileConfigAliases(resolvedCfg) : readConfig();
    if (!shouldEnableCustomStyle(cfg)) return '';

    const { minRuntime, codeHash: runtimeCodeHash } = readCompiledCustomStyleAssets(resolvedOpts);
    if (!minRuntime || !runtimeCodeHash) return '';

    const cssEnabled = cfg.customCss !== 'off' && cfg.customCss !== false;
    const cssSnap = readCustomCssSafe(rootDir);
    const customCssPayload = {
      status: cssSnap.status || 'missing',
      css: cssEnabled && cssSnap.status === 'active' ? cssSnap.css : '',
      bytes: cssEnabled ? (cssSnap.bytes || 0) : 0,
      rawBytes: cssSnap.rawBytes || 0,
      maxBytes: cssSnap.maxBytes || 256 * 1024,
      sha256: cssSnap.sha256 || '',
      blockedImports: cssEnabled ? (cssSnap.blockedImports || 0) : 0,
      fileName: 'custom.css',
    };

    const targetHash = computeHash(
      `${runtimeCodeHash}\0${cssEnabled ? 1 : 0}\0${customCssPayload.status}\0${customCssPayload.sha256}\0${customCssPayload.blockedImports}\0${cfg.uiFont || 'default'}\0${cfg.uiFontCustom || ''}\0${cfg.chatFont || 'default'}\0${cfg.chatFontCustom || ''}\0${cfg.codeFont || 'default'}\0${cfg.codeFontCustom || ''}\0${cfg.language || cfg.lang || 'auto'}`
    );
    const bootCfgJson = serializeJsonForEval(cfg);
    const ch18PatchJson = serializeJsonForEval(pickCustomStyleBootPatch(cfg));
    const payloadJson = serializeJsonForEval(customCssPayload);
    const hashJson = serializeJsonForEval(targetHash);

    return `(() => {
  try {
${CHANNEL_MAIN_FRAME_HOST_GUARD}

    const cleanupCustomStyle = () => {
      try { (window.__agPrismCustomStyle || globalThis.__agPrismCustomStyle)?.destroy?.(document); } catch {}
      try { document.getElementById?.('ag-prism-ui-font-style')?.remove?.(); } catch {}
      try { document.getElementById?.('ag-prism-user-custom-css')?.remove?.(); } catch {}
      try { document.documentElement?.removeAttribute?.('data-ag-cs-ui-font'); } catch {}
      try { document.documentElement?.removeAttribute?.('data-ag-prism-custom-css'); } catch {}
      try { delete window.__agPrismCustomStyle; } catch {}
      try { delete globalThis.__agPrismCustomStyle; } catch {}
    };
    const getLiveCfg = () => {
      try {
        const st = (window.__agPrism || window.__agClaudeStyle)?.getState?.();
        return st && st.cfg && typeof st.cfg === 'object' ? st.cfg : null;
      } catch { return null; }
    };

    const bootCfg = ${bootCfgJson};
    const ch18BootPatch = ${ch18PatchJson};
    const customCssPayload = ${payloadJson};
    const targetHash = ${hashJson};

    const mountOrReuse = () => {
      if (needDomMarkerOnReady && !hasDomMarker() && (isPlainHttpLocalhost || !/\\bantigravity\\b/i.test(String(document.title || '')))) {
        return { ok: false, status: 'skipped-non-host' };
      }
      const liveCfg = getLiveCfg();
      const effectiveCfg = liveCfg ? Object.assign({}, bootCfg, liveCfg, ch18BootPatch) : bootCfg;
      const cssOff = effectiveCfg.customCss === 'off' || effectiveCfg.customCss === false;
      const uiDefault = !effectiveCfg.uiFont || effectiveCfg.uiFont === 'default';
      if (cssOff && uiDefault) {
        cleanupCustomStyle();
        try { (window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi)?.syncIfPresent?.(document, window, effectiveCfg, customCssPayload); } catch {}
        return { ok: true, status: 'off', skippedByLiveCfg: true };
      }

      const existing = window.__agPrismCustomStyle || globalThis.__agPrismCustomStyle;
      const existingCodeHash = existing ? existing.__prismCodeHash : '';
      const existingUi = window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi;
      if (
        existing &&
        (existingCodeHash === targetHash || existing.__prismRuntimeHash === ${serializeJsonForEval(runtimeCodeHash)})
      ) {
        existing.__prismCodeHash = targetHash;
        try { existing.sync?.(effectiveCfg, customCssPayload, document); } catch {}
        try { existingUi?.setCustomCssMeta?.(customCssPayload); } catch {}
        try { existingUi?.syncIfPresent?.(document, window, effectiveCfg, customCssPayload); } catch {}
        return { ok: true, reused: true, codeHash: targetHash };
      }

      cleanupCustomStyle();
      ;${minRuntime};

      const mounted = window.__agPrismCustomStyle || globalThis.__agPrismCustomStyle;
      if (mounted && typeof mounted === 'object') {
        mounted.__prismCodeHash = targetHash;
        mounted.__prismRuntimeHash = ${serializeJsonForEval(runtimeCodeHash)};
        try { window.__agPrismCustomStyle = mounted; } catch {}
        try { globalThis.__agPrismCustomStyle = mounted; } catch {}
      }
      try { mounted?.sync?.(effectiveCfg, customCssPayload, document); } catch {}
      const liveUi = window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi;
      try { liveUi?.setCustomCssMeta?.(customCssPayload); } catch {}
      try { liveUi?.syncIfPresent?.(document, window, effectiveCfg, customCssPayload); } catch {}
      return { ok: true, status: 'mounted', codeHash: targetHash };
    };

    if ((needDomMarkerOnReady || !document.documentElement) && typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', () => { try { mountOrReuse(); } catch {} }, { once: true });
      return { ok: true, status: 'deferred', codeHash: targetHash };
    }
    return mountOrReuse();
  } catch (err) {
    return { ok: false, status: 'error', channel: 'customStyle', error: String(err && err.message || err).slice(0, 300), stack: String(err && err.stack || '').slice(0, 600) };
  }
  })()`;
  }

  function buildCustomStyleSettingsUiExpression(config = null) {
    const cfg = config && typeof config === 'object' ? reconcileConfigAliases(config) : readConfig();
    const { minUi, codeHash: uiRuntimeHash } = readCompiledSettingsUiAssets();
    if (!minUi || !uiRuntimeHash) return '';
    const meta = readCustomCssMetadata(rootDir);
    const bootCfgJson = serializeJsonForEval(cfg);
    const ch18PatchJson = serializeJsonForEval(pickCustomStyleBootPatch(cfg));
    const metaJson = serializeJsonForEval(meta);
    const hashJson = serializeJsonForEval(uiRuntimeHash);
    return `(() => {
  try {
${CHANNEL_MAIN_FRAME_HOST_GUARD}
    if (needDomMarkerOnReady && !hasDomMarker() && (isPlainHttpLocalhost || !/\\bantigravity\\b/i.test(String(document.title || '')))) {
      return { ok: false, status: 'skipped-non-host' };
    }
    const bootCfg = ${bootCfgJson};
    const ch18BootPatch = ${ch18PatchJson};
    const meta = ${metaJson};
    const uiRuntimeHash = ${hashJson};
    let liveCfg = null;
    try {
      const st = (window.__agPrism || window.__agClaudeStyle)?.getState?.();
      if (st && st.cfg && typeof st.cfg === 'object') liveCfg = st.cfg;
    } catch {}
    const effectiveCfg = liveCfg ? Object.assign({}, bootCfg, liveCfg, ch18BootPatch) : bootCfg;
    const existingUi = window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi;
    if (existingUi && existingUi.__prismUiRuntimeHash === uiRuntimeHash) {
      try { existingUi.setCustomCssMeta?.(meta); } catch {}
      try { existingUi.install?.(document, window); } catch {}
      try { existingUi.syncIfPresent?.(document, window, effectiveCfg, meta); } catch {}
      return { ok: true, reused: true, codeHash: uiRuntimeHash };
    }
    ;${minUi};
    const mountedUi = window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi;
    if (mountedUi && typeof mountedUi === 'object') {
      mountedUi.__prismUiRuntimeHash = uiRuntimeHash;
      try { window.__agPrismCustomStyleSettingsUi = mountedUi; } catch {}
      try { globalThis.__agPrismCustomStyleSettingsUi = mountedUi; } catch {}
    }
    try { mountedUi?.setCustomCssMeta?.(meta); } catch {}
    try { mountedUi?.install?.(document, window); } catch {}
    try { mountedUi?.syncIfPresent?.(document, window, effectiveCfg, meta); } catch {}
    return { ok: true, status: 'mounted', codeHash: uiRuntimeHash };
  } catch (err) {
    return { ok: false, status: 'error', channel: 'customStyleSettingsUi', error: String(err && err.message || err).slice(0, 300) };
  }
})()`;
  }

  function buildCustomStyleSettingsMetaSyncExpression(config = null) {
    const cfg = config && typeof config === 'object' ? reconcileConfigAliases(config) : readConfig();
    const meta = readCustomCssMetadata(rootDir);
    const patchJson = serializeJsonForEval(pickCustomStyleBootPatch(cfg));
    const metaJson = serializeJsonForEval(meta);
    return `(() => {
  try {
    const ui = window.__agPrismCustomStyleSettingsUi || globalThis.__agPrismCustomStyleSettingsUi;
    if (!ui) return { ok: true, status: 'no-ui' };
    const meta = ${metaJson};
    const patch = ${patchJson};
    try { ui.setCustomCssMeta?.(meta); } catch {}
    try { ui.syncIfPresent?.(document, window, patch, meta); } catch {}
    return { ok: true, status: 'synced' };
  } catch (err) {
    return { ok: false, status: 'error', error: String(err && err.message || err).slice(0, 300) };
  }
})()`;
  }

  function getCustomStyleSettingsUiRuntimeHash() {
    return readCompiledSettingsUiAssets().codeHash || '';
  }

  return {
    shouldEnableCustomStyle,
    getCustomStyleSettingsUiRuntimeHash,
    buildCustomStyleChannelExpression,
    buildCustomStyleSettingsUiExpression,
    buildCustomStyleSettingsMetaSyncExpression,
  };
}

module.exports = {
  CUSTOM_STYLE_FILES,
  CUSTOM_STYLE_SETTINGS_UI_FILES,
  createCustomStyleChannelBuilders,
};
