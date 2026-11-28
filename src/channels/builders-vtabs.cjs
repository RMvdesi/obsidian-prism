// 第十八通道独立构建器：右侧侧面板纵向标签栏（默认 off 时 0 磁盘读取 / 0 编译 / 0 B 注入）
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
const { minifyCss, packCssJsExpr } = require('../compiler/css-pack.cjs');
const { minifySingleSource } = require('../compiler/js-string-pool.cjs');
const { CHANNEL_MAIN_FRAME_HOST_GUARD } = require('./host-guard.cjs');
const { SIDE_PANEL_VTABS_CLEANUP_BODY } = require('./channel-teardowns.cjs');
const {
  SIDE_PANEL_VTABS_JS_FILES,
  SIDE_PANEL_VTABS_CSS_FILES,
} = require('./registry.cjs');

function unwrapConfigAndOpts(config, opts) {
  let resolvedCfg = config;
  let resolvedOpts = opts;
  if (
    !resolvedOpts &&
    config &&
    typeof config === 'object' &&
    ('cachePath' in config || 'noDiskCache' in config || 'deferCacheWrite' in config) &&
    !('sidePanelVerticalTabs' in config)
  ) {
    resolvedOpts = config;
    resolvedCfg = null;
  }
  return { resolvedCfg, resolvedOpts };
}

