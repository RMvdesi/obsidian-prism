// Channel 1 运行时语种切片、增量 configRefresh 模板与主注入壳模板生成器
'use strict';

const fs = require('fs');
const path = require('path');
const { getFileSig } = require('../utils/fs-safe.cjs');
const {
  STYLE_ID,
  LEGACY_STYLE_ID,
  SETTING_BINDING,
  DEFAULT_CONFIG,
  isPerformanceModeExplicit,
  wasPerformanceModeAuto,
  reconcileConfigAliases,
} = require('../config/schema.cjs');
const { minifySingleSource } = require('./js-string-pool.cjs');

// Channel 1 自身实际消费的最小运行时 key 集（Omni / InlineDiff 均在各自独立通道内自带完整 8 语表，无需重复打入 Channel 1 bootCfg）
const CH1_RUNTIME_UI_KEYS = Object.freeze([
  'cacheRead', 'cacheShort', 'effortTitle', 'fiveHourLabel',
  'homeLocalOnlyTag', 'homeLocalScopeNote', 'homeScopeActive', 'homeScopeActiveCount', 'homeScopeAll', 'homeScopeArchivedCount',
  'kpiCacheHit', 'kpiCalls', 'kpiDays', 'kpiFavModel', 'kpiSessions', 'kpiTokens',
  'noModelUsage',
  'optHost', 'optLightAlabaster', 'optLightCrystal', 'optMotionOff', 'optMotionStandard', 'optMotionSubtle',
  'optMotionUltra', 'optObsidian', 'optThoughtBilingual', 'optThoughtImmersive', 'optWarm',
  'quotaEmptyHint', 'quotaJustNow', 'quotaLoading', 'quotaPoolsTitle', 'refreshBtnTitle', 'sessionsUnit',
  'showLess', 'sidebarLessLabel', 'sidebarMoreLabel', 'studioPlaceholder', 'subagentsUnit', 'swarmBadge',
  'tabModels', 'tabOverview', 'tabQuotas', 'thinkingEllipsis', 'tokenUnit', 'tokensInShort', 'tokensOutShort',
  'weeklyLabel', 'workspaceAll', 'workspaceFilterAria',
]);

function normalizeLangIdNode(rawLang, fallback = 'en') {
  const raw = typeof rawLang === 'string' ? rawLang.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!raw || raw === 'auto') return fallback;
  if (raw === 'en' || raw.startsWith('en-') || raw === 'english') return 'en';
  if (raw === 'ja' || raw.startsWith('ja-') || raw === 'jp' || raw === 'japanese') return 'ja';
  if (raw === 'ko' || raw.startsWith('ko-') || raw === 'kr' || raw === 'korean') return 'ko';
  if (raw === 'es' || raw.startsWith('es-') || raw === 'spanish') return 'es';
  if (raw === 'fr' || raw.startsWith('fr-') || raw === 'french') return 'fr';
  if (raw === 'de' || raw.startsWith('de-') || raw === 'german') return 'de';
  if (raw === 'tr' || raw.startsWith('tr-') || raw === 'turkish' || raw === 'türkçe' || raw === 'turkce') return 'tr';
  if (raw === 'yue' || raw.startsWith('yue-') || raw === 'zh-yue' || raw.includes('cantonese')) return 'zh-CN';
  if (raw === 'zh-tw' || raw === 'zh-hk' || raw.startsWith('zh-hk-') || raw === 'zh-mo' || raw === 'zh-hant' || raw.startsWith('zh-hant-') || raw === 'tw' || raw === 'hant') return 'zh-TW';
  if (raw === 'zh' || raw === 'zh-cn' || raw === 'zh-hans' || raw.startsWith('zh-')) return 'zh-CN';
  return fallback;
}

function extractSingleLangRuntimeSlice(mod, langId) {
  if (!mod) return {};
  const src =
    typeof mod.getRuntimeUiSlice === 'function'
      ? mod.getRuntimeUiSlice(langId)?.strings
      : typeof mod.getUiStrings === 'function'
        ? mod.getUiStrings(langId)
        : null;
  if (!src || typeof src !== 'object') return {};
  const out = {};
  for (let i = 0; i < CH1_RUNTIME_UI_KEYS.length; i++) {
    const k = CH1_RUNTIME_UI_KEYS[i];
    if (typeof src[k] === 'string') out[k] = src[k];
  }
  return out;
}

