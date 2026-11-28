(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory;
else root.__agCsUiMain = factory;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (initialConfig) {
const VERSION = '1.0.8-beta.6';
const D = document, W = window, GT = globalThis, ST = setTimeout, CT = clearTimeout, O = Object, AF = Array.from, isA = Array.isArray, M = Math, mx = M.max, mn = M.min, rd = M.round, SJ = JSON.stringify, LS = typeof localStorage !== 'undefined' ? localStorage : null;
const cT = (t) => { if (t) CT(t); return 0; }, dNow = () => Date.now(), pNow = () => performance.now();
const rAF = (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : 0), cAF = (id) => { if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id); return 0; };
const LEGACY_API_VERSION = 3;
const CODE_HASH = initialConfig?.codeHash || '';

const safe = (fn) => { try { return fn?.(); } catch {} };
safe(() => W.__agTokenHud?.destroy?.()); delete W.__agTokenHud;
const existingRuntime = W.__agPrism || W.__agClaudeStyle;
if (existingRuntime && existingRuntime.version === VERSION && (!CODE_HASH || existingRuntime.codeHash === CODE_HASH)) { existingRuntime.refreshConfig(initialConfig); return; }
const gCln = () => GT.__agCsCleanups;
while (gCln()?.length) safe(() => gCln().pop()?.());
if (W.__agClaudeStyle === W.__agPrism) delete W.__agClaudeStyle;
for (const k of ['__agPrism', '__agClaudeStyle', '__agCsI18n']) { safe(() => W[k]?.destroy?.()); delete W[k]; }

const gMod = (k) => GT[k] || W[k] || null, wMod = (k) => W[k] || GT[k] || null;
const getUsageCore = () => gMod('__agCsUsageCore');
const rippleCore = GT.__agCsRippleCore, i18nCore = GT.__agCsI18nCore, crystalPrismCore = GT.__agCrystalPrismCore, motionEngine = GT.__agMotionEngine, animatedIcons = GT.__agAnimatedIcons;
const convAuraMod = GT.__agPrismConvAura, smoothCaretMod = GT.__agPrismSmoothCaret;
const getLocalesMod = () => gMod('__agCsLocales'), getDualMascotRig = () => gMod('__agDualMascotRig');
const getPulseVialBridgeMod = () => gMod('__agCsPulseVialBridge'), getSettingsPanelMod = () => gMod('__agPrismSettingsPanel');
const getTel = () => W.__agPrismTelemetry, getTh = () => W.__agPrismThought, getCtx = () => W.__agPrismContextMenu || GT.__agPrismContextMenu || null;

const runtimeSliceStore = { active: 'en', byLang: O.create(null) }, sliceByLang = runtimeSliceStore.byLang;
const mergeRuntimeUiSlice = (p) => {
if (!p || typeof p !== 'object') return;
if (typeof p.active === 'string' && p.active) runtimeSliceStore.active = p.active;
if (isA(p.keys) && p.vals && typeof p.vals === 'object') {
for (const [l, arr] of O.entries(p.vals)) {
if (!isA(arr)) continue;
const dst = { ...(sliceByLang[l] || {}) };
for (let i = 0; i < p.keys.length; i++) if (typeof arr[i] === 'string' && arr[i]) dst[p.keys[i]] = arr[i];
sliceByLang[l] = dst;
}
}
if (p.byLang && typeof p.byLang === 'object') for (const [k, v] of O.entries(p.byLang)) if (v && typeof v === 'object') sliceByLang[k] = { ...(sliceByLang[k] || {}), ...v };
};
const LITE_SWARM_FMT = { 'zh-CN': '主会话 {0}% · 子代理 {1}%', 'zh-TW': '主工作階段 {0}% · 子代理 {1}%', ja: 'メイン {0}% · サブ {1}%', ko: '메인 {0}% · 서브 {1}%', es: 'Principal {0}% · Sub {1}%', fr: 'Principal {0}% · Sous {1}%', de: 'Haupt {0}% · Sub {1}%', tr: 'Ana {0}% · Swarm {1}%' };
const LITE_MORE_FMT = { 'zh-CN': '再显示 {0} 个', 'zh-TW': '再顯示 {0} 個', ja: 'さらに {0} 件表示', ko: '{0}개 더 보기', es: 'Mostrar {0} más', fr: 'Afficher {0} de plus', de: '{0} weitere anzeigen', tr: '{0} tane daha göster' };
const ensureLiteLocalesShim = (slicePayload) => {
mergeRuntimeUiSlice(slicePayload);
const cur = getLocalesMod();
if (cur && (cur.__isFullLocales || cur.UI_TABLE || cur.__isLiteShim)) return;
const shim = {
__isLiteShim: true,
getUiStrings(lang) {
const l = typeof lang === 'string' && lang ? lang : runtimeSliceStore.active || 'en';
const out = { ...(sliceByLang[l] || sliceByLang.en || sliceByLang[runtimeSliceStore.active] || {}) };
if (out.optThoughtImmersive && !out.optViewImmersive) out.optViewImmersive = out.optThoughtImmersive;
if (out.optThoughtBilingual && !out.optViewBilingual) out.optViewBilingual = out.optThoughtBilingual;
out.swarmSplitSub = (m, s) => (LITE_SWARM_FMT[l] || 'Main {0}% · Swarm {1}%').replace('{0}', m).replace('{1}', s);
out.showMoreN = (n) => (LITE_MORE_FMT[l] || 'Show {0} more').replace('{0}', n);
return out;
},
};
GT.__agCsLocales = W.__agCsLocales = shim;
};
if (initialConfig && initialConfig.__uiSlice) ensureLiteLocalesShim(initialConfig.__uiSlice);
const getHomeStudioMod = () => GT.__agPrismHomeStudioPanel || W.__agPrismHomeStudioPanel || GT.__agHomeStudioPanel || W.__agHomeStudioPanel || null;
const getDomBus = () => gMod('__agDomBus') || gMod('__agPrismDomBus');
const homeRippleMod = GT.__agPrismHomeRippleHost, modelGlyphMod = GT.__agPrismModelGlyphCrystal, streamChoreoMod = GT.__agPrismStreamChoreography, prismRimMod = GT.__agPrismRimCanvas;
const getHostEnhancerMod = () => gMod('__agPrismHostEnhancer');
let ownedCtxMenu = getCtx();

const STORAGE_PRISM_KEY = 'ag-prism:config', STORAGE_LEGACY_COLON_KEY = 'ag-claude-style:config', STORAGE_LEGACY_V3_KEY = 'agClaudeStyle.settings.v3', STORAGE_FILE_CFG_KEY = 'ag-prism:lastFileConfig', STORAGE_USAGE_CACHE_KEY = 'ag-prism:trajRollup.v1', SETTINGS_SEC_ID = 'ag-cs-settings-sec', BLUR_ATTR = 'data-ag-cs-win-blur';
const _ts = (s) => `[data-testid="${s}"]`, isF = Number.isFinite;
const T_CV = 'conversation-view', T_IB = 'agent-input-box', T_SBR = 'conversation-row-sidebar', T_TH = 'thinking-collapsible-trigger', T_CF = 'changed-files-card-header', T_WF = 'worked-for-collapsible', T_AP = 'aux-pane-split', T_BGC = 'background-task-command', T_SP = 'step-plan', T_MS = 'model-selector-panel';
const MODEL_PANEL_SEL = _ts(T_MS), S_CV = _ts(T_CV), S_IB = _ts(T_IB), S_SBR = _ts(T_SBR), S_DLG = '[role="dialog"]', S_VP = _ts('autoscroll-viewport'), S_TKT = _ts(T_TH), S_WF = _ts(T_WF), S_AP = _ts(T_AP), S_CC = '.surface-composer-card', S_IBCC = `${S_IB} ${S_CC}`;
const K_IC = 'isConnected', K_PE = 'parentElement', K_TC = 'textContent', K_CL = 'classList';
const isFn = (v) => typeof v === 'function', de = () => D.documentElement, byId = (id) => D.getElementById?.(id) || null, mkEl = (t) => D.createElement?.(t) || null, fe = (e) => e?.firstElementChild, lcw = (s) => String(s || '').toLowerCase(), hasFoc = () => !isFn(D.hasFocus) || D.hasFocus(), isDis = (e) => !e || e[K_IC] === false;
const ga = (e, k) => e?.getAttribute?.(k), sa = (e, k, v = '') => e?.setAttribute?.(k, String(v)), ha = (e, k) => !!(e?.hasAttribute?.(k)), ra = (e, k) => e?.removeAttribute?.(k);
const qs = (e, s) => e?.querySelector?.(s) || null, qa = (e, s) => e?.querySelectorAll?.(s) || [], cl = (e, s) => e?.closest?.(s) || null, qaE = (r, s, f) => { for (const e of qa(r, s)) f(e); };
const sp = (e, k, v, p) => e?.style?.setProperty?.(k, v, p), rp = (e, k) => e?.style?.removeProperty?.(k), clHas = (e, c) => !!(e?.[K_CL]?.contains?.(c)), clsOf = (e) => (typeof e?.className === 'string' ? e.className : ''), chOf = (e) => e?.children, hasIn = (a, b) => !!a?.contains?.(b), incS = (a, b) => a.includes(b), strNe = (v) => (typeof v === 'string' && v ? v : '');
const rmAll = (s) => qaE(D, s, (e) => e.remove()), raAll = (a, s = `[${a}]`) => qaE(D, s, (e) => ra(e, a));
const evOp = (t, add, ls) => { if (!t) return; for (const [e, f, o] of ls) safe(() => (add ? t.addEventListener(e, f, o) : t.removeEventListener(e, f, o))); };
const rc = (e) => (isFn(e?.getBoundingClientRect) ? e.getBoundingClientRect() : null), tidOf = (e) => String(ga(e, 'data-testid') || ''), tagU = (e) => String(e?.tagName || '').toUpperCase();
const isElementLike = (n) => !!(n && (n.nodeType === 1 || (n.nodeType === undefined && typeof n.tagName === 'string')));
const safeParseJsonObj = (raw) => { if (!raw || typeof raw !== 'string') return null; try { const p = JSON.parse(raw); return p && typeof p === 'object' && !isA(p) ? p : null; } catch { return null; } };

const BOOL_ALIAS_PAIRS = [['homeRipple', 'ripple'], ['composerRestyle', 'composer'], ['sidebarRestyle', 'sidebar']];
const STR_ALIAS_PAIRS = [['language', 'lang'], ['homeLayout', 'homeMode'], ['placeholderStyle', 'promptStyle']];
const ONOFF_STR_KEYS = 'telemetryModule|effortSliderModule|effortMemory|periodicModelPicker|omniModule|sidebarStudio|autoUpdate|sidebarNavFold|projectPartitions|sidePanelVerticalTabs'.split('|');
const BF_KEYS = 'sidebarCompact|codeLigatures|autoArchiveOnExit|ignoreReducedMotion'.split('|'), BT_KEYS = ['homeGlow', 'smoothCaret', 'contextMenu'];
const PICK_SETS = new Map();
const pickOf = (v, s, d) => { let set = PICK_SETS.get(s); if (!set) PICK_SETS.set(s, set = new Set(s.split('|'))); return set.has(v) ? v : d; };
const normConvRipple = (v) => (v === true || v === 'true' || v === 'on' ? 'medium' : pickOf(v, 'subtle|medium|full', 'off'));

const normPerfMode = (v) => (v === 'eco' || v === 'performance' ? 'performance' : v === 'quality' ? 'quality' : 'balanced');

const normalizeConfigShape = (rawCfg) => {
const out = { ...(rawCfg || {}) };
if (out.palette === 'claude') out.palette = 'warm';
out.performanceMode = normPerfMode(out.performanceMode);
out.homeLayout = out.homeMode = pickOf(out.homeLayout ?? out.homeMode, 'classic|off', 'studio');
out.ambientIntensity = String(out.ambientIntensity ?? '100');
for (const [k, s, d] of [
['palette', 'host|obsidian|warm', 'obsidian'], ['motionLevel', 'off|subtle|standard|ultra', 'ultra'],
['targetFps', '60|120|180|native', '180'], ['telemetryModule', 'on|off', 'auto'],
['effortSliderModule', 'on|off', 'auto'], ['hostLocalization', 'on|off', 'auto'],
['thoughtTranslate', 'machine|ai', 'off'], ['accentTone', 'follow|cobalt|iris|amber|mono', 'follow'],
['cornerStyle', 'sharp|balanced|soft', 'balanced'], ['chatFont', 'default|system-sans|noto-sans|inter|harmony|custom', 'default'],
['codeFont', 'default|jetbrains|cascadia|sfmono|custom', 'default'], ['ambientIntensity', '0|35|70|100', '100'],
['darkAura', 'subtle|balanced|vivid', 'balanced'],
]) out[k] = pickOf(out[k], s, d);
for (const [bKey, sKey] of BOOL_ALIAS_PAIRS) { const v = out[bKey] !== undefined ? out[bKey] : out[sKey], on = v === undefined ? true : v !== false && v !== 'off'; out[bKey] = on; out[sKey] = on ? 'on' : 'off'; }
if (out.homeGlow === undefined && out.homeRipple === false) out.homeGlow = false;
out.placeholderStyle = out.promptStyle = (out.placeholderStyle ?? out.promptStyle) === 'host' ? 'host' : 'studio';
out.mascot = out.mascot === 'off' || out.mascot === false ? 'off' : /^(minis|quad(-minis)?|r:[ckdw0-4,+m]+)$/.test(out.mascot) ? out.mascot : 'crab';
out.convRipple = normConvRipple(out.convRipple);
for (const k of BF_KEYS) out[k] = out[k] === true || out[k] === 'on';
for (const k of ONOFF_STR_KEYS.slice(5)) out[k] = out[k] === 'on' || out[k] === true ? 'on' : 'off';
for (const k of BT_KEYS) out[k] = out[k] === undefined ? true : out[k] !== false && out[k] !== 'off';
for (const k of ['chatFontCustom', 'codeFontCustom']) out[k] = typeof out[k] === 'string' ? out[k].replace(/[\0\r\n]/g, '').slice(0, 160) : '';
for (const k of ONOFF_STR_KEYS.slice(2, 5)) out[k] = out[k] === 'off' || out[k] === false ? 'off' : 'on';
for (const s of 'lightPreset:alabaster:crystal|darkAuraStyle:neon:prism|thoughtTrigger:expand:preload|scrollBottomMotion:instant:smooth|thoughtView:bilingual:immersive|linkTarget:external:builtin|updateChannel:beta:stable|telemetryQuotaMode:both:compact'.split('|')) { const [k, a, b] = s.split(':'); out[k] = out[k] === a ? a : b; }
const mig = (v) => { if (typeof v !== 'string') return ''; const t = v.trim(); if (!t) return ''; const low = t.toLowerCase().replace(/_/g, '-'); return low === 'yue' || low.startsWith('yue-') || low === 'zh-yue' || incS(low, 'cantonese') ? 'zh-CN' : t; };
const rawLang = (out.language && out.language !== 'auto' ? mig(out.language) : '') || (out.lang && out.lang !== 'auto' ? mig(out.lang) : '');
if (rawLang) out.language = out.lang = rawLang;
return out;
};

const expandSettingAliases = (rawPatch) => {
const patch = { ...(rawPatch || {}) };
if (patch.palette === 'claude') patch.palette = 'warm';
if (patch.mascot === 'dual') patch.mascot = 'crab';
if ('performanceMode' in patch) patch.performanceMode = normPerfMode(patch.performanceMode);
for (const [a, b] of STR_ALIAS_PAIRS) if (a in patch) patch[b] = patch[a]; else if (b in patch) patch[a] = patch[b];
for (const [bKey, sKey] of BOOL_ALIAS_PAIRS) if (bKey in patch || sKey in patch) { const v = bKey in patch ? patch[bKey] : patch[sKey], on = v !== false && v !== 'off'; patch[bKey] = on; patch[sKey] = on ? 'on' : 'off'; }
if ('convRipple' in patch) patch.convRipple = normConvRipple(patch.convRipple);
for (const k of BF_KEYS) if (typeof patch[k] === 'string') patch[k] = patch[k] === 'on' || patch[k] === 'true';
for (const k of BT_KEYS) if (typeof patch[k] === 'string') patch[k] = patch[k] !== 'off' && patch[k] !== 'false';
for (const k of ONOFF_STR_KEYS) if (typeof patch[k] === 'boolean') patch[k] = patch[k] ? 'on' : 'off';
return patch;
};

const stripRuntimeMetaKeys = (obj) => {
const { binding, pollIntervalMs, codeHash, __fromFile, __ackEpoch, __uiSlice, ...clean } = obj || {};
return clean;
};
const writeSavedCfg = (obj) => { const s = SJ(obj); LS.setItem(STORAGE_PRISM_KEY, s); LS.setItem(STORAGE_LEGACY_V3_KEY, s); };

const readLsObj = (k) => safeParseJsonObj(LS.getItem(k));
const loadSettings = (base, explicitOverride = null) => {
try {
const cleanBase = expandSettingAliases(stripRuntimeMetaKeys(base)), baseJson = SJ(cleanBase);
const prevBaseRaw = LS.getItem(STORAGE_FILE_CFG_KEY), prevBaseObj = safeParseJsonObj(prevBaseRaw);
const savedLegacyColon = readLsObj(STORAGE_LEGACY_COLON_KEY), savedPrism = readLsObj(STORAGE_PRISM_KEY);
const mergedSaved = { ...(readLsObj(STORAGE_LEGACY_V3_KEY) || {}), ...(savedLegacyColon || {}), ...(savedPrism || {}) };
let savedMutated = false;
if (prevBaseObj) for (const [k, v] of O.entries(cleanBase)) if (SJ(prevBaseObj[k]) !== SJ(v)) { O.assign(mergedSaved, expandSettingAliases({ [k]: v })); savedMutated = true; }
if (explicitOverride && typeof explicitOverride === 'object') {
const cleanOverride = stripRuntimeMetaKeys(explicitOverride);
if (O.keys(cleanOverride).length) { O.assign(mergedSaved, expandSettingAliases(cleanOverride)); savedMutated = true; }
}
if (!prevBaseRaw || prevBaseRaw !== baseJson) LS.setItem(STORAGE_FILE_CFG_KEY, baseJson);
if (savedMutated || (!savedPrism && (savedLegacyColon || LS.getItem(STORAGE_LEGACY_V3_KEY)))) writeSavedCfg(mergedSaved);
if (savedLegacyColon) LS.removeItem?.(STORAGE_LEGACY_COLON_KEY);
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
const DIRTY_KEYS = 'f|t|r|s|a|c|b|o|l|tk|cf|g|m|mp'.split('|');
const dirtyFlags = {};
const setAllDirty = (v) => { for (const k of DIRTY_KEYS) dirtyFlags[k] = v; };
setAllDirty(true);
const perfStats = {
lastSyncMs: 0,
syncCount: 0,
iconIncrementalRuns: 0,
iconFullRuns: 0,
};

const markAllDirty = () => setAllDirty(true);

const resolveWireSettingPair = (key, value) => {
const base = currentBaseConfig || {};
for (const [a, b] of STR_ALIAS_PAIRS) if (key === a && b in base && !(a in base)) return [b, value];
for (const [a, b] of BOOL_ALIAS_PAIRS) if (key === a && b in base && !(a in base)) return [b, value ? 'on' : 'off'];
if (incS('sidebarCompact|smoothCaret|contextMenu'.split('|'), key) && typeof base[key] === 'string') return [key, value ? 'on' : 'off'];
if (incS(ONOFF_STR_KEYS, key) && typeof value === 'boolean') return [key, value ? 'on' : 'off'];
if (key === 'palette' && value === 'claude') return ['palette', 'warm'];
if (key === 'mascot') return ['mascot', value === 'dual' ? 'crab' : value];
return [key, value];
};

const routeConfigDirtyFlags = (prevCfg, nextCfg, patch) => {
dirtyFlags.g = true;
for (const [fs, ks] of [
['tcr', 'performanceMode'],
['t', 'palette|lightPreset|accentTone|ambientIntensity|darkAura|darkAuraStyle|cornerStyle|chatFont|chatFontCustom|codeFont|codeFontCustom|codeLigatures'],
['c', 'accentTone|composerRestyle|placeholderStyle|mascot|smoothCaret|telemetryModule|motionLevel|ignoreReducedMotion|language'],
['r', 'homeLayout|homeRipple|homeGlow|convRipple|motionLevel|ignoreReducedMotion|language'],
['s', 'sidebarRestyle|sidebarCompact|sidebarNavFold'],
['l,tk', 'thoughtTranslate|thoughtTrigger|thoughtView'],
]) if (ks.split('|').some((k) => prevCfg[k] !== nextCfg[k] || O.hasOwn(patch, k))) for (const f of incS(fs, ',') ? fs.split(',') : fs) dirtyFlags[f] = true;
};

const persistAndApplyConfigPatch = (rawPatch, emitSingleKey = null) => {
const prevCfg = { ...cfg }, patch = expandSettingAliases(rawPatch);
O.assign(currentBaseConfig, stripRuntimeMetaKeys(patch));
cfg = normalizeConfigShape({ ...cfg, ...patch });
safe(() => {
const saved = readLsObj(STORAGE_PRISM_KEY) || {};
O.assign(saved, patch); writeSavedCfg(saved); LS.removeItem?.(STORAGE_LEGACY_COLON_KEY);
const lf = readLsObj(STORAGE_FILE_CFG_KEY);
if (lf) { O.assign(lf, patch); LS.setItem(STORAGE_FILE_CFG_KEY, SJ(lf)); }
});
const writeEp = ++localWriteEpoch;
safe(() => {
const send = W[cfg.binding] || W.__agPrismSetting || W.__agClaudeStyleSetting;
if (!isFn(send)) return;
if (emitSingleKey !== null) { const [key, value] = resolveWireSettingPair(emitSingleKey, rawPatch[emitSingleKey]); send(SJ({ key, value, clientEpoch: writeEp })); }
else { const entries = {}; for (const [k, v] of O.entries(rawPatch || {})) { const [wk, wv] = resolveWireSettingPair(k, v); entries[wk] = wv; } if (O.keys(entries).length) send(SJ({ action: 'patch-batch', entries, clientEpoch: writeEp })); }
});
routeConfigDirtyFlags(prevCfg, cfg, patch);
applyRootAttrs();
scheduleSync();
};

const saveSetting = (key, value) => persistAndApplyConfigPatch({ [key]: value }, key);
const saveSettingsBatch = (patchObj) => { if (patchObj && typeof patchObj === 'object') persistAndApplyConfigPatch(patchObj, null); };

const pickConcreteLang = (v) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'auto' ? v.trim() : '');

const getLang = () => {
let raw = '';
for (const v of [cfg.language, cfg.lang, currentBaseConfig?.language, currentBaseConfig?.lang]) if ((raw = pickConcreteLang(v))) break;
if (!raw) raw = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || 'en';
if (isFn(i18nCore?.normalizeLanguage)) return i18nCore.normalizeLanguage(raw, 'en');
const low = lcw(raw).trim().replace(/_/g, '-');
if (/^(?:zh|yue)|cantonese/.test(low)) return /tw|hk|mo|hant/.test(low) ? 'zh-TW' : 'zh-CN';
return low.match(/^(en|ja|ko|es|fr|de)(?:-|$)/)?.[1] || 'en';
};

const uiText = (lang = getLang()) => getLocalesMod()?.getUiStrings?.(lang) || {};
const isZh = () => { const l = getLang(); return l === 'zh-CN' || l === 'zh-TW'; };

const isDarkTheme = () => {
for (const l of [D.body?.[K_CL], de()?.[K_CL]]) if (l) {
if (['theme-light', 'light-theme', 'light'].some((c) => l.contains(c))) return false;
if (['theme-dark', 'dark', 'dark-theme'].some((c) => l.contains(c))) return true;
}
return true;
};

const getEffectivePalette = () => pickOf(cfg.palette === 'claude' ? 'warm' : cfg.palette, 'obsidian|warm|host', 'obsidian');
const getLightPreset = () => (cfg.lightPreset === 'alabaster' ? 'alabaster' : 'crystal');
const getMotionLevel = () => pickOf(cfg.motionLevel, 'off|subtle|standard|ultra', 'ultra');
const getTargetFps = () => pickOf(String(cfg.targetFps || ''), '60|120|180|native', '180');
const getMinFrameGapMs = () => {
const userGap = ({ native: 0, 60: 15.2, 120: 7.5 })[getTargetFps()] ?? 4.8;
const capGap = Number((W.__agPrismPerfCaps || GT.__agPrismPerfCaps)?.()?.minFrameGapMs || 0);
return capGap > userGap ? capGap : userGap;
};
const aoMode = (k) => pickOf(cfg[k], 'on|off', 'auto'), onOffMode = (k) => (cfg[k] === 'off' || cfg[k] === false ? 'off' : 'on');
const getTelemetryMode = () => aoMode('telemetryModule'), getThoughtTranslateMode = () => pickOf(cfg.thoughtTranslate, 'machine|ai', 'off');
const getAccentTone = () => pickOf(cfg.accentTone, 'cobalt|iris|amber|mono', 'follow'), getCornerStyle = () => pickOf(cfg.cornerStyle, 'sharp|soft', 'balanced');
const getCodeFont = () => pickOf(cfg.codeFont, 'jetbrains|cascadia|sfmono|custom', 'default'), isCodeLigaturesEnabled = () => cfg.codeLigatures === true || cfg.codeLigatures === 'on';
const getAmbientIntensitySetting = () => pickOf(String(cfg.ambientIntensity ?? '100'), '0|35|70|100', '100'), getAmbientFloat = () => Number(getAmbientIntensitySetting()) / 100;
const getThoughtView = () => (cfg.thoughtView === 'bilingual' ? 'bilingual' : 'immersive'), getLinkTarget = () => (cfg.linkTarget === 'external' ? 'external' : 'builtin');

const resolveAuraSpectrumMode = () => {
const acc = getAccentTone();
if (acc !== 'follow') return acc;
const pal = getEffectivePalette();
if (pal === 'warm') return 'warm';
if (pal === 'obsidian' && !isDarkTheme() && getLightPreset() === 'alabaster') return 'warm';
return 'default';
};

const isMascotEnabled = () => cfg.mascot !== 'off', isStudioHome = () => cfg.homeLayout === 'studio', isCompOn = () => cfg.composerRestyle !== false, isCaretOn = () => cfg.smoothCaret !== false;

let _rmFn = null;
let _rmMql = null;
const motionReduced=()=>{if(cfg.motionLevel==='off')return true;if(isFn(W.__agPrismReducedMotion))return!!W.__agPrismReducedMotion(D,W);if(cfg.ignoreReducedMotion||ga(de(),'data-ag-cs-ignore-rm')==='1')return false;if(typeof matchMedia!=='function')return false;if(_rmFn!==matchMedia||!_rmMql){_rmFn=matchMedia;_rmMql=matchMedia('(prefers-reduced-motion: reduce)');}return!!_rmMql?.matches;};

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
const cv = node?.ownerDocument?.createElement?.('canvas');
return !!(cv?.dataset && isFn(cv.getContext) && cv.getContext('2d'));
} catch { return false; }
};