function createVtabsChannelBuilders({ rootDir, readConfig, bundleCache }) {
  function shouldEnableSidePanelVerticalTabs(config = null) {
    const cfg = config && typeof config === 'object' ? reconcileConfigAliases(config) : readConfig();
    return cfg.sidePanelVerticalTabs === 'on';
  }

  function readCompiledSidePanelVtabsAssets(opts = null) {
    const baseDir = path.join(rootDir, 'vendor', 'side-panel-vertical-tabs');
    const jsEntries = SIDE_PANEL_VTABS_JS_FILES.map((name) => ({
      name,
      rel: `vendor/side-panel-vertical-tabs/${name}`,
      fullPath: path.join(baseDir, name),
    }));
    const cssEntries = SIDE_PANEL_VTABS_CSS_FILES.map((name) => ({
      name,
      rel: `vendor/side-panel-vertical-tabs/${name}`,
      fullPath: path.join(baseDir, name),
    }));
    const allEntries = [...jsEntries, ...cssEntries];
    if (allEntries.some((item) => !fs.existsSync(item.fullPath))) {
      return { sig: '', minRuntime: '', codeHash: '' };
    }

    const sig = allEntries.map((item) => `${item.name}:${getFileSig(item.fullPath)}`).join('|');
    const cachePath = resolveBundleCachePathOption(opts);
    const curMem = bundleCache.getChannelMemCache('sidePanelVtabs');
    if (!cachePath && curMem && curMem.sig === sig && curMem.codeHash) {
      return curMem;
    }

    const extraTag = allEntries.map((item) => item.name).join(',');
    return bundleCache.resolveChannelAssetsWithDiskCache({
      channelName: 'sidePanelVtabs',
      sig,
      fileEntries: allEntries.map(({ rel, fullPath }) => ({ rel, fullPath })),
      extraTag,
      opts,
      compileFn: () => {
        const jsParts = [];
        for (const item of jsEntries) {
          const minPart = minifySingleSource(fs.readFileSync(item.fullPath, 'utf8'), { allowMemberProps: false });
          if (minPart) jsParts.push(minPart);
        }
        const combinedCss = cssEntries.map((item) => fs.readFileSync(item.fullPath, 'utf8')).join('\n');
        const minCss = minifyCss(combinedCss);
        if (jsParts.length !== jsEntries.length || !minCss) {
          return { minRuntime: '', codeHash: '' };
        }
        const packedCssExpr = packCssJsExpr(minCss, { flatten: false });
        const cssAssign = `globalThis.__agPrismSidePanelVtabsCss=window.__agPrismSidePanelVtabsCss=${packedCssExpr};`;
        const bootTail =
          'if(!(globalThis.__agPrismSidePanelVtabs||window.__agPrismSidePanelVtabs)&&typeof __vtabsNs.createSidePanelVerticalTabsController==="function"){const _c=__vtabsNs.createSidePanelVerticalTabsController({win:window,doc:document});window.__agPrismSidePanelVtabs=_c;globalThis.__agPrismSidePanelVtabs=_c;}';
        const minRuntime = `(()=>{const __vtabsNs={};const __vtabsInit=(fn)=>{if(typeof fn==="function")fn(__vtabsNs);};${cssAssign}${jsParts.join(';\n')};${bootTail}})()`;
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

  // 第十八通道独立注入（右侧侧面板纵向标签栏 6 JS + 2 CSS 模块）：完全独立于 Channel 1，接入 minRuntime 磁盘缓存，默认 off 时 0 B
  function buildSidePanelVerticalTabsExpression(config = null, opts = null) {
    const { resolvedCfg, resolvedOpts } = unwrapConfigAndOpts(config, opts);
    const cfg = resolvedCfg && typeof resolvedCfg === 'object' ? reconcileConfigAliases(resolvedCfg) : readConfig();
    if (!shouldEnableSidePanelVerticalTabs(cfg)) {
      return '';
    }
    const { minRuntime, codeHash } = readCompiledSidePanelVtabsAssets(resolvedOpts);
    if (!minRuntime || !codeHash) {
      return '';
    }
    const hashJson = serializeJsonForEval(codeHash);

    return `(() => {
  try {
${CHANNEL_MAIN_FRAME_HOST_GUARD}

    let liveCfg = null;
    try {
      const cur = (window.__agPrism || window.__agClaudeStyle)?.getState?.()?.cfg;
      if (cur && typeof cur === 'object') liveCfg = cur;
      if (liveCfg && liveCfg.sidePanelVerticalTabs !== undefined && liveCfg.sidePanelVerticalTabs !== 'on') {
        ${SIDE_PANEL_VTABS_CLEANUP_BODY}
        return { ok: true, status: 'off', skippedByLiveCfg: true };
      }
    } catch {}

    const targetHash = ${hashJson};
    const mountOrReuse = () => {
      if (needDomMarkerOnReady && !hasDomMarker() && (isPlainHttpLocalhost || !/\\bantigravity\\b/i.test(String(document.title || '')))) {
        return { ok: false, status: 'skipped-non-host' };
      }
      const existing = globalThis.__agPrismSidePanelVtabs || window.__agPrismSidePanelVtabs;
      if (existing && existing.__prismCodeHash === targetHash && !existing.getState?.()?.destroyed) {
        try { existing.sync?.(liveCfg || { sidePanelVerticalTabs: 'on' }); } catch {}
        return { ok: true, reused: true, codeHash: targetHash };
      }
      try { existing?.destroy?.(); } catch {}
      ${minRuntime};
      let mod = null;
      try {
        mod = globalThis.__agPrismSidePanelVtabs || window.__agPrismSidePanelVtabs;
        if (mod && typeof mod === 'object') {
          mod.__prismCodeHash = targetHash;
          window.__agPrismSidePanelVtabs = mod;
          globalThis.__agPrismSidePanelVtabs = mod;
        }
      } catch {}
      try {
        mod?.sync?.(liveCfg || { sidePanelVerticalTabs: 'on' });
      } catch {}
      return { ok: true, status: 'mounted', codeHash: targetHash };
    };

    if (needDomMarkerOnReady && typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', () => { try { mountOrReuse(); } catch {} }, { once: true });
      return { ok: true, status: 'deferred', codeHash: targetHash };
    }
    return mountOrReuse();
  } catch (err) {
    const msg = String((err && err.message) || err).slice(0, 300);
    return { ok: false, status: 'error', channel: 'sidePanelVtabs', message: msg, error: msg, stack: String((err && err.stack) || '').slice(0, 600) };
  }
})()`;
  }

  return {
    SIDE_PANEL_VTABS_JS_FILES,
    SIDE_PANEL_VTABS_CSS_FILES,
    shouldEnableSidePanelVerticalTabs,
    readCompiledSidePanelVtabsAssets,
    buildSidePanelVerticalTabsExpression,
  };
}

module.exports = {
  createVtabsChannelBuilders,
};