function createCh1Templates({
  rootDir = path.resolve(__dirname, '..', '..'),
  pluginVersion,
  readConfig,
  resolveCurrentBundleCodeHash,
  detectSystemUiLocale,
}) {
  let _localesFreshCache = { sig: '', mod: null };
  let _diskPerfCache = { sig: '', exists: false, explicit: false, isAuto: false };
  let _configRefreshTemplate = '';
  let _injectWrapperTemplate = null;
  const DEFAULT_KEY_COUNT = Object.keys(DEFAULT_CONFIG).length;

  function readDiskPerfExplicitState() {
    const cfgPath = path.join(rootDir, 'config.json');
    try {
      const st = fs.statSync(cfgPath);
      if (!st.isFile()) {
        _diskPerfCache = { sig: '', exists: false, explicit: false, isAuto: false };
        return _diskPerfCache;
      }
      const sig = `${st.mtimeMs}:${st.size}:${st.ctimeMs}`;
      if (_diskPerfCache.sig === sig) return _diskPerfCache;
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const explicit = isPerformanceModeExplicit(raw);
      const isAuto = Boolean(
        raw &&
          typeof raw === 'object' &&
          !Array.isArray(raw) &&
          typeof raw.performanceMode === 'string' &&
          raw.performanceMode.trim().toLowerCase() === 'auto'
      );
      _diskPerfCache = { sig, exists: true, explicit, isAuto };
      return _diskPerfCache;
    } catch {
      _diskPerfCache = { sig: '', exists: false, explicit: false, isAuto: false };
      return _diskPerfCache;
    }
  }

  // 返回 0=显式锁定，1=缺省未设置（低配机自动默认 performance，但尊重用户手动偏好），2=显式设为 auto
  function resolvePerfModeAutoTag(config, rawInput = undefined) {
    if (rawInput !== undefined) {
      if (rawInput === null) {
        const disk = readDiskPerfExplicitState();
        return disk.explicit ? 0 : disk.isAuto ? 2 : 1;
      }
      if (typeof rawInput === 'object' && !Array.isArray(rawInput)) {
        if (rawInput.perfModeExplicit === true || rawInput.perfModeAuto === false) return 0;
        if (rawInput.perfModeAuto === true) return 1;
        if (!Object.prototype.hasOwnProperty.call(rawInput, 'performanceMode')) return 0;
        if (isPerformanceModeExplicit(rawInput)) return 0;
        const rv = typeof rawInput.performanceMode === 'string' ? rawInput.performanceMode.trim().toLowerCase() : '';
        return rv === 'auto' ? 2 : 1;
      }
      return 0;
    }
    if (!config || typeof config !== 'object') {
      const disk = readDiskPerfExplicitState();
      return disk.explicit ? 0 : disk.isAuto ? 2 : 1;
    }
    if (config.perfModeExplicit === true || config.perfModeAuto === false) return 0;
    if (config.perfModeAuto === true) return 1;
    if (wasPerformanceModeAuto(config)) return 2;
    if (!Object.prototype.hasOwnProperty.call(config, 'performanceMode')) return 1;
    const raw = typeof config.performanceMode === 'string' ? config.performanceMode.trim().toLowerCase() : '';
    if (!raw) return 1;
    if (raw === 'auto') return 2;
    if (raw !== 'balanced') return 0;
    // performanceMode === 'balanced'：区分「磁盘无显式配置由 readConfig() 补全的全量默认对象」与「调用方显式指定 balanced」
    const keyCount = Object.keys(config).length;
    if (keyCount < DEFAULT_KEY_COUNT) return 0;
    const disk = readDiskPerfExplicitState();
    return disk.explicit ? 0 : disk.isAuto ? 2 : 1;
  }

  function loadLocalesModuleFresh() {
    const locPath = path.join(rootDir, 'i18n-locales.js');
    if (!fs.existsSync(locPath)) return null;
    try {
      const sig = getFileSig(locPath);
      if (_localesFreshCache.sig === sig && _localesFreshCache.mod) {
        return _localesFreshCache.mod;
      }
      try { delete require.cache[require.resolve(locPath)]; } catch {}
      const mod = require(locPath);
      _localesFreshCache = { sig, mod };
      return mod;
    } catch {
      return null;
    }
  }

  function resolveSystemLangNode(hostLocaleHint = null) {
    const sysLocale = hostLocaleHint || detectSystemUiLocale();
    const stripped = String(sysLocale || '').trim().split(/[.@]/)[0];
    return normalizeLangIdNode(stripped, 'en');
  }

  // 为 Channel 1 bootCfg 生成当前活跃语言（及 auto 模式下的 en 兜底）迷你运行时词典（列式编码消除双语重复键名）
  function buildRuntimeUiSlicePayload(config) {
    const mod = loadLocalesModuleFresh();
    if (!mod) return null;
    const rawLang = (config && (config.language || config.lang)) || 'auto';
    const isAuto = String(rawLang).trim().toLowerCase() === 'auto';
    const primary = isAuto ? resolveSystemLangNode() : normalizeLangIdNode(rawLang, 'en');
    const pObj = extractSingleLangRuntimeSlice(mod, primary);
    const enObj = isAuto && primary !== 'en' ? extractSingleLangRuntimeSlice(mod, 'en') : null;
    const keys = CH1_RUNTIME_UI_KEYS.filter((k) => typeof pObj[k] === 'string' || typeof enObj?.[k] === 'string');
    const vals = { [primary]: keys.map((k) => pObj[k] ?? '') };
    if (enObj) vals.en = keys.map((k) => enObj[k] ?? '');
    const pmAuto = resolvePerfModeAutoTag(config);
    return pmAuto ? { active: primary, keys, vals, pmAuto } : { active: primary, keys, vals };
  }

  function getConfigRefreshTemplate() {
    if (_configRefreshTemplate) return _configRefreshTemplate;
    const rawTpl = `(() => {
      const cfg = __AG_REF_CFG__, W = window, D = document, G = globalThis;
      const api = W.__agPrism || W.__agClaudeStyle;
      if (api && api.version === __AG_REF_VER__ && api.codeHash === __AG_REF_HASH__ && typeof api.refreshConfig === 'function') {
        const off = (v) => v === 'off' || v === false, T = (f) => { try { f(); } catch {} };
        if (cfg.__pmAuto) T(() => (W.__agDomBus || G.__agDomBus)?.resolveAutoBootPerfMode?.(cfg, W));
        if (api.refreshConfig(cfg) === false) return { refreshed: true, skippedStale: true, version: api.version };
        const e = api.getState?.()?.cfg || cfg, de = D.documentElement;
        const qa = (s) => D.querySelectorAll?.(s) || [];
        const rm = (s) => qa(s).forEach((n) => n.remove?.());
        const ra = (s) => de && s.split(',').forEach((a) => de.removeAttribute?.(a));
        const P = (k) => W['__agPrism' + k];
        const dw = (s, p = '') => s.split(',').forEach((k) => { T(() => delete W[p + k]); T(() => delete G[p + k]); });
        T(() => (off(e?.telemetryModule) ? (api.detachTelemetry?.(), P('Telemetry')?.destroy?.()) : (P('Telemetry')?.sync?.(e), api.syncTelemetry?.())));
        T(() => (off(e?.effortSliderModule) ? P('EffortSlider')?.destroy?.() : P('EffortSlider')?.sync?.(e)));
        if (off(e?.contextMenu)) T(() => P('ContextMenu')?.destroy?.());
        T(() => P('Thought')?.sync?.(e));
        T(() => P('InlineDiff')?.sync?.(e));
        T(() => (e?.omniModule === 'off' ? P('Omni')?.destroy?.() : P('Omni')?.sync?.(e, P('OmniServerMeta') || null)));
        if (e?.sidebarStudio !== 'on') {
          T(() => { P('Sidebar')?.sync?.(e, P('SidebarMeta') || null); P('Sidebar')?.destroy?.(); delete W.__agPrismSidebar; });
          T(() => ra('data-ag-prism-mode,data-ag-prism-chat-kind,data-ag-prism-chat-telemetry,data-ag-cs-space,data-ag-cs-space-palette,data-ag-cs-space-accent'));
        } else T(() => P('Sidebar')?.sync?.(e, P('SidebarMeta') || null));
        T(() => {
          const m = e?.hostLocalization, l = e?.language, hi = W.__agPrismHostI18n;
          const navL = String((typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || '').trim();
          if (m === 'off' || m === 'on') hi?.setMode?.(m);
          else if ((l && l !== 'zh-CN' && l !== 'tr' && l !== 'auto') || ((!l || l === 'auto') && navL && !/^(?:zh(?:$|-(?:cn|hans|sg)(?:-|$))|tr(?:$|-))/i.test(navL))) hi?.destroy?.();
          else hi?.setMode?.('auto');
        });
        if (off(e?.mascot)) {
          T(() => W.__agDualMascotRig?.dispose?.()); T(() => api.sync?.());
          T(() => qa('.ag-cs-crab,.ag-cs-dual-stage,.ag-cs-crab-stage,.ag-cs-mascot-stage,.ag-v2-mascot-stage,.ag-v2-habitat-prop').forEach((n) => { T(() => n.__agMascotApi?.dispose?.()); n.remove?.(); }));
          T(() => qa('[data-ag-cs-crab-anchor]').forEach((n) => n.removeAttribute?.('data-ag-cs-crab-anchor')));
          ra('data-ag-cs-has-crab,data-ag-cs-mascot-drag');
          dw('__agDualMascotRig,__agPrismMascotArt');
        }
        if (e?.homeLayout && e.homeLayout !== 'studio') {
          T(() => {
            api.detachHomeStudio?.(); D.getElementById?.('ag-prism-studio-v101-css')?.remove?.();
            rm('.ag-cs-home-panel-seat,.ag-cs-home-panel'); ra('data-ag-prism-scope');
            dw('__agPrismHomeStudioPanel,__agHomeStudioPanel');
          });
        }
        if (off(e?.periodicModelPicker)) {
          T(() => {
            P('PeriodicStub')?.destroy?.();
            P('PeriodicPicker')?.destroy?.();
            ra('data-ag-prism-periodic-picker,data-ag-pp-open,data-ag-pp-holding');
            rm('#ag-prism-periodic-stub-css,#ag-prism-periodic-picker-css,#ag-prism-periodic-picker-root,.ag-pp-hold-ring,.ag-pp-mini-keycap');
            dw('PeriodicStub,PeriodicStubFactory,PeriodicPicker,PeriodicPickerFactory,Keyboard3D,PeriodicKeyboard3D,OledScreen,GrainAssets', '__agPrism');
            dw('PendingOpen,FullLoaded,StubHash,AudioFx,ModelCatalog,HostBridge,BentoUi,PbrGrainAssets,OledScreen,Keyboard3D', '__agPeriodic');
          });
        }
        T(() => P('ProjectPartitions')?.[e?.projectPartitions === 'on' || e?.projectPartitions === true ? 'sync' : 'destroy']?.(e));
        if (de) {
          if (e?.thoughtTranslate && e.thoughtTranslate !== 'off') de.setAttribute('data-ag-prism-thought-view', e.thoughtView === 'bilingual' ? 'bilingual' : 'immersive');
          else de.removeAttribute('data-ag-prism-thought-view');
          de.setAttribute('data-ag-prism-sidebar-studio', e?.sidebarStudio === 'on' ? 'on' : 'off');
        }
        T(() => {
          const pm = e?.performanceMode;
          if (P('DomBus')?.applyPerformanceMode) P('DomBus').applyPerformanceMode(pm, D, W);
          else if (de && pm) de.setAttribute('data-ag-cs-perf-mode', pm === 'eco' ? 'performance' : pm === 'auto' ? 'balanced' : pm);
          P('ApplyIgnoreReducedMotion')?.(!!e?.ignoreReducedMotion);
          P('FontCustomizer')?.applyCustomFonts?.(e, D);
        });
        T(() => P('CustomStyle')?.sync?.(e, null, D));
        return { refreshed: true, version: api.version };
      }
      return { refreshed: false };
    })()`;
    _configRefreshTemplate = minifySingleSource(rawTpl);
    return _configRefreshTemplate;
  }

  function buildConfigRefreshExpression(customConfig, extraMeta = null) {
    const config = customConfig ? reconcileConfigAliases(customConfig) : readConfig();
    const codeHash = resolveCurrentBundleCodeHash();
    const hasExplicitLang = !customConfig || Object.prototype.hasOwnProperty.call(config, 'language') || Object.prototype.hasOwnProperty.call(config, 'lang');
    const uiSlice = hasExplicitLang ? buildRuntimeUiSlicePayload(config) : null;
    const pmAuto = resolvePerfModeAutoTag(config, customConfig ? customConfig : null);
    const bootCfg = {
      ...config,
      ...(uiSlice ? { __uiSlice: uiSlice } : {}),
      ...(pmAuto ? { __pmAuto: pmAuto } : {}),
      ...(extraMeta && typeof extraMeta === 'object' ? extraMeta : {}),
      binding: SETTING_BINDING,
      codeHash,
      __fromFile: true,
    };
    return getConfigRefreshTemplate()
      .replace('__AG_REF_CFG__', () => JSON.stringify(bootCfg))
      .replace('__AG_REF_VER__', () => JSON.stringify(pluginVersion))
      .replace('__AG_REF_HASH__', () => JSON.stringify(codeHash));
  }

  function getInjectWrapperTemplate() {
    if (_injectWrapperTemplate) return _injectWrapperTemplate;
    // 主注入壳模板：含加载期一次性顶层 subject :is(...) 展开器（Refs: #151，带上限与 fail-open）、
    // adoptedStyleSheets 管理器、Repo/Thought/Usage 侧车桥接及宿主窗口守卫
    const rawTpl = `(() => {
      const W = window, D = document, G = globalThis;
      const f = (v) => typeof v == 'function', S = (v) => typeof v == 'string', O = (v) => !!(v && typeof v == 'object');
      const T = (x) => { try { return x(); } catch {} }, p = (s) => s.split(','), j = (s, h) => p(s).map(h);
      const g = (i) => D.getElementById?.(i), Q = (s) => D.querySelectorAll?.(s) || [], q = (s) => T(() => D.querySelector(s));
      const V = ${JSON.stringify(pluginVersion)}, I = ${JSON.stringify(STYLE_ID)}, L = ${JSON.stringify(LEGACY_STYLE_ID)}, U = 'Sidecar daemon offline';
      const X = (s) => {
        if (!S(s) || !s.includes(':is(')) return s;
        try {
          const C = ' >+~', R = (t, h) => {
            for (let i = 0, d = 0, k = '', c; i < t.length; i++)
              if ((c = t[i]) == '\\\\') i++;
              else if (k) c == k && (k = '');
              else if (c == '"' || c == "'") k = c;
              else if (h(c, i, d += '(['.includes(c) ? 1 : ')]'.includes(c) && d ? -1 : 0) === 0) return 0;
            return 1;
          };
          const K = (t) => { const o = []; let a = 0; R(t + ',', (c, i, d) => { !d && c == ',' && ((c = t.slice(a, i).trim()) && o.push(c), a = i + 1); }); return o; };
          const Y = (z, h) => { const o = []; for (const v of z) for (const y of h(v)) if (o.push(y) > 400) return; return o; };
          const E = (t, i0, n) => {
            if (n > 9 || !t.includes(':is(', i0)) return [t];
            let b = '', a = -1, e = -1, u = 0;
            R(t, (c, i, d) => {
              if (!d && C.includes(c)) b = '', a = e = -1, u = 0;
              else if (a >= 0 && e < 0) !d && c == ')' && (e = i);
              else if (c == '[' && d == 1) u = 1;
              else if (a < 0 && i >= i0 && c == '(' && d == 1 && t.slice(i - 3, i) == ':is' && t[i - 4] != ':') a = i - 3;
              else !d && !')]'.includes(c) && (b += c);
            });
            if (u || a < 0 || e < 0 || /[#.]|^[a-z]/i.test(b.replace(/::?[\\w-]+/g, ''))) return [t];
            const l = t.slice(0, a), r = t.slice(e + 1), z = K(t.slice(a + 4, e));
            if (!z.length || z.length > 48 || z.some((v) => /:-(?:moz|ms|o)-/i.test(v) || (r && r[0] != ':' && /::|:(?:before|after|first-l)/i.test(v)) || (!R(v, (c, _, d) => d || !C.includes(c)) ? (l.trim() && (!/\\s$/.test(l) || /^(?:html|:root|body)(?![\\w-])/i.test(v))) || (r && !' >+~.:[#'.includes(r[0])) : l && !/[\\s>+~(,]$/.test(l) && /^[\\w*-]/.test(v)))) return E(t, e + 1, n);
            return Y(z, (v) => E(l + v + r, 0, n + 1)) || [t];
          };
          let o = '', a = 0, k = 0, m = 0;
          const w = (i) => { o += s.slice(a, i + 1); a = i + 1; };
          R(s, (c, i, d) => {
            if (d) return;
            if (k) { c == '{' ? k++ : c == '}' && !--k && w(i); return; }
            if (c == ';' || c == '}') w(i);
            else if (c == '{') {
              let h = s.slice(a, i), t = h.trim();
              if (!/^@(?:media|sup|con|lay|st|sc)/i.test(t)) {
                k = 1;
                const x = t[0] != '@' && m < 4000 && h.includes(':is(') && Y(K(h), (u) => E(u, 0, 0));
                x && (m += x.length, h = x.join(','));
              }
              o += h + '{', a = i + 1;
            }
          });
          return o + s.slice(a);
        } catch { return s; }
      };
      let _ = null;
      const H = () => (_ ??= X(__AG_INJ_CSS__)), A = () => W.__agPrism || W.__agClaudeStyle, M = () => W.__agPrismCssMgr;
      const K = () => {
        T(() => g(L)?.remove());
        T(() => { const o = W.__agClaudeStyle; if (o && (!W.__agPrism || Number(o.version) <= 2)) { f(o.destroy) && o.destroy(); delete W.__agClaudeStyle; } });
      };
      const E = () => {
        const k = __AG_INJ_CSSHASH__, v = M();
        if (v && v.cssHash == k && !v._disposed) return v;
        T(() => v?.destroy?.());
        const c = H(), C = W.CSSStyleSheet || (f(G.CSSStyleSheet) ? G.CSSStyleSheet : null), B = 'data-ag-cs-adopted';
        const u = () => f(D.adoptedStyleSheets?.[Symbol.iterator]), a = () => !!T(() => C && f(C.prototype?.replaceSync) && u()), l = () => Array.from(D.adoptedStyleSheets);
        let h = null;
        const d = () => { h && u() && T(() => { D.adoptedStyleSheets = l().filter((s) => s != h); }); };
        const y = (t, z) => {
          const r = D.head || D.documentElement; if (!r) return;
          let s = g(I); if (!s) { s = D.createElement('style'); s.id = I; }
          const w = (x, v) => { s.getAttribute?.(x) != v && s.setAttribute?.(x, v); };
          z ? (s.textContent && (s.textContent = ''), w(B, '1')) : (s.hasAttribute?.(B) && s.removeAttribute?.(B), s.textContent != t && (s.textContent = t));
          w('data-ag-cs-css-hash', k); w('data-ag-cs-flat', k + ':' + (z ? 0 : t.length));
          (s.parentNode != r || (!z && r.lastElementChild != s)) && r.appendChild(s);
        };
        const m = {
          cssHash: k, singlePack: !0, _disposed: !1,
          sync() {
            if (m._disposed) return m;
            const z = a(); m.mode = z ? 'adopted' : 'style'; m.activeKeys = ['all']; m.activeBytes = c.length;
            if (z) {
              if (!h) { h = new C(); h.replaceSync(c); }
              const x = l(); x.includes(h) || (D.adoptedStyleSheets = x.concat(h));
              y('', !0);
            } else d(), y(c, !1);
            return m;
          },
          destroy(o) {
            if (m._disposed) return;
            m._disposed = !0; d(); h = null; m.activeKeys = []; m.activeBytes = 0;
            T(() => { const s = g(I); s && (o?.keepStyleNode ? (s.textContent = '') : s.remove?.()); });
          },
        };
        return (W.__agPrismCssMgr = G.__agPrismCssMgr = m);
      };
      const N = () => { (D.head || D.documentElement) && (K(), E().sync(), T(() => { M()?.mode != 'adopted' && W.__agPrism?.flattenCss?.(); })); };
      const J = (a) => {
        if (!a || a.__agCssMgrHooked) return;
        a.__agCssMgrHooked = !0;
        const o = M(), d = f(a.destroy) && a.destroy.bind(a);
        if (d) a.destroy = (...x) => { T(() => { const m = M(); m && !m._hold && (!o || m == o) && m.destroy?.(); }); return d(...x); };
      };
      const F = (x) => ({ ok: !1, ...x }), P = (v) => Promise.resolve(v), Z = F({ disposed: !0 }), Y = (e) => F({ error: e });
      const R = (k, n, t, e = Y, z = Z) => {
        const d = new Map(); let i = 0;
        const s = (m, w, x, b) => new Promise((r) => {
          if (!b && d.size >= n) return r(e('busy', 1));
          const c = ++i, v = x ? { r, t: null, ...x } : { r, t: null };
          v.a = (u = w) => { clearTimeout(v.t); v.t = setTimeout(() => { d.delete(c); r(t()); }, u); };
          v.a(); d.set(c, v);
          try { W[k](JSON.stringify(m(c))); } catch (u) { clearTimeout(v.t); d.delete(c); r(e(String(u?.message || u), 0)); }
        });
        const resolve = (c, r) => { const v = d.get(c); if (v) { clearTimeout(v.t); d.delete(c); v.r(r); } };
        const dispose = () => { for (const v of d.values()) { clearTimeout(v.t); v.r(z); } d.clear(); };
        return { d, s, resolve, b: { __prismBridgeReady: !0, resolve, dispose } };
      };
      const B = () => {
        const w = (x, b, r) => { W['__agPrism' + x + 'Bridge'] = b; W['__agPrism' + x + 'Resolve'] = r; };
        T(() => {
          if (W.__agPrismRepoBridge?.__prismBridgeReady) return;
          const k = '__agPrismRepoCall', t = 'status', c = R(k, 8, () => F({ timeout: !0, noRemote: !0, hasRemote: !1 }));
          const n = (v) => {
            const o = S(v) ? { action: v } : O(v) ? { ...v } : { action: t }, a = o.action || t;
            return f(W[k]) ? c.s((i) => ({ id: i, action: a, input: o }), 16000).then((r) => (r && !r.action ? { ...r, action: a } : r)) : P(F({ offline: !0, action: a, isGitRepo: !1, noRemote: !0, hasRemote: !1, branch: 'local', commit: V, shortHash: V, remoteUrl: '', hasUpdates: !1, upToDate: !0, updated: !1, message: U }));
          };
          const l = () => n({ action: 'pull' });
          Object.assign(n, c.b, { call: n, request: n, status: () => n({ action: t }), pull: l, sync: l });
          w('Repo', n, c.resolve);
        });
        T(() => {
          const u = W.__agPrismThoughtBridge;
          if (u?.__prismBridgeReady && f(u.cacheStats) && f(u.cancelTranslate)) return;
          T(() => u?.dispose?.());
          const k = '__agPrismThoughtCall', l = p('cancel-translate,cache-stats,clear-cache'), c = R(k, 64, () => F({ timeout: !0, error: 'Request timed out' }));
          const r = (o, h, d = 48000) => {
            const a = o?.action || 'get-config';
            return f(W[k]) ? c.s((i) => ({ id: i, action: a, input: o }), d, h ? { h, b: '' } : null, l.includes(a)).then((x) => (x && !x.action && !x.ok ? { ...x, action: a } : x)) : P(F({ offline: !0, action: a, error: U }));
          };
          const e = (o) => r(o, null, 8000), b = {
            ...c.b,
            call: (i) => r(O(i) ? { ...i } : { action: String(i || '') }, null, 25000),
            translateStream: (o, h) => r({ ...(O(o) ? o : {}), action: 'translate-stream', text: o?.text || '', mode: o?.mode || 'ai' }, h, Math.min(180000, 90000 + Math.max(0, c.d.size - 2) * 30000)),
            cancelTranslate: (v) => e(O(v) ? { ...v, action: l[0] } : { action: l[0], requestId: v, key: v }),
            cacheStats: () => e({ action: l[1] }),
            clearCache: () => e({ action: l[2] }),
            onChunk: (i, h) => {
              const t = c.d.get(i); if (!t || !f(t.h)) return;
              let x = null;
              if (S(h)) t.b = x = h;
              else if (O(h) && S(h.a)) { const s = S(t.b) ? t.b : ''; if ((h.o | 0) == s.length) t.b = x = s + h.a; }
              x !== null && (T(() => t.a?.(60000)), T(() => t.h(x)));
            },
          };
          w('Thought', b, c.resolve); W.__agPrismThoughtOnChunk = b.onChunk;
        });
        T(() => {
          const u = W.__agPrismUsageBridge;
          if (u?.__prismBridgeReady && f(u.listSummaries)) return;
          T(() => u?.dispose?.());
          const k = '__agPrismUsageCall', z = (x) => F({ records: [], summaries: [], ...x });
          const c = R(k, 12, () => z({ timeout: !0 }), (e, b) => z(b ? { busy: !0 } : { error: e }), z({ disposed: !0 }));
          const r = (o, d = 18000) => (f(W[k]) ? c.s((i) => ({ id: i, ...o }), d) : P(z({ offline: !0 })));
          const y = Array.isArray, b = {
            ...c.b, isOnline: () => f(W[k]),
            fetchBatch: (o, d = 18000) => { const q = O(o) && !y(o), a = q ? o.items : o; return r({ action: (q && o.action) || 'fetch-batch', items: y(a) ? a : [], ...(q ? { includeSummaries: !!o.includeSummaries } : {}) }, d); },
            listSummaries: (d = 12000) => r({ action: 'list-summaries', items: [], includeSummaries: !0 }, d),
          };
          w('Usage', b, c.resolve);
        });
      };
      const m = (e) => {
        T(() => W.__agPrismRippleWorker?.disposeAll?.());
        j('__agPrismTelemetry,__agPrismEffortSlider,__agPrismThought,__agPrismOmni,__agPrismContextMenu' + (e ? ',' + e : ''), (k) => T(() => W[k]?.destroy?.()));
      };
      const s = () => {
        m('__agPrism,__agPrismInlineDiff,__agPrismHostI18n,__agPrismPeriodicStub,__agPrismPeriodicPicker,__agPrismProjectPartitions,__agPrismCssMgr');
        T(() => {
          const e = D.documentElement;
          j('data-ag-prism-host-i18n,data-ag-prism-periodic-picker,data-ag-pp-open,data-ag-cs-model-menu', (a) => e?.removeAttribute?.(a));
          j('data-ag-cs-aux-dual,data-ag-cs-model-overlay', (a) => Q('[' + a + ']').forEach((n) => n.removeAttribute(a)));
          Q('[data-testid="prism-thought-ai-config"],[data-testid="prism-thought-general-config"],.ag-cs-ctx-menu,.ag-cs-ctx-toast,.ag-cs-inline-diff-box,.ag-cs-diff-ctx-menu,.ag-pp-hold-ring,.ag-pp-mini-keycap').forEach((n) => n.remove());
        });
        j('__agPrismRepoBridge,__agPrismThoughtBridge,__agPrismUsageBridge,__agPrismOmniBridge', (k) => T(() => W[k]?.dispose?.()));
        [I, L, ...p('ag-prism-settings-v101-css,ag-prism-studio-v101-css,ag-prism-omni-css,ag-prism-inline-diff-css,ag-prism-periodic-stub-css,ag-prism-periodic-picker-css')].map((i) => T(() => g(i)?.remove()));
        j('__agPrismCssMgr,__agPrismPeriodicStub,__agPrismPeriodicStubFactory,__agPeriodicPendingOpen,__agPeriodicFullLoaded,__agPeriodicStubHash,__agPrismThought,__agPrismThoughtSettingsUi,__agPrismInlineDiff,__agPrismInlineDiffFactory,__agPrismInlineDiffResolve,__agPrismOmni,__agPrismContextMenu,__agPrism,__agClaudeStyle', (k) => { delete W[k]; delete G[k]; });
        j(',Factory,Ui,Host', (x) => { const k = '__agPrismProjectPartitions' + x; delete W[k]; delete G[k]; });
      };
      const r = () => String(D.readyState || '');
      const h = () => T(() => {
        const a = S(W.location?.href) ? W.location.href : ''; if (!a) return 'ok';
        const l = a.toLowerCase(), t = String(D.title || ''), x = 'reject', k = 'ok';
        if (/^(?:devtools:\\/\\/|(?:data|chrome(?:-extension)?|edge|blob|plugin):)/.test(l)) return x;
        if (/^(?:vscode-file|app):\\/\\/|^about:/.test(l)) return /^(?:untitled|launchpad)$/i.test(t.trim()) || /\\/launchpad(?:\\.html)?(?:[?#]|$)/.test(l) ? x : k;
        const z = /^(https?):\\/\\/(127\\.0\\.0\\.1|localhost|\\[::1\\])(?::\\d+)?(\\/[^?#]*)?(?:[?#]|$)/.exec(l);
        if (!z) return /^https?:/.test(l) ? x : k;
        if (/^\\/(?:viewer|sandbox|stream|api)(?:\\/|$)/.test(z[3] || '/')) return x;
        const c = D.body?.classList;
        if (T(() => (c && (c.contains('theme-standalone') || c.contains('monaco-workbench'))) || q('.agy-shell,.agy-home,[data-testid="aux-pane-split"],[data-testid="conversation-view"],[data-testid="agent-input-box"],[data-testid="model-selector-trigger"],.monaco-workbench'))) return k;
        const y = r();
        return z[1].length < 5 ? (y == 'loading' ? 'defer' : x) : (/\\bantigravity\\b/i.test(t) || y != 'complete' ? k : x);
      }) || 'ok';
      let t = 'ok', n = 0;
      const e = (a, b, c) => D.addEventListener(a, b, c), d = 'DOMContentLoaded', o = { once: !0 };
      const u = () => {
        const a = D.documentElement;
        if (n || !a) return;
        const v = h();
        if (v == 'reject') { t = 'skipped-non-host'; s(); return; }
        if (v == 'defer') { t = 'deferred'; e(d, u, o); return; }
        n = 1;
        r() != 'complete' && W.addEventListener?.('load', () => { h() == 'reject' && s(); }, o);
        try {
          K(); B();
          const b = __AG_INJ_BOOTCFG__;
          D.head ? N() : e(d, N, o);
          const w = A(), y = () => T(() => (W.__agDomBus || G.__agDomBus)?.resolveAutoBootPerfMode?.(b, W));
          if (w && w.version == V && w.codeHash == __AG_INJ_CODEHASH__) { y(); w.refreshConfig(b); }
          else {
            m(); T(() => Q('[data-ag-prism-fallback="1"]').forEach((x) => x.remove()));
            __AG_INJ_BUNDLE__(); y();
            const k = M(); if (k) k._hold = 1;
            try { f(G.__agCsUiMain) && G.__agCsUiMain(b); } finally { if (k) k._hold = 0; }
            const i = M(); (i?._disposed || (D.head && !i)) && N();
          }
          let z = W.__agPrism;
          z ? (W.__agClaudeStyle = z) : W.__agClaudeStyle && (z = W.__agPrism = W.__agClaudeStyle);
          J(z);
          const c = (f(z?.getState) ? z.getState()?.cfg : null) || b;
          T(() => M()?.sync?.());
          const x = W.__agPrismOmni;
          T(() => (c?.omniModule == 'off' ? x?.destroy?.() : x?.sync?.(c, W.__agPrismOmniServerMeta || null)));
          a.hasAttribute('data-ag-prism') || a.setAttribute('data-ag-prism', V);
          c?.thoughtTranslate && c.thoughtTranslate != 'off' ? a.setAttribute('data-ag-prism-thought-view', c.thoughtView == 'bilingual' ? 'bilingual' : 'immersive') : a.removeAttribute('data-ag-prism-thought-view');
        } catch (x) {
          t = 'error: ' + (x?.message || String(x));
          T(() => console.error('[obsidian-prism] init error:', x));
        }
      };
      if (D.documentElement) u();
      else {
        t = 'deferred';
        const c = 'readystatechange', x = () => { if (D.documentElement) { D.removeEventListener(c, x); D.removeEventListener(d, x); u(); } };
        e(c, x); e(d, x);
      }
      return { version: V, status: t, codeHash: A()?.codeHash || __AG_INJ_CODEHASH__ };
    })()`;
    _injectWrapperTemplate = minifySingleSource(rawTpl);
    return _injectWrapperTemplate;
  }

  return {
    CH1_RUNTIME_UI_KEYS,
    normalizeLangIdNode,
    resolveSystemLangNode,
    loadLocalesModuleFresh,
    resolvePerfModeAutoTag,
    buildRuntimeUiSlicePayload,
    getConfigRefreshTemplate,
    buildConfigRefreshExpression,
    getInjectWrapperTemplate,
  };
}

module.exports = {
  CH1_RUNTIME_UI_KEYS,
  normalizeLangIdNode,
  extractSingleLangRuntimeSlice,
  createCh1Templates,
};
