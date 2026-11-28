// Antigravity-native searchable font dropdown widget (0 innerHTML, 0 :has(), 100% ASCII CSS, lazy local-font cache)
(function (root, factory) {
  try {
    const prev = (typeof window !== 'undefined' && window && window.__agPrismFontPickerUi) || (root && root.__agPrismFontPickerUi);
    if (prev && typeof prev.dispose === 'function') prev.dispose(typeof document !== 'undefined' ? document : null);
  } catch {}
  const api = factory(root);
  if (root) root.__agPrismFontPickerUi = api;
  if (typeof window !== 'undefined' && window && window !== root) window.__agPrismFontPickerUi = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';

  const PICKER_STYLE_ID = 'ag-prism-font-picker-css';
  const BATCH_SIZE = 60;
  const MAX_CUSTOM_LEN = 160;
  const MENU_MIN_W = 248;
  const MENU_MAX_W = 316;
  const MENU_EST_H = 356;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const PICKER_CSS = [
    '#ag-cs-settings-sec [data-ag-cs-fp-enhanced="1"] select[data-ag-cs-ext-select],#ag-cs-settings-sec [data-ag-cs-fp-enhanced="1"] .ag-cs-font-custom-box,#ag-cs-settings-sec [data-ag-cs-fp-enhanced="1"] .ag-cs-seg-group{display:none !important;}',
    '.ag-fp-mount{display:inline-flex;align-items:center;max-width:100%;}',
    '.ag-fp-trigger{appearance:none;display:inline-flex;align-items:center;justify-content:space-between;gap:8px;min-width:176px;max-width:242px;height:30px;padding:0 10px;border-radius:8px;font-size:12.5px;font-weight:500;line-height:18px;cursor:pointer;text-align:left;box-sizing:border-box;outline:0;}',
    '.ag-fp-trigger-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.ag-fp-trigger-chev{flex:0 0 auto;width:13px;height:13px;display:inline-flex;align-items:center;justify-content:center;color:var(--muted-foreground,#94A3B8);transition:transform .16s ease,color .14s ease;}',
    '.ag-fp-trigger[aria-expanded="true"] .ag-fp-trigger-chev{transform:rotate(180deg);color:var(--foreground,#F2F2F5);}',
    'html[data-ag-cs-motion="off"] .ag-fp-trigger-chev{transition:none !important;}',
    '.ag-fp-row-warn{margin:0 15px 10px;padding:6px 10px;border-radius:7px;font-size:11.5px;line-height:1.4;color:var(--warning,#F2B84B);background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.28);}',
    'html[data-ag-cs-theme="light"] .ag-fp-row-warn{color:#B45309;background:rgba(245,158,11,.10);border-color:rgba(245,158,11,.32);}',
    '.ag-fp-overlay{position:fixed;z-index:9996;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;min-width:248px;max-width:316px;color:var(--foreground,#F2F2F5);font-family:var(--font-sans,system-ui,sans-serif);font-size:12.5px;user-select:none;outline:0;}',
    '.ag-fp-search-wrap{display:flex;align-items:center;gap:7px;padding:4px 6px 2px;position:relative;}',
    '.ag-fp-search-ico{position:absolute;left:15px;width:13px;height:13px;color:var(--muted-foreground,#94A3B8);pointer-events:none;display:inline-flex;align-items:center;justify-content:center;}',
    '.ag-fp-search-input{width:100%;height:30px;padding:0 10px 0 28px;box-sizing:border-box;border-radius:8px;border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.24));background:var(--ag-cs-tonal-0,rgba(0,0,0,.24));color:var(--foreground,#F2F2F5);font-family:inherit;font-size:12px;line-height:18px;outline:0;transition:border-color .12s ease,box-shadow .12s ease;}',
    '.ag-fp-search-input:focus{border-color:color-mix(in srgb,var(--primary,#669DF6) 56%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary,#669DF6) 22%,transparent);}',
    'html[data-ag-cs-theme="light"] .ag-fp-search-input{background:#FFFFFF;color:#0F172A;border-color:rgba(15,23,42,.16);}',
    '.ag-fp-warn{margin:0 4px;padding:5px 8px;border-radius:7px;font-size:11px;line-height:1.35;color:var(--warning,#F2B84B);background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.28);}',
    'html[data-ag-cs-theme="light"] .ag-fp-warn{color:#B45309;}',
    '.ag-fp-list{display:flex;flex-direction:column;gap:2px;max-height:276px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:2px 0;}',
    '.ag-fp-group-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 9px 3px;font-size:11px;font-weight:600;line-height:14px;letter-spacing:.02em;color:var(--muted-foreground,#94A3B8);}',
    '.ag-fp-count{font-size:10.5px;font-weight:500;opacity:.82;font-variant-numeric:tabular-nums;}',
    '.ag-fp-item{appearance:none;width:100%;border:0;background:transparent;color:var(--secondary-foreground,#D4D7E1);font-family:inherit;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;box-sizing:border-box;outline:0;}',
    '.ag-fp-item-lbl{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.ag-fp-item-check{flex:0 0 auto;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;color:var(--primary,#669DF6);opacity:0;}',
    '.ag-fp-item[data-selected="true"] .ag-fp-item-check{opacity:1;}',
    '.ag-fp-item[data-selected="true"]{color:var(--foreground,#F2F2F5);}',
    'html[data-ag-cs-theme="light"] .ag-fp-overlay .ag-fp-item{color:#334155;}',
    'html[data-ag-cs-theme="light"] .ag-fp-overlay .ag-fp-item[data-selected="true"]{background-color:rgba(37,99,235,.09) !important;color:#0F172A !important;}',
    '.ag-fp-custom-item{color:var(--primary,#669DF6) !important;font-weight:500;}',
    '.ag-fp-reset-item{color:var(--muted-foreground,#94A3B8);}',
    '.ag-fp-reset-item:hover,.ag-fp-reset-item[data-highlighted="1"]{color:var(--foreground,#F2F2F5);}',
    '.ag-fp-status{padding:6px 10px;font-size:11.5px;line-height:1.4;color:var(--muted-foreground,#94A3B8);}',
    '.ag-fp-footer{display:flex;flex-direction:column;gap:2px;padding-top:1px;}',
  ].join('\n');

  const sa = (el, k, v = '') => el && el.setAttribute && el.setAttribute(k, String(v));
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute(k) : null);
  const ra = (el, k) => el && el.removeAttribute && el.removeAttribute(k);
  const mk = (doc, tag, cls, txt) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined && txt !== null) el.textContent = String(txt);
    return el;
  };
  const clearKids = (el) => { while (el && el.firstChild) el.removeChild(el.firstChild); };

  function makeSvgIcon(doc, kind) {
    if (!doc || typeof doc.createElementNS !== 'function') {
      return mk(doc, 'span', '', kind === 'check' ? '+' : kind === 'search' ? '' : 'v');
    }
    const svg = doc.createElementNS(SVG_NS, 'svg');
    for (const [k, v] of [['viewBox', '0 0 16 16'], ['width', '13'], ['height', '13'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.6'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']]) sa(svg, k, v);
    if (kind === 'chev' || kind === 'check') {
      const p = doc.createElementNS(SVG_NS, 'path');
      sa(p, 'd', kind === 'chev' ? 'M4.5 6.5L8 10l3.5-3.5' : 'M3.5 8.5L6.5 11.5L12.5 5');
      svg.appendChild(p);
    } else if (kind === 'search') {
      const c = doc.createElementNS(SVG_NS, 'circle');
      sa(c, 'cx', '7'); sa(c, 'cy', '7'); sa(c, 'r', '4.25');
      const l = doc.createElementNS(SVG_NS, 'path');
      sa(l, 'd', 'M10.4 10.4L13.5 13.5');
      svg.appendChild(c); svg.appendChild(l);
    }
    return svg;
  }

  let localFontCache = { status: 'idle', families: [] };
  let localFontPromise = null;
  let activeMenu = null;
  const closingEntries = new Set();
  const activeTimers = new Set();
  const activeRafs = new Set();

  function trackTimeout(fn, ms) {
    const setFn = typeof setTimeout === 'function' ? setTimeout : G.setTimeout;
    if (typeof setFn !== 'function') { fn(); return null; }
    let tid = null;
    tid = setFn(() => { activeTimers.delete(tid); fn(); }, ms);
    activeTimers.add(tid);
    return tid;
  }
  function untrackTimeout(tid) {
    if (!tid) return;
    activeTimers.delete(tid);
    try { const clr = typeof clearTimeout === 'function' ? clearTimeout : G.clearTimeout; if (typeof clr === 'function') clr(tid); } catch {}
  }
  function trackRaf(win, fn) {
    const rafFn = (win && win.requestAnimationFrame) || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : G.requestAnimationFrame);
    if (typeof rafFn !== 'function') { fn(); return null; }
    let rid = null;
    rid = rafFn(() => { activeRafs.delete(rid); fn(); });
    activeRafs.add(rid);
    return rid;
  }
  function untrackRaf(win, rid) {
    if (!rid) return;
    activeRafs.delete(rid);
    try { const caf = (win && win.cancelAnimationFrame) || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : G.cancelAnimationFrame); if (typeof caf === 'function') caf(rid); } catch {}
  }
  function flushClosingPortals() {
    for (const entry of [...closingEntries]) {
      closingEntries.delete(entry);
      if (entry.tid) untrackTimeout(entry.tid);
      try { entry.portal.remove?.(); } catch {}
    }
  }

  function ensureStyle(doc, win) {
    if (!doc || !doc.head) return;
    let st = typeof doc.getElementById === 'function' ? doc.getElementById(PICKER_STYLE_ID) : null;
    if (!st) {
      st = doc.createElement('style');
      st.id = PICKER_STYLE_ID;
      st.textContent = PICKER_CSS;
      doc.head.appendChild(st);
    } else if (st.textContent !== PICKER_CSS) {
      st.textContent = PICKER_CSS;
    }
    try { ((win && win.__agPrismCustomStyle) || G.__agPrismCustomStyle)?.ensureUserCssLast?.(doc); } catch {}
  }

  function sanitizeList(win, raw) {
    const fc = (win && win.__agPrismFontCustomizer) || G.__agPrismFontCustomizer;
    const cs = (win && win.__agPrismCustomStyle) || G.__agPrismCustomStyle;
    const mod = (fc && typeof fc.sanitizeFontFamilyList === 'function' ? fc : null) || (cs && typeof cs.sanitizeFontFamilyList === 'function' ? cs : null);
    if (mod) return mod.sanitizeFontFamilyList(raw);
    const s = typeof raw === 'string' ? raw.slice(0, MAX_CUSTOM_LEN) : '';
    const badRe = /[;{}()\\<>`$\r\n\0\x01-\x1f\x7f]|url\s*\(|expression\s*\(|@import|javascript:|data:/i;
    const safeRe = /^[\p{L}\p{N} ._-]+$/u;
    const fams = [];
    const seen = new Set();
    let hadRejected = false;
    for (const seg of s.split(',')) {
      let t = seg.trim();
      if (!t) continue;
      if (badRe.test(t)) { hadRejected = true; continue; }
      while (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) t = t.slice(1, -1).trim();
      if (/['"]/.test(t) || !t || t.length > 64 || !safeRe.test(t)) { hadRejected = true; continue; }
      const lo = t.toLowerCase();
      if (seen.has(lo)) continue;
      seen.add(lo);
      fams.push(t);
      if (fams.length >= 8) break;
    }
    return { families: fams, hadRejected };
  }

  // Strictly lazy: called ONLY when user clicks to open a font dropdown; cached in memory for 0ms re-open
  function loadLocalFontsLazy(win) {
    if (localFontCache.status === 'loaded' || localFontCache.status === 'denied' || localFontCache.status === 'unsupported') {
      return Promise.resolve(localFontCache);
    }
    if (localFontPromise) return localFontPromise;
    localFontCache = { status: 'loading', families: [] };
    const fc = (win && win.__agPrismFontCustomizer) || G.__agPrismFontCustomizer;
    const runQuery = async () => {
      try {
        if (fc && typeof fc.listLocalFontFamilies === 'function') {
          const res = await fc.listLocalFontFamilies(win);
          if (res && res.ok) return { status: 'loaded', families: Array.isArray(res.families) ? res.families : [] };
          return { status: res && res.denied ? 'denied' : 'unsupported', families: [] };
        }
        if (!win || typeof win.queryLocalFonts !== 'function') return { status: 'unsupported', families: [] };
        const fonts = await win.queryLocalFonts();
        const set = new Set();
        const list = [];
        if (fonts && typeof fonts[Symbol.iterator] === 'function') {
          for (const item of fonts) {
            const fam = item && typeof item.family === 'string' ? item.family.trim() : '';
            if (!fam) continue;
            const check = sanitizeList(win, fam);
            if (!check.families.length || check.hadRejected) continue;
            const clean = check.families[0];
            const lo = clean.toLowerCase();
            if (set.has(lo)) continue;
            set.add(lo);
            list.push(clean);
          }
        }
        list.sort((a, b) => a.localeCompare(b));
        return { status: 'loaded', families: list };
      } catch {
        return { status: 'denied', families: [] };
      }
    };
    localFontPromise = runQuery().then((next) => { localFontCache = next; localFontPromise = null; return next; });
    return localFontPromise;
  }

  const isMotionOff = (doc) => { try { return ga(doc && doc.documentElement, 'data-ag-cs-motion') === 'off'; } catch { return false; } };

  function computeDisplayLabel(state) {
    const mode = state.mode || 'default';
    if (mode === 'custom') {
      const custom = String(state.custom || '').trim();
      return custom || (state.strings && state.strings.optFontCustom) || 'Custom';
    }
    const list = state.presets || [];
    for (let i = 0; i < list.length; i++) if (list[i].value === mode) return list[i].label;
    return list[0] ? list[0].label : mode;
  }

  function closeActiveMenu(opts) {
    const m = activeMenu;
    if (!m) { if (opts && opts.immediate) flushClosingPortals(); return; }
    activeMenu = null;
    const immediate = Boolean((opts && opts.immediate) || isMotionOff(m.doc));
    if (m.openRafId) untrackRaf(m.win, m.openRafId);
    if (typeof m.cleanupListeners === 'function') { try { m.cleanupListeners(); } catch {} }
    if (m.triggerEl) {
      sa(m.triggerEl, 'aria-expanded', 'false');
      if (opts && opts.returnFocus) { try { m.triggerEl.focus?.(); } catch {} }
    }
    const portal = m.portal;
    if (!portal) return;
    if (immediate) { flushClosingPortals(); try { portal.remove?.(); } catch {} return; }
    sa(portal, 'data-ending-style', '');
    const entry = { portal, tid: null };
    closingEntries.add(entry);
    entry.tid = trackTimeout(() => { closingEntries.delete(entry); try { portal.remove?.(); } catch {} }, 170);
  }

  function positionPortal(portal, triggerEl, win) {
    if (!portal || !triggerEl || !portal.style) return true;
    const hasRect = typeof triggerEl.getBoundingClientRect === 'function';
    const rect = hasRect ? triggerEl.getBoundingClientRect() : { left: 16, top: 40, bottom: 70, right: 220, width: 204, height: 30 };
    if (hasRect && rect.width === 0 && rect.height === 0) return false;
    const vw = Number(win && win.innerWidth) || 1280;
    const vh = Number(win && win.innerHeight) || 800;
    const pad = 10;
    const gap = 6;
    const w = Math.min(MENU_MAX_W, Math.max(MENU_MIN_W, Math.round(rect.width || MENU_MIN_W)));
    const openUp = (vh - rect.bottom - pad) < MENU_EST_H && (rect.top - pad) > (vh - rect.bottom - pad);
    let left = Math.round(rect.right - w);
    if (left < pad) left = Math.round(rect.left);
    if (left + w > vw - pad) left = Math.max(pad, Math.round(vw - pad - w));
    portal.style.width = w + 'px';
    portal.style.left = left + 'px';
    if (openUp) {
      portal.style.top = 'auto';
      portal.style.bottom = Math.max(pad, Math.round(vh - rect.top + gap)) + 'px';
      portal.style.setProperty?.('--ag-origin-x', '50%');
      portal.style.setProperty?.('--ag-origin-y', '100%');
    } else {
      portal.style.bottom = 'auto';
      portal.style.top = Math.min(Math.max(pad, Math.round(rect.bottom + gap)), Math.max(pad, vh - 140)) + 'px';
      portal.style.setProperty?.('--ag-origin-x', '50%');
      portal.style.setProperty?.('--ag-origin-y', '0%');
    }
    return true;
  }

  function createItemButton(doc, label, selected, kind, val, extraCls) {
    const btn = mk(doc, 'button', 'agy-overlay-item ag-fp-item' + (extraCls ? ' ' + extraCls : ''));
    btn.type = 'button';
    sa(btn, 'type', 'button');
    sa(btn, 'role', 'option');
    sa(btn, 'data-ag-fp-kind', kind);
    if (val !== undefined && val !== null) sa(btn, 'data-ag-fp-val', String(val));
    sa(btn, 'aria-selected', selected ? 'true' : 'false');
    if (selected) sa(btn, 'data-selected', 'true');
    const lbl = mk(doc, 'span', 'ag-fp-item-lbl', label);
    const chk = mk(doc, 'span', 'ag-fp-item-check');
    sa(chk, 'aria-hidden', 'true');
    chk.appendChild(makeSvgIcon(doc, 'check'));
    btn.appendChild(lbl);
    btn.appendChild(chk);
    return btn;
  }

  function openMenuForPicker(picker) {
    const { doc, win, triggerEl } = picker;
    if (activeMenu && activeMenu.picker === picker) { closeActiveMenu({ returnFocus: true }); return; }
    closeActiveMenu({ immediate: true });
    flushClosingPortals();
    ensureStyle(doc, win);

    const portal = mk(doc, 'div', 'agy-overlay ag-fp-overlay');
    sa(portal, 'role', 'dialog');
    sa(portal, 'data-ag-cs-font-picker-portal', '1');
    sa(portal, 'data-ag-cs-font-picker-tier', picker.tier);
    if (!isMotionOff(doc)) sa(portal, 'data-starting-style', '');

    const searchWrap = mk(doc, 'div', 'ag-fp-search-wrap');
    const searchIco = mk(doc, 'span', 'ag-fp-search-ico');
    sa(searchIco, 'aria-hidden', 'true');
    searchIco.appendChild(makeSvgIcon(doc, 'search'));
    const searchInp = mk(doc, 'input', 'ag-fp-search-input');
    searchInp.type = 'text';
    searchInp.maxLength = MAX_CUSTOM_LEN;
    for (const [k, v] of [['type', 'text'], ['maxlength', String(MAX_CUSTOM_LEN)], ['autocomplete', 'off'], ['spellcheck', 'false'], ['data-ag-fp-search', picker.tier]]) sa(searchInp, k, v);
    sa(searchInp, 'placeholder', (picker.state.strings && picker.state.strings.fontPickerSearchPlaceholder) || 'Search fonts or enter stack...');
    searchWrap.appendChild(searchIco);
    searchWrap.appendChild(searchInp);

    const warnEl = mk(doc, 'div', 'ag-fp-warn');
    warnEl.hidden = true;
    sa(warnEl, 'hidden', '');
    sa(warnEl, 'data-ag-fp-warn', '1');

    const listEl = mk(doc, 'div', 'ag-fp-list');
    sa(listEl, 'role', 'listbox');
    sa(listEl, 'data-ag-fp-list', picker.tier);

    const sepFoot = mk(doc, 'div');
    sa(sepFoot, 'role', 'separator');
    const footer = mk(doc, 'div', 'ag-fp-footer');
    const resetLabel = (picker.state.strings && (picker.state.strings.fontPickerResetDefault || picker.state.strings.btnResetFontDefault)) || 'Reset to Default';
    const resetBtn = createItemButton(doc, resetLabel, false, 'reset', 'default', 'ag-fp-reset-item');
    sa(resetBtn, 'data-ag-fp-reset', picker.tier);
    footer.appendChild(resetBtn);

    portal.appendChild(searchWrap);
    portal.appendChild(warnEl);
    portal.appendChild(listEl);
    portal.appendChild(sepFoot);
    portal.appendChild(footer);

    let filteredLocal = [];
    let renderedLocal = 0;
    let localContainer = null;
    let highlightIdx = -1;

    const getSelectableItems = () => {
      const out = [];
      const walk = (node) => {
        for (let i = 0; i < (node.children || []).length; i++) {
          const ch = node.children[i];
          if (ch.tagName === 'BUTTON' && ga(ch, 'role') === 'option') out.push(ch);
          else if (ch.children && ch.children.length) walk(ch);
        }
      };
      walk(listEl);
      out.push(resetBtn);
      return out;
    };

    const setHighlight = (nextIdx) => {
      const items = getSelectableItems();
      for (let i = 0; i < items.length; i++) ra(items[i], 'data-highlighted');
      if (!items.length || nextIdx < 0) { highlightIdx = -1; return; }
      highlightIdx = ((nextIdx % items.length) + items.length) % items.length;
      sa(items[highlightIdx], 'data-highlighted', '1');
      try { items[highlightIdx].scrollIntoView?.({ block: 'nearest' }); } catch {}
    };

    const showInlineWarn = (msg) => {
      warnEl.textContent = msg || '';
      warnEl.hidden = !msg;
      if (msg) ra(warnEl, 'hidden'); else sa(warnEl, 'hidden', '');
    };

    const applyCustomStack = (rawQuery) => {
      const s = picker.state.strings || {};
      const check = sanitizeList(win, String(rawQuery || '').slice(0, MAX_CUSTOM_LEN));
      if (!check.families.length) {
        showInlineWarn(s.fontPickerInvalidStack || s.fontSanitizedNotice || 'No valid font family names found');
        return;
      }
      const cleanStack = check.families.join(', ').slice(0, MAX_CUSTOM_LEN);
      const warnMsg = check.hadRejected ? (s.fontSanitizedNotice || 'Unsafe characters were stripped; only valid font family names are applied') : '';
      picker.onSelect({ mode: 'custom', custom: cleanStack, warning: warnMsg });
      closeActiveMenu({ returnFocus: true });
    };

    const activateItem = (btn) => {
      if (!btn) return;
      const kind = ga(btn, 'data-ag-fp-kind');
      const val = ga(btn, 'data-ag-fp-val') || '';
      if (kind === 'reset') { picker.onReset(); closeActiveMenu({ returnFocus: true }); }
      else if (kind === 'preset') { picker.onSelect({ mode: val || 'default', custom: picker.state.custom || '', warning: '' }); closeActiveMenu({ returnFocus: true }); }
      else if (kind === 'local') { picker.onSelect({ mode: 'custom', custom: val, warning: '' }); closeActiveMenu({ returnFocus: true }); }
      else if (kind === 'custom-stack') applyCustomStack(searchInp.value);
    };

    const appendLocalBatch = () => {
      if (!localContainer || renderedLocal >= filteredLocal.length) return;
      const end = Math.min(filteredLocal.length, renderedLocal + BATCH_SIZE);
      const curCustomLow = (picker.state.mode || 'default') === 'custom' ? String(picker.state.custom || '').trim().toLowerCase() : '';
      const frag = typeof doc.createDocumentFragment === 'function' ? doc.createDocumentFragment() : null;
      const target = frag || localContainer;
      for (let i = renderedLocal; i < end; i++) {
        const fam = filteredLocal[i];
        const item = createItemButton(doc, fam, Boolean(curCustomLow && curCustomLow === fam.toLowerCase()), 'local', fam, '');
        item.addEventListener('click', (ev) => { ev?.stopPropagation?.(); activateItem(item); });
        target.appendChild(item);
      }
      if (frag) localContainer.appendChild(frag);
      renderedLocal = end;
    };

    const renderList = () => {
      clearKids(listEl);
      showInlineWarn('');
      highlightIdx = -1;
      localContainer = null;
      renderedLocal = 0;

      const s = picker.state.strings || {};
      const qRaw = String(searchInp.value || '').trim();
      const qLow = qRaw.toLowerCase();
      const curMode = picker.state.mode || 'default';
      const curCustom = String(picker.state.custom || '').trim();
      const presets = picker.state.presets || [];
      const matchedPresets = qLow ? presets.filter((p) => p.label.toLowerCase().includes(qLow) || p.value.toLowerCase().includes(qLow)) : presets;
      const allLocal = localFontCache.status === 'loaded' ? localFontCache.families : [];
      filteredLocal = qLow ? allLocal.filter((f) => f.toLowerCase().includes(qLow)) : allLocal;
      const exactHit = qLow && (presets.some((p) => p.label.toLowerCase() === qLow || p.value.toLowerCase() === qLow) || allLocal.some((f) => f.toLowerCase() === qLow));

      if (qRaw && (qRaw.includes(',') || !exactHit)) {
        const cItem = createItemButton(doc, String(s.fontPickerApplyCustom || 'Apply custom stack: {stack}').replace('{stack}', qRaw), false, 'custom-stack', qRaw, 'ag-fp-custom-item');
        cItem.addEventListener('click', (ev) => { ev?.stopPropagation?.(); activateItem(cItem); });
        listEl.appendChild(cItem);
      }
      if (!qRaw && curMode === 'custom' && curCustom && !allLocal.some((f) => f.toLowerCase() === curCustom.toLowerCase())) {
        listEl.appendChild(mk(doc, 'div', 'ag-fp-group-head', s.fontPickerCurrentCustom || 'Current Custom'));
        const curBtn = createItemButton(doc, curCustom, true, 'local', curCustom, '');
        curBtn.addEventListener('click', (ev) => { ev?.stopPropagation?.(); activateItem(curBtn); });
        listEl.appendChild(curBtn);
      }
      if (matchedPresets.length > 0) {
        listEl.appendChild(mk(doc, 'div', 'ag-fp-group-head', s.fontPickerGroupPresets || 'Recommended Presets'));
        for (let i = 0; i < matchedPresets.length; i++) {
          const p = matchedPresets[i];
          const item = createItemButton(doc, p.label, curMode === p.value, 'preset', p.value, '');
          item.addEventListener('click', (ev) => { ev?.stopPropagation?.(); activateItem(item); });
          listEl.appendChild(item);
        }
      }

      const sepMid = mk(doc, 'div');
      sa(sepMid, 'role', 'separator');
      listEl.appendChild(sepMid);

      const locHead = mk(doc, 'div', 'ag-fp-group-head');
      locHead.appendChild(mk(doc, 'span', '', s.fontPickerGroupLocal || 'Installed Local Fonts'));
      if (localFontCache.status === 'loaded') locHead.appendChild(mk(doc, 'span', 'ag-fp-count', String(filteredLocal.length)));
      listEl.appendChild(locHead);

      if (localFontCache.status === 'loading' || localFontCache.status === 'idle') {
        listEl.appendChild(mk(doc, 'div', 'ag-fp-status', s.fontLocalLoading || 'Loading local fonts...'));
      } else if (localFontCache.status === 'denied') {
        listEl.appendChild(mk(doc, 'div', 'ag-fp-status', s.fontLocalDenied || 'Font permission was declined; type font names above'));
      } else if (localFontCache.status === 'unsupported') {
        listEl.appendChild(mk(doc, 'div', 'ag-fp-status', s.fontLocalUnsupported || 'Local font enumeration is unavailable; type font names above'));
      } else if (filteredLocal.length === 0) {
        if (matchedPresets.length === 0) listEl.appendChild(mk(doc, 'div', 'ag-fp-status', s.fontPickerEmpty || 'No matching fonts; press Enter to apply as custom stack'));
      } else {
        localContainer = mk(doc, 'div');
        sa(localContainer, 'data-ag-fp-local-group', '1');
        listEl.appendChild(localContainer);
        appendLocalBatch();
      }
    };

    listEl.addEventListener('scroll', () => {
      if (!localContainer || renderedLocal >= filteredLocal.length) return;
      if ((Number(listEl.scrollTop) || 0) + (Number(listEl.clientHeight) || 0) >= (Number(listEl.scrollHeight) || 0) - 72) appendLocalBatch();
    });
    searchInp.addEventListener('input', () => renderList());
    resetBtn.addEventListener('click', (ev) => { ev?.stopPropagation?.(); activateItem(resetBtn); });

    const onKeyDown = (ev) => {
      const k = ev && ev.key;
      if (k === 'Escape') { ev?.preventDefault?.(); ev?.stopPropagation?.(); closeActiveMenu({ returnFocus: true }); }
      else if (k === 'ArrowDown') { ev?.preventDefault?.(); setHighlight(highlightIdx + 1); }
      else if (k === 'ArrowUp') { ev?.preventDefault?.(); setHighlight(highlightIdx <= 0 ? getSelectableItems().length - 1 : highlightIdx - 1); }
      else if (k === 'Enter') {
        ev?.preventDefault?.();
        const items = getSelectableItems();
        if (highlightIdx >= 0 && items[highlightIdx]) activateItem(items[highlightIdx]);
        else if (String(searchInp.value || '').trim()) {
          const first = items[0];
          if (first && ga(first, 'data-ag-fp-kind') === 'custom-stack') applyCustomStack(searchInp.value);
          else if (first && ga(first, 'data-ag-fp-kind') !== 'reset') activateItem(first);
          else applyCustomStack(searchInp.value);
        }
      }
    };
    const onDocPointerDown = (ev) => {
      const t = ev && ev.target;
      if (!t || t === portal || t === triggerEl || portal.contains?.(t) || triggerEl.contains?.(t)) return;
      closeActiveMenu();
    };
    const onViewportChange = (ev) => {
      if (ev && ev.target && (ev.target === portal || portal.contains?.(ev.target))) return;
      if (!positionPortal(portal, triggerEl, win)) closeActiveMenu({ immediate: true });
    };

    portal.addEventListener('keydown', onKeyDown);
    if (typeof doc.addEventListener === 'function') {
      doc.addEventListener('mousedown', onDocPointerDown, true);
      doc.addEventListener('scroll', onViewportChange, true);
    }
    if (win && typeof win.addEventListener === 'function') win.addEventListener('resize', onViewportChange);

    const cleanupListeners = () => {
      try { portal.removeEventListener?.('keydown', onKeyDown); } catch {}
      try { doc.removeEventListener?.('mousedown', onDocPointerDown, true); } catch {}
      try { doc.removeEventListener?.('scroll', onViewportChange, true); } catch {}
      try { win?.removeEventListener?.('resize', onViewportChange); } catch {}
    };

    (doc.body || doc.documentElement)?.appendChild?.(portal);
    positionPortal(portal, triggerEl, win);
    sa(triggerEl, 'aria-expanded', 'true');

    const menuHandle = { picker, doc, win, triggerEl, portal, cleanupListeners, openRafId: null };
    activeMenu = menuHandle;

    const needLazyLoad = localFontCache.status === 'idle';
    renderList();
    if (!isMotionOff(doc)) {
      menuHandle.openRafId = trackRaf(win, () => {
        menuHandle.openRafId = null;
        if (activeMenu === menuHandle) ra(portal, 'data-starting-style');
      });
    }
    try { searchInp.focus?.({ preventScroll: true }); } catch { try { searchInp.focus?.(); } catch {} }
    if (needLazyLoad) {
      loadLocalFontsLazy(win).then(() => {
        if (activeMenu === menuHandle) { renderList(); positionPortal(portal, triggerEl, win); }
      });
    }
  }

  function createFontPicker(opts) {
    const doc = opts.doc;
    const win = opts.win || (doc && doc.defaultView) || G;
    const tier = String(opts.tier || 'ui');
    ensureStyle(doc, win);

    const mount = mk(doc, 'div', 'ag-fp-mount');
    sa(mount, 'data-ag-cs-custom-style-owned', '1');
    sa(mount, 'data-ag-cs-fp-tier', tier);

    const triggerEl = mk(doc, 'button', 'agy-select-trigger ag-fp-trigger');
    triggerEl.type = 'button';
    for (const [k, v] of [['type', 'button'], ['role', 'combobox'], ['aria-haspopup', 'listbox'], ['aria-expanded', 'false'], ['data-ag-cs-fp-trigger', tier]]) sa(triggerEl, k, v);

    const labelEl = mk(doc, 'span', 'ag-fp-trigger-label');
    const chevEl = mk(doc, 'span', 'ag-fp-trigger-chev');
    sa(chevEl, 'aria-hidden', 'true');
    chevEl.appendChild(makeSvgIcon(doc, 'chev'));
    triggerEl.appendChild(labelEl);
    triggerEl.appendChild(chevEl);
    mount.appendChild(triggerEl);

    const picker = {
      tier, doc, win, mount, triggerEl, labelEl,
      state: { mode: 'default', custom: '', presets: [], strings: {} },
      onSelect: typeof opts.onSelect === 'function' ? opts.onSelect : () => {},
      onReset: typeof opts.onReset === 'function' ? opts.onReset : () => {},
      update(next) {
        if (next && typeof next === 'object') {
          if (next.mode !== undefined) picker.state.mode = String(next.mode || 'default');
          if (next.custom !== undefined) picker.state.custom = String(next.custom || '');
          if (Array.isArray(next.presets)) picker.state.presets = next.presets;
          if (next.strings && typeof next.strings === 'object') picker.state.strings = next.strings;
          if (typeof next.onSelect === 'function') picker.onSelect = next.onSelect;
          if (typeof next.onReset === 'function') picker.onReset = next.onReset;
        }
        const text = computeDisplayLabel(picker.state);
        if (labelEl.textContent !== text) labelEl.textContent = text;
        sa(triggerEl, 'title', text);
        sa(triggerEl, 'data-ag-fp-mode', picker.state.mode);
      },
      open() { openMenuForPicker(picker); },
      close() { if (activeMenu && activeMenu.picker === picker) closeActiveMenu(); },
    };

    triggerEl.addEventListener('click', (ev) => { ev?.stopPropagation?.(); openMenuForPicker(picker); });
    triggerEl.addEventListener('keydown', (ev) => {
      const k = ev && ev.key;
      if (k === 'ArrowDown' || k === 'Enter' || k === ' ') { ev?.preventDefault?.(); openMenuForPicker(picker); }
    });
    return picker;
  }

  function dispose(docOverride) {
    closeActiveMenu({ immediate: true });
    flushClosingPortals();
    for (const tid of [...activeTimers]) untrackTimeout(tid);
    activeTimers.clear();
    for (const rid of [...activeRafs]) untrackRaf(G, rid);
    activeRafs.clear();
    localFontCache = { status: 'idle', families: [] };
    localFontPromise = null;
    const doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    try { doc.getElementById?.(PICKER_STYLE_ID)?.remove?.(); } catch {}
    try { doc.querySelectorAll?.('[data-ag-cs-font-picker-portal="1"]')?.forEach?.((n) => n.remove?.()); } catch {}
    try { doc.querySelectorAll?.('[data-ag-cs-fp-enhanced="1"]')?.forEach?.((n) => n.removeAttribute?.('data-ag-cs-fp-enhanced')); } catch {}
  }

  return {
    PICKER_STYLE_ID,
    BATCH_SIZE,
    createFontPicker,
    closeActiveMenu,
    getLocalFontCacheState: () => ({ status: localFontCache.status, count: localFontCache.families.length }),
    sanitizeList,
    dispose,
  };
});
