(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.__agCsUiMain = factory;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (initialConfig) {
  const VERSION = '1.0.5';
  const LEGACY_API_VERSION = 3;
  const CODE_HASH = initialConfig?.codeHash || '';

  if (window.__agTokenHud) {
    try {
      window.__agTokenHud.destroy();
    } catch {}
    delete window.__agTokenHud;
  }

  const existingRuntime = window.__agPrism || window.__agClaudeStyle;
  if (
    existingRuntime &&
    existingRuntime.version === VERSION &&
    (!CODE_HASH || existingRuntime.codeHash === CODE_HASH)
  ) {
    existingRuntime.refreshConfig(initialConfig);
    return;
  }
  if (Array.isArray(globalThis.__agCsCleanups)) {
    while (globalThis.__agCsCleanups.length) {
      const fn = globalThis.__agCsCleanups.pop();
      try {
        if (typeof fn === 'function') fn();
      } catch {}
    }
  }
  if (window.__agPrism && typeof window.__agPrism.destroy === 'function') {
    try {
      window.__agPrism.destroy();
    } catch {}
  }
  if (window.__agClaudeStyle && window.__agClaudeStyle !== window.__agPrism && typeof window.__agClaudeStyle.destroy === 'function') {
    try {
      window.__agClaudeStyle.destroy();
    } catch {}
  }
  delete window.__agPrism;
  delete window.__agClaudeStyle;

  if (window.__agCsI18n && typeof window.__agCsI18n.destroy === 'function') {
    try {
      window.__agCsI18n.destroy();
    } catch {}
    delete window.__agCsI18n;
  }

  const usageCore = globalThis.__agCsUsageCore;
  const rippleCore = globalThis.__agCsRippleCore;
  const i18nCore = globalThis.__agCsI18nCore;
  const i18nLocales = globalThis.__agCsLocales;
  const dualMascotRig = globalThis.__agDualMascotRig;
  const crystalPrismCore = globalThis.__agCrystalPrismCore;
  const motionEngine = globalThis.__agMotionEngine;
  const animatedIcons = globalThis.__agAnimatedIcons;
  const pulseVialBridgeMod = globalThis.__agCsPulseVialBridge;
  const convAuraMod = globalThis.__agPrismConvAura;
  const smoothCaretMod = globalThis.__agPrismSmoothCaret;
  const settingsPanelMod = globalThis.__agPrismSettingsPanel;
  const homeStudioMod = globalThis.__agPrismHomeStudioPanel;
  const homeRippleMod = globalThis.__agPrismHomeRippleHost;
  const modelGlyphMod = globalThis.__agPrismModelGlyphCrystal;
  const streamChoreoMod = globalThis.__agPrismStreamChoreography;
  const prismRimMod = globalThis.__agPrismRimCanvas;
  const hostEnhancerMod = globalThis.__agPrismHostEnhancer;

  // 新品牌 Obsidian Prism 主存储键 + 旧版历史键平滑迁移兼容
  const STORAGE_PRISM_KEY = 'ag-prism:config';
  const STORAGE_LEGACY_COLON_KEY = 'ag-claude-style:config';
  const STORAGE_LEGACY_V3_KEY = 'agClaudeStyle.settings.v3';
  const STORAGE_FILE_CFG_KEY = 'ag-prism:lastFileConfig';
  const STORAGE_USAGE_CACHE_KEY = 'ag-prism:trajRollup.v1';
  const SETTINGS_SEC_ID = 'ag-cs-settings-sec';

  function isElementLike(n) {
    return Boolean(n && (n.nodeType === 1 || (n.nodeType === undefined && typeof n.tagName === 'string')));
  }

  function safeParseJsonObj(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  // 双向对齐新旧配置字段（兼容 homeLayout/homeMode、homeRipple/ripple、mascot dual/crab 等）
  function normalizeConfigShape(rawCfg) {
    const out = { ...(rawCfg || {}) };

    if (out.palette !== 'host' && out.palette !== 'obsidian' && out.palette !== 'warm' && out.palette !== 'claude') {
      out.palette = 'obsidian';
    }
    out.lightPreset = out.lightPreset === 'alabaster' ? 'alabaster' : 'crystal';
    if (out.motionLevel !== 'off' && out.motionLevel !== 'subtle' && out.motionLevel !== 'standard' && out.motionLevel !== 'ultra') {
      out.motionLevel = 'ultra';
    }
    if (out.targetFps !== '60' && out.targetFps !== '120' && out.targetFps !== '180' && out.targetFps !== 'native') {
      out.targetFps = '180';
    }
    out.telemetryModule = out.telemetryModule === 'on' || out.telemetryModule === 'off' ? out.telemetryModule : 'auto';
    out.effortSliderModule = out.effortSliderModule === 'on' || out.effortSliderModule === 'off' ? out.effortSliderModule : 'auto';
    out.thoughtTranslate =
      out.thoughtTranslate === 'machine' || out.thoughtTranslate === 'ai' ? out.thoughtTranslate : 'off';
    out.thoughtTrigger = out.thoughtTrigger === 'expand' ? 'expand' : 'preload';

    const rawHome = out.homeLayout ?? out.homeMode ?? 'studio';
    const normHome = rawHome === 'classic' ? 'classic' : rawHome === 'off' ? 'off' : 'studio';
    out.homeLayout = normHome;
    out.homeMode = normHome;

    const rippleOn =
      out.homeRipple !== undefined
        ? out.homeRipple !== false && out.homeRipple !== 'off'
        : out.ripple !== undefined
        ? out.ripple !== 'off' && out.ripple !== false
        : true;
    out.homeRipple = rippleOn;
    out.ripple = rippleOn ? 'on' : 'off';

    const compOn =
      out.composerRestyle !== undefined
        ? out.composerRestyle !== false && out.composerRestyle !== 'off'
        : out.composer !== undefined
        ? out.composer !== 'off' && out.composer !== false
        : true;
    out.composerRestyle = compOn;
    out.composer = compOn ? 'on' : 'off';

    const rawPh = out.placeholderStyle ?? out.promptStyle ?? 'studio';
    const normPh = rawPh === 'host' ? 'host' : 'studio';
    out.placeholderStyle = normPh;
    out.promptStyle = normPh;

    if (out.mascot === 'off' || out.mascot === false) {
      out.mascot = 'off';
    } else if (out.mascot === 'minis') {
      out.mascot = 'minis';
    } else if (out.mascot === 'dual') {
      out.mascot = 'dual';
    } else {
      out.mascot = 'crab';
    }

    const sbOn =
      out.sidebarRestyle !== undefined
        ? out.sidebarRestyle !== false && out.sidebarRestyle !== 'off'
        : out.sidebar !== undefined
        ? out.sidebar !== 'off' && out.sidebar !== false
        : true;
    out.sidebarRestyle = sbOn;
    out.sidebar = sbOn ? 'on' : 'off';

    out.sidebarCompact = out.sidebarCompact === true || out.sidebarCompact === 'on';
    out.smoothCaret = out.smoothCaret === undefined ? true : out.smoothCaret !== false && out.smoothCaret !== 'off';

    if (
      out.accentTone !== 'follow' &&
      out.accentTone !== 'cobalt' &&
      out.accentTone !== 'iris' &&
      out.accentTone !== 'amber' &&
      out.accentTone !== 'mono'
    ) {
      out.accentTone = 'follow';
    }
    if (out.cornerStyle !== 'sharp' && out.cornerStyle !== 'balanced' && out.cornerStyle !== 'soft') {
      out.cornerStyle = 'balanced';
    }
    if (
      out.codeFont !== 'default' &&
      out.codeFont !== 'jetbrains' &&
      out.codeFont !== 'cascadia' &&
      out.codeFont !== 'sfmono'
    ) {
      out.codeFont = 'default';
    }
    out.codeLigatures = out.codeLigatures === true || out.codeLigatures === 'on';
    const rawAmb = String(out.ambientIntensity ?? '100');
    out.ambientIntensity = rawAmb === '0' || rawAmb === '35' || rawAmb === '70' || rawAmb === '100' ? rawAmb : '100';
    out.thoughtView = out.thoughtView === 'bilingual' ? 'bilingual' : 'immersive';
    out.omniModule = out.omniModule === 'off' || out.omniModule === false ? 'off' : 'on';
    out.sidebarStudio = out.sidebarStudio === 'on' || out.sidebarStudio === true ? 'on' : 'off';
    out.linkTarget = out.linkTarget === 'external' ? 'external' : 'builtin';
    out.hostLocalization =
      out.hostLocalization === 'on' || out.hostLocalization === 'off' ? out.hostLocalization : 'auto';

    const rawLang =
      (out.language && out.language !== 'auto' ? out.language : '') ||
      (out.lang && out.lang !== 'auto' ? out.lang : '');
    if (rawLang) {
      out.language = rawLang;
      out.lang = rawLang;
    }

    return out;
  }

  function expandSettingAliases(rawPatch) {
    const patch = { ...(rawPatch || {}) };
    if ('language' in patch) patch.lang = patch.language;
    else if ('lang' in patch) patch.language = patch.lang;

    if ('homeLayout' in patch) patch.homeMode = patch.homeLayout;
    else if ('homeMode' in patch) patch.homeLayout = patch.homeMode;

    if ('homeRipple' in patch) {
      const on = patch.homeRipple !== false && patch.homeRipple !== 'off';
      patch.homeRipple = on;
      patch.ripple = on ? 'on' : 'off';
    } else if ('ripple' in patch) {
      const on = patch.ripple !== 'off' && patch.ripple !== false;
      patch.homeRipple = on;
      patch.ripple = on ? 'on' : 'off';
    }

    if ('composerRestyle' in patch) {
      const on = patch.composerRestyle !== false && patch.composerRestyle !== 'off';
      patch.composerRestyle = on;
      patch.composer = on ? 'on' : 'off';
    } else if ('composer' in patch) {
      const on = patch.composer !== 'off' && patch.composer !== false;
      patch.composerRestyle = on;
      patch.composer = on ? 'on' : 'off';
    }

    if ('placeholderStyle' in patch) patch.promptStyle = patch.placeholderStyle;
    else if ('promptStyle' in patch) patch.placeholderStyle = patch.promptStyle;

    if ('sidebarRestyle' in patch) {
      const on = patch.sidebarRestyle !== false && patch.sidebarRestyle !== 'off';
      patch.sidebarRestyle = on;
      patch.sidebar = on ? 'on' : 'off';
    } else if ('sidebar' in patch) {
      const on = patch.sidebar !== 'off' && patch.sidebar !== false;
      patch.sidebarRestyle = on;
      patch.sidebar = on ? 'on' : 'off';
    }
    if ('sidebarCompact' in patch && typeof patch.sidebarCompact === 'string') {
      patch.sidebarCompact = patch.sidebarCompact === 'on' || patch.sidebarCompact === 'true';
    }
    if ('smoothCaret' in patch && typeof patch.smoothCaret === 'string') {
      patch.smoothCaret = patch.smoothCaret !== 'off' && patch.smoothCaret !== 'false';
    }
    if ('codeLigatures' in patch && typeof patch.codeLigatures === 'string') {
      patch.codeLigatures = patch.codeLigatures === 'on' || patch.codeLigatures === 'true';
    }
    for (const k of ['telemetryModule', 'effortSliderModule', 'omniModule', 'sidebarStudio']) {
      if (k in patch && typeof patch[k] === 'boolean') patch[k] = patch[k] ? 'on' : 'off';
    }
    return patch;
  }

  function stripRuntimeMetaKeys(obj) {
    const clean = { ...(obj || {}) };
    delete clean.binding;
    delete clean.pollIntervalMs;
    delete clean.codeHash;
    delete clean.__fromFile;
    delete clean.__ackEpoch;
    return clean;
  }

  // 差量感知配置加载：当外部 config.json 或 refreshConfig 发生字段变更时，自动穿透更新 localStorage 消除跨端配置脑裂
  function loadSettings(base, explicitOverride = null) {
    try {
      const cleanBase = expandSettingAliases(stripRuntimeMetaKeys(base));
      const baseJson = JSON.stringify(cleanBase);
      const prevBaseRaw = localStorage.getItem(STORAGE_FILE_CFG_KEY);
      const prevBaseObj = safeParseJsonObj(prevBaseRaw);

      const savedV3 = safeParseJsonObj(localStorage.getItem(STORAGE_LEGACY_V3_KEY));
      const savedLegacyColon = safeParseJsonObj(localStorage.getItem(STORAGE_LEGACY_COLON_KEY));
      const savedPrism = safeParseJsonObj(localStorage.getItem(STORAGE_PRISM_KEY));
      const mergedSaved = { ...(savedV3 || {}), ...(savedLegacyColon || {}), ...(savedPrism || {}) };

      let savedMutated = false;
      if (prevBaseObj) {
        for (const [k, v] of Object.entries(cleanBase)) {
          if (JSON.stringify(prevBaseObj[k]) !== JSON.stringify(v)) {
            Object.assign(mergedSaved, expandSettingAliases({ [k]: v }));
            savedMutated = true;
          }
        }
      }
      if (explicitOverride && typeof explicitOverride === 'object') {
        const cleanOverride = stripRuntimeMetaKeys(explicitOverride);
        if (Object.keys(cleanOverride).length > 0) {
          Object.assign(mergedSaved, expandSettingAliases(cleanOverride));
          savedMutated = true;
        }
      }

      if (!prevBaseRaw || prevBaseRaw !== baseJson) {
        localStorage.setItem(STORAGE_FILE_CFG_KEY, baseJson);
      }
      if (savedMutated || (!savedPrism && (savedLegacyColon || savedV3))) {
        const serialized = JSON.stringify(mergedSaved);
        localStorage.setItem(STORAGE_PRISM_KEY, serialized);
        localStorage.setItem(STORAGE_LEGACY_V3_KEY, serialized);
      }
      if (savedLegacyColon && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(STORAGE_LEGACY_COLON_KEY);
      }

      return normalizeConfigShape({ ...cleanBase, ...mergedSaved });
    } catch {
      return normalizeConfigShape({ ...stripRuntimeMetaKeys(base), ...stripRuntimeMetaKeys(explicitOverride) });
    }
  }

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
    full: true,
    theme: false,
    route: false,
    sidebar: false,
    composer: false,
    buttons: false,
    overlays: false,
    collapsible: false,
    settings: false,
    bgCmd: false,
  };
  const perfStats = {
    lastSyncMs: 0,
    syncCount: 0,
    iconIncrementalRuns: 0,
    iconFullRuns: 0,
  };

  function markAllDirty() {
    dirtyFlags.full = true;
    dirtyFlags.theme = true;
    dirtyFlags.route = true;
    dirtyFlags.sidebar = true;
    dirtyFlags.composer = true;
    dirtyFlags.buttons = true;
    dirtyFlags.overlays = true;
    dirtyFlags.collapsible = true;
    dirtyFlags.settings = true;
    dirtyFlags.bgCmd = true;
  }

  function resolveWireSettingPair(key, value) {
    const base = currentBaseConfig || {};
    if (key === 'homeLayout' && 'homeMode' in base && !('homeLayout' in base)) {
      return ['homeMode', value];
    }
    if (key === 'homeRipple' && 'ripple' in base && !('homeRipple' in base)) {
      return ['ripple', value ? 'on' : 'off'];
    }
    if (key === 'composerRestyle' && 'composer' in base && !('composerRestyle' in base)) {
      return ['composer', value ? 'on' : 'off'];
    }
    if (key === 'placeholderStyle' && 'promptStyle' in base && !('placeholderStyle' in base)) {
      return ['promptStyle', value];
    }
    if (key === 'sidebarRestyle' && 'sidebar' in base && !('sidebarRestyle' in base)) {
      return ['sidebar', value ? 'on' : 'off'];
    }
    if (key === 'sidebarCompact' && typeof base.sidebarCompact === 'string') {
      return ['sidebarCompact', value ? 'on' : 'off'];
    }
    if (key === 'smoothCaret' && typeof base.smoothCaret === 'string') {
      return ['smoothCaret', value ? 'on' : 'off'];
    }
    if (key === 'language' && 'lang' in base && !('language' in base)) {
      return ['lang', value];
    }
    if ((key === 'telemetryModule' || key === 'effortSliderModule' || key === 'omniModule' || key === 'sidebarStudio') && typeof value === 'boolean') {
      return [key, value ? 'on' : 'off'];
    }
    if (key === 'mascot') {
      if (base.mascot === 'dual' && value === 'crab') {
        return ['mascot', 'dual'];
      }
      return ['mascot', value];
    }
    return [key, value];
  }

  function persistAndApplyConfigPatch(rawPatch, emitSingleKey = null) {
    const patch = expandSettingAliases(rawPatch);
    Object.assign(currentBaseConfig, stripRuntimeMetaKeys(patch));
    cfg = normalizeConfigShape({ ...cfg, ...patch });

    try {
      const saved = safeParseJsonObj(localStorage.getItem(STORAGE_PRISM_KEY)) || {};
      Object.assign(saved, patch);
      const serialized = JSON.stringify(saved);
      localStorage.setItem(STORAGE_PRISM_KEY, serialized);
      localStorage.setItem(STORAGE_LEGACY_V3_KEY, serialized);
      if (typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(STORAGE_LEGACY_COLON_KEY);
      }

      const lastFile = safeParseJsonObj(localStorage.getItem(STORAGE_FILE_CFG_KEY));
      if (lastFile) {
        Object.assign(lastFile, patch);
        localStorage.setItem(STORAGE_FILE_CFG_KEY, JSON.stringify(lastFile));
      }
    } catch {}

    const writeEp = ++localWriteEpoch;
    try {
      const send = window[cfg.binding] || window.__agPrismSetting || window.__agClaudeStyleSetting;
      if (typeof send === 'function') {
        if (emitSingleKey !== null) {
          const [wireKey, wireVal] = resolveWireSettingPair(emitSingleKey, rawPatch[emitSingleKey]);
          send(JSON.stringify({ key: wireKey, value: wireVal, clientEpoch: writeEp }));
        } else {
          const entries = {};
          for (const [k, v] of Object.entries(rawPatch || {})) {
            const [wk, wv] = resolveWireSettingPair(k, v);
            entries[wk] = wv;
          }
          if (Object.keys(entries).length > 0) {
            send(JSON.stringify({ action: 'patch-batch', entries, clientEpoch: writeEp }));
          }
        }
      }
    } catch {}

    markAllDirty();
    applyRootAttrs();
    scheduleSync();
  }

  function saveSetting(key, value) {
    persistAndApplyConfigPatch({ [key]: value }, key);
  }

  function saveSettingsBatch(patchObj) {
    if (!patchObj || typeof patchObj !== 'object') return;
    persistAndApplyConfigPatch(patchObj, null);
  }

  function getLang() {
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
  }

  function uiText(lang = getLang()) {
    if (i18nLocales && typeof i18nLocales.getUiStrings === 'function') {
      return i18nLocales.getUiStrings(lang);
    }
    return {};
  }

  function isZh() {
    const lang = getLang();
    return lang === 'zh-CN' || lang === 'zh-TW' || lang === 'yue';
  }

  function isDarkTheme() {
    const b = document.body?.classList;
    const h = document.documentElement?.classList;
    if (b?.contains('theme-light') || b?.contains('light-theme') || b?.contains('light')) return false;
    if (b?.contains('theme-dark') || b?.contains('dark') || b?.contains('dark-theme')) return true;
    if (h?.contains('theme-light') || h?.contains('light-theme') || h?.contains('light')) return false;
    if (h?.contains('theme-dark') || h?.contains('dark') || h?.contains('dark-theme')) return true;
    return true;
  }

  function getEffectivePalette() {
    const p = cfg.palette;
    return p === 'obsidian' || p === 'warm' || p === 'claude' || p === 'host' ? p : 'obsidian';
  }

  function getLightPreset() {
    return cfg.lightPreset === 'alabaster' ? 'alabaster' : 'crystal';
  }

  function getMotionLevel() {
    const v = cfg.motionLevel;
    return v === 'off' || v === 'subtle' || v === 'standard' || v === 'ultra' ? v : 'ultra';
  }

  function getTargetFps() {
    const v = String(cfg.targetFps || '');
    return v === '60' || v === '120' || v === '180' || v === 'native' ? v : '180';
  }

  function getMinFrameGapMs() {
    const fps = getTargetFps();
    if (fps === 'native') return 0;
    if (fps === '60') return 15.2;
    if (fps === '120') return 7.5;
    return 4.8;
  }

  function getTelemetryMode() {
    return cfg.telemetryModule === 'on' || cfg.telemetryModule === 'off' ? cfg.telemetryModule : 'auto';
  }

  function getEffortSliderMode() {
    return cfg.effortSliderModule === 'on' || cfg.effortSliderModule === 'off' ? cfg.effortSliderModule : 'auto';
  }

  function getThoughtTranslateMode() {
    return cfg.thoughtTranslate === 'machine' || cfg.thoughtTranslate === 'ai' ? cfg.thoughtTranslate : 'off';
  }

  function getThoughtTriggerTiming() {
    return cfg.thoughtTrigger === 'expand' ? 'expand' : 'preload';
  }

  function getAccentTone() {
    const v = cfg.accentTone;
    return v === 'cobalt' || v === 'iris' || v === 'amber' || v === 'mono' ? v : 'follow';
  }

  function getCornerStyle() {
    const v = cfg.cornerStyle;
    return v === 'sharp' || v === 'soft' ? v : 'balanced';
  }

  function getCodeFont() {
    const v = cfg.codeFont;
    return v === 'jetbrains' || v === 'cascadia' || v === 'sfmono' ? v : 'default';
  }

  function isCodeLigaturesEnabled() {
    return cfg.codeLigatures === true || cfg.codeLigatures === 'on';
  }

  function getAmbientIntensitySetting() {
    const v = String(cfg.ambientIntensity ?? '100');
    return v === '0' || v === '35' || v === '70' || v === '100' ? v : '100';
  }

  function getAmbientCssValue() {
    const v = getAmbientIntensitySetting();
    if (v === '0') return '0';
    if (v === '35') return '0.35';
    if (v === '70') return '0.7';
    return '1';
  }

  function getAmbientFloat() {
    const v = getAmbientIntensitySetting();
    if (v === '0') return 0;
    if (v === '35') return 0.35;
    if (v === '70') return 0.7;
    return 1;
  }

  function getThoughtView() {
    return cfg.thoughtView === 'bilingual' ? 'bilingual' : 'immersive';
  }

  function getOmniMode() {
    return cfg.omniModule === 'off' || cfg.omniModule === false ? 'off' : 'on';
  }

  function getLinkTarget() {
    return cfg.linkTarget === 'external' ? 'external' : 'builtin';
  }

  function resolveAuraSpectrumMode() {
    const acc = getAccentTone();
    if (acc !== 'follow') return acc;
    const pal = getEffectivePalette();
    if (pal === 'warm' || pal === 'claude') return 'warm';
    if (!isDarkTheme() && getLightPreset() === 'alabaster') return 'warm';
    return 'default';
  }

  function isMascotEnabled() {
    return cfg.mascot === 'crab' || cfg.mascot === 'dual' || cfg.mascot === 'minis';
  }

  function motionReduced() {
    if (cfg.motionLevel === 'off') return true;
    return typeof matchMedia === 'function' && Boolean(matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  }

  function isMotionStandardOrUltra() {
    if (motionReduced()) return false;
    const lv = getMotionLevel();
    return lv === 'standard' || lv === 'ultra';
  }

  function isMotionUltra() {
    return !motionReduced() && getMotionLevel() === 'ultra';
  }

  function canMountRealCanvas(node) {
    try {
      const doc = node?.ownerDocument;
      if (!doc || typeof doc.createElement !== 'function') return false;
      const cv = doc.createElement('canvas');
      return Boolean(cv && cv.dataset && typeof cv.getContext === 'function' && cv.getContext('2d'));
    } catch {
      return false;
    }
  }

  // ── Built-in Thought Translator Overlay Isolation Helpers (Zero-Flicker Guard) ──
  const THOUGHT_ISOLATED_SELECTOR = '.ag-prism-thought-overlay, .ag-prism-thought-raw-toggle, [data-prism-ignore]';

  function isThoughtIsolatedNode(node) {
    if (!node) return false;
    const el = isElementLike(node) ? node : node.parentElement;
    if (!el) return false;
    if (
      el.classList?.contains?.('ag-prism-thought-overlay') ||
      el.classList?.contains?.('ag-prism-thought-raw-toggle') ||
      el.classList?.contains?.('ag-prism-thought-body') ||
      el.hasAttribute?.('data-prism-ignore')
    ) {
      return true;
    }
    return Boolean(el.closest?.(THOUGHT_ISOLATED_SELECTOR));
  }

  function isThoughtMutationRecord(m) {
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
  }

  function isManagedThoughtPanel(panel) {
    if (!panel || !isElementLike(panel)) return false;
    if (panel.hasAttribute?.('data-op-zh-ready') || panel.hasAttribute?.('data-op-zh-pending')) return true;
    if (panel.querySelector?.('.ag-prism-thought-overlay') !== null && panel.querySelector?.('.ag-prism-thought-overlay') !== undefined) {
      return true;
    }
    return false;
  }

  function runGuardedMut(fn) {
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
  }

  function setAttrIfChanged(el, name, val) {
    if (!el) return;
    if (el.getAttribute(name) !== val) el.setAttribute(name, val);
  }

  // ── Antigravity React Fiber & Store Bridge ─────────────────────────────
  let cachedSvc = null;
  let cachedStore = null;
  let storeUnsub = null;
  let storeDebounce = null;

  function ensureHooks(allowPartial = false) {
    if (cachedSvc && cachedStore) return { svc: cachedSvc, store: cachedStore };
    const anchors = document.querySelectorAll(
      '[data-testid="conversation-view"], [data-testid="agent-input-box"], [data-testid="conversation-row-sidebar"], [data-testid="new-conversation-button"], [data-testid="home-greeting"]'
    );
    for (const el of anchors) {
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
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
        storeDebounce = setTimeout(() => {
          storeDebounce = null;
          if (!destroyed) onStoreChanged();
        }, 400);
      });
    }
    if (cachedSvc && cachedStore) return { svc: cachedSvc, store: cachedStore };
    if (allowPartial && (cachedSvc || cachedStore)) return { svc: cachedSvc, store: cachedStore };
    return null;
  }

  function getDisplayName() {
    const h = ensureHooks(true);
    const raw = String(h?.store?.getState()?.userStatus?.name || '').trim();
    if (!raw) return '';
    return raw.split(/\s+/)[0] || raw;
  }

  function resolveCascadeId(inputBox) {
    const cv = inputBox ? inputBox.closest('[data-testid="conversation-view"]') : document.querySelector('[data-testid="conversation-view"]');
    if (inputBox && !cv && inputBox.closest('.agy-home')) return '';
    if (cv) {
      const attrId = cv.getAttribute('data-cascade-id');
      if (attrId && attrId !== 'conversation') return attrId;
    }
    const m = location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    const readCascadeFromFiber = (el, maxDepth) => {
      if (!el) return '';
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
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
    if (cv && !inputBox?.closest?.('[data-testid="subagent-tab-conversation"]')) {
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
  }

  // ── Official Dual Mascot Stage ─────────────────────────────────────────
  const mascotState = {
    root: null,
    rig: null,
    anchor: null,
    lastOrch: null,
    lastActivityAt: 0,
  };

  function notifyMascot(eventName, payload) {
    if (mascotState.rig && typeof mascotState.rig.notify === 'function') {
      try {
        mascotState.rig.notify(eventName, payload || {});
      } catch {}
    }
  }

  function getLightweightActiveInfo(card) {
    if (!card) return null;
    const inputBox = card.closest?.('[data-testid="agent-input-box"]');
    const inConvo = Boolean(card.closest?.('[data-testid="conversation-view"]'));
    const cascadeId = inConvo ? resolveCascadeId(inputBox) : '';
    const cancelBtn = Boolean(card.querySelector?.('[data-testid="input-cancel-button"]'));
    let isRunning = cancelBtn;
    let isThinking = false;
    let hasError = false;
    if (cascadeId) {
      const h = ensureHooks(true);
      const st = h?.store?.getState?.();
      const sums = st?.trajectorySummaries?.summaries || st?.cascadeTrajectorySummaries || {};
      const entry = sums[cascadeId];
      const sum = entry?.summary || entry || {};
      if (sum.notFullyIdle || sum.hasActivity || sum.status === 2 || sum.hasRunningSubagents) isRunning = true;
      if (sum.status === 3 || sum.hasError) hasError = true;
    }
    const cv = card.closest?.('[data-testid="conversation-view"]');
    if (cv && isRunning) {
      const thinkingEl = cv.querySelector?.('[data-testid="thinking-collapsible-trigger"], [data-testid="worked-for-collapsible"]');
      if (thinkingEl && String(thinkingEl.textContent || '').includes('...')) isThinking = true;
    }
    return { cascadeId, isRunning, isThinking, hasError };
  }

  let crabRemoveAttrTimer = 0;

  function unmountCrab() {
    if (crabRemoveAttrTimer) {
      clearTimeout(crabRemoveAttrTimer);
      crabRemoveAttrTimer = 0;
    }
    if (mascotState.rig && typeof mascotState.rig.dispose === 'function') {
      try {
        mascotState.rig.dispose();
      } catch {}
    }
    if (mascotState.root && mascotState.root.parentElement) {
      mascotState.root.parentElement.removeChild(mascotState.root);
    }
    if (mascotState.anchor) mascotState.anchor.removeAttribute('data-ag-cs-crab-anchor');
    if (document.documentElement?.hasAttribute('data-ag-cs-has-crab')) {
      document.documentElement.removeAttribute('data-ag-cs-has-crab');
    }
    mascotState.root = null;
    mascotState.rig = null;
    mascotState.anchor = null;
    mascotState.lastOrch = null;
  }

  function syncCrab(activeCard, activeInfo, modelInfo) {
    if (!isMascotEnabled()) {
      unmountCrab();
      return;
    }
    if (!activeCard) {
      if (mascotState.root && mascotState.root.parentElement) {
        mascotState.root.parentElement.removeChild(mascotState.root);
      }
      if (mascotState.anchor) {
        mascotState.anchor.removeAttribute('data-ag-cs-crab-anchor');
        mascotState.anchor = null;
      }
      if (document.documentElement?.hasAttribute('data-ag-cs-has-crab')) {
        if (typeof setTimeout === 'function' && !destroyed) {
          if (!crabRemoveAttrTimer) {
            crabRemoveAttrTimer = setTimeout(() => {
              crabRemoveAttrTimer = 0;
              if (!destroyed && !mascotState.anchor) runGuardedMut(() => document.documentElement?.removeAttribute('data-ag-cs-has-crab'));
            }, 220);
          }
        } else document.documentElement.removeAttribute('data-ag-cs-has-crab');
      }
      return;
    }
    if (crabRemoveAttrTimer) {
      clearTimeout(crabRemoveAttrTimer);
      crabRemoveAttrTimer = 0;
    }
    if (!mascotState.root) {
      const stage = document.createElement('div');
      stage.className = 'ag-cs-crab ag-cs-dual-stage';
      stage.setAttribute('data-mascot-stage', 'true');
      stage.setAttribute('aria-hidden', 'true');
      stage.setAttribute('data-ag-no-i18n', '');
      mascotState.root = stage;
    }
    if (mascotState.root.parentElement !== activeCard) {
      if (mascotState.anchor) mascotState.anchor.removeAttribute('data-ag-cs-crab-anchor');
      activeCard.setAttribute('data-ag-cs-crab-anchor', 'composer');
      activeCard.appendChild(mascotState.root);
      mascotState.anchor = activeCard;
    }
    if (document.documentElement) {
      setAttrIfChanged(document.documentElement, 'data-ag-cs-has-crab', '1');
    }

    const camp = modelInfo?.camp || 'gemini';
    const isOrch = Boolean(modelInfo?.isOrchestrator);
    const streamTier = modelInfo?.tier === 'xhigh' || isOrch ? 3 : 2;
    const nextState = {
      camp,
      streaming: Boolean(activeInfo?.isRunning),
      streamTier,
      hasError: Boolean(activeInfo?.hasError),
      yieldMode: 'none',
      leapOffsetY: 0,
      popoverRightWidth: 0,
      miniPileEnabled: cfg.mascot === 'minis',
      orchestrator: isOrch,
      reducedMotion: motionReduced(),
    };

    const mountFn = dualMascotRig && (dualMascotRig.mountDualMascotStage || dualMascotRig.createDualMascotRig);
    if (!mascotState.rig && mountFn && canMountRealCanvas(mascotState.root)) {
      try {
        mascotState.rig = mountFn(mascotState.root, nextState);
      } catch {
        mascotState.rig = null;
      }
    } else if (mascotState.rig && typeof mascotState.rig.setState === 'function') {
      try {
        mascotState.rig.setState(nextState);
      } catch {}
    }

    if (mascotState.lastOrch !== null && mascotState.lastOrch !== isOrch) {
      notifyMascot('orchestrator', { on: isOrch });
    }
    mascotState.lastOrch = isOrch;
  }

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
          if (mascotState.rig && mascotState.root) {
            try {
              const mr = mascotState.root.getBoundingClientRect();
              notifyMascot('ripple', { x: clientX - mr.left });
            } catch {}
          }
        },
      })
    : noopStub();

  const convAuraCtl = convAuraMod?.createConvAuraController
    ? convAuraMod.createConvAuraController({
        isDestroyed: () => destroyed,
        isHomeRippleEnabled: () => cfg.homeRipple !== false && getAmbientFloat() > 0,
        isMotionStandardOrUltra,
        isDarkTheme,
        getMinFrameGapMs,
        getAmbientIntensity: getAmbientFloat,
        getSpectrumMode: resolveAuraSpectrumMode,
        isWindowFocused: () => (typeof document.hasFocus === 'function' ? document.hasFocus() : !document.hidden),
        rippleCore,
        setAttrIfChanged,
        runGuardedMut,
      })
    : noopStub({ advancePhase: () => 'off' });

  const hostEnhancerCtl = hostEnhancerMod?.createHostEnhancerController
    ? hostEnhancerMod.createHostEnhancerController({
        doc: document,
        win: window,
        getLang,
        t: uiText,
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
          codeFont: getCodeFont(),
          codeLigatures: isCodeLigaturesEnabled(),
          ambientIntensity: getAmbientIntensitySetting(),
          thoughtView: getThoughtView(),
        }),
      })
    : noopStub();

  function isConvRunning() {
    return Boolean(convAuraMod && typeof convAuraMod.isConvRunning === 'function' && convAuraMod.isConvRunning());
  }

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
          if (now - mascotState.lastActivityAt >= 2500) {
            mascotState.lastActivityAt = now;
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

  function applySingleHostIcon(btn, iconName, origSvg, size) {
    if (!btn || btn.isConnected === false || !origSvg || !origSvg.parentNode || !animatedIcons) return;
    const htmlStr = animatedIcons.renderIcon(iconName, { size });
    if (!htmlStr) return;

    const prevDisp = origSvg.style?.getPropertyValue?.('display') || '';
    if (prevDisp) origSvg.setAttribute('data-ag-cs-orig-disp', prevDisp);
    origSvg.setAttribute('hidden', '');
    origSvg.setAttribute('data-ag-cs-orig-svg', '1');
    origSvg.hidden = true;
    origSvg.style?.setProperty?.('display', 'none', 'important');

    let animSvg = modelGlyphCtl.cloneCachedSvgElement(`icon:${iconName}:${size}`, htmlStr);
    if (!animSvg) {
      animSvg = document.createElement('svg');
      animSvg.className = `ag-anim-icon ag-icon-${iconName}`;
      animSvg.setAttribute('data-anim-icon', iconName);
      animSvg.setAttribute('width', String(size));
      animSvg.setAttribute('height', String(size));
      animSvg.setAttribute('viewBox', '0 0 24 24');
      animSvg.setAttribute('aria-hidden', 'true');
      if (iconName === 'copy-check') animSvg.setAttribute('data-icon-state', 'copy');
      animSvg.innerHTML = htmlStr;
    }
    origSvg.parentNode.insertBefore(animSvg, origSvg);
    btn.setAttribute('data-ag-cs-icon-injected', iconName);
  }

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
        scheduleTransient: (fn, ms) => setTimeout(fn, ms),
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

  function syncMotionOffStyle(isOff) {
    const el = document.getElementById?.(MOTION_OFF_STYLE_ID);
    if (!isOff) return el?.remove?.();
    if (!el && typeof document.createElement === 'function') {
      const s = document.createElement('style');
      s.id = MOTION_OFF_STYLE_ID;
      s.textContent = 'html[data-ag-cs-style][data-ag-cs-motion="off"]{&,& *,& *::before,& *::after{animation:none!important;transition:none!important}}';
      (document.head || document.documentElement)?.appendChild?.(s);
    }
  }

  function refreshOpenUiForLanguage() {
    const inHero = Boolean(document.querySelector('.agy-home [data-testid="home-greeting"]'));
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
  }

  function syncMotionSpringTokens() {
    const html = document.documentElement;
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
  }

  function syncAbsorbedModules(force = false) {
    const tel = window.__agPrismTelemetry;
    const eff = window.__agPrismEffortSlider;
    const th = window.__agPrismThought;
    const omni = window.__agPrismOmni;
    const meta = window.__agPrismOmniServerMeta || null;
    const sb = window.__agPrismSidebar;
    const sbMeta = window.__agPrismSidebarMeta || null;
    const key = [
      VERSION,
      getLang(),
      getTelemetryMode(),
      getEffortSliderMode(),
      getThoughtTranslateMode(),
      getThoughtTriggerTiming(),
      getThoughtView(),
      getOmniMode(),
      getLinkTarget(),
      cfg.sidebarStudio === 'on' ? 1 : 0,
      meta?.baseUrl || '',
      sbMeta?.version || '',
      sbMeta?.serviceReady ? 1 : 0,
      tel ? 1 : 0,
      eff ? 1 : 0,
      th ? 1 : 0,
      omni ? 1 : 0,
      sb ? 1 : 0,
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
  }

  function applyRootAttrs(forceAbsorbed = false) {
    const html = document.documentElement;
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
      setAttrIfChanged(html, 'data-ag-prism', VERSION);
      setAttrIfChanged(html, 'data-ag-cs-style', '1');
      setAttrIfChanged(html, 'data-ag-cs-theme', dark ? 'dark' : 'light');
      setAttrIfChanged(html, 'data-ag-cs-palette', palette);
      setAttrIfChanged(html, 'data-ag-cs-light-preset', lightPreset);
      setAttrIfChanged(html, 'data-ag-cs-motion', motionLv);
      setAttrIfChanged(html, 'data-ag-cs-target-fps', targetFps);
      setAttrIfChanged(html, 'data-ag-cs-telemetry', telemetryMod);
      setAttrIfChanged(html, 'data-ag-cs-effort-slider', effortSliderMod);
      setAttrIfChanged(html, 'data-ag-cs-thought-translate', getThoughtTranslateMode());
      setAttrIfChanged(html, 'data-ag-prism-omni', getOmniMode());
      setAttrIfChanged(html, 'data-ag-prism-link-target', getLinkTarget());
      setAttrIfChanged(html, 'data-ag-prism-sidebar-studio', cfg.sidebarStudio === 'on' ? 'on' : 'off');
      setAttrIfChanged(html, 'data-ag-cs-accent', getAccentTone());
      setAttrIfChanged(html, 'data-ag-cs-corners', getCornerStyle());
      setAttrIfChanged(html, 'data-ag-cs-code-font', getCodeFont());
      setAttrIfChanged(html, 'data-ag-cs-ligatures', isCodeLigaturesEnabled() ? '1' : '0');
      setAttrIfChanged(html, 'data-ag-cs-ambient', getAmbientCssValue());
      setAttrIfChanged(
        html,
        'data-ag-cs-home',
        cfg.homeLayout === 'classic' ? 'classic' : cfg.homeLayout === 'off' ? 'off' : 'studio'
      );
      setAttrIfChanged(html, 'data-ag-cs-composer', cfg.composerRestyle === false ? 'off' : 'on');
      setAttrIfChanged(html, 'data-ag-cs-logo-ink', cfg.logoInk === 'foreground' ? 'foreground' : 'accent');
      setAttrIfChanged(html, 'data-ag-cs-sidebar', cfg.sidebarRestyle === false ? 'off' : 'on');
      if (cfg.sidebarRestyle === false) {
        if (html.hasAttribute('data-ag-cs-sidebar-collapsed')) {
          html.removeAttribute('data-ag-cs-sidebar-collapsed');
        }
        document.querySelectorAll('.ag-cs-sidebar-glide-pill').forEach((n) => n.remove());
      }
      setAttrIfChanged(html, 'data-ag-cs-sidebar-compact', cfg.sidebarCompact === true ? 'on' : 'off');
      setAttrIfChanged(html, 'data-ag-cs-lang', lang);
      const isCjk = i18nCore && typeof i18nCore.isCjkLanguage === 'function' ? i18nCore.isCjkLanguage(lang) : isZh();
      if (isCjk) setAttrIfChanged(html, 'data-ag-cs-cjk', '1');
      else if (html.hasAttribute('data-ag-cs-cjk')) html.removeAttribute('data-ag-cs-cjk');

      syncMotionOffStyle(motionLv === 'off');
      syncAbsorbedModules(forceAbsorbed);
      setAttrIfChanged(html, 'data-ag-prism-thought-view', getThoughtView());

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
          dirtyFlags.composer = true;
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
  function setCrabClearanceAttr(el, attrName, active) {
    if (!el) return;
    if (active) {
      if (el.getAttribute(attrName) !== '1') el.setAttribute(attrName, '1');
      if (el.style.getPropertyValue('margin-bottom') !== '46px') {
        el.style.setProperty('margin-bottom', '46px', 'important');
      }
    } else if (el.hasAttribute(attrName)) {
      el.removeAttribute(attrName);
      el.style.removeProperty('margin-bottom');
    }
  }

  function syncCrabClearance(card, inputBox, active) {
    if (!inputBox) return;
    if (document.documentElement?.getAttribute('data-ag-prism-mode') === 'chat') active = false;
    const hasMenuPopup = Boolean(
      active &&
        inputBox.querySelector?.('[role="listbox"], [role="option"], [data-testid="slash-command-menu"]')
    );
    if (hasMenuPopup) setAttrIfChanged(inputBox, 'data-ag-cs-menu-open', '1');
    else if (inputBox.hasAttribute?.('data-ag-cs-menu-open')) inputBox.removeAttribute('data-ag-cs-menu-open');
    const composerShell = card.closest('#antigravity\\.agentSidePanelInputBox') || card.parentElement;
    let hasLowerClearance = false;

    if (composerShell) {
      for (const ch of Array.from(composerShell.children)) {
        if (ch === card) break;
        const panel =
          ch.getAttribute?.('data-testid') === 'running-items-panel'
            ? ch
            : ch.querySelector?.('[data-testid="running-items-panel"]');
        const isActivePanel = Boolean(panel && String(panel.className || '').includes('grid-rows-[1fr]'));
        const shouldClear = active && isActivePanel && !hasLowerClearance;
        setCrabClearanceAttr(ch, 'data-ag-cs-queued', shouldClear);
        if (shouldClear) hasLowerClearance = true;
      }
    }

    const ibChildren = Array.from(inputBox.children);
    const shellIdx = ibChildren.indexOf(composerShell);
    const beforeShell = shellIdx >= 0 ? ibChildren.slice(0, shellIdx) : ibChildren;
    for (let i = beforeShell.length - 1; i >= 0; i--) {
      const ch = beforeShell[i];
      if (ch.classList && (ch.classList.contains('ag-cs-hud-top-bar') || ch.classList.contains('ag-cs-hud-bottom-bar'))) {
        continue;
      }
      const hasQueued = ch.childElementCount > 0 || (ch.textContent || '').trim().length > 0;
      const shouldClear = active && hasQueued && !hasLowerClearance;
      setCrabClearanceAttr(ch, 'data-ag-cs-queued', shouldClear);
      if (shouldClear) hasLowerClearance = true;
    }

    const inputSlot =
      inputBox.parentElement &&
      inputBox.parentElement.classList &&
      inputBox.parentElement.classList.contains('contents')
        ? inputBox.parentElement
        : inputBox;
    const hostWrap = inputSlot.parentElement;
    if (hostWrap) {
      const siblings = Array.from(hostWrap.children);
      const slotIdx = siblings.indexOf(inputSlot);
      for (let i = slotIdx - 1; i >= 0; i--) {
        const sib = siblings[i];
        const isTakeoverOrSideQ =
          sib.getAttribute?.('data-testid') === 'interaction-takeover-card' ||
          sib.getAttribute?.('data-testid') === 'side-question-panel' ||
          Boolean(sib.querySelector?.('[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"]'));
        if (!isTakeoverOrSideQ) {
          if (sib.hasAttribute?.('data-ag-cs-takeover')) {
            setCrabClearanceAttr(sib, 'data-ag-cs-takeover', false);
          }
          continue;
        }
        const shouldClear = active && !hasLowerClearance;
        setCrabClearanceAttr(sib, 'data-ag-cs-takeover', shouldClear);
        if (shouldClear) hasLowerClearance = true;
      }
    }
  }

  let latestPrimaryModelInfo = null;
  let lastSyncedAwaitingDecision = null;
  let lastSyncedHasError = false;

  function detectVisibleDecisionTakeover() {
    const cards = document.querySelectorAll('[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"]');
    for (const el of cards) {
      if (el.closest?.('[data-testid="subagent-tab-conversation"]')) continue;
      if (el.hidden || el.getAttribute?.('aria-hidden') === 'true') continue;
      const disp = el.style?.getPropertyValue?.('display') || el.style?.display || '';
      if (disp === 'none') continue;
      return true;
    }
    return false;
  }

  function syncConvAuraSemantics(activeInfo) {
    if (typeof convAuraCtl.setSemanticState !== 'function') return;
    const awaitingNow = detectVisibleDecisionTakeover();
    const errNow = Boolean(activeInfo?.hasError);
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
  }

  function syncComposers(measured, skipSparks = false) {
    const cards = Array.from(document.querySelectorAll('[data-testid="agent-input-box"] .surface-composer-card'));
    const lang = getLang();
    const ui = uiText(lang);

    let primaryCard = null;
    for (const c of cards) {
      if (!c.closest('[data-testid="subagent-tab-conversation"]')) {
        primaryCard = c;
        break;
      }
    }
    if (!primaryCard && cards.length > 0) primaryCard = cards[0];

    const mascotOn = isMascotEnabled();
    let primaryModelInfo = null;
    const hs = streamChoreoCtl.heroState;

    for (const card of cards) {
      const inputBox = card.closest('[data-testid="agent-input-box"]');
      const zLayer = inputBox?.closest?.('.z-10');
      if (zLayer) setAttrIfChanged(zLayer, 'data-ag-cs-input-layer', '1');
      const isPrimary = card === primaryCard;

      if (isPrimary && cfg.composerRestyle !== false) {
        if (card.getAttribute('data-ag-cs-prism-box') !== '1') prismRimCtl.markDirty();
        setAttrIfChanged(card, 'data-ag-cs-prism-box', '1');
      } else if (card.hasAttribute('data-ag-cs-prism-box')) {
        card.removeAttribute('data-ag-cs-prism-box');
        card.style.removeProperty('--ag-px');
        card.style.removeProperty('--ag-py');
        prismRimCtl.invalidateMetrics?.();
        prismRimCtl.markDirty();
      }

      syncCrabClearance(card, inputBox, mascotOn && isPrimary);

      const p = card.querySelector('div.relative.w-full p.pointer-events-none');
      if (p) {
        if (cfg.composerRestyle !== false && cfg.placeholderStyle === 'studio') {
          const text = ui.studioPlaceholder || 'How can I help you today?';
          setAttrIfChanged(p, 'data-ag-cs-placeholder', text);
        } else if (p.hasAttribute('data-ag-cs-placeholder')) {
          p.removeAttribute('data-ag-cs-placeholder');
        }
      }

      let didModelShift = false;
      const modelBtn = card.querySelector('[data-testid="model-selector-trigger"]');
      const mInfo = modelGlyphCtl.syncModelGlyphOnButton(modelBtn);
      if (isPrimary && mInfo) {
        primaryModelInfo = mInfo;
        const cleanModelLabel = modelGlyphCtl.readButtonLabelWithoutGlyph(modelBtn);
        if (cleanModelLabel) {
          const modelSig = `${mInfo.brand}:${cleanModelLabel}`;
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
      if (didModelShift && isPrimary) {
        hs.pendingModelShiftNotify = true;
      }
    }

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
  function findOriginalHostSvg(btn) {
    if (!btn || !btn.querySelectorAll) return null;
    const svgs = btn.querySelectorAll('svg');
    for (const svg of svgs) {
      if (svg.classList?.contains?.('ag-anim-icon')) continue;
      return svg;
    }
    return null;
  }

  function detectHostIconTarget(btn) {
    // 第三重隔离：第一行显式排除中文思考转译「原文」按钮与浮层！
    if (btn?.classList?.contains?.('ag-prism-thought-raw-toggle') || btn?.closest?.('.ag-prism-thought-overlay')) return '';
    if (!btn) return '';

    const tid = String(btn.getAttribute?.('data-testid') || '').toLowerCase();
    if (
      tid === 'model-selector-trigger' ||
      tid === 'app-icon-new-conversation-button' ||
      tid === 'input-cancel-button' ||
      tid === 'stop-button'
    ) {
      return '';
    }
    if (
      btn.closest?.(
        '#' +
          SETTINGS_SEC_ID +
          ', .ag-cs-home-panel, [data-testid="orchestrator-effort-bar"], .ag-cs-crab'
      )
    ) {
      return '';
    }
    if (btn.querySelector?.('.ag-cs-model-glyph, .ag-spark-orbit-svg, .ag-cs-thinking-spark')) return '';

    if (btn.hasAttribute?.('data-ag-cs-filter-btn') || tid === 'sidebar-search-button' || tid === 'conversation-filter-button') {
      return 'search';
    }
    if (tid === 'new-conversation-button') return 'sparkles-pen';
    if (
      tid === 'sidebar-toggle' ||
      tid === 'sidebar-toggle-button' ||
      tid === 'toggle-sidebar-button' ||
      tid === 'toggle-aux-sidebar'
    ) {
      return 'panel-left';
    }
    if (tid === 'automations-button') return 'zap-bolt';
    if (tid === 'input-send-button') return 'arrow-up-launch';
    if (tid === 'sidebar-add-project-button' || tid === 'toggle-overview-panel') return '';

    const aria = String(btn.getAttribute?.('aria-label') || '').toLowerCase();
    const title = String(btn.getAttribute?.('title') || '').toLowerCase();
    const tip = String(btn.getAttribute?.('data-tooltip-id') || '').toLowerCase();
    const meta = `${tid} ${aria} ${title} ${tip}`;
    const labelMeta = `${aria} ${title} ${tip}`;
    const origSvg = findOriginalHostSvg(btn);
    const svgCls = String(origSvg?.getAttribute?.('class') || origSvg?.className || '').toLowerCase();

    if (/\bcopy\b|复制|複製|コピー/.test(meta) || /\blucide-copy\b/.test(svgCls)) return 'copy-check';
    if (
      /(?:toggle|open|close|show|hide)\s+(?:the\s+)?(?:side\s*panel|sidebar)|切换侧边栏|切換側邊欄|折叠侧边栏|展开侧边栏|サイドバー/.test(
        labelMeta
      ) ||
      /\blucide-panel-left\b/.test(svgCls)
    ) {
      return 'panel-left';
    }
    if (
      tid === 'settings-button' ||
      tid === 'open-settings-button' ||
      /\blucide-settings\b/.test(svgCls) ||
      (/(?:\bsettings\b|设置|設定)/.test(meta) && btn.getAttribute?.('role') !== 'menuitem' && btn.getAttribute?.('role') !== 'tab')
    ) {
      return 'settings-gear';
    }
    if (
      !btn.closest?.('.agy-composer-footer') &&
      btn.closest?.('[data-testid="agent-input-box"], .surface-composer-card') &&
      (tid === 'attachment-button' ||
        tid === 'add-context-button' ||
        tid === 'composer-plus-button' ||
        tid === 'input-add-button' ||
        /\blucide-plus\b/.test(svgCls) ||
        /\battach|\badd\b|upload|context|附件|添加/.test(meta))
    ) {
      return 'plus-spin';
    }
    return '';
  }

  function restoreHostButtonIcon(btn) {
    if (!btn) return;
    btn.querySelectorAll?.('.ag-anim-icon').forEach((n) => n.remove());
    btn.querySelectorAll?.('[data-ag-cs-orig-svg]').forEach((orig) => {
      orig.removeAttribute('hidden');
      orig.hidden = false;
      const prevDisp = orig.getAttribute('data-ag-cs-orig-disp');
      if (prevDisp) {
        orig.style?.setProperty?.('display', prevDisp);
        orig.removeAttribute('data-ag-cs-orig-disp');
      } else {
        orig.style?.removeProperty?.('display');
      }
      orig.removeAttribute('data-ag-cs-orig-svg');
    });
    btn.removeAttribute('data-ag-cs-icon-injected');
  }

  function restoreAllHostAnimatedIcons() {
    document.querySelectorAll('[data-ag-cs-icon-injected]').forEach((btn) => restoreHostButtonIcon(btn));
  }

  function isHostButtonCandidate(el) {
    if (!isElementLike(el)) return false;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'BUTTON') return true;
    if (el.getAttribute?.('role') === 'button') return true;
    if (tag === 'A' && el.getAttribute?.('data-testid') === 'new-conversation-button') return true;
    return false;
  }

  const HOST_BTN_QUERY = 'button, [role="button"], a[data-testid="new-conversation-button"]';

  function hasAncestorInSet(el, rootSet) {
    let cur = el?.parentElement;
    while (cur) {
      if (rootSet.has(cur)) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function syncHostAnimatedIcons(roots = null) {
    if (!animatedIcons || typeof animatedIcons.renderIcon !== 'function' || !isMotionStandardOrUltra()) {
      if (motionReduced()) restoreAllHostAnimatedIcons();
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
        if (typeof r.querySelectorAll === 'function') {
          const inner = r.querySelectorAll(HOST_BTN_QUERY);
          for (let i = 0; i < inner.length; i++) {
            if (!isThoughtIsolatedNode(inner[i])) set.add(inner[i]);
          }
        }
      }
      if (set.size === 0) return;
      buttons = set;
    } else {
      perfStats.iconFullRuns += 1;
      buttons = document.querySelectorAll(HOST_BTN_QUERY);
    }

    const pendingIcons = [];
    for (const btn of buttons) {
      if (isThoughtIsolatedNode(btn)) continue;
      const existingIcon = btn.getAttribute('data-ag-cs-icon-injected');
      const iconName = detectHostIconTarget(btn);
      if (existingIcon) {
        if (existingIcon !== iconName) {
          restoreHostButtonIcon(btn);
        } else if (btn.querySelector?.('.ag-anim-icon')) {
          continue;
        } else {
          btn.removeAttribute('data-ag-cs-icon-injected');
        }
      }
      if (!iconName) continue;
      const origSvg = findOriginalHostSvg(btn);
      if (!origSvg || !origSvg.parentNode) continue;

      const rawSize = parseInt(origSvg.getAttribute?.('width') || '15', 10);
      const size = Number.isFinite(rawSize) && rawSize >= 12 && rawSize <= 20 ? rawSize : 15;
      pendingIcons.push({ btn, iconName, origSvg, size });
    }

    if (pendingIcons.length <= 20 || typeof requestAnimationFrame !== 'function') {
      for (let i = 0; i < pendingIcons.length; i++) {
        const it = pendingIcons[i];
        applySingleHostIcon(it.btn, it.iconName, it.origSvg, it.size);
      }
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

  function runSettingsGroupGlide(group, prevBtn, nextBtn, prevRectOverride = null) {
    if (!group || !prevBtn || !nextBtn || prevBtn === nextBtn || !isMotionStandardOrUltra()) return;
    if (!motionEngine || typeof motionEngine.glideIndicator !== 'function') return;
    const prevRect = prevRectOverride || (typeof prevBtn.getBoundingClientRect === 'function' ? prevBtn.getBoundingClientRect() : null);
    const nextRect = typeof nextBtn.getBoundingClientRect === 'function' ? nextBtn.getBoundingClientRect() : null;
    const pill = document.createElement('div');
    pill.className = 'ag-cs-pill-glide';
    pill.setAttribute('aria-hidden', 'true');
    pill.setAttribute('data-ag-no-i18n', '');
    if (nextRect && nextRect.width > 0 && nextRect.height > 0) {
      pill.style.setProperty('position', 'fixed');
      pill.style.setProperty('left', `${Math.round(nextRect.left)}px`);
      pill.style.setProperty('top', `${Math.round(nextRect.top)}px`);
      pill.style.setProperty('width', `${Math.round(nextRect.width)}px`);
      pill.style.setProperty('height', `${Math.round(nextRect.height)}px`);
      pill.style.setProperty('border-radius', '6px');
      pill.style.setProperty('background', 'rgba(148, 163, 184, 0.14)');
      pill.style.setProperty('box-shadow', 'inset 0 1px 0 rgba(255, 255, 255, 0.12)');
      pill.style.setProperty('pointer-events', 'none');
      pill.style.setProperty('z-index', '9999');
    }
    if (document.body) document.body.appendChild(pill);
    try {
      motionEngine.glideIndicator(pill, prevRect || prevBtn, nextRect || nextBtn, { durationMs: 220 });
    } catch {}
    streamChoreoCtl.scheduleTransient(() => pill.remove(), 240);
  }

  function formatSettingsSummary(lang, ui) {
    const pal = getEffectivePalette();
    const palLabel =
      pal === 'host'
        ? ui.optHost || (isZh() ? '跟随主题' : 'Host')
        : pal === 'warm' || pal === 'claude'
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
  }

  function resolveSettingRowActiveValue(key, lang) {
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
    if (key === 'ambientIntensity') return getAmbientIntensitySetting();
    if (key === 'palette') {
      const p = getEffectivePalette();
      return p === 'claude' ? 'warm' : p;
    }
    if (key === 'mascot') {
      return cfg.mascot === 'dual' ? 'crab' : cfg.mascot;
    }
    return cfg[key];
  }

  function isSettingButtonMatch(key, btnValJson, curVal) {
    if (JSON.stringify(curVal) === btnValJson) return true;
    if (key === 'palette' && (curVal === 'warm' || curVal === 'claude')) {
      return btnValJson === '"warm"' || btnValJson === '"claude"';
    }
    return false;
  }

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

  function healBlockedExternalPulseBar() {
    if (destroyed) return;
    const bar = document.getElementById('ag-pulse-status-bar');
    if (!bar || bar.getAttribute('data-ag-prism-fallback') === '1') return;
    if (bar.getAttribute('data-layout') !== 'blocked') return;
    const footer = bar.parentElement;
    if (!footer || !footer.classList?.contains('agy-composer-footer') || calibratedPulseFooters.has(footer)) return;
    const fw = typeof footer.getBoundingClientRect === 'function' ? footer.getBoundingClientRect().width : 0;
    if (fw < 420) return;
    calibratedPulseFooters.add(footer);
    const prevRole = footer.getAttribute('role');
    footer.setAttribute('role', 'banner');
    window.dispatchEvent?.(new Event('resize'));
    const t = setTimeout(() => {
      pulseHealTimers.delete(t);
      if (destroyed) return;
      if (prevRole) footer.setAttribute('role', prevRole);
      else footer.removeAttribute('role');
      window.dispatchEvent?.(new Event('resize'));
    }, 220);
    pulseHealTimers.add(t);
  }

  function syncContextCardOpenNotify() {
    const pulseHost = document.getElementById('ag-prism-pulse-bar') || document.getElementById('ag-pulse-status-bar');
    const cardEl =
      document.getElementById('context-card') ||
      (pulseHost && pulseHost.shadowRoot && typeof pulseHost.shadowRoot.getElementById === 'function'
        ? pulseHost.shadowRoot.getElementById('context-card')
        : null);
    const openNow = Boolean(
      cardEl &&
        cardEl.isConnected !== false &&
        !cardEl.hidden &&
        cardEl.getAttribute?.('aria-hidden') !== 'true' &&
        cardEl.style?.display !== 'none'
    );
    if (openNow && !wasContextCardOpen) {
      notifyMascot('vial-opened');
    }
    wasContextCardOpen = openNow;
  }

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
        pulseBridgeInst = pulseVialBridgeMod.mountPulseVialBridge({ win: window, doc: document });
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

  function cancelScheduledSync() {
    if (syncTimer === null) return;
    try {
      if (syncIsRaf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(syncTimer);
      } else {
        clearTimeout(syncTimer);
      }
    } catch {}
    syncTimer = null;
    syncQueued = false;
  }

  const OWN_PLUGIN_SELECTOR =
    '.ag-cs-home-panel-seat, .ag-cs-ripple-host, .ag-cs-conv-aura-host, .ag-cs-crab, .ag-cs-prism-rim-cv, .ag-cs-model-glyph, [data-testid="orchestrator-effort-bar"], .ag-cs-thinking-spark, .ag-cs-smooth-caret, .ag-cs-liftoff-veil, .ag-cs-sidebar-glide-pill, .ag-cs-pill-glide, .ag-cs-stream-chunk, .ag-cs-thought-chunk, .ag-anim-icon, .ag-prism-omni-menu, .ag-prism-omni-pane, [data-ag-prism-omni-owned="1"], [data-ag-prism-sidebar-owned="1"], .ces-ag-section, .ces-set, #ag-codex-effort-slider-styles, #ag-pulse-status-bar, #context-card, #' +
    SETTINGS_SEC_ID +
    ', #ag-prism-css, #ag-prism-omni-css, #ag-prism-sidebar-studio-css, #ag-claude-style-css, #ag-prism-motion-off-css, #ag-prism-host-alert-css';

  function isOwnPluginNode(target) {
    if (!target) return false;
    const el = target.closest ? target : target.parentElement;
    if (!el || !el.closest) return false;
    return Boolean(el.closest(OWN_PLUGIN_SELECTOR));
  }

  function isOwnPluginMutation(m) {
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
  }

  const FAST_PRUNE_LEAF_TAGS = new Set([
    'SPAN', 'P', 'CODE', 'STRONG', 'EM', 'B', 'I', 'LI', 'TD', 'TH', 'TR', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  ]);

  function syncBgCmdWrapParent(p) {
    if (!p || p.isConnected === false || String(p.tagName || '').toUpperCase() !== 'DIV') return;
    const has = Array.from(p.children || []).some((c) => c?.getAttribute?.('data-testid') === 'background-task-command');
    if (has) setAttrIfChanged(p, 'data-ag-cs-bg-cmd-wrap', '1');
    else if (p.hasAttribute?.('data-ag-cs-bg-cmd-wrap')) p.removeAttribute('data-ag-cs-bg-cmd-wrap');
  }

  function stampBgCmdWrap(scopeOrList) {
    const items = Array.isArray(scopeOrList) ? scopeOrList : [scopeOrList || document];
    for (const el of items) {
      if (!el || el.isConnected === false) continue;
      if (el.getAttribute?.('data-testid') === 'background-task-command') {
        syncBgCmdWrapParent(el.parentElement);
        continue;
      }
      if (el.hasAttribute?.('data-ag-cs-bg-cmd-wrap')) syncBgCmdWrapParent(el);
      if (typeof el.querySelectorAll !== 'function') continue;
      if (!Array.isArray(scopeOrList)) {
        for (const w of el.querySelectorAll('[data-ag-cs-bg-cmd-wrap="1"]')) syncBgCmdWrapParent(w);
      }
      for (const c of el.querySelectorAll('[data-testid="background-task-command"]')) syncBgCmdWrapParent(c.parentElement);
    }
  }

  let axE = null, axO = null;
  const AX_A = 'data-ag-cs-aux-dual', AX_H = /(?:^|[;\s])(?:width\s*:\s*0(?:\s|;|px|%|$)|display\s*:\s*none)/i;
  const axV = (e) => !!(e && /^div$/i.test(e.tagName || '') && !e.hidden && !e.hasAttribute?.('hidden') && e.getAttribute?.('aria-hidden') !== 'true' && !AX_H.test(e.getAttribute?.('style') || ''));
  const axU = (s) => { if (!s || s.isConnected === false) return; const f = s.firstElementChild, l = s.lastElementChild, d = !!(f && l && f !== l && axV(f) && axV(l)); d ? s.getAttribute?.(AX_A) !== '1' && s.setAttribute?.(AX_A, '1') : s.removeAttribute?.(AX_A); };
  function syncAuxSplit() {
    const s = document.querySelector?.('[data-testid="aux-pane-split"]') || null;
    if (s !== axE) {
      try { axO?.disconnect?.(); } catch {}
      axO = null;
      axE?.isConnected !== false && axE?.removeAttribute?.(AX_A);
      axE = s;
      if (s && typeof MutationObserver === 'function') {
        const o = { attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style'] };
        const rb = () => { if (!destroyed && axO && axE) { axO.disconnect(); try { axO.observe(axE, { childList: true }); const f = axE.firstElementChild, l = axE.lastElementChild; f && axO.observe(f, o); l && l !== f && axO.observe(l, o); } catch {} } };
        axO = new MutationObserver((rs) => { if (!destroyed && axE) { rs?.some?.((r) => r.type === 'childList') && rb(); runGuardedMut(() => axU(axE)); } });
        rb();
      }
    }
    s && axU(s);
  }

  // Host Turbo: 去重官方重复 alert.css <style>（仅 disabled 不删 React 节点）+ <img> 异步懒解码
  const AH_ID = 'ag-prism-host-alert-css';
  const TS_A = 'data-ag-turbo-dedup';
  const TI_A = 'data-ag-turbo-img';
  function syncHostTurbo(roots) {
    const ds = (s) => {
      if (!s || s.id || s.getAttribute?.(TS_A) === '1') return;
      const t = s.textContent || '';
      if (!t.includes('remark-github-blockquote-alert/alert.css')) return;
      if (!document.getElementById?.(AH_ID)) {
        const h = document.head || document.documentElement;
        if (!h || !document.createElement) return;
        const g = document.createElement('style');
        g.id = AH_ID;
        g.setAttribute('data-ag-prism-turbo', '1');
        g.textContent = t;
        h.appendChild(g);
      }
      s.setAttribute?.(TS_A, '1');
      s.disabled = true;
      try { if (s.sheet) s.sheet.disabled = true; } catch {}
    };
    const oi = (m) => {
      if (!m || m.getAttribute?.(TI_A) === '1' || m.hasAttribute?.('data-prism-ignore') || m.closest?.('[data-prism-ignore]')) return;
      m.decoding = 'async';
      m.setAttribute?.('decoding', 'async');
      const ld = m.getAttribute?.('loading');
      if (!ld || ld === 'auto') { m.loading = 'lazy'; m.setAttribute?.('loading', 'lazy'); }
      m.setAttribute?.(TI_A, '1');
    };
    for (const el of Array.isArray(roots) ? roots : [roots || document]) {
      if (!el || el.isConnected === false) continue;
      const tg = String(el.tagName || '').toUpperCase();
      if (tg === 'STYLE') ds(el);
      else if (tg === 'IMG') oi(el);
      else if (el.querySelectorAll) {
        for (const s of el.querySelectorAll(`style:not([id]):not([${TS_A}])`)) ds(s);
        for (const m of el.querySelectorAll(`img:not([${TI_A}])`)) oi(m);
      }
    }
  }
  function restoreHostTurbo() {
    document.getElementById?.(AH_ID)?.remove?.();
    for (const s of document.querySelectorAll?.(`style[${TS_A}]`) || []) {
      s.disabled = false;
      try { if (s.sheet) s.sheet.disabled = false; } catch {}
      s.removeAttribute?.(TS_A);
    }
    for (const m of document.querySelectorAll?.(`img[${TI_A}]`) || []) m.removeAttribute?.(TI_A);
  }

  function classifyDirtySubtree(el, isAdded) {
    if (!isElementLike(el)) return;
    const tid = String(el.getAttribute?.('data-testid') || '');
    const role = String(el.getAttribute?.('role') || '');
    const cls = String(el.className || '');

    if (
      !tid &&
      !role &&
      !el.id &&
      !cls.includes('agy-') &&
      !cls.includes('surface-') &&
      FAST_PRUNE_LEAF_TAGS.has(String(el.tagName || '').toUpperCase()) &&
      (!el.children || el.children.length === 0)
    ) {
      return;
    }

    const HC_ATTR = 'data-hover-card-popup';
    if (
      el.hasAttribute?.(HC_ATTR) ||
      el.closest?.('[' + HC_ATTR + ']') ||
      (role === 'presentation' && el.firstElementChild?.hasAttribute?.(HC_ATTR))
    ) {
      return;
    }

    if (tid === 'background-task-command') {
      if (isAdded) {
        dirtyFlags.bgCmd = true;
        dirtyBgCmds.add(el);
      }
      return;
    }

    let touchedButtons = false;
    const inConvStream =
      tid !== 'conversation-view' &&
      tid !== 'agent-input-box' &&
      !cls.includes('agy-home') &&
      Boolean(el.closest?.('[data-testid="conversation-view"]')) &&
      !el.closest?.('[data-testid="agent-input-box"]');

    if (!inConvStream) {
      if (
        cls.includes('agy-home') ||
        tid === 'conversation-view' ||
        tid === 'home-greeting' ||
        (!isAdded && el.querySelector?.('.agy-home, [data-testid="conversation-view"]')) ||
        (isAdded && el.querySelector?.('.agy-home, [data-testid="conversation-view"], [data-testid="home-greeting"]'))
      ) {
        dirtyFlags.route = true;
        dirtyFlags.composer = true;
        touchedButtons = true;
        dirtyFlags.collapsible = true;
      }

      if (tid === 'conversation-row-sidebar' || el.closest?.('aside') || el.querySelector?.('[data-testid="conversation-row-sidebar"]')) {
        dirtyFlags.sidebar = true;
        if (isAdded) touchedButtons = true;
      }

      if (
        tid === 'agent-input-box' ||
        tid === 'input-cancel-button' ||
        tid === 'stop-button' ||
        tid === 'cancel-button' ||
        tid === 'agent-loading' ||
        tid === 'send-button' ||
        tid === 'input-send-button' ||
        tid === 'model-selector-trigger' ||
        tid === 'interaction-takeover-card' ||
        tid === 'side-question-panel' ||
        tid === 'running-items-panel' ||
        cls.includes('surface-composer-card') ||
        el.closest?.('[data-testid="agent-input-box"]') ||
        el.querySelector?.('[data-testid="agent-input-box"], [data-testid="input-cancel-button"], .surface-composer-card')
      ) {
        dirtyFlags.composer = true;
        dirtyFlags.route = true;
        if (isAdded) touchedButtons = true;
      }

      if (
        role === 'dialog' ||
        tid === 'model-selector-panel' ||
        el.id === 'ag-pulse-status-bar' ||
        el.id === 'ag-prism-pulse-bar' ||
        el.id === 'context-card' ||
        el.closest?.('[role="dialog"], [data-testid="model-selector-panel"]') ||
        el.querySelector?.('[role="dialog"], [data-testid="model-selector-panel"], #context-card')
      ) {
        dirtyFlags.overlays = true;
        dirtyFlags.settings = true;
        dirtyFlags.composer = true;
        if (isAdded) touchedButtons = true;
      } else if (
        tid === 'overview-panel' ||
        cls.includes('agy-overlay') ||
        Boolean(el.querySelector?.('[data-testid="overview-panel"]')) ||
        Boolean(el.querySelector?.('.agy-overlay') && !el.querySelector?.('[' + HC_ATTR + ']'))
      ) {
        dirtyFlags.overlays = true;
      }
    } else {
      if (
        tid === 'interaction-takeover-card' ||
        tid === 'side-question-panel' ||
        tid === 'running-items-panel' ||
        tid === 'agent-loading' ||
        el.querySelector?.('[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"], [data-testid="running-items-panel"]')
      ) {
        dirtyFlags.composer = true;
      }
      if (role === 'dialog' || tid === 'overview-panel' || cls.includes('agy-overlay')) {
        dirtyFlags.overlays = true;
      }
    }

    if (
      isAdded &&
      el.querySelector?.('[data-testid="background-task-command"]')
    ) {
      dirtyFlags.bgCmd = true;
      dirtyBgCmds.add(el);
    }

    if (isAdded) {
      const tg = String(el.tagName || '').toUpperCase();
      if (tg === 'STYLE' || tg === 'IMG' || el.querySelector?.(`style:not([id]):not([${TS_A}]),img:not([${TI_A}])`)) {
        dirtyTurboRoots.add(el);
      }
    }

    if (
      tid === 'worked-for-collapsible' ||
      tid === 'thinking-collapsible-trigger' ||
      tid === 'tool-group-collapsible' ||
      tid === 'changed-files-card-header' ||
      tid === 'sidecar-iframe' ||
      tid === 'artifact-view' ||
      String(el.tagName || '').toUpperCase() === 'PRE' ||
      el.querySelector?.(
        '[data-testid="worked-for-collapsible"], [data-testid="thinking-collapsible-trigger"], [data-testid="changed-files-card-header"], [data-testid="sidecar-iframe"], [data-testid="artifact-view"], pre'
      )
    ) {
      dirtyFlags.collapsible = true;
      if (isAdded) dirtyCollapsibleTargets.add(el);
    }

    if (isAdded && (touchedButtons || isHostButtonCandidate(el) || el.querySelector?.(HOST_BTN_QUERY))) {
      dirtyFlags.buttons = true;
      dirtyAddedRoots.add(el);
    } else if (touchedButtons) {
      dirtyFlags.buttons = true;
    }
  }

  function measureSyncPhase(flags, isFullSync = false) {
    const inHome = Boolean(document.querySelector('.agy-home'));
    const inHero = inHome && Boolean(document.querySelector('.agy-home [data-testid="home-greeting"]'));
    const formalConv = !inHome ? streamChoreoCtl.findFormalConvView() : null;
    const curCascadeId = formalConv ? formalConv.getAttribute?.('data-cascade-id') || resolveCascadeId(null) || '' : '';
    const isConvSwap = Boolean(
      formalConv &&
        ((lastFormalConvEl && formalConv !== lastFormalConvEl) ||
          (curCascadeId && lastFormalCascadeId && curCascadeId !== lastFormalCascadeId))
    );
    const isAsyncConvEntry =
      !isFullSync && !inHome && Boolean(formalConv) && (!streamChoreoCtl.heroState.wasInFormalConv || isConvSwap);

    let homeComposerSampled = false;
    if (inHome && (flags.full || flags.route || flags.composer)) {
      streamChoreoCtl.sampleHomeComposerRect();
      homeComposerSampled = true;
    }

    let convInputRect = null;
    if (streamChoreoCtl.heroState.routeInitialized && streamChoreoCtl.heroState.wasInHome && !inHome && formalConv && isMotionUltra() && !streamChoreoCtl.isEntryMotionSuppressed?.()) {
      const ib = formalConv.querySelector('[data-testid="agent-input-box"]') || document.querySelector('[data-testid="agent-input-box"]');
      if (ib && typeof ib.getBoundingClientRect === 'function') {
        convInputRect = ib.getBoundingClientRect();
      }
    }

    const sidebarSnap =
      flags.full || flags.sidebar || flags.route ? streamChoreoCtl.measureSidebarSelectionSnapshot() : null;
    const visibleChangedHeaders =
      !isAsyncConvEntry && (flags.full || flags.collapsible || flags.route) ? streamChoreoCtl.measureVisibleChangedHeaders() : [];
    const lensOverlays =
      (flags.full || flags.overlays) && isMotionStandardOrUltra() ? streamChoreoCtl.measureNewLensOverlays() : [];
    const caretList =
      !isAsyncConvEntry && (flags.full || flags.composer) && cfg.smoothCaret !== false
        ? smoothCaretCtl.measureSnapshot(false, false)
        : null;
    if (flags.full || flags.route || flags.composer || flags.theme) {
      convAuraCtl.prime?.();
    }

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
  }

  let enhancerSyncTimer = 0;
  let lastEnhancerSyncAt = 0;
  function flushHostEnhancerSync() {
    if (enhancerSyncTimer) {
      clearTimeout(enhancerSyncTimer);
      enhancerSyncTimer = 0;
    }
    if (destroyed) return;
    lastEnhancerSyncAt = Date.now();
    try {
      hostEnhancerCtl.sync?.();
    } catch {}
  }
  function scheduleHostEnhancerSync(immediate) {
    if (immediate || !isConvRunning()) {
      flushHostEnhancerSync();
      return;
    }
    const elapsed = Date.now() - lastEnhancerSyncAt;
    if (elapsed >= 200) {
      flushHostEnhancerSync();
      return;
    }
    if (!enhancerSyncTimer) {
      enhancerSyncTimer = setTimeout(flushHostEnhancerSync, Math.max(32, 200 - elapsed));
    }
  }

  function runSync(forceFull = false) {
    if (destroyed) return;
    const t0 = performance.now();
    if (forceFull) markAllDirty();

    const flags = { ...dirtyFlags };
    const addedRoots = Array.from(dirtyAddedRoots);
    const collapsibleScope = dirtyCollapsibleTargets.size > 0 ? new Set(dirtyCollapsibleTargets) : null;
    const bgCmdNodes = dirtyBgCmds.size > 0 ? Array.from(dirtyBgCmds) : null;
    const turboRoots = dirtyTurboRoots.size > 0 ? Array.from(dirtyTurboRoots) : null;
    dirtyAddedRoots.clear();
    dirtyCollapsibleTargets.clear();
    dirtyBgCmds.clear();
    dirtyTurboRoots.clear();
    dirtyFlags.full = false;
    dirtyFlags.theme = false;
    dirtyFlags.route = false;
    dirtyFlags.sidebar = false;
    dirtyFlags.composer = false;
    dirtyFlags.buttons = false;
    dirtyFlags.overlays = false;
    dirtyFlags.collapsible = false;
    dirtyFlags.settings = false;
    dirtyFlags.bgCmd = false;

    const prevWasInHome = streamChoreoCtl.heroState.wasInHome;
    const prevWasInConv = streamChoreoCtl.heroState.wasInFormalConv;
    const effectiveFull = Boolean(forceFull || flags.full);

    // ── Phase 1: Pure Measure ──
    const measured = measureSyncPhase(flags, effectiveFull);
    const deferHeavyConvWork = Boolean(measured.isAsyncConvEntry);
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

    const routeJumped =
      effectiveFull ||
      measured.isConvSwap ||
      measured.inHome !== prevWasInHome ||
      Boolean(measured.formalConv) !== prevWasInConv;

    // ── Phase 2: Pure Mutate ──
    runGuardedMut(() => {
      applyRootAttrs(effectiveFull);
      if (effectiveFull || flags.bgCmd) {
        stampBgCmdWrap(effectiveFull ? document : bgCmdNodes);
      }
      if (effectiveFull || turboRoots) {
        syncHostTurbo(effectiveFull ? document : turboRoots);
      }
      if (effectiveFull || flags.route || flags.sidebar || !axE || axE.isConnected === false) syncAuxSplit();

      if (flags.full || flags.route || measured.inHero !== homeStudioCtl.wasHero()) {
        homeStudioCtl.syncGreeting(measured.inHero);
        if (cfg.homeLayout !== 'studio') {
          homeStudioCtl.unmountPanelSeat();
        } else if (measured.inHero) {
          homeStudioCtl.renderHomePanel();
        } else {
          homeStudioCtl.parkPanelSeat();
        }
      }

      if (flags.full || flags.route || flags.theme) {
        rippleCtl.sync();
      }
      if (flags.full || flags.route || flags.composer || flags.collapsible || flags.theme) {
        convAuraCtl.sync(true);
      }
      if (flags.full || flags.composer || flags.overlays || flags.collapsible) {
        syncComposers(measured, deferHeavyConvWork);
      }
      if (flags.full || flags.route || flags.sidebar || flags.composer) {
        streamChoreoCtl.syncHeroRouteChoreography(measured);
      } else if (flags.collapsible) {
        streamChoreoCtl.syncHeroCCaustics(measured.visibleChangedHeaders);
      }
      if (!deferHeavyConvWork && (flags.full || flags.route || flags.composer || flags.collapsible)) {
        streamChoreoCtl.syncDualStreamEngine();
      }
      if (flags.full || flags.overlays) {
        streamChoreoCtl.syncLensOverlayOrigins(measured.lensOverlays);
      }

      if (routeJumped || flags.route || flags.composer) {
        prismRimCtl.markDirty();
      }

      if (deferHeavyConvWork) {
        const outerAddedRoots = addedRoots.filter(
          (r) => r && r.isConnected !== false && (!measured.formalConv || !measured.formalConv.contains?.(r))
        );
        if (outerAddedRoots.length > 0) syncHostAnimatedIcons(outerAddedRoots);
        const expectedConv = measured.formalConv;
        const expectedCid = measured.curCascadeId || '';
        const verifyTargetConv = () => {
          if (destroyed) return null;
          const convNow = streamChoreoCtl.findFormalConvView();
          if (!convNow) return null;
          const nowCid = convNow.getAttribute?.('data-cascade-id') || resolveCascadeId(null) || '';
          if (convNow !== expectedConv || (expectedCid && nowCid && nowCid !== expectedCid)) {
            dirtyFlags.route = true;
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
            scheduleHostEnhancerSync(false);
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
                window.__agPrismThought?.scan?.();
              } catch {}
            }
          }
        );
      } else {
        if (flags.full) {
          syncHostAnimatedIcons(null);
        } else if (routeJumped) {
          const jumpRoots = [document.querySelector('.agy-home'), measured.formalConv, ...addedRoots].filter(Boolean);
          syncHostAnimatedIcons(jumpRoots.length > 0 ? jumpRoots : null);
        } else if (flags.buttons && addedRoots.length > 0) {
          syncHostAnimatedIcons(addedRoots);
        }

        if ((flags.full || flags.collapsible || routeJumped) && getThoughtTranslateMode() !== 'off') {
          try {
            window.__agPrismThought?.scan?.();
          } catch {}
        }
      }
      if (flags.full || flags.settings) {
        ensureSettingsSection();
      }
      if (flags.full || flags.route || flags.composer || flags.theme) {
        ensurePulseBridge(Boolean(flags.full || flags.theme));
      }
      if (
        !deferHeavyConvWork &&
        (flags.full ||
          flags.route ||
          flags.collapsible ||
          flags.composer ||
          flags.buttons ||
          flags.theme)
      ) {
        scheduleHostEnhancerSync(Boolean(flags.full || routeJumped || flags.theme));
      }
    });
    if (!deferHeavyConvWork) {
      if (flags.full || routeJumped) {
        streamChoreoCtl.syncWorkedForAutoUnfold();
      } else if (flags.collapsible) {
        streamChoreoCtl.syncWorkedForAutoUnfold(collapsibleScope);
      }
    }

    perfStats.lastSyncMs = +(performance.now() - t0).toFixed(3);
    perfStats.syncCount += 1;
  }

  function scheduleSync() {
    if (destroyed) return;
    const highPri = Boolean(
      dirtyFlags.full || dirtyFlags.route || dirtyFlags.theme || dirtyFlags.sidebar || dirtyFlags.composer || dirtyFlags.overlays || dirtyFlags.settings
    );
    if (syncQueued) {
      if (highPri && !syncIsRaf && !document.hidden && syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
        syncQueued = false;
      } else return;
    }
    syncQueued = true;
    const run = () => { syncTimer = null; syncQueued = false; runSync(false); };
    if (!document.hidden && (highPri || !isConvRunning()) && typeof requestAnimationFrame === 'function') {
      syncIsRaf = true;
      syncTimer = requestAnimationFrame(run);
    } else {
      syncIsRaf = false;
      syncTimer = setTimeout(run, document.hidden ? 50 : 96);
    }
  }

  function onStoreChanged() {
    const inHero = Boolean(document.querySelector('.agy-home'));
    if (inHero && cfg.homeLayout === 'studio') {
      homeStudioCtl.scheduleUsageRollupRefresh(1800);
    }
    if (document.hidden) {
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
    dirtyFlags.composer = true;
    dirtyFlags.route = true;
    scheduleSync();
  }

  // ── Event Handlers ─────────────────────────────────────────────────────
  const BLUR_ATTR = 'data-ag-cs-win-blur';
  let blurTm = 0;
  function clearWinBlur() {
    if (blurTm) { clearTimeout(blurTm); blurTm = 0; }
    const h = document.documentElement;
    if (h?.hasAttribute?.(BLUR_ATTR)) {
      runGuardedMut(() => h.removeAttribute(BLUR_ATTR));
      try { mascotState.rig?.syncPowerState?.(); } catch {}
      try { convAuraCtl.sync(true); } catch {}
      try { window.__agPrismTelemetry?.refresh?.(); } catch {}
    }
  }
  function wakeWinBlur() {
    if (blurTm || document.documentElement?.hasAttribute?.(BLUR_ATTR)) {
      clearWinBlur();
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) onWinBlur();
    }
  }
  function onWinBlur() {
    if (destroyed || blurTm) return;
    blurTm = setTimeout(() => {
      blurTm = 0;
      const h = document.documentElement;
      if (!destroyed && (!document.hasFocus || !document.hasFocus()) && h?.getAttribute?.(BLUR_ATTR) !== '1') {
        runGuardedMut(() => h.setAttribute(BLUR_ATTR, '1'));
        try { mascotState.rig?.syncPowerState?.(); } catch {}
      }
    }, 1200);
  }
  function onWinPointerMove(ev) {
    wakeWinBlur();
    prismRimCtl.onPointerMove(ev);
  }

  function onWinResize() {
    if (destroyed) return;
    prismRimCtl.markDirty();
    smoothCaretCtl.bumpMetricsEpoch();
    smoothCaretCtl.queue(false, false, true);
  }

  function onWinStorage(ev) {
    if (destroyed || !ev) return;
    if (ev.key === STORAGE_PRISM_KEY || ev.key === STORAGE_FILE_CFG_KEY) {
      cfg = loadSettings(currentBaseConfig);
      markAllDirty();
      applyRootAttrs();
      scheduleSync();
    }
  }

  function onDocVisibilityChange() {
    if (destroyed || document.hidden) return;
    if (typeof document.hasFocus !== 'function' || document.hasFocus()) clearWinBlur();
    if (pendingHiddenFullSync) {
      pendingHiddenFullSync = false;
      markAllDirty();
      scheduleSync();
    }
  }

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.getAttribute?.('contenteditable') === 'true' || el.isContentEditable) return true;
    if (el.closest?.('[contenteditable="true"], input, textarea, select, [role="textbox"]')) return true;
    return false;
  }

  function onWinKeyDown(ev) {
    if (destroyed || !ev) return;
    wakeWinBlur();
    if (
      ev.key === 'Enter' &&
      !ev.shiftKey &&
      !ev.isComposing &&
      ev.target?.closest?.('[data-testid="agent-input-box"] [contenteditable="true"]')
    ) {
      if (ev.target.closest?.('.agy-home')) {
        streamChoreoCtl.triggerHomeLiftoffRippleBurst();
      }
      convAuraCtl.triggerStart();
      notifyMascot('send', {});
      return;
    }
    if (ev.key === '[' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !isEditableTarget(ev.target)) {
      const html = document.documentElement;
      if (!html || cfg.sidebarRestyle === false) return;
      if (html.getAttribute('data-ag-cs-sidebar-collapsed') === '1') {
        html.removeAttribute('data-ag-cs-sidebar-collapsed');
      } else {
        html.setAttribute('data-ag-cs-sidebar-collapsed', '1');
      }
    }
  }

  function onWinClick(ev) {
    if (destroyed || !ev?.target?.closest) return;
    if (isThoughtIsolatedNode(ev.target)) return;

    const isPulseNode = (n) => n?.id === 'ag-prism-pulse-bar' || n?.id === 'ag-pulse-status-bar';
    const pulseClicked =
      isPulseNode(ev.target) ||
      Boolean(ev.target?.closest?.('#ag-prism-pulse-bar,#ag-pulse-status-bar')) ||
      Boolean(typeof ev.composedPath === 'function' && ev.composedPath().some(isPulseNode));
    if (pulseClicked) {
      setTimeout(() => {
        if (!destroyed) syncContextCardOpenNotify();
      }, 28);
    }

    const thinkBtn = ev.target.closest('[data-testid="thinking-collapsible-trigger"]');
    if (thinkBtn && getThoughtTranslateMode() !== 'off') {
      setTimeout(() => {
        try {
          window.__agPrismThought?.scan?.();
        } catch {}
      }, 25);
    }

    const sendBtn = ev.target.closest('[data-testid="input-send-button"], [data-testid="send-button"]');
    if (sendBtn && !sendBtn.disabled) {
      if (sendBtn.closest?.('.agy-home')) {
        streamChoreoCtl.triggerHomeLiftoffRippleBurst();
      }
      if (sendBtn.getAttribute('data-ag-cs-icon-injected') === 'arrow-up-launch' && isMotionStandardOrUltra()) {
        try {
          motionEngine?.triggerIcon?.(sendBtn, 'launch');
        } catch {}
      }
      convAuraCtl.triggerStart();
      notifyMascot('send', {});
    }

    const copyBtn =
      ev.target.closest('[data-ag-cs-icon-injected="copy-check"]') ||
      ev.target.closest('pre button, button[aria-label*="Copy" i], button[aria-label*="复制"]');
    if (copyBtn && !copyBtn.disabled && !isThoughtIsolatedNode(copyBtn)) {
      if (
        copyBtn.getAttribute?.('data-ag-cs-icon-injected') === 'copy-check' &&
        !motionReduced() &&
        motionEngine &&
        typeof motionEngine.triggerIcon === 'function'
      ) {
        try {
          motionEngine.triggerIcon(copyBtn, 'check', { revertAfterMs: 1600 });
        } catch {}
      }
      notifyMascot('code-copied');
    }

    const navTurn = ev.target.closest(
      '[data-testid="conversation-navigator-turn"], [data-testid="conversation-navigator-group"]'
    );
    if (navTurn) {
      streamChoreoCtl.triggerHeroESonar(navTurn);
    }

    const grpBtn = ev.target.closest('[role="dialog"] [role="group"] button');
    if (grpBtn && !grpBtn.hasAttribute('data-ag-cs-key') && !handledGroupClicks.has(ev)) {
      handledGroupClicks.add(ev);
      const grp = grpBtn.closest('[role="group"]');
      const gp = streamChoreoCtl.heroState.lastGroupPress;
      if (gp && gp.group === grp && gp.prevBtn && gp.prevBtn !== grpBtn) {
        runSettingsGroupGlide(grp, gp.prevBtn, grpBtn, gp.prevRect);
      }
    }

    const wfBtn = ev.target.closest('[data-testid="worked-for-collapsible"]');
    if (wfBtn && cfg.composerRestyle !== false) {
      streamChoreoCtl.scheduleWorkedForClickSync();
    }
  }

  function onDocPointerDown(ev) {
    wakeWinBlur();
    if (ev && ev.target?.closest) {
      const trigBtn = ev.target.closest('button, [role="button"], [data-testid]');
      if (trigBtn && typeof trigBtn.getBoundingClientRect === 'function') {
        const r = trigBtn.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          streamChoreoCtl.heroState.lastTriggerOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: performance.now() };
        }
      } else if (Number.isFinite(ev.clientX) && Number.isFinite(ev.clientY)) {
        streamChoreoCtl.heroState.lastTriggerOrigin = { x: ev.clientX, y: ev.clientY, at: performance.now() };
      }

      const grp = ev.target.closest('[role="dialog"] [role="group"]');
      if (grp && grp.children) {
        const prevBtn = Array.from(grp.children).find(
          (sib) =>
            sib.getAttribute?.('aria-pressed') === 'true' ||
            sib.hasAttribute?.('data-pressed') ||
            sib.getAttribute?.('aria-checked') === 'true' ||
            sib.getAttribute?.('data-state') === 'on'
        );
        streamChoreoCtl.heroState.lastGroupPress = {
          group: grp,
          prevBtn: prevBtn || null,
          prevRect: prevBtn && typeof prevBtn.getBoundingClientRect === 'function' ? prevBtn.getBoundingClientRect() : null,
        };
      }
    }
    notifyMascot('activity', {});
    smoothCaretCtl.queue(false);
  }

  const MODIFIER_ONLY_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']);

  function onDocCaretEvent(ev) {
    const type = ev?.type || '';
    if ((type === 'keydown' || type === 'keyup') && ev?.key && MODIFIER_ONLY_KEYS.has(ev.key)) {
      return;
    }
    if (type === 'scroll' || type === 'selectionchange' || type === 'keydown' || type === 'keyup') {
      const ae = document.activeElement;
      if (!ae || !ae.closest?.('[data-testid="agent-input-box"]')) {
        return;
      }
      if (type === 'scroll') {
        const st = ev?.target;
        if (
          st &&
          st !== ae &&
          !ae.contains?.(st) &&
          (st === document ||
            st === document.documentElement ||
            st === document.body ||
            st.getAttribute?.('data-testid') === 'autoscroll-viewport' ||
            !st.contains?.(ae))
        ) {
          return;
        }
      }
    }
    const isTyping = type === 'input' || type === 'keyup' || type === 'compositionupdate' || type === 'compositionend';
    const immediate = type === 'focusin' || type === 'mouseup' || type === 'transitionend';
    const refreshMetrics = type === 'focusin';
    smoothCaretCtl.queue(isTyping, immediate, refreshMetrics, type === 'scroll');
    if (type === 'input' && ev?.target?.closest && ev.target.closest('[data-testid="agent-input-box"]')) {
      if (mascotState.rig && typeof mascotState.rig.onUserType === 'function') {
        try {
          const ed = ev.target.closest('[contenteditable="true"]') || ev.target;
          mascotState.rig.onUserType(ed?.textContent || '');
        } catch {}
      }
    }
  }

  function onDocTransitionEnd(ev) {
    if (ev?.target?.closest && ev.target.closest('[data-testid="agent-input-box"]')) {
      smoothCaretCtl.queue(false, true, false);
    }
  }

  const observer = new MutationObserver((mutations) => {
    if (destroyed || internalDomMutating || streamChoreoCtl.isStreamMutating() || !mutations || mutations.length === 0) return;

    // 后台隐藏窗口挂起深扫：避免 Swarm 多窗口后台刷屏触发海量 querySelector，切回前台时由 visibilitychange 合并一次同步！
    if (document.hidden) {
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
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (isThoughtMutationRecord(m)) continue;
      if (isOwnPluginMutation(m)) continue;

      if (m.type === 'attributes') {
        if (m.attributeName === 'data-ag-prism-host-i18n') {
          dirtyFlags.settings = true;
          anyRelevant = true;
          continue;
        }
        const tgt = m.target;
        if (tgt === document.body || tgt === document.documentElement) {
          dirtyFlags.theme = true;
          anyRelevant = true;
          continue;
        }
        const tid = String(tgt?.getAttribute?.('data-testid') || '');
        if (tid === 'conversation-view' && m.attributeName === 'data-cascade-id') {
          dirtyFlags.route = true;
          dirtyFlags.composer = true;
          anyRelevant = true;
        } else if (tid === 'conversation-row-sidebar') {
          dirtyFlags.sidebar = true;
          anyRelevant = true;
        } else if (
          tid === 'worked-for-collapsible' ||
          tid === 'thinking-collapsible-trigger' ||
          tid === 'changed-files-card-header'
        ) {
          dirtyFlags.collapsible = true;
          dirtyCollapsibleTargets.add(tgt);
          anyRelevant = true;
        } else if (tid === 'running-items-panel') {
          dirtyFlags.composer = true;
          anyRelevant = true;
        }
        continue;
      }

      if (m.type === 'childList') {
        if (m.target?.tagName === 'STYLE' && !m.target.id && m.target.getAttribute?.(TS_A) !== '1') {
          dirtyTurboRoots.add(m.target);
          anyRelevant = true;
        }
        const inComposerBox = Boolean(isElementLike(m.target) && m.target.closest?.('[data-testid="agent-input-box"]'));
        const added = m.addedNodes;
        if (added && added.length > 0) {
          for (let j = 0; j < added.length; j++) {
            const node = added[j];
            if (!isElementLike(node) || isThoughtIsolatedNode(node) || isOwnPluginNode(node)) continue;
            classifyDirtySubtree(node, true);
            if (inComposerBox) {
              dirtyFlags.composer = true;
              dirtyFlags.route = true;
            }
            anyRelevant = true;
          }
        }
        const removed = m.removedNodes;
        if (removed && removed.length > 0) {
          if (isElementLike(m.target) && m.target.hasAttribute?.('data-ag-cs-bg-cmd-wrap')) {
            dirtyFlags.bgCmd = true;
            dirtyBgCmds.add(m.target);
            anyRelevant = true;
          }
          for (let j = 0; j < removed.length; j++) {
            const node = removed[j];
            if (!isElementLike(node) || isThoughtIsolatedNode(node) || isOwnPluginNode(node)) continue;
            classifyDirtySubtree(node, false);
            if (inComposerBox) {
              dirtyFlags.composer = true;
              dirtyFlags.route = true;
            }
            anyRelevant = true;
          }
        }
      }
    }

    if (
      anyRelevant &&
      (dirtyFlags.full ||
        dirtyFlags.theme ||
        dirtyFlags.route ||
        dirtyFlags.sidebar ||
        dirtyFlags.composer ||
        dirtyFlags.buttons ||
        dirtyFlags.overlays ||
        dirtyFlags.collapsible ||
        dirtyFlags.settings ||
        dirtyFlags.bgCmd ||
        dirtyTurboRoots.size > 0)
    ) {
      scheduleSync();
    }
  });
  mainObserver = observer;

  // Strict test contract: NEVER register 'click' or 'mousedown' on document!
  const DOC_LISTENERS = [
    ['pointerdown', onDocPointerDown],
    ['keyup', onDocCaretEvent],
    ['mouseup', onDocCaretEvent],
    ['input', onDocCaretEvent],
    ['selectionchange', onDocCaretEvent],
    ['focusin', onDocCaretEvent],
    ['focusout', onDocCaretEvent],
    ['scroll', onDocCaretEvent],
    ['compositionupdate', onDocCaretEvent],
    ['compositionend', onDocCaretEvent],
    ['transitionend', onDocTransitionEnd],
    ['visibilitychange', onDocVisibilityChange],
  ];

  const WIN_LISTENERS = [
    ['pointermove', onWinPointerMove, { passive: true }],
    ['resize', onWinResize, { passive: true }],
    ['keydown', onWinKeyDown, false],
    ['click', onWinClick, true],
    ['storage', onWinStorage, false],
    ['blur', onWinBlur, false],
    ['focus', clearWinBlur, false],
  ];

  let pollTimer = null;
  let coreTornDown = false;
  function teardownCore() {
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
    if (crabRemoveAttrTimer) {
      clearTimeout(crabRemoveAttrTimer);
      crabRemoveAttrTimer = 0;
    }
    for (const t of pulseHealTimers) clearTimeout(t);
    pulseHealTimers.clear();
    syncMotionOffStyle(false);
    streamChoreoCtl.disconnectStreamObserver();
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (enhancerSyncTimer) {
      clearTimeout(enhancerSyncTimer);
      enhancerSyncTimer = 0;
    }
    if (storeDebounce) {
      clearTimeout(storeDebounce);
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
    try { axO?.disconnect?.(); axE?.removeAttribute?.(AX_A); } catch {}
    axO = axE = null;
    for (const [evName, handler] of DOC_LISTENERS) {
      try {
        document.removeEventListener(evName, handler, true);
      } catch {}
    }
    if (typeof window.removeEventListener === 'function') {
      for (const [evName, handler, opts] of WIN_LISTENERS) {
        try {
          window.removeEventListener(evName, handler, opts);
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

    if (Array.isArray(globalThis.__agCsCleanups)) {
      const idx = globalThis.__agCsCleanups.indexOf(teardownCore);
      if (idx >= 0) globalThis.__agCsCleanups.splice(idx, 1);
    }
  }

  globalThis.__agCsCleanups = Array.isArray(globalThis.__agCsCleanups) ? globalThis.__agCsCleanups : [];
  globalThis.__agCsCleanups.push(teardownCore);

  let activePollMs = 0;
  function restartPollTimer() {
    const nextMs = Math.max(5000, Number(cfg.pollIntervalMs || currentBaseConfig.pollIntervalMs) || 5000);
    if (pollTimer !== null && activePollMs === nextMs) return;
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    activePollMs = nextMs;
    pollTimer = setInterval(() => {
      if (destroyed || document.hidden) return;
      const darkNow = isDarkTheme();
      const expectedThemeKey = `${getEffectivePalette()}|${getLightPreset()}|${darkNow ? 'd' : 'l'}|${getAccentTone()}|${getAmbientIntensitySetting()}|${getCornerStyle()}`;
      if (expectedThemeKey !== lastThemeKey || !document.documentElement?.hasAttribute('data-ag-prism')) {
        applyRootAttrs();
      }
      if (homeStudioCtl.wasHero() && cfg.homeLayout === 'studio') {
        homeStudioCtl.scheduleUsageRollupRefresh(1800);
      }
    }, nextMs);
  }

  let lifecycleStarted = false;
  function startLifecycle() {
    if (destroyed || lifecycleStarted || !document.documentElement) return;
    lifecycleStarted = true;
    flattenMainStyleSheet();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-expanded', 'data-selected', 'data-cascade-id', 'data-ag-prism-host-i18n'],
    });
    for (const [evName, handler] of DOC_LISTENERS) {
      document.addEventListener(evName, handler, true);
    }
    if (typeof window.addEventListener === 'function') {
      for (const [evName, handler, opts] of WIN_LISTENERS) {
        window.addEventListener(evName, handler, opts);
      }
      if (motionEngine && typeof motionEngine.bindMicroInteractions === 'function') {
        try {
          motionBinding = motionEngine.bindMicroInteractions(window);
        } catch {}
      }
    }

    syncMotionSpringTokens();
    restartPollTimer();
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) onWinBlur();

    ensureHooks(true);
    markAllDirty();
    runSync(true);
    if (homeStudioCtl.wasHero() && cfg.homeLayout === 'studio') {
      homeStudioCtl.scheduleUsageRollupRefresh(1800);
    }
  }

  const prismRuntimeApi = {
    brand: 'Obsidian Prism',
    version: VERSION,
    legacyApiVersion: LEGACY_API_VERSION,
    codeHash: CODE_HASH,
    flattenCss: flattenMainStyleSheet,
    saveSettingsBatch,
    refreshConfig(next) {
      if (next && typeof next === 'object') {
        const fromFile = Boolean(next.__fromFile);
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
    getState() {
      const convAura = convAuraCtl.getInstance();
      const auraConnected = Boolean(convAura && convAura.host && convAura.host.isConnected);
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
          codeFont: getCodeFont(),
          codeLigatures: isCodeLigaturesEnabled(),
          ambientIntensity: getAmbientIntensitySetting(),
          omniModule: getOmniMode(),
          linkTarget: getLinkTarget(),
          sidebarStudio: cfg.sidebarStudio === 'on' ? 'on' : 'off',
        },
        motionLevel: getMotionLevel(),
        lightPreset: getLightPreset(),
        hasThoughtModule: Boolean(window.__agPrismThought),
        hasOmniModule: Boolean(window.__agPrismOmni),
        hasSidebarStudio: Boolean(window.__agPrismSidebar),
        hasHostEnhancer: Boolean(hostEnhancerCtl && typeof hostEnhancerCtl.getDebugState === 'function'),
        usageRecordsCount: homeStudioCtl.getUsageRecordsCount(),
        hasPanel: homeStudioCtl.hasConnectedPanel(),
        hasRipple: Boolean(rippleMount && rippleMount.canvas.isConnected),
        rippleSleeping: Boolean(!rippleMount || rippleMount.sleeping),
        rippleAura: rippleMount ? { ...rippleMount.aura } : null,
        hasConvAura: auraConnected,
        convAuraPhase,
        convAuraSleeping: Boolean(!convAura || convAura.sleeping),
        convAuraDrawCount: convAura ? convAura.drawCount : 0,
        convAuraCanvasSize: convAura ? { width: convAura.width, height: convAura.height } : null,
        convAuraOptics: convAura && convAura.lastOptics ? { ...convAura.lastOptics } : null,
        hasCrab: Boolean(mascotState.root && mascotState.root.isConnected),
        hasDualRig: Boolean(mascotState.rig),
        hasSmoothCaret: Boolean(document.querySelector('.ag-cs-smooth-caret')),
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
          window[k]?.destroy?.();
        } catch {}
      }
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
      document.querySelectorAll('[data-ag-cs-placeholder]').forEach((el) => el.removeAttribute('data-ag-cs-placeholder'));
      document.querySelectorAll('[data-ag-cs-prism-box]').forEach((el) => {
        el.removeAttribute('data-ag-cs-prism-box');
        el.style.removeProperty('--ag-px');
        el.style.removeProperty('--ag-py');
      });
      document.querySelectorAll('[data-ag-cs-effort]').forEach((el) => {
        el.removeAttribute('data-ag-cs-effort');
        el.classList.remove('ag-cs-effort-badge');
      });
      document.querySelectorAll('[data-ag-cs-queued], [data-ag-cs-takeover]').forEach((el) => {
        el.removeAttribute('data-ag-cs-queued');
        el.removeAttribute('data-ag-cs-takeover');
        el.style.removeProperty('margin-bottom');
      });
      for (const attr of [
        'data-ag-cs-orch-active',
        'data-ag-cs-model-overlay',
        'data-ag-cs-overview-shell',
        'data-ag-cs-conv-seat',
        'data-ag-cs-vp-wrap',
        'data-ag-cs-home-sheet',
        'data-ag-cs-row-running',
        'data-ag-cs-menu-open',
        'data-has-sep',
        'data-ag-cs-auto-unfolded',
        'data-ag-cs-outer-open',
        'data-ag-cs-caustic',
        'data-ag-cs-fiber-camp',
        'data-ag-cs-sonar',
        'data-ag-cs-stage-glide',
        'data-ag-cs-liftoff-bubble',
        'data-ag-cs-thought-streaming',
        'data-ag-cs-spark-streaming',
        'data-ag-cs-prism-cv',
        'data-ag-cs-code-folded',
        'data-ag-cs-bg-cmd-wrap',
        'data-ag-cs-input-layer',
        'data-ag-cs-hdr-open',
        'data-ag-cs-rich-pre',
        'data-ag-cs-glide-item',
      ]) {
        document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
      }
      document
        .querySelectorAll(
          '#ag-prism-settings-v101-css, #ag-prism-omni-css, #ag-prism-motion-off-css, .ag-omni-dock, .ag-omni-menu, .ag-prism-omni-menu, .ag-prism-omni-pane, [data-ag-prism-omni-owned="1"], .ag-cs-liftoff-veil, .ag-cs-sidebar-glide-pill, .ag-cs-pill-glide, .ag-cs-conv-aura-host, .ag-cs-conv-glow, .ag-cs-prism-rim-cv, .ag-cs-code-fold-btn, .ag-cs-nav-outline-popover, .ag-cs-model-glyph, .ag-cs-panel-row-glyph, [data-testid="orchestrator-effort-bar"], .ag-cs-thinking-spark, .ag-cs-orbital-backdrop, .ag-cs-perf-backdrop, #' +
            SETTINGS_SEC_ID
        )
        .forEach((el) => el.remove());
      const html = document.documentElement;
      if (html) {
        for (const attr of [
          'data-ag-prism',
          'data-ag-cs-style',
          'data-ag-cs-theme',
          'data-ag-cs-palette',
          'data-ag-cs-light-preset',
          'data-ag-cs-motion',
          'data-ag-cs-target-fps',
          'data-ag-cs-telemetry',
          'data-ag-cs-effort-slider',
          'data-ag-cs-thought-translate',
          'data-ag-cs-home',
          'data-ag-cs-composer',
          'data-ag-cs-logo-ink',
          'data-ag-cs-sidebar',
          'data-ag-cs-sidebar-compact',
          'data-ag-cs-sidebar-collapsed',
          'data-ag-cs-has-crab',
          'data-ag-cs-lang',
          'data-ag-cs-cjk',
          'data-ag-cs-accent',
          'data-ag-cs-corners',
          'data-ag-cs-code-font',
          'data-ag-cs-ligatures',
          'data-ag-cs-ambient',
          'data-ag-prism-thought-view',
          'data-ag-prism-omni',
          'data-ag-prism-link-target',
          'data-ag-prism-sidebar-studio',
          'data-ag-prism-sidebar-host-sync',
          'data-ag-cs-win-blur',
        ]) {
          html.removeAttribute(attr);
        }
        if (html.style && typeof html.style.removeProperty === 'function') {
          html.style.removeProperty('--ag-spring-sidebar-ease');
          html.style.removeProperty('--ag-spring-sidebar-dur');
        }
      }
    },
  };

  window.__agPrism = prismRuntimeApi;
  window.__agClaudeStyle = prismRuntimeApi;

  if (document.documentElement) {
    startLifecycle();
  } else if (typeof document.addEventListener === 'function') {
    const onReady = () => {
      if (document.documentElement) {
        document.removeEventListener('readystatechange', onReady);
        document.removeEventListener('DOMContentLoaded', onReady);
        startLifecycle();
      }
    };
    document.addEventListener('readystatechange', onReady);
    document.addEventListener('DOMContentLoaded', onReady);
  }
});
