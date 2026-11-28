// Channel 18 Settings UI extension: mounts 3-tier Antigravity-native Font Pickers + single-button custom.css row (0 innerHTML, 0 B added to Ch9)
(function (root, factory) {
  try {
    const prev = (typeof window !== 'undefined' && window && window.__agPrismCustomStyleSettingsUi) || (root && root.__agPrismCustomStyleSettingsUi);
    if (prev && typeof prev.dispose === 'function') prev.dispose(typeof document !== 'undefined' ? document : null);
  } catch {}
  const api = factory(root);
  if (root) root.__agPrismCustomStyleSettingsUi = api;
  if (typeof window !== 'undefined' && window && window !== root) window.__agPrismCustomStyleSettingsUi = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';

  const UI_STYLE_ID = 'ag-prism-custom-style-ui-css';
  const UI_FONT_MODES = Object.freeze(['default', 'system-sans', 'noto-sans', 'inter', 'harmony', 'custom']);
  const CHAT_FONT_MODES = Object.freeze(['default', 'system-sans', 'noto-sans', 'inter', 'harmony', 'custom']);
  const CODE_FONT_MODES = Object.freeze(['default', 'jetbrains', 'cascadia', 'sfmono', 'custom']);
  const OVERRIDE_BADGE_SPECS = Object.freeze([
    Object.freeze({ rowKey: 'uiFont', cssVar: '--ag-prism-ui-font' }),
    Object.freeze({ rowKey: 'chatFont', cssVar: '--ag-prism-chat-font' }),
    Object.freeze({ rowKey: 'codeFont', cssVar: '--ag-prism-code-font' }),
  ]);
  const REJECTED_STATUSES = new Set(['rejected-symlink', 'rejected-non-file', 'rejected-too-large']);

  const EXTRA_CSS = [
    '.ag-cs-css-meta-box{margin:0 15px 12px;padding:8px 10px;border-radius:8px;border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.22));background:var(--ag-cs-tonal-1,rgba(148,163,184,.06));display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}',
    '.ag-cs-css-status{flex:1 1 180px;min-width:0;font-size:11.5px;line-height:1.4;color:var(--muted-foreground,#94A3B8);}',
    '.ag-cs-css-status[data-tone="ok"]{color:var(--success,#50A37B);}',
    '.ag-cs-css-status[data-tone="warn"]{color:var(--warning,#F2B84B);}',
    'html[data-ag-cs-theme="light"] .ag-cs-css-status[data-tone="warn"]{color:#B45309;}',
    '.ag-cs-css-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}',
    '.ag-cs-css-action-btn{height:28px;padding:0 11px;border-radius:7px;border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.28));background:var(--ag-cs-tonal-3,rgba(148,163,184,.12));color:var(--foreground,#F2F2F5);font-size:11.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:border-color .14s ease,background-color .14s ease,opacity .14s ease;}',
    '.ag-cs-css-action-btn:hover:not(:disabled){border-color:var(--primary,#669DF6);}',
    '.ag-cs-css-action-btn:disabled,.ag-cs-css-action-btn[aria-disabled="true"]{opacity:.48;cursor:not-allowed;}',
    'html[data-ag-cs-theme="light"] .ag-cs-css-action-btn{background:#F1F5F9;color:#0F172A;border-color:rgba(15,23,42,.16);}',
    '.ag-cs-css-override-badge{display:inline-flex;align-items:center;justify-content:center;height:18px;box-sizing:border-box;padding:0 6px;border-radius:999px;border:1px solid color-mix(in srgb,var(--primary,#669DF6) 34%,transparent);background:color-mix(in srgb,var(--primary,#669DF6) 13%,transparent);color:color-mix(in srgb,var(--primary,#669DF6) 86%,#FFFFFF);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;font-weight:500;line-height:1;letter-spacing:.01em;vertical-align:middle;white-space:nowrap;flex-shrink:0;cursor:help;user-select:none;transition:border-color .14s ease,background-color .14s ease;}',
    '.ag-cs-css-override-badge:hover{border-color:color-mix(in srgb,var(--primary,#669DF6) 56%,transparent);background:color-mix(in srgb,var(--primary,#669DF6) 19%,transparent);}',
    'html[data-ag-cs-theme="light"] .ag-cs-css-override-badge{border-color:color-mix(in srgb,var(--primary,#2563EB) 32%,transparent);background:color-mix(in srgb,var(--primary,#2563EB) 10%,transparent);color:color-mix(in srgb,var(--primary,#2563EB) 60%,#0F172A);}',
    'html[data-ag-cs-theme="light"] .ag-cs-css-override-badge:hover{border-color:color-mix(in srgb,var(--primary,#2563EB) 48%,transparent);background:color-mix(in srgb,var(--primary,#2563EB) 15%,transparent);}',
    '.ag-cs-css-override-badge[hidden]{display:none !important;}',
  ].join('\n');

  let hookedBeta4 = false;
  let hookedBeta4Ext = null;
  let origBeta4Sync = null;
  let lastCustomCssMeta = null;
  let lastMetaClientSig = '';
  let lastDoc = null;
  let lastWin = null;
  const trappedTargets = [];

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
  const getPickerMod = (win) => (win && win.__agPrismFontPickerUi) || G.__agPrismFontPickerUi || (typeof window !== 'undefined' ? window.__agPrismFontPickerUi : null);

  function getStrings(lang, baseUi, win) {
    const locMod = (win && win.__agCsLocales) || G.__agCsLocales || (typeof window !== 'undefined' ? window.__agCsLocales : null);
    let seed = baseUi && typeof baseUi === 'object' ? Object.assign({}, baseUi) : {};
    if ((!seed.onLabel || !seed.offLabel) && locMod && typeof locMod.getUiStrings === 'function') {
      try { seed = Object.assign({}, locMod.getUiStrings(lang), seed); } catch {}
    }
    const b4 = (win && win.__agPrismI18nExtBeta4) || G.__agPrismI18nExtBeta4 || (typeof window !== 'undefined' ? window.__agPrismI18nExtBeta4 : null);
    const cs = (win && win.__agPrismCustomStyleI18n) || G.__agPrismCustomStyleI18n || (typeof window !== 'undefined' ? window.__agPrismCustomStyleI18n : null);
    const merged = b4 && typeof b4.mergeIntoUiStrings === 'function' ? b4.mergeIntoUiStrings(seed, lang) : seed;
    return cs && typeof cs.getStrings === 'function' ? Object.assign(merged, cs.getStrings(lang)) : merged;
  }

  function ensureStyle(doc, win) {
    if (!doc || !doc.head) return;
    let st = typeof doc.getElementById === 'function' ? doc.getElementById(UI_STYLE_ID) : null;
    if (!st) {
      st = doc.createElement('style');
      st.id = UI_STYLE_ID;
      st.textContent = EXTRA_CSS;
      doc.head.appendChild(st);
    } else if (st.textContent !== EXTRA_CSS) {
      st.textContent = EXTRA_CSS;
    }
    try { ((win && win.__agPrismCustomStyle) || G.__agPrismCustomStyle)?.ensureUserCssLast?.(doc); } catch {}
  }

  function sendSettingPayload(win, payload) {
    try {
      const fn = (win && (win.__agPrismSetting || win.__agClaudeStyleSetting)) || G.__agPrismSetting || G.__agClaudeStyleSetting;
      if (typeof fn === 'function') { fn(JSON.stringify(payload)); return true; }
    } catch {}
    return false;
  }
  const saveSettingFallback = (win, ctx, key, value) => (ctx && typeof ctx.saveSetting === 'function' ? ctx.saveSetting(key, value) : sendSettingPayload(win, { key, value }));
  const saveBatchFallback = (win, ctx, entries) => (ctx && typeof ctx.saveSettingsBatch === 'function' ? ctx.saveSettingsBatch(entries) : sendSettingPayload(win, { action: 'patch-batch', entries }));

  function readLiveCfg(ctx, key, fallback) {
    if (ctx && ctx.cfgOverride && Object.prototype.hasOwnProperty.call(ctx.cfgOverride, key)) {
      const ov = ctx.cfgOverride[key];
      if (ov !== undefined && ov !== null) return ov;
    }
    try {
      if (ctx && typeof ctx.effVal === 'function') {
        const v = ctx.effVal(key, ctx.lang);
        if (v !== undefined && v !== null) return v;
      }
    } catch {}
    try {
      const st = ((ctx && ctx.win) || G).__agPrism?.getState?.();
      if (st && st.cfg && Object.prototype.hasOwnProperty.call(st.cfg, key)) return st.cfg[key];
    } catch {}
    try {
      const cs = ((ctx && ctx.win) || G).__agPrismCustomStyle?.getState?.();
      if (cs && cs.cfg && Object.prototype.hasOwnProperty.call(cs.cfg, key)) return cs.cfg[key];
    } catch {}
    return fallback;
  }

  function applyLivePreview(win, doc, patch) {
    const cs = (win && win.__agPrismCustomStyle) || G.__agPrismCustomStyle;
    const fc = (win && win.__agPrismFontCustomizer) || G.__agPrismFontCustomizer;
    let cur = {};
    try { cur = (win || G).__agPrism?.getState?.()?.cfg || cs?.getState?.()?.cfg || {}; } catch {}
    const next = Object.assign({}, cur, patch);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'codeFont') && doc && doc.documentElement) {
      sa(doc.documentElement, 'data-ag-cs-code-font', String(patch.codeFont || 'default'));
    }
    if (fc && typeof fc.applyCustomFonts === 'function' && (patch.chatFont !== undefined || patch.chatFontCustom !== undefined || patch.codeFont !== undefined || patch.codeFontCustom !== undefined)) {
      try { fc.applyCustomFonts(next, doc); } catch {}
    }
    if (cs && typeof cs.sync === 'function') { try { cs.sync(next, null, doc); } catch {} }
  }

  const buildSansPresets = (ui) => [
    { value: 'default', label: ui.optChatFontDefault || 'Host Default' },
    { value: 'system-sans', label: ui.optChatFontSystemSans || 'System Sans' },
    { value: 'noto-sans', label: ui.optChatFontNotoSans || 'Noto Sans' },
    { value: 'inter', label: ui.optChatFontInter || 'Inter' },
    { value: 'harmony', label: ui.optChatFontHarmony || 'HarmonyOS Sans' },
  ];
  const buildCodePresets = (ui) => [
    { value: 'default', label: ui.optFontDefault || ui.optChatFontDefault || 'Host Default' },
    { value: 'jetbrains', label: 'JetBrains Mono' },
    { value: 'cascadia', label: 'Cascadia Code' },
    { value: 'sfmono', label: ui.optFontSfmono || 'SF Mono' },
  ];

  function setRowWarning(row, doc, msg) {
    if (!row) return;
    let warn = qs(row, '[data-ag-cs-fp-warn="1"]');
    if (!msg) {
      if (warn) { warn.textContent = ''; warn.hidden = true; sa(warn, 'hidden', ''); }
      return;
    }
    if (!warn) {
      warn = mk(doc, 'div', 'ag-fp-row-warn');
      sa(warn, 'data-ag-cs-fp-warn', '1');
      sa(warn, 'data-ag-cs-custom-style-owned', '1');
      row.appendChild(warn);
    }
    warn.textContent = msg;
    warn.hidden = false;
    ra(warn, 'hidden');
  }

  function syncLegacyRowControls(row, modeKey, modeVal, customVal) {
    if (!row) return;
    if (modeKey === 'chatFont') {
      if (row.__extSelect) row.__extSelect.value = modeVal;
      if (row.__extCustomUi && row.__extCustomUi.inp) row.__extCustomUi.inp.value = customVal;
    } else if (modeKey === 'codeFont') {
      const grp = qs(row, '.ag-cs-seg-group');
      const btns = grp && grp.querySelectorAll ? grp.querySelectorAll('button[data-ag-cs-key="codeFont"]') : [];
      const targetJson = JSON.stringify(modeVal);
      for (let i = 0; i < btns.length; i++) {
        const act = ga(btns[i], 'data-ag-cs-val') === targetJson;
        btns[i].__agOn = act;
        sa(btns[i], 'aria-pressed', act ? 'true' : 'false');
        if (act) sa(btns[i], 'data-pressed'); else ra(btns[i], 'data-pressed');
      }
      if (row.__extCustomUi && row.__extCustomUi.inp) row.__extCustomUi.inp.value = customVal;
    }
  }

  function bindFontPickerToRow(rootEl, row, doc, ctx, spec) {
    const pickerMod = getPickerMod(ctx.win);
    if (!row || !pickerMod || typeof pickerMod.createFontPicker !== 'function') return null;
    const ctrlWrap = qs(row, '.shrink-0');
    if (!ctrlWrap) return null;
    if (spec.enhanceExisting) sa(row, 'data-ag-cs-fp-enhanced', '1');

    let picker = row.__csFontPicker || null;
    const existingMount = qs(ctrlWrap, `[data-ag-cs-fp-tier="${spec.tier}"]`);
    if (!picker && existingMount) { try { existingMount.remove?.(); } catch {} }
    if (!picker) {
      picker = pickerMod.createFontPicker({ doc, win: ctx.win, tier: spec.tier });
      ctrlWrap.appendChild(picker.mount);
      row.__csFontPicker = picker;
    }

    picker.update({
      mode: spec.modes.includes(spec.modeVal) ? spec.modeVal : 'default',
      custom: spec.customVal,
      presets: spec.presets,
      strings: ctx.ui,
      onSelect: ({ mode, custom, warning }) => {
        const nextCtx = row.__csCtx || ctx;
        setRowWarning(row, doc, warning || '');
        if (mode === 'custom') {
          const patch = { [spec.modeKey]: 'custom', [spec.customKey]: custom };
          applyLivePreview(nextCtx.win, doc, patch);
          syncLegacyRowControls(row, spec.modeKey, 'custom', custom);
          saveBatchFallback(nextCtx.win, nextCtx, patch);
          rootEl.__extBeta4Sig = '';
          if (typeof row.__csResync === 'function') row.__csResync(patch);
        } else {
          const patch = { [spec.modeKey]: mode };
          applyLivePreview(nextCtx.win, doc, Object.assign({}, patch, { [spec.customKey]: spec.customVal }));
          syncLegacyRowControls(row, spec.modeKey, mode, spec.customVal);
          saveSettingFallback(nextCtx.win, nextCtx, spec.modeKey, mode);
          rootEl.__extBeta4Sig = '';
          if (typeof row.__csResync === 'function') row.__csResync(patch);
        }
      },
      onReset: () => {
        const nextCtx = row.__csCtx || ctx;
        const patch = { [spec.modeKey]: 'default', [spec.customKey]: '' };
        setRowWarning(row, doc, '');
        applyLivePreview(nextCtx.win, doc, patch);
        syncLegacyRowControls(row, spec.modeKey, 'default', '');
        saveBatchFallback(nextCtx.win, nextCtx, patch);
        rootEl.__extBeta4Sig = '';
        if (typeof row.__csResync === 'function') row.__csResync(patch);
      },
    });
    return picker;
  }

  function makeRowShell(doc, rowKey) {
    const row = mk(doc, 'div');
    sa(row, 'data-ag-cs-row', rowKey);
    sa(row, 'data-ag-cs-custom-style-owned', '1');
    const inner = mk(doc, 'div', 'py-2');
    const textCol = mk(doc, 'div', 'flex-1');
    const titleLine = mk(doc, 'div', 'ag-cs-settings-title-line');
    const tSpan = mk(doc, 'span'); sa(tSpan, 'data-k', 't');
    const dSpan = mk(doc, 'span', 'whitespace-pre-wrap'); sa(dSpan, 'data-k', 'd');
    titleLine.appendChild(tSpan);
    textCol.appendChild(titleLine);
    textCol.appendChild(dSpan);
    const ctrlWrap = mk(doc, 'div', 'shrink-0');
    inner.appendChild(textCol);
    inner.appendChild(ctrlWrap);
    row.appendChild(inner);
    return { row, ctrlWrap };
  }

  function ensureUiFontRow(rootEl, doc) {
    let row = qs(rootEl, '[data-ag-cs-row="uiFont"]');
    if (row) return row;
    const anchor = qs(rootEl, '[data-ag-cs-row="chatFont"]') || qs(rootEl, '[data-ag-cs-row="codeFont"]');
    if (!anchor || !anchor.parentElement) return null;
    row = makeRowShell(doc, 'uiFont').row;
    const parent = anchor.parentElement;
    if (typeof parent.insertBefore === 'function') parent.insertBefore(row, anchor);
    else parent.appendChild(row);
    return row;
  }

  const isBlockedCssStatus = (st) => REJECTED_STATUSES.has(st) || st === 'error';

  function getBlockedTooltip(s, st) {
    if (st === 'rejected-too-large') return s.cssOpenBlockedTooLarge || 'Blocked for security: custom.css exceeds 256 KB; inspect it in the plugin folder';
    if (st === 'error') return s.cssOpenBlockedError || 'Opening blocked: unable to verify custom.css safely (check permissions in the plugin folder)';
    return s.cssOpenBlockedSymlink || 'Blocked for security: custom.css is a symlink or non-regular file; inspect it in the plugin folder';
  }

  function formatCssStatus(s, cssState, cssOn) {
    const st = cssState && cssState.status ? cssState.status : 'missing';
    if (!cssOn) {
      const base = s.cssStatusDisabled || 'Disabled (local file preserved)';
      if (REJECTED_STATUSES.has(st)) {
        const warn = st === 'rejected-too-large' ? (s.cssStatusTooLarge || 'Rejected: exceeds 256 KB safety limit') : (s.cssStatusSymlink || 'Rejected: symlinks are not allowed');
        return { text: `${base} · ${warn}`, tone: 'warn' };
      }
      return { text: base, tone: '' };
    }
    const blocked = Number(cssState && cssState.blockedImports) || 0;
    const suffix = blocked > 0 ? ` · ${String(s.cssBlockedImports || 'Blocked {n} @import rule(s)').replace('{n}', String(blocked))}` : '';
    if (st === 'active') {
      const rawBytes = Number(cssState.bytes) || 0;
      const kb = (rawBytes > 0 ? Math.max(0.1, rawBytes / 1024) : 0).toFixed(1);
      return { text: String(s.cssStatusActive || 'Active ({kb} KB)').replace('{kb}', kb) + suffix, tone: blocked > 0 ? 'warn' : 'ok' };
    }
    if (st === 'rejected-too-large') return { text: s.cssStatusTooLarge || 'Rejected: exceeds 256 KB safety limit', tone: 'warn' };
    if (st === 'rejected-symlink' || st === 'rejected-non-file') return { text: s.cssStatusSymlink || 'Rejected: symlinks are not allowed', tone: 'warn' };
    if (st === 'error') return { text: s.cssStatusError || 'Failed to read custom.css (check permissions)', tone: 'warn' };
    if (st === 'empty') return { text: (s.cssStatusEmpty || 'custom.css is currently empty (saves auto hot-reload)') + suffix, tone: blocked > 0 ? 'warn' : '' };
    return { text: s.cssStatusMissing || 'No custom.css found (0 overhead)', tone: '' };
  }

  function syncActionButtonState(cu, ui, statusRaw) {
    const st = statusRaw || 'missing';
    const btn = cu.actionBtn;
    btn.__csStatus = st;
    if (isBlockedCssStatus(st)) {
      const tip = getBlockedTooltip(ui, st);
      btn.textContent = ui.btnOpenCustomCss || 'Open';
      btn.disabled = true;
      sa(btn, 'disabled', ''); sa(btn, 'aria-disabled', 'true'); sa(btn, 'data-blocked', '1');
      sa(btn, 'data-ag-cs-ext-action', 'open-custom-css-blocked');
      sa(btn, 'title', tip); sa(btn, 'aria-label', tip);
    } else if (!st || st === 'missing') {
      btn.textContent = ui.btnCreateCustomCss || 'Create Template';
      btn.disabled = false;
      ra(btn, 'disabled'); ra(btn, 'aria-disabled'); ra(btn, 'data-blocked');
      sa(btn, 'data-ag-cs-ext-action', 'create-custom-css-template');
      ra(btn, 'title'); ra(btn, 'aria-label');
    } else {
      const tip = ui.cssOpenTooltip || 'Open custom.css in your default editor (saves auto hot-reload)';
      btn.textContent = ui.btnOpenCustomCss || 'Open';
      btn.disabled = false;
      ra(btn, 'disabled'); ra(btn, 'aria-disabled'); ra(btn, 'data-blocked');
      sa(btn, 'data-ag-cs-ext-action', 'open-custom-css');
      sa(btn, 'title', tip); sa(btn, 'aria-label', tip);
    }
  }

  function ensureCustomCssRow(rootEl, doc, ctx) {
    let row = qs(rootEl, '[data-ag-cs-row="customCss"]');
    if (row) return row;
    const anchor = qs(rootEl, '[data-ag-cs-row="codeLigatures"]') || qs(rootEl, '[data-ag-cs-row="codeFont"]');
    if (!anchor || !anchor.parentElement) return null;

    const shell = makeRowShell(doc, 'customCss');
    row = shell.row;
    const grp = mk(doc, 'div', 'ag-cs-seg-group');
    sa(grp, 'role', 'group'); sa(grp, 'data-ui-kind', 'switch'); sa(grp, 'data-switch-on', '1');
    const thumb = mk(doc, 'span', 'ag-cs-switch-thumb'); sa(thumb, 'aria-hidden', 'true');
    grp.appendChild(thumb);

    const BTN_CLS = 'ag-cs-seg-btn data-[pressed]:bg-secondary data-[pressed]:text-foreground';
    for (const val of ['on', 'off']) {
      const btn = mk(doc, 'button', BTN_CLS);
      btn.type = 'button';
      sa(btn, 'type', 'button'); sa(btn, 'data-ag-cs-ext-key', 'customCss');
      sa(btn, 'data-ag-cs-ext-val', JSON.stringify(val)); sa(btn, 'data-ag-cs-ext-role', val);
      btn.addEventListener('click', (ev) => {
        ev?.stopPropagation?.();
        const nextCtx = row.__csCtx || ctx;
        applyLivePreview(nextCtx.win, doc, { customCss: val });
        saveSettingFallback(nextCtx.win, nextCtx, 'customCss', val);
        if (typeof row.__csResync === 'function') row.__csResync({ customCss: val });
      });
      grp.appendChild(btn);
    }
    shell.ctrlWrap.appendChild(grp);

    const metaBox = mk(doc, 'div', 'ag-cs-css-meta-box');
    const statusEl = mk(doc, 'div', 'ag-cs-css-status');
    sa(statusEl, 'data-ag-cs-css-status', '1');
    const actions = mk(doc, 'div', 'ag-cs-css-actions');

    // Single dynamic action button: Create Template (missing) -> Open (active/empty) -> Disabled (rejected-*)
    const actionBtn = mk(doc, 'button', 'ag-cs-css-action-btn');
    actionBtn.type = 'button';
    sa(actionBtn, 'type', 'button');
    sa(actionBtn, 'data-ag-cs-ext-action', 'create-custom-css-template');
    actionBtn.addEventListener('click', (ev) => {
      ev?.stopPropagation?.();
      const st = actionBtn.__csStatus || 'missing';
      if (actionBtn.disabled || isBlockedCssStatus(st)) return;
      const nextCtx = row.__csCtx || ctx;
      const s = row.__csStrings || {};
      if (!st || st === 'missing') {
        sendSettingPayload(nextCtx.win, { action: 'custom-css-create-template' });
        storeCustomCssMeta({ status: 'empty' }, nextCtx.win);
        syncActionButtonState(row.__csCssUi, s, 'empty');
        statusEl.textContent = s.cssTemplateRequested || 'Created and opening custom.css; saves auto hot-reload';
        sa(statusEl, 'data-tone', 'ok');
        syncAllOverrideBadges(rootEl, doc, nextCtx.win, s, false, lastCustomCssMeta || {});
      } else if (st === 'active' || st === 'empty') {
        sendSettingPayload(nextCtx.win, { action: 'custom-css-open' });
      }
    });

    actions.appendChild(actionBtn);
    metaBox.appendChild(statusEl);
    metaBox.appendChild(actions);
    row.appendChild(metaBox);
    row.__csCssUi = { grp, statusEl, actionBtn };

    const parent = anchor.parentElement;
    if (anchor.nextSibling && typeof parent.insertBefore === 'function') parent.insertBefore(row, anchor.nextSibling);
    else parent.appendChild(row);
    return row;
  }

  function getClientCssState(win) {
    try {
      return ((win && win.__agPrismCustomStyle) || G.__agPrismCustomStyle)?.getState?.()?.customCss || null;
    } catch {
      return null;
    }
  }

  function getClientCssSig(win) {
    const st = getClientCssState(win);
    if (!st || !st.status) return '';
    return `${st.status}|${st.sha256 || ''}|${Number(st.bytes) || 0}|${Number(st.blockedImports) || 0}`;
  }

  function storeCustomCssMeta(meta, win) {
    if (meta && typeof meta === 'object') {
      lastCustomCssMeta = Object.assign({}, lastCustomCssMeta || {}, meta);
      lastMetaClientSig = getClientCssSig(win);
    }
  }

  function resolveEffectiveCssState(mergedRawCtx, win) {
    if (mergedRawCtx && mergedRawCtx.customCssMeta && typeof mergedRawCtx.customCssMeta === 'object') {
      return mergedRawCtx.customCssMeta;
    }
    const clientState = getClientCssState(win);
    if (lastCustomCssMeta && lastCustomCssMeta.status) {
      const curSig = getClientCssSig(win);
      if (clientState && clientState.status && curSig !== lastMetaClientSig) return clientState;
      return lastCustomCssMeta;
    }
    return (clientState && clientState.status ? clientState : null) || lastCustomCssMeta || {};
  }

  function getRootComputedStyle(doc, win) {
    const de = doc && doc.documentElement;
    if (!de) return null;
    try {
      let cs = null;
      if (win && typeof win.getComputedStyle === 'function') cs = win.getComputedStyle(de);
      else if (doc.defaultView && typeof doc.defaultView.getComputedStyle === 'function') cs = doc.defaultView.getComputedStyle(de);
      else if (typeof getComputedStyle === 'function') cs = getComputedStyle(de);
      else if (G && typeof G.getComputedStyle === 'function') cs = G.getComputedStyle(de);
      return cs && typeof cs.getPropertyValue === 'function' ? cs : null;
    } catch {
      return null;
    }
  }

  function readCssVarFromStyle(rootStyle, cssVar) {
    if (!rootStyle) return '';
    try {
      const raw = rootStyle.getPropertyValue(cssVar);
      return typeof raw === 'string' ? raw.trim() : '';
    } catch {
      return '';
    }
  }

  function syncRowOverrideBadge(row, doc, ui, spec, isOverridden) {
    if (!row) return;
    let badge = qs(row, `[data-ag-cs-override-badge="${spec.rowKey}"]`);
    if (!isOverridden) {
      if (badge) {
        badge.hidden = true;
        sa(badge, 'hidden', '');
        if (badge.style) badge.style.display = 'none';
      }
      return;
    }
    const titleLine = qs(row, '.ag-cs-settings-title-line');
    const titleEl = qs(row, '[data-k="t"]');
    const host = titleLine || (titleEl && titleEl.parentElement) || null;
    if (!host) return;
    if (!badge) {
      badge = mk(doc, 'span', 'ag-cs-css-override-badge', 'custom.css');
      sa(badge, 'data-ag-cs-custom-style-owned', '1');
      sa(badge, 'data-ag-cs-override-badge', spec.rowKey);
      if (titleEl && titleEl.parentElement === host && titleEl.nextSibling && typeof host.insertBefore === 'function') {
        host.insertBefore(badge, titleEl.nextSibling);
      } else {
        host.appendChild(badge);
      }
    }
    const tip = (ui && ui.cssFontOverrideTooltip) || 'Overridden by custom.css — remove the matching variable to restore panel control';
    if (badge.textContent !== 'custom.css') badge.textContent = 'custom.css';
    if (ga(badge, 'title') !== tip) sa(badge, 'title', tip);
    if (ga(badge, 'aria-label') !== tip) sa(badge, 'aria-label', tip);
    badge.hidden = false;
    ra(badge, 'hidden');
    if (badge.style) badge.style.display = '';
  }

  function syncAllOverrideBadges(rootEl, doc, win, ui, customCssOn, csState) {
    if (!rootEl) return;
    const canOverride = Boolean(customCssOn && csState && csState.status === 'active');
    const rootStyle = canOverride ? getRootComputedStyle(doc, win) : null;
    for (let i = 0; i < OVERRIDE_BADGE_SPECS.length; i++) {
      const spec = OVERRIDE_BADGE_SPECS[i];
      const row = qs(rootEl, `[data-ag-cs-row="${spec.rowKey}"]`);
      if (!row) continue;
      const overridden = Boolean(rootStyle && readCssVarFromStyle(rootStyle, spec.cssVar));
      syncRowOverrideBadge(row, doc, ui, spec, overridden);
    }
  }

  function sync(rootEl, rawCtx) {
    if (!rootEl || ga(rootEl, 'data-body-built') !== '1') return false;
    const baseCtx = rootEl.__csLastBaseCtx && typeof rootEl.__csLastBaseCtx === 'object' ? rootEl.__csLastBaseCtx : null;
    if (rawCtx && typeof rawCtx === 'object' && (rawCtx.ui || typeof rawCtx.saveSetting === 'function' || typeof rawCtx.effVal === 'function')) {
      rootEl.__csLastBaseCtx = rawCtx;
    }
    const mergedRawCtx = baseCtx ? Object.assign({}, baseCtx, rawCtx || {}) : (rawCtx || {});
    if (rootEl.__csOptimistic && typeof rootEl.__csOptimistic === 'object' && !(rawCtx && rawCtx.cfgOverride)) {
      mergedRawCtx.cfgOverride = Object.assign({}, rootEl.__csOptimistic);
    }
    const doc = mergedRawCtx.doc || rootEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return false;
    const win = mergedRawCtx.win || doc.defaultView || (typeof window !== 'undefined' ? window : G);
    lastDoc = doc;
    lastWin = win;
    const rawLang = (rawCtx && rawCtx.lang) || ga(rootEl, 'data-ag-cs-lang') || (doc.documentElement && ga(doc.documentElement, 'data-ag-cs-lang')) || mergedRawCtx.lang || (mergedRawCtx.cfgOverride && mergedRawCtx.cfgOverride.language) || 'en';
    const lang = rawLang === 'auto' ? 'en' : rawLang;
    const ui = getStrings(lang, mergedRawCtx.ui, win);
    const ctx = Object.assign({}, mergedRawCtx, { doc, win, lang, ui });
    const runMut = typeof ctx.runGuardedMut === 'function' ? ctx.runGuardedMut : (fn) => fn();

    const uiFont = String(readLiveCfg(ctx, 'uiFont', 'default') || 'default');
    const uiFontCustom = String(readLiveCfg(ctx, 'uiFontCustom', '') || '');
    const chatFont = String(readLiveCfg(ctx, 'chatFont', 'default') || 'default');
    const chatFontCustom = String(readLiveCfg(ctx, 'chatFontCustom', '') || '');
    const codeFont = String(readLiveCfg(ctx, 'codeFont', 'default') || 'default');
    const codeFontCustom = String(readLiveCfg(ctx, 'codeFontCustom', '') || '');
    const customCssRaw = readLiveCfg(ctx, 'customCss', 'on');
    const customCssOn = customCssRaw !== 'off' && customCssRaw !== false;
    rootEl.__csLastCustomCssOn = customCssOn;
    const csState = resolveEffectiveCssState(mergedRawCtx, win);

    const resyncNow = (patch) => {
      rootEl.__csOptimistic = patch && typeof patch === 'object' ? Object.assign({}, rootEl.__csOptimistic || {}, patch) : null;
      const nextCtx = rawCtx ? Object.assign({}, rawCtx) : {};
      if (rootEl.__csOptimistic) nextCtx.cfgOverride = Object.assign({}, rootEl.__csOptimistic);
      else delete nextCtx.cfgOverride;
      return sync(rootEl, nextCtx);
    };

    const sansPresets = buildSansPresets(ui);
    const codePresets = buildCodePresets(ui);

    runMut(() => {
      ensureStyle(doc, win);

      const uiRow = ensureUiFontRow(rootEl, doc);
      if (uiRow) {
        uiRow.__csStrings = ui; uiRow.__csCtx = ctx; uiRow.__csResync = resyncNow;
        const tEl = qs(uiRow, '[data-k="t"]'); const dEl = qs(uiRow, '[data-k="d"]');
        if (tEl && tEl.textContent !== ui.setUiFontTitle) tEl.textContent = ui.setUiFontTitle || 'Global UI Font';
        if (dEl && dEl.textContent !== ui.setUiFontDesc) dEl.textContent = ui.setUiFontDesc || '';
        bindFontPickerToRow(rootEl, uiRow, doc, ctx, { tier: 'ui', modeKey: 'uiFont', customKey: 'uiFontCustom', modes: UI_FONT_MODES, modeVal: uiFont, customVal: uiFontCustom, presets: sansPresets, enhanceExisting: false });
      }

      const chatRow = qs(rootEl, '[data-ag-cs-row="chatFont"]');
      if (chatRow) {
        chatRow.__csStrings = ui; chatRow.__csCtx = ctx; chatRow.__csResync = resyncNow;
        bindFontPickerToRow(rootEl, chatRow, doc, ctx, { tier: 'chat', modeKey: 'chatFont', customKey: 'chatFontCustom', modes: CHAT_FONT_MODES, modeVal: chatFont, customVal: chatFontCustom, presets: sansPresets, enhanceExisting: true });
      }

      const codeRow = qs(rootEl, '[data-ag-cs-row="codeFont"]');
      if (codeRow) {
        codeRow.__csStrings = ui; codeRow.__csCtx = ctx; codeRow.__csResync = resyncNow;
        bindFontPickerToRow(rootEl, codeRow, doc, ctx, { tier: 'code', modeKey: 'codeFont', customKey: 'codeFontCustom', modes: CODE_FONT_MODES, modeVal: codeFont, customVal: codeFontCustom, presets: codePresets, enhanceExisting: true });
      }

      syncAllOverrideBadges(rootEl, doc, win, ui, customCssOn, csState);

      const cssRow = ensureCustomCssRow(rootEl, doc, ctx);
      if (cssRow) {
        cssRow.__csStrings = ui; cssRow.__csCtx = ctx; cssRow.__csResync = resyncNow;
        const tEl = qs(cssRow, '[data-k="t"]'); const dEl = qs(cssRow, '[data-k="d"]');
        if (tEl && tEl.textContent !== ui.setCustomCssTitle) tEl.textContent = ui.setCustomCssTitle || 'Custom CSS (custom.css)';
        if (dEl && dEl.textContent !== ui.setCustomCssDesc) dEl.textContent = ui.setCustomCssDesc || '';
        const cu = cssRow.__csCssUi;
        if (cu) {
          sa(cu.grp, 'data-switch-on', customCssOn ? '1' : '0');
          const btns = cu.grp.querySelectorAll ? cu.grp.querySelectorAll('button[data-ag-cs-ext-key="customCss"]') : [];
          for (let i = 0; i < btns.length; i++) {
            const b = btns[i];
            const isOnBtn = ga(b, 'data-ag-cs-ext-role') === 'on';
            const lbl = isOnBtn ? (ui.onLabel || 'On') : (ui.offLabel || 'Off');
            if (b.textContent !== lbl) b.textContent = lbl;
            const act = isOnBtn === customCssOn;
            sa(b, 'aria-pressed', act ? 'true' : 'false');
            if (act) sa(b, 'data-pressed'); else ra(b, 'data-pressed');
            b.tabIndex = act ? -1 : 0; sa(b, 'tabindex', act ? '-1' : '0');
          }
          const info = formatCssStatus(ui, csState, customCssOn);
          if (cu.statusEl.textContent !== info.text) cu.statusEl.textContent = info.text;
          if (info.tone) sa(cu.statusEl, 'data-tone', info.tone); else ra(cu.statusEl, 'data-tone');
          syncActionButtonState(cu, ui, csState.status || 'missing');
        }
      }
    });
    return true;
  }

  function hookBeta4Ext(win, extOverride) {
    const ext = extOverride || (win && win.__agPrismSettingsExtBeta4) || G.__agPrismSettingsExtBeta4;
    if (!ext || typeof ext.sync !== 'function') return false;
    if (ext.__agCustomStyleHooked) return true;
    origBeta4Sync = ext.sync;
    hookedBeta4Ext = ext;
    ext.sync = function wrappedBeta4Sync(rootEl, rawCtx) {
      const res = origBeta4Sync.apply(this, arguments);
      try { if (rootEl) rootEl.__csOptimistic = null; sync(rootEl, rawCtx); } catch {}
      return res;
    };
    ext.__agCustomStyleHooked = true;
    hookedBeta4 = true;
    return true;
  }

  function setCustomCssMeta(meta, docOverride, winOverride) {
    const doc = docOverride || (typeof document !== 'undefined' ? document : lastDoc);
    const win = winOverride || (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : lastWin || G);
    storeCustomCssMeta(meta, win);
    if (!doc) return;
    const sec = typeof doc.getElementById === 'function' ? doc.getElementById('ag-cs-settings-sec') : null;
    if (!sec || ga(sec, 'data-body-built') !== '1') return;
    const baseCtx = sec.__csLastBaseCtx && typeof sec.__csLastBaseCtx === 'object' ? sec.__csLastBaseCtx : {};
    const langRaw = ga(sec, 'data-ag-cs-lang') || (doc.documentElement && ga(doc.documentElement, 'data-ag-cs-lang')) || baseCtx.lang || 'en';
    const lang = langRaw === 'auto' ? 'en' : langRaw;
    const ui = getStrings(lang, baseCtx.ui, win);
    const ctx = Object.assign({}, baseCtx, { doc, win, lang, ui });
    if (sec.__csOptimistic && typeof sec.__csOptimistic === 'object') {
      ctx.cfgOverride = Object.assign({}, sec.__csOptimistic);
    }
    const fallbackCss = typeof sec.__csLastCustomCssOn === 'boolean' ? (sec.__csLastCustomCssOn ? 'on' : 'off') : 'on';
    const customCssRaw = readLiveCfg(ctx, 'customCss', fallbackCss);
    const customCssOn = customCssRaw !== 'off' && customCssRaw !== false;
    const runMut = typeof ctx.runGuardedMut === 'function' ? ctx.runGuardedMut : (fn) => fn();
    runMut(() => {
      syncAllOverrideBadges(sec, doc, win, ui, customCssOn, lastCustomCssMeta || {});
    });
  }

  function syncIfPresent(docOverride, winOverride, cfgOverride, customCssMetaOverride) {
    const doc = docOverride || (typeof document !== 'undefined' ? document : null);
    const win = winOverride || (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : G);
    if (doc) lastDoc = doc;
    if (win) lastWin = win;
    if (customCssMetaOverride && typeof customCssMetaOverride === 'object') storeCustomCssMeta(customCssMetaOverride, win);
    hookBeta4Ext(win);
    if (!doc) return false;
    const sec = typeof doc.getElementById === 'function' ? doc.getElementById('ag-cs-settings-sec') : null;
    if (!sec || ga(sec, 'data-body-built') !== '1') return false;
    if (cfgOverride && typeof cfgOverride === 'object') sec.__csOptimistic = null;
    const syncCtx = { doc, win };
    if (cfgOverride && typeof cfgOverride === 'object') syncCtx.cfgOverride = cfgOverride;
    if (customCssMetaOverride && typeof customCssMetaOverride === 'object') syncCtx.customCssMeta = customCssMetaOverride;
    return sync(sec, syncCtx);
  }

  function installBeta4Trap(win, doc) {
    const targets = [];
    if (win && typeof win === 'object') targets.push(win);
    if (G && typeof G === 'object' && G !== win) targets.push(G);
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (trappedTargets.includes(target)) continue;
      try {
        const desc = Object.getOwnPropertyDescriptor(target, '__agPrismSettingsExtBeta4');
        if (desc && desc.configurable === false) continue;
        let curVal = target.__agPrismSettingsExtBeta4;
        if (curVal && typeof curVal.sync === 'function') hookBeta4Ext(win, curVal);
        Object.defineProperty(target, '__agPrismSettingsExtBeta4', {
          configurable: true,
          enumerable: true,
          get() { return curVal; },
          set(v) {
            curVal = v;
            if (v && typeof v.sync === 'function') {
              hookBeta4Ext(win, v);
              try { syncIfPresent(doc, win); } catch {}
            }
          },
        });
        trappedTargets.push(target);
      } catch {}
    }
  }

  function install(docOverride, winOverride) {
    const doc = docOverride || (typeof document !== 'undefined' ? document : null);
    const win = winOverride || (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : G);
    if (doc) lastDoc = doc;
    if (win) lastWin = win;
    hookBeta4Ext(win);
    installBeta4Trap(win, doc);
    syncIfPresent(doc, win);
  }

  function dispose(docOverride) {
    try { getPickerMod(typeof window !== 'undefined' ? window : G)?.dispose?.(docOverride); } catch {}
    if (hookedBeta4 && origBeta4Sync) {
      try {
        const ext = hookedBeta4Ext || (typeof window !== 'undefined' && window.__agPrismSettingsExtBeta4) || G.__agPrismSettingsExtBeta4;
        if (ext && ext.__agCustomStyleHooked) { ext.sync = origBeta4Sync; delete ext.__agCustomStyleHooked; }
      } catch {}
      hookedBeta4 = false; hookedBeta4Ext = null; origBeta4Sync = null;
    }
    while (trappedTargets.length > 0) {
      const target = trappedTargets.pop();
      try {
        const curVal = target.__agPrismSettingsExtBeta4;
        delete target.__agPrismSettingsExtBeta4;
        if (curVal !== undefined) target.__agPrismSettingsExtBeta4 = curVal;
      } catch {}
    }
    const doc = docOverride || (typeof document !== 'undefined' ? document : lastDoc);
    lastCustomCssMeta = null;
    lastMetaClientSig = '';
    lastDoc = null;
    lastWin = null;
    if (!doc) return;
    try { doc.getElementById?.(UI_STYLE_ID)?.remove?.(); } catch {}
    try {
      const sec = typeof doc.getElementById === 'function' ? doc.getElementById('ag-cs-settings-sec') : null;
      if (sec) delete sec.__csLastCustomCssOn;
    } catch {}
    try {
      doc.querySelectorAll?.('[data-ag-cs-fp-enhanced="1"]')?.forEach?.((n) => {
        try { delete n.__csFontPicker; } catch {}
        n.removeAttribute?.('data-ag-cs-fp-enhanced');
      });
    } catch {}
    try { doc.querySelectorAll?.('[data-ag-cs-custom-style-owned="1"], [data-ag-cs-override-badge]')?.forEach?.((n) => n.remove?.()); } catch {}
  }

  return { UI_STYLE_ID, UI_FONT_MODES, CHAT_FONT_MODES, CODE_FONT_MODES, setCustomCssMeta, sync, syncIfPresent, install, dispose };
});