// Thought Translator Isolation
const THOUGHT_ISOLATED_SELECTOR = '.ag-prism-thought-overlay, .ag-prism-thought-raw-toggle, [data-prism-ignore]';

const isThoughtIsolatedNode = (node) => {
const el = node ? (isElementLike(node) ? node : node[K_PE]) : null;
return !!(el && (clHas(el, 'ag-prism-thought-overlay') || clHas(el, 'ag-prism-thought-raw-toggle') || clHas(el, 'ag-prism-thought-body') || ha(el, 'data-prism-ignore') || cl(el, THOUGHT_ISOLATED_SELECTOR)));
};

const isMutAll = (m, fn) => {
if (!m) return false;
if (fn(m.target)) return true;
const a = m.addedNodes, r = m.removedNodes, al = a ? a.length : 0, rl = r ? r.length : 0;
if (!al && !rl) return false;
for (let i = 0; i < al; i++) if (!fn(a[i])) return false;
for (let i = 0; i < rl; i++) if (!fn(r[i])) return false;
return true;
};
const isThoughtMutationRecord = (m) => isMutAll(m, isThoughtIsolatedNode);

const isManagedThoughtPanel = (panel) => !!(isElementLike(panel) && (ha(panel, 'data-op-zh-ready') || ha(panel, 'data-op-zh-pending') || qs(panel, '.ag-prism-thought-overlay')));

const takeMo = (b) => (b?.discardMutations ? b.discardMutations() : mainObserver?.takeRecords && mainObserver.takeRecords());
const runGuardedMut = (fn) => {
const prev = internalDomMutating;
let b, pre;
if (!prev) pre = safe(() => takeMo(b = getDomBus()));
internalDomMutating = true;
try { return fn(); } finally {
if (!prev) safe(() => takeMo(b || (b = getDomBus())));
internalDomMutating = prev;
if (pre?.length) Promise.resolve().then(() => !destroyed && (b?.replayRecords ? b.replayRecords(pre) : onRootMutations(pre)));
}
};

const setAttrIfChanged = (el, name, val) => { if (el && ga(el, name) !== val) sa(el, name, val); };
const tA = (e, k, on, v = '1') => { if (e) { if (on) setAttrIfChanged(e, k, v); else if (ha(e, k)) ra(e, k); } };

// React Fiber & Store Bridge
let cachedSvc = null, cachedStore = null, storeUnsub = null, storeDebounce = null;

const findFiber = (el) => {
const k = el && O.keys(el).find((s) => s.startsWith('__reactFiber$'));
return k ? el[k] : null;
};

const ensureHooks = (allowPartial = false) => {
if (cachedSvc && cachedStore) return { svc: cachedSvc, store: cachedStore };
const anchors = qa(D, `${S_CV},${S_IB},${S_SBR},${_ts('new-conversation-button')},${_ts('home-greeting')}`);
for (const el of anchors) {
for (let f = findFiber(el); f && !(cachedSvc && cachedStore); f = f.return) {
const p = f.memoizedProps;
if (!cachedStore && isFn(p?.store?.getState)) cachedStore = p.store;
for (let d = f.dependencies?.firstContext; d; d = d.next) {
const v = d.memoizedValue;
if (!v || typeof v !== 'object') continue;
if (!cachedSvc && isFn(v.getCascadeTrajectory)) cachedSvc = v;
if (!cachedStore && isFn(v.store?.getState)) cachedStore = v.store;
}
}
if (cachedSvc && cachedStore) break;
}
if (cachedStore && !storeUnsub) {
storeUnsub = cachedStore.subscribe(() => {
if (destroyed || storeDebounce) return;
storeDebounce = ST(() => { storeDebounce = null; if (!destroyed) onStoreChanged(); }, 400);
});
}
return cachedSvc && cachedStore || (allowPartial && (cachedSvc || cachedStore)) ? { svc: cachedSvc, store: cachedStore } : null;
};

const getDisplayName = () => { const raw = String(ensureHooks(true)?.store?.getState()?.userStatus?.name || '').trim(); return raw ? raw.split(/\s+/)[0] || raw : ''; };

const resolveCascadeId = (inputBox) => {
const cv = inputBox ? cl(inputBox, S_CV) : qs(D, S_CV);
if (inputBox && !cv && cl(inputBox, '.agy-home')) return '';
if (cv) { const attrId = ga(cv, 'data-cascade-id'); if (attrId && attrId !== 'conversation') return attrId; }
const m = location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
if (m) return m[1];
const readCid = (el, maxD) => { for (let f = findFiber(el), d = 0; f && d < maxD; f = f.return, d++) { const id = strNe((f.memoizedProps || f.pendingProps)?.cascadeId); if (id) return id; } return ''; };
const fromIn = readCid(inputBox, 60) || readCid(cv, 35);
if (fromIn) return fromIn;
if (cv && !cl(inputBox, _ts('subagent-tab-conversation'))) {
const cs = ensureHooks(true)?.store?.getState?.()?.conversation?.convoState;
if (cs?.type === 'active') return strNe(cs.cascadeId);
if (cs?.type === 'subagent') return strNe(cs.childConversationId);
}
return '';
};

const sumOf = (st, id) => { const e = id && (st?.trajectorySummaries?.summaries?.[id] ?? st?.cascadeTrajectorySummaries?.[id]); return e?.summary || e || {}; };
let msRoot = null, msRig = null, msAnc = null, msOrch = null, msLastTier, msLastHostSleep = false, msActAt = 0;
const notifyMascot = (eventName, payload) => { try { msRig?.notify?.(eventName, payload || {}); } catch {} };
const getLightweightActiveInfo = (card) => {
if (!card) return null;
const inputBox = cl(card, S_IB), cv = cl(card, S_CV), cid = cv ? resolveCascadeId(inputBox) : '';
let r = !!qs(card, _ts('input-cancel-button')), t = false, e = false;
if (cid) {
const sum = sumOf(ensureHooks(true)?.store?.getState?.(), cid);
if (sum.notFullyIdle || sum.hasActivity || sum.status === 2 || sum.hasRunningSubagents) r = true;
if (sum.status === 3 || sum.hasError) e = true;
}
if (cv && r) {
const th = qs(cv, `${S_TKT},${S_WF}`);
if (th && incS(String(th[K_TC] || ''), '...')) t = true;
}
return { c: cid, r, t, e };
};

let crabRemoveAttrTimer = 0, queuedCrabAnchor = null, lastQueuedRoofH = 48, prevRoofKind = '', hasTt = false;
const A_CA = 'data-ag-cs-crab-anchor', getMascotHop = () => gMod('__agPrismMascotHop'), syncRigPwr = () => safe(() => msRig?.syncPowerState?.());

const unmountCrab = () => {
crabRemoveAttrTimer = cT(crabRemoveAttrTimer);
safe(() => getMascotHop()?.cancelForStage?.(msRoot));
safe(() => msRig?.dispose?.());
msRoot?.[K_PE]?.removeChild(msRoot);
ra(msAnc, A_CA); tA(de(), 'data-ag-cs-has-crab', false);
msRoot = msRig = msAnc = msOrch = queuedCrabAnchor = null;
msLastTier = undefined; msLastHostSleep = hasTt = false; lastQueuedRoofH = 48; prevRoofKind = '';
};

const syncCrab = (activeCard, activeInfo, modelInfo, yieldMode = 'none', roofH = 0, lRes = 0, rRes = 0) => {
if (!isMascotEnabled()) return unmountCrab();
const html = de(), hop = getMascotHop();
if (!activeCard) {
safe(() => hop?.cancelForStage?.(msRoot));
msRoot?.[K_PE]?.removeChild(msRoot);
syncRigPwr();
if (msAnc) { ra(msAnc, A_CA); msAnc = null; }
prevRoofKind = '';
if (ha(html, 'data-ag-cs-has-crab')) {
if (typeof ST === 'function' && !destroyed) {
if (!crabRemoveAttrTimer) crabRemoveAttrTimer = ST(() => { crabRemoveAttrTimer = 0; if (!destroyed && !msAnc) runGuardedMut(() => ra(html, 'data-ag-cs-has-crab')); }, 220);
} else ra(html, 'data-ag-cs-has-crab');
}
return;
}
crabRemoveAttrTimer = cT(crabRemoveAttrTimer);
if (!msRoot) {
const stage = mkEl('div');
stage.className = 'ag-cs-crab ag-cs-dual-stage';
sa(stage, 'data-mascot-stage', 'true'); sa(stage, 'aria-hidden', 'true'); sa(stage, 'data-ag-no-i18n'); sa(stage, 'data-ag-owned', '1');
msRoot = stage;
}
const hc = queuedCrabAnchor || activeCard, ak = queuedCrabAnchor ? 'queued' : 'composer', prevP = msRoot[K_PE];
const prevAk = (prevP && ga(prevP, A_CA)) || prevRoofKind;
const commitAnc = () => {
if (msRoot[K_PE] !== hc) { ra(msAnc, A_CA); sa(hc, A_CA, ak); hc.appendChild(msRoot); msAnc = hc; return true; }
if (ga(hc, A_CA) !== ak) sa(hc, A_CA, ak);
return false;
};
let reattached = false;
const pIb = prevP ? cl(prevP, S_IB) : null, hIb = cl(hc, S_IB), sameIb = !!(pIb && hIb && pIb === hIb), hopBase = { stageEl: msRoot, motionLevel: getMotionLevel(), reducedMotion: motionReduced(), doc: D, win: W };
const runVert = (fromAnchor, toAnchor, dir, deltaPx) => hop?.runVerticalRoofTransition?.({ ...hopBase, fromAnchor, toAnchor, direction: dir, deltaPx, onComplete: () => { if (!destroyed && dir === 'gravity-land') notifyMascot('roof-land', {}); } });
const isVertRoof = prevP && prevP !== hc && ((prevAk === 'composer' && ak === 'queued' && sameIb) || (prevAk === 'queued' && ak === 'composer' && (sameIb || prevP[K_IC] === false || prevP.hidden)));
const runHop = hop?.runMascotHopTransition;
if (isVertRoof && isFn(hop?.runVerticalRoofTransition)) {
reattached = commitAnc();
runVert(prevP, hc, ak === 'queued' ? 'hop-up' : 'gravity-land', roofH > 0 ? roofH : lastQueuedRoofH || 48);
} else if (prevP && prevP !== hc && isFn(runHop)) {
const hr = runHop.call(hop, { ...hopBase, fromAnchor: prevP, toAnchor: hc, anchorKind: ak, onCommitAnchor: () => { if (destroyed || !msRoot || !hc || hc[K_IC] === false) return false; runGuardedMut(commitAnc); syncRigPwr(); return true; } });
if (!hr?.animated) reattached = commitAnc();
} else {
const ts = prevP === hc && hop?.getTransitionState?.();
if (ts?.active && !incS(['hop-up', 'gravity-land'], ts.phase) && isFn(runHop)) safe(() => runHop.call(hop, { ...hopBase, fromAnchor: prevP, toAnchor: hc }));
reattached = commitAnc();
const dh = M.abs(roofH - lastQueuedRoofH);
if (prevP === hc && ak === 'queued' && roofH > 0 && lastQueuedRoofH > 0 && dh >= 12) runVert(hc, hc, roofH > lastQueuedRoofH ? 'hop-up' : 'gravity-land', dh);
}
if (ak === 'queued' && roofH > 0) lastQueuedRoofH = roofH;
prevRoofKind = ak;
if (html) setAttrIfChanged(html, 'data-ag-cs-has-crab', '1');
const nextYield = yieldMode === 'peek' || yieldMode === 'leap' ? yieldMode : 'none';
tA(msRoot, 'data-ag-mascot-peek', nextYield === 'peek');
const isOrch = !!(modelInfo?.isOrchestrator), curTier = lcw(modelInfo?.tier);
const nextState = {
camp: modelInfo?.mascotCamp || modelInfo?.camp || 'gemini', mascot: cfg.mascot, streaming: !!(activeInfo?.r),
streamTier: curTier === 'high' || curTier === 'xhigh' || isOrch ? 3 : 2, hasError: !!(activeInfo?.e), yieldMode: nextYield,
leapOffsetY: 0, popoverRightWidth: 0, leftReserveWidth: lRes || 0, rightReserveWidth: rRes || 0, miniPileEnabled: /minis$|\+m$/.test(cfg.mascot), orchestrator: isOrch, reducedMotion: motionReduced(),
};
const rigMod = getDualMascotRig(), mountFn = rigMod && (rigMod.mountDualMascotStage || rigMod.createDualMascotRig), rigHash = rigMod?.__prismCodeHash || '';
if (msRig && rigMod && (msRig.__r !== rigMod || (rigHash && msRig.__h !== rigHash))) {
safe(() => (msRig.dispose || msRig.destroy)?.call(msRig));
msRig = null; if (msRoot) msRoot.textContent = '';
}
if (!msRig && mountFn && canMountRealCanvas(msRoot)) {
try { msRig = mountFn(msRoot, nextState); if (msRig) { msRig.__r = rigMod; msRig.__h = rigHash; } } catch { msRig = null; }
} else {
safe(() => msRig?.setState?.(nextState));
if (reattached) syncRigPwr();
}

if (reattached) {
msOrch = isOrch;
msLastTier = curTier;
} else {
if (msOrch !== null && msOrch !== isOrch) notifyMascot('orchestrator', { on: isOrch });
msOrch = isOrch;
if (msLastTier !== undefined && msLastTier !== curTier && (curTier === 'high' || curTier === 'xhigh')) notifyMascot('effort-tier', { tier: curTier });
msLastTier = curTier;
}
const chatSleep = ga(html, 'data-ag-prism-mode') === 'chat';
if (msLastHostSleep !== chatSleep) {
msLastHostSleep = chatSleep;
notifyMascot('host-sleep', { sleep: chatSleep });
}
};

// Domain Controllers (零 Proxy 显式薄委托)
const noopFn = () => null;
const mkStub = (ks, ov) => { const o = { ...(ov || {}) }; for (const k of ks.split('|')) if (k && !(k in o)) o[k] = noopFn; return o; };
const mkDel = (res, ks, ext) => { const o = ext ? O.defineProperties({}, O.getOwnPropertyDescriptors(ext)) : {}; for (const k of ks.split('|')) o[k] = (...a) => { const c = res(); return isFn(c?.[k]) ? c[k].apply(c, a) : null; }; return o; };

const HS_KS = 'wasHero|getScopeKey|getUsageRecordsCount|hasConnectedPanel|syncGreeting|renderHomePanel|unmountPanelSeat|parkPanelSeat|scheduleUsageRollupRefresh|flushUsageCacheNow|restoreGreetings|dispose';
const homeStudioFallback = mkStub(HS_KS, { wasHero: () => false, getScopeKey: () => 'local', getUsageRecordsCount: () => 0, hasConnectedPanel: () => false });
let lastHomeStudioChannelReqAt = 0, vtReqAt = 0;
const resolveManagedCtl = (getMod, key, fb, st, disp, cmp, mk) => {
const mod = getMod(), fn = mod?.[key];
if (!isFn(fn)) { if (st.i) disp(); return fb; }
if (st.i && st.m === mod && (!cmp || cmp(st))) return st.i;
if (st.i) disp();
if (destroyed) return fb;
st.m = mod;
return (st.i = fn({ ...baseCtlOpts, ...mk(st) }));
};
const hsSt = { m: null, i: null, u: null };
const disposeActiveHomeStudio = () => {
const p = hsSt.i; hsSt.i = hsSt.m = hsSt.u = null;
if (!p) return;
if (isFn(p.dispose)) return safe(() => p.dispose());
for (const k of ['flushUsageCacheNow', 'unmountPanelSeat', 'restoreGreetings']) safe(() => p[k]?.());
};
const emitHostAction = (action) => { const fn = W[currentBaseConfig?.binding || cfg?.binding || '__agPrismSetting']; if (isFn(fn)) try { fn(SJ({ action })); return true; } catch {} return false; };
const reqCh = (a, t) => { const n = dNow(); return !destroyed && n - t >= 1000 && emitHostAction(a) ? n : t; };
const requestHomeStudioChannelIfNeeded = () => {
if (isStudioHome() && qs(D, '.agy-home')) lastHomeStudioChannelReqAt = reqCh('request-home-studio-panel', lastHomeStudioChannelReqAt);
};
const baseCtlOpts = { isDestroyed: () => destroyed, isDarkTheme, motionReduced, getMinFrameGapMs, canMountRealCanvas, setAttrIfChanged, runGuardedMut };
const mkCtl = (fn, opts, fb) => (isFn(fn) ? fn({ ...baseCtlOpts, ...opts }) : fb);
const resolveHomeStudioCtl = () => {
const uc = getUsageCore() || null;
return resolveManagedCtl(getHomeStudioMod, 'createHomeStudioPanelController', homeStudioFallback, hsSt, disposeActiveHomeStudio, (s) => s.u === uc || (s.u && !uc), (s) => ({ usageCore: (s.u = uc), storageUsageCacheKey: STORAGE_USAGE_CACHE_KEY, getHomeLayout: () => cfg.homeLayout, getLang, uiText, getDisplayName, ensureHooks }));
};
const homeStudioCtl = mkDel(resolveHomeStudioCtl, HS_KS);
const refUsage = () => homeStudioCtl.scheduleUsageRollupRefresh(1800);
const rippleCtl = mkCtl(homeRippleMod?.createHomeRippleController, { rippleCore, isAllowed: () => cfg.homeRipple !== false && cfg.homeLayout !== 'off', isGlowAllowed: () => cfg.homeGlow !== false && cfg.homeLayout !== 'off', isConvAllowed: () => cfg.convRipple !== 'off', getConvLevel: () => cfg.convRipple, isConvRunning, getAmbientIntensity: getAmbientFloat, getAccentTone, getEffectivePalette, onPointerPressMascot: (x) => { if (msRig && msRoot) safe(() => { const mr = rc(msRoot); if (mr) notifyMascot('ripple', { x: x - mr.left }); }); } }, mkStub('sync|refreshTheme|unmount|getMount'));
const convAuraCtl = mkCtl(convAuraMod?.createConvAuraController, { isHomeRippleEnabled: () => getAmbientFloat() > 0, isMotionStandardOrUltra, getAmbientIntensity: getAmbientFloat, getSpectrumMode: resolveAuraSpectrumMode, isWindowFocused: () => (isFn(D.hasFocus) ? D.hasFocus() : !D.hidden), rippleCore }, mkStub('sync|refreshTheme|unmount|getInstance|setActiveView|setSemanticState|prime|wake|triggerStart', { advancePhase: () => 'off' }));
const HE_KS = 'sync|onThemeChange|destroy';
const hostEnhancerFallback = mkStub(HE_KS);
const heSt = { m: null, i: null };
const disposeActiveHostEnhancer = () => { const p = heSt.i; heSt.i = heSt.m = null; safe(() => p?.destroy?.()); };
const resolveHostEnhancerCtl = () => resolveManagedCtl(getHostEnhancerMod, 'createHostEnhancerController', hostEnhancerFallback, heSt, disposeActiveHostEnhancer, null, () => ({ doc: D, win: W, getLang, t: (k) => (k ? uiText()[k] : uiText()), isConvRunning, getConfig: () => normalizeConfigShape(cfg) }));
const hostEnhancerCtl = mkDel(resolveHostEnhancerCtl, HE_KS, { get getDebugState() { const c = resolveHostEnhancerCtl(); return c !== hostEnhancerFallback && isFn(c?.getDebugState) ? () => c.getDebugState() : undefined; } });

