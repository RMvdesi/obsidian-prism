// Channel 18 client: Icon-safe Global UI Font + 3-Tier Cascade + Local custom.css Isolation (0 innerHTML, 0 :has())
(function (root, factory) {
  const api = factory(root);
  if (root) root.__agPrismCustomStyle = api;
  if (typeof window !== 'undefined' && window && window !== root) {
    window.__agPrismCustomStyle = api;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';

  const UI_FONT_STYLE_ID = 'ag-prism-ui-font-style';
  const USER_CSS_STYLE_ID = 'ag-prism-user-custom-css';
  const UI_FONT_ATTR = 'data-ag-cs-ui-font';
  const USER_CSS_ATTR = 'data-ag-prism-custom-css';
  const MAX_CUSTOM_LEN = 160;
  const MAX_FAMILY_ITEMS = 8;

  const DEFAULT_UI_FALLBACK =
    "'Google Sans Flex', 'Google Sans', 'Google Sans Text', 'Inter', 'Segoe UI Variable', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

  const UI_FONT_PRESETS = Object.freeze({
    default: '',
    'system-sans':
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Noto Sans CJK SC', sans-serif",
    'noto-sans':
      "'Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif",
    inter:
      "'Inter', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif",
    harmony:
      "'HarmonyOS Sans SC', 'HarmonyOS Sans', 'MiSans', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei UI', system-ui, sans-serif",
  });

  const DANGEROUS_TOKEN_RE =
    /[;{}()\\<>`$\r\n\0\x01-\x1f\x7f]|url\s*\(|expression\s*\(|@import|@charset|@font-face|@media|@layer|javascript:|data:/i;
  const SAFE_FAMILY_NAME_RE = /^[\p{L}\p{N} ._-]+$/u;
  const RESERVED_CSS_KEYWORDS = new Set([
    'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'default', 'none', 'auto',
  ]);

  let lastCfg = {};
  let lastCustomCssState = {
    status: 'missing',
    css: '',
    bytes: 0,
    rawBytes: 0,
    maxBytes: 256 * 1024,
    sha256: '',
    blockedImports: 0,
    fileName: 'custom.css',
  };

  function getCoreFontCustomizer() {
    return (typeof window !== 'undefined' && window.__agPrismFontCustomizer) || G.__agPrismFontCustomizer || null;
  }

  function sanitizeFontFamilyList(raw) {
    const core = getCoreFontCustomizer();
    if (core && typeof core.sanitizeFontFamilyList === 'function') {
      return core.sanitizeFontFamilyList(raw);
    }
    if (typeof raw !== 'string') return { families: [], hadRejected: false };
    const clipped = raw.slice(0, MAX_CUSTOM_LEN);
    if (!clipped.trim()) return { families: [], hadRejected: false };
    const segments = clipped.split(',');
    const families = [];
    const seen = new Set();
    let hadRejected = false;
    for (let i = 0; i < segments.length; i++) {
      const trimmedRaw = segments[i].trim();
      if (!trimmedRaw) continue;
      if (DANGEROUS_TOKEN_RE.test(trimmedRaw)) { hadRejected = true; continue; }
      let unwrapped = trimmedRaw;
      while (
        unwrapped.length >= 2 &&
        ((unwrapped[0] === '"' && unwrapped[unwrapped.length - 1] === '"') ||
          (unwrapped[0] === "'" && unwrapped[unwrapped.length - 1] === "'"))
      ) {
        unwrapped = unwrapped.slice(1, -1).trim();
      }
      if (/['"]/.test(unwrapped)) { hadRejected = true; continue; }
      const collapsed = unwrapped.replace(/\s+/g, ' ').trim();
      if (!collapsed || collapsed.length > 64 || !SAFE_FAMILY_NAME_RE.test(collapsed)) { hadRejected = true; continue; }
      const lower = collapsed.toLowerCase();
      if (RESERVED_CSS_KEYWORDS.has(lower)) { hadRejected = true; continue; }
      if (seen.has(lower)) continue;
      seen.add(lower);
      families.push(collapsed);
      if (families.length >= MAX_FAMILY_ITEMS) break;
    }
    return { families, hadRejected };
  }

  function resolveUiFontStack(uiFont, uiFontCustom) {
    const mode = typeof uiFont === 'string' ? uiFont.trim() : 'default';
    if (!mode || mode === 'default') return '';
    if (mode === 'custom') {
      const { families } = sanitizeFontFamilyList(uiFontCustom);
      if (families.length === 0) return '';
      return `${families.map((name) => JSON.stringify(name)).join(', ')}, ${DEFAULT_UI_FALLBACK}`;
    }
    return Object.prototype.hasOwnProperty.call(UI_FONT_PRESETS, mode) ? UI_FONT_PRESETS[mode] : '';
  }

  function resolveChatStackForExtraTargets(cfg) {
    const core = getCoreFontCustomizer();
    if (core && typeof core.resolveChatFontStack === 'function') {
      return core.resolveChatFontStack(cfg.chatFont, cfg.chatFontCustom);
    }
    return resolveUiFontStack(cfg.chatFont, cfg.chatFontCustom);
  }

  // Build lightweight, icon-safe global UI font CSS (zero :has(), minimal selector cost per Issue #151)
  function buildGlobalFontBridgeCss(cfg, hasActiveUserCss) {
    const conf = cfg && typeof cfg === 'object' ? cfg : {};
    const uiStack = resolveUiFontStack(conf.uiFont, conf.uiFontCustom);
    const chatStack = resolveChatStackForExtraTargets(conf);
    const rules = [];

    // 1) Global UI font layer (also activates variable hooks when custom.css defines --ag-prism-*-font)
    if (uiStack || hasActiveUserCss) {
      const uiExpr = uiStack ? `var(--ag-prism-ui-font, ${uiStack})` : 'var(--ag-prism-ui-font)';
      if (uiStack) {
        rules.push(
          `html:root[data-ag-cs-style]{--ag-prism-ui-font-resolved:${uiExpr};--font-sans:var(--ag-prism-ui-font-resolved) !important;--ag-sb-font-display:var(--ag-prism-ui-font-resolved) !important;}`
        );
        // Lightweight root & control-surface inheritance (strictly excludes icon fonts, zero :has(); :where() keeps control specificity below L2 chatFont)
        rules.push(
          `html[data-ag-cs-style],html[data-ag-cs-style] body,html[data-ag-cs-style] .agy-shell,html[data-ag-cs-style] [data-testid="sidebar-split"],html[data-ag-cs-style] [data-testid="main-content-body"],html[data-ag-cs-style] [data-testid="overview-panel-host"],html[data-ag-cs-style] [role="dialog"],html[data-ag-cs-style] [role="menu"],html[data-ag-cs-style] [role="listbox"],html[data-ag-cs-style] [data-radix-popper-content-wrapper],html[data-ag-cs-style] [data-base-ui-portal],html[data-ag-cs-style] .ag-cs-ctx-menu,html[data-ag-cs-style] .ag-cs-ctx-toast{font-family:var(--ag-prism-ui-font-resolved) !important;}`
        );
        rules.push(
          `html[data-ag-cs-style] :where(button,input,select,textarea):where(:not(.codicon):not([class*="codicon-"]):not(.octicon):not([data-icon-font])){font-family:var(--ag-prism-ui-font-resolved) !important;}`
        );
        // When chatFont is Host Default, prose surfaces inherit uiFont (still overridable by --ag-prism-chat-font in custom.css)
        if (!chatStack) {
          rules.push(
            `html[data-ag-cs-style] :is([data-testid="conversation-view"],[data-testid="planner-response-text"],[data-testid="agent-response"],[data-testid="user-message"],[data-testid="message-content"],[data-testid="artifact-view"],[data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"],.ag-prism-thought-body,.ag-prism-thought-overlay,[data-testid="agent-input-box"] :is([data-lexical-editor="true"],[contenteditable="true"],textarea,input)){--font-sans:var(--ag-prism-chat-font,var(--ag-prism-ui-font-resolved));font-family:var(--ag-prism-chat-font,var(--ag-prism-ui-font-resolved)) !important;}`
          );
          rules.push(
            `html[data-ag-cs-style] :is([data-testid="planner-response-text"],[data-testid="agent-response"],[data-testid="user-message"],[data-testid="message-content"],[data-testid="artifact-view"],[data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"],.ag-prism-thought-body) :is(p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,dt,dd,a,strong,em){font-family:var(--ag-prism-chat-font,var(--ag-prism-ui-font-resolved)) !important;}`
          );
        }
      } else if (hasActiveUserCss) {
        // Even when uiFont/chatFont/codeFont are all 'default', allow custom.css to set --ag-prism-{ui,chat,code}-font cleanly
        rules.push(
          `html:root[data-ag-cs-style]{--ag-prism-ui-font-resolved:var(--ag-prism-ui-font,${DEFAULT_UI_FALLBACK});--font-sans:var(--ag-prism-ui-font,${DEFAULT_UI_FALLBACK}) !important;--ag-sb-font-display:var(--ag-prism-ui-font,${DEFAULT_UI_FALLBACK}) !important;font-family:var(--ag-prism-ui-font,var(--font-sans));}`
        );
        rules.push(
          `html[data-ag-cs-style] body,html[data-ag-cs-style] .agy-shell,html[data-ag-cs-style] [data-testid="sidebar-split"],html[data-ag-cs-style] [data-testid="main-content-body"],html[data-ag-cs-style] [data-testid="overview-panel-host"],html[data-ag-cs-style] [role="dialog"],html[data-ag-cs-style] [role="menu"],html[data-ag-cs-style] [role="listbox"],html[data-ag-cs-style] [data-radix-popper-content-wrapper],html[data-ag-cs-style] [data-base-ui-portal],html[data-ag-cs-style] .ag-cs-ctx-menu,html[data-ag-cs-style] .ag-cs-ctx-toast{font-family:var(--ag-prism-ui-font,var(--font-sans));}`
        );
        rules.push(
          `html[data-ag-cs-style] :where(button,input,select,textarea):where(:not(.codicon):not([class*="codicon-"]):not(.octicon):not([data-icon-font])){font-family:var(--ag-prism-ui-font,inherit);}`
        );
        if (!chatStack) {
          rules.push(
            `html[data-ag-cs-style] :is([data-testid="conversation-view"],[data-testid="planner-response-text"],[data-testid="agent-response"],[data-testid="user-message"],[data-testid="message-content"],[data-testid="artifact-view"],[data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"],.ag-prism-thought-body,.ag-prism-thought-overlay,[data-testid="agent-input-box"] :is([data-lexical-editor="true"],[contenteditable="true"],textarea,input)){--font-sans:var(--ag-prism-chat-font,var(--ag-prism-ui-font-resolved));font-family:var(--ag-prism-chat-font,var(--ag-prism-ui-font,var(--font-sans)));}`
          );
          rules.push(
            `html[data-ag-cs-style] :is([data-testid="planner-response-text"],[data-testid="agent-response"],[data-testid="user-message"],[data-testid="message-content"],[data-testid="artifact-view"],[data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"],.ag-prism-thought-body) :is(p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,dt,dd,a,strong,em){font-family:var(--ag-prism-chat-font,var(--ag-prism-ui-font,var(--font-sans)));}`
          );
        }
      }

      // 2) Explicit icon-font immunity (codicon / octicon never turned into tofu boxes)
      rules.push(
        `html:root[data-ag-cs-style] :is(.codicon,[class*="codicon-"]){font-family:codicon !important;}`
      );
      rules.push(
        `html:root[data-ag-cs-style] .octicon{font-family:octicons !important;}`
      );
    }

    // 3) Cover extra prose surfaces (side-question & subagent panels) when chatFont is active
    if (chatStack) {
      const chatExpr = `var(--ag-prism-chat-font, ${chatStack})`;
      rules.push(
        `html[data-ag-cs-style] :is([data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"]){--font-sans:${chatExpr};font-family:${chatExpr} !important;}`
      );
      rules.push(
        `html[data-ag-cs-style] :is([data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"]) :is(p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,dt,dd,a,strong,em){font-family:${chatExpr} !important;}`
      );
    }

    // 4) Strict monospace code & inline-diff protection (overrides --ag-cs-mono-stack so --ag-prism-code-font beats adoptedStyleSheets)
    if (uiStack || chatStack || hasActiveUserCss) {
      if (hasActiveUserCss) {
        rules.push(
          `html:root[data-ag-cs-style]:not([data-ag-cs-code-font="custom"]){--ag-cs-mono-stack:var(--ag-prism-code-font,var(--editor-font-family,'Google Sans Code','Cascadia Code',Consolas,ui-monospace,monospace)) !important;}`
        );
        rules.push(
          `html:root[data-ag-cs-style][data-ag-cs-code-font="default"][data-ag-cs-ligatures="1"],html:root[data-ag-cs-style]:not([data-ag-cs-code-font])[data-ag-cs-ligatures="1"]{--ag-cs-mono-stack:var(--ag-prism-code-font,'JetBrains Mono','Cascadia Code','Fira Code','Google Sans Code',Consolas,ui-monospace,monospace) !important;}`
        );
        rules.push(
          `html:root[data-ag-cs-style][data-ag-cs-code-font="jetbrains"]{--ag-cs-mono-stack:var(--ag-prism-code-font,'JetBrains Mono','Cascadia Code','Fira Code',Consolas,ui-monospace,monospace) !important;}`
        );
        rules.push(
          `html:root[data-ag-cs-style][data-ag-cs-code-font="cascadia"]{--ag-cs-mono-stack:var(--ag-prism-code-font,'Cascadia Code','Cascadia Mono','Fira Code',Consolas,ui-monospace,monospace) !important;}`
        );
        rules.push(
          `html:root[data-ag-cs-style][data-ag-cs-code-font="sfmono"]{--ag-cs-mono-stack:var(--ag-prism-code-font,'SF Mono',SFMono-Regular,Menlo,Monaco,Consolas,ui-monospace,monospace) !important;}`
        );
      }
      rules.push(
        `html[data-ag-cs-style] :is(pre,code,.code-block,.code-line,kbd,[data-lexical-editor="true"] code,.monaco-editor .view-lines,.xterm,.xterm-rows,.ag-cs-inline-diff-box pre,.ag-cs-inline-diff-box code,[data-testid="background-task-command"],.ag-prism-thought-code,.ag-prism-thought-pre){font-family:var(--ag-prism-code-font,var(--ag-cs-mono-stack)) !important;}`
      );
      rules.push(
        `html[data-ag-cs-style] :is(pre,code,.code-block,.code-line,.monaco-editor .view-lines,.xterm-rows,.ag-cs-inline-diff-box pre,.ag-cs-inline-diff-box code) :is(span,div){font-family:inherit !important;}`
      );
    }

    return rules.join('\n');
  }

  function upsertManagedStyle(doc, id, cssText, keepLast) {
    const existing = typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
    if (!cssText) {
      if (existing) {
        try { existing.remove?.(); } catch {}
      }
      return null;
    }
    const host = doc.head || doc.documentElement;
    if (!host) return null;
    let el = existing;
    if (!el) {
      el = doc.createElement('style');
      el.id = id;
      try { el.setAttribute?.('data-ag-prism-owned', '1'); } catch {}
      host.appendChild(el);
    }
    if (el.textContent !== cssText) {
      el.textContent = cssText;
    }
    if (el.parentNode !== host || (keepLast && host.lastElementChild !== el)) {
      host.appendChild(el);
    }
    return el;
  }

  function ensureUserCssLast(doc) {
    if (!doc || typeof doc.getElementById !== 'function') return;
    const host = doc.head || doc.documentElement;
    const userEl = doc.getElementById(USER_CSS_STYLE_ID);
    if (host && userEl && host.lastElementChild !== userEl) {
      try { host.appendChild(userEl); } catch {}
    }
  }

  function sync(cfgOverride, customCssPayload, docOverride) {
    const doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (cfgOverride && typeof cfgOverride === 'object') {
      lastCfg = Object.assign({}, lastCfg, cfgOverride);
    }
    if (customCssPayload && typeof customCssPayload === 'object') {
      lastCustomCssState = Object.assign({}, lastCustomCssState, customCssPayload);
    }
    if (!doc) return { ok: false };

    const de = doc.documentElement;
    const uiMode = typeof lastCfg.uiFont === 'string' && lastCfg.uiFont ? lastCfg.uiFont : 'default';
    const cssEnabled = lastCfg.customCss !== 'off' && lastCfg.customCss !== false;
    const activeUserCss = cssEnabled && lastCustomCssState.status === 'active' && typeof lastCustomCssState.css === 'string' && lastCustomCssState.css.trim()
      ? lastCustomCssState.css
      : '';

    if (de) {
      try {
        if (uiMode !== 'default') {
          if (de.getAttribute?.(UI_FONT_ATTR) !== uiMode) de.setAttribute?.(UI_FONT_ATTR, uiMode);
        } else if (de.hasAttribute?.(UI_FONT_ATTR)) {
          de.removeAttribute?.(UI_FONT_ATTR);
        }
        const cssAttrVal = !cssEnabled ? 'off' : (activeUserCss ? 'active' : (lastCustomCssState.status || 'missing'));
        if (de.getAttribute?.(USER_CSS_ATTR) !== cssAttrVal) de.setAttribute?.(USER_CSS_ATTR, cssAttrVal);
      } catch {}
    }

    const uiCss = buildGlobalFontBridgeCss(lastCfg, Boolean(activeUserCss));
    upsertManagedStyle(doc, UI_FONT_STYLE_ID, uiCss, false);
    // Pin user custom.css as the absolute last style element in <head> for highest cascade priority
    upsertManagedStyle(doc, USER_CSS_STYLE_ID, activeUserCss, true);
    ensureUserCssLast(doc);

    return {
      ok: true,
      uiFontActive: Boolean(resolveUiFontStack(lastCfg.uiFont, lastCfg.uiFontCustom)),
      customCssActive: Boolean(activeUserCss),
      customCssStatus: cssEnabled ? (lastCustomCssState.status || 'missing') : 'disabled',
    };
  }

  function getState() {
    return {
      cfg: Object.assign({}, lastCfg),
      customCss: Object.assign({}, lastCustomCssState),
    };
  }

  function destroy(docOverride) {
    const doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (doc) {
      try { doc.getElementById?.(UI_FONT_STYLE_ID)?.remove?.(); } catch {}
      try { doc.getElementById?.(USER_CSS_STYLE_ID)?.remove?.(); } catch {}
      try { doc.documentElement?.removeAttribute?.(UI_FONT_ATTR); } catch {}
      try { doc.documentElement?.removeAttribute?.(USER_CSS_ATTR); } catch {}
    }
  }

  return {
    UI_FONT_STYLE_ID,
    USER_CSS_STYLE_ID,
    UI_FONT_ATTR,
    USER_CSS_ATTR,
    UI_FONT_PRESETS,
    sanitizeFontFamilyList,
    resolveUiFontStack,
    buildGlobalFontBridgeCss,
    ensureUserCssLast,
    sync,
    getState,
    destroy,
  };
});
