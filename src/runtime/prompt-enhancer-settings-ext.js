// Modified by Yaniuan on 2026-11-28: add the downstream Prompt Enhancer module.
// Settings Channel bridge for the independently gated Prompt Enhancer UI.
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const ROW_KEY = 'promptEnhancer';
  const SLOT_ID = 'prism-prompt-enhancer-slot';
  const ROW_SELECTOR = `[data-ag-cs-row="${ROW_KEY}"]`;
  const SLOT_SELECTOR = `[data-testid="${SLOT_ID}"]`;
  const sa = (el, key, value = '') => el?.setAttribute?.(key, String(value));
  const ga = (el, key) => el?.getAttribute?.(key) ?? null;
  const ra = (el, key) => el?.removeAttribute?.(key);
  const qs = (el, selector) => el?.querySelector?.(selector) || null;

  function ensureRow(rootEl, doc, ctx) {
    const betaGroup = qs(rootEl, '[data-ag-cs-group="beta"]');
    const list = qs(betaGroup, '.ag-cs-settings-card');
    if (!list) return null;
    let row = qs(list, ROW_SELECTOR);
    if (row) return row;

    row = doc.createElement('div');
    row.className = 'ag-cs-settings-row';
    sa(row, 'data-ag-cs-row', ROW_KEY);
    sa(row, 'data-ag-cs-ext-owned', '1');
    const inner = doc.createElement('div');
    inner.className = 'flex items-center justify-between gap-3 py-2';
    const text = doc.createElement('div');
    text.className = 'flex-1 min-w-0';
    const title = doc.createElement('div');
    title.className = 'ag-cs-settings-title-line';
    sa(title, 'data-pe-title', '1');
    const desc = doc.createElement('div');
    desc.className = 'whitespace-pre-wrap';
    sa(desc, 'data-pe-desc', '1');
    const controls = doc.createElement('div');
    controls.className = 'ag-cs-seg-group';
    sa(controls, 'role', 'group');
    for (const enabled of [true, false]) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'ag-cs-seg-btn data-[pressed]:bg-secondary data-[pressed]:text-foreground';
      sa(button, 'data-ag-cs-pe-value', enabled ? 'on' : 'off');
      button.addEventListener('click', (event) => {
        event?.stopPropagation?.();
        const value = enabled ? 'on' : 'off';
        if (ctx.effVal(ROW_KEY, ctx.lang) === value) return;
        ctx.saveSetting(ROW_KEY, value);
        ctx.runGuardedMut(() => {
          renderRow(row, ctx, enabled);
          syncPromptEnhancerUi(rootEl, doc, ctx, enabled);
        });
      });
      controls.appendChild(button);
    }
    text.append(title, desc);
    inner.append(text, controls);
    row.appendChild(inner);
    list.appendChild(row);
    return row;
  }

  function renderRow(row, { ui, lang }, enabled) {
    const signature = lang + enabled;
    if (row.__agPeSignature === signature) return;
    row.__agPeSignature = signature;
    const title = qs(row, '[data-pe-title]');
    const desc = qs(row, '[data-pe-desc]');
    if (title) title.textContent = ui.setPromptEnhancerTitle || 'Prompt Enhancer (Beta)';
    if (desc) desc.textContent = ui.setPromptEnhancerDesc || '';
    const buttons = row.querySelectorAll?.('[data-ag-cs-pe-value]') || [];
    for (const button of buttons) {
      const on = ga(button, 'data-ag-cs-pe-value') === 'on';
      button.textContent = on ? (ui.optOn || ui.onLabel || 'On') : (ui.optOff || ui.offLabel || 'Off');
      sa(button, 'aria-pressed', on === enabled ? 'true' : 'false');
      if (on === enabled) sa(button, 'data-pressed');
      else ra(button, 'data-pressed');
    }
  }

  function syncPromptEnhancerUi(rootEl, doc, ctx, enabled) {
    let slot = qs(rootEl, SLOT_SELECTOR);
    const mount = G.__prismMountPromptEnhancerUi;
    if (!enabled || !mount) {
      slot?.__agPrismPeUiHandle?.destroy?.();
      slot?.remove();
      return;
    }
    if (!slot) {
      slot = doc.createElement('div');
      sa(slot, 'data-testid', SLOT_ID);
      qs(rootEl, '[data-ag-cs-group="beta"]').appendChild(slot);
    }
    const prior = slot.__agPrismPeUiHandle;
    if (prior?.root?.parentNode === slot && prior.__agLang === ctx.lang) return;
    try { prior?.destroy?.(); } catch {}
    const handle = mount(slot, { lang: ctx.lang });
    if (handle) {
      handle.__agLang = ctx.lang;
      slot.__agPrismPeUiHandle = handle;
    }
  }

  function sync(rootEl, ctx) {
    const { doc } = ctx;
    const isEnabled = () => ctx.effVal(ROW_KEY, ctx.lang) === 'on';
    rootEl.__prismMountPromptEnhancerUi = () => ctx.runGuardedMut(() => {
      syncPromptEnhancerUi(rootEl, doc, ctx, isEnabled());
    });
    ctx.runGuardedMut(() => {
      const row = ensureRow(rootEl, doc, ctx);
      if (row) renderRow(row, ctx, isEnabled());
    });
    rootEl.__prismMountPromptEnhancerUi();
  }

  function dispose(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc) return;
    try { doc.querySelectorAll?.(`${ROW_SELECTOR},${SLOT_SELECTOR}`).forEach((node) => {
      try { node.__agPrismPeUiHandle?.destroy?.(); } catch {}
      node.remove?.();
    }); } catch {}
  }

  const api = Object.freeze({ sync, dispose });
  G.__agPrismPromptEnhancerSettingsExt = api;
  if (typeof window !== 'undefined' && window && window !== G) window.__agPrismPromptEnhancerSettingsExt = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