function isConvRunning(s, v) {
return !!(convAuraMod && isFn(convAuraMod.isConvRunning) && convAuraMod.isConvRunning(s, v));
}

let prismRimCtl = null;

const modelGlyphCtl = mkCtl(modelGlyphMod?.createModelGlyphCrystalController, { animatedIcons, crystalPrismCore, isComposerRestyleEnabled: isCompOn, isZh, getLastPointerPos: () => (prismRimCtl ? prismRimCtl.getLastPointerPos() : { x: -9999, y: -9999 }) }, mkStub('getActiveCrystalTrack|setCrystalPointerClient|cloneCachedSvgElement|syncModelSelectorPanel|syncModelGlyphOnButton|teardownCrystalMount', { readButtonLabelWithoutGlyph: () => '', buildBrandMarkSvg: () => '' }));

prismRimCtl = mkCtl(prismRimMod?.createPrismRimCanvasController, {
getActiveCrystalTrack: () => modelGlyphCtl.getActiveCrystalTrack(), setCrystalPointerClient: (x, y) => modelGlyphCtl.setCrystalPointerClient(x, y),
onPointerActivity: (now) => { if (now - msActAt >= 2500) { msActAt = now; notifyMascot('activity', {}); } },
onComposerRimUpdate: (info) => safe(() => msRig?.setRimLight?.(info)),
}, mkStub('onPointerMove|cancelPendingRaf|pauseForOverlay|teardown|markDirty|invalidateMetrics|mountNewBoxes|rescanNow', { getLastPointerPos: () => ({ x: -9999, y: -9999 }) }));

const smoothCaretCtl = mkCtl(smoothCaretMod?.createSmoothCaretController, { isEnabled: isCaretOn }, mkStub('queue|sync|applyMutations|measureSnapshot|bumpMetricsEpoch|invalidateSelection|teardown'));

const iconPendSig = new WeakMap(), A_IC = 'data-ag-cs-icon-injected', A_OS = 'data-ag-cs-orig-svg', A_OD = 'data-ag-cs-orig-disp';
const applySingleHostIcon = (btn, iconName, origSvg, size, eqSig) => {
if (!btn || btn[K_IC] === false || !origSvg?.parentNode || !animatedIcons || ga(btn, A_IC) || qs(btn, '.ag-anim-icon')) return;
const htmlStr = animatedIcons.renderIcon(iconName, { size });
if (!htmlStr) return;

const prevDisp = gp(origSvg, 'display');
if (prevDisp) sa(origSvg, A_OD, prevDisp);
sa(origSvg, 'hidden'); sa(origSvg, A_OS, '1'); origSvg.hidden = true;
sp(origSvg, 'display', 'none', 'important');

let animSvg = modelGlyphCtl.cloneCachedSvgElement(`icon:${iconName}:${size}`, htmlStr);
if (!animSvg) {
animSvg = D.createElementNS?.('http://www.w3.org/2000/svg', 'svg') || mkEl('svg');
animSvg.className = `ag-anim-icon ag-icon-${iconName}`;
for (const [k, v] of [['data-anim-icon', iconName], ['width', size], ['height', size], ['viewBox', '0 0 24 24'], ['aria-hidden', 'true']]) sa(animSvg, k, v);
if (iconName === 'copy-check') sa(animSvg, 'data-icon-state', 'copy');
}
sa(animSvg, 'data-ag-owned', '1');
origSvg.parentNode.insertBefore(animSvg, origSvg);
sa(btn, A_IC, iconName);
const sig = eqSig || iconPendSig.get(btn);
iconPendSig.delete(btn);
if (sig) iconSigMap.set(btn, { s: sig, p: btn[K_PE], v: origSvg });
};

const streamChoreoCtl = mkCtl(streamChoreoMod?.createStreamChoreographyController, {
motionEngine, isComposerRestyleEnabled: isCompOn,
isMotionStandardOrUltra, isMotionUltra, isConvRunning, isThoughtIsolatedNode, isThoughtMutationRecord, isManagedThoughtPanel,
cloneCachedSvgElement: (k, s) => modelGlyphCtl.cloneCachedSvgElement(k, s),
buildBrandMarkSvg: (b, sz, tr, m) => modelGlyphCtl.buildBrandMarkSvg(b, sz, tr, m),
applySingleHostIcon, rippleCtl, convAuraCtl, notifyMascot,
}, mkStub('syncDualStreamEngine|triggerHeroDFiberPulse|syncThinkingSparks|enqueueDeferredIcons|findFormalConvView|sampleHomeComposerRect|isEntryMotionSuppressed|cancelDeferredHydration|scheduleDeferredConvEntry|syncHeroRouteChoreography|syncSidebarSelectionGlide|syncHeroCCaustics|syncLensOverlayOrigins|syncWorkedForAutoUnfold|triggerHomeLiftoffRippleBurst|triggerHeroESonar|scheduleWorkedForClickSync|lockSidebarRowRunningOnPointerDown|stampSidebarRowRunningImmediate|prepareConvPressDip|prepareConvSwitchExit|triggerSplitTransition|triggerSendLaunch|clearTransientTimers|disconnectStreamObserver|flushAllStreamArtifacts|clearWorkedForAutoUnfoldAttrs|suppressEntryMotion', {
heroState: { wasInHome: false, wasInFormalConv: false, lastModelSig: null, pendingModelShiftNotify: false, lastTriggerOrigin: null, lastGroupPress: null },
scheduleTransient: (fn, ms) => ST(fn, ms), measureSidebarSelectionSnapshot: () => ({ empty: true }),
measureVisibleChangedHeaders: () => [], measureNewLensOverlays: () => [], isStreamMutating: () => false, hasStreamObserver: () => false,
}));
const syncMP = (m) => safe(() => modelGlyphCtl.syncModelSelectorPanel?.(m)), syncWf = (s) => streamChoreoCtl.syncWorkedForAutoUnfold(s), syncDs = () => streamChoreoCtl.syncDualStreamEngine(), stSbRun = (r) => streamChoreoCtl.stampSidebarRowRunningImmediate?.(r), trigLift = () => streamChoreoCtl.triggerHomeLiftoffRippleBurst();

// Root Attrs & Sync
let lastThemeKey = '';
let lastAppliedLang = '';
let lastAppliedMotion = '';
let lastAppliedTelemetry = '';
let lastMetricsKey = '';
let lastAbsorbedSyncKey = '';
const MOTION_OFF_STYLE_ID = 'ag-prism-motion-off-css';

function flattenMainStyleSheet() {
if (typeof CSS !== 'undefined' && CSS.supports?.('selector(&)')) return;
const el = document.getElementById?.('ag-prism-css'), rules = el?.sheet?.cssRules, key = el?.getAttribute?.('data-ag-cs-css-hash') || CODE_HASH || '1';
if (!rules?.length || el.getAttribute?.('data-ag-cs-flat') === key + ':' + (el.textContent || '').length) return;
const scan = (s, st, fn) => {
for (let i = st, q = ''; i <= s.length; i++) {
const c = s[i];
if (c === '\\') { i++; continue; }
if (q) { if (c === q) q = ''; continue; }
if (c === '"' || c === "'") { q = c; continue; }
if (fn(c, i)) return i;
}
return -1;
};
const splitC = (s) => {
const out = []; let d = 0, st = 0;
scan(s, 0, (c, i) => {
if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--;
else if ((!c || (c === ',' && !d)) && i >= st) { const t = s.slice(st, i).trim(); if (t) out.push(t); st = i + 1; }
});
return out;
};
const expIs = (s) => {
let br = 0, nd = 0; const stk = [];
const idx = scan(s, 0, (c, i) => {
if (!c) return;
if (c === '[') br++; else if (c === ']') br && br--;
else if (!br) {
if (c === '(') { const n = s.slice(i - 4, i) === ':not'; if (n) nd++; stk.push(n); }
else if (c === ')') { if (stk.pop()) nd--; }
else if (!nd && c === ':' && s.slice(i, i + 4) === ':is(') return 1;
}
});
if (idx < 0) return [s];
let d = 0;
const end = scan(s, idx + 3, (c) => (c === '(' ? (d++, 0) : c === ')' && !--d));
if (end < 0) return [s];
const parts = splitC(s.slice(idx + 4, end));
if (!parts.length || parts.length > 40 || (parts.length === 1 && /[\s>+~]/.test(parts[0]))) return [s];
const pre = s.slice(0, idx), post = s.slice(end + 1), res = [];
for (const p of parts) for (const sub of expIs(pre + p + post)) if (res.push(sub) > 200) return [s];
return res;
};
const expSel = (s) => splitC(s).flatMap(expIs).join(',');
const walk = (rs, ps) => {
const out = [];
for (const r of rs) {
const { type: tp, selectorText: sl, style: sy, cssRules: cr, conditionText: ct, cssText: tx } = r;
if (tp === 1) {
let sel = sl;
if (ps) sel = splitC(ps).flatMap((p) => splitC(sel).map((c) => { const fi = c.indexOf('&'); return fi < 0 ? p + ' ' + c : fi === 0 && c.indexOf('&', 1) < 0 ? p + c.slice(1) : c.replace(/&/g, ':is(' + p + ')'); })).join(',');
if (sy?.cssText) out.push(expSel(sel) + '{' + sy.cssText + '}');
if (cr?.length) out.push(...walk(cr, sel));
} else if (tp === 4 || tp === 12) {
const inner = walk(cr || [], ps);
if (inner.length) out.push((tp === 4 ? '@media ' : '@supports ') + ct + '{' + inner.join('\n') + '}');
} else if (!sl && sy?.cssText && ps) out.push(expSel(ps) + '{' + sy.cssText + '}');
else if (tx) out.push(tx);
}
return out;
};
try {
const flat = walk(rules, '').join('\n');
if (flat) runGuardedMut(() => { el.textContent = flat; el.setAttribute?.('data-ag-cs-flat', key + ':' + flat.length); });
} catch {}
}

const syncMotionOffStyle = (isOff) => {
const el = byId(MOTION_OFF_STYLE_ID);
if (!isOff) return el?.remove?.();
const s = !el && mkEl('style');
if (s) {
s.id = MOTION_OFF_STYLE_ID; sa(s, 'data-ag-owned', '1');
s.textContent = getDomBus()?.MOTION_OFF_SCOPED_CSS || 'html[data-ag-cs-style][data-ag-cs-motion="off"] :is(button,[role="button"],.agy-overlay,.surface-composer-card,.ag-cs-stream-chunk,.ag-cs-thought-chunk,.ag-cs-code-scan,[data-testid="status-loading-spinner"]){animation:none!important;transition:none!important}';
(D.head || de())?.appendChild?.(s);
}
};
const refreshOpenUiForLanguage = () => {
const inHero = !!(qs(D, '.agy-home [data-testid="home-greeting"]'));
if (inHero && isStudioHome() && !getHomeStudioMod()) requestHomeStudioChannelIfNeeded();
homeStudioCtl.syncGreeting(inHero);
if (inHero && isStudioHome()) { homeStudioCtl.renderHomePanel(true); const hp = qs(D, '.ag-cs-home-panel'); if (hp) { setAttrIfChanged(hp, A_PB, '1'); setAttrIfChanged(hp, A_PM, '1'); } }
syncComposers(null); ensureSettingsSection();
safe(() => { hostEnhancerCtl.onThemeChange?.(false); hostEnhancerCtl.sync?.(); });
syncAbsorbedModules(); syncMP(latestPrimaryModelInfo); ensurePulseBridge(true);
};
const syncMotionSpringTokens = () => {
const h = de();
if (!isFn(h?.style?.setProperty) || !isFn(motionEngine?.springLinear)) return;
safe(() => { const r = motionEngine.springLinear({ stiffness: 420, damping: 32, mass: 1 }), easing = typeof r === 'string' ? r : r?.easing; if (easing) { sp(h, '--ag-spring-sidebar-ease', easing); sp(h, '--ag-spring-sidebar-dur', `${rd((typeof r === 'object' && r?.durationMs) || 300)}ms`); } });
};
function syncAbsorbedModules(force = false) {
const tel = getTel(), eff = W.__agPrismEffortSlider, th = getTh(), thUi = W.__agPrismThoughtSettingsUi;
const omni = W.__agPrismOmni, meta = W.__agPrismOmniServerMeta || null, sb = W.__agPrismSidebar, sbMeta = W.__agPrismSidebarMeta || null;
const ctxMenu = getCtx(), hiInst = W.__agPrismHostI18n, vt = wMod('__agPrismSidePanelVtabs');
ownedCtxMenu = ctxMenu || null;
const motionLv = getMotionLevel(), ctxEnabled = cfg.contextMenu !== false && cfg.contextMenu !== 'off' && !destroyed, hiMode = aoMode('hostLocalization'), curLang = getLang(), vtOn = cfg.sidePanelVerticalTabs === 'on';
const key = [VERSION, curLang, motionLv, getTelemetryMode(), cfg.telemetryQuotaMode, aoMode('effortSliderModule'), onOffMode('effortMemory'), hiMode, getThoughtTranslateMode(), cfg.thoughtTrigger === 'expand' ? 'expand' : 'preload', getThoughtView(), onOffMode('omniModule'), getLinkTarget(), +(cfg.sidebarStudio === 'on'), +ctxEnabled, +vtOn, meta?.baseUrl || '', sbMeta?.version || '', +!!sbMeta?.serviceReady, +!!tel, +!!eff, +!!hiInst, +!!th, +!!thUi, +!!omni, +!!sb, +!!ctxMenu, +!!vt].join('|');
if (!force && key === lastAbsorbedSyncKey) return;
lastAbsorbedSyncKey = key;
safe(() => tel?.sync?.(cfg)); safe(() => eff?.sync?.(cfg));
safe(() => { if (hiMode === 'auto' && curLang !== 'zh-CN' && curLang !== 'tr') { hiInst?.destroy?.(); ra(de(), 'data-ag-prism-host-i18n'); } else if (isFn(hiInst?.setMode)) hiInst.setMode(hiMode === 'on' ? 'on' : hiMode === 'off' ? 'off' : 'auto'); });
safe(() => th?.sync?.(cfg)); safe(() => (onOffMode('omniModule') === 'off' ? omni?.destroy?.() : omni?.sync?.(cfg, meta)));
safe(() => sb?.sync?.(cfg, sbMeta)); safe(() => ctxMenu?.sync?.({ enabled: ctxEnabled, lang: curLang, motionLevel: motionLv }));
safe(() => (!vtOn ? (vtReqAt = 0, vt?.destroy?.()) : vt?.sync ? vt.sync(cfg) : (vtReqAt = reqCh('request-side-panel-vtabs', vtReqAt))));
safe(() => byId(SETTINGS_SEC_ID)?.__prismMountThoughtUi?.());
}

const markRim = (d) => prismRimCtl.markDirty(d), invRim = () => { prismRimCtl.invalidateMetrics?.(); markRim(); };
const getThemeKey = () => `${getEffectivePalette()}|${getLightPreset()}|${isDarkTheme() ? 'd' : 'l'}|${getAccentTone()}|${getAmbientIntensitySetting()}|${cfg.darkAura}|${cfg.darkAuraStyle}|${getCornerStyle()}`;
function applyRootAttrs(forceAbsorbed = false) {
const html = de();
if (!html) return;
const pal = getEffectivePalette(), lp = getLightPreset(), lang = getLang(), mLv = getMotionLevel(), pm = normPerfMode(cfg.performanceMode);
const tf = getTargetFps(), tel = getTelemetryMode(), eff = aoMode('effortSliderModule'), dk = isDarkTheme();
const acc = getAccentTone(), cn = getCornerStyle(), cf = getCodeFont(), lig = isCodeLigaturesEnabled() ? '1' : '0', amb = getAmbientIntensitySetting();
runGuardedMut(() => {
const csA = {
style: '1', theme: dk ? 'dark' : 'light', palette: pal, 'light-preset': lp, motion: mLv,
'perf-mode': pm, 'target-fps': tf, telemetry: tel, 'telemetry-quota': cfg.telemetryQuotaMode, 'effort-slider': eff,
'thought-translate': getThoughtTranslateMode(), accent: acc, corners: cn,
'scroll-bottom': cfg.scrollBottomMotion, 'code-font': cf, ligatures: lig,
ambient: String(Number(amb) / 100), 'dark-aura': cfg.darkAura, 'dark-aura-style': cfg.darkAuraStyle, home: cfg.homeLayout,
composer: cfg.composer, 'logo-ink': cfg.logoInk === 'foreground' ? 'foreground' : 'accent',
sidebar: cfg.sidebar, 'sidebar-compact': cfg.sidebarCompact ? 'on' : 'off', 'sb-fold': cfg.sidebarNavFold, 'side-panel-vertical-tabs': cfg.sidePanelVerticalTabs, lang,
};
for (const [k, v] of O.entries(csA)) setAttrIfChanged(html, 'data-ag-cs-' + k, v);
for (const [k, v] of [['', VERSION], ['-omni', onOffMode('omniModule')], ['-link-target', getLinkTarget()], ['-sidebar-studio', cfg.sidebarStudio]]) setAttrIfChanged(html, 'data-ag-prism' + k, v);
if (cfg.sidebarRestyle === false) { tA(html, 'data-ag-cs-sidebar-collapsed', false); rmAll('.ag-cs-sidebar-glide-pill'); }
tA(html, 'data-ag-cs-cjk', isFn(i18nCore?.isCjkLanguage) ? i18nCore.isCjkLanguage(lang) : isZh());
syncMotionOffStyle(mLv === 'off');
getDomBus()?.applyPerformanceMode?.(cfg.performanceMode, D, W);
const igRm = !!cfg.ignoreReducedMotion, igFn = W.__agPrismApplyIgnoreReducedMotion;
if (isFn(igFn)) igFn(igRm, D, W);
else tA(html, 'data-ag-cs-ignore-rm', igRm);
safe(() => wMod('__agPrismFontCustomizer')?.applyCustomFonts?.(cfg, D));
safe(() => wMod('__agPrismCssMgr')?.sync?.(cfg));
syncAbsorbedModules(forceAbsorbed);
tA(html, 'data-ag-prism-thought-view', getThoughtTranslateMode() !== 'off', getThoughtView());
syncCaretListeners(isCaretOn());
if (tel !== lastAppliedTelemetry) { const p = lastAppliedTelemetry; lastAppliedTelemetry = tel; if (p) ensurePulseBridge(tel !== 'off'); }
const refreshOptics = () => { rippleCtl.refreshTheme(); convAuraCtl.sync(); convAuraCtl.refreshTheme(); invRim(); };
const mKey = `${mLv}|${+igRm}|${pm}`;
if (mKey !== lastAppliedMotion) {
const p = lastAppliedMotion; lastAppliedMotion = mKey;
if (p) safe(() => rippleCtl.sync?.());
refreshOptics();
if (p) { dirtyFlags.c = true; syncHostAnimatedIcons(null); syncDs(); syncMP(latestPrimaryModelInfo); }
}
if (lang !== lastAppliedLang) { const p = lastAppliedLang; lastAppliedLang = lang; if (p) refreshOpenUiForLanguage(); }
const tKey = getThemeKey();
if (tKey !== lastThemeKey) { lastThemeKey = tKey; refreshOptics(); safe(() => hostEnhancerCtl.onThemeChange?.()); }
const mtKey = `${lang}|${cfg.chatFont}|${cfg.chatFontCustom}|${cf}|${cfg.codeFontCustom}|${lig}|${cn}|${+isCompOn()}|${pm}`;
if (mtKey !== lastMetricsKey) { const h = lastMetricsKey !== ''; lastMetricsKey = mtKey; if (h) { invRim(); smoothCaretCtl.bumpMetricsEpoch(); smoothCaretCtl.queue(false, true, true); } }
});
}

