// Obsidian Prism - Channel 13 Prompt Enhancer client runtime.
// The module is inert until the user enables it in Beta settings.
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const BINDING_NAME = '__agPrismSuggestCall';
  const STYLE_ID = 'ag-prism-prompt-enhancer-css';
  const BUTTON_TESTID = 'prism-prompt-enhancer-trigger';
  const PANEL_TESTID = 'prism-prompt-enhancer-panel';
  const DEFAULT_TIMEOUT = 30000;
  const MAX_REQUEST_CHARS = 10000;

  const CSS = [
    '.ag-prism-prompt-enhancer-btn{position:fixed;z-index:2147482500;display:inline-flex;align-items:center;gap:6px;min-height:30px;margin:0;padding:0 10px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:7px;background:var(--secondary,rgba(128,128,145,.1));color:var(--foreground,inherit);font:inherit;font-size:12px;cursor:pointer;transition:background-color .14s ease,border-color .14s ease,opacity .14s ease;white-space:nowrap;}',
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
  ].join('\n');

  const TEXT = {
    'zh-CN': { button: '增强提示词', title: '提示词增强', close: '关闭', original: '原文', result: '增强结果', copy: '复制', edit: '编辑结果', retry: '重新增强', replace: '替换输入框', cancel: '取消请求', working: '正在增强提示词…', done: '增强完成，请检查后再替换', copied: '已复制', copyFailed: '复制失败', editHint: '可直接编辑增强结果', replaced: '已自动回填输入框', replaceFailed: '替换失败，请手动复制', replaceConflict: '输入框内容已变化，已保留当前草稿；请重新增强或手动复制结果', emptyResult: '增强结果为空，未替换输入框', emptyInput: '请输入要增强的内容', targetMissing: '找不到原输入框，未替换内容', cancelled: '请求已取消，原文仍保留', failed: '增强失败，原文仍保留，可重试：', tooLong: '输入超过 10000 字符限制' },
    'zh-TW': { button: '增強提示詞', title: '提示詞增強', close: '關閉', original: '原文', result: '增強結果', copy: '複製', edit: '編輯結果', retry: '重新增強', replace: '替換輸入框', cancel: '取消請求', working: '正在增強提示詞…', done: '增強完成，請檢查後再替換', copied: '已複製', copyFailed: '複製失敗', editHint: '可直接編輯增強結果', replaced: '已替換輸入框，是否傳送由你決定', replaceFailed: '替換失敗，請手動複製', cancelled: '請求已取消，原文仍保留', failed: '增強失敗，原文仍保留，可重試：', tooLong: '輸入超過 10000 字元限制' },
    en: { button: 'Enhance Prompt', title: 'Prompt Enhancer', close: 'Close', original: 'Original', result: 'Enhanced', copy: 'Copy', edit: 'Edit result', retry: 'Enhance again', replace: 'Replace input', cancel: 'Cancel request', working: 'Enhancing prompt…', done: 'Review the result before replacing your input', copied: 'Copied', copyFailed: 'Copy failed', editHint: 'Edit the enhanced prompt directly', replaced: 'Prompt replaced automatically', replaceFailed: 'Could not replace input; copy it manually', replaceConflict: 'The input changed, so the current draft was preserved. Enhance again or copy the result manually.', emptyResult: 'The enhanced result is empty. Nothing was replaced.', emptyInput: 'Enter text to enhance.', targetMissing: 'The original input is no longer available. Nothing was replaced.', cancelled: 'Request cancelled. Original text is preserved.', failed: 'Enhancement failed. Original text is preserved. Retry: ', tooLong: 'Input exceeds the 10,000 character limit' },
    ja: { button: 'プロンプトを強化', title: 'プロンプト強化', close: '閉じる', original: '原文', result: '強化結果', copy: 'コピー', edit: '結果を編集', retry: '再度強化', replace: '入力欄を置換', cancel: 'リクエストをキャンセル', working: '強化中…', done: '置換前に結果を確認してください', copied: 'コピーしました', copyFailed: 'コピーに失敗しました', editHint: '強化結果を編集できます', replaced: '入力欄を置換しました。送信はご自身で判断してください。', replaceFailed: '置換できません。手動でコピーしてください', cancelled: 'キャンセルしました。原文は保持されています。', failed: '失敗しました。原文は保持されています。再試行: ', tooLong: '入力が10,000文字を超えています' },
    ko: { button: '프롬프트 강화', title: '프롬프트 강화', close: '닫기', original: '원문', result: '강화 결과', copy: '복사', edit: '결과 편집', retry: '다시 강화', replace: '입력란 바꾸기', cancel: '요청 취소', working: '강화 중…', done: '바꾸기 전에 결과를 확인하세요', copied: '복사됨', copyFailed: '복사 실패', editHint: '강화된 프롬프트를 편집할 수 있습니다', replaced: '입력란을 바꿨습니다. 전송 여부는 직접 결정하세요.', replaceFailed: '바꾸지 못했습니다. 직접 복사하세요', cancelled: '취소됨. 원문은 보존됩니다.', failed: '실패했습니다. 원문은 보존됩니다. 다시 시도: ', tooLong: '입력이 10,000자를 초과합니다' },
    es: { button: 'Mejorar prompt', title: 'Mejorador de prompts', close: 'Cerrar', original: 'Original', result: 'Mejorado', copy: 'Copiar', edit: 'Editar resultado', retry: 'Mejorar de nuevo', replace: 'Reemplazar entrada', cancel: 'Cancelar solicitud', working: 'Mejorando…', done: 'Revisa el resultado antes de reemplazar la entrada', copied: 'Copiado', copyFailed: 'Error al copiar', editHint: 'Edita el prompt mejorado', replaced: 'Entrada reemplazada. Tú decides si enviarla.', replaceFailed: 'No se pudo reemplazar; copia el texto manualmente', cancelled: 'Solicitud cancelada. Se conserva el original.', failed: 'Error. Se conserva el original. Reintentar: ', tooLong: 'La entrada supera los 10 000 caracteres' },
    fr: { button: 'Améliorer le prompt', title: 'Améliorateur de prompt', close: 'Fermer', original: 'Original', result: 'Amélioré', copy: 'Copier', edit: 'Modifier le résultat', retry: 'Améliorer à nouveau', replace: 'Remplacer la saisie', cancel: 'Annuler la requête', working: 'Amélioration…', done: 'Vérifiez le résultat avant de remplacer la saisie', copied: 'Copié', copyFailed: 'Échec de la copie', editHint: 'Modifiez le prompt amélioré', replaced: 'Saisie remplacée. Vous décidez de l’envoyer.', replaceFailed: 'Remplacement impossible ; copiez le texte manuellement', cancelled: 'Requête annulée. L’original est conservé.', failed: 'Échec. L’original est conservé. Réessayer : ', tooLong: 'La saisie dépasse 10 000 caractères' },
    de: { button: 'Prompt verbessern', title: 'Prompt-Verbesserer', close: 'Schließen', original: 'Original', result: 'Verbessert', copy: 'Kopieren', edit: 'Ergebnis bearbeiten', retry: 'Erneut verbessern', replace: 'Eingabe ersetzen', cancel: 'Anfrage abbrechen', working: 'Prompt wird verbessert…', done: 'Prüfe das Ergebnis vor dem Ersetzen der Eingabe', copied: 'Kopiert', copyFailed: 'Kopieren fehlgeschlagen', editHint: 'Verbesserten Prompt bearbeiten', replaced: 'Eingabe ersetzt. Du entscheidest, ob du sie sendest.', replaceFailed: 'Ersetzen fehlgeschlagen; bitte manuell kopieren', cancelled: 'Anfrage abgebrochen. Original bleibt erhalten.', failed: 'Fehler. Original bleibt erhalten. Erneut versuchen: ', tooLong: 'Eingabe überschreitet 10.000 Zeichen' },
  };

  const REPLACEMENT_TEXT = {
    'zh-TW': { replaceConflict: '輸入框內容已變更，已保留目前草稿；請重新增強或手動複製結果', emptyResult: '增強結果為空，未替換輸入框', targetMissing: '找不到原輸入框，未替換內容' },
    ja: { replaceConflict: '入力欄が変更されたため、現在の下書きを保持しました。再度強化するか手動でコピーしてください。', emptyResult: '強化結果が空のため、入力欄は置換されませんでした。', targetMissing: '元の入力欄が見つからないため、置換されませんでした。' },
    ko: { replaceConflict: '입력란이 변경되어 현재 초안을 보존했습니다. 다시 강화하거나 결과를 직접 복사하세요.', emptyResult: '강화 결과가 비어 있어 입력란을 바꾸지 않았습니다.', targetMissing: '원래 입력란을 찾을 수 없어 바꾸지 않았습니다.' },
    es: { replaceConflict: 'La entrada cambió; se conservó el borrador actual. Mejora de nuevo o copia el resultado manualmente.', emptyResult: 'El resultado mejorado está vacío. No se reemplazó la entrada.', targetMissing: 'La entrada original ya no está disponible. No se reemplazó nada.' },
    fr: { replaceConflict: 'La saisie a changé ; le brouillon actuel a été conservé. Améliorez à nouveau ou copiez le résultat manuellement.', emptyResult: 'Le résultat amélioré est vide. La saisie n’a pas été remplacée.', targetMissing: 'La saisie d’origine est indisponible. Aucun remplacement effectué.' },
    de: { replaceConflict: 'Die Eingabe hat sich geändert; der aktuelle Entwurf wurde beibehalten. Verbessere erneut oder kopiere das Ergebnis manuell.', emptyResult: 'Das verbesserte Ergebnis ist leer. Die Eingabe wurde nicht ersetzt.', targetMissing: 'Die ursprüngliche Eingabe ist nicht mehr verfügbar. Es wurde nichts ersetzt.' },
  };

  function strings(doc) {
    const lang = String(doc?.documentElement?.lang || '').toLowerCase();
    const locale = lang.startsWith('zh-tw') || lang.startsWith('zh-hk') ? 'zh-TW' : lang.startsWith('zh') ? 'zh-CN' : lang.slice(0, 2);
    return { ...TEXT.en, ...(TEXT[locale] || {}), ...(REPLACEMENT_TEXT[locale] || {}) };
  }

  function createBridge(win) {
    let sequence = 0;
    const pending = new Map();
    let disposed = false;
    const resolve = (id, value) => {
      const entry = pending.get(Number(id));
      if (!entry) return false;
      pending.delete(Number(id));
      clearTimeout(entry.timer);
      entry.resolve(value);
      return true;
    };
    const call = (action, payload = {}, timeoutMs = DEFAULT_TIMEOUT) => {
      if (disposed) return Promise.resolve({ ok: false, reason: 'bridge-disposed' });
      const binding = win?.[BINDING_NAME] || G[BINDING_NAME];
      if (typeof binding !== 'function') return Promise.resolve({ ok: false, reason: 'bridge-offline' });
      const id = ++sequence;
      return new Promise((resolvePromise) => {
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
    };
    return {
      call,
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

  function getActiveComposer(doc) {
    if (!doc) return { view: null, root: null, editor: null, cascadeId: '' };
    const views = Array.from(doc.querySelectorAll?.('[data-testid="conversation-view"]') || []);
    const visible = (node) => {
      if (!node) return false;
      const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node);
      return node.isConnected !== false && node.hidden !== true && style?.display !== 'none' && style?.visibility !== 'hidden';
    };
    const view = views.find(visible) || null;
    const scope = view || doc.body || doc.documentElement;
    const editor = Array.from(scope.querySelectorAll?.('.surface-composer [data-lexical-editor="true"], .surface-composer [contenteditable="true"], [data-testid="agent-input-box"] [contenteditable="true"], .surface-composer textarea') || []).find(visible) || null;
    const root = editor?.closest?.('.surface-composer, [data-testid="agent-input-box"]') || null;
    const owner = view?.closest?.('[data-cascade-id]') || editor?.closest?.('[data-cascade-id]');
    return { view, root, editor, cascadeId: String(owner?.getAttribute?.('data-cascade-id') || 'default-main') };
  }

  function readEditor(editor) {
    if (!editor) return '';
    if (typeof editor.value === 'string') return editor.value;
    return String(editor.textContent || '').replace(/\u00a0/g, '');
  }

  function normalizeEditorText(value) {
    return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
  }

  function sameEditorText(left, right) {
    return normalizeEditorText(left).replace(/\s+$/g, '') === normalizeEditorText(right).replace(/\s+$/g, '');
  }

  function sanitizeEnhancedText(value) {
    return String(value ?? '').replace(/\*/g, '');
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
    let buttonMessageTimer = null;
    const labels = strings(doc);
    const updateButton = (busy) => {
      const button = doc.querySelector?.(`[data-testid="${BUTTON_TESTID}"]`);
      if (!button) return;
      button.disabled = Boolean(busy);
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
      button.setAttribute('aria-label', busy ? labels.working : labels.button);
      if (busy) button.removeAttribute?.('title');
      if (button.__agPrismPromptEnhancerLabel) button.__agPrismPromptEnhancerLabel.textContent = busy ? labels.working : labels.button;
    };
    const showButtonMessage = (message) => {
      clearTimeout(buttonMessageTimer);
      updateButton(false);
      const button = doc.querySelector?.(`[data-testid="${BUTTON_TESTID}"]`);
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
      if (!requestId) return;
      activeRequestId = '';
      loading = false;
      updateButton(false);
      if (panelView) {
        panelView.cancel.hidden = true;
        panelView.status.textContent = labels.cancelled;
        panelState?.setTab?.('original');
        if (removePanel) panelView.panel.remove();
      }
      void bridge.call('enhancer-cancel', { requestId }, 5000);
    };
    const mount = () => {
      if (destroyed || !config.enabled) return;
      const snap = getActiveComposer(doc);
      let button = doc.querySelector?.(`[data-testid="${BUTTON_TESTID}"]`);
      if (!snap.root || !snap.editor) {
        if (button) button.hidden = true;
        return;
      }
      if (!button) {
        injectStyle(doc);
        button = createButton(doc, labels);
        button.addEventListener('click', () => triggerEnhancement());
        doc.body?.appendChild(button);
      }
      button.hidden = false;
      const rect = snap.root.getBoundingClientRect?.();
      if (rect) {
        const viewportWidth = Number(win.innerWidth) || doc.documentElement?.clientWidth || 1024;
        const buttonWidth = Math.max(120, Number(button.offsetWidth) || 180);
        const left = Math.max(8, Math.min(viewportWidth - buttonWidth - 8, Number(rect.right) - buttonWidth));
        button.style.left = `${left}px`;
        button.style.top = `${Math.max(8, Number(rect.top) - 36)}px`;
      }
    };
    const triggerEnhancement = async () => {
      if (destroyed || !config.enabled || loading) return;
      const snap = getActiveComposer(doc);
      if (!snap.editor) return;
      const editorSnapshot = readEditor(snap.editor);
      const original = editorSnapshot.trim();
      if (!original) {
        showButtonMessage(labels.emptyInput);
        return;
      }
      loading = true;
      updateButton(true);
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
      };
      const replacementState = panelState;
      panelState.replace = (value) => {
        const current = getActiveComposer(doc);
        if (!current.editor || current.editor.isConnected === false) return { status: 'blocked', reason: 'target-missing' };
        if (current.editor !== replacementState.editor || current.root !== replacementState.root || current.cascadeId !== replacementState.cascadeId) {
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
        showButtonMessage(labels.tooLong);
        return;
      }
      const stateAtRequest = panelState;
      let completionMessage = '';
      try {
        const result = await bridge.call('enhance', { original, context, profileId: config.profileId, model: config.model, requestId }, DEFAULT_TIMEOUT);
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
          loading = false;
          if (completionMessage) showButtonMessage(completionMessage);
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
      panelView = null;
      panelState = null;
      doc.getElementById?.(STYLE_ID)?.remove?.();
    };
    const applyConfig = (next = {}) => {
      config = { enabled: Boolean(next.enabled), profileId: String(next.profileId || ''), model: String(next.model || '') };
      if (config.enabled) activate(); else deactivate();
    };
    const refresh = async () => {
      const result = await bridge.call('enhancer-get-config', {}, 8000);
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
