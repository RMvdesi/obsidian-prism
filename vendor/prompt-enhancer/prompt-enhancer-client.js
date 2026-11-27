// Modified by Yaniuan on 2026-11-28: add the downstream Prompt Enhancer module.
// Obsidian Prism - Channel 17 Prompt Enhancer client runtime.
// The module is inert until the user enables it in Beta settings.
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const BINDING_NAME = '__agPrismPromptEnhancerCall';
  const STYLE_ID = 'ag-prism-prompt-enhancer-css';
  const BUTTON_TESTID = 'prism-prompt-enhancer-trigger';
  const BUTTON_HOST_TESTID = 'prism-prompt-enhancer-host';
  const PANEL_TESTID = 'prism-prompt-enhancer-panel';
  const DEFAULT_TIMEOUT = 30000;
  const MAX_REQUEST_CHARS = 10000;

  const CSS = [
    '.ag-prism-prompt-enhancer-host{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;max-width:100%;flex:0 0 auto;pointer-events:auto;}',
    '.ag-prism-prompt-enhancer-host[data-fallback="1"]{position:absolute;right:8px;bottom:8px;z-index:3;}',
    '.ag-prism-prompt-enhancer-btn{position:static;z-index:auto;display:inline-flex;align-items:center;gap:6px;min-height:30px;max-width:100%;margin:0;padding:0 10px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:7px;background:var(--secondary,rgba(128,128,145,.1));color:var(--foreground,inherit);font:inherit;font-size:12px;cursor:pointer;transition:background-color .14s ease,border-color .14s ease,opacity .14s ease;white-space:nowrap;}',
    '.ag-prism-prompt-enhancer-btn:hover{background:var(--ag-cs-pill-bg,rgba(128,128,145,.2));border-color:var(--ag-cs-border-2,rgba(128,128,145,.5));}',
    '.ag-prism-prompt-enhancer-btn:disabled{opacity:.56;cursor:wait;}',
    '.ag-prism-prompt-enhancer-icon{width:15px;height:15px;flex:none;}',
    '.ag-prism-prompt-enhancer-panel{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;gap:10px;width:min(680px,calc(100vw - 28px));max-height:min(680px,calc(100vh - 28px));padding:14px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.35));border-radius:8px;background:var(--popover,rgba(24,24,28,.98));color:var(--popover-foreground,var(--foreground,#f5f5f5));box-shadow:0 16px 42px rgba(0,0,0,.34);}',
    '.ag-prism-prompt-enhancer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:600;}',
    '.ag-prism-prompt-enhancer-tabs,.ag-prism-prompt-enhancer-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
    '.ag-prism-prompt-enhancer-tab,.ag-prism-prompt-enhancer-action{border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.28));border-radius:6px;padding:5px 8px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;}',
    '.ag-prism-prompt-enhancer-tab[data-active="1"]{background:var(--secondary,rgba(128,128,145,.18));border-color:var(--ag-cs-border-2,rgba(128,128,145,.5));}',
    '.ag-prism-prompt-enhancer-action[data-primary="1"]{background:var(--primary,rgba(59,130,246,.85));color:var(--primary-foreground,#fff);border-color:transparent;}',
    '.ag-prism-prompt-enhancer-close{border:0;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer;}',
    '.ag-prism-prompt-enhancer-body{min-height:150px;max-height:410px;overflow:auto;padding:11px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.24));border-radius:6px;background:var(--background,rgba(0,0,0,.12));white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.55;}',
    '.ag-prism-prompt-enhancer-editor{width:100%;min-height:180px;resize:vertical;box-sizing:border-box;padding:10px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:6px;background:var(--background,rgba(0,0,0,.12));color:inherit;font:inherit;font-size:13px;line-height:1.55;}',
    '.ag-prism-prompt-enhancer-status{min-height:18px;color:var(--muted-foreground,rgba(128,128,145,.9));font-size:12px;}',
    '@media(max-width:700px){.ag-prism-prompt-enhancer-btn{min-height:28px;padding:0 8px;font-size:11px;}.ag-prism-prompt-enhancer-host[data-fallback="1"]{right:6px;bottom:6px;}}',
  ].join('\n');

  const FALLBACK_TEXT = {
    en: { button: 'Enhance Prompt', title: 'Prompt Enhancer', close: 'Close', original: 'Original', result: 'Enhanced', copy: 'Copy', edit: 'Edit result', retry: 'Enhance again', replace: 'Replace input', cancel: 'Cancel request', working: 'Enhancing prompt…', done: 'Review the result before replacing your input', copied: 'Copied', copyFailed: 'Copy failed', editHint: 'Edit the enhanced prompt directly', replaced: 'Prompt replaced automatically', replaceFailed: 'Could not replace input; copy it manually', replaceConflict: 'The input changed, so the current draft was preserved. Enhance again or copy the result manually.', emptyResult: 'The enhanced result is empty. Nothing was replaced.', emptyInput: 'Enter text to enhance.', targetMissing: 'The original input is no longer available. Nothing was replaced.', cancelled: 'Request cancelled. Original text is preserved.', failed: 'Enhancement failed. Original text is preserved. Retry: ', tooLong: 'Input exceeds the 10,000 character limit' },
  };

  function strings(doc) {
    const i18n = G.__agPrismPromptEnhancerI18n;
    const lang = String(doc?.documentElement?.getAttribute?.('data-ag-cs-lang') || doc?.documentElement?.lang || 'en');
    if (typeof i18n?.getClientText === 'function') return i18n.getClientText(lang);
    return FALLBACK_TEXT.en;
  }

  function createBridge(win) {
    let sequence = 0;
    const pending = new Map();
    let disposed = false;
    const settle = (id, value) => {
      const entry = pending.get(Number(id));
      if (!entry) return false;
      pending.delete(Number(id));
      clearTimeout(entry.timer);
      entry.resolve(value);
      return true;
    };
    const callCancelable = (action, payload = {}, timeoutMs = DEFAULT_TIMEOUT) => {
      if (disposed) return { id: 0, promise: Promise.resolve({ ok: false, reason: 'bridge-disposed' }), cancel: () => false };
      const binding = win?.[BINDING_NAME] || G[BINDING_NAME];
      if (typeof binding !== 'function') return { id: 0, promise: Promise.resolve({ ok: false, reason: 'bridge-offline' }), cancel: () => false };
      const id = ++sequence;
      const promise = new Promise((resolvePromise) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          resolvePromise({ ok: false, reason: 'rpc-timeout' });
        }, timeoutMs);
        pending.set(id, { resolve: resolvePromise, timer });
        try {
          binding(JSON.stringify({ id, action, payload }));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          resolvePromise({ ok: false, reason: 'rpc-throw', error: String(error?.message || error) });
        }
      });
      return {
        id,
        promise,
        cancel(value = { ok: false, cancelled: true, reason: 'cancelled' }) {
          return settle(id, value);
        },
      };
    };
    const call = (action, payload = {}, timeoutMs = DEFAULT_TIMEOUT) => callCancelable(action, payload, timeoutMs).promise;
    const resolve = (id, value) => {
      return settle(id, value);
    };
    return {
      call,
      callCancelable,
      resolve,
      dispose() {
        disposed = true;
        for (const entry of pending.values()) {
          clearTimeout(entry.timer);
          entry.resolve({ ok: false, reason: 'bridge-disposed' });
        }
        pending.clear();
      },
    };
  }

  function textOf(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const EXCLUDED_PANE_SEL = [
    '[data-side-panel-focus-scope="true"]',
    '[data-testid="side-question-panel"]',
    '[data-testid="subagent-tab-conversation"]',
  ].join(', ');

  const BLOCKING_UI_SEL = [
    '[data-testid="interaction-takeover-card"]',
    '[data-testid="slash-command-menu"]',
    '[id^="typeahead-item-"][role="option"]',
    'html[data-ag-pp-open="1"]',
    '#ag-prism-periodic-picker-root',
    'html[data-ag-cs-model-menu]',
    '[data-testid="model-selector-panel"]',
    '.ag-omni-menu',
    '.ag-cs-ctx-menu',
    '.ag-prism-sidebar-modal',
    '[role="dialog"]',
    '#ag-cs-settings-sec',
  ].join(', ');

  const BLOCKING_CONTAINER_SEL = [
    '#ag-prism-periodic-picker-root',
    '[data-testid="model-selector-panel"]',
    '.ag-omni-menu',
    '.ag-cs-ctx-menu',
    '.ag-prism-sidebar-modal',
    '[role="dialog"]',
    '#ag-cs-settings-sec',
    '[data-testid="slash-command-menu"]',
    '[data-testid="interaction-takeover-card"]',
  ].join(', ');

  function isVisibleNode(node) {
    if (!node || node.hidden === true || node.isConnected === false) return false;
    const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    if (typeof node.closest === 'function' && node.closest('[hidden], .hidden, [inert]')) return false;
    if (typeof node.checkVisibility === 'function') {
      try { if (!node.checkVisibility()) return false; } catch {}
    }
    return true;
  }

  function isExcludedPaneNode(node) {
    return Boolean(node && typeof node.closest === 'function' && node.closest(EXCLUDED_PANE_SEL));
  }

  function isBlockingNode(node) {
    return Boolean(node && typeof node.closest === 'function' && node.closest(BLOCKING_CONTAINER_SEL));
  }

  function hasVisibleBlockingUi(doc) {
    const nodes = Array.from(doc?.querySelectorAll?.(BLOCKING_UI_SEL) || []);
    return nodes.some(isVisibleNode);
  }

  const COMPOSER_EDITOR_SEL = '.surface-composer [data-lexical-editor="true"], .surface-composer [contenteditable="true"], .surface-composer-card [data-lexical-editor="true"], .surface-composer-card [contenteditable="true"], [data-testid="agent-input-box"] [contenteditable="true"], .surface-composer textarea, .surface-composer-card textarea';

  function getComposerCandidates(doc) {
    if (!doc || hasVisibleBlockingUi(doc)) return [];
    const views = Array.from(doc.querySelectorAll?.('[data-testid="conversation-view"]') || []);
    const scopes = views.length > 0
      ? views.filter((node) => isVisibleNode(node) && !isExcludedPaneNode(node) && !isBlockingNode(node))
      : [doc.body || doc.documentElement];
    const seen = new Set();
    const candidates = [];
    for (const view of scopes) {
      const editors = Array.from(view?.querySelectorAll?.(COMPOSER_EDITOR_SEL) || [])
        .filter((node) => isVisibleNode(node) && !isExcludedPaneNode(node) && !isBlockingNode(node));
      for (const editor of editors) {
        const root = editor?.closest?.('.surface-composer, .surface-composer-card, [data-testid="agent-input-box"]') || null;
        if (!root || seen.has(root) || isExcludedPaneNode(root) || isBlockingNode(root)) continue;
        seen.add(root);
        const owner = view?.closest?.('[data-cascade-id]') || editor?.closest?.('[data-cascade-id]');
        candidates.push({ view, root, editor, cascadeId: String(owner?.getAttribute?.('data-cascade-id') || 'default-main') });
      }
    }
    return candidates;
  }

  function getActiveComposer(doc) {
    return getComposerCandidates(doc)[0] || { view: null, root: null, editor: null, cascadeId: '' };
  }

  function findComposerFooter(root, editor) {
    if (!root || typeof root.querySelector !== 'function') return null;
    const selectors = [
      '.agy-composer-footer',
      '[data-testid="input-box-bottom-toolbar"]',
      '.composer-footer',
      '[data-testid="composer-footer"]',
      '[data-composer-footer]',
      '[data-testid="agent-input-box-footer"]',
    ];
    const footer = selectors.map((selector) => root.querySelector(selector)).find(Boolean) ||
      Array.from(root.children || []).find((node) => {
        const className = String(node?.className || '');
        const testId = String(node?.getAttribute?.('data-testid') || '');
        return /(?:^|\s)agy-composer-footer(?:\s|$)|(?:^|\s)composer-footer(?:\s|$)/.test(className) ||
          testId === 'input-box-bottom-toolbar' || testId === 'composer-footer' ||
          testId === 'agent-input-box-footer' || node?.hasAttribute?.('data-composer-footer');
      }) || null;
    if (!footer || footer === editor || !isVisibleNode(footer) || footer.closest?.('[hidden], [inert]')) return null;
    return footer;
  }

  function readEditor(editor) {
    if (!editor) return '';
    if (typeof editor.value === 'string') return editor.value;
    if (typeof editor.innerText === 'string') return editor.innerText.replace(/\u00a0/g, ' ');
    return String(editor.textContent || '').replace(/\u00a0/g, '');
  }

  function normalizeEditorText(value) {
    return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
  }

  function sameEditorText(left, right) {
    return normalizeEditorText(left).replace(/\s+$/g, '') === normalizeEditorText(right).replace(/\s+$/g, '');
  }

  function sanitizeEnhancedText(value) {
    const protectedParts = [];
    let text = String(value ?? '')
      .replace(/\*{1,2}\/[^\s]+/g, (match) => {
        protectedParts.push(match);
        return `\u0000${protectedParts.length - 1}\u0000`;
      })
      .replace(/```[\s\S]*?```|`[^`\n]*`/g, (match) => {
        protectedParts.push(match);
        return `\u0000${protectedParts.length - 1}\u0000`;
      });
    text = text
      .replace(/(^|[^\w*])\*\*(\S(?:[^*\n]*?\S)?)\*\*(?=$|[^\w*])/g, '$1$2')
      .replace(/(^|[^\w*])\*(\S(?:[^*\n]*?\S)?)\*(?=$|[^\w*])/g, '$1$2');
    return text.replace(/\u0000(\d+)\u0000/g, (_, index) => protectedParts[Number(index)] || '');
  }

  function dispatchEditorEvent(doc, editor, type, init = {}) {
    try {
      const EventCtor = type === 'input'
        ? (doc.defaultView?.InputEvent || doc.defaultView?.Event || Event)
        : (doc.defaultView?.Event || Event);
      editor.dispatchEvent?.(new EventCtor(type, { bubbles: true, ...init }));
    } catch {}
  }

  function writeEditor(doc, editor, value) {
    if (!editor || editor.isConnected === false) return { status: 'blocked', reason: 'target-missing' };
    const text = String(value ?? '');
    if (!text.trim()) return { status: 'empty' };
    let attempted = false;
    try { editor.focus?.({ preventScroll: true }); } catch { try { editor.focus?.(); } catch {} }
    if (typeof editor.value === 'string') {
      try {
        const proto = Object.getPrototypeOf(editor);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(editor, text); else editor.value = text;
        attempted = true;
      } catch { try { editor.value = text; attempted = true; } catch {} }
      try { editor.selectionStart = editor.selectionEnd = text.length; } catch {}
      dispatchEditorEvent(doc, editor, 'input', { inputType: 'insertReplacementText', data: text });
      dispatchEditorEvent(doc, editor, 'change');
      const actual = readEditor(editor);
      return sameEditorText(actual, text)
        ? { status: 'applied', actual }
        : { status: attempted ? 'unverified' : 'failed', actual };
    }
    try {
      const lexical = editor.__lexicalEditor;
      if (lexical?._commands && typeof lexical.dispatchCommand === 'function') {
        const selectAll = Array.from(lexical._commands.keys()).find((command) => command?.type === 'SELECT_ALL_COMMAND');
        for (const command of lexical._commands.keys()) {
          if (command?.type === 'CONTROLLED_TEXT_INSERTION_COMMAND') {
            if (selectAll) lexical.dispatchCommand(selectAll, undefined);
            lexical.dispatchCommand(command, text);
            attempted = true;
            break;
          }
        }
        if (attempted) {
          dispatchEditorEvent(doc, editor, 'input', { inputType: 'insertReplacementText', data: text });
          dispatchEditorEvent(doc, editor, 'change');
          const actual = readEditor(editor);
          return sameEditorText(actual, text)
            ? { status: 'applied', actual }
            : { status: 'unverified', actual };
        }
      }
    } catch {}
    try {
      const range = doc.createRange?.();
      const selection = doc.defaultView?.getSelection?.();
      if (range && selection) {
        range.selectNodeContents(editor);
        selection.removeAllRanges?.();
        selection.addRange?.(range);
      }
      doc.execCommand?.('selectAll', false);
      if (doc.execCommand?.('insertText', false, text)) {
        attempted = true;
        dispatchEditorEvent(doc, editor, 'input', { inputType: 'insertReplacementText', data: text });
        dispatchEditorEvent(doc, editor, 'change');
        const actual = readEditor(editor);
        return sameEditorText(actual, text)
          ? { status: 'applied', actual }
          : { status: 'unverified', actual };
      }
    } catch {}
    try {
      editor.textContent = text;
      attempted = true;
      dispatchEditorEvent(doc, editor, 'input', { inputType: 'insertReplacementText', data: text });
      dispatchEditorEvent(doc, editor, 'change');
      const actual = readEditor(editor);
      return sameEditorText(actual, text)
        ? { status: 'applied', actual }
        : { status: 'unverified', actual };
    } catch {}
    return { status: attempted ? 'unverified' : 'failed' };
  }

  function extractContext(view) {
    if (!view) return [];
    const nodes = Array.from(view.querySelectorAll?.('[data-testid="user-message-content"], [data-testid="user-message-bubble"], [data-testid="agent-response"], [data-testid="planner-response-text"]') || []);
    const turns = [];
    for (const node of nodes.slice(-8)) {
      const text = textOf(node);
      if (!text) continue;
      const isUser = Boolean(node.closest?.('[data-testid="user-message"], [data-message-role="user"], [data-role="user"]')) || /user-message/i.test(String(node.getAttribute?.('data-testid') || ''));
      turns.push({ role: isUser ? 'user' : 'assistant', text: text.slice(-1800) });
    }
    return turns.slice(-6);
  }

  function injectStyle(doc) {
    if (doc.getElementById?.(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head?.appendChild(style);
  }

  function createButton(doc, labels) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'ag-prism-prompt-enhancer-btn';
    button.setAttribute('data-testid', BUTTON_TESTID);
    button.setAttribute('aria-label', labels.button);
    const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'ag-prism-prompt-enhancer-icon lucide lucide-sparkles');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.8');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    for (const d of ['m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z', 'm19 14 1.1 3.1L23 18l-2.9 1L19 22l-1-3-3-1 3-1 1-3Z', 'm5 2 .8 2.2L8 5l-2.2.8L5 8l-.8-2.2L2 5l2.2-.8L5 2Z']) {
      const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      icon.appendChild(path);
    }
    const label = doc.createElement('span');
    label.textContent = labels.button;
    button.__agPrismPromptEnhancerLabel = label;
    button.append(icon, label);
    return button;
  }

  function createPanel(doc, state, labels) {
    const panel = doc.createElement('section');
    panel.className = 'ag-prism-prompt-enhancer-panel';
    panel.setAttribute('data-testid', PANEL_TESTID);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', labels.title);
    const head = doc.createElement('div');
    head.className = 'ag-prism-prompt-enhancer-head';
    const title = doc.createElement('span');
    title.textContent = labels.title;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'ag-prism-prompt-enhancer-close';
    close.setAttribute('aria-label', labels.close);
    close.textContent = '×';
    head.append(title, close);
    const tabs = doc.createElement('div');
    tabs.className = 'ag-prism-prompt-enhancer-tabs';
    const body = doc.createElement('div');
    body.className = 'ag-prism-prompt-enhancer-body';
    const editor = doc.createElement('textarea');
    editor.className = 'ag-prism-prompt-enhancer-editor';
    editor.hidden = true;
    const status = doc.createElement('div');
    status.className = 'ag-prism-prompt-enhancer-status';
    const actions = doc.createElement('div');
    actions.className = 'ag-prism-prompt-enhancer-actions';
    const makeAction = (label, primary = false) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'ag-prism-prompt-enhancer-action';
      button.textContent = label;
      if (primary) button.setAttribute('data-primary', '1');
      return button;
    };
    const copy = makeAction(labels.copy);
    const edit = makeAction(labels.edit);
    const retry = makeAction(labels.retry);
    const replace = makeAction(labels.replace, true);
    const cancel = makeAction(labels.cancel);
    cancel.hidden = true;
    actions.append(copy, edit, retry, replace, cancel);
    panel.append(head, tabs, body, editor, status, actions);
    doc.body?.appendChild(panel);

    const setTab = (name) => {
      while (tabs.firstChild) tabs.firstChild.remove();
      const originalTab = doc.createElement('button');
      const enhancedTab = doc.createElement('button');
      for (const [button, label, value] of [[originalTab, labels.original, 'original'], [enhancedTab, labels.result, 'enhanced']]) {
        button.type = 'button';
        button.className = 'ag-prism-prompt-enhancer-tab';
        button.textContent = label;
        button.setAttribute('data-active', name === value ? '1' : '0');
        if (value === 'enhanced') button.disabled = !state.enhanced;
        button.addEventListener('click', () => setTab(value));
        tabs.appendChild(button);
      }
      if (name === 'original') {
        body.textContent = state.original;
        body.hidden = false;
        editor.hidden = true;
      } else {
        body.textContent = state.enhanced;
        body.hidden = false;
        editor.hidden = true;
      }
      state.tab = name;
    };
    close.addEventListener('click', () => { state.cancel?.(); panel.remove(); });
    copy.addEventListener('click', async () => {
      const value = !editor.hidden ? editor.value : state.tab === 'original' ? state.original : state.enhanced;
      try { await doc.defaultView?.navigator?.clipboard?.writeText?.(value); status.textContent = labels.copied; } catch { status.textContent = labels.copyFailed; }
    });
    edit.addEventListener('click', () => {
      editor.value = state.enhanced;
      body.hidden = true;
      editor.hidden = false;
      editor.focus?.();
      status.textContent = labels.editHint;
    });
    let replacing = false;
    replace.addEventListener('click', () => {
      if (replacing) return;
      replacing = true;
      try {
        const value = editor.hidden ? state.enhanced : editor.value;
        const result = state.replace?.(value) || { status: 'failed' };
        if (result.status === 'applied') {
          status.textContent = labels.replaced;
          panel.remove();
        } else if (result.status === 'empty') {
          status.textContent = labels.emptyResult;
        } else if (result.reason === 'target-missing') {
          status.textContent = labels.targetMissing;
        } else if (result.reason === 'target-changed') {
          status.textContent = labels.replaceConflict;
        } else {
          status.textContent = labels.replaceFailed;
        }
      } finally {
        replacing = false;
      }
    });
    retry.addEventListener('click', () => state.retry?.());
    cancel.addEventListener('click', () => state.cancel?.());
    setTab('original');
    return { panel, body, editor, status, cancel, setTab };
  }

  function createRuntime(env = {}) {
    const win = env.window || G;
    const doc = env.document || win?.document;
    if (!doc) return null;
    const bridge = createBridge(win);
    try { win.__agPrismPromptEnhancerBridge = bridge; G.__agPrismPromptEnhancerBridge = bridge; } catch {}
    const resolvePromptEnhancer = (id, value) => bridge.resolve(id, value);
    try { win.__agPrismPromptEnhancerResolve = resolvePromptEnhancer; G.__agPrismPromptEnhancerResolve = resolvePromptEnhancer; } catch {}
    let destroyed = false;
    let active = false;
    let loading = false;
    let observer = null;
    let config = { enabled: false };
    let panelState = null;
    let panelView = null;
    let activeRequestId = '';
    let activeRequestCancel = null;
    let activeRequestButton = null;
    let buttonMessageTimer = null;
    const mountedEntries = new Map();
    const labels = strings(doc);
    const updateButton = (busy, activeButton = null) => {
      for (const entry of mountedEntries.values()) {
        const button = entry.button;
        if (!button) continue;
        const isActive = Boolean(busy && activeButton && button === activeButton);
        button.disabled = Boolean(busy && !isActive);
        button.setAttribute('aria-busy', isActive ? 'true' : 'false');
        button.setAttribute('aria-label', isActive ? labels.cancel : labels.button);
        if (isActive) button.setAttribute('title', labels.cancel);
        else button.removeAttribute?.('title');
        if (button.__agPrismPromptEnhancerLabel) button.__agPrismPromptEnhancerLabel.textContent = isActive ? labels.cancel : labels.button;
      }
    };
    const showButtonMessage = (message, target = null) => {
      clearTimeout(buttonMessageTimer);
      updateButton(false);
      const button = target?.button || mountedEntries.get(target?.root)?.button || doc.querySelector?.(`[data-testid="${BUTTON_TESTID}"]`);
      if (!button) return;
      button.setAttribute('aria-label', message);
      button.setAttribute('title', message);
      button.setAttribute('data-status', message);
      if (button.__agPrismPromptEnhancerLabel) button.__agPrismPromptEnhancerLabel.textContent = labels.button;
      buttonMessageTimer = setTimeout(() => {
        if (!loading) {
          button.removeAttribute?.('data-status');
          button.removeAttribute?.('title');
          updateButton(false);
        }
      }, 2200);
    };
    const cancelActiveRequest = (removePanel = false) => {
      const requestId = activeRequestId;
      const cancelRpc = activeRequestCancel;
      activeRequestId = '';
      activeRequestCancel = null;
      activeRequestButton = null;
      loading = false;
      clearTimeout(buttonMessageTimer);
      buttonMessageTimer = null;
      updateButton(false);
      if (panelView) {
        panelView.cancel.hidden = true;
        panelView.status.textContent = labels.cancelled;
        panelState?.setTab?.('original');
        if (removePanel) {
          panelView.panel.remove();
          panelView = null;
        }
      }
      panelState = null;
      cancelRpc?.({ ok: false, cancelled: true, reason: 'cancelled' });
      if (requestId) void bridge.call('cancel', { requestId }, 5000);
    };
    const removeMountedEntry = (entry) => {
      if (!entry) return;
      entry.host?.remove?.();
      if (entry.root && entry.rootPosition !== null && entry.root.style) entry.root.style.position = entry.rootPosition;
      if (entry.root) mountedEntries.delete(entry.root);
    };
    const removeMountedButton = () => {
      for (const entry of mountedEntries.values()) removeMountedEntry(entry);
      doc.querySelectorAll?.(`[data-testid="${BUTTON_TESTID}"]`)?.forEach?.((node) => {
        if (!node.closest?.(`[data-testid="${BUTTON_HOST_TESTID}"]`)) node.remove?.();
      });
    };
    const mount = () => {
      if (destroyed || !config.enabled) return;
      const candidates = getComposerCandidates(doc);
      if (candidates.length === 0) {
        removeMountedButton();
        return;
      }
      injectStyle(doc);
      const activeRoots = new Set(candidates.map((candidate) => candidate.root));
      for (const [root, entry] of mountedEntries.entries()) {
        if (!activeRoots.has(root)) removeMountedEntry(entry);
      }
      for (const candidate of candidates) {
        const footer = findComposerFooter(candidate.root, candidate.editor);
        const parent = footer || candidate.root;
        let entry = mountedEntries.get(candidate.root);
        if (!entry || entry.host?.parentNode !== parent) {
          if (entry) removeMountedEntry(entry);
          let rootPosition = null;
          if (!footer && candidate.root.style) {
            rootPosition = candidate.root.style.position || '';
            const computedPosition = doc.defaultView?.getComputedStyle?.(candidate.root)?.position;
            if (!computedPosition || computedPosition === 'static') candidate.root.style.position = 'relative';
          }
          const host = doc.createElement('div');
          host.className = 'ag-prism-prompt-enhancer-host';
          host.setAttribute('data-testid', BUTTON_HOST_TESTID);
          if (!footer) host.setAttribute('data-fallback', '1');
          const button = createButton(doc, labels);
          entry = { ...candidate, footer, parent, host, button, rootPosition };
          button.addEventListener('click', () => triggerEnhancement(entry));
          host.appendChild(button);
          parent.appendChild(host);
          mountedEntries.set(candidate.root, entry);
        } else {
          entry.view = candidate.view;
          entry.editor = candidate.editor;
          entry.cascadeId = candidate.cascadeId;
          entry.footer = footer;
          entry.parent = parent;
          if (footer) entry.host.removeAttribute?.('data-fallback');
        }
        entry.button.hidden = false;
        if (footer && entry.host.parentNode !== footer) footer.prepend?.(entry.host);
      }
      /*
       * Each eligible composer owns its own trigger. This keeps split-view
       * requests and replacements bound to the pane where the user clicked.
       */
    };
    const triggerEnhancement = async (target = null) => {
      if (destroyed || !config.enabled) return;
      if (loading) {
        if (target?.button && target.button === activeRequestButton) cancelActiveRequest(true);
        return;
      }
      const snap = target?.root && target?.editor?.isConnected !== false ? target : getActiveComposer(doc);
      if (!snap.editor) return;
      const editorSnapshot = readEditor(snap.editor);
      const original = editorSnapshot.trim();
      if (!original) {
        showButtonMessage(labels.emptyInput, snap);
        return;
      }
      loading = true;
      const requestButton = target?.button || mountedEntries.get(snap.root)?.button || null;
      activeRequestButton = requestButton;
      updateButton(true, requestButton);
      const requestId = `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      activeRequestId = requestId;
      const context = extractContext(snap.view);
      panelState = {
        original,
        editorSnapshot,
        enhanced: '',
        editor: snap.editor,
        root: snap.root,
        cascadeId: snap.cascadeId,
        button: target?.button || mountedEntries.get(snap.root)?.button || null,
      };
      const replacementState = panelState;
      panelState.replace = (value) => {
        const current = replacementState;
        if (!current.editor || current.editor.isConnected === false) return { status: 'blocked', reason: 'target-missing' };
        if (current.root !== replacementState.root || current.cascadeId !== replacementState.cascadeId) {
          return { status: 'blocked', reason: 'target-changed' };
        }
        if (!sameEditorText(readEditor(current.editor), replacementState.editorSnapshot)) {
          return { status: 'blocked', reason: 'target-changed' };
        }
        return writeEditor(doc, current.editor, value);
      };
      if (original.length > MAX_REQUEST_CHARS) {
        loading = false;
        activeRequestId = '';
        activeRequestButton = null;
        updateButton(false);
        showButtonMessage(labels.tooLong, snap);
        return;
      }
      const stateAtRequest = panelState;
      let completionMessage = '';
      try {
        const request = bridge.callCancelable('enhance', { original, context, profileId: config.profileId, model: config.model, requestId }, DEFAULT_TIMEOUT);
        activeRequestCancel = request.cancel;
        const result = await request.promise;
        if (destroyed || !config.enabled || activeRequestId !== requestId || panelState !== stateAtRequest) return;
        const enhanced = sanitizeEnhancedText(result?.enhanced).trim();
        if (result?.ok && enhanced.trim()) {
          stateAtRequest.enhanced = enhanced;
          const replacement = stateAtRequest.replace(enhanced);
          if (replacement.status === 'applied') completionMessage = labels.replaced;
          else if (replacement.reason === 'target-missing') completionMessage = labels.targetMissing;
          else if (replacement.reason === 'target-changed') completionMessage = labels.replaceConflict;
          else if (replacement.status === 'empty') completionMessage = labels.emptyResult;
          else completionMessage = labels.replaceFailed;
        } else if (result?.ok) {
          stateAtRequest.enhanced = '';
          completionMessage = labels.emptyResult;
        } else {
          completionMessage = labels.failed;
        }
      } catch (error) {
        if (panelState === stateAtRequest) completionMessage = labels.failed;
      } finally {
        if (activeRequestId === requestId) {
          activeRequestId = '';
          activeRequestCancel = null;
          activeRequestButton = null;
          loading = false;
          if (completionMessage) showButtonMessage(completionMessage, stateAtRequest);
          else updateButton(false);
        }
      }
    };
    const activate = () => {
      if (active || destroyed || !config.enabled) return;
      active = true;
      injectStyle(doc);
      mount();
      win.addEventListener?.('resize', mount, { passive: true });
      win.addEventListener?.('scroll', mount, { passive: true, capture: true });
      observer = typeof win.MutationObserver === 'function' ? new win.MutationObserver(() => mount()) : null;
      observer?.observe?.(doc.body || doc.documentElement, { childList: true, subtree: true });
    };
    const deactivate = () => {
      active = false;
      clearTimeout(buttonMessageTimer);
      buttonMessageTimer = null;
      observer?.disconnect?.();
      observer = null;
      win.removeEventListener?.('resize', mount);
      win.removeEventListener?.('scroll', mount, true);
      cancelActiveRequest(true);
      doc.querySelectorAll?.(`[data-testid="${BUTTON_TESTID}"], [data-testid="${PANEL_TESTID}"]`)?.forEach?.((node) => node.remove());
      removeMountedButton();
      panelView = null;
      panelState = null;
      doc.getElementById?.(STYLE_ID)?.remove?.();
    };
    const applyConfig = (next = {}) => {
      const enabled = next && Object.prototype.hasOwnProperty.call(next, 'enabled')
        ? Boolean(next.enabled)
        : next?.promptEnhancer === 'on';
      config = { enabled, profileId: String(next.profileId || ''), model: String(next.model || '') };
      if (config.enabled) activate(); else deactivate();
    };
    const refresh = async () => {
      const result = await bridge.call('get-config', {}, 8000);
      if (result?.ok) applyConfig(result.config);
      return result;
    };
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      deactivate();
      bridge.dispose();
      try { delete win.__agPrismPromptEnhancerBridge; delete G.__agPrismPromptEnhancerBridge; delete win.__agPrismPromptEnhancerResolve; delete G.__agPrismPromptEnhancerResolve; } catch {}
    };
    if (env.initialConfig && typeof env.initialConfig === 'object') applyConfig(env.initialConfig);
    else void refresh();
    return { applyConfig, refresh, triggerEnhancement, getDebugState: () => ({ destroyed, active, loading, enabled: config.enabled }), destroy };
  }

  G.__agPrismPromptEnhancerFactory = createRuntime;
  if (typeof window !== 'undefined' && window) window.__agPrismPromptEnhancerFactory = createRuntime;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