// Composer Box & Clearance
const T_TK = 'interaction-takeover-card', T_RP = 'running-items-panel', T_QM = 'queued-messages-card', T_SQ = 'side-question-panel', S_RP = '[data-testid="running-items-panel"]', S_SUB = '[data-testid="subagent-tab-conversation"],[data-testid="side-question-tab-conversation"]'; /* @host-compat */
const TK_SEL = '[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"], .agy-takeover-frame', S_AQO = '[data-testid="ask-question-option"]', A_Q = 'data-ag-cs-queued', A_QA = 'data-ag-queued-act', A_TK = 'data-ag-cs-takeover', A_TKO = A_TK + '-open', A_TT = 'data-ag-cs-top-toolbar', S_TB = '[data-testid="input-box-bottom-toolbar"]', A_PB = 'data-ag-cs-prism-box', A_PM = 'data-ag-cs-prism-mirror';
const findTkCards = (sc) => {
if (!sc) return [];
const out = [], seen = new Set(), add = (e) => { if (e && !seen.has(e)) { seen.add(e); out.push(e); } };
for (const e of qa(sc, TK_SEL)) { if (!e[K_PE] || !cl(e[K_PE], TK_SEL)) add(e); }
for (const o of qa(sc, S_AQO)) { const h = cl(o, TK_SEL) || cl(o, '.agy-takeover-card') || o[K_PE]; if (h && h !== sc && h !== D.body && !qs(h, S_IB)) add(h); }
return out;
};
const seenClrWraps = new WeakSet();
const setClr = (el, a, on, gap = '46px') => {
if (!el) return;
if (on) {
seenClrWraps.add(el); setAttrIfChanged(el, a, '1');
const mb = gp(el, 'margin-bottom');
if (gap) { if (mb !== gap) sp(el, 'margin-bottom', gap, 'important'); } else if (mb) rp(el, 'margin-bottom');
} else if (ha(el, a)) { ra(el, a); rp(el, 'margin-bottom'); }
};
const isRunOpen = (el) => tidOf(el) === T_RP && incS(clsOf(el), 'grid-rows-[1fr]');
const gp = (el, p) => el?.style?.getPropertyValue?.(p) || el?.style?.[p] || '';
const csOf = (el, m) => { if (!el) return null; if (m?.has(el)) return m.get(el); let c = null; try { c = W.getComputedStyle?.(el) || null; } catch {} m?.set(el, c); return c; };
const styV = (el, p, m) => gp(el, p) || csOf(el, m)?.[p] || '';
const isCt = (el, m) => { const d = styV(el, 'display', m); return d === 'contents' || (!d && clHas(el, 'contents')); };
const isHidEl = (el, lay, m) => {
if (!isElementLike(el) || el.hidden || ha(el, 'hidden') || ga(el, 'aria-hidden') === 'true' || /(?:^|\s)(?:hidden|sr-only|grid-rows-\[0fr\]|h-0|max-h-0)(?:\s|$)/.test(clsOf(el))) return true;
const sd = gp(el, 'display'), sv = gp(el, 'visibility');
if (sd === 'none' || sv === 'hidden') return true;
const cs = !sd || !sv ? csOf(el, m) : null, dp = sd || cs?.display || '', vs = sv || cs?.visibility || '';
if (dp === 'none' || vs === 'hidden') return true;
if (dp === 'contents' || (!dp && clHas(el, 'contents')) || !lay || isRunOpen(el)) return false;
if (isFn(el.checkVisibility) && !el.checkVisibility()) return true;
const r = rc(el);
return !!(r && (r.height <= 1 || r.width <= 1));
};
const hasVisQ = (el, lay, d = 0, m = null) => {
if (!el || d > 4 || /(?:^|\s)ag-(?:cs|v2|prism|omni|pulse)-/.test(clsOf(el) + ' ' + (el.id || ''))) return false;
if (isHidEl(el, lay, m)) {
const p = lay && !isHidEl(el, false, m) && qs(el, S_RP);
if (!p || !isRunOpen(p)) return false;
for (let c = p; c && c !== el; c = c[K_PE]) if (isHidEl(c, false, m)) return false;
return true;
}
const t = tidOf(el);
if (t === T_RP) return incS(clsOf(el), 'grid-rows-[1fr]');
if (t === T_QM) return true;
const ch = chOf(el), clen = ch ? ch.length : 0;
if (!clen) return !!(el[K_TC] || '').trim() || /^(?:IMG|SVG|CANVAS|INPUT|TEXTAREA|BUTTON)$/.test(tagU(el));
const cn = el.childNodes;
if (cn) for (let i = 0; i < cn.length; i++) if (cn[i]?.nodeType === 3 && String(cn[i].nodeValue || '').trim()) return true;
for (let i = 0; i < clen; i++) if (hasVisQ(ch[i], lay, d + 1, m)) return true;
return false;
};
const findVisQueuedCard = (el, lay, m) => {
if (!el || isHidEl(el, lay, m)) return null;
const q = tidOf(el) === T_QM ? el : qs(el, `[data-testid="${T_QM}"]`);
if (!q || isHidEl(q, lay, m)) return null;
for (let c = q[K_PE]; c && c !== el; c = c[K_PE]) if (isHidEl(c, lay, m)) return null;
return q;
};
const syncModelMenuRootAttrs = (panel) => {
const h = de();
if (panel) { h && setAttrIfChanged(h, 'data-ag-cs-model-menu', '1'); const ov = cl(panel, '.agy-overlay'); ov && setAttrIfChanged(ov, 'data-ag-cs-model-overlay', '1'); }
else { ra(h, 'data-ag-cs-model-menu'); raAll('data-ag-cs-model-overlay'); }
};
const measureTopToolbarZone = (tb, card, ib, m) => {
const cr = rc(card) || rc(ib), sw = rd(cr?.width || card?.offsetWidth || 0), spans = [];
if (!tb || !cr || sw <= 0) return [0, 0, 0];
for (const b of qa(tb, 'button,[role="button"],a')) {
const r = !isHidEl(b, false, m) && rc(b);
if (r && r.width > 1 && r.height > 1) {
const l = mx(0, r.left - cr.left), u = mn(sw, r.right - cr.left);
if (u > l + 1) spans.push([mx(0, l - 6), mn(sw, u + 8)]);
}
}
if (!spans.length) return [0, 0, 0];
spans.sort((a, b) => a[0] - b[0]);
let b0 = 0, b1 = 0, bw = 0, cur = 0;
for (const [l, u] of spans) { if (l - cur > bw) { b0 = cur; b1 = l; bw = l - cur; } if (u > cur) cur = u; }
if (sw - cur > bw) { b0 = cur; b1 = sw; bw = sw - cur; }
return bw < 104 ? [0, 0, 1] : [rd(b0), rd(sw - b1), 0];
};
const measureCardClr = (card, ib, act, isPri = true, m = null, pTk = null, skipLay = false) => {
if (!ib) return null;
const inSub = !!(cl(ib, S_SUB)), ea = !!(act && !inSub && ga(de(), 'data-ag-prism-mode') !== 'chat'), og = !inSub && !!isPri;
const mo = !!(ea && qs(ib, '[role="listbox"], [role="option"], [data-testid="slash-command-menu"]'));
let _lay = skipLay ? false : undefined, low = false, visTk = false, queuedAnchor = null, queuedRoofH = 0, ttZ = [0, 0, 0], seenTt = false;
const getLay = () => (_lay ??= (card?.offsetHeight || rc(card)?.height || 0) > 0), sh = cl(card, '#antigravity\\.agentSidePanelInputBox') || card[K_PE], ops = [];
const pushOp = (el, a, on, g = '46px') => ops.push([el, a, on, g]);
const pq = (el, ok) => { const on = ea && ok && !low; pushOp(el, A_Q, on); if (on) low = true; };
if (sh && sh !== ib) {
for (const ch of chOf(sh) || []) {
if (ch === card) break;
const p = tidOf(ch) === T_RP ? ch : qs(ch, S_RP);
if (p) pq(ch, !!(isRunOpen(p) && !isHidEl(ch, false, m) && !isHidEl(p, false, m)));
else {
const tb = tidOf(ch) === 'input-box-bottom-toolbar' ? ch : qs(ch, S_TB);
const ttOn = !!(ea && !seenTt && tb && !isHidEl(ch, getLay(), m) && !isHidEl(tb, getLay(), m));
if (ttOn) { seenTt = true; if (!skipLay) ttZ = measureTopToolbarZone(tb, card, ib, m); }
pushOp(ch, A_TT, ttOn, '');
}
}
for (const oldTt of qa(sh, '[' + A_TT + ']')) if (!ops.some(([el, a]) => a === A_TT && el === oldTt)) pushOp(oldTt, A_TT, false, '');
}
let stop = sh && sh !== ib ? sh : card;
while (stop?.[K_PE] && stop[K_PE] !== ib) stop = stop[K_PE];
const ibC = chOf(ib);
let stopIdx = -1;
if (ibC) for (let i = 0, n = ibC.length; i < n; i++) if (ibC[i] === stop) { stopIdx = i; break; }
for (let i = stopIdx - 1; i >= 0; i--) {
const ch = ibC[i], qCard = ea && !low && !queuedAnchor ? findVisQueuedCard(ch, getLay(), m) : null;
if (qCard) {
queuedAnchor = qCard;
if (getLay()) queuedRoofH = rd(qCard.offsetHeight || rc(qCard)?.height || 0);
pushOp(ch, A_Q, false);
continue;
}
pq(ch, hasVisQ(ch, getLay(), 0, m));
}
const slot = clHas(ib[K_PE], 'contents') ? ib[K_PE] : ib, wrap = slot[K_PE], scope = og ? (cl(ib, S_CV) || D) : wrap;
if (scope) {
const seen = new Set();
let all = findTkCards(scope);
if (og && !all.length && scope !== D) all = findTkCards(D).filter((c) => isTkInScope(c, scope));
for (let i = all.length - 1; i >= 0; i--) {
const c = all[i]; if (!inSub && cl(c, S_SUB)) continue;
let tgt = c, hid = false;
for (let cur = c, d = 0; cur && cur !== scope && cur !== D.body && d < 5; cur = cur[K_PE], d++) {
if (isHidEl(cur, false, m)) hid = true;
if (wrap && cur[K_PE] === wrap && cur !== slot && !isCt(cur, m) && !qs(cur, S_IB)) tgt = cur;
}
if (tgt === c) {
const p = c[K_PE];
if (p && p !== scope && p !== wrap && p !== D.body && p !== ib && !tidOf(p) && chOf(p)?.length === 1 && !isCt(p, m) && !qs(p, S_IB)) {
const pos = styV(p, 'position', m);
if (!(pos ? pos === 'absolute' || pos === 'fixed' : /(?:^|\s)(?:absolute|fixed)(?:\s|$)/.test(clsOf(p)))) tgt = p;
}
}
if (!hid) visTk = true;
if (seen.has(tgt)) continue;
const on = ea && !hid && !low;
if (og && on) pTk?.add(tgt);
if (og || !pTk?.has(tgt)) pushOp(tgt, A_TK, on, tgt === c && (tidOf(c) === T_TK || clHas(c, 'agy-takeover-frame')) ? '52px' : '46px');
if (on) low = true;
seen.add(tgt);
}
for (const s of qa(scope, '[' + A_TK + ']')) if (!seen.has(s) && (inSub || !cl(s, S_SUB)) && (og || !pTk?.has(s))) pushOp(s, A_TK, false);
}
return { ib, mo, ops, og, tko: og && ea && visTk, qa: queuedAnchor, qh: queuedRoofH, tt: seenTt, ttZ };
};
const syncCrabClearance = (card, ib, act, isPri = true, pl = null) => {
const p = pl || measureCardClr(card, ib, act, isPri);
if (!p) return;
tA(p.ib, 'data-ag-cs-menu-open', p.mo);
for (const [el, a, on, g] of p.ops) setClr(el, a, on, g);
if (p.og) tA(de(), A_TKO, p.tko);
};

let activePaneCard = null, activeConvView = null, lastNotifiedPaneCard = null, lastNotifiedConvView = null;
const lastModelByCard = new WeakMap();
const isLiveMainCard = (c) => !isDis(c) && !cl(c, S_SUB) && !c.hidden && c.style?.display !== 'none';
const isLiveMainConv = (v) => isLiveMainCard(v) && !cl(v, '.agy-home') && !qs(v, '.agy-home');
const isTkInScope = (e, sc) => !cl(e, S_SUB) && !(sc && cl(e, S_CV) && cl(e, S_CV) !== sc);
const findCardForTarget = (t) => {
if (!t?.closest) return null;
const qCC = `${S_IBCC},${S_CC}`, c0 = cl(t, S_CC) || qs(cl(t, S_IB), S_CC);
if (isLiveMainCard(c0)) return c0;
for (const s of [S_CV, '[data-tiling-pane]', '[data-side-panel-body]']) {
const h = cl(t, s), c = h && (s !== S_CV || !cl(h, S_SUB)) ? qs(h, qCC) : null;
if (isLiveMainCard(c)) return c;
}
const tk = cl(t, TK_SEL);
if (tk && !cl(tk, S_SUB)) for (let p = tk[K_PE], d = 0; p && p !== D.body && d < 5; p = p[K_PE], d++) {
const pt = tidOf(p); if (pt === 'aux-pane-split' || pt === 'sidebar-split') break;
const c = qs(p, qCC); if (isLiveMainCard(c)) return c;
}
return null;
};
const findConvForTarget = (t, fb = null) => {
const cv = cl(t, S_CV) || cl(fb, S_CV) || qs(cl(t, '[data-tiling-pane]'), S_CV) || null;
return isLiveMainConv(cv) ? cv : null;
};
const canHopFocus = (target, targetCard, currentCard, cards) => { const fn = getMascotHop()?.shouldTransferMascotFocus; return !isFn(fn) || !!fn({ target, targetCard, currentCard, cards, doc: D })?.allow; };
const setPbHost = (h) => safe(() => (pulseBridgeInst || W.__agCsPulseBridgeInst)?.setActiveHost?.(h));
const notifyActivePaneModules = (card, cv, force = false) => {
const nc = isLiveMainCard(card) ? card : null, nv = isLiveMainConv(cv) ? cv : findConvForTarget(nc, nc);
if (!force && nc === lastNotifiedPaneCard && nv === lastNotifiedConvView) return;
lastNotifiedPaneCard = nc; lastNotifiedConvView = nv;
const anc = nv || nc;
if (nv) safe(() => convAuraCtl.setActiveView?.(nv));
if (anc) {
const bar = safe(() => { const tel = getTel(); return tel?.setActiveBar?.(anc) || tel?.getBarForView?.(anc) || null; }) || null;
setPbHost(bar || anc);
}
};
const trackActivePaneFromTarget = (t, sched = true) => {
if (destroyed || !t?.closest || cl(t, '#' + SETTINGS_SEC_ID + ',#ag-prism-periodic-picker-root,' + S_DLG)) return false;
const nc = findCardForTarget(t), nv = findConvForTarget(t, nc);
if (!nc && !nv) return false;
if (nc && isMascotEnabled() && !canHopFocus(t, nc, activePaneCard || msAnc, AF(qa(D, S_IBCC)).filter(isLiveMainCard))) return false;
const chg = (nc && nc !== activePaneCard) || (nv && nv !== activeConvView);
if (nc) activePaneCard = nc;
if (nv) activeConvView = nv;
if (chg) { notifyActivePaneModules(activePaneCard, activeConvView); if (sched) { dirtyFlags.c = true; scheduleSync(); } return true; }
return false;
};
const resolveActivePrimaryCard = (cards) => {
if (!cards?.length) { activePaneCard = null; if (activeConvView && !isLiveMainConv(activeConvView)) activeConvView = null; return null; }
if (activePaneCard && incS(cards, activePaneCard) && isLiveMainCard(activePaneCard)) return activePaneCard;
const hop = getMascotHop(), ac = findCardForTarget(D.activeElement);
const acOk = ac && incS(cards, ac) && canHopFocus(D.activeElement, ac, null, cards);
const pick = (acOk ? ac : null) || cards.find((c) => !cl(c, S_SUB) && !hop?.isSidePanelElement?.(c)) || cards.find((c) => !cl(c, S_SUB)) || cards[0] || null;
activePaneCard = pick && !cl(pick, S_SUB) ? pick : null;
const cv = findConvForTarget(activePaneCard, activePaneCard);
if (cv) activeConvView = cv; else if (activeConvView && !isLiveMainConv(activeConvView)) activeConvView = null;
return pick;
};

let latestPrimaryModelInfo = null, latestPaneModelMap = new Map(), lastSyncedAwaitingDecision = null, lastSyncedHasError = false;
const detectVisibleDecisionTakeover = (m = null, sc = null, incAttr = false) => {
if (sc && isLiveMainConv(sc)) for (const el of findTkCards(sc)) if (!cl(el, S_SUB) && !isHidEl(el, false, m)) return true;
for (const el of incAttr ? [...findTkCards(D), ...qa(D, `[${A_TK}="1"]`)] : findTkCards(D)) if (isTkInScope(el, sc) && !isHidEl(el, false, m)) return true;
return false;
};
const measureCrabClearanceAll = (skipLay = false) => {
const cs = AF(qa(D, S_IBCC)), pc = resolveActivePrimaryCard(cs), pv = findConvForTarget(pc, pc);
const mOn = isMascotEnabled(), m = new Map(), pTk = new Set(), bc = new Map();
for (const c of pc ? [pc, ...cs.filter((x) => x !== pc)] : cs) bc.set(c, measureCardClr(c, cl(c, S_IB), c === pc && mOn, c === pc, m, pTk, skipLay));
return { cs, pc, pv, bc, ad: detectVisibleDecisionTakeover(m, pv) };
};
const syncConvAuraSemantics = (activeInfo, preAwaiting) => {
if (!isFn(convAuraCtl.setSemanticState)) return;
const awaitingNow = typeof preAwaiting === 'boolean' ? preAwaiting : detectVisibleDecisionTakeover(), errNow = !!(activeInfo?.e), freshErrorEdge = errNow && !lastSyncedHasError;
lastSyncedHasError = errNow;
if (awaitingNow !== lastSyncedAwaitingDecision || freshErrorEdge) { lastSyncedAwaitingDecision = awaitingNow; convAuraCtl.setSemanticState({ awaitingDecision: awaitingNow ? true : null, hasError: freshErrorEdge }); }
};
const clrPb = (e) => { ra(e, A_PB); rp(e, '--ag-px'); rp(e, '--ag-py'); };
const Q_RIM_SEL = '[data-testid="queued-messages-card"], [data-testid="interaction-takeover-card"]';
const syncQueuedPrismBoxes = () => {
const qCards = qa(D, Q_RIM_SEL + ', .agy-takeover-frame');
if (!qCards?.length) return;
const allow = isCompOn() && ga(de(), 'data-ag-prism-mode') !== 'chat', AR = 'data-ag-cs-prism-reflect';
let anyNew = false, anyOff = false;
for (const q of qCards) {
if (q[K_PE] && cl(q[K_PE], '[data-testid="interaction-takeover-card"],.agy-takeover-frame')) continue;
if (allow && !cl(q, S_SUB)) {
if (ga(q, A_PB) !== '1' || ga(q, AR) !== 'bottom') anyNew = true;
setAttrIfChanged(q, A_PB, '1'); setAttrIfChanged(q, AR, 'bottom');
} else if (ha(q, A_PB) || ha(q, AR)) { clrPb(q); ra(q, AR); anyOff = true; }
}
if (anyNew) { const mn = prismRimCtl.mountNewBoxes; mn ? mn() : invRim(); }
else if (anyOff) invRim();
};
const syncPopupOverlayMirrors = () => {
const ovs = qa(D, '.agy-overlay');
if (!ovs?.length) return;
let touched = false;
for (const ov of ovs) {
if (ha(ov, 'data-hover-card-popup') || tidOf(ov) === 'model-selector-panel' || ga(ov, 'data-ag-cs-model-overlay') === '1' || (ga(ov, 'role') !== 'menu' && !clHas(ov, 'max-h-48'))) continue;
if (ga(ov, A_PB) !== '1' || ga(ov, A_PM) !== '1') touched = true;
setAttrIfChanged(ov, A_PB, '1'); setAttrIfChanged(ov, A_PM, '1');
}
if (touched) markRim();
};

function syncComposers(measured, skipSparks = false) {
const cp = measured?.cp || measureCrabClearanceAll(), cards = cp.cs, primaryCard = cp.pc, primaryConv = cp.pv, ui = uiText(getLang()), mascotOn = isMascotEnabled(), hs = streamChoreoCtl.heroState, mg = modelGlyphCtl;
if (!measured) syncModelMenuRootAttrs(qs(D, MODEL_PANEL_SEL));
if (!primaryCard || cl(primaryCard, S_SUB)) tA(de(), A_TKO, false);
const inHomeCtx = !!qs(D, '.agy-home'), basePathCtx = (inHomeCtx ? 'H:' : 'C:') + (W.location?.pathname || ''), paneModelMap = new Map();
let primaryModelInfo = null;
for (const card of cards) {
const inputBox = cl(card, S_IB), zLayer = cl(inputBox, '.z-10'), isPrimary = card === primaryCard, inSubCard = !!cl(card, S_SUB);
if (zLayer) setAttrIfChanged(zLayer, 'data-ag-cs-input-layer', '1');
const wantPrismBox = isCompOn() && isLiveMainCard(card);
if (wantPrismBox) {
if (ga(card, A_PB) !== '1') markRim();
setAttrIfChanged(card, A_PB, '1');
} else if (ha(card, A_PB)) {
clrPb(card); invRim();
}
syncCrabClearance(card, inputBox, mascotOn && isPrimary, isPrimary, cp.bc.get(card) || null);
const p = qs(card, 'div.relative.w-full p.pointer-events-none');
tA(p, 'data-ag-cs-placeholder', isCompOn() && cfg.placeholderStyle === 'studio', ui.studioPlaceholder || 'How can I help you today?');
const modelBtn = qs(card, '[data-testid="model-selector-trigger"]'), mInfo = mg.syncModelGlyphOnButton(modelBtn);
if (mInfo && !inSubCard) {
if (isPrimary) primaryModelInfo = mInfo;
const cardCv = cl(card, S_CV), cardPane = cl(card, '[data-tiling-pane]'), paneBrand = mInfo.brand || 'gemini';
if (cardCv) { setAttrIfChanged(cardCv, 'data-ag-cs-pane-camp', paneBrand); paneModelMap.set(cardCv, mInfo); }
if (cardPane) setAttrIfChanged(cardPane, 'data-ag-cs-pane-camp', paneBrand);
const cleanLbl = mg.readButtonLabelWithoutGlyph(modelBtn);
if (cleanLbl) {
const normLbl = mg.normalizeModelEffortLabel?.(cleanLbl) ?? cleanLbl, modelSig = `${mInfo.brand}:${lcw(normLbl)}`;
const cardCid = ga(cardCv, 'data-cascade-id') || ga(cl(card, '[data-cascade-id]'), 'data-cascade-id') || '';
const cardCtx = basePathCtx + (cardCid ? '#' + cardCid : '');
const dd = ga(modelBtn, 'data-disabled');
const prev = lastModelByCard.get(card);
if (!prev || prev.ctx !== cardCtx || modelSig !== prev.sig) {
lastModelByCard.set(card, { sig: modelSig, ctx: cardCtx });
if (prev && prev.ctx === cardCtx && !(modelBtn.disabled || ha(modelBtn, 'disabled') || ga(modelBtn, 'aria-disabled') === 'true' || (dd != null && dd !== 'false'))) {
if (isPrimary) hs.pendingModelShiftNotify = true;
if (isMotionUltra()) streamChoreoCtl.triggerHeroDFiberPulse(card, modelBtn, mInfo.brand);
}
}
if (isPrimary) { hs.lastModelSig = modelSig; hs.lastModelCtx = cardCtx; hs.lastModelCard = card; }
}
}
}
syncQueuedPrismBoxes();
latestPrimaryModelInfo = primaryModelInfo;
latestPaneModelMap = paneModelMap;
if (primaryCard || primaryConv) notifyActivePaneModules(primaryCard, primaryConv);
const pPl = primaryCard ? cp.bc.get(primaryCard) : null, pO = readOpenPulseCardState();
const pCov = !!(pO.o && (!pO.h || !primaryConv || hasIn(primaryConv, pO.h) || hasIn(primaryCard, pO.h)));
const onCardRoof = !pPl?.qa, ttZ = onCardRoof && pPl?.ttZ ? pPl.ttZ : [0, 0, 0];
hasTt = !!(mascotOn && onCardRoof && pPl?.tt);
const mascotShouldPeek = !!(cp.ad || pPl?.tko || pPl?.mo || ttZ[2] || pPl?.ops?.some(([, a, o]) => o && a !== A_TT) || detectVisibleDecisionTakeover(null, primaryConv, true) || pCov || ga(de(), 'data-ag-pp-open') === '1');
const activeInfoForCrab = getLightweightActiveInfo(primaryCard);
queuedCrabAnchor = pPl?.qa || null;
syncCrab(primaryCard, activeInfoForCrab, primaryModelInfo, mascotShouldPeek ? 'peek' : 'none', pPl?.qh || 0, ttZ[0], ttZ[1]);
syncConvAuraSemantics(activeInfoForCrab, cp.ad);
if (hs.pendingModelShiftNotify) { hs.pendingModelShiftNotify = false; notifyMascot('model-shift'); }
syncMP(primaryModelInfo);
if (!skipSparks) streamChoreoCtl.syncThinkingSparks(primaryModelInfo, paneModelMap);
measured && 'cl' in measured ? smoothCaretCtl.applyMutations(measured.cl, false) : smoothCaretCtl.sync(false, false, false);
}

