// Obsidian Prism - Right Side Panel Vertical Tabs Constants, Primitives & Observer Bus (vtabs-constants.js)
(function (G) {
  'use strict';

  function init(ns) {
    const STORAGE_COLLAPSED_KEY = 'ag-prism:side-panel-vtabs-collapsed';
    const STORAGE_WIDTH_KEY = 'ag-prism:side-panel-vtabs-width';
    const STYLE_ID = 'ag-prism-side-panel-vtabs-css';
    const NARROW_WIDTH_PX = 420;
    const EXPANDED_WIDTH_PX = 180;
    const COLLAPSED_WIDTH_PX = 42;
    const MIN_EXPANDED_WIDTH_PX = 120;
    const MAX_EXPANDED_WIDTH_PX = 320;
    const SNAP_COLLAPSE_WIDTH_PX = 88;
    const MAX_ANCESTOR_STEPS = 3;
    const CAUSTIC_DURATION_MS = 920;
    const GLIDE_SAFETY_MS = 420;
    const REDUX_MISS_COOLDOWN_MS = 2500;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const TOP_INSET_CLUSTER_SEL = '[data-testid="toggle-aux-sidebar"], [data-testid="toggle-maximize-pane"]';
    const TOP_INSET_CSS_VALUE = 'var(--titlebar-row-height, var(--strip-row-height, 40px))';

    const NO_TR_ATTRS = [
      ['translate', 'no'], ['data-no-translate', 'true'], ['data-ag-localization-skip', 'true'],
      ['data-agy-no-translate', 'true'], ['data-antigravity-zh-skip', '1'], ['data-ag-no-i18n', '1'],
    ];

    const ALL_MARK_ATTRS = [
      'data-ag-vtabs-host', 'data-ag-vtabs-body', 'data-ag-vtabs-body-slot',
      'data-ag-vtabs-strip', 'data-ag-vtabs-strip-slot', 'data-ag-vtabs-strip-wrap',
      'data-ag-vtabs-list', 'data-ag-vtabs-wrap', 'data-ag-vtabs-actions',
      'data-ag-vtabs-tab', 'data-ag-vtabs-close', 'data-ag-vtabs-label',
      'data-ag-vtabs-meta', 'data-ag-vtabs-icon', 'data-ag-vtabs-no-icon',
      'data-ag-vtabs-title', 'data-ag-vtabs-flat', 'data-ag-vtabs-collapsed',
      'data-ag-vtabs-auto-collapsed', 'data-ag-vtabs-hole', 'data-ag-vtabs-dragging',
      'data-ag-vtabs-cat', 'data-ag-vtabs-tone', 'data-ag-vtabs-ord',
      'data-ag-vtabs-active', 'data-ag-vtabs-gliding', 'data-ag-vtabs-caustic',
      'data-ag-vtabs-ready', 'data-ag-vtabs-top-inset',
    ];

    const VTABS_SWEEP_SEL = ALL_MARK_ATTRS.map((a) => `[${a}]`).join(', ');
    const OWNED_NODE_SEL = '.ag-cs-vtabs-head, .ag-cs-vtabs-toggle, .ag-cs-vtabs-sash, .ag-cs-vtabs-glide-bar, .ag-cs-vtabs-ord';
    const OWNED_CLOSEST_SEL = '[data-ag-owned="1"], .ag-cs-vtabs-head, .ag-cs-vtabs-sash, .ag-cs-vtabs-glide-bar, .ag-cs-vtabs-ord';

    const MAIN_MO_ATTRS = [
      'class', 'hidden', 'style', 'title', 'id', 'aria-label', 'data-testid', 'data-tab-id',
      'data-active-tab-id', 'data-has-browser-hole', 'data-has-drawer-browser-hole',
      'data-split-overlaid', 'data-split-transition', 'aria-selected', 'data-active', 'data-state',
      'data-ag-cs-side-panel-vertical-tabs', 'data-ag-cs-resizing', 'data-ag-cs-motion',
      'data-ag-cs-ignore-rm', 'data-ag-cs-perf-mode', 'data-ag-cs-win-blur', 'data-ag-cs-lang', 'lang',
    ];

    const ROOT_MO_ATTRS = [
      'data-ag-cs-side-panel-vertical-tabs', 'data-ag-cs-resizing', 'data-ag-cs-motion',
      'data-ag-cs-ignore-rm', 'data-ag-cs-perf-mode', 'data-ag-cs-win-blur', 'data-ag-cs-lang', 'lang',
    ];

    const CLOSE_HINT_RE = /\b(?:close|dismiss|remove|kapat)\b|关闭|關閉|閉じる|닫기|cerrar|fermer|schlie/i;
    const NON_CLOSE_BTN_RE = /\b(?:pin|unpin|lock|unlock|refresh|reload|split|max|maximize|min|minimize|more|menu|drag|move|stop|detach|open|edit|copy)\b|固定|刷新|更多|最大化|最小化|停止|ピン|更新|고정|새로고침/i;
    const CLOSE_GLYPH_RE = /^[\u00d7xX\u2715\u2716\u2a2f]$/;
    const ACTION_TID_RE = /toolbar|action|maximize|close|toggle/i;
    const LABEL_HINT_RE = /title|label|name|text/i;
    const META_HINT_RE = /badge|count|tag|pill|chip|meta|shortcut|kbd/i;

    const CAT_BTW_RE = /(?:^|\s)\/btw\b|side[-_]?question|旁路|追问/i;
    const CAT_BTW_ICON_RE = /side[-_]?question|\bbtw\b/i;
    const CAT_BROWSER_RE = /browser|localhost:|https?:\/\/|webcontents|浏览器/i;
    const CAT_BROWSER_ICON_RE = /globe|browser|compass|world/i;
    const CAT_DIFF_RE = /\bdiff\b|\breview\b|changes|审查|变更|\(\+\d+\/-\d+\)/i;
    const CAT_DIFF_ICON_RE = /git[-_]?diff|\bdiff\b|file[-_]?diff|git[-_]?compare/i;
    const CAT_TERM_RE = /terminal|pwsh|powershell|bash|zsh|\bcmd\b|\bshell\b|终端|npm\s+/i;
    const CAT_TERM_ICON_RE = /terminal|console|shell|command/i;
    const CAT_DOC_RE = /artifact|\.(?:[cm]?[jt]sx?|md|json|css|html|py|rs|go|pdf|txt|yml|yaml)\b|文档|计划|\bspec\b/i;
    const CAT_DOC_ICON_RE = /file|doc|book|markdown|artifact|scroll/i;
    const CAT_PLUGIN_RE = /subagent|verifier|worker|swarm|plugin|extension|\bmcp\b|子代理|插件/i;
    const CAT_PLUGIN_ICON_RE = /puzzle|plug|\bbot\b|\bcpu\b|blocks|spark/i;

    const VTABS_I18N = {
      'zh-CN': { collapse: '折叠纵向标签栏', expand: '展开纵向标签栏' },
      'zh-TW': { collapse: '折疊縱向分頁欄', expand: '展開縱向分頁欄' },
      en: { collapse: 'Collapse vertical tabs', expand: 'Expand vertical tabs' },
      ja: { collapse: '縦タブバーを折りたたむ', expand: '縦タブバーを展開' },
      ko: { collapse: '세로 탭 접기', expand: '세로 탭 펼치기' },
      es: { collapse: 'Contraer pestañas verticales', expand: 'Expandir pestañas verticales' },
      fr: { collapse: 'Replier les onglets verticaux', expand: 'Déplier les onglets verticaux' },
      de: { collapse: 'Vertikale Tabs einklappen', expand: 'Vertikale Tabs ausklappen' },
      tr: { collapse: 'Dikey sekmeleri daralt', expand: 'Dikey sekmeleri genişlet' },
    };

    const safe = (fn) => { try { return fn(); } catch { return undefined; } };
    const isFn = (v) => typeof v === 'function';
    const clampNum = (v, min, max) => Math.min(max, Math.max(min, v));
    const ga = (el, k) => (el?.getAttribute ? el.getAttribute(k) : null);
    const ha = (el, k) => Boolean(el?.hasAttribute ? el.hasAttribute(k) : ga(el, k) !== null);
    const sa = (el, k, v) => { if (el?.setAttribute) el.setAttribute(k, String(v)); };
    const ra = (el, k) => { if (el?.removeAttribute) el.removeAttribute(k); };
    const setAttrIfChanged = (el, k, v) => { const s = String(v); if (el && ga(el, k) !== s) sa(el, k, s); };
    const qs = (r, sel) => (r?.querySelector ? r.querySelector(sel) || null : null);
    const qa = (r, sel) => (r?.querySelectorAll ? Array.from(r.querySelectorAll(sel)) : []);
    const tagU = (el) => String(el?.tagName || '').toUpperCase();
    const isEl = (n) => Boolean(n && (n.nodeType === 1 || typeof n.tagName === 'string'));
    const isOnFlag = (v) => v === 'on' || v === true;
    const clsOf = (el) => ga(el, 'class') || (typeof el?.className === 'string' ? el.className : '');

    function getCssVar(el, name) {
      if (!el?.style) return '';
      if (isFn(el.style.getPropertyValue)) return String(safe(() => el.style.getPropertyValue(name)) || '').trim();
      return String(safe(() => el.style[name]) ?? '').trim();
    }

    function setCssVar(el, name, value) {
      if (!el?.style) return false;
      const str = String(value);
      if (getCssVar(el, name) === str) return false;
      if (isFn(el.style.setProperty)) safe(() => el.style.setProperty(name, str));
      else safe(() => { el.style[name] = str; });
      return true;
    }

    function removeCssVar(el, name) {
      if (!el?.style || !getCssVar(el, name)) return false;
      if (isFn(el.style.removeProperty)) safe(() => el.style.removeProperty(name));
      else safe(() => { delete el.style[name]; });
      return true;
    }

    function parseStoredWidth(raw) {
      if (raw === null || raw === undefined || raw === '') return EXPANDED_WIDTH_PX;
      const n = Number(raw);
      if (!Number.isFinite(n)) return EXPANDED_WIDTH_PX;
      const rounded = Math.round(n);
      return rounded < MIN_EXPANDED_WIDTH_PX || rounded > MAX_EXPANDED_WIDTH_PX ? EXPANDED_WIDTH_PX : rounded;
    }

    function computeMaxExpandedWidth(hostWidth) {
      if (typeof hostWidth === 'number' && Number.isFinite(hostWidth) && hostWidth > 0) {
        return Math.max(MIN_EXPANDED_WIDTH_PX, Math.min(MAX_EXPANDED_WIDTH_PX, Math.floor(hostWidth * 0.5)));
      }
      return MAX_EXPANDED_WIDTH_PX;
    }

    function markOwned(el, isButton) {
      if (!el?.setAttribute) return el;
      sa(el, 'data-ag-owned', '1');
      if (isButton) sa(el, 'data-no-press-spring', '1');
      for (let i = 0; i < NO_TR_ATTRS.length; i++) sa(el, NO_TR_ATTRS[i][0], NO_TR_ATTRS[i][1]);
      return el;
    }

    function removeEl(el) {
      if (!el) return;
      if (isFn(el.remove)) safe(() => el.remove());
      else if (el.parentNode && isFn(el.parentNode.removeChild)) safe(() => el.parentNode.removeChild(el));
    }

    function normalizeLang(raw) {
      const s = String(raw || '').trim();
      if (!s) return '';
      const low = s.toLowerCase().replace(/_/g, '-').split(/[.@]/)[0];
      if (!low || low === 'auto') return '';
      const core = G.__agCsI18nCore?.normalizeLanguage;
      if (isFn(core)) {
        const res = safe(() => core(s, 'en'));
        if (res && Object.prototype.hasOwnProperty.call(VTABS_I18N, res)) return res;
      }
      if (low === 'yue' || low.startsWith('yue-') || low === 'zh-yue' || low.includes('cantonese')) return 'zh-CN';
      if (/^zh-(?:tw|hant|hk|mo)/.test(low) || low === 'tw' || low === 'hant') return 'zh-TW';
      if (low === 'zh' || low.startsWith('zh-')) return 'zh-CN';
      if (low === 'ja' || low.startsWith('ja-') || low === 'jp' || low === 'japanese') return 'ja';
      if (low === 'ko' || low.startsWith('ko-') || low === 'kr' || low === 'korean') return 'ko';
      if (low === 'es' || low.startsWith('es-') || low === 'spanish') return 'es';
      if (low === 'fr' || low.startsWith('fr-') || low === 'french') return 'fr';
      if (low === 'de' || low.startsWith('de-') || low === 'german') return 'de';
      if (low === 'tr' || low.startsWith('tr-') || low === 'turkish' || low === 'turkce' || low === 'türkçe') return 'tr';
      return 'en';
    }

    function isPerfBlurFreezeMode(doc) {
      const root = doc?.documentElement;
      if (ga(root, 'data-ag-cs-win-blur') !== '1') return false;
      const perf = String(ga(root, 'data-ag-cs-perf-mode') || '').trim().toLowerCase();
      return perf === 'performance' || perf === 'eco';
    }

    function isReducedMotionActive(doc, win) {
      const guardFn = win?.__agPrismReducedMotion || G.__agPrismReducedMotion;
      if (isFn(guardFn)) return Boolean(safe(() => guardFn(doc, win)));
      const root = doc?.documentElement;
      if (ga(root, 'data-ag-cs-motion') === 'off') return true;
      if (ga(root, 'data-ag-cs-ignore-rm') === '1') return false;
      return Boolean(safe(() => (win?.matchMedia || G.matchMedia)?.('(prefers-reduced-motion: reduce)')?.matches));
    }

    function resolveToggleLabels(lang, win) {
      const extBeta4 = win?.__agPrismI18nExtBeta4 || G.__agPrismI18nExtBeta4;
      if (isFn(extBeta4?.getStrings)) {
        const ext = safe(() => extBeta4.getStrings(lang));
        if (ext && typeof ext.sidePanelVtabsCollapse === 'string' && ext.sidePanelVtabsCollapse && typeof ext.sidePanelVtabsExpand === 'string' && ext.sidePanelVtabsExpand) {
          return { collapse: ext.sidePanelVtabsCollapse, expand: ext.sidePanelVtabsExpand };
        }
      }
      const locales = win?.__agCsLocales || G.__agCsLocales;
      if (isFn(locales?.getUiStrings)) {
        const ui = safe(() => locales.getUiStrings(lang));
        if (ui && typeof ui.sidePanelVtabsCollapse === 'string' && ui.sidePanelVtabsCollapse && typeof ui.sidePanelVtabsExpand === 'string' && ui.sidePanelVtabsExpand) {
          return { collapse: ui.sidePanelVtabsCollapse, expand: ui.sidePanelVtabsExpand };
        }
      }
      const pack = VTABS_I18N[lang] || VTABS_I18N.en;
      return { collapse: pack.collapse, expand: pack.expand };
    }

    function getOwnDomBus(win) {
      if (!win || typeof win !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(win, '__agPrismDomBus')) return win.__agPrismDomBus || null;
      return win === G ? G.__agPrismDomBus || null : null;
    }

    function createObserverAndEventManager(ctx) {
      let mo = null;
      let moTarget = null;
      let rootMo = null;
      let busMoUnsub = null;
      let busMoActive = false;
      let stripTextMo = null;
      let stripTextTarget = null;
      let storageBound = false;
      let visibilityBound = false;
      let pendingHiddenSync = false;
      let pendingResizeSync = false;
      let drainingBusRecords = null;
      const syncSched = { id: null, isRaf: false };

      function scheduleSync() {
        if (!ctx.isActive()) return;
        if (ctx.doc?.hidden === true) { pendingHiddenSync = true; return; }
        if (syncSched.id !== null) return;
        const run = () => {
          syncSched.id = null;
          syncSched.isRaf = false;
          if (!ctx.isActive()) return;
          if (ctx.doc?.hidden === true) { pendingHiddenSync = true; return; }
          ctx.scanAndSync();
        };
        const req = ctx.getReqRaf();
        if (req) { syncSched.isRaf = true; syncSched.id = req(run); }
        else { syncSched.isRaf = false; syncSched.id = ctx.setT(run, 0); }
      }

      function onMutations(records) {
        if (drainingBusRecords && Array.isArray(records)) {
          for (let i = 0; i < records.length; i++) drainingBusRecords.push(records[i]);
          return;
        }
        if (!ctx.isActive() || ctx.isInternalMutating()) return;
        const isResizing = ga(ctx.doc?.documentElement, 'data-ag-cs-resizing') === '1';
        if (ctx.doc?.hidden === true) {
          if (ctx.isRelevantMutation(records, null, null) || (!isResizing && pendingResizeSync)) pendingHiddenSync = true;
          return;
        }
        const hasResizeChange = Array.isArray(records) && records.some((m) => m && m.type === 'attributes' && m.attributeName === 'data-ag-cs-resizing');
        if (!isResizing && pendingResizeSync && hasResizeChange) {
          pendingResizeSync = false;
          scheduleSync();
          return;
        }
        if (!ctx.isRelevantMutation(records, null, null)) {
          if (!isResizing && pendingResizeSync) { pendingResizeSync = false; scheduleSync(); }
          return;
        }
        const bh = ctx.getBoundHost();
        if (isResizing && bh && bh.isConnected !== false) { pendingResizeSync = true; return; }
        pendingResizeSync = false;
        scheduleSync();
      }

      function onStripTextMutation(records) {
        if (!ctx.isActive() || ctx.isInternalMutating()) return;
        if (Array.isArray(records) && records.length > 0) {
          let relevant = false;
          for (let i = 0; i < records.length; i++) {
            if (records[i] && !ns.isOwnNode(records[i].target)) { relevant = true; break; }
          }
          if (!relevant) return;
        }
        if (ctx.doc?.hidden === true) { pendingHiddenSync = true; return; }
        const bh = ctx.getBoundHost();
        if (bh && bh.isConnected !== false && ga(ctx.doc?.documentElement, 'data-ag-cs-resizing') === '1') {
          pendingResizeSync = true;
          return;
        }
        scheduleSync();
      }

      function disconnectStripTextObserver() {
        if (stripTextMo) { safe(() => stripTextMo.disconnect?.()); stripTextMo = null; }
        stripTextTarget = null;
      }

      function attachStripTextObserver(strip) {
        if (!strip || !ctx.isActive()) return;
        if (stripTextMo && stripTextTarget === strip && strip.isConnected !== false) return;
        disconnectStripTextObserver();
        const MOCtor = ctx.win?.MutationObserver || G.MutationObserver;
        if (!isFn(MOCtor)) return;
        stripTextTarget = strip;
        stripTextMo = new MOCtor(onStripTextMutation);
        safe(() => stripTextMo.observe(strip, { characterData: true, subtree: true }));
      }

      function disconnectObservers() {
        if (busMoUnsub) { safe(busMoUnsub); busMoUnsub = null; }
        busMoActive = false;
        if (mo) { safe(() => mo.disconnect?.()); mo = null; }
        moTarget = null;
        if (rootMo) { safe(() => rootMo.disconnect?.()); rootMo = null; }
        disconnectStripTextObserver();
      }

      function ensureObservers() {
        const doc = ctx.doc;
        if (!doc || !ctx.isActive()) return;
        const desiredTarget = doc.body || doc.documentElement;
        if (!desiredTarget) return;

        const bus = getOwnDomBus(ctx.win);
        if (bus && isFn(bus.subscribe)) {
          if (busMoActive && busMoUnsub) return;
          disconnectObservers();
          const unsub = safe(() => bus.subscribe('side-panel-vtabs', onMutations, {
            doc, win: ctx.win, priority: 'normal',
            observeOptions: { childList: true, subtree: true, attributes: true, attributeFilter: MAIN_MO_ATTRS },
          }));
          if (isFn(unsub)) { busMoUnsub = unsub; busMoActive = true; return; }
        }

        const MOCtor = ctx.win?.MutationObserver || G.MutationObserver;
        if (!isFn(MOCtor)) return;
        if (mo && moTarget === desiredTarget && desiredTarget.isConnected !== false) return;
        disconnectObservers();
        moTarget = desiredTarget;
        mo = new MOCtor(onMutations);
        safe(() => mo.observe(desiredTarget, { childList: true, subtree: true, attributes: true, attributeFilter: MAIN_MO_ATTRS }));
        if (doc.documentElement && doc.documentElement !== desiredTarget) {
          rootMo = new MOCtor(onMutations);
          safe(() => rootMo.observe(doc.documentElement, { attributes: true, attributeFilter: ROOT_MO_ATTRS }));
        }
      }

      function drainAllPending() {
        const drained = [];
        if (busMoActive) {
          const bus = getOwnDomBus(ctx.win);
          drainingBusRecords = drained;
          try { safe(() => bus?.drainMutations?.()); } finally { drainingBusRecords = null; }
        }
        const obs = [mo, rootMo, stripTextMo];
        for (let i = 0; i < obs.length; i++) {
          const recs = safe(() => obs[i]?.takeRecords?.());
          if (Array.isArray(recs)) for (let j = 0; j < recs.length; j++) drained.push(recs[j]);
        }
        return drained;
      }

      function onStorage(ev) {
        if (!ctx.isActive()) return;
        if (ev && ev.storageArea && ctx.storage && ev.storageArea !== ctx.storage) return;
        const key = ev ? ev.key : null;
        const isClear = key === null || key === undefined;
        if (!isClear && key !== STORAGE_COLLAPSED_KEY && key !== STORAGE_WIDTH_KEY) return;
        ctx.handleStorageChange(ev, key, isClear);
      }

      function bindStorageListener(on) {
        if (!ctx.win || storageBound === on) return;
        if (on) {
          if (isFn(ctx.win.addEventListener)) { safe(() => ctx.win.addEventListener('storage', onStorage)); storageBound = true; }
        } else {
          if (isFn(ctx.win.removeEventListener)) safe(() => ctx.win.removeEventListener('storage', onStorage));
          storageBound = false;
        }
      }

      function onVisibilityChange() {
        if (!ctx.isActive() || ctx.doc?.hidden === true) return;
        const isResizing = ga(ctx.doc?.documentElement, 'data-ag-cs-resizing') === '1';
        if (pendingHiddenSync || (pendingResizeSync && !isResizing)) {
          pendingHiddenSync = false;
          if (!isResizing) pendingResizeSync = false;
          scheduleSync();
        }
      }

      function bindVisibilityListener(on) {
        if (!ctx.doc || visibilityBound === on) return;
        if (on) {
          if (isFn(ctx.doc.addEventListener)) { safe(() => ctx.doc.addEventListener('visibilitychange', onVisibilityChange)); visibilityBound = true; }
        } else {
          if (isFn(ctx.doc.removeEventListener)) safe(() => ctx.doc.removeEventListener('visibilitychange', onVisibilityChange));
          visibilityBound = false;
        }
      }

      return {
        scheduleSync,
        ensureObservers,
        disconnectObservers,
        attachStripTextObserver,
        disconnectStripTextObserver,
        hasStripTextMo: () => Boolean(stripTextMo),
        drainAllPending,
        bindStorageListener,
        bindVisibilityListener,
        markPendingHidden: () => { pendingHiddenSync = true; },
        clearPending: () => { pendingHiddenSync = false; pendingResizeSync = false; },
        cancelSync: () => ctx.cancelScheduled(syncSched),
      };
    }

    Object.assign(ns, {
      G, STORAGE_COLLAPSED_KEY, STORAGE_WIDTH_KEY, STYLE_ID, NARROW_WIDTH_PX, EXPANDED_WIDTH_PX,
      COLLAPSED_WIDTH_PX, MIN_EXPANDED_WIDTH_PX, MAX_EXPANDED_WIDTH_PX, SNAP_COLLAPSE_WIDTH_PX,
      MAX_ANCESTOR_STEPS, CAUSTIC_DURATION_MS, GLIDE_SAFETY_MS, REDUX_MISS_COOLDOWN_MS, SVG_NS,
      TOP_INSET_CLUSTER_SEL, TOP_INSET_CSS_VALUE, NO_TR_ATTRS, ALL_MARK_ATTRS, VTABS_SWEEP_SEL,
      OWNED_NODE_SEL, OWNED_CLOSEST_SEL, MAIN_MO_ATTRS, ROOT_MO_ATTRS, CLOSE_HINT_RE,
      NON_CLOSE_BTN_RE, CLOSE_GLYPH_RE, ACTION_TID_RE, LABEL_HINT_RE, META_HINT_RE,
      CAT_BTW_RE, CAT_BTW_ICON_RE, CAT_BROWSER_RE, CAT_BROWSER_ICON_RE, CAT_DIFF_RE,
      CAT_DIFF_ICON_RE, CAT_TERM_RE, CAT_TERM_ICON_RE, CAT_DOC_RE, CAT_DOC_ICON_RE,
      CAT_PLUGIN_RE, CAT_PLUGIN_ICON_RE, VTABS_I18N,
      safe, isFn, clampNum, ga, ha, sa, ra, setAttrIfChanged, qs, qa, tagU, isEl, isOnFlag, clsOf,
      getCssVar, setCssVar, removeCssVar, parseStoredWidth, computeMaxExpandedWidth, markOwned,
      removeEl, normalizeLang, isPerfBlurFreezeMode, isReducedMotionActive, resolveToggleLabels,
      getOwnDomBus, createObserverAndEventManager,
    });
  }

  if (typeof __vtabsInit === 'function') __vtabsInit(init);
  else if (typeof module === 'object' && module && module.exports) module.exports = init;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
