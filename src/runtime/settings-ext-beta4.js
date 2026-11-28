// Beta.4+ 设置面板独立扩展模块（自定义字体 + 忽略系统减弱动效 + 性能模式 + 首页光晕 + 项目分区 + 右侧纵向标签栏）
// 严格遵循 0 HTML-sink 写入规范，按需挂载于 Ch9 设置面板，不挤占老文件棘轮
(function (root, factory) {
  const api = factory(root);
  if (root) root.__agPrismSettingsExtBeta4 = api;
  if (typeof window !== 'undefined' && window && window !== root) {
    window.__agPrismSettingsExtBeta4 = api;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';

  const STYLE_ID = 'ag-prism-settings-ext-beta4-css';
  const DATALIST_ID = 'ag-prism-local-fonts-list';
  const SEG_BTN_CLS = 'ag-cs-seg-btn data-[pressed]:bg-secondary data-[pressed]:text-foreground';
  const VTABS_STORAGE_KEYS = Object.freeze([
    'ag-prism:side-panel-vtabs-collapsed',
    'ag-prism:side-panel-vtabs-width',
  ]);
  const PERF_MODES = Object.freeze(['performance', 'balanced', 'quality']);
  const PERF_MODE_OPT_KEYS = Object.freeze({
    performance: 'optPerfPerformance',
    balanced: 'optPerfBalanced',
    quality: 'optPerfQuality',
  });
  const QUOTA_MODES = Object.freeze(['compact', 'both']);
  const QUOTA_MODE_OPT_KEYS = Object.freeze({
    compact: 'optQuotaCompact',
    both: 'optQuotaBoth',
  });
  const CHAT_FONT_MODES = Object.freeze(['default', 'system-sans', 'noto-sans', 'inter', 'harmony', 'custom']);
  const CHAT_FONT_OPT_KEYS = Object.freeze({
    default: 'optChatFontDefault',
    'system-sans': 'optChatFontSystemSans',
    'noto-sans': 'optChatFontNotoSans',
    inter: 'optChatFontInter',
    harmony: 'optChatFontHarmony',
    custom: 'optFontCustom',
  });

  const EXT_CSS = [
    '.ag-cs-font-select{min-width:148px;max-width:210px;height:28px;padding:0 8px;border-radius:var(--ag-cs-r-sm,6px);border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.26));background-color:var(--ag-cs-tonal-2,#13161E);color:var(--foreground,#F2F2F5);font-size:12px;font-weight:500;outline:0;cursor:pointer;}',
    '.ag-cs-font-select option{background-color:var(--ag-cs-tonal-2,#13161E);color:var(--foreground,#F2F2F5);}',
    'html[data-ag-cs-theme="light"] .ag-cs-font-select,html[data-ag-cs-theme="light"] .ag-cs-font-select option{background-color:#FFFFFF;color:#0F172A;border-color:rgba(15,23,42,.18);}',
    '.ag-cs-font-custom-box{margin:0 0 10px;padding:8px 10px;border-radius:8px;border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.22));background:var(--ag-cs-tonal-1,rgba(148,163,184,.06));display:flex;flex-direction:column;gap:6px;}',
    '.ag-cs-font-custom-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
    '.ag-cs-font-input{flex:1 1 200px;min-width:140px;height:28px;padding:0 9px;border-radius:6px;border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.28));background:var(--ag-cs-tonal-0,rgba(0,0,0,.22));color:var(--foreground,#F2F2F5);font-size:12px;outline:0;}',
    'html[data-ag-cs-theme="light"] .ag-cs-font-input{background:#FFFFFF;color:#0F172A;border-color:rgba(15,23,42,.18);}',
    '.ag-cs-font-input:focus{border-color:var(--primary,#669DF6);}',
    '.ag-cs-font-act-btn{height:28px;padding:0 9px;border-radius:6px;border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.28));background:var(--ag-cs-tonal-3,rgba(148,163,184,.12));color:var(--foreground,#F2F2F5);font-size:11.5px;font-weight:500;cursor:pointer;white-space:nowrap;}',
    'html[data-ag-cs-theme="light"] .ag-cs-font-act-btn{background:#F1F5F9;color:#0F172A;border-color:rgba(15,23,42,.16);}',
    '.ag-cs-font-act-btn:hover{border-color:var(--primary,#669DF6);}',
    '.ag-cs-font-hint{font-size:11px;line-height:1.4;color:var(--muted-foreground,#94A3B8);}',
    '.ag-cs-font-hint[data-tone="warn"]{color:var(--warning,#F2B84B);}',
  ].join('\n');

  const sa = (el, k, v = '') => el && el.setAttribute && el.setAttribute(k, String(v));
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute(k) : null);
  const ra = (el, k) => el && el.removeAttribute && el.removeAttribute(k);
  const qs = (el, s) => (el && el.querySelector ? el.querySelector(s) : null);
  const mk = (doc, tag, cls, txt) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined && txt !== null) el.textContent = String(txt);
    return el;
  };

  function getExtStrings(lang, baseUi) {
    const mod = G.__agPrismI18nExtBeta4 || (typeof window !== 'undefined' ? window.__agPrismI18nExtBeta4 : null);
    if (mod && typeof mod.mergeIntoUiStrings === 'function') return mod.mergeIntoUiStrings(baseUi, lang);
    return Object.assign({}, baseUi || {});
  }

  function ensureStyle(doc) {
    if (!doc || !doc.head) return;
    let st = typeof doc.getElementById === 'function' ? doc.getElementById(STYLE_ID) : null;
    if (!st) {
      st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = EXT_CSS;
      doc.head.appendChild(st);
    } else if (st.textContent !== EXT_CSS) {
      st.textContent = EXT_CSS;
    }
  }

  function ensureLocalFontDatalist(doc, rootEl) {
    let dl = typeof doc.getElementById === 'function' ? doc.getElementById(DATALIST_ID) : qs(rootEl, '#' + DATALIST_ID);
    if (!dl) {
      dl = doc.createElement('datalist');
      dl.id = DATALIST_ID;
      sa(dl, 'id', DATALIST_ID);
      (rootEl || doc.body || doc.documentElement).appendChild(dl);
    }
    return dl;
  }

  function populateDatalist(doc, dl, families) {
    if (!dl) return;
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    for (let i = 0; i < families.length; i++) {
      const opt = doc.createElement('option');
      opt.value = families[i];
      sa(opt, 'value', families[i]);
      dl.appendChild(opt);
    }
  }

  function readLiveCfg(ctx, key, fallback) {
    try {
      if (typeof ctx.effVal === 'function') {
        const v = ctx.effVal(key, ctx.lang);
        if (v !== undefined && v !== null) return v;
      }
    } catch {}
    try {
      const st = (ctx.win || G).__agPrism?.getState?.();
      if (st && st.cfg && Object.prototype.hasOwnProperty.call(st.cfg, key)) return st.cfg[key];
    } catch {}
    return fallback;
  }

  function applyLiveFontPreview(win, doc, patch) {
    const fc = (win && win.__agPrismFontCustomizer) || G.__agPrismFontCustomizer;
    if (!fc || typeof fc.applyCustomFonts !== 'function') return;
    let curCfg = {};
    try { curCfg = (win || G).__agPrism?.getState?.()?.cfg || {}; } catch {}
    fc.applyCustomFonts(Object.assign({}, curCfg, patch), doc);
  }

  function createCustomFontBox(doc, kind, ctx) {
    const customKey = kind === 'code' ? 'codeFontCustom' : 'chatFontCustom';
    const modeKey = kind === 'code' ? 'codeFont' : 'chatFont';
    const box = mk(doc, 'div', 'ag-cs-font-custom-box');
    sa(box, 'data-ag-cs-ext-custom', kind);

    const row = mk(doc, 'div', 'ag-cs-font-custom-row');
    const inp = mk(doc, 'input', 'ag-cs-font-input');
    inp.type = 'text';
    inp.maxLength = 160;
    sa(inp, 'type', 'text');
    sa(inp, 'maxlength', '160');
    sa(inp, 'list', DATALIST_ID);
    sa(inp, 'data-ag-cs-ext-input', customKey);

    const loadBtn = mk(doc, 'button', 'ag-cs-font-act-btn');
    loadBtn.type = 'button';
    sa(loadBtn, 'type', 'button');
    sa(loadBtn, 'data-ag-cs-ext-action', 'load-local-fonts');

    const resetBtn = mk(doc, 'button', 'ag-cs-font-act-btn');
    resetBtn.type = 'button';
    sa(resetBtn, 'type', 'button');
    sa(resetBtn, 'data-ag-cs-ext-action', kind === 'code' ? 'reset-code-font' : 'reset-chat-font');

    const hint = mk(doc, 'div', 'ag-cs-font-hint');
    sa(hint, 'data-ag-cs-ext-hint', kind);
    hint.hidden = true;
    sa(hint, 'hidden', '');

    row.appendChild(inp);
    row.appendChild(loadBtn);
    row.appendChild(resetBtn);
    box.appendChild(row);
    box.appendChild(hint);

    let saveTimer = null;
    const commitInput = (immediate) => {
      const raw = String(inp.value || '').slice(0, 160);
      const fc = (ctx.win && ctx.win.__agPrismFontCustomizer) || G.__agPrismFontCustomizer;
      const check = fc && typeof fc.sanitizeFontFamilyList === 'function' ? fc.sanitizeFontFamilyList(raw) : { hadRejected: false };
      if (check.hadRejected) {
        const s = box.__extStrings || {};
        hint.textContent = s.fontSanitizedNotice || 'Unsafe characters were stripped; only valid font family names are applied';
        sa(hint, 'data-tone', 'warn');
        hint.hidden = false;
        ra(hint, 'hidden');
      } else if (ga(hint, 'data-tone') === 'warn') {
        hint.textContent = '';
        hint.hidden = true;
        sa(hint, 'hidden', '');
        ra(hint, 'data-tone');
      }
      applyLiveFontPreview(ctx.win, doc, { [modeKey]: 'custom', [customKey]: raw });
      const persist = () => { if (typeof ctx.saveSetting === 'function') ctx.saveSetting(customKey, raw); };
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      if (immediate) persist();
      else saveTimer = setTimeout(persist, 180);
    };

    inp.addEventListener('input', () => commitInput(false));
    inp.addEventListener('change', () => commitInput(true));

    loadBtn.addEventListener('click', async (ev) => {
      ev?.stopPropagation?.();
      const s = box.__extStrings || {};
      const fc = (ctx.win && ctx.win.__agPrismFontCustomizer) || G.__agPrismFontCustomizer;
      hint.textContent = s.fontLocalLoading || 'Loading local fonts...';
      ra(hint, 'data-tone');
      hint.hidden = false;
      ra(hint, 'hidden');
      if (!fc || typeof fc.listLocalFontFamilies !== 'function') {
        hint.textContent = s.fontLocalUnsupported || 'Local font enumeration is unavailable here';
        return;
      }
      const res = await fc.listLocalFontFamilies(ctx.win);
      if (res && res.ok) {
        populateDatalist(doc, ensureLocalFontDatalist(doc, box.__extRootEl), res.families);
        hint.textContent = String(s.fontLocalLoaded || 'Loaded {n} local fonts').replace('{n}', String(res.families.length));
      } else if (res && res.denied) {
        hint.textContent = s.fontLocalDenied || 'Font permission was declined; you can still enter font names manually';
      } else {
        hint.textContent = s.fontLocalUnsupported || 'Local font enumeration is unavailable here; type font names manually';
      }
    });

    resetBtn.addEventListener('click', (ev) => {
      ev?.stopPropagation?.();
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      inp.value = '';
      hint.textContent = '';
      hint.hidden = true;
      sa(hint, 'hidden', '');
      ra(hint, 'data-tone');
      applyLiveFontPreview(ctx.win, doc, { [modeKey]: 'default', [customKey]: '' });
      if (typeof ctx.saveSettingsBatch === 'function') {
        ctx.saveSettingsBatch({ [modeKey]: 'default', [customKey]: '' });
      } else if (typeof ctx.saveSetting === 'function') {
        ctx.saveSetting(modeKey, 'default');
        ctx.saveSetting(customKey, '');
      }
      if (typeof box.__extResync === 'function') box.__extResync();
    });

    return { box, inp, loadBtn, resetBtn, hint };
  }

  function normPerfMode(raw) {
    const bus = G.__agPrismDomBus || (typeof window !== 'undefined' ? window.__agPrismDomBus : null);
    if (bus && typeof bus.normalizePerformanceMode === 'function') return bus.normalizePerformanceMode(raw);
    const low = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (low === 'performance' || low === 'eco') return 'performance';
    if (low === 'quality') return 'quality';
    return 'balanced';
  }

  function mkExtRow(doc, key, ctrlChild) {
    const row = mk(doc, 'div');
    sa(row, 'data-ag-cs-row', key);
    sa(row, 'data-ag-cs-ext-owned', '1');
    const inner = mk(doc, 'div', 'py-2');
    const textCol = mk(doc, 'div', 'flex-1');
    const titleLine = mk(doc, 'div', 'ag-cs-settings-title-line');
    const tSpan = mk(doc, 'span'); sa(tSpan, 'data-k', 't');
    const dSpan = mk(doc, 'span', 'whitespace-pre-wrap'); sa(dSpan, 'data-k', 'd');
    titleLine.appendChild(tSpan); textCol.appendChild(titleLine); textCol.appendChild(dSpan);
    const ctrlWrap = mk(doc, 'div', 'shrink-0');
    if (ctrlChild) ctrlWrap.appendChild(ctrlChild);
    inner.appendChild(textCol); inner.appendChild(ctrlWrap); row.appendChild(inner);
    return row;
  }

  function insertRowRel(anchor, row, after) {
    const parent = anchor.parentElement;
    const ref = after ? anchor.nextSibling : anchor;
    if (ref && typeof parent.insertBefore === 'function') parent.insertBefore(row, ref);
    else parent.appendChild(row);
    return row;
  }

  function mkSegGroup(doc, key, values, valAttr, onSelect) {
    const grp = mk(doc, 'div', 'ag-cs-seg-group');
    sa(grp, 'role', 'group');
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const btn = mk(doc, 'button', SEG_BTN_CLS);
      btn.type = 'button'; sa(btn, 'type', 'button');
      sa(btn, 'data-ag-cs-ext-key', key); sa(btn, 'data-ag-cs-ext-val', JSON.stringify(val)); sa(btn, valAttr, val);
      btn.addEventListener('click', (ev) => { ev?.stopPropagation?.(); onSelect(val); });
      grp.appendChild(btn);
    }
    return grp;
  }

  function syncRowHeader(row, title, desc, dimmed, resyncNow) {
    row.__extResync = resyncNow;
    const tEl = qs(row, '[data-k="t"]'), dEl = qs(row, '[data-k="d"]');
    if (tEl && tEl.textContent !== title) tEl.textContent = title;
    if (dEl && dEl.textContent !== desc) dEl.textContent = desc;
    if (dimmed !== null) {
      if (row.style) row.style.opacity = dimmed ? '0.55' : '';
      if (dimmed) sa(row, 'data-ag-cs-dimmed', '1'); else ra(row, 'data-ag-cs-dimmed');
    }
  }

  function syncSegRow(row, key, valAttr, optKeys, activeVal, defaultVal, extUi) {
    const grp = qs(row, '.ag-cs-seg-group');
    if (!grp) return;
    const btns = grp.querySelectorAll ? grp.querySelectorAll(`button[data-ag-cs-ext-key="${key}"]`) : [];
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i], val = ga(b, valAttr) || defaultVal, optKey = optKeys[val];
      const lbl = (optKey && extUi[optKey]) || val;
      if (b.textContent !== lbl) b.textContent = lbl;
      const act = val === activeVal;
      sa(b, 'aria-pressed', act ? 'true' : 'false');
      if (act) sa(b, 'data-pressed'); else ra(b, 'data-pressed');
    }
  }

  function syncCustomFontUi(doc, cUi, showCustom, customVal, placeholder, extUi, resyncNow) {
    if (!cUi) return;
    cUi.box.__extStrings = extUi;
    cUi.box.__extResync = resyncNow;
    cUi.box.hidden = !showCustom;
    if (showCustom) ra(cUi.box, 'hidden'); else sa(cUi.box, 'hidden', '');
    if (cUi.box.style) cUi.box.style.display = showCustom ? 'flex' : 'none';
    if (doc.activeElement !== cUi.inp && cUi.inp.value !== customVal) cUi.inp.value = customVal;
    sa(cUi.inp, 'placeholder', placeholder);
    cUi.loadBtn.textContent = extUi.btnLoadLocalFonts || 'Load Local Fonts';
    cUi.resetBtn.textContent = extUi.btnResetFontDefault || 'Reset Default';
  }

  function ensurePerformanceModeRow(rootEl, doc, ctx) {
    let row = qs(rootEl, '[data-ag-cs-row="performanceMode"]');
    if (row) return row;
    const motionRow = qs(rootEl, '[data-ag-cs-row="motionLevel"]');
    if (!motionRow || !motionRow.parentElement) return null;
    const grp = mkSegGroup(doc, 'performanceMode', PERF_MODES, 'data-ag-cs-ext-perf', (val) => {
      const bus = (ctx.win && ctx.win.__agPrismDomBus) || G.__agPrismDomBus;
      if (bus && typeof bus.applyPerformanceMode === 'function') {
        bus.applyPerformanceMode(val, doc, ctx.win);
      } else if (doc && doc.documentElement) {
        try { if (doc.documentElement.dataset) doc.documentElement.dataset.agCsPerfMode = val; } catch {}
        sa(doc.documentElement, 'data-ag-cs-perf-mode', val);
      }
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('performanceMode', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    });
    row = mkExtRow(doc, 'performanceMode', grp);
    return insertRowRel(motionRow, row, false);
  }

  function ensureSwitchRow(rootEl, doc, key, anchorKey, onPick, options = [[true, 'on'], [false, 'off']]) {
    let row = qs(rootEl, `[data-ag-cs-row="${key}"]`);
    if (row) return row;
    const anchorRow = qs(rootEl, `[data-ag-cs-row="${anchorKey}"]`);
    if (!anchorRow || !anchorRow.parentElement) return null;
    const grp = mk(doc, 'div', 'ag-cs-seg-group');
    sa(grp, 'role', 'group'); sa(grp, 'data-ui-kind', 'switch'); sa(grp, 'data-switch-on', '0');
    const thumb = mk(doc, 'span', 'ag-cs-switch-thumb'); sa(thumb, 'aria-hidden', 'true');
    grp.appendChild(thumb);
    for (const [val, roleTag] of options) {
      const btn = mk(doc, 'button', SEG_BTN_CLS);
      btn.type = 'button'; sa(btn, 'type', 'button');
      sa(btn, 'data-ag-cs-ext-key', key); sa(btn, 'data-ag-cs-ext-val', JSON.stringify(val)); sa(btn, 'data-ag-cs-ext-role', roleTag);
      btn.addEventListener('click', (ev) => { ev?.stopPropagation?.(); onPick(val, row); });
      grp.appendChild(btn);
    }
    row = mkExtRow(doc, key, grp);
    return insertRowRel(anchorRow, row, true);
  }

  function ensureIgnoreRmRow(rootEl, doc, ctx) {
    return ensureSwitchRow(rootEl, doc, 'ignoreReducedMotion', 'motionLevel', (val, row) => {
      const applyFn = (ctx.win && ctx.win.__agPrismApplyIgnoreReducedMotion) || G.__agPrismApplyIgnoreReducedMotion;
      if (typeof applyFn === 'function') applyFn(val, doc, ctx.win);
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('ignoreReducedMotion', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    });
  }

  function ensureHomeGlowRow(rootEl, doc, ctx) {
    return ensureSwitchRow(rootEl, doc, 'homeGlow', 'homeRipple', (val, row) => {
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('homeGlow', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    });
  }

  function ensureProjectPartitionsRow(rootEl, doc, ctx) {
    return ensureSwitchRow(rootEl, doc, 'projectPartitions', 'sidebarNavFold', (val, row) => {
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('projectPartitions', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    }, [['on', 'on'], ['off', 'off']]);
  }

  function ensureSidePanelVtabsRow(rootEl, doc, ctx) {
    const anchor = qs(rootEl, '[data-ag-cs-row="projectPartitions"]') ? 'projectPartitions' : 'sidebarNavFold';
    return ensureSwitchRow(rootEl, doc, 'sidePanelVerticalTabs', anchor, (val, row) => {
      if (doc && doc.documentElement) sa(doc.documentElement, 'data-ag-cs-side-panel-vertical-tabs', val);
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('sidePanelVerticalTabs', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    }, [['on', 'on'], ['off', 'off']]);
  }

  function syncSwitchRow(row, key, val, dimmed, titleText, descText, extUi, resyncNow) {
    if (!row) return;
    syncRowHeader(row, titleText, descText, dimmed, resyncNow);
    const grp = qs(row, '.ag-cs-seg-group');
    if (!grp) return;
    sa(grp, 'data-switch-on', val ? '1' : '0');
    const btns = grp.querySelectorAll ? grp.querySelectorAll(`button[data-ag-cs-ext-key="${key}"]`) : [];
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i], isOnBtn = ga(b, 'data-ag-cs-ext-role') === 'on';
      const lbl = isOnBtn ? (extUi.onLabel || 'On') : (extUi.offLabel || 'Off');
      if (b.textContent !== lbl) b.textContent = lbl;
      const act = isOnBtn === val;
      sa(b, 'aria-pressed', act ? 'true' : 'false');
      if (act) sa(b, 'data-pressed'); else ra(b, 'data-pressed');
      b.tabIndex = act ? -1 : 0; sa(b, 'tabindex', act ? '-1' : '0');
    }
  }

  function ensureChatFontRow(rootEl, doc, ctx) {
    let row = qs(rootEl, '[data-ag-cs-row="chatFont"]');
    if (row) return row;
    const codeRow = qs(rootEl, '[data-ag-cs-row="codeFont"]');
    if (!codeRow || !codeRow.parentElement) return null;
    const sel = mk(doc, 'select', 'ag-cs-font-select');
    sa(sel, 'data-ag-cs-ext-select', 'chatFont');
    for (let i = 0; i < CHAT_FONT_MODES.length; i++) {
      const m = CHAT_FONT_MODES[i], opt = mk(doc, 'option');
      opt.value = m; sa(opt, 'value', m); sel.appendChild(opt);
    }
    const customUi = createCustomFontBox(doc, 'chat', ctx);
    customUi.box.__extRootEl = rootEl;
    sel.addEventListener('change', () => {
      const val = String(sel.value || 'default');
      applyLiveFontPreview(ctx.win, doc, { chatFont: val, chatFontCustom: String(customUi.inp.value || '') });
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('chatFont', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    });
    row = mkExtRow(doc, 'chatFont', sel);
    row.appendChild(customUi.box);
    row.__extCustomUi = customUi;
    row.__extSelect = sel;
    return insertRowRel(codeRow, row, false);
  }

  function ensureCodeFontCustomExtension(rootEl, doc, ctx) {
    const codeRow = qs(rootEl, '[data-ag-cs-row="codeFont"]');
    if (!codeRow) return null;
    const grp = qs(codeRow, '.ag-cs-seg-group');
    let customBtn = grp ? qs(grp, 'button[data-ag-cs-code-custom="1"]') : null;
    if (grp && !customBtn) {
      customBtn = mk(doc, 'button', SEG_BTN_CLS);
      customBtn.type = 'button'; sa(customBtn, 'type', 'button');
      sa(customBtn, 'data-ag-cs-key', 'codeFont'); sa(customBtn, 'data-ag-cs-val', '"custom"');
      sa(customBtn, 'data-ag-cs-code-custom', '1'); sa(customBtn, 'data-ag-cs-ext-owned', '1');
      sa(customBtn, 'aria-pressed', 'false');
      customBtn.addEventListener('click', (ev) => {
        ev?.stopPropagation?.();
        const sibs = grp.querySelectorAll ? grp.querySelectorAll('button[data-ag-cs-key="codeFont"]') : [];
        for (let i = 0; i < sibs.length; i++) {
          const isCur = sibs[i] === customBtn;
          sibs[i].__agOn = isCur;
          sa(sibs[i], 'aria-pressed', isCur ? 'true' : 'false');
          if (isCur) sa(sibs[i], 'data-pressed'); else ra(sibs[i], 'data-pressed');
        }
        applyLiveFontPreview(ctx.win, doc, { codeFont: 'custom', codeFontCustom: String(codeRow.__extCustomUi?.inp?.value || '') });
        if (typeof ctx.saveSetting === 'function') ctx.saveSetting('codeFont', 'custom');
        if (typeof codeRow.__extResync === 'function') codeRow.__extResync();
      });
      grp.appendChild(customBtn);
    }
    let customUi = codeRow.__extCustomUi || null;
    if (!customUi) {
      customUi = createCustomFontBox(doc, 'code', ctx);
      customUi.box.__extRootEl = rootEl;
      codeRow.appendChild(customUi.box);
      codeRow.__extCustomUi = customUi;
    }
    return { codeRow, customBtn, customUi };
  }

  function ensureTelemetryQuotaModeRow(rootEl, doc, ctx) {
    let row = qs(rootEl, '[data-ag-cs-row="telemetryQuotaMode"]');
    if (row) return row;
    const telRow = qs(rootEl, '[data-ag-cs-row="telemetryModule"]');
    if (!telRow || !telRow.parentElement) return null;
    const grp = mkSegGroup(doc, 'telemetryQuotaMode', QUOTA_MODES, 'data-ag-cs-ext-qmode', (val) => {
      if (doc && doc.documentElement) sa(doc.documentElement, 'data-ag-cs-telemetry-quota', val);
      const tel = (ctx.win && ctx.win.__agPrismTelemetry) || G.__agPrismTelemetry;
      if (tel && typeof tel.sync === 'function') {
        let curCfg = {};
        try { curCfg = (ctx.win || G).__agPrism?.getState?.()?.cfg || {}; } catch {}
        try { tel.sync(Object.assign({}, curCfg, { telemetryQuotaMode: val })); } catch {}
      }
      if (typeof ctx.saveSetting === 'function') ctx.saveSetting('telemetryQuotaMode', val);
      if (typeof row.__extResync === 'function') row.__extResync();
    });
    row = mkExtRow(doc, 'telemetryQuotaMode', grp);
    return insertRowRel(telRow, row, true);
  }

  function ensureResetHook(rootEl, ctx, rawCtx) {
    rootEl.__extBeta4Ctx = ctx;
    rootEl.__extBeta4RawCtx = rawCtx;
    const resetBtn = qs(rootEl, 'button[data-ag-cs-cfg-action="reset"]');
    if (!resetBtn || resetBtn.__extBeta4ResetBound) return;
    resetBtn.__extBeta4ResetBound = true;
    resetBtn.addEventListener('click', () => {
      const liveCtx = rootEl.__extBeta4Ctx || ctx;
      const liveRaw = rootEl.__extBeta4RawCtx || rawCtx;
      try {
        const st = (liveCtx.win && liveCtx.win.localStorage) || (typeof localStorage !== 'undefined' ? localStorage : null);
        if (st && typeof st.removeItem === 'function') {
          for (let i = 0; i < VTABS_STORAGE_KEYS.length; i++) {
            try { st.removeItem(VTABS_STORAGE_KEYS[i]); } catch {}
          }
        }
      } catch {}
      if (liveCtx.doc && liveCtx.doc.documentElement) sa(liveCtx.doc.documentElement, 'data-ag-cs-side-panel-vertical-tabs', 'off');
      if (typeof liveCtx.saveSetting === 'function') liveCtx.saveSetting('sidePanelVerticalTabs', 'off');
      const liveRoot = (liveCtx.doc && typeof liveCtx.doc.getElementById === 'function' && liveCtx.doc.getElementById('ag-cs-settings-sec')) || rootEl;
      if (liveRoot) { liveRoot.__extBeta4Sig = ''; sync(liveRoot, liveRaw); }
    });
  }

  function sync(rootEl, rawCtx) {
    if (!rootEl || ga(rootEl, 'data-body-built') !== '1') return false;
    const doc = (rawCtx && rawCtx.doc) || rootEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return false;
    const win = (rawCtx && rawCtx.win) || doc.defaultView || (typeof window !== 'undefined' ? window : G);
    const lang = (rawCtx && rawCtx.lang) || ga(rootEl, 'data-ag-cs-lang') || 'en';
    const extUi = getExtStrings(lang, rawCtx && rawCtx.ui);
    const ctx = Object.assign({}, rawCtx || {}, { doc, win, lang, ui: extUi });
    const runMut = typeof ctx.runGuardedMut === 'function' ? ctx.runGuardedMut : (fn) => fn();

    ensureResetHook(rootEl, ctx, rawCtx);

    const perfMode = normPerfMode(readLiveCfg(ctx, 'performanceMode', 'balanced'));
    const ignoreRm = Boolean(readLiveCfg(ctx, 'ignoreReducedMotion', false));
    const motionOff = readLiveCfg(ctx, 'motionLevel', 'ultra') === 'off';
    const homeLayoutOff = readLiveCfg(ctx, 'homeLayout', 'studio') === 'off';
    const homeGlow = readLiveCfg(ctx, 'homeGlow', true) !== false;
    const chatFont = String(readLiveCfg(ctx, 'chatFont', 'default') || 'default');
    const chatFontCustom = String(readLiveCfg(ctx, 'chatFontCustom', '') || '');
    const codeFont = String(readLiveCfg(ctx, 'codeFont', 'default') || 'default');
    const codeFontCustom = String(readLiveCfg(ctx, 'codeFontCustom', '') || '');
    const telOff = readLiveCfg(ctx, 'telemetryModule', 'auto') === 'off';
    const telQuotaMode = readLiveCfg(ctx, 'telemetryQuotaMode', 'compact') === 'both' ? 'both' : 'compact';
    const rawPart = readLiveCfg(ctx, 'projectPartitions', 'off');
    const partOn = rawPart === 'on' || rawPart === true;
    const rawVt = readLiveCfg(ctx, 'sidePanelVerticalTabs', 'off');
    const vtOn = rawVt === 'on' || rawVt === true;

    const extSig = `${lang}|${perfMode}|${+ignoreRm}|${+motionOff}|${+homeLayoutOff}|${+homeGlow}|${chatFont}|${chatFontCustom}|${codeFont}|${codeFontCustom}|${+telOff}|${telQuotaMode}|${+partOn}|${+vtOn}`;
    if (
      rootEl.__extBeta4Sig === extSig &&
      qs(rootEl, '[data-ag-cs-row="performanceMode"]') &&
      qs(rootEl, '[data-ag-cs-row="ignoreReducedMotion"]') &&
      (!qs(rootEl, '[data-ag-cs-row="homeRipple"]') || qs(rootEl, '[data-ag-cs-row="homeGlow"]')) &&
      qs(rootEl, '[data-ag-cs-row="chatFont"]') &&
      qs(rootEl, 'button[data-ag-cs-code-custom="1"]') &&
      (!qs(rootEl, '[data-ag-cs-row="telemetryModule"]') || qs(rootEl, '[data-ag-cs-row="telemetryQuotaMode"]')) &&
      (!qs(rootEl, '[data-ag-cs-row="sidebarNavFold"]') || (qs(rootEl, '[data-ag-cs-row="projectPartitions"]') && qs(rootEl, '[data-ag-cs-row="sidePanelVerticalTabs"]')))
    ) {
      return true;
    }

    const resyncNow = () => { rootEl.__extBeta4Sig = ''; sync(rootEl, rawCtx); };

    runMut(() => {
      ensureStyle(doc);
      ensureLocalFontDatalist(doc, rootEl);

      // 0. 无损性能模式分段选择器（动效区顶部，不改写动效/波纹/宠物设置）
      const perfRow = ensurePerformanceModeRow(rootEl, doc, ctx);
      if (perfRow) {
        syncRowHeader(perfRow, extUi.setPerformanceModeTitle || 'Performance Mode', extUi.setPerformanceModeDesc || '', null, resyncNow);
        syncSegRow(perfRow, 'performanceMode', 'data-ag-cs-ext-perf', PERF_MODE_OPT_KEYS, perfMode, 'balanced', extUi);
      }

      // 1. 开关项：忽略系统减弱动效 / 首页底部光晕 / 项目分区 / 右侧纵向标签栏
      syncSwitchRow(ensureIgnoreRmRow(rootEl, doc, ctx), 'ignoreReducedMotion', ignoreRm, motionOff, extUi.setIgnoreReducedMotionTitle || 'Ignore System Reduced Motion', extUi.setIgnoreReducedMotionDesc || '', extUi, resyncNow);
      syncSwitchRow(ensureHomeGlowRow(rootEl, doc, ctx), 'homeGlow', homeGlow, motionOff || homeLayoutOff, extUi.setHomeGlowTitle || 'Home Horizon Glow', extUi.setHomeGlowDesc || '', extUi, resyncNow);
      syncSwitchRow(ensureProjectPartitionsRow(rootEl, doc, ctx), 'projectPartitions', partOn, false, extUi.setProjectPartitionsLabel || 'Project Partitions', extUi.setProjectPartitionsDesc || '', extUi, resyncNow);
      syncSwitchRow(ensureSidePanelVtabsRow(rootEl, doc, ctx), 'sidePanelVerticalTabs', vtOn, false, extUi.setSidePanelVerticalTabsTitle || 'Right Panel Vertical Tabs', extUi.setSidePanelVerticalTabsDesc || '', extUi, resyncNow);

      // 2. 会话正文字体（字体/排版区）
      const chatRow = ensureChatFontRow(rootEl, doc, ctx);
      if (chatRow) {
        syncRowHeader(chatRow, extUi.setChatFontTitle || 'Chat Body Font', extUi.setChatFontDesc || '', null, resyncNow);
        const sel = chatRow.__extSelect;
        if (sel) {
          const opts = sel.children || [];
          for (let i = 0; i < opts.length; i++) {
            const opt = opts[i], key = CHAT_FONT_OPT_KEYS[opt.value], lbl = (key && extUi[key]) || opt.value;
            if (opt.textContent !== lbl) opt.textContent = lbl;
          }
          const safeMode = CHAT_FONT_MODES.includes(chatFont) ? chatFont : 'default';
          if (sel.value !== safeMode) sel.value = safeMode;
        }
        syncCustomFontUi(doc, chatRow.__extCustomUi, chatFont === 'custom', chatFontCustom, extUi.chatFontCustomPlaceholder || 'Font family names, comma-separated', extUi, resyncNow);
      }

      // 3. 代码等宽字体扩展「自定义」选项与输入框
      const codeExt = ensureCodeFontCustomExtension(rootEl, doc, ctx);
      if (codeExt) {
        codeExt.codeRow.__extResync = resyncNow;
        if (codeExt.customBtn) {
          const lbl = extUi.optFontCustom || 'Custom';
          if (codeExt.customBtn.textContent !== lbl) codeExt.customBtn.textContent = lbl;
          const act = codeFont === 'custom';
          sa(codeExt.customBtn, 'aria-pressed', act ? 'true' : 'false');
          if (act) sa(codeExt.customBtn, 'data-pressed'); else ra(codeExt.customBtn, 'data-pressed');
        }
        syncCustomFontUi(doc, codeExt.customUi, codeFont === 'custom', codeFontCustom, extUi.codeFontCustomPlaceholder || 'Monospace font families, comma-separated', extUi, resyncNow);
      }

      // 4. 底栏配额显示模式（模块区，紧随 telemetryModule 下方）
      const qmRow = ensureTelemetryQuotaModeRow(rootEl, doc, ctx);
      if (qmRow) {
        syncRowHeader(qmRow, extUi.setTelemetryQuotaModeTitle || 'Footer Quota Display', extUi.setTelemetryQuotaModeDesc || '', telOff, resyncNow);
        syncSegRow(qmRow, 'telemetryQuotaMode', 'data-ag-cs-ext-qmode', QUOTA_MODE_OPT_KEYS, telQuotaMode, 'compact', extUi);
      }
    });

    rootEl.__extBeta4Sig = extSig;
    return true;
  }

  function dispose(docOverride) {
    const doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    try { doc.getElementById?.(STYLE_ID)?.remove?.(); } catch {}
    try { doc.getElementById?.(DATALIST_ID)?.remove?.(); } catch {}
    try { doc.querySelectorAll?.('[data-ag-cs-ext-owned="1"], [data-ag-cs-ext-custom]')?.forEach?.((n) => n.remove?.()); } catch {}
  }

  return {
    STYLE_ID,
    DATALIST_ID,
    PERF_MODES,
    QUOTA_MODES,
    CHAT_FONT_MODES,
    VTABS_STORAGE_KEYS,
    sync,
    dispose,
  };
});