// Host Animated Icons
const findOriginalHostSvg = (btn) => {
if (!btn || !btn.querySelectorAll) return null;
for (const svg of qa(btn, 'svg')) {
if (clHas(svg, 'ag-anim-icon')) continue;
return svg;
}
return null;
};

const EXT_ZH_UI_SEL = '[data-agy-hans-ui], #agy-theme-switcher, #agy-theme-menu, #antigravity-quota-widget, #antigravity-translation-audit, #ag-usage-monitor-capsule, #ag-usage-monitor-portal';

const detectHostIconTarget = (btn) => {
if (!btn || clHas(btn, 'ag-prism-thought-raw-toggle') || cl(btn, '.ag-prism-thought-overlay')) return '';
const tid = lcw(tidOf(btn));
if (/^(?:model-selector-trigger|app-icon-new-conversation-button|input-cancel-button|stop-button|sidebar-add-project-button|toggle-overview-panel)$/.test(tid)) return '';
if (cl(btn, '#' + SETTINGS_SEC_ID + ',#ag-prism-periodic-picker-root,' + S_DLG + ',.ag-cs-home-panel,[data-testid="orchestrator-effort-bar"],.ag-cs-crab,' + EXT_ZH_UI_SEL)) return '';
if (qs(btn, '.ag-cs-model-glyph, .ag-spark-orbit-svg, .ag-cs-thinking-spark')) return '';
if (ha(btn, 'data-ag-cs-filter-btn') || tid === 'sidebar-search-button' || tid === 'conversation-filter-button') return 'search';
if (tid === 'new-conversation-button') return 'sparkles-pen';
if (/^(?:(?:sidebar-toggle|toggle-sidebar)(?:-button)?|toggle-aux-sidebar)$/.test(tid)) return 'panel-left';
if (tid === 'automations-button') return 'zap-bolt';
if (tid === 'input-send-button') return 'arrow-up-launch';

const lc = (k) => lcw(ga(btn, k)).trim(), aria = lc('aria-label'), title = lc('title'), tip = lc('data-tooltip-id');
const origSvg = findOriginalHostSvg(btn), svgCls = lcw(ga(origSvg, 'class') || origSvg?.className);
const rawLbl = aria || title, okTxt = !/\blucide-/.test(svgCls) && rawLbl.length <= 32 && !/[:：\r\n]/.test(rawLbl) && !/[:：\r\n]/.test(tip);
const shortMeta = `${tid} ${rawLbl} ${tip}`, labelMeta = `${rawLbl} ${tip}`;

if (/\blucide-copy\b/.test(svgCls) || (okTxt && /\bcopy\b|复制|複製|コピー/.test(shortMeta))) return 'copy-check';
if (/\blucide-panel-left\b/.test(svgCls) || (okTxt && /(?:toggle|open|close|show|hide)\s+(?:the\s+)?(?:side\s*panel|sidebar)|切换侧边栏|切換側邊欄|折叠侧边栏|展开侧边栏|サイドバー/.test(labelMeta))) return 'panel-left';
const role = ga(btn, 'role');
if (tid === 'settings-button' || tid === 'open-settings-button' || /\blucide-settings\b/.test(svgCls) || (okTxt && (/^(?:open\s+)?settings$|^(?:打开)?设置$|^設定$/.test(rawLbl) || (!rawLbl && /^(?:open[-_\s]?)?settings(?:\b|[-_])/.test(tip))) && role !== 'menuitem' && role !== 'tab')) return 'settings-gear';
if (!cl(btn, '.agy-composer-footer') && cl(btn, `${S_IB},${S_CC}`) && (/^(?:attachment|add-context|composer-plus|input-add)-button$/.test(tid) || /\blucide-plus\b/.test(svgCls) || (okTxt && /\battach|\badd\b|upload|context|附件|添加/.test(shortMeta)))) return 'plus-spin';
return '';
};

const restoreHostButtonIcon = (btn) => {
if (!btn) return;
qaE(btn, '.ag-anim-icon', (n) => n.remove());
qaE(btn, `[${A_OS}]`, (orig) => {
ra(orig, 'hidden'); orig.hidden = false;
const d = ga(orig, A_OD);
if (d) { sp(orig, 'display', d); ra(orig, A_OD); } else rp(orig, 'display');
ra(orig, A_OS);
});
ra(btn, A_IC);
iconPendSig.delete(btn);
};

const restoreAllHostAnimatedIcons = () => qaE(D, `[${A_IC}]`, restoreHostButtonIcon);

const isHostButtonCandidate = (el) => {
if (!isElementLike(el)) return false;
const tag = tagU(el);
return tag === 'BUTTON' || ga(el, 'role') === 'button' || (tag === 'A' && tidOf(el) === 'new-conversation-button');
};

const HOST_BTN_QUERY = 'button, [role="button"], a[data-testid="new-conversation-button"]';

const hasAncestorInSet = (el, rootSet) => {
for (let c = el?.[K_PE]; c; c = c[K_PE]) if (rootSet.has(c)) return true;
return false;
};

const iconSigMap = new WeakMap();
function syncHostAnimatedIcons(roots = null) {
if (!animatedIcons || !isFn(animatedIcons.renderIcon) || !isMotionStandardOrUltra()) { restoreAllHostAnimatedIcons(); return; }

let buttons;
if (isA(roots)) {
perfStats.iconIncrementalRuns += 1;
const rootSet = roots.length > 1 ? new Set(roots) : null, set = new Set();
for (const r of roots) {
if (!r || r[K_IC] === false || isThoughtIsolatedNode(r) || (rootSet && hasAncestorInSet(r, rootSet))) continue;
if (isHostButtonCandidate(r)) set.add(r);
for (const el of qa(r, HOST_BTN_QUERY)) if (!isThoughtIsolatedNode(el)) set.add(el);
      }
      if (!set.size) return;
      buttons = set;
    } else {
      perfStats.iconFullRuns += 1;
      buttons = qa(D, HOST_BTN_QUERY);
    }

    const pending = [];
    for (const btn of buttons) {
      if (isThoughtIsolatedNode(btn)) continue;
      const ex = ga(btn, A_IC), origSvg = findOriginalHostSvg(btn);
      if (!ex && !origSvg) continue;
      const rawSvgCls = origSvg ? (ga(origSvg, 'class') || (typeof origSvg.className === 'string' ? origSvg.className : origSvg.className?.baseVal) || '') : '-';
      const bSig = `${tidOf(btn)}|${ga(btn, 'aria-label') || ''}|${ga(btn, 'title') || ''}|${ga(btn, 'data-tooltip-id') || ''}|${ga(btn, 'role') || ''}|${+ha(btn, 'data-ag-cs-filter-btn')}|${rawSvgCls}`;
      const eqSig = '=' + bSig, hit = iconSigMap.get(btn), p = btn[K_PE], origOk = !origSvg || ha(origSvg, A_OS), hasAnim = !!(ex && qs(btn, '.ag-anim-icon'));
      if (hit && hit.s === (ex ? eqSig : bSig) && hit.p === p && hit.v === origSvg && (!ex || (origOk && hasAnim))) continue;
      const iconName = detectHostIconTarget(btn);
      if (ex) {
        if (ex !== iconName || !origOk) restoreHostButtonIcon(btn);
        else if (hasAnim) { iconSigMap.set(btn, { s: eqSig, p, v: origSvg }); continue; }
        else ra(btn, A_IC);
      }
      if (!iconName) { iconSigMap.set(btn, { s: bSig, p, v: origSvg }); continue; }
      if (!origSvg?.parentNode) continue;
      const rawSize = parseInt(ga(origSvg, 'width') || '15', 10), size = isF(rawSize) && rawSize >= 12 && rawSize <= 20 ? rawSize : 15;
      pending.push({ btn, iconName, origSvg, size, eqSig });
    }

    const runIc = (it) => applySingleHostIcon(it.btn, it.iconName, it.origSvg, it.size, it.eqSig);
    if (pending.length <= 20 || !isFn(W.requestAnimationFrame)) {
      for (const it of pending) runIc(it);
    } else {
      const s = pending.length - 16;
      for (let i = s; i < pending.length; i++) runIc(pending[i]);
      const def = pending.slice(0, s);
      for (const it of def) iconPendSig.set(it.btn, it.eqSig);
      streamChoreoCtl.enqueueDeferredIcons(def);
    }
  }

  const getOverlayPortal = () => {
    if (!D.body) return null;
    let p = byId('ag-prism-overlay-portal');
    if (!p && (p = mkEl('div'))) {
      p.id = 'ag-prism-overlay-portal';
      for (const [k, v] of [['translate', 'no'], ['data-no-translate', 'true'], ['data-ag-no-i18n', '1'], ['data-ag-owned', '1']]) sa(p, k, v);
      if (p.style) p.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9990;contain:layout style';
      D.body.appendChild(p);
    }
    return p || D.body;
  };
  const handledGroupClicks = new WeakSet();
const runSettingsGroupGlide = (group, prevBtn, nextBtn, prevRectOv = null, nextRectOv = null) => {
if (!group || !prevBtn || !nextBtn || prevBtn === nextBtn || !isMotionStandardOrUltra() || !isFn(motionEngine?.glideIndicator)) return;
const pr = prevRectOv || rc(prevBtn), nr = nextRectOv || rc(nextBtn), pill = mkEl('div');
pill.className = 'ag-cs-pill-glide';
sa(pill, 'aria-hidden', 'true'); sa(pill, 'data-ag-no-i18n'); sa(pill, 'data-ag-owned', '1');
if (nr && nr.width > 0 && nr.height > 0 && pill.style) pill.style.cssText = `position:fixed;left:${rd(nr.left)}px;top:${rd(nr.top)}px;width:${rd(nr.width)}px;height:${rd(nr.height)}px;border-radius:6px;background:rgba(148,163,184,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);pointer-events:none;z-index:9999`;
getOverlayPortal()?.appendChild?.(pill);
safe(() => motionEngine.glideIndicator(pill, pr || prevBtn, nr || nextBtn, { durationMs: 220 }));
streamChoreoCtl.scheduleTransient(() => pill.remove(), 240);
};
  const formatSettingsSummary = (lang, ui) => {
    const pal = getEffectivePalette(), ml = getMotionLevel();
    const pL = pal === 'host' ? ui.optHost || 'Host' : pal === 'warm' ? ui.optWarm || 'Alabaster' : ui.optObsidian || 'Obsidian';
    const lP = getLightPreset() === 'alabaster' ? ui.optLightAlabaster || 'Warm Alabaster' : ui.optLightCrystal || 'Daylight Crystal';
    const mL = ml === 'off' ? ui.optMotionOff || 'Off' : ml === 'subtle' ? ui.optMotionSubtle || 'Subtle' : ml === 'standard' ? ui.optMotionStandard || 'Standard' : ui.optMotionUltra || 'Ultra';
    return `${pL} · ${lP} · ${mL}`;
  };
  const resolveSettingRowActiveValue = (key, lang) => key === 'language' ? lang : key === 'mascot' && cfg.mascot === 'dual' ? 'crab' : normalizeConfigShape(cfg)[key];
const isSettingButtonMatch = (key, btnValJson, curVal) => SJ(curVal) === btnValJson || (key === 'palette' && (curVal === 'warm' || curVal === 'claude') && (btnValJson === '"warm"' || btnValJson === '"claude"'));
let lastSettingsChannelReqAt = 0;
function requestSettingsChannelIfDialogOpen() {
if (qs(D, S_DLG) || byId(SETTINGS_SEC_ID)) lastSettingsChannelReqAt = reqCh('request-settings-panel', lastSettingsChannelReqAt);
}
  function ensureSettingsSection() {
    const spm = getSettingsPanelMod(), loc = getLocalesMod();
    if (!spm || !isFn(spm.mountOrSyncSettingsSection) || !(loc && (loc.__isFullLocales || loc.UI_TABLE))) return requestSettingsChannelIfDialogOpen();
    spm.mountOrSyncSettingsSection({ version: VERSION, getLang, uiText, isZh, i18nCore, formatSettingsSummary, resolveSettingRowActiveValue, isSettingButtonMatch, saveSetting, saveSettingsBatch, getConfig: () => ({ ...cfg }), getThoughtTranslateMode, handledGroupClicks, runSettingsGroupGlide, runGuardedMut });
  }

  // Pulse Bridge & Micro-Interactions
  let pulseBridgeInst = null, motionBinding = null, wasContextCardOpen = false, pulseBridgeModRef = null;
  const calibratedPulseFooters = new WeakSet(), pulseHealTimers = new Set();
  const PULSE_HOST_SEL = '#ag-prism-pulse-bar,#ag-pulse-status-bar,[data-ag-prism-pulse-bar],[data-ag-prism-fallback="1"],[data-ag-pulse-bar="true"]';
  const collectPulseHosts = () => {
    const out = [], seen = new Set(), add = (n) => { if (n && !seen.has(n)) { seen.add(n); out.push(n); } };
    safe(() => { for (const b of getTel()?.getBars?.() || []) add(b); });
    for (const n of qa(D, PULSE_HOST_SEL)) add(n);
    add(byId('ag-prism-pulse-bar')); add(byId('ag-pulse-status-bar'));
    return out;
  };
  const healBlockedExternalPulseBar = () => {
    if (destroyed) return;
    const list = [...qa(D, '#ag-pulse-status-bar,[data-ag-pulse-bar="true"]')], p0 = byId('ag-pulse-status-bar');
    if (p0 && !incS(list, p0)) list.unshift(p0);
    for (const bar of list) {
      if (!bar || ga(bar, 'data-ag-prism-fallback') === '1' || ga(bar, 'data-layout') !== 'blocked') continue;
      const ft = bar[K_PE];
      if (!ft || !clHas(ft, 'agy-composer-footer') || calibratedPulseFooters.has(ft) || (rc(ft)?.width || 0) < 420) continue;
      calibratedPulseFooters.add(ft);
      const pr = ga(ft, 'role'); sa(ft, 'role', 'banner'); W.dispatchEvent?.(new Event('resize'));
      const t = ST(() => { pulseHealTimers.delete(t); if (destroyed) return; pr ? sa(ft, 'role', pr) : ra(ft, 'role'); W.dispatchEvent?.(new Event('resize')); }, 220);
      pulseHealTimers.add(t);
    }
  };
  const readOpenPulseCardState = () => {
    const vis = (c, host) => !!(c && (c[K_IC] !== false || host?.[K_IC] === true) && !c.hidden && ga(c, 'aria-hidden') !== 'true' && c.style?.display !== 'none');
    let o = vis(byId('context-card'), null), h = null;
    for (const x of collectPulseHosts()) if (vis(x?.shadowRoot?.getElementById?.('context-card'), x)) { o = true; h = x; break; }
    return { o, h };
  };
  const actPulse = (h) => { safe(() => getTel()?.setActiveBar?.(h)); setPbHost(h); };
  const syncContextCardOpenNotify = () => {
    const { o, h } = readOpenPulseCardState();
    if (h) actPulse(h);
    const changed = o !== wasContextCardOpen;
    if (o && !wasContextCardOpen) notifyMascot('vial-opened');
    wasContextCardOpen = o;
    if (changed && !destroyed) { dirtyFlags.c = true; scheduleSync(); }
  };

  function detachPulseBridge() {
    safe(() => pulseBridgeInst?.destroy?.());
    pulseBridgeInst = pulseBridgeModRef = null;
  }
  const ensurePulseBridge = (forceSync = false) => {
    healBlockedExternalPulseBar(); syncContextCardOpenNotify();
    const mod = getPulseVialBridgeMod();
    if (destroyed || !isFn(mod?.mountPulseVialBridge) || getTelemetryMode() === 'off') { detachPulseBridge(); return; }
    if (!pulseBridgeInst || pulseBridgeModRef !== mod) { detachPulseBridge(); pulseBridgeModRef = mod; pulseBridgeInst = safe(() => mod.mountPulseVialBridge({ win: W, doc: D })) || null; }
    else if (forceSync && isFn(pulseBridgeInst.sync)) safe(() => void pulseBridgeInst.sync());
  };

  // FastDOM Sync Loop
  let syncQueued = false;
  let syncTimer = null;
  let syncIsRaf = false;

const cancelScheduledSync = () => {
if (syncTimer === null) return;
safe(() => (syncIsRaf ? cAF(syncTimer) : CT(syncTimer)));
syncTimer = null; syncQueued = false;
};

const OWN_PLUGIN_SELECTOR =
'.ag-cs-home-panel-seat,.ag-cs-ripple-host,.ag-cs-conv-aura-host,.ag-cs-crab,.ag-cs-prism-rim-cv,.ag-cs-model-glyph,[data-testid="orchestrator-effort-bar"],.ag-cs-smooth-caret,.ag-cs-pill-glide,.ag-cs-stream-chunk,.ag-cs-thought-chunk,.ag-anim-icon,.ag-prism-omni-menu,.ag-prism-omni-pane,[data-ag-prism-omni-owned="1"],[data-ag-prism-sidebar-owned="1"],.ces-ag-section, .ces-set, #ag-codex-effort-slider-styles,#ag-pulse-status-bar,[data-ag-prism-pulse-bar],[data-ag-prism-fallback="1"],#context-card,#' +
SETTINGS_SEC_ID +
',#ag-prism-css,#ag-prism-omni-css,#ag-prism-sidebar-studio-css,#ag-prism-periodic-picker-root,#ag-prism-periodic-picker-css,.ag-pp-hold-ring,.ag-pp-mini-keycap,#ag-claude-style-css,' +
EXT_ZH_UI_SEL;

  const isOwnPluginNode = (t, selfOnly) => {
    const el = t ? (t.closest ? t : t[K_PE]) : null;
    if (!el?.closest) return false;
    if (cl(el, '[data-ag-owned],[data-prism-ignore]')) return true;
    return selfOnly && el === t && el.matches ? el.matches(OWN_PLUGIN_SELECTOR) : !!cl(el, OWN_PLUGIN_SELECTOR);
  };
  const isOwnPluginMutation = (m) => isMutAll(m, isOwnPluginNode);

  const FAST_PRUNE_LEAF_TAGS = new Set([
    'SPAN', 'P', 'CODE', 'STRONG', 'EM', 'B', 'I', 'LI', 'TD', 'TH', 'TR', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  ]);

  const syncBgCmdWrapParent = (p) => {
    if (isDis(p) || tagU(p) !== 'DIV') return;
    let hasBg = false;
    const ch = chOf(p);
    if (ch) for (let i = 0; i < ch.length; i++) if (tidOf(ch[i]) === T_BGC) { hasBg = true; break; }
    tA(p, 'data-ag-cs-bg-cmd-wrap', hasBg);
  };

  const stampBgCmdWrap = (scopeOrList) => {
    const arr = isA(scopeOrList);
    for (const el of arr ? scopeOrList : [scopeOrList || D]) {
      if (isDis(el)) continue;
      if (tidOf(el) === T_BGC) { syncBgCmdWrapParent(el[K_PE]); continue; }
      if (ha(el, 'data-ag-cs-bg-cmd-wrap')) syncBgCmdWrapParent(el);
      if (!isFn(el.querySelectorAll)) continue;
      if (!arr) for (const w of qa(el, '[data-ag-cs-bg-cmd-wrap="1"]')) syncBgCmdWrapParent(w);
      for (const c of qa(el, S_BGC)) syncBgCmdWrapParent(c[K_PE]);
    }
  };

  const A_BL = 'data-ag-cs-bleed', BLEED_TRIGS = new Set([T_TH, 'tool-group-collapsible', T_WF]), bleedEls = new Set();
  const syncBleedTables = () => {
    const hosts = D.getElementsByClassName ? D.getElementsByClassName('md-table-host') : qa(D, '.md-table-host');
    if (!hosts.length && !bleedEls.size) return;
    const next = new Set();
    for (const h of hosts) {
      if (isDis(h)) continue;
      const vp = cl(h, S_VP);
      for (let c = h[K_PE]; c && c !== D.body; c = c[K_PE]) {
        if (tagU(c) === 'DIV') {
          const p = c[K_PE]; let pv = c.previousElementSibling;
          if (pv === undefined) { pv = null; const ch = chOf(p); if (ch) for (let i = 1; i < ch.length; i++) if (ch[i] === c) { pv = ch[i - 1]; break; } }
          if ((vp && clHas(c, 'flex') && clHas(c, 'items-start') && (p === vp || clHas(p, 'flex-col'))) || BLEED_TRIGS.has(tidOf(pv)) || (clHas(c, 'flex') && clHas(c, 'flex-row') && clHas(p, 'flex-col'))) next.add(c);
        }
        if (c === vp) break;
      }
    }
    for (const e of bleedEls) if (!next.has(e)) { ra(e, A_BL); bleedEls.delete(e); }
    for (const e of next) { setAttrIfChanged(e, A_BL, '1'); bleedEls.add(e); }
  };

