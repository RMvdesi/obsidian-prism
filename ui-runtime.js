(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.__agCsUiMain = factory;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (initialConfig) {
  const VERSION = '1.0.7-beta.1';
  const D = document, W = window, GT = globalThis, ST = setTimeout, CT = clearTimeout, O = Object, AF = Array.from, LS = typeof localStorage !== 'undefined' ? localStorage : null;
  const LEGACY_API_VERSION = 3;
  const CODE_HASH = initialConfig?.codeHash || '';

  if (W.__agTokenHud) {
    try {
      W.__agTokenHud.destroy();
    } catch {}
    delete W.__agTokenHud;
  }

  const existingRuntime = W.__agPrism || W.__agClaudeStyle;
  if (
    existingRuntime &&
    existingRuntime.version === VERSION &&
    (!CODE_HASH || existingRuntime.codeHash === CODE_HASH)
  ) {
    existingRuntime.refreshConfig(initialConfig);
    return;
  }
  if (Array.isArray(GT.__agCsCleanups)) {
    while (GT.__agCsCleanups.length) {
      const fn = GT.__agCsCleanups.pop();
      try {
        if (typeof fn === 'function') fn();
      } catch {}
    }
  }
  if (W.__agPrism && typeof W.__agPrism.destroy === 'function') {
    try {
      W.__agPrism.destroy();
    } catch {}
  }
  if (W.__agClaudeStyle && W.__agClaudeStyle !== W.__agPrism && typeof W.__agClaudeStyle.destroy === 'function') {
    try {
      W.__agClaudeStyle.destroy();
    } catch {}
  }
  delete W.__agPrism;
  delete W.__agClaudeStyle;

  if (W.__agCsI18n && typeof W.__agCsI18n.destroy === 'function') {
    try {
      W.__agCsI18n.destroy();
    } catch {}
    delete W.__agCsI18n;
  }

  const usageCore = GT.__agCsUsageCore;
  const rippleCore = GT.__agCsRippleCore;
  const i18nCore = GT.__agCsI18nCore;
  const i18nLocales = GT.__agCsLocales;
  const dualMascotRig = GT.__agDualMascotRig;
  const crystalPrismCore = GT.__agCrystalPrismCore;
  const motionEngine = GT.__agMotionEngine;
  const animatedIcons = GT.__agAnimatedIcons;
  const pulseVialBridgeMod = GT.__agCsPulseVialBridge;
  const convAuraMod = GT.__agPrismConvAura;
  const smoothCaretMod = GT.__agPrismSmoothCaret;
  const settingsPanelMod = GT.__agPrismSettingsPanel;
  const homeStudioMod = GT.__agPrismHomeStudioPanel;
  const homeRippleMod = GT.__agPrismHomeRippleHost;
  const modelGlyphMod = GT.__agPrismModelGlyphCrystal;
  const streamChoreoMod = GT.__agPrismStreamChoreography;
  const prismRimMod = GT.__agPrismRimCanvas;
  const hostEnhancerMod = GT.__agPrismHostEnhancer;
  let ownedCtxMenu = W.__agPrismContextMenu || GT.__agPrismContextMenu || null;

  // 新品牌 Obsidian Prism 主存储键 + 旧版历史键平滑迁移兼容
  const STORAGE_PRISM_KEY = 'ag-prism:config';
  const STORAGE_LEGACY_COLON_KEY = 'ag-claude-style:config';
  const STORAGE_LEGACY_V3_KEY = 'agClaudeStyle.settings.v3';
  const STORAGE_FILE_CFG_KEY = 'ag-prism:lastFileConfig';
  const STORAGE_USAGE_CACHE_KEY = 'ag-prism:trajRollup.v1';
  const SETTINGS_SEC_ID = 'ag-cs-settings-sec';
  const MODEL_PANEL_SEL = '[data-testid="model-selector-panel"]';
  const BLUR_ATTR = 'data-ag-cs-win-blur';
  const K_IC = 'isConnected', K_PE = 'parentElement', K_TC = 'textContent', K_CL = 'classList';
  const de = () => D.documentElement;
  const byId = (id) => D.getElementById?.(id) || null;
  const ga = (e, k) => e?.getAttribute?.(k);
  const sa = (e, k, v = '') => e?.setAttribute?.(k, String(v));
  const ha = (e, k) => Boolean(e?.hasAttribute?.(k));
  const ra = (e, k) => e?.removeAttribute?.(k);
  const qs = (e, s) => (e && e.querySelector ? e.querySelector(s) : null);
  const qa = (e, s) => (e && e.querySelectorAll ? e.querySelectorAll(s) : []);
  const cl = (e, s) => (e && e.closest ? e.closest(s) : null);
  const sp = (e, k, v) => e?.style?.setProperty?.(k, v);
  const rp = (e, k) => e?.style?.removeProperty?.(k);
  const clHas = (e, c) => Boolean(e?.[K_CL]?.contains?.(c));
  const rc = (e) => (typeof e?.getBoundingClientRect === 'function' ? e.getBoundingClientRect() : null);
  const tidOf = (e) => String(ga(e, 'data-testid') || '');
  const tagU = (e) => String(e?.tagName || '').toUpperCase();

  const isElementLike = (n) => {
    return Boolean(n && (n.nodeType === 1 || (n.nodeType === undefined && typeof n.tagName === 'string')));
  };

  const safeParseJsonObj = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const BOOL_ALIAS_PAIRS = [['homeRipple', 'ripple'], ['composerRestyle', 'composer'], ['sidebarRestyle', 'sidebar']];

  const normalizeConfigShape = (rawCfg) => {
    const out = { ...(rawCfg || {}) };
    out.palette = out.palette === 'claude' ? 'warm' : ['host', 'obsidian', 'warm'].includes(out.palette) ? out.palette : 'obsidian';
    out.lightPreset = out.lightPreset === 'alabaster' ? 'alabaster' : 'crystal';
    if (!['off', 'subtle', 'standard', 'ultra'].includes(out.motionLevel)) out.motionLevel = 'ultra';
    if (!['60', '120', '180', 'native'].includes(out.targetFps)) out.targetFps = '180';
    for (const k of ['telemetryModule', 'effortSliderModule', 'hostLocalization']) {
      out[k] = out[k] === 'on' || out[k] === 'off' ? out[k] : 'auto';
    }
    out.thoughtTranslate = out.thoughtTranslate === 'machine' || out.thoughtTranslate === 'ai' ? out.thoughtTranslate : 'off';
    out.thoughtTrigger = out.thoughtTrigger === 'expand' ? 'expand' : 'preload';

    const rawHome = out.homeLayout ?? out.homeMode ?? 'studio';
    out.homeLayout = out.homeMode = rawHome === 'classic' ? 'classic' : rawHome === 'off' ? 'off' : 'studio';

    for (const [bKey, sKey] of BOOL_ALIAS_PAIRS) {
      const on = out[bKey] !== undefined ? out[bKey] !== false && out[bKey] !== 'off' : out[sKey] !== undefined ? out[sKey] !== 'off' && out[sKey] !== false : true;
      out[bKey] = on;
      out[sKey] = on ? 'on' : 'off';
    }

    out.placeholderStyle = out.promptStyle = (out.placeholderStyle ?? out.promptStyle ?? 'studio') === 'host' ? 'host' : 'studio';
    out.mascot = out.mascot === 'off' || out.mascot === false ? 'off' : out.mascot === 'minis' ? 'minis' : 'crab';
    out.sidebarCompact = out.sidebarCompact === true || out.sidebarCompact === 'on';
    out.sidebarNavFold = out.sidebarNavFold === 'on' || out.sidebarNavFold === true ? 'on' : 'off';
    out.smoothCaret = out.smoothCaret === undefined ? true : out.smoothCaret !== false && out.smoothCaret !== 'off';
    out.contextMenu = out.contextMenu === undefined ? true : out.contextMenu !== false && out.contextMenu !== 'off';
    if (!['follow', 'cobalt', 'iris', 'amber', 'mono'].includes(out.accentTone)) out.accentTone = 'follow';
    if (!['sharp', 'balanced', 'soft'].includes(out.cornerStyle)) out.cornerStyle = 'balanced';
    out.scrollBottomMotion = out.scrollBottomMotion === 'instant' ? 'instant' : 'smooth';
    if (!['default', 'jetbrains', 'cascadia', 'sfmono'].includes(out.codeFont)) out.codeFont = 'default';
    out.codeLigatures = out.codeLigatures === true || out.codeLigatures === 'on';
    const rawAmb = String(out.ambientIntensity ?? '100');
    out.ambientIntensity = ['0', '35', '70', '100'].includes(rawAmb) ? rawAmb : '100';
    out.thoughtView = out.thoughtView === 'bilingual' ? 'bilingual' : 'immersive';
    out.omniModule = out.omniModule === 'off' || out.omniModule === false ? 'off' : 'on';
    out.sidebarStudio = out.sidebarStudio === 'on' || out.sidebarStudio === true ? 'on' : 'off';
    out.linkTarget = out.linkTarget === 'external' ? 'external' : 'builtin';
    out.autoUpdate = out.autoUpdate === 'on' || out.autoUpdate === true ? 'on' : 'off';
    out.updateChannel = out.updateChannel === 'beta' ? 'beta' : 'stable';

    const rawLang = (out.language && out.language !== 'auto' ? out.language : '') || (out.lang && out.lang !== 'auto' ? out.lang : '');
    if (rawLang) out.language = out.lang = rawLang;
    return out;
  };

  const expandSettingAliases = (rawPatch) => {
    const patch = { ...(rawPatch || {}) };
    if (patch.palette === 'claude') patch.palette = 'warm';
    if (patch.mascot === 'dual') patch.mascot = 'crab';
    for (const [a, b] of [['language', 'lang'], ['homeLayout', 'homeMode'], ['placeholderStyle', 'promptStyle']]) {
      if (a in patch) patch[b] = patch[a];
      else if (b in patch) patch[a] = patch[b];
    };
    for (const [bKey, sKey] of BOOL_ALIAS_PAIRS) {
      if (bKey in patch || sKey in patch) {
        const raw = bKey in patch ? patch[bKey] : patch[sKey];
        const on = raw !== false && raw !== 'off';
        patch[bKey] = on;
        patch[sKey] = on ? 'on' : 'off';
      }
    }
    for (const k of ['sidebarCompact', 'codeLigatures']) {
      if (k in patch && typeof patch[k] === 'string') patch[k] = patch[k] === 'on' || patch[k] === 'true';
    }
    for (const k of ['smoothCaret', 'contextMenu']) {
      if (k in patch && typeof patch[k] === 'string') patch[k] = patch[k] !== 'off' && patch[k] !== 'false';
    }
    for (const k of ['telemetryModule', 'effortSliderModule', 'omniModule', 'sidebarStudio', 'autoUpdate', 'sidebarNavFold']) {
      if (k in patch && typeof patch[k] === 'boolean') patch[k] = patch[k] ? 'on' : 'off';
    }
    return patch;
  };

  const stripRuntimeMetaKeys = (obj) => {
    const clean = { ...(obj || {}) };
    delete clean.binding;
    delete clean.pollIntervalMs;
    delete clean.codeHash;
    delete clean.__fromFile;
    delete clean.__ackEpoch;
    return clean;
  };

  // 差量感知配置加载：当外部 config.json 或 refreshConfig 发生字段变更时，自动穿透更新 LS 消除跨端配置脑裂
  const loadSettings = (base, explicitOverride = null) => {
    try {
      const cleanBase = expandSettingAliases(stripRuntimeMetaKeys(base));
      const baseJson = JSON.stringify(cleanBase);
      const prevBaseRaw = LS.getItem(STORAGE_FILE_CFG_KEY);
      const prevBaseObj = safeParseJsonObj(prevBaseRaw);

      const savedV3 = safeParseJsonObj(LS.getItem(STORAGE_LEGACY_V3_KEY));
      const savedLegacyColon = safeParseJsonObj(LS.getItem(STORAGE_LEGACY_COLON_KEY));
      const savedPrism = safeParseJsonObj(LS.getItem(STORAGE_PRISM_KEY));
      const mergedSaved = { ...(savedV3 || {}), ...(savedLegacyColon || {}), ...(savedPrism || {}) };

      let savedMutated = false;
      if (prevBaseObj) {
        for (const [k, v] of O.entries(cleanBase)) {
          if (JSON.stringify(prevBaseObj[k]) !== JSON.stringify(v)) {
            O.assign(mergedSaved, expandSettingAliases({ [k]: v }));
            savedMutated = true;
          }
        }
      }
      if (explicitOverride && typeof explicitOverride === 'object') {
        const cleanOverride = stripRuntimeMetaKeys(explicitOverride);
        if (O.keys(cleanOverride).length > 0) {
          O.assign(mergedSaved, expandSettingAliases(cleanOverride));
          savedMutated = true;
        }
      }

      if (!prevBaseRaw || prevBaseRaw !== baseJson) {
        LS.setItem(STORAGE_FILE_CFG_KEY, baseJson);
      }
      if (savedMutated || (!savedPrism && (savedLegacyColon || savedV3))) {
        const serialized = JSON.stringify(mergedSaved);
        LS.setItem(STORAGE_PRISM_KEY, serialized);
        LS.setItem(STORAGE_LEGACY_V3_KEY, serialized);
      }
      if (savedLegacyColon && typeof LS.removeItem === 'function') {
        LS.removeItem(STORAGE_LEGACY_COLON_KEY);
      }

      return normalizeConfigShape({ ...cleanBase, ...mergedSaved });
    } catch {
      return normalizeConfigShape({ ...stripRuntimeMetaKeys(base), ...stripRuntimeMetaKeys(explicitOverride) });
    }
  };

  let currentBaseConfig = { ...(initialConfig || {}) };
  delete currentBaseConfig.__fromFile;
  delete currentBaseConfig.__ackEpoch;
  let localWriteEpoch = 0;
  let cfg = loadSettings(currentBaseConfig);
  let destroyed = false;
  let internalDomMutating = false;
  let pendingHiddenFullSync = false;

  // 细粒度增量同步标记与脏节点队列
  const dirtyAddedRoots = new Set();
  const dirtyCollapsibleTargets = new Set();
  const dirtyBgCmds = new Set();
  const dirtyTurboRoots = new Set();
  let mainObserver = null;
  let lastFormalConvEl = null;
  let lastFormalCascadeId = '';
  let lastStoreSnapKey = '';
  const dirtyFlags = {
    f: true,
    t: false,
    r: false,
    s: false,
    a: false,
    c: false,
    b: false,
    o: false,
    l: false,
    tk: false,
    cf: false,
    g: false,
    m: false,
  };
  const perfStats = {
    lastSyncMs: 0,
    syncCount: 0,
    iconIncrementalRuns: 0,
    iconFullRuns: 0,
  };

  const markAllDirty = () => {
    dirtyFlags.f = dirtyFlags.t = dirtyFlags.r = dirtyFlags.s = dirtyFlags.a = dirtyFlags.c = dirtyFlags.b = dirtyFlags.o = dirtyFlags.l = dirtyFlags.tk = dirtyFlags.cf = dirtyFlags.g = dirtyFlags.m = true;
  };

  const resolveWireSettingPair = (key, value) => {
    const base = currentBaseConfig || {};
    if (key === 'homeLayout' && 'homeMode' in base && !('homeLayout' in base)) return ['homeMode', value];
    if (key === 'homeRipple' && 'ripple' in base && !('homeRipple' in base)) return ['ripple', value ? 'on' : 'off'];
    if (key === 'composerRestyle' && 'composer' in base && !('composerRestyle' in base)) return ['composer', value ? 'on' : 'off'];
    if (key === 'placeholderStyle' && 'promptStyle' in base && !('placeholderStyle' in base)) return ['promptStyle', value];
    if (key === 'sidebarRestyle' && 'sidebar' in base && !('sidebarRestyle' in base)) return ['sidebar', value ? 'on' : 'off'];
    if ((key === 'sidebarCompact' || key === 'smoothCaret' || key === 'contextMenu') && typeof base[key] === 'string') return [key, value ? 'on' : 'off'];
    if (key === 'language' && 'lang' in base && !('language' in base)) return ['lang', value];
    if ((key === 'telemetryModule' || key === 'effortSliderModule' || key === 'omniModule' || key === 'sidebarStudio' || key === 'autoUpdate' || key === 'sidebarNavFold') && typeof value === 'boolean') {
      return [key, value ? 'on' : 'off'];
    }
    if (key === 'palette' && value === 'claude') return ['palette', 'warm'];
    if (key === 'mascot') return ['mascot', value === 'dual' ? 'crab' : value];
    return [key, value];
  };

  const routeConfigDirtyFlags = (prevCfg, nextCfg, patch) => {
    dirtyFlags.g = true;
    const chg = (k) => prevCfg[k] !== nextCfg[k] || O.hasOwn(patch, k);
    if (chg('palette') || chg('lightPreset') || chg('accentTone') || chg('ambientIntensity') || chg('cornerStyle') || chg('codeFont') || chg('codeLigatures')) {
      dirtyFlags.t = true;
    };
    if (chg('accentTone') || chg('composerRestyle') || chg('placeholderStyle') || chg('mascot') || chg('smoothCaret') || chg('telemetryModule') || chg('motionLevel') || chg('language')) {
      dirtyFlags.c = true;
    }
    if (chg('homeLayout') || chg('homeRipple') || chg('language')) dirtyFlags.r = true;
    if (chg('sidebarRestyle') || chg('sidebarCompact') || chg('sidebarNavFold')) dirtyFlags.s = true;
    if (chg('thoughtTranslate') || chg('thoughtTrigger') || chg('thoughtView')) dirtyFlags.l = dirtyFlags.tk = true;
  };

  const persistAndApplyConfigPatch = (rawPatch, emitSingleKey = null) => {
    const prevCfg = { ...cfg };
    const patch = expandSettingAliases(rawPatch);
    O.assign(currentBaseConfig, stripRuntimeMetaKeys(patch));
    cfg = normalizeConfigShape({ ...cfg, ...patch });

    try {
      const saved = safeParseJsonObj(LS.getItem(STORAGE_PRISM_KEY)) || {};
      O.assign(saved, patch);
      const serialized = JSON.stringify(saved);
      LS.setItem(STORAGE_PRISM_KEY, serialized);
      LS.setItem(STORAGE_LEGACY_V3_KEY, serialized);
      if (typeof LS.removeItem === 'function') {
        LS.removeItem(STORAGE_LEGACY_COLON_KEY);
      }

      const lastFile = safeParseJsonObj(LS.getItem(STORAGE_FILE_CFG_KEY));
      if (lastFile) {
        O.assign(lastFile, patch);
        LS.setItem(STORAGE_FILE_CFG_KEY, JSON.stringify(lastFile));
      }
    } catch {}

    const writeEp = ++localWriteEpoch;
    try {
      const send = W[cfg.binding] || W.__agPrismSetting || W.__agClaudeStyleSetting;
      if (typeof send === 'function') {
        if (emitSingleKey !== null) {
          const [wireKey, wireVal] = resolveWireSettingPair(emitSingleKey, rawPatch[emitSingleKey]);
          send(JSON.stringify({ key: wireKey, value: wireVal, clientEpoch: writeEp }));
        } else {
          const entries = {};
          for (const [k, v] of O.entries(rawPatch || {})) {
            const [wk, wv] = resolveWireSettingPair(k, v);
            entries[wk] = wv;
          }
          if (O.keys(entries).length > 0) {
            send(JSON.stringify({ action: 'patch-batch', entries, clientEpoch: writeEp }));
          }
        }
      }
    } catch {}

    routeConfigDirtyFlags(prevCfg, cfg, patch);
    applyRootAttrs();
    scheduleSync();
  };

  const saveSetting = (key, value) => {
    persistAndApplyConfigPatch({ [key]: value }, key);
  };

  const saveSettingsBatch = (patchObj) => {
    if (!patchObj || typeof patchObj !== 'object') return;
    persistAndApplyConfigPatch(patchObj, null);
  };

  const getLang = () => {
    const raw =
      cfg.language ||
      (cfg.lang && cfg.lang !== 'auto' ? cfg.lang : '') ||
      currentBaseConfig?.language ||
      (currentBaseConfig?.lang && currentBaseConfig.lang !== 'auto' ? currentBaseConfig.lang : '') ||
      (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN');
    if (i18nCore && typeof i18nCore.normalizeLanguage === 'function') {
      return i18nCore.normalizeLanguage(raw);
    }
    if (raw === 'zh-TW' || raw === 'yue' || raw === 'en' || raw === 'ja') return raw;
    const low = String(raw || '').toLowerCase();
    if (low.startsWith('zh-tw') || low.startsWith('zh-hk')) return 'zh-TW';
    if (low.startsWith('yue')) return 'yue';
    if (low.startsWith('ja')) return 'ja';
    if (low.startsWith('en')) return 'en';
    return 'zh-CN';
  };

  const uiText = (lang = getLang()) => {
    if (i18nLocales && typeof i18nLocales.getUiStrings === 'function') {
      return i18nLocales.getUiStrings(lang);
    }
    return {};
  };

  const isZh = () => {
    const lang = getLang();
    return lang === 'zh-CN' || lang === 'zh-TW' || lang === 'yue';
  };

  const isDarkTheme = () => {
    const b = D.body?.classList;
    const h = D.documentElement?.classList;
    if (b?.contains('theme-light') || b?.contains('light-theme') || b?.contains('light')) return false;
    if (b?.contains('theme-dark') || b?.contains('dark') || b?.contains('dark-theme')) return true;
    if (h?.contains('theme-light') || h?.contains('light-theme') || h?.contains('light')) return false;
    if (h?.contains('theme-dark') || h?.contains('dark') || h?.contains('dark-theme')) return true;
    return true;
  };

  const getEffectivePalette = () => {
    const p = cfg.palette === 'claude' ? 'warm' : cfg.palette;
    return p === 'obsidian' || p === 'warm' || p === 'host' ? p : 'obsidian';
  };

  const getLightPreset = () => {
    return cfg.lightPreset === 'alabaster' ? 'alabaster' : 'crystal';
  };

  const getMotionLevel = () => {
    const v = cfg.motionLevel;
    return v === 'off' || v === 'subtle' || v === 'standard' || v === 'ultra' ? v : 'ultra';
  };

  const getTargetFps = () => {
    const v = String(cfg.targetFps || '');
    return v === '60' || v === '120' || v === '180' || v === 'native' ? v : '180';
  };

  const getMinFrameGapMs = () => {
    const fps = getTargetFps();
    if (fps === 'native') return 0;
    if (fps === '60') return 15.2;
    if (fps === '120') return 7.5;
    return 4.8;
  };

  const getTelemetryMode = () => {
    return cfg.telemetryModule === 'on' || cfg.telemetryModule === 'off' ? cfg.telemetryModule : 'auto';
  };

  const getEffortSliderMode = () => {
    return cfg.effortSliderModule === 'on' || cfg.effortSliderModule === 'off' ? cfg.effortSliderModule : 'auto';
  };

  const getThoughtTranslateMode = () => {
    return cfg.thoughtTranslate === 'machine' || cfg.thoughtTranslate === 'ai' ? cfg.thoughtTranslate : 'off';
  };

  const getThoughtTriggerTiming = () => {
    return cfg.thoughtTrigger === 'expand' ? 'expand' : 'preload';
  };

  const getAccentTone = () => {
    const v = cfg.accentTone;
    return v === 'cobalt' || v === 'iris' || v === 'amber' || v === 'mono' ? v : 'follow';
  };

  const getCornerStyle = () => {
    const v = cfg.cornerStyle;
    return v === 'sharp' || v === 'soft' ? v : 'balanced';
  };

  const getCodeFont = () => {
    const v = cfg.codeFont;
    return v === 'jetbrains' || v === 'cascadia' || v === 'sfmono' ? v : 'default';
  };

  const isCodeLigaturesEnabled = () => {
    return cfg.codeLigatures === true || cfg.codeLigatures === 'on';
  };

  const isContextMenuEnabled = () => {
    return cfg.contextMenu !== false && cfg.contextMenu !== 'off';
  };

  const getAmbientIntensitySetting = () => {
    const v = String(cfg.ambientIntensity ?? '100');
    return v === '0' || v === '35' || v === '70' || v === '100' ? v : '100';
  };

  const getAmbientCssValue = () => {
    const v = getAmbientIntensitySetting();
    if (v === '0') return '0';
    if (v === '35') return '0.35';
    if (v === '70') return '0.7';
    return '1';
  };

  const getAmbientFloat = () => {
    const v = getAmbientIntensitySetting();
    if (v === '0') return 0;
    if (v === '35') return 0.35;
    if (v === '70') return 0.7;
    return 1;
  };

  const getThoughtView = () => {
    return cfg.thoughtView === 'bilingual' ? 'bilingual' : 'immersive';
  };

  const getOmniMode = () => {
    return cfg.omniModule === 'off' || cfg.omniModule === false ? 'off' : 'on';
  };

  const getLinkTarget = () => {
    return cfg.linkTarget === 'external' ? 'external' : 'builtin';
  };

  const resolveAuraSpectrumMode = () => {
    const acc = getAccentTone();
    if (acc !== 'follow') return acc;
    const pal = getEffectivePalette();
    if (pal === 'warm') return 'warm';
    if (pal === 'obsidian' && !isDarkTheme() && getLightPreset() === 'alabaster') return 'warm';
    return 'default';
  };

  const isMascotEnabled = () => cfg.mascot !== 'off';

  const motionReduced = () => {
    if (cfg.motionLevel === 'off') return true;
    return typeof matchMedia === 'function' && Boolean(matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  };

  const isMotionStandardOrUltra = () => {
    if (motionReduced()) return false;
    const lv = getMotionLevel();
    return lv === 'standard' || lv === 'ultra';
  };

  const isMotionUltra = () => {
    return !motionReduced() && getMotionLevel() === 'ultra';
  };

  const canMountRealCanvas = (node) => {
    try {
      const doc = node?.ownerDocument;
      if (!doc || typeof doc.createElement !== 'function') return false;
      const cv = doc.createElement('canvas');
      return Boolean(cv && cv.dataset && typeof cv.getContext === 'function' && cv.getContext('2d'));
    } catch {
      return false;
    }
  };

  // ── Built-in Thought Translator Overlay Isolation Helpers (Zero-Flicker Guard) ──
  const THOUGHT_ISOLATED_SELECTOR = '.ag-prism-thought-overlay, .ag-prism-thought-raw-toggle, [data-prism-ignore]';

  const isThoughtIsolatedNode = (node) => {
    if (!node) return false;
    const el = isElementLike(node) ? node : node[K_PE];
    if (!el) return false;
    if (
      clHas(el, 'ag-prism-thought-overlay') ||
      clHas(el, 'ag-prism-thought-raw-toggle') ||
      clHas(el, 'ag-prism-thought-body') ||
      ha(el, 'data-prism-ignore')
    ) {
      return true;
    }
    return Boolean(cl(el, THOUGHT_ISOLATED_SELECTOR));
  };

  const isThoughtMutationRecord = (m) => {
    if (!m) return false;
    if (isThoughtIsolatedNode(m.target)) return true;
    const added = m.addedNodes;
    const removed = m.removedNodes;
    const addLen = added ? added.length : 0;
    const remLen = removed ? removed.length : 0;
    if (addLen + remLen > 0) {
      for (let i = 0; i < addLen; i++) {
        if (!isThoughtIsolatedNode(added[i])) return false;
      }
      for (let i = 0; i < remLen; i++) {
        if (!isThoughtIsolatedNode(removed[i])) return false;
      }
      return true;
    }
    return false;
  };

  const isManagedThoughtPanel = (panel) => {
    if (!panel || !isElementLike(panel)) return false;
    return ha(panel, 'data-op-zh-ready') || ha(panel, 'data-op-zh-pending') || Boolean(qs(panel, '.ag-prism-thought-overlay'));
  };

  const runGuardedMut = (fn) => {
    const prev = internalDomMutating;
    internalDomMutating = true;
    try {
      return fn();
    } finally {
      if (!prev && mainObserver && typeof mainObserver.takeRecords === 'function') {
        try {
          mainObserver.takeRecords();
        } catch {}
      }
      internalDomMutating = prev;
    }
  };

  const setAttrIfChanged = (el, name, val) => {
    if (el && ga(el, name) !== val) sa(el, name, val);
  };

  // ── Antigravity React Fiber & Store Bridge ─────────────────────────────
  let cachedSvc = null;
  let cachedStore = null;
  let storeUnsub = null;
  let storeDebounce = null;

  const ensureHooks = (allowPartial = false) => {
    if (cachedSvc && cachedStore) return { svc: cachedSvc, store: cachedStore };
    const anchors = qa(
      D,
      '[data-testid="conversation-view"], [data-testid="agent-input-box"], [data-testid="conversation-row-sidebar"], [data-testid="new-conversation-button"], [data-testid="home-greeting"]'
    );
    for (const el of anchors) {
      const key = O.keys(el).find((k) => k.startsWith('__reactFiber$'));
      for (let f = key && el[key]; f && !(cachedSvc && cachedStore); f = f.return) {
        const p = f.memoizedProps;
        if (!cachedStore && p && p.store && typeof p.store.getState === 'function') {
          cachedStore = p.store;
        }
        for (let d = f.dependencies && f.dependencies.firstContext; d; d = d.next) {
          const v = d.memoizedValue;
          if (!v || typeof v !== 'object') continue;
          if (!cachedSvc && typeof v.getCascadeTrajectory === 'function') cachedSvc = v;
          if (!cachedStore && v.store && typeof v.store.getState === 'function') cachedStore = v.store;
        }
      }
      if (cachedSvc && cachedStore) break;
    }
    if (cachedStore && !storeUnsub) {
      storeUnsub = cachedStore.subscribe(() => {
        if (destroyed || storeDebounce) return;
        storeDebounce = ST(() => {
          storeDebounce = null;
          if (!destroyed) onStoreChanged();
        }, 400);
      });
    }
    if (cachedSvc && cachedStore) return { svc: cachedSvc, store: cachedStore };
    if (allowPartial && (cachedSvc || cachedStore)) return { svc: cachedSvc, store: cachedStore };
    return null;
  };

  const getDisplayName = () => {
    const h = ensureHooks(true);
    const raw = String(h?.store?.getState()?.userStatus?.name || '').trim();
    if (!raw) return '';
    return raw.split(/\s+/)[0] || raw;
  };

  const resolveCascadeId = (inputBox) => {
    const cv = inputBox ? cl(inputBox, '[data-testid="conversation-view"]') : qs(D, '[data-testid="conversation-view"]');
    if (inputBox && !cv && cl(inputBox, '.agy-home')) return '';
    if (cv) {
      const attrId = ga(cv, 'data-cascade-id');
      if (attrId && attrId !== 'conversation') return attrId;
    }
    const m = location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    const readCascadeFromFiber = (el, maxDepth) => {
      if (!el) return '';
      const key = O.keys(el).find((k) => k.startsWith('__reactFiber$'));
      for (let f = key && el[key], d = 0; f && d < maxDepth; f = f.return, d++) {
        const p = f.memoizedProps || f.pendingProps;
        if (p && typeof p.cascadeId === 'string' && p.cascadeId) return p.cascadeId;
      }
      return '';
    };
    const fromInputFiber = readCascadeFromFiber(inputBox, 60);
    if (fromInputFiber) return fromInputFiber;
    const fromCvFiber = readCascadeFromFiber(cv, 35);
    if (fromCvFiber) return fromCvFiber;
    if (cv && !cl(inputBox, '[data-testid="subagent-tab-conversation"]')) {
      const h = ensureHooks(true);
      const convoState = h?.store?.getState?.()?.conversation?.convoState;
      if (convoState?.type === 'active' && typeof convoState.cascadeId === 'string' && convoState.cascadeId) {
        return convoState.cascadeId;
      }
      if (convoState?.type === 'subagent' && typeof convoState.childConversationId === 'string' && convoState.childConversationId) {
        return convoState.childConversationId;
      }
    }
    return '';
  };

  // ── Official Dual Mascot Stage ─────────────────────────────────────────
  let msRoot = null, msRig = null, msAnc = null, msOrch = null, msLastTier, msLastHostSleep = false, msActAt = 0;

  const notifyMascot = (eventName, payload) => {
    try { msRig?.notify?.(eventName, payload || {}); } catch {}
  };

  const getLightweightActiveInfo = (card) => {
    if (!card) return null;
    const inputBox = cl(card, '[data-testid="agent-input-box"]');
    const cv = cl(card, '[data-testid="conversation-view"]');
    const cascadeId = cv ? resolveCascadeId(inputBox) : '';
    let isRunning = Boolean(qs(card, '[data-testid="input-cancel-button"]'));
    let isThinking = false;
    let hasError = false;
    if (cascadeId) {
      const st = ensureHooks(true)?.store?.getState?.();
      const sums = st?.trajectorySummaries?.summaries || st?.cascadeTrajectorySummaries || {};
      const entry = sums[cascadeId];
      const sum = entry?.summary || entry || {};
      if (sum.notFullyIdle || sum.hasActivity || sum.status === 2 || sum.hasRunningSubagents) isRunning = true;
      if (sum.status === 3 || sum.hasError) hasError = true;
    }
    if (cv && isRunning) {
      const thinkingEl = qs(cv, '[data-testid="thinking-collapsible-trigger"], [data-testid="worked-for-collapsible"]');
      if (thinkingEl && String(thinkingEl[K_TC] || '').includes('...')) isThinking = true;
    }
    return { cascadeId, isRunning, isThinking, hasError };
  };

  let crabRemoveAttrTimer = 0;

  const unmountCrab = () => {
    if (crabRemoveAttrTimer) {
      CT(crabRemoveAttrTimer);
      crabRemoveAttrTimer = 0;
    }
    try { msRig?.dispose?.(); } catch {}
    msRoot?.[K_PE]?.removeChild(msRoot);
    ra(msAnc, 'data-ag-cs-crab-anchor');
    if (ha(de(), 'data-ag-cs-has-crab')) ra(de(), 'data-ag-cs-has-crab');
    msRoot = msRig = msAnc = msOrch = null;
    msLastTier = undefined;
    msLastHostSleep = false;
  };

  const syncCrab = (activeCard, activeInfo, modelInfo) => {
    if (!isMascotEnabled()) return unmountCrab();
    const html = de();
    if (!activeCard) {
      msRoot?.[K_PE]?.removeChild(msRoot);
      try { msRig?.syncPowerState?.(); } catch {}
      if (msAnc) {
        ra(msAnc, 'data-ag-cs-crab-anchor');
        msAnc = null;
      }
      if (ha(html, 'data-ag-cs-has-crab')) {
        if (typeof ST === 'function' && !destroyed) {
          if (!crabRemoveAttrTimer) {
            crabRemoveAttrTimer = ST(() => {
              crabRemoveAttrTimer = 0;
              if (!destroyed && !msAnc) runGuardedMut(() => ra(html, 'data-ag-cs-has-crab'));
            }, 220);
          }
        } else ra(html, 'data-ag-cs-has-crab');
      }
      return;
    }
    if (crabRemoveAttrTimer) {
      CT(crabRemoveAttrTimer);
      crabRemoveAttrTimer = 0;
    }
    if (!msRoot) {
      const stage = D.createElement('div');
      stage.className = 'ag-cs-crab ag-cs-dual-stage';
      sa(stage, 'data-mascot-stage', 'true');
      sa(stage, 'aria-hidden', 'true');
      sa(stage, 'data-ag-no-i18n');
      sa(stage, 'data-ag-owned', '1');
      msRoot = stage;
    }
    let reattached = false;
    if (msRoot[K_PE] !== activeCard) {
      ra(msAnc, 'data-ag-cs-crab-anchor');
      sa(activeCard, 'data-ag-cs-crab-anchor', 'composer');
      activeCard.appendChild(msRoot);
      msAnc = activeCard;
      reattached = true;
    }
    if (html) setAttrIfChanged(html, 'data-ag-cs-has-crab', '1');

    const camp = modelInfo?.camp || 'gemini';
    const isOrch = !!(modelInfo?.isOrchestrator);
    const curTier = String(modelInfo?.tier || '').toLowerCase();
    const streamTier = curTier === 'high' || curTier === 'xhigh' || isOrch ? 3 : 2;
    const nextState = {
      camp,
      streaming: !!(activeInfo?.isRunning),
      streamTier,
      hasError: !!(activeInfo?.hasError),
      yieldMode: 'none',
      leapOffsetY: 0,
      popoverRightWidth: 0,
      miniPileEnabled: cfg.mascot === 'minis',
      orchestrator: isOrch,
      reducedMotion: motionReduced(),
    };

    const mountFn = dualMascotRig && (dualMascotRig.mountDualMascotStage || dualMascotRig.createDualMascotRig);
    if (!msRig && mountFn && canMountRealCanvas(msRoot)) {
      try {
        msRig = mountFn(msRoot, nextState);
      } catch {
        msRig = null;
      }
    } else {
      try { msRig?.setState?.(nextState); } catch {}
      if (reattached) {
        try { msRig?.syncPowerState?.(); } catch {}
      }
    }

    if (msOrch !== null && msOrch !== isOrch) {
      notifyMascot('orchestrator', { on: isOrch });
    }
    msOrch = isOrch;
    if (msLastTier !== undefined && msLastTier !== curTier && (curTier === 'high' || curTier === 'xhigh')) {
      notifyMascot('effort-tier', { tier: curTier });
    }
    msLastTier = curTier;
    const chatSleep = ga(html, 'data-ag-prism-mode') === 'chat';
    if (msLastHostSleep !== chatSleep) {
      msLastHostSleep = chatSleep;
      notifyMascot('host-sleep', { sleep: chatSleep });
    }
  };

  // ── Extracted Domain Controllers Initialization ────────────────────────
  const noopFn = () => null;
  const noopStub = (ov = {}) => new Proxy(ov, { get: (t, k) => (k in t ? t[k] : noopFn) });

  const homeStudioCtl = homeStudioMod?.createHomeStudioPanelController
    ? homeStudioMod.createHomeStudioPanelController({
        usageCore,
        storageUsageCacheKey: STORAGE_USAGE_CACHE_KEY,
        isDestroyed: () => destroyed,
        getHomeLayout: () => cfg.homeLayout,
        getLang,
        uiText,
        getDisplayName,
        ensureHooks,
        canMountRealCanvas,
        setAttrIfChanged,
        runGuardedMut,
      })
    : noopStub({
        wasHero: () => false,
        getUsageRecordsCount: () => 0,
        hasConnectedPanel: () => false,
      });

  const rippleCtl = homeRippleMod?.createHomeRippleController
    ? homeRippleMod.createHomeRippleController({
        rippleCore,
        isDestroyed: () => destroyed,
        isAllowed: () => cfg.homeRipple !== false && cfg.homeLayout !== 'off',
        isDarkTheme,
        motionReduced,
        getMinFrameGapMs,
        getAmbientIntensity: getAmbientFloat,
        getAccentTone,
        getEffectivePalette,
        setAttrIfChanged,
        onPointerPressMascot: (clientX) => {
          if (msRig && msRoot) {
            try {
              const mr = rc(msRoot);
              if (mr) notifyMascot('ripple', { x: clientX - mr.left });
            } catch {}
          }
        },
      })
    : noopStub();

  const convAuraCtl = convAuraMod?.createConvAuraController
    ? convAuraMod.createConvAuraController({
        isDestroyed: () => destroyed,
        isHomeRippleEnabled: () => getAmbientFloat() > 0,
        isMotionStandardOrUltra,
        isDarkTheme,
        getMinFrameGapMs,
        getAmbientIntensity: getAmbientFloat,
        getSpectrumMode: resolveAuraSpectrumMode,
        isWindowFocused: () => (typeof D.hasFocus === 'function' ? D.hasFocus() : !D.hidden),
        rippleCore,
        setAttrIfChanged,
        runGuardedMut,
      })
    : noopStub({ advancePhase: () => 'off' });

  const hostEnhancerCtl = hostEnhancerMod?.createHostEnhancerController
    ? hostEnhancerMod.createHostEnhancerController({
        doc: D,
        win: W,
        getLang,
        t: (k) => (k ? uiText()[k] : uiText()),
        isDestroyed: () => destroyed,
        isConvRunning,
        runGuardedMut,
        setAttrIfChanged,
        getConfig: () => ({
          ...cfg,
          palette: getEffectivePalette(),
          lightPreset: getLightPreset(),
          motionLevel: getMotionLevel(),
          accentTone: getAccentTone(),
          cornerStyle: getCornerStyle(),
          scrollBottomMotion: cfg.scrollBottomMotion === 'instant' ? 'instant' : 'smooth',
          sidebarNavFold: cfg.sidebarNavFold === 'on' ? 'on' : 'off',
          codeFont: getCodeFont(),
          codeLigatures: isCodeLigaturesEnabled(),
          ambientIntensity: getAmbientIntensitySetting(),
          thoughtView: getThoughtView(),
        }),
      })
    : noopStub();

  function isConvRunning() {
    return Boolean(convAuraMod && typeof convAuraMod.isConvRunning === 'function' && convAuraMod.isConvRunning());
  };

  let prismRimCtl = null;

  const modelGlyphCtl = modelGlyphMod?.createModelGlyphCrystalController
    ? modelGlyphMod.createModelGlyphCrystalController({
        animatedIcons,
        crystalPrismCore,
        isDestroyed: () => destroyed,
        isComposerRestyleEnabled: () => cfg.composerRestyle !== false,
        isZh,
        isDarkTheme,
        motionReduced,
        getMinFrameGapMs,
        canMountRealCanvas,
        getLastPointerPos: () => (prismRimCtl ? prismRimCtl.getLastPointerPos() : { x: -9999, y: -9999 }),
        setAttrIfChanged,
      })
    : noopStub({
        readButtonLabelWithoutGlyph: () => '',
        buildBrandMarkSvg: () => '',
      });

  prismRimCtl = prismRimMod?.createPrismRimCanvasController
    ? prismRimMod.createPrismRimCanvasController({
        isDestroyed: () => destroyed,
        isDarkTheme,
        motionReduced,
        getMinFrameGapMs,
        canMountRealCanvas,
        setAttrIfChanged,
        runGuardedMut,
        getActiveCrystalTrack: () => modelGlyphCtl.getActiveCrystalTrack(),
        setCrystalPointerClient: (x, y) => modelGlyphCtl.setCrystalPointerClient(x, y),
        onPointerActivity: (now) => {
          if (now - msActAt >= 2500) {
            msActAt = now;
            notifyMascot('activity', {});
          }
        },
      })
    : noopStub({ getLastPointerPos: () => ({ x: -9999, y: -9999 }) });

  const smoothCaretCtl = smoothCaretMod?.createSmoothCaretController
    ? smoothCaretMod.createSmoothCaretController({
        isDestroyed: () => destroyed,
        isEnabled: () => cfg.smoothCaret !== false,
        setAttrIfChanged,
        runGuardedMut,
      })
    : noopStub();

  const applySingleHostIcon = (btn, iconName, origSvg, size) => {
    if (!btn || btn.isConnected === false || !origSvg || !origSvg.parentNode || !animatedIcons) return;
    const htmlStr = animatedIcons.renderIcon(iconName, { size });
    if (!htmlStr) return;

    const prevDisp = origSvg.style?.getPropertyValue?.('display') || '';
    if (prevDisp) sa(origSvg, 'data-ag-cs-orig-disp', prevDisp);
    sa(origSvg, 'hidden');
    sa(origSvg, 'data-ag-cs-orig-svg', '1');
    origSvg.hidden = true;
    origSvg.style?.setProperty?.('display', 'none', 'important');

    let animSvg = modelGlyphCtl.cloneCachedSvgElement(`icon:${iconName}:${size}`, htmlStr);
    if (!animSvg) {
      animSvg = D.createElement('svg');
      animSvg.className = `ag-anim-icon ag-icon-${iconName}`;
      for (const [k, v] of [['data-anim-icon', iconName], ['width', size], ['height', size], ['viewBox', '0 0 24 24'], ['aria-hidden', 'true']]) {
        sa(animSvg, k, v);
      }
      if (iconName === 'copy-check') sa(animSvg, 'data-icon-state', 'copy');
      animSvg.innerHTML = htmlStr;
    }
    sa(animSvg, 'data-ag-owned', '1');
    origSvg.parentNode.insertBefore(animSvg, origSvg);
    sa(btn, 'data-ag-cs-icon-injected', iconName);
  };

  const streamChoreoCtl = streamChoreoMod?.createStreamChoreographyController
    ? streamChoreoMod.createStreamChoreographyController({
        motionEngine,
        isDestroyed: () => destroyed,
        isComposerRestyleEnabled: () => cfg.composerRestyle !== false,
        isMotionStandardOrUltra,
        isMotionUltra,
        isConvRunning,
        isThoughtIsolatedNode,
        isThoughtMutationRecord,
        isManagedThoughtPanel,
        setAttrIfChanged,
        runGuardedMut,
        cloneCachedSvgElement: (k, s) => modelGlyphCtl.cloneCachedSvgElement(k, s),
        buildBrandMarkSvg: (b, sz, tr, m) => modelGlyphCtl.buildBrandMarkSvg(b, sz, tr, m),
        applySingleHostIcon,
        rippleCtl,
        convAuraCtl,
        notifyMascot,
      })
    : noopStub({
        heroState: {
          wasInHome: false,
          wasInFormalConv: false,
          lastModelSig: null,
          pendingModelShiftNotify: false,
          lastTriggerOrigin: null,
          lastGroupPress: null,
        },
        scheduleTransient: (fn, ms) => ST(fn, ms),
        measureSidebarSelectionSnapshot: () => ({ empty: true }),
        measureVisibleChangedHeaders: () => [],
        measureNewLensOverlays: () => [],
        isStreamMutating: () => false,
        hasStreamObserver: () => false,
      });

  // ── Root Attrs, Spring Tokens & Language Sync ──────────────────────────
  let lastThemeKey = '';
  let lastAppliedLang = '';
  let lastAppliedMotion = '';
  let lastAppliedTelemetry = '';
  let lastMetricsKey = '';
  let lastAbsorbedSyncKey = '';
  const MOTION_OFF_STYLE_ID = 'ag-prism-motion-off-css';

  function flattenMainStyleSheet() {
    const el = document.getElementById?.('ag-prism-css');
    const rules = el?.sheet?.cssRules;
    const key = el?.getAttribute?.('data-ag-cs-css-hash') || CODE_HASH || '1';
    if (!rules?.length || el.getAttribute?.('data-ag-cs-flat') === key + ':' + (el.textContent || '').length) return;
    const splitC = (s) => {
      const out = [];
      for (let i = 0, d = 0, q = '', st = 0; i <= s.length; i++) {
        const c = s[i];
        if (c === '\\') { i++; continue; }
        if (q) { if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '(' || c === '[') d++;
        else if (c === ')' || c === ']') d--;
        else if ((!c || (c === ',' && !d)) && i >= st) { const t = s.slice(st, i).trim(); if (t) out.push(t); st = i + 1; }
      }
      return out;
    };
    const expIs = (s) => {
      let q = '', br = 0, nd = 0, idx = -1;
      const stk = [];
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '\\') { i++; continue; }
        if (q) { if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '[') br++;
        else if (c === ']') br && br--;
        else if (!br) {
          if (c === '(') { const n = s.slice(i - 4, i) === ':not'; if (n) nd++; stk.push(n); }
          else if (c === ')') { if (stk.pop()) nd--; }
          else if (!nd && c === ':' && s.slice(i, i + 4) === ':is(') { idx = i; break; }
        }
      }
      if (idx < 0) return [s];
      let d = 0, end = -1;
      for (let i = idx + 3; i < s.length; i++) {
        const c = s[i];
        if (c === '\\') { i++; continue; }
        if (q) { if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '(') d++;
        else if (c === ')' && !--d) { end = i; break; }
      }
      if (end < 0) return [s];
      const parts = splitC(s.slice(idx + 4, end));
      if (!parts.length || parts.length > 40 || (parts.length === 1 && /[\s>+~]/.test(parts[0]))) return [s];
      const pre = s.slice(0, idx), post = s.slice(end + 1), res = [];
      for (const p of parts) {
        for (const sub of expIs(pre + p + post)) if (res.push(sub) > 200) return [s];
      }
      return res;
    };
    const expSel = (s) => splitC(s).flatMap(expIs).join(',');
    const walk = (rs, ps) => {
      const out = [];
      for (const r of rs) {
        if (r.type === 1) {
          let sel = r.selectorText;
          if (ps) sel = splitC(ps).flatMap((p) => splitC(sel).map((c) => {
            const fi = c.indexOf('&');
            return fi < 0 ? p + ' ' + c : fi === 0 && c.indexOf('&', 1) < 0 ? p + c.slice(1) : c.replace(/&/g, ':is(' + p + ')');
          })).join(',');
          if (r.style?.cssText) out.push(expSel(sel) + '{' + r.style.cssText + '}');
          if (r.cssRules?.length) out.push(...walk(r.cssRules, sel));
        } else if (r.type === 4 || r.type === 12) {
          const inner = walk(r.cssRules || [], ps);
          if (inner.length) out.push((r.type === 4 ? '@media ' : '@supports ') + r.conditionText + '{' + inner.join('\n') + '}');
        } else if (!r.selectorText && r.style?.cssText && ps) out.push(expSel(ps) + '{' + r.style.cssText + '}');
        else if (r.cssText) out.push(r.cssText);
      }
      return out;
    };
    try {
      const flat = walk(rules, '').join('\n');
      if (flat) runGuardedMut(() => { el.textContent = flat; el.setAttribute?.('data-ag-cs-flat', key + ':' + flat.length); });
    } catch {}
  }

  const syncMotionOffStyle = (isOff) => {
    const el = D.getElementById?.(MOTION_OFF_STYLE_ID);
    if (!isOff) return el?.remove?.();
    if (!el && typeof D.createElement === 'function') {
      const s = D.createElement('style');
      s.id = MOTION_OFF_STYLE_ID;
      sa(s, 'data-ag-owned', '1');
      s.textContent = 'html[data-ag-cs-style][data-ag-cs-motion="off"]{&,& *,& *::before,& *::after{animation:none!important;transition:none!important}}';
      (D.head || D.documentElement)?.appendChild?.(s);
    }
  };

  const refreshOpenUiForLanguage = () => {
    const inHero = Boolean(D.querySelector('.agy-home [data-testid="home-greeting"]'));
    homeStudioCtl.syncGreeting(inHero);
    if (inHero && cfg.homeLayout === 'studio') homeStudioCtl.renderHomePanel(true);
    syncComposers(null);
    ensureSettingsSection();
    try {
      hostEnhancerCtl.onThemeChange?.(false);
      hostEnhancerCtl.sync?.();
    } catch {}
    syncAbsorbedModules();
    try {
      modelGlyphCtl.syncModelSelectorPanel?.(latestPrimaryModelInfo);
    } catch {}
    ensurePulseBridge(true);
  };

  const syncMotionSpringTokens = () => {
    const html = D.documentElement;
    if (!html || !html.style || typeof html.style.setProperty !== 'function') return;
    if (!motionEngine || typeof motionEngine.springLinear !== 'function') return;
    try {
      const sp = motionEngine.springLinear({ stiffness: 420, damping: 32, mass: 1 });
      const easing = typeof sp === 'string' ? sp : sp && sp.easing;
      const durMs = sp && typeof sp === 'object' ? sp.durationMs || 300 : 300;
      if (easing) {
        html.style.setProperty('--ag-spring-sidebar-ease', easing);
        html.style.setProperty('--ag-spring-sidebar-dur', `${Math.round(durMs)}ms`);
      }
    } catch {}
  };

  function syncAbsorbedModules(force = false) {
    const tel = W.__agPrismTelemetry;
    const eff = W.__agPrismEffortSlider;
    const th = W.__agPrismThought;
    const thUi = W.__agPrismThoughtSettingsUi;
    const omni = W.__agPrismOmni;
    const meta = W.__agPrismOmniServerMeta || null;
    const sb = W.__agPrismSidebar;
    const sbMeta = W.__agPrismSidebarMeta || null;
    const ctxMenu = W.__agPrismContextMenu || GT.__agPrismContextMenu;
    if (ctxMenu && !ownedCtxMenu) ownedCtxMenu = ctxMenu;
    const motionLv = getMotionLevel();
    const ctxEnabled = isContextMenuEnabled() && !destroyed;
    const key = [
      VERSION,
      getLang(),
      motionLv,
      getTelemetryMode(),
      getEffortSliderMode(),
      getThoughtTranslateMode(),
      getThoughtTriggerTiming(),
      getThoughtView(),
      getOmniMode(),
      getLinkTarget(),
      cfg.sidebarStudio === 'on' ? 1 : 0,
      ctxEnabled ? 1 : 0,
      meta?.baseUrl || '',
      sbMeta?.version || '',
      sbMeta?.serviceReady ? 1 : 0,
      tel ? 1 : 0,
      eff ? 1 : 0,
      th ? 1 : 0,
      thUi ? 1 : 0,
      omni ? 1 : 0,
      sb ? 1 : 0,
      ctxMenu ? 1 : 0,
    ].join('|');
    if (!force && key === lastAbsorbedSyncKey) return;
    lastAbsorbedSyncKey = key;
    try { tel?.sync?.(cfg); } catch {}
    try { eff?.sync?.(cfg); } catch {}
    try { th?.sync?.(cfg); } catch {}
    try {
      if (getOmniMode() === 'off') omni?.destroy?.();
      else omni?.sync?.(cfg, meta);
    } catch {}
    try {
      sb?.sync?.(cfg, sbMeta);
    } catch {}
    try {
      ctxMenu?.sync?.({
        enabled: ctxEnabled,
        lang: getLang(),
        motionLevel: motionLv,
      });
    } catch {}
    try {
      D.getElementById?.(SETTINGS_SEC_ID)?.__prismMountThoughtUi?.();
    } catch {}
  }

  function applyRootAttrs(forceAbsorbed = false) {
    const html = D.documentElement;
    if (!html) return;
    const palette = getEffectivePalette();
    const lightPreset = getLightPreset();
    const lang = getLang();
    const motionLv = getMotionLevel();
    const targetFps = getTargetFps();
    const telemetryMod = getTelemetryMode();
    const effortSliderMod = getEffortSliderMode();
    const dark = isDarkTheme();

    runGuardedMut(() => {
      for (const [k, v] of [
        ['data-ag-prism', VERSION],
        ['data-ag-cs-style', '1'],
        ['data-ag-cs-theme', dark ? 'dark' : 'light'],
        ['data-ag-cs-palette', palette],
        ['data-ag-cs-light-preset', lightPreset],
        ['data-ag-cs-motion', motionLv],
        ['data-ag-cs-target-fps', targetFps],
        ['data-ag-cs-telemetry', telemetryMod],
        ['data-ag-cs-effort-slider', effortSliderMod],
        ['data-ag-cs-thought-translate', getThoughtTranslateMode()],
        ['data-ag-prism-omni', getOmniMode()],
        ['data-ag-prism-link-target', getLinkTarget()],
        ['data-ag-prism-sidebar-studio', cfg.sidebarStudio === 'on' ? 'on' : 'off'],
        ['data-ag-cs-accent', getAccentTone()],
        ['data-ag-cs-corners', getCornerStyle()],
        ['data-ag-cs-scroll-bottom', cfg.scrollBottomMotion === 'instant' ? 'instant' : 'smooth'],
        ['data-ag-cs-code-font', getCodeFont()],
        ['data-ag-cs-ligatures', isCodeLigaturesEnabled() ? '1' : '0'],
        ['data-ag-cs-ambient', getAmbientCssValue()],
        ['data-ag-cs-home', cfg.homeLayout === 'classic' ? 'classic' : cfg.homeLayout === 'off' ? 'off' : 'studio'],
        ['data-ag-cs-composer', cfg.composerRestyle === false ? 'off' : 'on'],
        ['data-ag-cs-logo-ink', cfg.logoInk === 'foreground' ? 'foreground' : 'accent'],
        ['data-ag-cs-sidebar', cfg.sidebarRestyle === false ? 'off' : 'on'],
        ['data-ag-cs-sidebar-compact', cfg.sidebarCompact === true ? 'on' : 'off'],
        ['data-ag-cs-sb-fold', cfg.sidebarNavFold === 'on' ? 'on' : 'off'],
        ['data-ag-cs-lang', lang],
      ]) {
        setAttrIfChanged(html, k, v);
      }
      if (cfg.sidebarRestyle === false) {
        if (ha(html, 'data-ag-cs-sidebar-collapsed')) ra(html, 'data-ag-cs-sidebar-collapsed');
        qa(D, '.ag-cs-sidebar-glide-pill').forEach((n) => n.remove());
      }
      const isCjk = i18nCore && typeof i18nCore.isCjkLanguage === 'function' ? i18nCore.isCjkLanguage(lang) : isZh();
      if (isCjk) setAttrIfChanged(html, 'data-ag-cs-cjk', '1');
      else if (ha(html, 'data-ag-cs-cjk')) ra(html, 'data-ag-cs-cjk');

      syncMotionOffStyle(motionLv === 'off');
      syncAbsorbedModules(forceAbsorbed);
      const tv = 'data-ag-prism-thought-view';
      if (getThoughtTranslateMode() === 'off') { if (ha(html, tv)) ra(html, tv); }
      else setAttrIfChanged(html, tv, getThoughtView());
      syncCaretListeners(cfg.smoothCaret !== false);

      if (telemetryMod !== lastAppliedTelemetry) {
        const prevTel = lastAppliedTelemetry;
        lastAppliedTelemetry = telemetryMod;
        if (prevTel !== '') {
          ensurePulseBridge(telemetryMod !== 'off');
        }
      }

      const prevMotion = lastAppliedMotion;
      if (motionLv !== prevMotion) {
        lastAppliedMotion = motionLv;
        rippleCtl.refreshTheme();
        convAuraCtl.sync();
        convAuraCtl.refreshTheme();
        prismRimCtl.invalidateMetrics?.();
        prismRimCtl.markDirty();
        if (prevMotion !== '') {
          dirtyFlags.c = true;
          syncHostAnimatedIcons(null);
          streamChoreoCtl.syncDualStreamEngine();
          modelGlyphCtl.syncModelSelectorPanel?.(latestPrimaryModelInfo);
        }
      }

      const prevLang = lastAppliedLang;
      if (lang !== prevLang) {
        lastAppliedLang = lang;
        if (prevLang !== '') refreshOpenUiForLanguage();
      }

      const themeKey = `${palette}|${lightPreset}|${dark ? 'd' : 'l'}|${getAccentTone()}|${getAmbientIntensitySetting()}|${getCornerStyle()}`;
      if (themeKey !== lastThemeKey) {
        lastThemeKey = themeKey;
        rippleCtl.refreshTheme();
        convAuraCtl.sync();
        convAuraCtl.refreshTheme();
        prismRimCtl.invalidateMetrics?.();
        prismRimCtl.markDirty();
        try {
          hostEnhancerCtl.onThemeChange?.();
        } catch {}
      }

      const metricsKey = `${lang}|${getCodeFont()}|${isCodeLigaturesEnabled() ? 1 : 0}|${getCornerStyle()}|${cfg.composerRestyle === false ? 0 : 1}`;
      if (metricsKey !== lastMetricsKey) {
        const hadPrevMetrics = lastMetricsKey !== '';
        lastMetricsKey = metricsKey;
        if (hadPrevMetrics) {
          prismRimCtl.invalidateMetrics?.();
          prismRimCtl.markDirty();
          smoothCaretCtl.bumpMetricsEpoch();
          smoothCaretCtl.queue(false, true, true);
        }
      }
    });
  }

  // ── Composer Prism Box, Placeholder, Glyph & Mascot Clearance ──────────
  const setCrabClearanceAttr = (el, attrName, active) => {
    if (!el) return;
    if (active) {
      setAttrIfChanged(el, attrName, '1');
      if (el.style.getPropertyValue('margin-bottom') !== '46px') {
        el.style.setProperty('margin-bottom', '46px', 'important');
      }
    } else if (ha(el, attrName)) {
      ra(el, attrName);
      rp(el, 'margin-bottom');
    }
  };

  const syncModelMenuRootAttrs = (panel) => {
    const html = de();
    if (panel) {
      html && setAttrIfChanged(html, 'data-ag-cs-model-menu', '1');
      const ov = cl(panel, '.agy-overlay');
      ov && setAttrIfChanged(ov, 'data-ag-cs-model-overlay', '1');
    } else {
      ra(html, 'data-ag-cs-model-menu');
      qa(D, '[data-ag-cs-model-overlay]').forEach((el) => ra(el, 'data-ag-cs-model-overlay'));
    }
  };

  const syncCrabClearance = (card, inputBox, active) => {
    if (!inputBox) return;
    if (ga(de(), 'data-ag-prism-mode') === 'chat') active = false;
    syncModelMenuRootAttrs(qs(D, MODEL_PANEL_SEL));
    if (active && qs(inputBox, '[role="listbox"], [role="option"], [data-testid="slash-command-menu"]')) {
      setAttrIfChanged(inputBox, 'data-ag-cs-menu-open', '1');
    } else if (ha(inputBox, 'data-ag-cs-menu-open')) ra(inputBox, 'data-ag-cs-menu-open');
    const composerShell = cl(card, '#antigravity\\.agentSidePanelInputBox') || card[K_PE];
    let hasLowerClearance = false;

    if (composerShell) {
      for (const ch of AF(composerShell.children)) {
        if (ch === card) break;
        const panel = tidOf(ch) === 'running-items-panel' ? ch : qs(ch, '[data-testid="running-items-panel"]');
        const isActivePanel = Boolean(panel && String(panel.className || '').includes('grid-rows-[1fr]'));
        const shouldClear = active && isActivePanel && !hasLowerClearance;
        setCrabClearanceAttr(ch, 'data-ag-cs-queued', shouldClear);
        if (shouldClear) hasLowerClearance = true;
      }
    }

    const ibChildren = AF(inputBox.children);
    const shellIdx = ibChildren.indexOf(composerShell);
    const beforeShell = shellIdx >= 0 ? ibChildren.slice(0, shellIdx) : ibChildren;
    for (let i = beforeShell.length - 1; i >= 0; i--) {
      const ch = beforeShell[i];
      if (clHas(ch, 'ag-cs-hud-top-bar') || clHas(ch, 'ag-cs-hud-bottom-bar')) continue;
      const hasQueued = ch.childElementCount > 0 || (ch[K_TC] || '').trim().length > 0;
      const shouldClear = active && hasQueued && !hasLowerClearance;
      setCrabClearanceAttr(ch, 'data-ag-cs-queued', shouldClear);
      if (shouldClear) hasLowerClearance = true;
    }

    const inputSlot = clHas(inputBox[K_PE], 'contents') ? inputBox[K_PE] : inputBox;
    const hostWrap = inputSlot[K_PE];
    if (hostWrap) {
      const siblings = AF(hostWrap.children);
      const slotIdx = siblings.indexOf(inputSlot);
      for (let i = slotIdx - 1; i >= 0; i--) {
        const sib = siblings[i];
        const stid = tidOf(sib);
        const isTakeoverOrSideQ =
          stid === 'interaction-takeover-card' ||
          stid === 'side-question-panel' ||
          Boolean(qs(sib, '[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"]'));
        if (!isTakeoverOrSideQ) {
          if (ha(sib, 'data-ag-cs-takeover')) setCrabClearanceAttr(sib, 'data-ag-cs-takeover', false);
          continue;
        }
        const shouldClear = active && !hasLowerClearance;
        setCrabClearanceAttr(sib, 'data-ag-cs-takeover', shouldClear);
        if (shouldClear) hasLowerClearance = true;
      }
    }
  };

  let latestPrimaryModelInfo = null;
  let lastSyncedAwaitingDecision = null;
  let lastSyncedHasError = false;

  const detectVisibleDecisionTakeover = () => {
    for (const el of qa(D, '[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"]')) {
      if (cl(el, '[data-testid="subagent-tab-conversation"]') || el.hidden || ga(el, 'aria-hidden') === 'true') continue;
      if ((el.style?.getPropertyValue?.('display') || el.style?.display || '') === 'none') continue;
      return true;
    }
    return false;
  };

  const syncConvAuraSemantics = (activeInfo) => {
    if (typeof convAuraCtl.setSemanticState !== 'function') return;
    const awaitingNow = detectVisibleDecisionTakeover();
    const errNow = !!(activeInfo?.hasError);
    const freshErrorEdge = errNow && !lastSyncedHasError;
    if (awaitingNow !== lastSyncedAwaitingDecision || freshErrorEdge) {
      lastSyncedAwaitingDecision = awaitingNow;
      lastSyncedHasError = errNow;
      convAuraCtl.setSemanticState({
        awaitingDecision: awaitingNow ? true : null,
        hasError: freshErrorEdge,
      });
    } else {
      lastSyncedHasError = errNow;
    }
  };

  const syncQueuedPrismBoxes = () => {
    const qCards = qa(D, '[data-testid="queued-messages-card"], [data-testid="interaction-takeover-card"]');
    if (!qCards || qCards.length === 0) return;
    const chatMode = ga(de(), 'data-ag-prism-mode') === 'chat';
    for (const qCard of qCards) {
      const allowPrism =
        cfg.composerRestyle !== false &&
        !chatMode &&
        !cl(qCard, '[data-testid="subagent-tab-conversation"]');
      if (allowPrism) {
        const isNew = ga(qCard, 'data-ag-cs-prism-box') !== '1' || ga(qCard, 'data-ag-cs-prism-reflect') !== 'bottom';
        setAttrIfChanged(qCard, 'data-ag-cs-prism-box', '1');
        setAttrIfChanged(qCard, 'data-ag-cs-prism-reflect', 'bottom');
        if (isNew) {
          prismRimCtl.invalidateMetrics?.();
          prismRimCtl.markDirty();
        }
      } else if (ha(qCard, 'data-ag-cs-prism-box') || ha(qCard, 'data-ag-cs-prism-reflect')) {
        ra(qCard, 'data-ag-cs-prism-box');
        ra(qCard, 'data-ag-cs-prism-reflect');
        rp(qCard, '--ag-px');
        rp(qCard, '--ag-py');
        prismRimCtl.invalidateMetrics?.();
        prismRimCtl.markDirty();
      }
    }
  };

  const syncPopupOverlayMirrors = () => {
    const ovs = qa(D, '.agy-overlay');
    if (!ovs || ovs.length === 0) return;
    let touched = false;
    for (const ov of ovs) {
      if (ha(ov, 'data-hover-card-popup') || tidOf(ov) === 'model-selector-panel') continue;
      if (ga(ov, 'role') !== 'menu' && !clHas(ov, 'max-h-48')) continue;
      if (ga(ov, 'data-ag-cs-prism-box') !== '1' || ga(ov, 'data-ag-cs-prism-mirror') !== '1') {
        touched = true;
      }
      setAttrIfChanged(ov, 'data-ag-cs-prism-box', '1');
      setAttrIfChanged(ov, 'data-ag-cs-prism-mirror', '1');
    }
    if (touched) prismRimCtl.markDirty();
  };

  function syncComposers(measured, skipSparks = false) {
    const cards = AF(qa(D, '[data-testid="agent-input-box"] .surface-composer-card'));
    const lang = getLang();
    const ui = uiText(lang);

    let primaryCard = null;
    for (const c of cards) {
      if (!cl(c, '[data-testid="subagent-tab-conversation"]')) {
        primaryCard = c;
        break;
      }
    }
    if (!primaryCard && cards.length > 0) primaryCard = cards[0];

    const mascotOn = isMascotEnabled();
    let primaryModelInfo = null;
    const hs = streamChoreoCtl.heroState;

    for (const card of cards) {
      const inputBox = cl(card, '[data-testid="agent-input-box"]');
      const zLayer = cl(inputBox, '.z-10');
      if (zLayer) setAttrIfChanged(zLayer, 'data-ag-cs-input-layer', '1');
      const isPrimary = card === primaryCard;

      if (isPrimary && cfg.composerRestyle !== false) {
        if (ga(card, 'data-ag-cs-prism-box') !== '1') prismRimCtl.markDirty();
        setAttrIfChanged(card, 'data-ag-cs-prism-box', '1');
      } else if (ha(card, 'data-ag-cs-prism-box')) {
        ra(card, 'data-ag-cs-prism-box');
        card.style.removeProperty('--ag-px');
        card.style.removeProperty('--ag-py');
        prismRimCtl.invalidateMetrics?.();
        prismRimCtl.markDirty();
      }

      syncCrabClearance(card, inputBox, mascotOn && isPrimary);

      const p = qs(card, 'div.relative.w-full p.pointer-events-none');
      if (p) {
        if (cfg.composerRestyle !== false && cfg.placeholderStyle === 'studio') {
          setAttrIfChanged(p, 'data-ag-cs-placeholder', ui.studioPlaceholder || 'How can I help you today?');
        } else if (ha(p, 'data-ag-cs-placeholder')) {
          ra(p, 'data-ag-cs-placeholder');
        }
      }

      let didModelShift = false;
      const modelBtn = qs(card, '[data-testid="model-selector-trigger"]');
      const mInfo = modelGlyphCtl.syncModelGlyphOnButton(modelBtn);
      if (isPrimary && mInfo) {
        primaryModelInfo = mInfo;
        const cleanModelLabel = modelGlyphCtl.readButtonLabelWithoutGlyph(modelBtn);
        if (cleanModelLabel) {
          const normLbl = modelGlyphCtl.normalizeModelEffortLabel ? modelGlyphCtl.normalizeModelEffortLabel(cleanModelLabel) : cleanModelLabel;
          const modelSig = `${mInfo.brand}:${normLbl.toLowerCase()}`;
          if (hs.lastModelSig === null) {
            hs.lastModelSig = modelSig;
          } else if (modelSig !== hs.lastModelSig) {
            hs.lastModelSig = modelSig;
            didModelShift = true;
            if (isMotionUltra()) {
              streamChoreoCtl.triggerHeroDFiberPulse(card, modelBtn, mInfo.brand);
            }
          }
        }
      }
      if (didModelShift && isPrimary) hs.pendingModelShiftNotify = true;
    }

    syncQueuedPrismBoxes();

    latestPrimaryModelInfo = primaryModelInfo;
    const activeInfoForCrab = getLightweightActiveInfo(primaryCard);
    syncCrab(primaryCard, activeInfoForCrab, primaryModelInfo);
    syncConvAuraSemantics(activeInfoForCrab);
    if (hs.pendingModelShiftNotify) {
      hs.pendingModelShiftNotify = false;
      notifyMascot('model-shift');
    }
    modelGlyphCtl.syncModelSelectorPanel(primaryModelInfo);
    if (!skipSparks) streamChoreoCtl.syncThinkingSparks(primaryModelInfo);
    if (measured && 'caretList' in measured) {
      smoothCaretCtl.applyMutations(measured.caretList, false);
    } else {
      smoothCaretCtl.sync(false, false);
    }
  }

  // ── Incremental 21 Host Animated Icons ─────────────────────────────────
  const findOriginalHostSvg = (btn) => {
    if (!btn || !btn.querySelectorAll) return null;
    for (const svg of qa(btn, 'svg')) {
      if (svg.classList?.contains?.('ag-anim-icon')) continue;
      return svg;
    }
    return null;
  };

  const EXT_ZH_UI_SEL = '[data-agy-hans-ui], #agy-theme-switcher, #agy-theme-menu, #antigravity-quota-widget, #antigravity-translation-audit';

  const detectHostIconTarget = (btn) => {
    if (btn?.classList?.contains?.('ag-prism-thought-raw-toggle') || cl(btn, '.ag-prism-thought-overlay')) return '';
    if (!btn) return '';

    const tid = tidOf(btn).toLowerCase();
    if (
      tid === 'model-selector-trigger' ||
      tid === 'app-icon-new-conversation-button' ||
      tid === 'input-cancel-button' ||
      tid === 'stop-button'
    ) {
      return '';
    }
    if (cl(btn, '#' + SETTINGS_SEC_ID + ', [role="dialog"], .ag-cs-home-panel, [data-testid="orchestrator-effort-bar"], .ag-cs-crab, ' + EXT_ZH_UI_SEL)) {
      return '';
    }
    if (qs(btn, '.ag-cs-model-glyph, .ag-spark-orbit-svg, .ag-cs-thinking-spark')) return '';

    if (ha(btn, 'data-ag-cs-filter-btn') || tid === 'sidebar-search-button' || tid === 'conversation-filter-button') return 'search';
    if (tid === 'new-conversation-button') return 'sparkles-pen';
    if (tid === 'sidebar-toggle' || tid === 'sidebar-toggle-button' || tid === 'toggle-sidebar-button' || tid === 'toggle-aux-sidebar') {
      return 'panel-left';
    }
    if (tid === 'automations-button') return 'zap-bolt';
    if (tid === 'input-send-button') return 'arrow-up-launch';
    if (tid === 'sidebar-add-project-button' || tid === 'toggle-overview-panel') return '';

    const aria = String(ga(btn, 'aria-label') || '').toLowerCase().trim();
    const title = String(ga(btn, 'title') || '').toLowerCase().trim();
    const tip = String(ga(btn, 'data-tooltip-id') || '').toLowerCase().trim();
    const origSvg = findOriginalHostSvg(btn);
    const svgCls = String(ga(origSvg, 'class') || origSvg?.className || '').toLowerCase();
    const rawLbl = aria || title;
    const okTxt = !/\blucide-/.test(svgCls) && rawLbl.length <= 32 && !/[:：\r\n]/.test(rawLbl) && !/[:：\r\n]/.test(tip);
    const shortMeta = `${tid} ${rawLbl} ${tip}`;
    const labelMeta = `${rawLbl} ${tip}`;

    if (/\blucide-copy\b/.test(svgCls) || (okTxt && /\bcopy\b|复制|複製|コピー/.test(shortMeta))) return 'copy-check';
    if (
      /\blucide-panel-left\b/.test(svgCls) ||
      (okTxt &&
        /(?:toggle|open|close|show|hide)\s+(?:the\s+)?(?:side\s*panel|sidebar)|切换侧边栏|切換側邊欄|折叠侧边栏|展开侧边栏|サイドバー/.test(labelMeta))
    ) {
      return 'panel-left';
    }
    const role = ga(btn, 'role');
    if (
      tid === 'settings-button' ||
      tid === 'open-settings-button' ||
      /\blucide-settings\b/.test(svgCls) ||
      (okTxt &&
        (/^(?:open\s+)?settings$|^(?:打开)?设置$|^設定$/.test(rawLbl) || (!rawLbl && /^(?:open[-_\s]?)?settings(?:\b|[-_])/.test(tip))) &&
        role !== 'menuitem' &&
        role !== 'tab')
    ) {
      return 'settings-gear';
    }
    if (
      !cl(btn, '.agy-composer-footer') &&
      cl(btn, '[data-testid="agent-input-box"], .surface-composer-card') &&
      (tid === 'attachment-button' ||
        tid === 'add-context-button' ||
        tid === 'composer-plus-button' ||
        tid === 'input-add-button' ||
        /\blucide-plus\b/.test(svgCls) ||
        (okTxt && /\battach|\badd\b|upload|context|附件|添加/.test(shortMeta)))
    ) {
      return 'plus-spin';
    }
    return '';
  };

  const restoreHostButtonIcon = (btn) => {
    if (!btn) return;
    qa(btn, '.ag-anim-icon').forEach((n) => n.remove());
    qa(btn, '[data-ag-cs-orig-svg]').forEach((orig) => {
      ra(orig, 'hidden');
      orig.hidden = false;
      const prevDisp = ga(orig, 'data-ag-cs-orig-disp');
      if (prevDisp) {
        sp(orig, 'display', prevDisp);
        ra(orig, 'data-ag-cs-orig-disp');
      } else {
        orig.style?.removeProperty?.('display');
      }
      ra(orig, 'data-ag-cs-orig-svg');
    });
    ra(btn, 'data-ag-cs-icon-injected');
  };

  const restoreAllHostAnimatedIcons = () => {
    qa(D, '[data-ag-cs-icon-injected]').forEach((btn) => restoreHostButtonIcon(btn));
  };

  const isHostButtonCandidate = (el) => {
    if (!isElementLike(el)) return false;
    const tag = tagU(el);
    return tag === 'BUTTON' || ga(el, 'role') === 'button' || (tag === 'A' && tidOf(el) === 'new-conversation-button');
  };

  const HOST_BTN_QUERY = 'button, [role="button"], a[data-testid="new-conversation-button"]';

  const hasAncestorInSet = (el, rootSet) => {
    let cur = el?.parentElement;
    while (cur) {
      if (rootSet.has(cur)) return true;
      cur = cur.parentElement;
    }
    return false;
  };

  const iconSigMap = new WeakMap();
  function syncHostAnimatedIcons(roots = null) {
    if (!animatedIcons || typeof animatedIcons.renderIcon !== 'function' || !isMotionStandardOrUltra()) {
      restoreAllHostAnimatedIcons();
      return;
    }

    let buttons;
    if (roots && Array.isArray(roots)) {
      perfStats.iconIncrementalRuns += 1;
      const rootSet = roots.length > 1 ? new Set(roots) : null;
      const set = new Set();
      for (const r of roots) {
        if (!r || r.isConnected === false || isThoughtIsolatedNode(r)) continue;
        if (rootSet && hasAncestorInSet(r, rootSet)) continue;
        if (isHostButtonCandidate(r)) set.add(r);
        const inner = qa(r, HOST_BTN_QUERY);
        for (let i = 0; i < inner.length; i++) {
          if (!isThoughtIsolatedNode(inner[i])) set.add(inner[i]);
        }
      }
      if (set.size === 0) return;
      buttons = set;
    } else {
      perfStats.iconFullRuns += 1;
      buttons = qa(D, HOST_BTN_QUERY);
    }

    const pendingIcons = [];
    for (const btn of buttons) {
      if (isThoughtIsolatedNode(btn)) continue;
      const ex = ga(btn, 'data-ag-cs-icon-injected');
      if (!ex && !qs(btn, 'svg')) continue;
      const bSig = `${tidOf(btn)}|${ga(btn, 'aria-label') || ''}|${ga(btn, 'title') || ''}|${ha(btn, 'data-ag-cs-filter-btn') ? 1 : 0}`;
      const eqSig = '=' + bSig;
      const hit = iconSigMap.get(btn);
      if (hit === (ex ? eqSig : bSig) && (!ex || qs(btn, '.ag-anim-icon'))) continue;
      const iconName = detectHostIconTarget(btn);
      if (ex) {
        if (ex !== iconName) restoreHostButtonIcon(btn);
        else if (qs(btn, '.ag-anim-icon')) { iconSigMap.set(btn, eqSig); continue; }
        else ra(btn, 'data-ag-cs-icon-injected');
      }
      if (!iconName) { iconSigMap.set(btn, bSig); continue; }
      const origSvg = findOriginalHostSvg(btn);
      if (!origSvg || !origSvg.parentNode) continue;
      iconSigMap.set(btn, eqSig);

      const rawSize = parseInt(ga(origSvg, 'width') || '15', 10);
      const size = Number.isFinite(rawSize) && rawSize >= 12 && rawSize <= 20 ? rawSize : 15;
      pendingIcons.push({ btn, iconName, origSvg, size });
    }

    if (pendingIcons.length <= 20 || typeof requestAnimationFrame !== 'function') {
      for (const it of pendingIcons) applySingleHostIcon(it.btn, it.iconName, it.origSvg, it.size);
    } else {
      const syncStart = pendingIcons.length - 16;
      for (let i = syncStart; i < pendingIcons.length; i++) {
        const it = pendingIcons[i];
        applySingleHostIcon(it.btn, it.iconName, it.origSvg, it.size);
      }
      streamChoreoCtl.enqueueDeferredIcons(pendingIcons.slice(0, syncStart));
    }
  }

  // ── Settings Panel & Group Glide Integration ───────────────────────────
  const handledGroupClicks = new WeakSet();

  const runSettingsGroupGlide = (group, prevBtn, nextBtn, prevRectOverride = null, nextRectOverride = null) => {
    if (!group || !prevBtn || !nextBtn || prevBtn === nextBtn || !isMotionStandardOrUltra()) return;
    if (!motionEngine || typeof motionEngine.glideIndicator !== 'function') return;
    const prevRect = prevRectOverride || rc(prevBtn);
    const nextRect = nextRectOverride || rc(nextBtn);
    const pill = D.createElement('div');
    pill.className = 'ag-cs-pill-glide';
    sa(pill, 'aria-hidden', 'true');
    sa(pill, 'data-ag-no-i18n');
    sa(pill, 'data-ag-owned', '1');
    if (nextRect && nextRect.width > 0 && nextRect.height > 0) {
      for (const [k, v] of [
        ['position', 'fixed'],
        ['left', `${Math.round(nextRect.left)}px`],
        ['top', `${Math.round(nextRect.top)}px`],
        ['width', `${Math.round(nextRect.width)}px`],
        ['height', `${Math.round(nextRect.height)}px`],
        ['border-radius', '6px'],
        ['background', 'rgba(148, 163, 184, 0.14)'],
        ['box-shadow', 'inset 0 1px 0 rgba(255, 255, 255, 0.12)'],
        ['pointer-events', 'none'],
        ['z-index', '9999'],
      ]) {
        sp(pill, k, v);
      }
    }
    if (D.body) D.body.appendChild(pill);
    try {
      motionEngine.glideIndicator(pill, prevRect || prevBtn, nextRect || nextBtn, { durationMs: 220 });
    } catch {}
    streamChoreoCtl.scheduleTransient(() => pill.remove(), 240);
  };

  const formatSettingsSummary = (lang, ui) => {
    const pal = getEffectivePalette();
    const palLabel =
      pal === 'host'
        ? ui.optHost || (isZh() ? '跟随主题' : 'Host')
        : pal === 'warm'
        ? ui.optWarm || (isZh() ? 'Alabaster 暖岩' : 'Alabaster')
        : ui.optObsidian || (isZh() ? 'Obsidian 深空' : 'Obsidian');
    const lp =
      getLightPreset() === 'alabaster'
        ? ui.optLightAlabaster || (isZh() ? '暖白画册' : 'Warm Alabaster')
        : ui.optLightCrystal || (isZh() ? '白昼冷晶' : 'Daylight Crystal');
    const ml = getMotionLevel();
    const mlLabel =
      ml === 'off'
        ? ui.optMotionOff || (isZh() ? '动效关' : 'Off')
        : ml === 'subtle'
        ? ui.optMotionSubtle || (isZh() ? '克制' : 'Subtle')
        : ml === 'standard'
        ? ui.optMotionStandard || (isZh() ? '标准' : 'Standard')
        : ui.optMotionUltra || (isZh() ? '完整' : 'Ultra');
    return `${palLabel} · ${lp} · ${mlLabel}`;
  };

  const resolveSettingRowActiveValue = (key, lang) => {
    if (key === 'language') return lang;
    if (key === 'motionLevel') return getMotionLevel();
    if (key === 'targetFps') return getTargetFps();
    if (key === 'lightPreset') return getLightPreset();
    if (key === 'telemetryModule') return getTelemetryMode();
    if (key === 'effortSliderModule') return getEffortSliderMode();
    if (key === 'omniModule') return getOmniMode();
    if (key === 'linkTarget') return getLinkTarget();
    if (key === 'thoughtTranslate') return getThoughtTranslateMode();
    if (key === 'thoughtTrigger') return getThoughtTriggerTiming();
    if (key === 'thoughtView') return getThoughtView();
    if (key === 'accentTone') return getAccentTone();
    if (key === 'cornerStyle') return getCornerStyle();
    if (key === 'codeFont') return getCodeFont();
    if (key === 'codeLigatures') return isCodeLigaturesEnabled();
    if (key === 'contextMenu') return isContextMenuEnabled();
    if (key === 'ambientIntensity') return getAmbientIntensitySetting();
    if (key === 'palette') return getEffectivePalette();
    if (key === 'mascot') return cfg.mascot === 'dual' ? 'crab' : cfg.mascot;
    return cfg[key];
  };

  const isSettingButtonMatch = (key, btnValJson, curVal) => {
    if (JSON.stringify(curVal) === btnValJson) return true;
    if (key === 'palette' && (curVal === 'warm' || curVal === 'claude')) {
      return btnValJson === '"warm"' || btnValJson === '"claude"';
    }
    return false;
  };

  function ensureSettingsSection() {
    if (!settingsPanelMod || typeof settingsPanelMod.mountOrSyncSettingsSection !== 'function') return;
    settingsPanelMod.mountOrSyncSettingsSection({
      version: VERSION,
      getLang,
      uiText,
      isZh,
      i18nCore,
      formatSettingsSummary,
      resolveSettingRowActiveValue,
      isSettingButtonMatch,
      saveSetting,
      saveSettingsBatch,
      getConfig: () => ({ ...cfg }),
      getThoughtTranslateMode,
      handledGroupClicks,
      runSettingsGroupGlide,
      runGuardedMut,
    });
  }

  // ── Pulse Physical Water Vial Bridge & Micro-Interactions ──────────────
  let pulseBridgeInst = null;
  let motionBinding = null;
  let wasContextCardOpen = false;
  const calibratedPulseFooters = new WeakSet();
  const pulseHealTimers = new Set();

  const healBlockedExternalPulseBar = () => {
    if (destroyed) return;
    const bar = byId('ag-pulse-status-bar');
    if (!bar || ga(bar, 'data-ag-prism-fallback') === '1' || ga(bar, 'data-layout') !== 'blocked') return;
    const footer = bar[K_PE];
    if (!footer || !clHas(footer, 'agy-composer-footer') || calibratedPulseFooters.has(footer)) return;
    if ((rc(footer)?.width || 0) < 420) return;
    calibratedPulseFooters.add(footer);
    const prevRole = ga(footer, 'role');
    sa(footer, 'role', 'banner');
    W.dispatchEvent?.(new Event('resize'));
    const t = ST(() => {
      pulseHealTimers.delete(t);
      if (destroyed) return;
      if (prevRole) sa(footer, 'role', prevRole);
      else ra(footer, 'role');
      W.dispatchEvent?.(new Event('resize'));
    }, 220);
    pulseHealTimers.add(t);
  };

  const syncContextCardOpenNotify = () => {
    const pulseHost = byId('ag-prism-pulse-bar') || byId('ag-pulse-status-bar');
    const cardEl = byId('context-card') || pulseHost?.shadowRoot?.getElementById?.('context-card') || null;
    const openNow = Boolean(
      cardEl && cardEl[K_IC] !== false && !cardEl.hidden && ga(cardEl, 'aria-hidden') !== 'true' && cardEl.style?.display !== 'none'
    );
    if (openNow && !wasContextCardOpen) notifyMascot('vial-opened');
    wasContextCardOpen = openNow;
  };

  function ensurePulseBridge(forceSync = false) {
    healBlockedExternalPulseBar();
    syncContextCardOpenNotify();
    if (destroyed || !pulseVialBridgeMod || typeof pulseVialBridgeMod.mountPulseVialBridge !== 'function') return;
    if (getTelemetryMode() === 'off') {
      if (pulseBridgeInst) {
        try {
          pulseBridgeInst.destroy?.();
        } catch {}
        pulseBridgeInst = null;
      }
      return;
    }
    if (!pulseBridgeInst) {
      try {
        pulseBridgeInst = pulseVialBridgeMod.mountPulseVialBridge({ win: W, doc: D });
      } catch {
        pulseBridgeInst = null;
      }
    } else if (forceSync && typeof pulseBridgeInst.sync === 'function') {
      try {
        void pulseBridgeInst.sync();
      } catch {}
    }
  }

  // ── FastDOM Two-Phase Incremental Synchronization Loop ─────────────────
  let syncQueued = false;
  let syncTimer = null;
  let syncIsRaf = false;

  const cancelScheduledSync = () => {
    if (syncTimer === null) return;
    try {
      if (syncIsRaf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(syncTimer);
      } else {
        CT(syncTimer);
      }
    } catch {}
    syncTimer = null;
    syncQueued = false;
  };

  const OWN_PLUGIN_SELECTOR =
    '.ag-cs-home-panel-seat, .ag-cs-ripple-host, .ag-cs-conv-aura-host, .ag-cs-crab, .ag-cs-prism-rim-cv, .ag-cs-model-glyph, [data-testid="orchestrator-effort-bar"], .ag-cs-thinking-spark, .ag-cs-smooth-caret, .ag-cs-liftoff-veil, .ag-cs-sidebar-glide-pill, .ag-cs-pill-glide, .ag-cs-stream-chunk, .ag-cs-thought-chunk, .ag-anim-icon, .ag-prism-omni-menu, .ag-prism-omni-pane, .ag-cs-ctx-menu, .ag-cs-ctx-toast, [data-ag-prism-omni-owned="1"], [data-ag-prism-sidebar-owned="1"], .ces-ag-section, .ces-set, #ag-codex-effort-slider-styles, #ag-pulse-status-bar, #context-card, #' +
    SETTINGS_SEC_ID +
    ', #ag-prism-css, #ag-prism-omni-css, #ag-prism-sidebar-studio-css, #ag-claude-style-css, #ag-prism-motion-off-css, #ag-prism-host-alert-css, ' +
    EXT_ZH_UI_SEL;

  const isOwnPluginNode = (target) => {
    if (!target) return false;
    const el = target.closest ? target : target.parentElement;
    if (!el || !el.closest) return false;
    if (el.closest('[data-ag-owned],[data-prism-ignore]')) return true;
    return Boolean(el.closest(OWN_PLUGIN_SELECTOR));
  };

  const isOwnPluginMutation = (m) => {
    if (!m) return false;
    if (isOwnPluginNode(m.target)) return true;
    const added = m.addedNodes;
    const removed = m.removedNodes;
    const addLen = added ? added.length : 0;
    const remLen = removed ? removed.length : 0;
    if (addLen + remLen > 0) {
      for (let i = 0; i < addLen; i++) {
        if (!isOwnPluginNode(added[i])) return false;
      }
      for (let i = 0; i < remLen; i++) {
        if (!isOwnPluginNode(removed[i])) return false;
      }
      return true;
    }
    return false;
  };

  const FAST_PRUNE_LEAF_TAGS = new Set([
    'SPAN', 'P', 'CODE', 'STRONG', 'EM', 'B', 'I', 'LI', 'TD', 'TH', 'TR', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  ]);

  const syncBgCmdWrapParent = (p) => {
    if (!p || p.isConnected === false || tagU(p) !== 'DIV') return;
    const has = AF(p.children || []).some((c) => tidOf(c) === 'background-task-command');
    if (has) setAttrIfChanged(p, 'data-ag-cs-bg-cmd-wrap', '1');
    else if (ha(p, 'data-ag-cs-bg-cmd-wrap')) ra(p, 'data-ag-cs-bg-cmd-wrap');
  };

  const stampBgCmdWrap = (scopeOrList) => {
    const items = Array.isArray(scopeOrList) ? scopeOrList : [scopeOrList || D];
    for (const el of items) {
      if (!el || el.isConnected === false) continue;
      if (tidOf(el) === 'background-task-command') {
        syncBgCmdWrapParent(el.parentElement);
        continue;
      }
      if (ha(el, 'data-ag-cs-bg-cmd-wrap')) syncBgCmdWrapParent(el);
      if (typeof el.querySelectorAll !== 'function') continue;
      if (!Array.isArray(scopeOrList)) {
        for (const w of qa(el, '[data-ag-cs-bg-cmd-wrap="1"]')) syncBgCmdWrapParent(w);
      }
      for (const c of qa(el, '[data-testid="background-task-command"]')) syncBgCmdWrapParent(c.parentElement);
    }
  };

  const AH_ID = 'ag-prism-host-alert-css';
  const TS_A = 'data-ag-turbo-dedup';
  const TI_A = 'data-ag-turbo-img';
  const syncHostTurbo = (roots) => {
    const ds = (s) => {
      if (!s || s.id || ga(s, TS_A) === '1') return;
      const t = s.textContent || '';
      if (!t.includes('remark-github-blockquote-alert/alert.css')) return;
      if (!D.getElementById?.(AH_ID)) {
        const h = D.head || D.documentElement;
        if (!h || !D.createElement) return;
        const g = D.createElement('style');
        g.id = AH_ID;
        sa(g, 'data-ag-prism-turbo', '1');
        sa(g, 'data-ag-owned', '1');
        g.textContent = t;
        h.appendChild(g);
      }
      sa(s, TS_A, '1');
      s.disabled = true;
      try { if (s.sheet) s.sheet.disabled = true; } catch {}
    };
    const oi = (m) => {
      if (!m || ga(m, TI_A) === '1' || ha(m, 'data-prism-ignore') || cl(m, '[data-prism-ignore]')) return;
      m.decoding = 'async';
      sa(m, 'decoding', 'async');
      const ld = ga(m, 'loading');
      if (!ld || ld === 'auto') { m.loading = 'lazy'; sa(m, 'loading', 'lazy'); }
      sa(m, TI_A, '1');
    };
    for (const el of Array.isArray(roots) ? roots : [roots || D]) {
      if (!el || el.isConnected === false) continue;
      const tg = tagU(el);
      if (tg === 'STYLE') ds(el);
      else if (tg === 'IMG') oi(el);
      else if (el.querySelectorAll) {
        for (const s of qa(el, `style:not([id]):not([${TS_A}])`)) ds(s);
        for (const m of qa(el, `img:not([${TI_A}])`)) oi(m);
      }
    }
  };
  const restoreHostTurbo = () => {
    D.getElementById?.(AH_ID)?.remove?.();
    for (const s of qa(D, `style[${TS_A}]`)) {
      s.disabled = false;
      try { if (s.sheet) s.sheet.disabled = false; } catch {}
      ra(s, TS_A);
    }
    for (const m of qa(D, `img[${TI_A}]`)) ra(m, TI_A);
  };

  let axE = null;
  let axO = null;
  const AX_A = 'data-ag-cs-aux-dual';
  const RESIZE_ATTR = 'data-ag-cs-resizing';
  const MASCOT_DRAG_ATTR = 'data-ag-cs-mascot-drag';
  const RESIZE_DEBOUNCE_MS = 120;
  let resizeEndTm = 0;
  let splitDragActive = false;
  const isDragSuspendedRoot = () => {
    const h = de();
    return ga(h, RESIZE_ATTR) === '1' || ga(h, MASCOT_DRAG_ATTR) === '1';
  };
  const finishResizing = (triggerSync = true) => {
    if (resizeEndTm) {
      CT(resizeEndTm);
      resizeEndTm = 0;
    }
    splitDragActive = false;
    const h = de();
    const had = ha(h, RESIZE_ATTR);
    if (had) runGuardedMut(() => ra(h, RESIZE_ATTR));
    if (had && triggerSync && !destroyed) {
      prismRimCtl.markDirty();
      dirtyFlags.a = true;
      scheduleSync();
    }
  };
  const scheduleResizingEnd = () => {
    if (resizeEndTm) CT(resizeEndTm);
    resizeEndTm = ST(() => finishResizing(true), RESIZE_DEBOUNCE_MS);
  };
  const bumpResizingPulse = () => {
    if (destroyed) return;
    const h = de();
    if (h && ga(h, RESIZE_ATTR) !== '1') runGuardedMut(() => sa(h, RESIZE_ATTR, '1'));
    if (!splitDragActive) scheduleResizingEnd();
  };
  const isSplitResizeHandle = (el) => {
    if (!el) return false;
    const split = cl(el, '[data-testid="aux-pane-split"], [data-testid="sidebar-split"]');
    if (split) {
      const sep = split.children?.[1] || null;
      if (sep && (el === sep || sep.contains?.(el))) return true;
      const roleHit = cl(
        el,
        '[role="separator"], [data-testid*="resize"], [data-testid*="sash"], [data-resize-handle], [class*="resiz"], [class*="sash"]'
      );
      if (roleHit && split.contains?.(roleHit)) return true;
    }
    return Boolean(cl(el, '[data-testid="bottom-terminal-panel-resize-handle"]'));
  };
  const AX_H = /(?:^|[;\s])(?:width\s*:\s*0(?:\s|;|px|%|!|$)|display\s*:\s*none|position\s*:\s*absolute)/i;
  const axV = (e) =>
    Boolean(
      e &&
        tagU(e) === 'DIV' &&
        !e.hidden &&
        !ha(e, 'hidden') &&
        ga(e, 'aria-hidden') !== 'true' &&
        ga(e, 'data-split-overlaid') !== 'true' &&
        e.style?.display !== 'none' &&
        e.style?.position !== 'absolute' &&
        e.style?.width !== '0' &&
        e.style?.width !== '0px' &&
        !AX_H.test(ga(e, 'style') || '')
    );
  const axCh = (s) => [
    s.firstElementChild !== undefined ? s.firstElementChild : s.children?.[0] || null,
    s.lastElementChild !== undefined ? s.lastElementChild : s.children?.[s.children.length - 1] || null,
  ];
  const axU = (s) => {
    if (!s || s.isConnected === false) return false;
    const prev = ha(s, AX_A);
    const [f, l] = axCh(s);
    const tr = ga(s, 'data-split-transition');
    const next = Boolean(tr !== 'maximizing' && tr !== 'restoring' && tr !== 'closing' && f && l && f !== l && axV(f) && axV(l));
    if (next) setAttrIfChanged(s, AX_A, '1');
    else if (prev) ra(s, AX_A);
    return next !== prev;
  };
  const syncAuxSplit = () => {
    const s = qs(D, '[data-testid="aux-pane-split"]');
    if (s !== axE) {
      try { axO?.disconnect?.(); } catch {}
      axO = null;
      if (axE?.isConnected !== false) ra(axE, AX_A);
      axE = s;
      if (s && typeof MutationObserver === 'function') {
        const o = { attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style', 'class', 'data-split-overlaid'] };
        const rb = () => {
          if (!destroyed && axO && axE) {
            axO.disconnect();
            try {
              axO.observe(axE, { childList: true, attributes: true, attributeFilter: ['data-split-transition'] });
              const [f, l] = axCh(axE);
              if (f) axO.observe(f, o);
              if (l && l !== f) axO.observe(l, o);
            } catch {}
          }
        };
        axO = new MutationObserver((rs) => {
          if (!destroyed && axE) {
            if (rs?.some?.((r) => r.type === 'childList')) rb();
            let dualChanged = false;
            runGuardedMut(() => { dualChanged = axU(axE); });
            if (!dualChanged && rs?.some?.((r) => r.type === 'attributes' && r.attributeName === 'style')) {
              bumpResizingPulse();
            }
          }
        });
        rb();
      }
    }
    if (s) axU(s);
  };

  const HC_ATTR = 'data-hover-card-popup';
  const isHoverCardNode = (node) => {
    if (!node) return false;
    const el = isElementLike(node) ? node : node.parentElement;
    if (!el) return false;
    if (ha(el, HC_ATTR) || (ga(el, 'role') === 'presentation' && ha(el.firstElementChild, HC_ATTR))) return true;
    return Boolean(cl(el, '[' + HC_ATTR + ']'));
  };

  const COMP_TIDS = new Set([
    'agent-input-box',
    'input-cancel-button',
    'stop-button',
    'cancel-button',
    'agent-loading',
    'send-button',
    'input-send-button',
    'model-selector-trigger',
    'interaction-takeover-card',
    'side-question-panel',
    'running-items-panel',
    'queued-messages-card',
  ]);
  const COLL_TIDS = new Set([
    'worked-for-collapsible',
    'thinking-collapsible-trigger',
    'tool-group-collapsible',
    'changed-files-card-header',
    'sidecar-iframe',
    'artifact-view',
  ]);

  const classifyDirtySubtree = (el, isAdded, parentCtx = null) => {
    if (!isElementLike(el)) return;
    const tid = tidOf(el);
    const role = String(ga(el, 'role') || '');
    const cls = String(el.className || '');
    const tg = tagU(el);
    const hasChildEl =
      el.firstElementChild !== undefined ? !!(el.firstElementChild) : !!(el.children && el.children.length > 0);
    const q = (s) => hasChildEl && Boolean(qs(el, s));

    if (!tid && !role && !el.id && !cls.includes('agy-') && !cls.includes('surface-') && FAST_PRUNE_LEAF_TAGS.has(tg) && !hasChildEl) {
      return;
    };

    if (ha(el, HC_ATTR) || (role === 'presentation' && ha(el.firstElementChild, HC_ATTR)) || (!parentCtx && cl(el, '[' + HC_ATTR + ']'))) {
      return;
    }

    if (tid === 'aux-pane-split' || q('[data-testid="aux-pane-split"]')) dirtyFlags.a = true;

    if (tid === 'background-task-command') {
      if (isAdded) {
        dirtyFlags.m = true;
        dirtyBgCmds.add(el);
      }
      return;
    }

    const ancConv = parentCtx ? parentCtx.inConv : Boolean(cl(el, '[data-testid="conversation-view"]'));
    const ancComp = parentCtx ? parentCtx.inComp : Boolean(cl(el, '[data-testid="agent-input-box"]'));
    const ancSide = parentCtx ? parentCtx.inSide : Boolean(cl(el, 'aside'));
    const ancDlg = parentCtx ? parentCtx.inDlg : Boolean(cl(el, '[role="dialog"]'));
    const ancMdl = parentCtx ? parentCtx.inMdl : Boolean(cl(el, MODEL_PANEL_SEL));

    let touchedButtons = false;
    let inPlainDialog = false;
    const inConvStream = tid !== 'conversation-view' && tid !== 'agent-input-box' && !cls.includes('agy-home') && ancConv && !ancComp;

    if (!inConvStream) {
      if (
        cls.includes('agy-home') ||
        tid === 'conversation-view' ||
        tid === 'home-greeting' ||
        q(isAdded ? '.agy-home, [data-testid="conversation-view"], [data-testid="home-greeting"]' : '.agy-home, [data-testid="conversation-view"]')
      ) {
        dirtyFlags.r = dirtyFlags.c = dirtyFlags.l = dirtyFlags.tk = dirtyFlags.cf = touchedButtons = true;
      }

      if (tid === 'conversation-row-sidebar' || ancSide || q('[data-testid="conversation-row-sidebar"]')) {
        dirtyFlags.s = true;
        if (isAdded) touchedButtons = true;
      }

      if (COMP_TIDS.has(tid) || cls.includes('surface-composer-card') || ancComp || q('[data-testid="agent-input-box"], [data-testid="input-cancel-button"], [data-testid="interaction-takeover-card"], [data-testid="queued-messages-card"], .surface-composer-card')) {
        dirtyFlags.c = dirtyFlags.r = true;
        if (isAdded) touchedButtons = true;
      }

      const isModelOrPulse =
        tid === 'model-selector-panel' ||
        el.id === 'ag-pulse-status-bar' ||
        el.id === 'ag-prism-pulse-bar' ||
        el.id === 'context-card' ||
        ancMdl ||
        q(MODEL_PANEL_SEL + ', #context-card');

      const isDialogRoot = role === 'dialog' || q('[role="dialog"]');

      if (isModelOrPulse) {
        dirtyFlags.o = dirtyFlags.c = true;
        if (isAdded) touchedButtons = true;
      } else if (isDialogRoot || ancDlg) {
        inPlainDialog = true;
        if (isDialogRoot || (isAdded && (tg === 'H2' || cls.includes('space-y-2') || q('h2, div.space-y-2')))) {
          dirtyFlags.g = true;
        }
        if (isAdded && (isDialogRoot || cls.includes('agy-overlay'))) dirtyFlags.o = true;
      } else if (tid === 'overview-panel' || cls.includes('agy-overlay') || q('[data-testid="overview-panel"]') || (q('.agy-overlay') && !q('[' + HC_ATTR + ']'))) {
        dirtyFlags.o = true;
      }
    } else {
      if (
        tid === 'interaction-takeover-card' ||
        tid === 'queued-messages-card' ||
        tid === 'side-question-panel' ||
        tid === 'running-items-panel' ||
        tid === 'agent-loading' ||
        q('[data-testid="interaction-takeover-card"], [data-testid="queued-messages-card"], [data-testid="side-question-panel"], [data-testid="running-items-panel"]')
      ) {
        dirtyFlags.c = true;
      }
      if (role === 'dialog' || ancDlg) {
        inPlainDialog = true;
        if (role === 'dialog' || (isAdded && (tg === 'H2' || cls.includes('space-y-2') || q('h2, div.space-y-2')))) {
          dirtyFlags.g = true;
        }
        if (isAdded && role === 'dialog') dirtyFlags.o = true;
      } else if (tid === 'overview-panel' || cls.includes('agy-overlay')) {
        dirtyFlags.o = true;
      }
    }

    if (isAdded && q('[data-testid="background-task-command"]')) {
      dirtyFlags.m = true;
      dirtyBgCmds.add(el);
    }

    if (isAdded) {
      if (tg === 'STYLE' || tg === 'IMG') {
        dirtyTurboRoots.add(el);
      } else if (hasChildEl) {
        if (inConvStream && typeof el.getElementsByTagName === 'function') {
          if (el.getElementsByTagName('img').length > 0 || el.getElementsByTagName('style').length > 0) {
            dirtyTurboRoots.add(el);
          }
        } else if (q(`style:not([id]):not([${TS_A}]),img:not([${TI_A}])`)) {
          dirtyTurboRoots.add(el);
        }
      }
    }

    if (tid === 'thinking-collapsible-trigger') {
      dirtyFlags.l = dirtyFlags.tk = true;
      if (isAdded) dirtyCollapsibleTargets.add(el);
    } else if (tid === 'changed-files-card-header') {
      dirtyFlags.l = dirtyFlags.cf = true;
      if (isAdded) dirtyCollapsibleTargets.add(el);
    } else if (tg === 'PRE' || COLL_TIDS.has(tid)) {
      dirtyFlags.l = true;
      if (isAdded) dirtyCollapsibleTargets.add(el);
    } else if (hasChildEl) {
      const collHit = qs(
        el,
        '[data-testid="worked-for-collapsible"], [data-testid="thinking-collapsible-trigger"], [data-testid="changed-files-card-header"], [data-testid="sidecar-iframe"], [data-testid="artifact-view"], pre'
      );
      if (collHit) {
        dirtyFlags.l = true;
        if (isAdded) dirtyCollapsibleTargets.add(el);
        const hitTid = tidOf(collHit);
        if (hitTid === 'thinking-collapsible-trigger' || qs(el, '[data-testid="thinking-collapsible-trigger"]')) {
          dirtyFlags.tk = true;
        }
        if (hitTid === 'changed-files-card-header' || qs(el, '[data-testid="changed-files-card-header"]')) {
          dirtyFlags.cf = true;
        }
      }
    }

    if (!inPlainDialog) {
      if (isAdded && (touchedButtons || isHostButtonCandidate(el) || q(HOST_BTN_QUERY))) {
        dirtyFlags.b = true;
        dirtyAddedRoots.add(el);
      } else if (touchedButtons) {
        dirtyFlags.b = true;
      }
    }
  };

  const measureSyncPhase = (flags, isFullSync = false) => {
    const inHome = Boolean(qs(D, '.agy-home'));
    const inHero = inHome && Boolean(qs(D, '.agy-home [data-testid="home-greeting"]'));
    const formalConv = !inHome ? streamChoreoCtl.findFormalConvView() : null;
    const curCascadeId = formalConv ? ga(formalConv, 'data-cascade-id') || resolveCascadeId(null) || '' : '';
    const isConvSwap = Boolean(
      formalConv &&
        ((lastFormalConvEl && formalConv !== lastFormalConvEl) ||
          (curCascadeId && lastFormalCascadeId && curCascadeId !== lastFormalCascadeId))
    );
    const isAsyncConvEntry =
      !isFullSync && !inHome && !!(formalConv) && (!streamChoreoCtl.heroState.wasInFormalConv || isConvSwap);

    let homeComposerSampled = false;
    if (inHome && (flags.f || flags.r || flags.c)) {
      streamChoreoCtl.sampleHomeComposerRect();
      homeComposerSampled = true;
    }

    let convInputRect = null;
    if (streamChoreoCtl.heroState.routeInitialized && streamChoreoCtl.heroState.wasInHome && !inHome && formalConv && isMotionUltra() && !streamChoreoCtl.isEntryMotionSuppressed?.()) {
      convInputRect = rc(qs(formalConv, '[data-testid="agent-input-box"]') || qs(D, '[data-testid="agent-input-box"]'));
    }

    const sidebarSnap = flags.f || flags.s || flags.r ? streamChoreoCtl.measureSidebarSelectionSnapshot() : null;
    const visibleChangedHeaders =
      !isAsyncConvEntry && (flags.f || flags.cf || flags.r) ? streamChoreoCtl.measureVisibleChangedHeaders() : [];
    const lensOverlays = (flags.f || flags.o) && isMotionStandardOrUltra() ? streamChoreoCtl.measureNewLensOverlays() : [];
    const caretList =
      !isAsyncConvEntry && (flags.f || flags.c) && cfg.smoothCaret !== false
        ? smoothCaretCtl.measureSnapshot(false, false)
        : null;
    if (flags.f || flags.r || flags.c || flags.t) {
      convAuraCtl.prime?.();
    };

    return {
      inHome,
      inHero,
      formalConv,
      curCascadeId,
      isConvSwap,
      isAsyncConvEntry,
      homeComposerSampled,
      convInputRect,
      sidebarSnap,
      visibleChangedHeaders,
      lensOverlays,
      caretList,
    };
  };

  let enhancerSyncTimer = 0;
  let enhancerSyncRaf = 0;
  let lastEnhancerSyncAt = 0;
  const enhancerDirty = { f: false, r: false, l: false, c: false, b: false, t: false, s: false, g: false, o: false };
  const resetEnhancerDirty = () => {
    enhancerDirty.f = enhancerDirty.r = enhancerDirty.l = enhancerDirty.c = enhancerDirty.b = enhancerDirty.t = enhancerDirty.s = enhancerDirty.g = enhancerDirty.o = false;
  };
  const mergeEnhancerDirty = (src) => {
    if (!src) {
      enhancerDirty.f = true;
      return;
    }
    if (src.f) enhancerDirty.f = true;
    if (src.r) enhancerDirty.r = true;
    if (src.l) enhancerDirty.l = true;
    if (src.c) enhancerDirty.c = true;
    if (src.b) enhancerDirty.b = true;
    if (src.t) enhancerDirty.t = true;
    if (src.s) enhancerDirty.s = true;
    if (src.g) enhancerDirty.g = true;
    if (src.o) enhancerDirty.o = true;
  };
  const cancelHostEnhancerSync = () => {
    if (enhancerSyncTimer) {
      CT(enhancerSyncTimer);
      enhancerSyncTimer = 0;
    }
    if (enhancerSyncRaf) {
      try {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(enhancerSyncRaf);
      } catch {}
      enhancerSyncRaf = 0;
    }
  };
  const flushHostEnhancerSync = () => {
    cancelHostEnhancerSync();
    if (destroyed) return;
    lastEnhancerSyncAt = Date.now();
    const mask = { ...enhancerDirty };
    resetEnhancerDirty();
    try {
      hostEnhancerCtl.sync?.(mask.f ? undefined : mask);
    } catch {}
  };
  const queueHostEnhancerAsync = () => {
    if (destroyed || enhancerSyncRaf) return;
    if (!D.hidden && typeof requestAnimationFrame === 'function') {
      enhancerSyncRaf = requestAnimationFrame(() => {
        enhancerSyncRaf = 0;
        flushHostEnhancerSync();
      });
    } else if (!enhancerSyncTimer) {
      enhancerSyncTimer = ST(flushHostEnhancerSync, 0);
    }
  };
  const scheduleHostEnhancerSync = (immediate, srcFlags) => {
    if (destroyed) return;
    mergeEnhancerDirty(srcFlags);
    if (immediate || !isConvRunning()) {
      if (enhancerSyncTimer) {
        CT(enhancerSyncTimer);
        enhancerSyncTimer = 0;
      }
      queueHostEnhancerAsync();
      return;
    }
    const elapsed = Date.now() - lastEnhancerSyncAt;
    if (elapsed >= 200) {
      if (enhancerSyncTimer) {
        CT(enhancerSyncTimer);
        enhancerSyncTimer = 0;
      }
      queueHostEnhancerAsync();
      return;
    }
    if (!enhancerSyncTimer && !enhancerSyncRaf) {
      enhancerSyncTimer = ST(() => {
        enhancerSyncTimer = 0;
        queueHostEnhancerAsync();
      }, Math.max(32, 200 - elapsed));
    }
  };

  let hadModelPanelOpen = false;

  const runSync = (forceFull = false) => {
    if (destroyed) return;
    const t0 = performance.now();
    if (forceFull) markAllDirty();

    const flags = { ...dirtyFlags };
    const addedRoots = AF(dirtyAddedRoots);
    const collapsibleScope = dirtyCollapsibleTargets.size > 0 ? new Set(dirtyCollapsibleTargets) : null;
    const bgCmdNodes = dirtyBgCmds.size > 0 ? AF(dirtyBgCmds) : null;
    const turboRoots = dirtyTurboRoots.size > 0 ? AF(dirtyTurboRoots) : null;
    dirtyAddedRoots.clear();
    dirtyCollapsibleTargets.clear();
    dirtyBgCmds.clear();
    dirtyTurboRoots.clear();
    for (const k of O.keys(dirtyFlags)) dirtyFlags[k] = false;

    const prevWasInHome = streamChoreoCtl.heroState.wasInHome;
    const prevWasInConv = streamChoreoCtl.heroState.wasInFormalConv;
    const effectiveFull = !!(forceFull || flags.f);

    // ── Phase 1: Pure Measure ──
    const measured = measureSyncPhase(flags, effectiveFull);
    const deferHeavyConvWork = !!(measured.isAsyncConvEntry);
    if (measured.inHome) {
      lastFormalConvEl = null;
      lastFormalCascadeId = '';
    } else if (measured.formalConv) {
      lastFormalConvEl = measured.formalConv;
      if (measured.curCascadeId) lastFormalCascadeId = measured.curCascadeId;
    }
    if (measured.isConvSwap || (measured.inHome && prevWasInConv)) {
      streamChoreoCtl.cancelDeferredHydration();
    }

    const actualRouteJump =
      measured.isConvSwap ||
      measured.inHome !== prevWasInHome ||
      !!(measured.formalConv) !== prevWasInConv;
    const routeJumped = effectiveFull || actualRouteJump;

    // ── Phase 2: Pure Mutate ──
    runGuardedMut(() => {
      applyRootAttrs(effectiveFull);
      if (actualRouteJump) {
        for (const a of ['data-ag-cs-stage-glide', 'data-ag-cs-sonar', 'data-ag-cs-caustic']) {
          qa(D, `[${a}]`).forEach((el) => ra(el, a));
        }
      }
      if (effectiveFull || flags.m) {
        stampBgCmdWrap(effectiveFull ? D : bgCmdNodes);
      }
      if (effectiveFull || turboRoots) {
        syncHostTurbo(effectiveFull ? D : turboRoots);
      }
      if (effectiveFull || flags.r || flags.s || flags.a || !axE || axE[K_IC] === false) {
        syncAuxSplit();
      }

      if (flags.f || flags.r || measured.inHero !== homeStudioCtl.wasHero()) {
        homeStudioCtl.syncGreeting(measured.inHero);
        if (cfg.homeLayout !== 'studio') {
          homeStudioCtl.unmountPanelSeat();
        } else if (measured.inHero) {
          homeStudioCtl.renderHomePanel();
        } else {
          homeStudioCtl.parkPanelSeat();
        }
      }

      if (flags.f || flags.r || flags.t) {
        rippleCtl.sync();
      }
      if (flags.f || flags.r || flags.c || flags.t) {
        convAuraCtl.sync(true);
      }
      const modelPanelNow = effectiveFull || flags.c || flags.o ? qs(D, MODEL_PANEL_SEL) : null;
      const modelOverlayChanged = !!(flags.o) && (!!(modelPanelNow) || hadModelPanelOpen);
      if (effectiveFull || flags.c || flags.o) {
        hadModelPanelOpen = !!(modelPanelNow);
        syncModelMenuRootAttrs(modelPanelNow);
      }
      if (flags.f || flags.c || modelOverlayChanged) {
        syncComposers(measured, deferHeavyConvWork);
      } else if (!deferHeavyConvWork && flags.tk) {
        streamChoreoCtl.syncThinkingSparks(latestPrimaryModelInfo);
      }
      if (flags.f || flags.r || flags.s || flags.c) {
        streamChoreoCtl.syncHeroRouteChoreography(measured);
      } else if (flags.cf) {
        streamChoreoCtl.syncHeroCCaustics(measured.visibleChangedHeaders);
      }
      if (!deferHeavyConvWork && (flags.f || flags.r || flags.c || flags.l)) {
        streamChoreoCtl.syncDualStreamEngine();
      }
      if (flags.f || flags.o) {
        streamChoreoCtl.syncLensOverlayOrigins(measured.lensOverlays);
        syncPopupOverlayMirrors();
      }

      if (routeJumped || flags.r || flags.c || flags.o) {
        prismRimCtl.markDirty();
      }

      if (deferHeavyConvWork) {
        const outerAddedRoots = addedRoots.filter(
          (r) => r && r[K_IC] !== false && (!measured.formalConv || !measured.formalConv.contains?.(r))
        );
        if (outerAddedRoots.length > 0) syncHostAnimatedIcons(outerAddedRoots);
        const expectedConv = measured.formalConv;
        const expectedCid = measured.curCascadeId || '';
        const verifyTargetConv = () => {
          if (destroyed) return null;
          const convNow = streamChoreoCtl.findFormalConvView();
          if (!convNow) return null;
          const nowCid = ga(convNow, 'data-cascade-id') || resolveCascadeId(null) || '';
          if (convNow !== expectedConv || (expectedCid && nowCid && nowCid !== expectedCid)) {
            dirtyFlags.r = true;
            scheduleSync();
            return null;
          }
          return convNow;
        };
        streamChoreoCtl.scheduleDeferredConvEntry(
          () => {
            const convNow = verifyTargetConv();
            if (!convNow) return false;
            runGuardedMut(() => {
              stampBgCmdWrap(convNow);
              streamChoreoCtl.syncThinkingSparks(latestPrimaryModelInfo);
              streamChoreoCtl.syncDualStreamEngine();
              streamChoreoCtl.syncHeroCCaustics();
            });
            scheduleHostEnhancerSync(false, { f: true });
            smoothCaretCtl.queue(false, false, false);
            return true;
          },
          140,
          () => {
            const convNow = verifyTargetConv();
            if (!convNow) return;
            runGuardedMut(() => {
              syncHostAnimatedIcons([convNow]);
            });
            streamChoreoCtl.syncWorkedForAutoUnfold();
            if (getThoughtTranslateMode() !== 'off') {
              try {
                W.__agPrismThought?.scan?.();
              } catch {}
            }
          }
        );
      } else {
        if (flags.f) {
          syncHostAnimatedIcons(null);
        } else if (routeJumped) {
          const jumpRoots = [qs(D, '.agy-home'), measured.formalConv, ...addedRoots].filter(Boolean);
          syncHostAnimatedIcons(jumpRoots.length > 0 ? jumpRoots : null);
        } else if (flags.b && addedRoots.length > 0) {
          syncHostAnimatedIcons(addedRoots);
        }

        if ((flags.f || flags.l || routeJumped) && getThoughtTranslateMode() !== 'off') {
          try {
            W.__agPrismThought?.scan?.();
          } catch {}
        }
      }
      if (flags.f || flags.g) {
        ensureSettingsSection();
      }
      if (flags.f || flags.r || flags.c || flags.t) {
        ensurePulseBridge(!!(flags.f || flags.t));
      }
    });
    if (!deferHeavyConvWork && (flags.f || flags.r || flags.l || flags.c || flags.b || flags.t || flags.s || flags.g || flags.o)) {
      const enhFlags = routeJumped ? { ...flags, f: true } : flags;
      scheduleHostEnhancerSync(!!(flags.f || routeJumped || flags.g || flags.o || (flags.t && !isConvRunning())), enhFlags);
    }
    if (!deferHeavyConvWork) {
      if (flags.f || routeJumped) {
        streamChoreoCtl.syncWorkedForAutoUnfold();
      } else if (flags.l) {
        streamChoreoCtl.syncWorkedForAutoUnfold(collapsibleScope);
      }
    }

    perfStats.lastSyncMs = +(performance.now() - t0).toFixed(3);
    perfStats.syncCount += 1;
  };

  function scheduleSync() {
    if (destroyed) return;
    const highPri = Boolean(
      dirtyFlags.f || dirtyFlags.r || dirtyFlags.t || dirtyFlags.s || dirtyFlags.c || dirtyFlags.o || dirtyFlags.g
    );
    if (syncQueued) {
      if (highPri && !syncIsRaf && !D.hidden && syncTimer) {
        CT(syncTimer);
        syncTimer = null;
        syncQueued = false;
      } else return;
    }
    syncQueued = true;
    const run = () => { syncTimer = null; syncQueued = false; runSync(false); };
    if (!D.hidden && (highPri || !isConvRunning()) && typeof requestAnimationFrame === 'function') {
      syncIsRaf = true;
      syncTimer = requestAnimationFrame(run);
    } else {
      syncIsRaf = false;
      syncTimer = ST(run, D.hidden ? 50 : 96);
    };
  }

  function onStoreChanged() {
    const inHero = Boolean(qs(D, '.agy-home'));
    if (inHero && cfg.homeLayout === 'studio') {
      homeStudioCtl.scheduleUsageRollupRefresh(1800);
    }
    if (D.hidden) {
      pendingHiddenFullSync = true;
      return;
    }
    const st = cachedStore?.getState?.();
    if (st) {
      const cs = st.conversation?.convoState;
      const cid = cs?.type === 'active' ? cs.cascadeId || '' : cs?.type === 'subagent' ? cs.childConversationId || '' : '';
      const entry = cid
        ? st.trajectorySummaries?.summaries?.[cid] ?? st.cascadeTrajectorySummaries?.[cid] ?? null
        : null;
      const sum = entry?.summary || entry || {};
      const snapKey = [
        location.pathname || '',
        cs?.type || '',
        cid,
        sum.status ?? '',
        sum.notFullyIdle ? 1 : 0,
        sum.hasError ? 1 : 0,
        sum.hasRunningSubagents ? 1 : 0,
        st.userStatus?.name || '',
      ].join('|');
      if (snapKey === lastStoreSnapKey) return;
      lastStoreSnapKey = snapKey;
    }
    dirtyFlags.c = dirtyFlags.r = true;
    scheduleSync();
  }

  // ── Event Handlers ─────────────────────────────────────────────────────
  let blurTm = 0;
  const clearWinBlur = () => {
    try {
      if (blurTm) { CT(blurTm); blurTm = 0; }
      const h = de();
      if (ha(h, BLUR_ATTR)) {
        runGuardedMut(() => ra(h, BLUR_ATTR));
        try { msRig?.syncPowerState?.(); } catch {}
        try { convAuraCtl.wake?.(false); } catch {}
        try { convAuraCtl.sync(true); } catch {}
        try { W.__agPrismTelemetry?.refresh?.(); } catch {}
      }
    } catch {}
  };
  const wakeWinBlur = () => {
    try {
      if (blurTm || ha(de(), BLUR_ATTR)) {
        clearWinBlur();
        if (typeof document.hasFocus === 'function' && !document.hasFocus()) onWinBlur();
      }
    } catch {}
  };
  function onWinBlur() {
    try {
      if (splitDragActive) {
        splitDragActive = false;
        scheduleResizingEnd();
      }
      if (destroyed || blurTm) return;
      blurTm = ST(() => {
        try {
          blurTm = 0;
          const h = de();
          if (!destroyed && (!D.hasFocus || !D.hasFocus()) && ga(h, BLUR_ATTR) !== '1') {
            runGuardedMut(() => sa(h, BLUR_ATTR, '1'));
            try { msRig?.syncPowerState?.(); } catch {}
          }
        } catch {}
      }, 1200);
    } catch {}
  }
  const onWinPointerMove = (ev) => {
    try {
      wakeWinBlur();
      if (isDragSuspendedRoot()) return;
      prismRimCtl.onPointerMove(ev);
    } catch {}
  };
  const onWinPointerUp = () => {
    try {
      if (destroyed || !splitDragActive) return;
      splitDragActive = false;
      scheduleResizingEnd();
    } catch {}
  };

  const onWinResize = () => {
    try {
      if (destroyed) return;
      prismRimCtl.markDirty();
      smoothCaretCtl.bumpMetricsEpoch();
      smoothCaretCtl.queue(false, false, true);
    } catch {}
  };

  const onWinStorage = (ev) => {
    try {
      if (destroyed || !ev) return;
      if (ev.key === STORAGE_PRISM_KEY || ev.key === STORAGE_FILE_CFG_KEY) {
        cfg = loadSettings(currentBaseConfig);
        markAllDirty();
        applyRootAttrs();
        scheduleSync();
      }
    } catch {}
  };

  const onDocVisibilityChange = () => {
    try {
      if (destroyed || D.hidden) return;
      if (typeof D.hasFocus !== 'function' || D.hasFocus()) clearWinBlur();
      if (pendingHiddenFullSync) {
        pendingHiddenFullSync = false;
        markAllDirty();
        scheduleSync();
      }
    } catch {}
  };

  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = tagU(el);
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      ga(el, 'contenteditable') === 'true' ||
      Boolean(el.isContentEditable || cl(el, '[contenteditable="true"], input, textarea, select, [role="textbox"]'))
    );
  };

  const SLASH_CMD_RE = /^\/(plan|goal|boost|teamwork|swarm|browser|compact|schedule|grill-me|learn)(?:\s|$)/i;
  let lastSlashNotifyAt = 0;
  let lastSlashNotifyCmd = '';
  const dispatchComposerSubmit = (scopeEl) => {
    const box =
      cl(scopeEl, '[data-testid="agent-input-box"]') ||
      cl(scopeEl, '.surface-composer-card') ||
      cl(scopeEl, '[data-testid="side-question-panel"], [data-side-panel-focus-scope="true"]');
    const editable = (box && qs(box, '[contenteditable="true"], textarea, input')) || scopeEl;
    const text = String(editable?.innerText ?? editable?.[K_TC] ?? editable?.value ?? '').trim();
    const m = SLASH_CMD_RE.exec(text);
    if (m) {
      const cmd = m[1].toLowerCase();
      const now = Date.now();
      if (cmd !== lastSlashNotifyCmd || now - lastSlashNotifyAt >= 800) {
        lastSlashNotifyCmd = cmd;
        lastSlashNotifyAt = now;
        notifyMascot('slash-cmd', { cmd });
      }
      return;
    }
    notifyMascot('send', {});
  };

  const onWinKeyDown = (ev) => {
    try {
      if (destroyed || !ev) return;
      wakeWinBlur();
      if (
        ev.key === 'Enter' &&
        !ev.shiftKey &&
        !ev.ctrlKey &&
        !ev.altKey &&
        !ev.metaKey &&
        !ev.isComposing &&
        ev.keyCode !== 229 &&
        cl(ev.target, '[data-testid="agent-input-box"] [contenteditable="true"]')
      ) {
        const slashMenu = qs(D, '[data-testid="slash-command-menu"]');
        if (slashMenu && (!slashMenu.getClientRects || slashMenu.getClientRects().length > 0)) return;
        if (cl(ev.target, '.agy-home')) streamChoreoCtl.triggerHomeLiftoffRippleBurst();
        convAuraCtl.triggerStart();
        dispatchComposerSubmit(ev.target);
        return;
      }
      if (
        ev.key === '[' &&
        !ev.ctrlKey &&
        !ev.metaKey &&
        !ev.altKey &&
        !isEditableTarget(ev.target) &&
        !cl(ev.target, '[role="dialog"], .monaco-editor')
      ) {
        const html = de();
        if (!html || cfg.sidebarRestyle === false) return;
        if (ga(html, 'data-ag-cs-sidebar-collapsed') === '1') ra(html, 'data-ag-cs-sidebar-collapsed');
        else sa(html, 'data-ag-cs-sidebar-collapsed', '1');
      }
    } catch {}
  };

  const onWinClick = (ev) => {
    try {
      if (destroyed || !ev?.target?.closest || isThoughtIsolatedNode(ev.target)) return;
      const t = ev.target;
      const isPulseNode = (n) => n?.id === 'ag-prism-pulse-bar' || n?.id === 'ag-pulse-status-bar';
      if (
        isPulseNode(t) ||
        cl(t, '#ag-prism-pulse-bar,#ag-pulse-status-bar') ||
        (typeof ev.composedPath === 'function' && ev.composedPath().some(isPulseNode))
      ) {
        ST(() => { if (!destroyed) syncContextCardOpenNotify(); }, 28);
      }

      if (cl(t, '[data-testid="thinking-collapsible-trigger"]') && getThoughtTranslateMode() !== 'off') {
        ST(() => { try { W.__agPrismThought?.scan?.(); } catch {} }, 25);
      }

      const sendBtn = cl(t, '[data-testid="input-send-button"], [data-testid="send-button"]');
      if (sendBtn && !sendBtn.disabled) {
        if (cl(sendBtn, '.agy-home')) streamChoreoCtl.triggerHomeLiftoffRippleBurst();
        if (ga(sendBtn, 'data-ag-cs-icon-injected') === 'arrow-up-launch' && isMotionStandardOrUltra()) {
          try { motionEngine?.triggerIcon?.(sendBtn, 'launch'); } catch {}
        }
        convAuraCtl.triggerStart();
        dispatchComposerSubmit(sendBtn);
      }

      const copyBtn = cl(t, '[data-ag-cs-icon-injected="copy-check"]') || cl(t, 'pre button, button[aria-label*="Copy" i], button[aria-label*="复制"]');
      if (copyBtn && !copyBtn.disabled && !isThoughtIsolatedNode(copyBtn)) {
        if (ga(copyBtn, 'data-ag-cs-icon-injected') === 'copy-check' && !motionReduced() && typeof motionEngine?.triggerIcon === 'function') {
          try { motionEngine.triggerIcon(copyBtn, 'check', { revertAfterMs: 1600 }); } catch {}
        }
        notifyMascot('code-copied');
      }

      const navTurn = cl(t, '[data-testid="conversation-navigator-turn"], [data-testid="conversation-navigator-group"]');
      if (navTurn) streamChoreoCtl.triggerHeroESonar(navTurn);

      const grpBtn = cl(t, '[role="dialog"] [role="group"] button');
      if (grpBtn && !ha(grpBtn, 'data-ag-cs-key') && !handledGroupClicks.has(ev)) {
        handledGroupClicks.add(ev);
        const grp = cl(grpBtn, '[role="group"]');
        const gp = streamChoreoCtl.heroState.lastGroupPress;
        if (gp && gp.group === grp && gp.prevBtn && gp.prevBtn !== grpBtn) {
          runSettingsGroupGlide(grp, gp.prevBtn, grpBtn, gp.prevRect);
        }
      }

      if (cl(t, '[data-testid="worked-for-collapsible"]') && cfg.composerRestyle !== false) {
        streamChoreoCtl.scheduleWorkedForClickSync();
      }
    } catch {}
  };

  const onDocPointerDown = (ev) => {
    try {
      wakeWinBlur();
      if (ev?.target?.closest) {
        const sbRow = cl(ev.target, '[data-testid="conversation-row-sidebar"]');
        if (sbRow) streamChoreoCtl.lockSidebarRowRunningOnPointerDown?.(sbRow);
        if (isSplitResizeHandle(ev.target)) {
          splitDragActive = true;
          const h = de();
          if (h && ga(h, RESIZE_ATTR) !== '1') runGuardedMut(() => sa(h, RESIZE_ATTR, '1'));
          if (resizeEndTm) CT(resizeEndTm);
          resizeEndTm = ST(() => finishResizing(true), 10000);
        }
      }
      if (isMotionStandardOrUltra() && ev?.target?.closest) {
        if (!cl(ev.target, '[role="dialog"]')) {
          // 懒测距：不在此处同步调用 getBoundingClientRect()，仅记录元素引用与点击坐标，延后到真有新浮层弹出时再测距
          const triggerEl = cl(ev.target, 'button, [role="button"], [data-testid]');
          const hasXY = Number.isFinite(ev.clientX) && Number.isFinite(ev.clientY);
          if (triggerEl || hasXY) {
            streamChoreoCtl.heroState.lastTriggerOrigin = {
              el: triggerEl || null,
              x: hasXY ? ev.clientX : NaN,
              y: hasXY ? ev.clientY : NaN,
              at: performance.now(),
            };
          }
        } else if (!cl(ev.target, '#' + SETTINGS_SEC_ID)) {
          const grp = cl(ev.target, '[role="dialog"] [role="group"]');
          if (grp?.children) {
            const prevBtn = AF(grp.children).find(
              (sib) => ga(sib, 'aria-pressed') === 'true' || ha(sib, 'data-pressed') || ga(sib, 'aria-checked') === 'true' || ga(sib, 'data-state') === 'on'
            );
            streamChoreoCtl.heroState.lastGroupPress = { group: grp, prevBtn: prevBtn || null, prevRect: rc(prevBtn) };
          }
        }
      }
      notifyMascot('activity', {});
      if (cfg.smoothCaret !== false) smoothCaretCtl.queue(false);
    } catch {}
  };

  const MODIFIER_ONLY_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']);

  const onDocCaretEvent = (ev) => {
    try {
      const type = ev?.type || '';
      if ((type === 'keydown' || type === 'keyup') && ev?.key && MODIFIER_ONLY_KEYS.has(ev.key)) return;
      if (type === 'scroll' || type === 'selectionchange' || type === 'keydown' || type === 'keyup') {
        const ae = D.activeElement;
        if (!cl(ae, '[data-testid="agent-input-box"]')) return;
        if (type === 'scroll') {
          const st = ev?.target;
          if (
            st &&
            st !== ae &&
            !ae.contains?.(st) &&
            (st === D || st === de() || st === D.body || tidOf(st) === 'autoscroll-viewport' || !st.contains?.(ae))
          ) {
            return;
          }
        }
      }
      const isTyping = type === 'input' || type === 'keyup' || type === 'compositionupdate' || type === 'compositionend';
      const immediate = type === 'focusin' || type === 'mouseup' || type === 'transitionend';
      smoothCaretCtl.queue(isTyping, immediate, type === 'focusin', type === 'scroll');
      if (type === 'input' && cl(ev?.target, '[data-testid="agent-input-box"]')) {
        try {
          msRig?.onUserType?.((cl(ev.target, '[contenteditable="true"]') || ev.target)?.[K_TC] || '');
        } catch {}
      }
    } catch {}
  };

  const onDocTransitionEnd = (ev) => {
    try {
      if (cfg.smoothCaret !== false && cl(ev?.target, '[data-testid="agent-input-box"]')) {
        smoothCaretCtl.queue(false, true, false);
      }
    } catch {}
  };

  const ATTR_OBSERVED_TIDS = new Set([
    'conversation-view',
    'conversation-row-sidebar',
    'worked-for-collapsible',
    'thinking-collapsible-trigger',
    'changed-files-card-header',
    'running-items-panel',
    'toggle-aux-sidebar',
    'toggle-maximize-pane',
  ]);

  const observer = new MutationObserver((mutations) => {
    try {
      if (destroyed || internalDomMutating || streamChoreoCtl.isStreamMutating() || !mutations || mutations.length === 0) return;

      // 后台隐藏窗口挂起深扫：避免 Swarm 多窗口后台刷屏触发海量 querySelector，切回前台时由 visibilitychange 合并一次同步！
      if (D.hidden) {
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (!isThoughtMutationRecord(m) && !isOwnPluginMutation(m)) {
            pendingHiddenFullSync = true;
            break;
          }
        }
        return;
      }

      let anyRelevant = false;
      let ctxCache = null;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];

        if (m.type === 'attributes') {
          if (m.attributeName === 'data-ag-prism-host-i18n') {
            dirtyFlags.g = anyRelevant = true;
            continue;
          }
          const tgt = m.target;
          if (tgt === D.body || tgt === de()) {
            if (m.attributeName === 'data-ag-prism-mode') dirtyFlags.c = true;
            dirtyFlags.t = anyRelevant = true;
            continue;
          }
          if (tidOf(tgt?.[K_PE]) === 'aux-pane-split') {
            let dualChanged = false;
            runGuardedMut(() => { dualChanged = axU(tgt[K_PE]); });
            if (dualChanged) dirtyFlags.a = anyRelevant = true;
            else if (m.attributeName === 'style') bumpResizingPulse();
            continue;
          }
          const tid = tidOf(tgt);
          if (!ATTR_OBSERVED_TIDS.has(tid)) continue;
          if (isThoughtIsolatedNode(tgt) || isOwnPluginNode(tgt) || isHoverCardNode(tgt)) continue;
          if (tid === 'conversation-view') {
            if (m.attributeName === 'data-cascade-id') dirtyFlags.r = dirtyFlags.c = anyRelevant = true;
          } else if (tid === 'conversation-row-sidebar') {
            if (m.attributeName === 'data-selected' && ga(tgt, 'data-selected') === 'true') {
              streamChoreoCtl.stampSidebarRowRunningImmediate?.(tgt);
            }
            dirtyFlags.s = anyRelevant = true;
          } else if (tid === 'worked-for-collapsible' || tid === 'thinking-collapsible-trigger' || tid === 'changed-files-card-header') {
            dirtyFlags.l = anyRelevant = true;
            if (tid === 'thinking-collapsible-trigger') dirtyFlags.tk = true;
            else if (tid === 'changed-files-card-header') dirtyFlags.cf = true;
            dirtyCollapsibleTargets.add(tgt);
          } else if (tid === 'running-items-panel') {
            dirtyFlags.c = anyRelevant = true;
          } else if (tid === 'toggle-aux-sidebar' || tid === 'toggle-maximize-pane') {
            dirtyFlags.a = anyRelevant = true;
          }
          continue;
        }

        if (m.type === 'childList') {
          const tgt = m.target;
          if (tagU(tgt) === 'STYLE' && !tgt.id && ga(tgt, TS_A) !== '1') {
            dirtyTurboRoots.add(tgt);
            anyRelevant = true;
            continue;
          }
          let pCtx = null;
          if (isElementLike(tgt)) {
            if (!ctxCache) ctxCache = new Map();
            pCtx = ctxCache.get(tgt);
            if (!pCtx) {
              pCtx =
                isThoughtIsolatedNode(tgt) || isOwnPluginNode(tgt) || isHoverCardNode(tgt)
                  ? { skip: true }
                  : {
                      skip: false,
                      inConv: Boolean(cl(tgt, '[data-testid="conversation-view"]')),
                      inComp: Boolean(cl(tgt, '[data-testid="agent-input-box"]')),
                      inSide: Boolean(cl(tgt, 'aside')),
                      inDlg: Boolean(cl(tgt, '[role="dialog"]')),
                      inMdl: Boolean(cl(tgt, MODEL_PANEL_SEL)),
                    };
              ctxCache.set(tgt, pCtx);
            }
            if (pCtx.skip) continue;
            if (tidOf(tgt) === 'aux-pane-split') dirtyFlags.a = anyRelevant = true;
          }
          const inComposerBox = !!(pCtx && pCtx.inComp);
          const scanList = (list, isAdd) => {
            if (!list || !list.length) return;
            for (let j = 0; j < list.length; j++) {
              const node = list[j];
              if (!isElementLike(node) || isThoughtIsolatedNode(node) || isOwnPluginNode(node) || isHoverCardNode(node)) continue;
              if (isAdd && tidOf(node) === 'conversation-row-sidebar' && ga(node, 'data-selected') === 'true') {
                streamChoreoCtl.stampSidebarRowRunningImmediate?.(node);
              }
              classifyDirtySubtree(node, isAdd, pCtx);
              if (inComposerBox) dirtyFlags.c = dirtyFlags.r = true;
              anyRelevant = true;
            }
          };
          scanList(m.addedNodes, true);
          if (m.removedNodes && m.removedNodes.length > 0) {
            if (isElementLike(tgt) && ha(tgt, 'data-ag-cs-bg-cmd-wrap')) {
              dirtyFlags.m = anyRelevant = true;
              dirtyBgCmds.add(tgt);
            }
            scanList(m.removedNodes, false);
          }
        }
      }

      if (anyRelevant && (O.values(dirtyFlags).some(Boolean) || dirtyTurboRoots.size > 0)) {
        scheduleSync();
      }
    } catch {}
  });
  mainObserver = observer;

  // Strict test contract: NEVER register 'click' or 'mousedown' on D!
  const CAP_PASSIVE = { capture: true, passive: true };
  const CARET_LISTENERS = 'keyup:1|mouseup:0|input:1|selectionchange:1|focusin:0|focusout:0|scroll:0|compositionupdate:1|compositionend:1'.split('|');
  const DOC_LISTENERS = [
    ['pointerdown', onDocPointerDown, CAP_PASSIVE],
    ['transitionend', onDocTransitionEnd, CAP_PASSIVE],
    ['visibilitychange', onDocVisibilityChange, true],
  ];
  let caretListenersBound = false;
  const syncCaretListeners = (enabled) => {
    const want = Boolean(enabled && !destroyed && lifecycleStarted);
    if (want === caretListenersBound) return;
    caretListenersBound = want;
    const fn = want ? 'addEventListener' : 'removeEventListener';
    for (const s of CARET_LISTENERS) {
      const [ev, cap] = s.split(':');
      try { D[fn](ev, onDocCaretEvent, cap === '1' ? true : CAP_PASSIVE); } catch {}
    }
    if (!want && !destroyed) smoothCaretCtl.teardown();
  };

  const WIN_LISTENERS = [
    ['pointermove', onWinPointerMove, { passive: true }],
    ['pointerup', onWinPointerUp, { passive: true }],
    ['pointercancel', onWinPointerUp, { passive: true }],
    ['resize', onWinResize, { passive: true }],
    ['keydown', onWinKeyDown, true],
    ['click', onWinClick, true],
    ['storage', onWinStorage, false],
    ['blur', onWinBlur, false],
    ['focus', clearWinBlur, false],
  ];

  let pollTimer = null;
  let coreTornDown = false;
  const teardownCore = () => {
    if (coreTornDown) return;
    coreTornDown = true;
    destroyed = true;
    cancelScheduledSync();
    streamChoreoCtl.clearTransientTimers();
    dirtyAddedRoots.clear();
    dirtyCollapsibleTargets.clear();
    dirtyBgCmds.clear();
    dirtyTurboRoots.clear();
    clearWinBlur();
    finishResizing(false);
    unmountCrab();
    msLastHostSleep = false;
    if (crabRemoveAttrTimer) {
      CT(crabRemoveAttrTimer);
      crabRemoveAttrTimer = 0;
    }
    for (const t of pulseHealTimers) CT(t);
    pulseHealTimers.clear();
    syncMotionOffStyle(false);
    streamChoreoCtl.disconnectStreamObserver();
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    cancelHostEnhancerSync();
    resetEnhancerDirty();
    if (storeDebounce) {
      CT(storeDebounce);
      storeDebounce = null;
    }
    smoothCaretCtl.teardown();
    prismRimCtl.cancelPendingRaf();
    if (storeUnsub) {
      try {
        storeUnsub();
      } catch {}
      storeUnsub = null;
    }
    try {
      observer.disconnect();
    } catch {}
    try {
      axO?.disconnect?.();
      axE?.removeAttribute?.(AX_A);
    } catch {}
    axO = axE = null;
    syncCaretListeners(false);
    for (const [evName, handler, opts] of DOC_LISTENERS) {
      try {
        D.removeEventListener(evName, handler, opts);
      } catch {}
    }
    if (typeof W.removeEventListener === 'function') {
      for (const [evName, handler, opts] of WIN_LISTENERS) {
        try {
          W.removeEventListener(evName, handler, opts);
        } catch {}
      }
    }
    if (motionBinding && typeof motionBinding.unbind === 'function') {
      try {
        motionBinding.unbind();
      } catch {}
      motionBinding = null;
    }
    if (pulseBridgeInst && typeof pulseBridgeInst.destroy === 'function') {
      try {
        pulseBridgeInst.destroy();
      } catch {}
      pulseBridgeInst = null;
    }
    try {
      hostEnhancerCtl.destroy?.();
    } catch {}
    modelGlyphCtl.teardownCrystalMount();

    if (Array.isArray(GT.__agCsCleanups)) {
      const idx = GT.__agCsCleanups.indexOf(teardownCore);
      if (idx >= 0) GT.__agCsCleanups.splice(idx, 1);
    }
  };

  GT.__agCsCleanups = Array.isArray(GT.__agCsCleanups) ? GT.__agCsCleanups : [];
  GT.__agCsCleanups.push(teardownCore);

  let activePollMs = 0;
  const restartPollTimer = () => {
    const nextMs = Math.max(5000, Number(cfg.pollIntervalMs || currentBaseConfig.pollIntervalMs) || 5000);
    if (pollTimer !== null && activePollMs === nextMs) return;
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    activePollMs = nextMs;
    pollTimer = setInterval(() => {
      if (destroyed || D.hidden) return;
      const darkNow = isDarkTheme();
      const expectedThemeKey = `${getEffectivePalette()}|${getLightPreset()}|${darkNow ? 'd' : 'l'}|${getAccentTone()}|${getAmbientIntensitySetting()}|${getCornerStyle()}`;
      if (expectedThemeKey !== lastThemeKey || !D.documentElement?.hasAttribute('data-ag-prism')) {
        applyRootAttrs();
      }
      if (homeStudioCtl.wasHero() && cfg.homeLayout === 'studio') {
        homeStudioCtl.scheduleUsageRollupRefresh(1800);
      }
    }, nextMs);
  };

  let lifecycleStarted = false;
  const startLifecycle = () => {
    if (destroyed || lifecycleStarted || !D.documentElement) return;
    lifecycleStarted = true;
    flattenMainStyleSheet();
    observer.observe(D.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-expanded', 'data-selected', 'data-cascade-id', 'data-ag-prism-host-i18n', 'data-ag-prism-mode'],
    });
    for (const [evName, handler, opts] of DOC_LISTENERS) {
      D.addEventListener(evName, handler, opts);
    }
    syncCaretListeners(cfg.smoothCaret !== false);
    if (typeof W.addEventListener === 'function') {
      for (const [evName, handler, opts] of WIN_LISTENERS) {
        W.addEventListener(evName, handler, opts);
      }
      if (motionEngine && typeof motionEngine.bindMicroInteractions === 'function') {
        try {
          motionBinding = motionEngine.bindMicroInteractions(W);
        } catch {}
      }
    }

    syncMotionSpringTokens();
    restartPollTimer();
    if (typeof D.hasFocus === 'function' && !D.hasFocus()) onWinBlur();

    ensureHooks(true);
    markAllDirty();
    runSync(true);
    if (homeStudioCtl.wasHero() && cfg.homeLayout === 'studio') {
      homeStudioCtl.scheduleUsageRollupRefresh(1800);
    }
  };

  const prismRuntimeApi = {
    brand: 'Obsidian Prism',
    version: VERSION,
    legacyApiVersion: LEGACY_API_VERSION,
    codeHash: CODE_HASH,
    flattenCss: flattenMainStyleSheet,
    saveSettingsBatch,
    refreshConfig(next) {
      if (next && typeof next === 'object') {
        const fromFile = !!(next.__fromFile);
        const ackEpoch = Number(next.__ackEpoch) || 0;
        if (fromFile && ackEpoch > 0 && ackEpoch < localWriteEpoch) {
          return false;
        }
        const cleanNext = expandSettingAliases(stripRuntimeMetaKeys(next));
        currentBaseConfig = { ...currentBaseConfig, ...cleanNext };
        if (next.pollIntervalMs !== undefined) currentBaseConfig.pollIntervalMs = next.pollIntervalMs;
        if (next.binding !== undefined) currentBaseConfig.binding = next.binding;
        cfg = loadSettings(currentBaseConfig, fromFile ? null : cleanNext);
      } else {
        cfg = loadSettings(currentBaseConfig);
      }
      if (lifecycleStarted && !destroyed) restartPollTimer();
      markAllDirty();
      lastAbsorbedSyncKey = '';
      applyRootAttrs(true);
      runSync(true);
      return true;
    },
    sync() {
      if (!destroyed) {
        lastAbsorbedSyncKey = '';
        runSync(true);
      }
    },
    syncAbsorbed: () => syncAbsorbedModules(true),
    getState() {
      const convAura = convAuraCtl.getInstance();
      const auraConnected = !!(convAura && convAura.host && convAura.host.isConnected);
      const convAuraPhase = auraConnected ? convAuraCtl.advancePhase(performance.now()) : 'off';
      const rippleMount = rippleCtl.getMount();
      return {
        brand: 'Obsidian Prism',
        version: VERSION,
        cfg: {
          ...cfg,
          palette: getEffectivePalette(),
          lightPreset: getLightPreset(),
          motionLevel: getMotionLevel(),
          targetFps: getTargetFps(),
          telemetryModule: getTelemetryMode(),
          effortSliderModule: getEffortSliderMode(),
          thoughtTranslate: getThoughtTranslateMode(),
          thoughtTrigger: getThoughtTriggerTiming(),
          thoughtView: getThoughtView(),
          accentTone: getAccentTone(),
          cornerStyle: getCornerStyle(),
          scrollBottomMotion: cfg.scrollBottomMotion === 'instant' ? 'instant' : 'smooth',
          sidebarNavFold: cfg.sidebarNavFold === 'on' ? 'on' : 'off',
          codeFont: getCodeFont(),
          codeLigatures: isCodeLigaturesEnabled(),
          contextMenu: isContextMenuEnabled(),
          ambientIntensity: getAmbientIntensitySetting(),
          omniModule: getOmniMode(),
          linkTarget: getLinkTarget(),
          sidebarStudio: cfg.sidebarStudio === 'on' ? 'on' : 'off',
          autoUpdate: cfg.autoUpdate === 'on' ? 'on' : 'off',
          updateChannel: cfg.updateChannel === 'beta' ? 'beta' : 'stable',
        },
        motionLevel: getMotionLevel(),
        lightPreset: getLightPreset(),
        hasThoughtModule: !!(W.__agPrismThought),
        hasOmniModule: !!(W.__agPrismOmni),
        hasSidebarStudio: !!(W.__agPrismSidebar),
        hasContextMenu: !!(W.__agPrismContextMenu || GT.__agPrismContextMenu),
        hasHostEnhancer: !!(hostEnhancerCtl && typeof hostEnhancerCtl.getDebugState === 'function'),
        usageRecordsCount: homeStudioCtl.getUsageRecordsCount(),
        hasPanel: homeStudioCtl.hasConnectedPanel(),
        hasRipple: !!(rippleMount && rippleMount.canvas.isConnected),
        rippleSleeping: !!(!rippleMount || rippleMount.sleeping),
        rippleAura: rippleMount ? { ...rippleMount.aura } : null,
        hasConvAura: auraConnected,
        convAuraPhase,
        convAuraSleeping: !!(!convAura || convAura.sleeping),
        convAuraDrawCount: convAura ? convAura.drawCount : 0,
        convAuraCanvasSize: convAura ? { width: convAura.width, height: convAura.height } : null,
        convAuraOptics: convAura && convAura.lastOptics ? { ...convAura.lastOptics } : null,
        hasCrab: !!(msRoot && msRoot[K_IC]),
        hasDualRig: !!(msRig),
        hasSmoothCaret: Boolean(qs(D, '.ag-cs-smooth-caret')),
        hasPulseBridge: Boolean(pulseBridgeInst && pulseBridgeInst.getDebugState?.()?.attached),
        hasStreamObserver: streamChoreoCtl.hasStreamObserver(),
        modelInfo: latestPrimaryModelInfo ? { ...latestPrimaryModelInfo } : null,
        perf: { ...perfStats },
      };
    },
    suppressEntryMotion(ms) {
      streamChoreoCtl.suppressEntryMotion?.(ms);
    },
    destroy() {
      teardownCore();
      for (const k of ['__agPrismTelemetry', '__agPrismEffortSlider', '__agPrismThought', '__agPrismOmni', '__agPrismSidebar']) {
        try {
          W[k]?.destroy?.();
        } catch {}
      }
      try {
        W.__agPrismInlineDiff?.unbindHooks?.();
      } catch {}
      const targetCtxMenu = ownedCtxMenu || W.__agPrismContextMenu || GT.__agPrismContextMenu;
      try {
        targetCtxMenu?.destroy?.();
      } catch {}
      for (const fn of [
        () => streamChoreoCtl.cancelDeferredHydration(),
        () => homeStudioCtl.flushUsageCacheNow(),
        () => streamChoreoCtl.flushAllStreamArtifacts(),
        restoreAllHostAnimatedIcons,
        () => smoothCaretCtl.teardown(),
        () => prismRimCtl.teardown(),
        () => rippleCtl.unmount(),
        () => convAuraCtl.unmount(),
        () => streamChoreoCtl.clearWorkedForAutoUnfoldAttrs(),
        () => homeStudioCtl.unmountPanelSeat(),
        unmountCrab,
        () => homeStudioCtl.restoreGreetings(),
        restoreHostTurbo,
      ]) {
        try {
          fn();
        } catch {}
      }
      qa(D, '[data-ag-cs-placeholder]').forEach((el) => ra(el, 'data-ag-cs-placeholder'));
      qa(D, '[data-ag-cs-prism-box]').forEach((el) => {
        ra(el, 'data-ag-cs-prism-box');
        rp(el, '--ag-px');
        rp(el, '--ag-py');
      });
      qa(D, '[data-ag-cs-effort]').forEach((el) => {
        ra(el, 'data-ag-cs-effort');
        el[K_CL].remove('ag-cs-effort-badge');
      });
      qa(D, '[data-ag-cs-queued], [data-ag-cs-takeover]').forEach((el) => {
        ra(el, 'data-ag-cs-queued');
        ra(el, 'data-ag-cs-takeover');
        rp(el, 'margin-bottom');
      });
      qa(D, '[data-ag-row-stagger]').forEach((el) => {
        ra(el, 'data-ag-row-stagger');
        rp(el, '--ag-row-i');
      });
      qa(D, '.agy-overlay, .agy-fastpick, [data-testid="context-menu-popup"], [data-testid="context-menu-submenu-popup"], [data-ag-cs-overview-shell]').forEach((el) => {
        rp(el, '--ag-origin-x');
        rp(el, '--ag-origin-y');
      });
      for (const s of 'orch-active|model-overlay|aux-dual|overview-shell|prism-mirror|prism-reflect|settings-dlg|settings-nav|nav-active|conv-seat|vp-wrap|home-sheet|row-running|menu-open|auto-unfolded|outer-open|caustic|fiber-camp|sonar|stage-glide|liftoff-bubble|thought-streaming|spark-streaming|prism-cv|code-folded|bg-cmd-wrap|input-layer|hdr-open|rich-pre|glide-item'.split('|')) {
        const a = 'data-ag-cs-' + s;
        qa(D, `[${a}]`).forEach((el) => ra(el, a));
      }
      for (const a of ['data-has-sep', 'data-pv-warn']) {
        qa(D, `[${a}]`).forEach((el) => ra(el, a));
      }
      qa(
        D,
        '#ag-prism-settings-v101-css, #ag-prism-omni-css, #ag-prism-motion-off-css, .ag-omni-dock, .ag-omni-menu, .ag-prism-omni-menu, .ag-prism-omni-pane, .ag-cs-ctx-menu, .ag-cs-ctx-toast, .ag-cs-sb-more-wrap, [data-ag-prism-omni-owned="1"], .ag-cs-liftoff-veil, .ag-cs-sidebar-glide-pill, .ag-cs-pill-glide, .ag-cs-conv-aura-host, .ag-cs-conv-glow, .ag-cs-prism-rim-cv, .ag-cs-code-fold-btn, .ag-cs-nav-outline-popover, .ag-cs-model-glyph, .ag-cs-panel-row-glyph, [data-testid="orchestrator-effort-bar"], .ag-cs-thinking-spark, .ag-cs-orbital-backdrop, .ag-cs-perf-backdrop, .ag-v2-habitat-prop, #' +
          SETTINGS_SEC_ID
      ).forEach((el) => el.remove());
      const html = de();
      if (html) {
        for (const s of 'style|theme|palette|light-preset|motion|target-fps|telemetry|effort-slider|thought-translate|home|composer|logo-ink|sidebar|sidebar-compact|sidebar-collapsed|sb-fold|has-crab|model-menu|lang|cjk|accent|corners|code-font|ligatures|ambient|win-blur|scroll-bottom|resizing|mascot-drag'.split('|')) {
          ra(html, 'data-ag-cs-' + s);
        }
        for (const s of '|thought-view|omni|link-target|sidebar-studio|sidebar-host-sync'.split('|')) {
          ra(html, s ? 'data-ag-prism-' + s : 'data-ag-prism');
        }
        rp(html, '--ag-spring-sidebar-ease');
        rp(html, '--ag-spring-sidebar-dur');
      }
    },
  };

  W.__agPrism = prismRuntimeApi;
  W.__agClaudeStyle = prismRuntimeApi;

  if (D.documentElement) {
    startLifecycle();
  } else if (typeof D.addEventListener === 'function') {
    const onReady = () => {
      try {
        if (D.documentElement) {
          D.removeEventListener('readystatechange', onReady);
          D.removeEventListener('DOMContentLoaded', onReady);
          startLifecycle();
        }
      } catch {}
    };
    D.addEventListener('readystatechange', onReady);
    D.addEventListener('DOMContentLoaded', onReady);
  }
});