const AH_ID = 'ag-prism-host-alert-css', TS_A = 'data-ag-turbo-dedup', TI_A = 'data-ag-turbo-img', RTL_D = ':dir(rtl)', HAS_T = ':h' + 'as(';
let savedAlertCss = '', alertCssHasRtl = false;
const isRtlEl = (e) => e?.dir === 'rtl' || ga(e, 'dir') === 'rtl';
const hasRtlDoc = () => isRtlEl(de()) || isRtlEl(D.body) || !!qs(D, '[dir="rtl"]');
const stripRtlHasCss = (c) => !c || !incS(c, RTL_D) || !incS(c, HAS_T) ? c : c.replace(/\/\*[\s\S]*?\*\/|([^{};/@][^{};]*)\{([^{}]*)\}/g, (m, h, b) => {
if (!h || !incS(h, RTL_D) || !incS(h, HAS_T)) return m;
const k = [];
for (let i = 0, d = 0, st = 0; i <= h.length; i++) {
const ch = h[i];
if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--;
else if (!ch || (ch === ',' && !d)) { const t = h.slice(st, i).trim(); if (t && !(incS(t, RTL_D) && incS(t, HAS_T))) k.push(t); st = i + 1; }
}
return k.length ? k + '{' + b + '}' : '';
});
const syncAlertSingleton = (forceRtl) => {
if (!savedAlertCss) return;
const wantRtl = !!(forceRtl || hasRtlDoc());
let g = byId(AH_ID);
if (!g) {
const h = D.head || de(); g = h && mkEl('style'); if (!g) return;
g.id = AH_ID; sa(g, 'data-ag-prism-turbo', '1'); sa(g, 'data-ag-owned', '1');
g[K_TC] = wantRtl ? savedAlertCss : stripRtlHasCss(savedAlertCss);
alertCssHasRtl = wantRtl; h.appendChild(g); return;
}
if (wantRtl && !alertCssHasRtl) { g[K_TC] = savedAlertCss; alertCssHasRtl = true; }
};
const syncHostTurbo = (roots) => {
let sawRtl = false;
const ds = (s) => {
if (!s || s.id) return;
const t = s[K_TC] || '', ded = ga(s, TS_A) === '1';
if (ded ? !t : !incS(t, 'remark-github-blockquote-alert/alert.css')) return;
if (t && !savedAlertCss) savedAlertCss = t;
syncAlertSingleton(sawRtl);
if (!ded) { s._agM = ha(s, 'media') ? ga(s, 'media') : null; sa(s, TS_A, '1'); }
s.media = 'not all'; sa(s, 'media', 'not all'); s.disabled = true; safe(() => { if (s.sheet) s.sheet.disabled = true; });
if (s[K_TC]) s[K_TC] = '';
};
const oi = (m) => {
if (!m || ga(m, TI_A) === '1' || ha(m, 'data-prism-ignore') || cl(m, '[data-prism-ignore]')) return;
m.decoding = 'async'; sa(m, 'decoding', 'async');
const ld = ga(m, 'loading'); if (!ld || ld === 'auto') { m.loading = 'lazy'; sa(m, 'loading', 'lazy'); }
sa(m, TI_A, '1');
};
for (const el of isA(roots) ? roots : [roots || D]) {
if (!el || el[K_IC] === false) continue;
if (!sawRtl && savedAlertCss && !alertCssHasRtl && (isRtlEl(el) || qs(el, '[dir="rtl"]'))) sawRtl = true;
const tg = tagU(el);
if (tg === 'STYLE') ds(el); else if (tg === 'IMG') oi(el);
else if (el.querySelectorAll) { qaE(el, `style:not([id]):not([${TS_A}])`, ds); qaE(el, `img:not([${TI_A}])`, oi); }
}
if (savedAlertCss && !alertCssHasRtl && (sawRtl || hasRtlDoc())) syncAlertSingleton(true);
};
const restoreHostTurbo = () => {
const css = savedAlertCss || byId(AH_ID)?.[K_TC];
byId(AH_ID)?.remove?.();
for (const s of qa(D, `style[${TS_A}]`)) {
if (!s[K_TC] && css) s[K_TC] = css;
const pm = s._agM;
if (pm != null) { s.media = pm; sa(s, 'media', pm); } else { s.media = ''; ra(s, 'media'); }
delete s._agM; s.disabled = false; safe(() => { if (s.sheet) s.sheet.disabled = false; }); ra(s, TS_A);
}
raAll(TI_A, `img[${TI_A}]`);
savedAlertCss = ''; alertCssHasRtl = false;
};

  const OFF_A = 'data-ag-offscreen', OFF_S = '[data-ag-cs-row-running="1"],[data-ag-sub-running="1"],[data-testid="status-loading-spinner"]';
  let offIo = null; const offObs = new Set();
  const syncOffscreenRunningIo = () => {
    if (destroyed) return;
    const cur = new Set(qa(D, OFF_S));
    if (!cur.size && !offObs.size) return;
    if (cur.size && !offIo && typeof IntersectionObserver === 'function') offIo = safe(() => new IntersectionObserver((es) => {
      if (!destroyed) runGuardedMut(() => { for (const en of es) { const e = en?.target; if (!isDis(e)) tA(e, OFF_A, !en.isIntersecting); } });
    })) || null;
    for (const e of [...offObs]) if (!cur.has(e) || isDis(e)) { safe(() => offIo?.unobserve?.(e)); offObs.delete(e); !isDis(e) && ra(e, OFF_A); }
    if (offIo) for (const e of cur) if (!offObs.has(e)) safe(() => { offIo.observe(e); offObs.add(e); });
  };

  let axE = null, axO = null, axF = null, axL = null, axTm = 0;
  const AX_A = 'data-ag-cs-aux-dual', RESIZE_ATTR = 'data-ag-cs-resizing', MASCOT_DRAG_ATTR = 'data-ag-cs-mascot-drag';
  let resizeEndTm = 0, splitDragActive = false;
const isDragSuspendedRoot = () => { const h = de(); return ga(h, RESIZE_ATTR) === '1' || ga(h, MASCOT_DRAG_ATTR) === '1'; };
const finishResizing = (triggerSync = true) => {
resizeEndTm = cT(resizeEndTm);
splitDragActive = false;
const h = de(), had = ha(h, RESIZE_ATTR);
if (had) runGuardedMut(() => ra(h, RESIZE_ATTR));
if (had && triggerSync && !destroyed) { markRim(); dirtyFlags.a = true; if (hasTt) dirtyFlags.c = true; scheduleSync(); }
};
const scheduleResizingEnd = () => { cT(resizeEndTm); resizeEndTm = ST(() => finishResizing(true), 120); };
const markResizingRoot = () => { const h = de(); if (h && ga(h, RESIZE_ATTR) !== '1') runGuardedMut(() => sa(h, RESIZE_ATTR, '1')); };
const bumpResizingPulse = () => {
if (destroyed) return;
markResizingRoot();
if (!splitDragActive) scheduleResizingEnd();
};
const isSplitResizeHandle = (el) => {
if (!el) return false;
const split = cl(el, `${S_AP},[data-testid="sidebar-split"]`);
if (split) {
const sep = chOf(split)?.[1] || null;
if (sep && (el === sep || hasIn(sep, el))) return true;
const rh = cl(el, '[role="separator"],[data-testid*="resize"],[data-testid*="sash"],[data-resize-handle],[class*="resiz"],[class*="sash"]');
if (rh && hasIn(split, rh)) return true;
}
return !!cl(el, '[data-testid="bottom-terminal-panel-resize-handle"],[data-testid="tiling-splitter"]');
};
  let axInit = false, axLastStyleAt = 0;
  const maybeBumpAuxResize = () => { const t = pNow(), p = axLastStyleAt; axLastStyleAt = t; if (splitDragActive || (p > 0 && t - p <= 140)) bumpResizingPulse(); };
  const AX_H = /(?:^|[;\s])(?:width\s*:\s*0(?:\s|;|px|%|!|$)|display\s*:\s*none|position\s*:\s*absolute)/i;
  const axV = (e) => !!(e && tagU(e) === 'DIV' && !e.hidden && !ha(e, 'hidden') && ga(e, 'aria-hidden') !== 'true' && ga(e, 'data-split-overlaid') !== 'true' && e.style?.display !== 'none' && e.style?.position !== 'absolute' && e.style?.width !== '0' && e.style?.width !== '0px' && !AX_H.test(ga(e, 'style') || ''));
  const axCh = (s) => { const cs = chOf(s); return [fe(s) !== undefined ? fe(s) : cs?.[0] || null, s.lastElementChild !== undefined ? s.lastElementChild : cs?.[cs.length - 1] || null]; };
  const axU = (s, anim = false) => {
    if (!s || s[K_IC] === false) return false;
    const prev = ha(s, AX_A), [f, l] = axCh(s), tr = ga(s, 'data-split-transition');
    const next = !!(tr !== 'maximizing' && tr !== 'restoring' && tr !== 'closing' && f && l && f !== l && axV(f) && axV(l));
    tA(s, AX_A, next);
    if (next !== prev && axInit && anim && !splitDragActive) streamChoreoCtl.triggerSplitTransition?.(s, next);
    axInit = true;
    return next !== prev;
  };
const syncAuxSplit = () => {
const s = qs(D, S_AP);
if (s !== axE) {
axTm = cT(axTm);
safe(() => axO?.disconnect?.()); axO = axF = axL = null; axInit = false; axLastStyleAt = 0;
if (axE?.[K_IC] !== false) ra(axE, AX_A);
axE = s;
if (s && typeof MutationObserver === 'function') {
const o = { attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style', 'class', 'data-split-overlaid'] };
const rb = (f0) => {
if (destroyed || !axO || !axE) return;
const [f, l] = axCh(axE);
if (!f0 && f === axF && l === axL) return;
axF = f; axL = l;
axO.disconnect();
safe(() => { axO.observe(axE, { childList: true, attributes: true, attributeFilter: ['data-split-transition'] }); if (f) axO.observe(f, o); if (l && l !== f) axO.observe(l, o); });
};
axO = new MutationObserver((rs) => {
if (destroyed || !axE) return;
const c = rs?.some?.((r) => r.type === 'childList'), a = rs?.some?.((r) => r.type === 'attributes');
if (c && !a) { if (!axTm) axTm = ST(() => { axTm = 0; if (!destroyed && axE) { rb(0); runGuardedMut(() => { axU(axE, true); }); } }, 64); return; }
if (c) rb(0);
let dc = false; runGuardedMut(() => { dc = axU(axE, true); });
if (!dc && rs?.some?.((r) => r.type === 'attributes' && r.attributeName === 'style')) maybeBumpAuxResize();
});
rb(1);
}
}
if (s) axU(s, false);
};

  const HC_A = 'data-hover-card-popup', HC_S = '[data-hover-card-popup]';
  const SB_SEL = `aside,[data-testid="sidebar-split"]>div:first-child,${S_SBR},[data-testid="project-header"],${HC_S}`;
  const inSbRow = (e) => !!cl(e, `${S_SBR},[data-testid="project-header"],[data-testid="conversation-list-sidebar"]`);
  const isHcEl = (el) => {
    if (!el || el === D.body || el === de()) return false;
    const f = fe(el);
    return !!(ha(el, HC_A) || ha(f, HC_A) || ha(fe(f), HC_A) || (ha(el, 'data-base-ui-portal') && qs(el, HC_S)));
  };
  const isHoverCardNode = (n) => { const e = isElementLike(n) ? n : n?.[K_PE]; return !!(e && (isHcEl(e) || cl(e, HC_S))); };
  const inSbP = (el) => !!cl(el, SB_SEL);

const isPulseHostNode = (n) => !!(n && (n.id === 'ag-prism-pulse-bar' || n.id === 'ag-pulse-status-bar' || ha(n, 'data-ag-prism-pulse-bar') || ga(n, 'data-ag-prism-fallback') === '1' || ga(n, 'data-ag-pulse-bar') === 'true'));
const COMP_TIDS = new Set([T_IB, 'input-cancel-button', 'stop-button', 'cancel-button', 'agent-loading', 'send-button', 'input-send-button', 'model-selector-trigger', T_TK, T_SQ, T_RP, T_QM]);
const COLL_TIDS = new Set([T_WF, T_TH, 'tool-group-collapsible', T_CF, 'sidecar-iframe', 'sidecar-iframe-slot', 'artifact-view']);
const COLL_SEL = [...COLL_TIDS].map(_ts).join(',') + ',pre';
const TK_SUB_SEL = `${TK_SEL},${S_AQO},${_ts(T_QM)}`;
const S_BGC = _ts(T_BGC), S_SP = _ts(T_SP), S_CFH = _ts(T_CF);
const IN_CONV_PROBE = `${TK_SUB_SEL},${S_RP},${S_BGC},${S_SP},.md-table-host,${COLL_SEL},${HOST_BTN_QUERY},${S_AP},[dir="rtl"]`;
const classifyDirtySubtree = (el, ia, pCtx = null) => {
if (!isElementLike(el)) return;
const df = dirtyFlags, tid = tidOf(el), role = String(ga(el, 'role') || ''), cls = clsOf(el) || String(el.className?.baseVal || ga(el, 'class') || ''), tg = tagU(el);
const hc = fe(el) !== undefined ? !!fe(el) : !!(chOf(el)?.length > 0), inc = (k) => incS(cls, k);
if (!tid && !role && !el.id && !ha(el, 'dir') && !inc('agy-') && !inc('surface-') && FAST_PRUNE_LEAF_TAGS.has(tg) && !hc) return;
if (isHcEl(el) || (!pCtx && cl(el, HC_S))) return;
if (tid === T_BGC) { if (ia) { df.m = true; dirtyBgCmds.add(el); } return; }
const aConv = pCtx ? pCtx.c : !!cl(el, S_CV);
const aComp = pCtx ? pCtx.p : !!cl(el, S_IB);
const aSide = pCtx ? pCtx.s : inSbP(el);
const aDlg = pCtx ? pCtx.d : !!cl(el, S_DLG);
const aMdl = pCtx ? pCtx.m : !!cl(el, MODEL_PANEL_SEL);
let tb = false, ipd = false, inSbR = false;
const ics = tid !== T_CV && tid !== T_IB && !inc('agy-home') && aConv && !aComp;
const cHit = !ics || aDlg || (hc && !!qs(el, IN_CONV_PROBE));
const q = (s) => hc && cHit && !!qs(el, s);
if (tid === T_AP || q(S_AP)) df.a = true;
const chkDlg = (r) => {
ipd = true;
if (r || (ia && (tg === 'H2' || inc('space-y-2') || q('h2, div.space-y-2')))) df.g = true;
if (ia && (r || inc('agy-overlay'))) df.o = true;
};
if (!ics) {
if (inc('agy-home') || tid === T_CV || tid === 'home-greeting' || q(ia ? `.agy-home,${S_CV},${_ts('home-greeting')}` : `.agy-home,${S_CV}`)) df.r = df.c = df.l = df.tk = df.cf = tb = true;
const isRc = tid === T_SBR || tid === 'breadcrumb-segment' || tid === 'conversation-row-history' || q(`${S_SBR},${_ts('breadcrumb-segment')},${_ts('conversation-row-history')}`);
const inSR = !isRc && (pCtx ? pCtx.r : inSbRow(el));
if (isRc || aSide || inSR) {
if (inSR) {
inSbR = true;
if (tid === 'status-loading-spinner' || incS(tid, 'stop') || incS(tid, 'cancel') || inc('lucide-square') || inc('lucide-circle-stop') || q(`${_ts('status-loading-spinner')},.lucide-square,.lucide-circle-stop`)) df.s = true;
} else { df.s = true; if (ia) tb = true; }
}
if (COMP_TIDS.has(tid) || inc('surface-composer-card') || inc('agy-takeover-') || tid === 'ask-question-option' || aComp || q(`${S_IB},${_ts('input-cancel-button')},${TK_SUB_SEL},${S_CC}`)) { df.c = df.r = true; if (ia) tb = true; }
const isPulse = isPulseHostNode(el) || el.id === 'context-card' || q('#context-card');
const isMdl = !isPulse && (tid === T_MS || aMdl || q(MODEL_PANEL_SEL));
const isDR = role === 'dialog' || q(S_DLG);
if (isPulse) { df.c = df.o = true; if (ia) tb = true; }
else if (isMdl) { if (aMdl) df.mp = true; else df.o = true; }
else if (isDR || aDlg) chkDlg(isDR);
else if (tid === 'overview-panel' || inc('agy-overlay') || q(_ts('overview-panel')) || (q('.agy-overlay') && !q(HC_S))) df.o = true;
} else {
if (tid === T_TK || tid === T_QM || tid === T_SQ || tid === T_RP || tid === 'agent-loading' || tid === 'ask-question-option' || inc('agy-takeover-') || q(`${TK_SUB_SEL},${S_RP}`)) df.c = true;
if (role === 'dialog' || aDlg) chkDlg(role === 'dialog');
else if (tid === 'overview-panel' || inc('agy-overlay')) df.o = true;
}
if (ia && q(S_BGC)) { df.m = true; dirtyBgCmds.add(el); }
if (ia) {
if (tg === 'STYLE' || tg === 'IMG' || (!alertCssHasRtl && savedAlertCss && (ga(el, 'dir') === 'rtl' || q('[dir="rtl"]')))) dirtyTurboRoots.add(el);
else if (hc) {
if (ics) { const byTag = el.getElementsByTagName; if (isFn(byTag) && (byTag.call(el, 'img').length || byTag.call(el, 'style').length)) dirtyTurboRoots.add(el); }
else if (qs(el, `style:not([id]):not([${TS_A}]),img:not([${TI_A}])`)) dirtyTurboRoots.add(el);
}
}
if (tid === T_SP || q(S_SP)) df.o = true;
if (inc('md-table-host') || q('.md-table-host')) df.l = true;
const isTk = tid === T_TH, isCf = tid === T_CF;
if (isTk || isCf || tg === 'PRE' || COLL_TIDS.has(tid)) {
df.l = true;
if (isTk) df.tk = true;
if (isCf) df.cf = true;
if (ia) dirtyCollapsibleTargets.add(el);
} else if (hc && cHit) {
const ch = qs(el, COLL_SEL);
if (ch) {
df.l = true;
if (ia) dirtyCollapsibleTargets.add(el);
const ht = tidOf(ch);
if (ht === T_TH || qs(el, S_TKT)) df.tk = true;
if (ht === T_CF || qs(el, S_CFH)) df.cf = true;
}
}
if (!ipd && !inSbR) {
const hb = ia && (tb || isHostButtonCandidate(el) || q(HOST_BTN_QUERY));
if (hb || tb) df.b = true;
if (hb) dirtyAddedRoots.add(el);
}
};

  const measureSyncPhase = (flags, isFullSync = false) => {
    const inHome = !!(qs(D, '.agy-home')), ih = inHome && !!(qs(D, '.agy-home [data-testid="home-greeting"]')), sc = streamChoreoCtl, hs = sc.heroState;
    const formalConv = !inHome ? (isLiveMainConv(activeConvView) ? activeConvView : sc.findFormalConvView()) : null;
    const ci = formalConv ? ga(formalConv, 'data-cascade-id') || resolveCascadeId(null) || '' : '';
    const prevDetached = !!(lastFormalConvEl && lastFormalConvEl[K_IC] === false);
    const sw = !!(
      formalConv &&
      ((lastFormalConvEl && formalConv !== lastFormalConvEl && prevDetached) ||
        (ci && lastFormalCascadeId && ci !== lastFormalCascadeId && (!lastFormalConvEl || formalConv === lastFormalConvEl || prevDetached)))
    );
    const ae = !isFullSync && !inHome && !!formalConv && (!hs.wasInFormalConv || sw);
    const homeComposerSampled = inHome && (flags.f || flags.r || flags.c) ? (sc.sampleHomeComposerRect(), true) : false;
    const convInputRect = hs.routeInitialized && hs.wasInHome && !inHome && formalConv && isMotionUltra() && !sc.isEntryMotionSuppressed?.() ? rc(qs(formalConv, S_IB) || qs(D, S_IB)) : null;
    const sidebarSnap = flags.f || flags.s || flags.r ? sc.measureSidebarSelectionSnapshot() : null;
    const visibleChangedHeaders = !ae && (flags.f || flags.cf || flags.r) ? sc.measureVisibleChangedHeaders() : [];
    const lo = (flags.f || flags.o) && isMotionStandardOrUltra() ? sc.measureNewLensOverlays() : [];
    const clList = !ae && (flags.f || flags.c) && isCaretOn() ? smoothCaretCtl.measureSnapshot(false, false) : null;
    const mp = isFullSync || flags.c || flags.o ? qs(D, MODEL_PANEL_SEL) : null;
    const mc = !!(flags.o) && (!!mp || hadModelPanelOpen);
    const cp = isFullSync || flags.c || mc ? measureCrabClearanceAll(sw) : null;
    if (flags.f || flags.r || flags.c || flags.t) convAuraCtl.prime?.();
    return { inHome, ih, formalConv, ci, sw, ae, homeComposerSampled, convInputRect, sidebarSnap, visibleChangedHeaders, lo, cl: clList, mp, mc, cp, checkCaustics: !!(flags.f || flags.cf || flags.r) };
  };

  let enhancerSyncTimer = 0, enhancerSyncRaf = 0, lastEnhancerSyncAt = 0, enhConv = null;
  const ENH_KEYS = 'frlcbtsgo'.split(''), enhancerDirty = {}, enhRoots = new Set();
  const resetEnhancerDirty = () => { for (const k of ENH_KEYS) enhancerDirty[k] = false; enhRoots.clear(); enhConv = null; };
  resetEnhancerDirty();
  const mergeEnhancerDirty = (src, roots, conv) => {
    if (!src) { enhancerDirty.f = true; enhRoots.clear(); return; }
    for (const k of ENH_KEYS) if (src[k]) enhancerDirty[k] = true;
    if (conv?.[K_IC] !== false) enhConv = conv;
    if (enhancerDirty.f) enhRoots.clear();
    else if (roots) for (const r of roots) if (r && r[K_IC] !== false && enhRoots.size < 32) enhRoots.add(r);
  };
  const cancelHostEnhancerSync = () => { enhancerSyncTimer = cT(enhancerSyncTimer); enhancerSyncRaf = cAF(enhancerSyncRaf); };
  const flushHostEnhancerSync = () => {
    cancelHostEnhancerSync(); if (destroyed) return;
    lastEnhancerSyncAt = dNow();
    const mask = { ...enhancerDirty }, ac = !isDis(enhConv) ? enhConv : (!isDis(activeConvView) ? activeConvView : null);
    if (!mask.f && enhRoots.size) mask.dirtyAddedRoots = AF(enhRoots);
    if (!mask.f && ac) mask.activeConv = ac;
    resetEnhancerDirty();
    safe(() => hostEnhancerCtl.sync?.(mask.f ? undefined : mask));
    if (!destroyed) runGuardedMut(syncOffscreenRunningIo);
  };
  const queueHostEnhancerAsync = () => {
    if (destroyed || enhancerSyncRaf) return;
    if (!D.hidden && (enhancerSyncRaf = rAF(() => { enhancerSyncRaf = 0; flushHostEnhancerSync(); }))) return;
    if (!enhancerSyncTimer) enhancerSyncTimer = ST(flushHostEnhancerSync, 0);
  };
  const scheduleHostEnhancerSync = (immediate, srcFlags, roots = null, conv = null) => {
    if (destroyed) return;
    mergeEnhancerDirty(srcFlags, roots, conv);
    const elapsed = dNow() - lastEnhancerSyncAt;
    if (immediate || !isConvRunning(true) || elapsed >= 200) { enhancerSyncTimer = cT(enhancerSyncTimer); return queueHostEnhancerAsync(); }
    if (!enhancerSyncTimer && !enhancerSyncRaf) enhancerSyncTimer = ST(() => { enhancerSyncTimer = 0; queueHostEnhancerAsync(); }, mx(32, 200 - elapsed));
  };
  let hadModelPanelOpen = false;
  const runSync = (forceFull = false) => {
    if (destroyed) return;
    const t0 = pNow(), sc = streamChoreoCtl;
    if (forceFull) markAllDirty();
    const flags = { ...dirtyFlags }, addedRoots = AF(dirtyAddedRoots);
    const collapsibleScope = dirtyCollapsibleTargets.size > 0 ? new Set(dirtyCollapsibleTargets) : null;
    const bgCmdNodes = dirtyBgCmds.size > 0 ? AF(dirtyBgCmds) : null, turboRoots = dirtyTurboRoots.size > 0 ? AF(dirtyTurboRoots) : null;
    dirtyAddedRoots.clear(); dirtyCollapsibleTargets.clear(); dirtyBgCmds.clear(); dirtyTurboRoots.clear(); setAllDirty(false);
    const prevWasInHome = sc.heroState.wasInHome, prevWasInConv = sc.heroState.wasInFormalConv, effectiveFull = !!(forceFull || flags.f);
    const measured = measureSyncPhase(flags, effectiveFull), { inHome, ih, formalConv: fc, ci, sw, ae: deferHeavyConvWork, mp: modelPanelNow, mc: modelOverlayChanged, sidebarSnap, visibleChangedHeaders, lo } = measured;
    if (inHome) { lastFormalConvEl = null; lastFormalCascadeId = ''; }
    else if (fc) { lastFormalConvEl = fc; if (ci) lastFormalCascadeId = ci; }
    if (sw || (inHome && prevWasInConv)) { sc.cancelDeferredHydration(); getDomBus()?.cancelGroup?.('conv:'); }
    const actualRouteJump = sw || inHome !== prevWasInHome || !!fc !== prevWasInConv, routeJumped = effectiveFull || actualRouteJump;
    const { f, r, c, l, o, t, s, g, a, b, m, tk, cf } = flags, frc = !!(f || r || c);
    runGuardedMut(() => {
      applyRootAttrs(effectiveFull);
      if (actualRouteJump) for (const k of ['data-ag-cs-stage-glide', 'data-ag-cs-sonar', 'data-ag-cs-caustic']) raAll(k);
      if (effectiveFull || m) stampBgCmdWrap(effectiveFull ? D : bgCmdNodes);
      if (frc || l) syncBleedTables();
      if (effectiveFull || turboRoots) syncHostTurbo(effectiveFull ? D : turboRoots);
      if (effectiveFull || r || s || a || isDis(axE)) syncAuxSplit();
      if (isStudioHome() && (ih || inHome) && !getHomeStudioMod()) requestHomeStudioChannelIfNeeded();
      if (f || r || ih !== homeStudioCtl.wasHero()) {
        homeStudioCtl.syncGreeting(ih);
        if (!isStudioHome()) { homeStudioCtl.unmountPanelSeat(); markRim(); }
        else if (ih) {
          homeStudioCtl.renderHomePanel();
          const hp = qs(D, '.ag-cs-home-panel');
          if (hp && (ga(hp, A_PB) !== '1' || ga(hp, A_PM) !== '1')) { setAttrIfChanged(hp, A_PB, '1'); setAttrIfChanged(hp, A_PM, '1'); markRim(); }
        } else { homeStudioCtl.parkPanelSeat(); markRim(); }
      }
      if (f || r || t) safe(() => rippleCtl.sync());
      if (frc || t) safe(() => convAuraCtl.sync(true));
      if (effectiveFull || c || o) { hadModelPanelOpen = !!(modelPanelNow); syncModelMenuRootAttrs(modelPanelNow); }
      if (f || c || modelOverlayChanged) syncComposers(measured, deferHeavyConvWork);
      else {
        if (!deferHeavyConvWork && tk) sc.syncThinkingSparks(latestPrimaryModelInfo, latestPaneModelMap);
        if (flags.mp) modelGlyphCtl.syncModelSelectorPanel(latestPrimaryModelInfo);
      }
      if (frc) sc.syncHeroRouteChoreography(measured);
      else {
        if (s && sidebarSnap) sc.syncSidebarSelectionGlide(sidebarSnap);
        if (cf) sc.syncHeroCCaustics(visibleChangedHeaders);
      }
      if (!deferHeavyConvWork && (frc || l)) syncDs();
      if (f || o) { sc.syncLensOverlayOrigins(lo); syncPopupOverlayMirrors(); }
      if (routeJumped || r || c || o) markRim(sw);

      if (deferHeavyConvWork) {
        const outR = addedRoots.filter((x) => !isDis(x) && (!fc || !hasIn(fc, x)));
        if (outR.length) syncHostAnimatedIcons(outR);
        const expCid = ci || '';
        const verifyConv = () => {
          if (destroyed) return null;
          const cv = sc.findFormalConvView();
          if (!cv) return null;
          const cid = ga(cv, 'data-cascade-id') || resolveCascadeId(null) || '';
          if (cv !== fc || (expCid && cid && cid !== expCid)) { dirtyFlags.r = true; scheduleSync(); return null; }
          return cv;
        };
        sc.scheduleDeferredConvEntry(() => {
          const cv = verifyConv(); if (!cv) return false;
          const cp = qs(cv, `${TK_SUB_SEL}, ${S_RP}`) ? measureCrabClearanceAll() : null;
          runGuardedMut(() => { if (cp) syncComposers({ cp }, false); stampBgCmdWrap(cv); syncBleedTables(); sc.syncThinkingSparks(latestPrimaryModelInfo, latestPaneModelMap); syncDs(); sc.syncHeroCCaustics(); });
          scheduleHostEnhancerSync(false, { f: true }); smoothCaretCtl.queue(false, false, false);
          return true;
        }, 140, () => {
          const cv = verifyConv(); if (!cv) return;
          runGuardedMut(() => syncHostAnimatedIcons([cv]));
          syncWf();
          if (getThoughtTranslateMode() !== 'off') safe(() => getTh()?.scan?.());
        });
      } else {
        if (f) syncHostAnimatedIcons(null);
        else if (routeJumped) { const jr = [qs(D, '.agy-home'), fc, ...addedRoots].filter(Boolean); syncHostAnimatedIcons(jr.length ? jr : null); }
        else if (b && addedRoots.length) syncHostAnimatedIcons(addedRoots);
        if ((f || l || routeJumped || ((flags.s || flags.g || flags.o) && W.__agPrismThought?.getTranslateTitles?.())) && getThoughtTranslateMode() !== 'off') safe(() => getTh()?.scan?.());
      }
      if (f || g) ensureSettingsSection();
      if (frc || t) ensurePulseBridge(!!(f || t));
      if (effectiveFull || s || c || o || r || offObs.size > 0) syncOffscreenRunningIo();
    });
    if (effectiveFull || c || r || routeJumped) safe(() => W.__agPrismPeriodicPicker?.onHostTriggerChanged?.());
    if (!deferHeavyConvWork && (frc || l || b || t || s || g || o)) {
      const enhFlags = routeJumped ? { ...flags, f: true } : flags;
      const scopeRoots = !enhFlags.f && (addedRoots.length || collapsibleScope) ? [...addedRoots, ...(collapsibleScope || [])] : null;
      scheduleHostEnhancerSync(!!(f || routeJumped || g || o || (t && !isConvRunning(true))), enhFlags, scopeRoots, fc || activeConvView);
    }
    if (!deferHeavyConvWork) { if (f || routeJumped) syncWf(); else if (l) syncWf(collapsibleScope); }

    perfStats.lastSyncMs = +(pNow() - t0).toFixed(3);
    perfStats.syncCount += 1;
  };

  function scheduleSync() {
    if (destroyed) return;
    const highPri = !!(dirtyFlags.f || dirtyFlags.r || dirtyFlags.t || dirtyFlags.s || dirtyFlags.c || dirtyFlags.o || dirtyFlags.g || dirtyFlags.mp);
    if (syncQueued) {
      if (highPri && !syncIsRaf && !D.hidden && syncTimer) { CT(syncTimer); syncTimer = null; syncQueued = false; }
      else return;
    }
    syncQueued = true;
    const run = () => { syncTimer = null; syncQueued = false; runSync(false); };
    if (!D.hidden && (highPri || !isConvRunning(true)) && (syncTimer = rAF(run))) syncIsRaf = true;
    else { syncIsRaf = false; syncTimer = ST(run, D.hidden ? 50 : 96); }
  }

  function onStoreChanged() {
    if (qs(D, '.agy-home') && isStudioHome()) refUsage();
    if (D.hidden) { pendingHiddenFullSync = true; return; }
    const st = cachedStore?.getState?.();
    if (st) {
      const cs = st.conversation?.convoState;
      const cid = cs?.type === 'active' ? cs.cascadeId || '' : cs?.type === 'subagent' ? cs.childConversationId || '' : '';
      const sum = sumOf(st, cid);
      const snapKey = [location.pathname || '', cs?.type || '', cid, sum.status ?? '', sum.notFullyIdle ? 1 : 0, sum.hasError ? 1 : 0, sum.hasRunningSubagents ? 1 : 0, st.userStatus?.name || ''].join('|');
      if (snapKey === lastStoreSnapKey) return;
      lastStoreSnapKey = snapKey;
    }
    dirtyFlags.c = dirtyFlags.r = true;
    scheduleSync();
  }

  // Event Handlers
  let blurTm = 0, lbr = 0;
  const clearWinBlur = () => safe(() => {
    blurTm = cT(blurTm);
    const h = de();
    if (ha(h, BLUR_ATTR)) {
      runGuardedMut(() => ra(h, BLUR_ATTR));
      syncRigPwr();
      safe(() => convAuraCtl.wake?.(false));
      safe(() => convAuraCtl.sync(true));
      safe(() => getTel()?.refresh?.());
    }
  });
  const wakeWinBlur = () => safe(() => {
    const hasA = ha(de(), BLUR_ATTR);
    if (!hasA && !blurTm) return;
    const t = pNow();
    if (!hasA && blurTm && t - lbr < 400) return;
    lbr = t;
    clearWinBlur();
    if (!hasFoc()) onWinBlur();
  });
  function onWinBlur() {
    safe(() => {
      if (splitDragActive) { splitDragActive = false; scheduleResizingEnd(); }
      if (destroyed || blurTm) return;
      lbr = pNow();
      blurTm = ST(() => safe(() => {
        blurTm = 0;
        const h = de();
        if (!destroyed && !hasFoc() && ga(h, BLUR_ATTR) !== '1') { runGuardedMut(() => sa(h, BLUR_ATTR, '1')); syncRigPwr(); }
      }), 1200);
    });
  }
  const onWinPointerMove = (ev) => safe(() => { wakeWinBlur(); if (!isDragSuspendedRoot()) prismRimCtl.onPointerMove(ev); });
  const onWinPointerUp = () => safe(() => { if (!destroyed) { streamChoreoCtl.prepareConvPressDip?.(null); if (splitDragActive) { splitDragActive = false; scheduleResizingEnd(); } } });
  const onWinResize = () => safe(() => { if (!destroyed) { markRim(); smoothCaretCtl.bumpMetricsEpoch(); smoothCaretCtl.queue(false, false, true); if (hasTt) { dirtyFlags.c = true; scheduleSync(); } } });
  const onWinStorage = (ev) => safe(() => { if (!destroyed && (ev?.key === STORAGE_PRISM_KEY || ev?.key === STORAGE_FILE_CFG_KEY)) { cfg = loadSettings(currentBaseConfig); markAllDirty(); applyRootAttrs(); scheduleSync(); } });
  const cPoll = () => { if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; } };
  const onDocVisibilityChange = () => safe(() => {
    if (destroyed) return;
    if (D.hidden) return cPoll();
    if (hasFoc()) clearWinBlur();
    checkThemeAndHomeHealth();
    if (lifecycleStarted) restartPollTimer();
    if (pendingHiddenFullSync) { pendingHiddenFullSync = false; markAllDirty(); scheduleSync(); }
  });

  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = tagU(el);
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ga(el, 'contenteditable') === 'true' || !!(el.isContentEditable || cl(el, '[contenteditable="true"], input, textarea, select, [role="textbox"]'));
  };

  const SLASH_CMD_RE = /^\/(plan|goal|boost|teamwork|swarm|browser|compact|schedule|grill-me|learn)(?:\s|$)/i;
  let lastSlashNotifyAt = 0, lastSlashNotifyCmd = '';
  const isSbAct = (t) => !!cl(t, 'button,[role="button"],input');
  const dispatchComposerSubmit = (scopeEl, btn = null) => {
    if (!cl(scopeEl, '.agy-home')) streamChoreoCtl.triggerSendLaunch?.(scopeEl, btn);
    const box = cl(scopeEl, `${S_IB}, .surface-composer-card, [data-testid="${T_SQ}"], [data-side-panel-focus-scope="true"]`);
    const ed = (box && qs(box, '[contenteditable="true"], textarea, input')) || scopeEl;
    const m = SLASH_CMD_RE.exec(String(ed?.innerText ?? ed?.[K_TC] ?? ed?.value ?? '').trim());
    if (m) {
      const cmd = lcw(m[1]), now = dNow();
      if (cmd !== lastSlashNotifyCmd || now - lastSlashNotifyAt >= 800) { lastSlashNotifyCmd = cmd; lastSlashNotifyAt = now; notifyMascot('slash-cmd', { cmd }); }
      return;
    }
    notifyMascot('send', {});
  };

  const fireSend = (el, btn = null) => { if (cl(el, '.agy-home')) trigLift(); convAuraCtl.triggerStart(findConvForTarget(el)); dispatchComposerSubmit(el, btn); };
  const onWinKeyDown = (ev) => safe(() => {
    if (destroyed || !ev) return;
    wakeWinBlur();
    const et = ev.target;
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.isComposing && ev.keyCode !== 229 && cl(et, `${S_IB} [contenteditable="true"]`)) {
      const sm = qs(D, '[data-testid="slash-command-menu"]');
      if (sm && (sm.getClientRects?.().length ?? 1) > 0) return;
      trackActivePaneFromTarget(et, false);
      fireSend(et);
      return;
    }
    if (ev.key === '[' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !isEditableTarget(et) && !cl(et, `${S_DLG},.monaco-editor`)) {
      const html = de(), k = 'data-ag-cs-sidebar-collapsed';
      if (!html || cfg.sidebarRestyle === false) return;
      bumpResizingPulse();
      ga(html, k) === '1' ? ra(html, k) : sa(html, k, '1');
    }
  });

  const onWinClick = (ev) => safe(() => {
    const t = ev?.target;
    if (destroyed || !t?.closest || isThoughtIsolatedNode(t)) return;
    const hitPulse = isPulseHostNode(t) ? t : cl(t, PULSE_HOST_SEL) || (isFn(ev.composedPath) ? ev.composedPath().find(isPulseHostNode) : null);
    if (hitPulse) actPulse(hitPulse);
    if (hitPulse || wasContextCardOpen) ST(() => !destroyed && syncContextCardOpenNotify(), 28);
    if (cl(t, S_TKT) && getThoughtTranslateMode() !== 'off') ST(() => safe(() => getTh()?.scan?.()), 25);
    const sendBtn = cl(t, '[data-testid="input-send-button"], [data-testid="send-button"]');
    if (sendBtn && !sendBtn.disabled) {
      trackActivePaneFromTarget(sendBtn, false);
      if (ga(sendBtn, A_IC) === 'arrow-up-launch' && isMotionStandardOrUltra()) safe(() => motionEngine?.triggerIcon?.(sendBtn, 'launch'));
      fireSend(sendBtn, sendBtn);
    }
    const qBtn = cl(t, '[data-testid="queued-messages-card"] button');
    if (qBtn && !qBtn.disabled && (/send/i.test(`${ga(qBtn, 'aria-label') || ''} ${qBtn[K_TC] || ''}`) || qs(qBtn, '.lucide-arrow-right,.lucide-arrow-up,.lucide-send'))) streamChoreoCtl.triggerSendLaunch?.(qBtn, qBtn);
    const sbRow = cl(t, S_SBR);
    if (sbRow && !isSbAct(t)) streamChoreoCtl.prepareConvSwitchExit?.(sbRow);
    const copyBtn = cl(t, `[${A_IC}="copy-check"]`) || cl(t, 'pre button, button[aria-label*="Copy" i], button[aria-label*="复制"]');
    if (copyBtn && !copyBtn.disabled && !isThoughtIsolatedNode(copyBtn)) {
      if (ga(copyBtn, A_IC) === 'copy-check' && !motionReduced() && isFn(motionEngine?.triggerIcon)) safe(() => motionEngine.triggerIcon(copyBtn, 'check', { revertAfterMs: 1600 }));
      notifyMascot('code-copied');
    }
    const navTurn = cl(t, '[data-testid="conversation-navigator-turn"], [data-testid="conversation-navigator-group"]');
    if (navTurn) streamChoreoCtl.triggerHeroESonar(navTurn);
    const grpBtn = cl(t, `${S_DLG} [role="group"] button`);
    if (grpBtn && !ha(grpBtn, 'data-ag-cs-key') && !handledGroupClicks.has(ev)) {
      handledGroupClicks.add(ev);
      const grp = cl(grpBtn, '[role="group"]'), gp = streamChoreoCtl.heroState.lastGroupPress;
      if (gp?.group === grp && gp.prevBtn && gp.prevBtn !== grpBtn) runSettingsGroupGlide(grp, gp.prevBtn, grpBtn, gp.prevRect);
    }
    if (!byId(SETTINGS_SEC_ID) && cl(t, `${S_DLG} button,${S_DLG} [role="tab"]`) && !cl(t, '#' + SETTINGS_SEC_ID)) { dirtyFlags.g = true; scheduleSync(); }
    if (cl(t, S_WF) && isCompOn()) streamChoreoCtl.scheduleWorkedForClickSync();
  });

  const onWinFocusIn = (ev) => safe(() => { if (!destroyed) trackActivePaneFromTarget(ev?.target, true); });
  const onDocPointerDown = (ev) => safe(() => {
    wakeWinBlur();
    const t = ev?.target;
    if (t?.closest) {
      trackActivePaneFromTarget(t, true);
      const sbRow = cl(t, S_SBR);
      if (sbRow) {
        streamChoreoCtl.lockSidebarRowRunningOnPointerDown?.(sbRow);
        if (!isSbAct(t)) streamChoreoCtl.prepareConvPressDip?.(sbRow);
      }
      if (isSplitResizeHandle(t)) {
        splitDragActive = true;
        markResizingRoot();
        if (resizeEndTm) CT(resizeEndTm); resizeEndTm = ST(() => finishResizing(true), 10000);
      }
      if (isMotionStandardOrUltra()) {
        if (!cl(t, S_DLG)) {
          const triggerEl = cl(t, 'button, [role="button"], [data-testid]'), hasXY = isF(ev.clientX) && isF(ev.clientY);
          if (triggerEl || hasXY) streamChoreoCtl.heroState.lastTriggerOrigin = { el: triggerEl || null, x: hasXY ? ev.clientX : NaN, y: hasXY ? ev.clientY : NaN, at: pNow() };
        } else if (!cl(t, '#' + SETTINGS_SEC_ID)) {
          const grp = cl(t, `${S_DLG} [role="group"]`);
          const g = chOf(grp);
          if (g) {
            let prevBtn = null;
            for (let i = 0; i < g.length; i++) if (ga(g[i], 'aria-pressed') === 'true' || ha(g[i], 'data-pressed') || ga(g[i], 'aria-checked') === 'true' || ga(g[i], 'data-state') === 'on') { prevBtn = g[i]; break; }
            streamChoreoCtl.heroState.lastGroupPress = { group: grp, prevBtn, prevRect: rc(prevBtn) };
          }
        }
      }
    }
    notifyMascot('activity', {});
    if (isCaretOn()) smoothCaretCtl.queue(false);
  });
  const MODIFIER_ONLY_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']);
  const readTypeTail = (ev, ed) => {
    if (typeof ev?.data === 'string' && ev.data) return ev.data.slice(-4);
    const s = D.getSelection?.(), r = s?.rangeCount ? s.getRangeAt?.(0) : null, n = r ? r.endContainer : s?.focusNode;
    if (n?.nodeType === 3 && (!ed || ed.contains?.(n) !== false)) { const o = r ? r.endOffset : s?.focusOffset || 0; return (n.data ?? n.nodeValue ?? '').slice(mx(0, o - 4), o); }
    for (let c = ed, d = 0; c && d < 8; d++) { if (c.nodeType === 3) return (c.data ?? c.nodeValue ?? '').slice(-4); c = c.lastChild || c.childNodes?.[c.childNodes.length - 1]; }
    return '';
  };
  const onDocCaretEvent = (ev) => safe(() => {
    const type = ev?.type || '';
    if (type === 'focusin') trackActivePaneFromTarget(ev?.target, true);
    if ((type === 'keydown' || type === 'keyup') && ev?.key && MODIFIER_ONLY_KEYS.has(ev.key)) return;
    if (type === 'scroll' || type === 'selectionchange' || type === 'keydown' || type === 'keyup') {
      const ae = D.activeElement; if (!cl(ae, S_IB)) return;
      if (type === 'scroll') { const st = ev?.target; if (st && st !== ae && !hasIn(ae, st) && (st === D || st === de() || st === D.body || tidOf(st) === 'autoscroll-viewport' || !hasIn(st, ae))) return; }
    }
    const isTyping = type === 'input' || type === 'keyup' || type === 'compositionupdate' || type === 'compositionend';
    const immediate = type === 'focusin' || type === 'mouseup' || type === 'transitionend';
    smoothCaretCtl.queue(isTyping, immediate, type === 'focusin', type === 'scroll');
    if (type === 'input' && cl(ev?.target, S_IB)) safe(() => msRig?.onUserType?.(readTypeTail(ev, cl(ev.target, '[contenteditable="true"]') || ev.target)));
  });
  const onDocTransitionEnd = (ev) => safe(() => {
    const pn = ev?.propertyName || '';
    if (pn && /color|opacity|shadow|fill|stroke|filter|outline/i.test(pn)) return;
    if (ev?.target?.id === 'ag-prism-periodic-picker-root' && pn === 'height') markRim();
    if (isCaretOn() && cl(ev?.target, S_IB)) smoothCaretCtl.queue(false, false, false);
  });
const ATTR_OBSERVED_TIDS = new Set([T_CV, T_SBR, T_WF, T_TH, T_CF, T_RP, T_TK, T_SQ, T_QM, 'ask-question-option', T_SP, 'toggle-aux-sidebar', 'toggle-maximize-pane']);
let tkMicroQueued = false;
const isTkOrQHit = (el) => {
if (!isElementLike(el)) return false;
const tid = tidOf(el), cls = clsOf(el);
return tid === T_TK || tid === T_SQ || tid === T_QM || tid === 'ask-question-option' || incS(cls, 'agy-takeover-') || !!((fe(el) || chOf(el)?.length) && qs(el, TK_SUB_SEL));
};
const syncTakeoverNow = () => {
if (destroyed || tkMicroQueued) return;
tkMicroQueued = true;
Promise.resolve().then(() => {
tkMicroQueued = false;
if (destroyed || D.hidden) return;
const cp = measureCrabClearanceAll(), clList = isCaretOn() ? smoothCaretCtl.measureSnapshot(false, false) : null;
runGuardedMut(() => { syncComposers({ cp, cl: clList }, false); });
markRim();
});
};
const ROOT_ATTR_FILTER = 'class|dir|hidden|aria-expanded|data-state|data-ag-queued-act|data-selected|data-cascade-id|data-ag-prism|data-ag-cs-theme|data-ag-cs-corners|data-ag-prism-host-i18n|data-ag-prism-mode|data-ag-pp-open|data-ag-prism-wallpaper|data-has-browser-hole|data-has-drawer-browser-hole'.split('|');
const isHoleA = (an) => an?.charCodeAt(0) === 100 && /^data-has-(?:drawer-)?browser-hole$/.test(an);
const onRootMutations = (mutations) => {
try {
if (destroyed || internalDomMutating || streamChoreoCtl.isStreamMutating() || !mutations || mutations.length === 0) return;
if (D.hidden) {
for (let i = 0; i < mutations.length; i++) {
const m = mutations[i];
if (!isThoughtMutationRecord(m) && !isOwnPluginMutation(m)) { pendingHiddenFullSync = true; break; }
}
return;
}
let anyRelevant = false, urgentTk = false, convMount = false, caretDirty = false, ctxCache = null, bS = 0;
for (let i = 0; i < mutations.length; i++) {
const { type: mt, attributeName: an, target: tgt, addedNodes: aN, removedNodes: rN } = mutations[i];
if (mt === 'attributes') {
if (an === 'data-ag-prism-host-i18n') { dirtyFlags.g = anyRelevant = true; continue; }
if (an === 'dir') { if (!alertCssHasRtl && savedAlertCss && isRtlEl(tgt)) { dirtyTurboRoots.add(tgt); anyRelevant = true; } continue; }
if (tgt === D.body || tgt === de()) {
if (an === 'data-ag-pp-open') { prismRimCtl.markDirty(); dirtyFlags.c = anyRelevant = true; continue; }
if (an === 'data-ag-prism-wallpaper' || isHoleA(an)) { dirtyFlags.r = anyRelevant = true; continue; }
if (an === 'data-ag-prism-mode' || an === 'data-ag-cs-corners') { invRim(); dirtyFlags.c = true; }
dirtyFlags.t = anyRelevant = true;
continue;
}
if (isHoleA(an)) { dirtyFlags.r = anyRelevant = true; continue; }
if (tidOf(tgt?.[K_PE]) === T_AP) {
let dualChanged = false;
runGuardedMut(() => { dualChanged = axU(tgt[K_PE], true); });
if (dualChanged) dirtyFlags.a = anyRelevant = true;
else if (an === 'style') maybeBumpAuxResize();
continue;
}
if (an === A_QA) { if (!isThoughtIsolatedNode(tgt) && !isHoverCardNode(tgt)) dirtyFlags.c = anyRelevant = true; continue; }
const tid = tidOf(tgt);
const isClrWrap = (an === 'class' || an === 'hidden') && (ha(tgt, A_TK) || ha(tgt, A_Q) || ha(tgt, A_TT) || seenClrWraps.has(tgt) || clHas(tgt, 'agy-takeover-frame'));
if (!ATTR_OBSERVED_TIDS.has(tid) && !isClrWrap) continue;
if (isThoughtIsolatedNode(tgt) || isOwnPluginNode(tgt) || isHoverCardNode(tgt)) continue;
if (isClrWrap && !ATTR_OBSERVED_TIDS.has(tid)) { dirtyFlags.c = anyRelevant = true; continue; }
if (tid === T_CV) { if (an === 'data-cascade-id') dirtyFlags.r = dirtyFlags.c = convMount = anyRelevant = true; }
else if (tid === T_SBR) {
if (an === 'data-selected') {
if (ga(tgt, 'data-selected') === 'true') stSbRun(tgt);
dirtyFlags.s = anyRelevant = true;
}
} else if (tid === T_WF || tid === T_TH || tid === T_CF) {
dirtyFlags.l = anyRelevant = true;
if (tid[0] === 't') dirtyFlags.tk = true;
else if (tid[0] === 'c') dirtyFlags.cf = true;
dirtyCollapsibleTargets.add(tgt);
} else if (tid === T_RP || tid === T_TK || tid === T_SQ || tid === T_QM || tid === 'ask-question-option') dirtyFlags.c = anyRelevant = true;
else if (tid === T_SP) dirtyFlags.o = anyRelevant = true;
else if (tid === 'toggle-aux-sidebar' || tid === 'toggle-maximize-pane') dirtyFlags.a = anyRelevant = true;
continue;
}
if (mt === 'childList') {
if (tagU(tgt) === 'STYLE' && !tgt.id && (ga(tgt, TS_A) !== '1' || tgt[K_TC])) { dirtyTurboRoots.add(tgt); anyRelevant = true; continue; }
let pCtx = null;
if (isElementLike(tgt)) {
if (!ctxCache) ctxCache = new Map();
pCtx = ctxCache.get(tgt);
if (!pCtx) {
if (isThoughtIsolatedNode(tgt) || isOwnPluginNode(tgt) || isHoverCardNode(tgt)) pCtx = { k: true };
else {
const p = !!(cl(tgt, S_IB));
pCtx = { k: false, c: !!(cl(tgt, S_CV)), p, e: p && !!(cl(tgt, '[contenteditable="true"]')), s: inSbP(tgt), r: inSbRow(tgt), d: !!(cl(tgt, S_DLG)), m: !!(cl(tgt, MODEL_PANEL_SEL)) };
}
ctxCache.set(tgt, pCtx);
}
if (pCtx.k) continue;
if (tidOf(tgt) === T_AP) dirtyFlags.a = anyRelevant = true;
}
const inComposerBox = !!(pCtx && pCtx.p), inEditor = !!(pCtx && pCtx.e);
if (inEditor && (aN?.length || rN?.length)) caretDirty = true;
const isSibHost = bS < 40 && !!(isElementLike(tgt) && !inComposerBox && !pCtx?.s && !pCtx?.d && tgt !== D.body && tgt !== de() && qs(tgt, S_IB));
const scanList = (list, isAdd) => {
if (!list || !list.length) return;
for (let j = 0; j < list.length; j++) {
const node = list[j];
if (!isElementLike(node) || isThoughtIsolatedNode(node) || isOwnPluginNode(node, !!pCtx) || isHoverCardNode(node)) continue;
const nt = tidOf(node);
if (inEditor && !nt && !isTkOrQHit(node)) { const t = tagU(node); if (t !== 'BUTTON' && t !== 'STYLE' && t !== 'IMG') continue; }
if (isAdd && nt === T_SBR && ga(node, 'data-selected') === 'true') stSbRun(node);
if (!inEditor && bS++ >= 40) {
for (const k of 'rclbosg') dirtyFlags[k] = true;
dirtyFlags.tk = dirtyFlags.cf = anyRelevant = true;
if (isAdd && isElementLike(tgt)) dirtyTurboRoots.add(tgt);
break;
}
classifyDirtySubtree(node, isAdd, pCtx);
if (inComposerBox && !inEditor) { dirtyFlags.c = dirtyFlags.r = caretDirty = true; }
if (nt === T_CV || nt === 'autoscroll-viewport' || (!pCtx?.c && !pCtx?.p && !pCtx?.s && (fe(node) || chOf(node)?.length) && qs(node, `${S_CV},${S_VP}`))) { if (isAdd) convMount = true; }
else if (isTkOrQHit(node) || isSibHost) { dirtyFlags.c = dirtyFlags.o = urgentTk = true; }
anyRelevant = true;
}
};
scanList(aN, true);
if (rN?.length) {
if (isElementLike(tgt) && ha(tgt, 'data-ag-cs-bg-cmd-wrap')) { dirtyFlags.m = anyRelevant = true; dirtyBgCmds.add(tgt); }
scanList(rN, false);
}
}
}
if (caretDirty) { smoothCaretCtl.invalidateSelection?.(); if (isCaretOn() && !dirtyFlags.c) smoothCaretCtl.queue(false); }
if (urgentTk && !convMount) syncTakeoverNow();
if (anyRelevant && (O.values(dirtyFlags).some(Boolean) || dirtyTurboRoots.size > 0)) scheduleSync();
} catch {}
};
let rootObsHandle = null;
// Never bind click/mousedown on D
const CAP_PASSIVE = { capture: true, passive: true };
const CARET_LISTENERS = 'keyup:1|mouseup:0|input:1|selectionchange:1|focusin:0|focusout:0|scroll:0|compositionupdate:1|compositionend:1'.split('|').map((s) => { const [e, c] = s.split(':'); return [e, onDocCaretEvent, c === '1' ? true : CAP_PASSIVE]; });
const DOC_LISTENERS = [
['pointerdown', onDocPointerDown, CAP_PASSIVE],
['transitionend', onDocTransitionEnd, CAP_PASSIVE],
['visibilitychange', onDocVisibilityChange, true],
];
let caretListenersBound = false;
const syncCaretListeners = (enabled) => {
const want = !!(enabled && !destroyed && lifecycleStarted);
if (want === caretListenersBound) return;
caretListenersBound = want;
evOp(D, want, CARET_LISTENERS);
if (!want && !destroyed) smoothCaretCtl.teardown();
};
const P_PASS = { passive: true };
const WIN_LISTENERS = [
['pointermove', onWinPointerMove, CAP_PASSIVE],
['pointerup', onWinPointerUp, P_PASS],
['pointercancel', onWinPointerUp, P_PASS],
['focusin', onWinFocusIn, CAP_PASSIVE],
['resize', onWinResize, P_PASS],
['keydown', onWinKeyDown, true],
['click', onWinClick, true],
['storage', onWinStorage, false],
['blur', onWinBlur, false],
['focus', clearWinBlur, false],
];
let pollTimer = null, coreTornDown = false;
const teardownCore = () => {
if (coreTornDown) return;
coreTornDown = destroyed = true;
activePaneCard = activeConvView = lastNotifiedPaneCard = lastNotifiedConvView = null; latestPaneModelMap.clear();
cancelScheduledSync(); streamChoreoCtl.clearTransientTimers();
for (const s of [dirtyAddedRoots, dirtyCollapsibleTargets, dirtyBgCmds, dirtyTurboRoots, bleedEls]) s.clear();
clearWinBlur(); finishResizing(false); unmountCrab(); msLastHostSleep = false;
safe(() => offIo?.disconnect?.()); offIo = null; offObs.clear(); raAll(OFF_A);
crabRemoveAttrTimer = cT(crabRemoveAttrTimer);
for (const t of pulseHealTimers) CT(t);
pulseHealTimers.clear(); syncMotionOffStyle(false); streamChoreoCtl.disconnectStreamObserver();
cPoll();
cancelHostEnhancerSync(); resetEnhancerDirty();
storeDebounce = cT(storeDebounce) || null;
smoothCaretCtl.teardown(); prismRimCtl.cancelPendingRaf();
safe(storeUnsub); storeUnsub = null;
safe(() => rootObsHandle?.disconnect?.()); rootObsHandle = mainObserver = null;
axTm = cT(axTm);
safe(() => { axO?.disconnect?.(); ra(axE, AX_A); }); axO = axE = axF = axL = null; axInit = false; axLastStyleAt = 0;
syncCaretListeners(false);
evOp(D, false, DOC_LISTENERS);
if (isFn(W.removeEventListener)) evOp(W, false, WIN_LISTENERS);
safe(() => motionBinding?.unbind?.()); motionBinding = null;
safe(() => pulseBridgeInst?.destroy?.()); pulseBridgeInst = null;
safe(() => hostEnhancerCtl.destroy?.()); modelGlyphCtl.teardownCrystalMount();
const cln = gCln();
if (isA(cln)) { const idx = cln.indexOf(teardownCore); if (idx >= 0) cln.splice(idx, 1); }
};
const _cln = gCln(); (isA(_cln) ? _cln : (GT.__agCsCleanups = [])).push(teardownCore);
let activePollMs = 0;
const checkThemeAndHomeHealth = () => {
if (destroyed || D.hidden) return;
const expectedThemeKey = getThemeKey();
if (expectedThemeKey !== lastThemeKey || !ha(de(), 'data-ag-prism')) applyRootAttrs();
if (isStudioHome()) {
if (homeStudioCtl.wasHero()) refUsage();
else if (!getHomeStudioMod() && qs(D, '.agy-home')) requestHomeStudioChannelIfNeeded();
}
};
const restartPollTimer = () => {
if (destroyed || D.hidden) return cPoll();
const nextMs = Math.max(30000, Number(cfg.pollIntervalMs || currentBaseConfig.pollIntervalMs) || 30000);
if (pollTimer !== null && activePollMs === nextMs) return;
cPoll(); activePollMs = nextMs;
pollTimer = setInterval(checkThemeAndHomeHealth, nextMs);
};
let lifecycleStarted = false;
const startLifecycle = () => {
const root = de();
if (destroyed || lifecycleStarted || !root) return;
lifecycleStarted = true;
flattenMainStyleSheet();
const domBus = getDomBus(), obsOpts = { childList: true, subtree: true, attributes: true, attributeFilter: ROOT_ATTR_FILTER };
domBus?.attach?.(D, W);
if (domBus && isFn(domBus.subscribe)) {
rootObsHandle = mainObserver = { disconnect: domBus.subscribe('ui-runtime-root', onRootMutations, { doc: D, win: W, priority: 'high', observeOptions: obsOpts }), takeRecords: () => (isFn(domBus.discardMutations) ? domBus.discardMutations() : domBus.drainMutations?.()) };
} else if (typeof MutationObserver === 'function') {
const mo = new MutationObserver(onRootMutations); mo.observe(root, obsOpts); rootObsHandle = mainObserver = mo;
}
evOp(D, true, DOC_LISTENERS);
syncCaretListeners(isCaretOn());
if (isFn(W.addEventListener)) {
evOp(W, true, WIN_LISTENERS);
motionBinding = safe(() => motionEngine?.bindMicroInteractions?.(W)) || null;
}
syncMotionSpringTokens();
restartPollTimer();
if (typeof document.hasFocus === 'function' && !document.hasFocus()) onWinBlur();
ensureHooks(true);
markAllDirty();
runSync(true);
if (homeStudioCtl.wasHero() && isStudioHome()) refUsage();
};
const prismRuntimeApi = {
brand: 'Obsidian Prism', version: VERSION, legacyApiVersion: LEGACY_API_VERSION, codeHash: CODE_HASH,
flattenCss: flattenMainStyleSheet, saveSettingsBatch,
refreshConfig(next) {
if (next && typeof next === 'object') {
if (next.__uiSlice) ensureLiteLocalesShim(next.__uiSlice);
const fromFile = !!(next.__fromFile), ackEpoch = Number(next.__ackEpoch) || 0;
if (fromFile && ackEpoch > 0 && ackEpoch < localWriteEpoch) return false;
const cleanNext = expandSettingAliases(stripRuntimeMetaKeys(next));
currentBaseConfig = { ...currentBaseConfig, ...cleanNext };
if (next.pollIntervalMs !== undefined) currentBaseConfig.pollIntervalMs = next.pollIntervalMs;
if (next.binding !== undefined) currentBaseConfig.binding = next.binding;
cfg = loadSettings(currentBaseConfig, fromFile ? null : cleanNext);
} else cfg = loadSettings(currentBaseConfig);
if (lifecycleStarted && !destroyed) restartPollTimer();
markAllDirty(); lastAbsorbedSyncKey = ''; applyRootAttrs(true); runSync(true);
return true;
},
sync() { if (!destroyed) { lastAbsorbedSyncKey = ''; runSync(true); } },
syncHomeStudio() { if (destroyed) return; resolveHomeStudioCtl(); if (!lifecycleStarted) return; markAllDirty(); runSync(true); },
detachHomeStudio: disposeActiveHomeStudio,
syncTelemetry() { if (destroyed) return; ensurePulseBridge(true); syncAbsorbedModules(true); },
detachTelemetry: detachPulseBridge,
syncHostEnhancer() { if (destroyed) return; const c = resolveHostEnhancerCtl(); safe(() => { c.onThemeChange?.(false); c.sync?.(); }); },
detachHostEnhancer: disposeActiveHostEnhancer,
syncAbsorbed: () => syncAbsorbedModules(true),
getState() {
const ca = convAuraCtl.getInstance(), ac = !!(ca?.host?.[K_IC]), rm = rippleCtl.getMount(), rmOn = !!(rm?.canvas?.[K_IC]);
return {
brand: 'Obsidian Prism', version: VERSION, cfg: normalizeConfigShape(cfg), motionLevel: getMotionLevel(), lightPreset: getLightPreset(),
hasThoughtModule: !!getTh(), hasOmniModule: !!W.__agPrismOmni, hasSidebarStudio: !!W.__agPrismSidebar,
hasContextMenu: !!getCtx(), hasHostEnhancer: isFn(hostEnhancerCtl?.getDebugState),
usageRecordsCount: homeStudioCtl.getUsageRecordsCount(), hasPanel: homeStudioCtl.hasConnectedPanel(),
hasRipple: rmOn, rippleMode: rmOn ? (rm.mode || 'home') : 'off', rippleSleeping: !rm || !!rm.sleeping,
rippleAura: rm ? { ...rm.aura } : null, hasConvAura: ac, convAuraPhase: ac ? convAuraCtl.advancePhase(pNow()) : 'off',
convAuraSleeping: !ca || !!ca.sleeping, convAuraDrawCount: ca ? ca.drawCount : 0,
convAuraCanvasSize: ca ? { width: ca.width, height: ca.height } : null,
convAuraOptics: ca?.lastOptics ? { ...ca.lastOptics } : null,
hasCrab: !!(msRoot && msRoot[K_IC]), hasDualRig: !!msRig, hasSmoothCaret: !!qs(D, '.ag-cs-smooth-caret'),
hasPulseBridge: !!pulseBridgeInst?.getDebugState?.()?.attached, hasStreamObserver: streamChoreoCtl.hasStreamObserver(),
modelInfo: latestPrimaryModelInfo ? { ...latestPrimaryModelInfo } : null, perf: { ...perfStats },
};
},
suppressEntryMotion(ms) { streamChoreoCtl.suppressEntryMotion?.(ms); },
destroy() {
teardownCore();
for (const k of 'Telemetry,EffortSlider,Thought,Omni,Sidebar,PeriodicStub,PeriodicPicker,ProjectPartitions,HostI18n,Wallpaper,Suggester,SidePanelVtabs'.split(',')) safe(() => wMod('__agPrism' + k)?.destroy?.());
for (const k of 'PrismPeriodicStub,PrismPeriodicStubFactory,PeriodicPendingOpen,PeriodicFullLoaded,PeriodicStubHash'.split(',')) { safe(() => delete W['__ag' + k]); safe(() => delete GT['__ag' + k]); }
safe(() => W.__agPrismInlineDiff?.unbindHooks?.());
safe(() => (ownedCtxMenu || getCtx())?.destroy?.());
const sc = streamChoreoCtl;
for (const [o, k] of [[sc, 'cancelDeferredHydration'], [0, disposeActiveHomeStudio], [sc, 'flushAllStreamArtifacts'], [0, restoreAllHostAnimatedIcons], [smoothCaretCtl, 'teardown'], [prismRimCtl, 'teardown'], [rippleCtl, 'unmount'], [convAuraCtl, 'unmount'], [sc, 'clearWorkedForAutoUnfoldAttrs'], [0, unmountCrab], [0, restoreHostTurbo]]) safe(() => (o ? o[k]() : k()));
qaE(D, `[${A_PB}]`, clrPb);
qaE(D, '[data-ag-cs-effort]', (e) => { ra(e, 'data-ag-cs-effort'); e[K_CL].remove('ag-cs-effort-badge'); });
qaE(D, `[${A_Q}],[${A_TK}],[${A_TT}]`, (e) => { ra(e, A_Q); ra(e, A_TK); ra(e, A_TT); rp(e, 'margin-bottom'); });
qaE(D, '[data-ag-row-stagger]', (e) => { ra(e, 'data-ag-row-stagger'); rp(e, '--ag-row-i'); });
qaE(D, '.agy-overlay,.agy-fastpick,[data-testid="context-menu-popup"],[data-testid="context-menu-submenu-popup"],[data-ag-cs-overview-shell]', (e) => { rp(e, '--ag-origin-x'); rp(e, '--ag-origin-y'); });
for (const s of 'placeholder|orch-active|model-overlay|aux-dual|overview-shell|prism-mirror|prism-reflect|settings-dlg|settings-nav|nav-active|conv-seat|conv-ripple-host|vp-wrap|swapping|vp-live|home-sheet|row-running|menu-open|auto-unfolded|outer-open|caustic|fiber-camp|pane-camp|sonar|stage-glide|liftoff-bubble|thought-streaming|spark-streaming|prism-cv|code-folded|bg-cmd-wrap|input-layer|hdr-open|rich-pre|glide-item|crab-anchor|bleed'.split('|')) raAll('data-ag-cs-' + s);
for (const a of 'data-has-sep,data-pv-warn,data-ag-sp-running'.split(',')) raAll(a);
safe(() => { getDomBus()?.dispose?.(D, W); getMascotHop()?.dispose?.(D); for (const k of ['__agPrismFontCustomizer', '__agPrismReducedMotionGuard']) wMod(k)?.dispose?.(D); });
const pfx = (p, s) => s.split(',').map((x) => p + x).join(',');
rmAll(pfx('#ag-prism-', 'overlay-portal,mascot-hop-style,periodic-picker-css,periodic-picker-root,custom-fonts-style,settings-ext-beta4-css,settings-v101-css,studio-v101-css,omni-css,motion-off-css,periodic-stub-css,project-partitions-css,part-hide-css,wallpaper-root,wallpaper-css,suggester-css') + ',[data-ag-prism-partitions="1"],.ag-prism-mascot-hop-layer,.ag-pp-hold-ring,.ag-pp-mini-keycap,.ag-omni-dock,.ag-omni-menu,.ag-prism-omni-menu,.ag-prism-omni-pane,[data-ag-prism-omni-owned="1"],' + pfx('.ag-cs-', 'ctx-menu,ctx-toast,sb-more-wrap,code-fold-btn,nav-outline-popover,panel-row-glyph,orbital-backdrop,home-panel,home-panel-seat,liftoff-veil,sidebar-glide-pill,pill-glide,conv-aura-host,conv-glow,prism-rim-cv,model-glyph,thinking-spark,perf-backdrop') + ',[data-testid="orchestrator-effort-bar"],.ag-v2-habitat-prop,#' + SETTINGS_SEC_ID);
const html = de();
if (html) {
ra(html, 'data-ag-perf-busy');
for (const s of 'style|theme|palette|light-preset|motion|ignore-rm|perf-mode|stream-active|target-fps|telemetry|effort-slider|thought-translate|home|composer|logo-ink|sidebar|sidebar-compact|sidebar-collapsed|sb-fold|side-panel-vertical-tabs|has-crab|model-menu|takeover-open|lang|cjk|accent|corners|chat-font|code-font|ligatures|ambient|win-blur|scroll-bottom|resizing|mascot-drag|conv-ripple'.split('|')) ra(html, 'data-ag-cs-' + s);
for (const s of '|thought-view|omni|link-target|sidebar-studio|sidebar-host-sync|project-partitions'.split('|')) ra(html, s ? 'data-ag-prism-' + s : 'data-ag-prism');
rp(html, '--ag-spring-sidebar-ease'); rp(html, '--ag-spring-sidebar-dur');
}
},
};
W.__agPrism = W.__agClaudeStyle = prismRuntimeApi;
if (de()) startLifecycle();
else if (isFn(D.addEventListener)) {
const onReady = () => { if (de()) { evOp(D, false, [['readystatechange', onReady], ['DOMContentLoaded', onReady]]); startLifecycle(); } };
evOp(D, true, [['readystatechange', onReady], ['DOMContentLoaded', onReady]]);
}
});
