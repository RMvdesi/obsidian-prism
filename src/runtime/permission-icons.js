// Antigravity 本地权限图标语义着色模块（Ch15 前置运行期模块：0 外部依赖、0 innerHTML、0 :has(、100% ASCII CSS）
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const STYLE_ID = 'ag-prism-perm-icons-css';
  const ATTR_PRESET = 'data-ag-perm-preset';

  /* @host-compat host-selectors.cjs#HOST_INTERACTION_SELECTORS */
  const S_TRIG = '[data-testid="permissions-selector-trigger"]';
  const S_MENU = '[data-testid="permissions-menu"]';
  const S_OPT = '[data-testid^="permissions-preset-option-"]';
  const S_GLOB = '[data-testid="permissions-use-global-settings"]';

  // 严格对应 Antigravity 当前 4 个真实本地权限预设（安全 -> 高危色谱：绿 / 蓝 / 琥珀 / 红）
  // 宿主原文与 host-i18n 已验证译文：
  // - request_review: Request Review / 请求审查 / İnceleme İste
  // - default:        Default / 默认 / Varsayılan
  // - auto:           Auto / 自动 / Otomatik
  // - turbo:          Turbo / 极速 / Turbo
  const PERM_PRESET_PALETTE = Object.freeze({
    request_review: Object.freeze({ dark: '#34D399', light: '#059669' }),
    default: Object.freeze({ dark: '#60A5FA', light: '#2563EB' }),
    auto: Object.freeze({ dark: '#FBBF24', light: '#D97706' }),
    turbo: Object.freeze({ dark: '#F87171', light: '#DC2626' }),
  });

  // 按暗/亮主题生成纯 ASCII 样式表，通过 --ag-perm-ink 驱动底栏触发按钮与下拉菜单图标着色
  function buildPermIconsCss() {
    const H = 'html[data-ag-cs-style]';
    const HL = `${H}[data-ag-cs-theme="light"]`;
    const T = `${H} .agy-composer-footer ${S_TRIG}[${ATTR_PRESET}]`;
    const TH = `${T}:not(:disabled,[aria-disabled="true"],[data-disabled=""],[data-disabled="true"]):is(:hover,[aria-expanded="true"])`;
    const M = `${H} ${S_MENU}`;
    const MI = `${M} :is(${S_OPT},${S_GLOB}[${ATTR_PRESET}])`;
    const MS = `${M} ${S_OPT}[data-ag-perm-selected="1"]`;
    const cm = (c, pct) => `color-mix(in srgb,${c} ${pct}%,transparent)`;
    const ink = 'var(--ag-perm-ink)';
    const rules = [];
    for (const [k, pal] of Object.entries(PERM_PRESET_PALETTE)) {
      const sel = `:is([${ATTR_PRESET}="${k}"],[data-testid="permissions-preset-option-${k}"])`;
      rules.push(`${H} ${sel}{--ag-perm-ink:${pal.dark}}`, `${HL} ${sel}{--ag-perm-ink:${pal.light}}`);
    }
    rules.push(
      // >svg:first-of-type 匹配真实宿主 eid 直出 SVG；>span:first-child>svg 仅兼容本地模拟器 workbench/replica.js
      `${T}>svg:first-of-type,${T}>span:first-child>svg{color:${ink}!important;opacity:.96!important}`,
      `${TH}{background:${cm(ink, 11)}!important;border-color:${cm(ink, 28)}!important}`,
      `${TH}>svg:first-of-type,${TH}>span:first-child>svg{opacity:1!important}`,
      // 下拉菜单项图标固定包裹在 FQ 组件的 [data-icon] 容器内
      `${MI} [data-icon]{width:28px;height:28px;border-radius:7px;background:${cm(ink, 13)};box-shadow:inset 0 0 0 1px ${cm(ink, 24)};color:${ink}!important;transition:background-color .14s ease,box-shadow .14s ease}`,
      `${MI} [data-icon] svg{color:${ink}!important;opacity:1!important}`,
      `${MI}:is(:hover,[data-highlighted]){background-color:${cm(ink, 8)}!important;box-shadow:inset 0 0 0 1px ${cm(ink, 18)}!important}`,
      `${MS}{background-color:${cm(ink, 11)}!important;box-shadow:inset 0 0 0 1px ${cm(ink, 24)},inset 0 1px 0 rgba(255,255,255,.07)!important}`,
      `${MS} [data-icon]{background:${cm(ink, 19)};box-shadow:inset 0 0 0 1px ${cm(ink, 36)}}`,
      // 亮色主题显式覆盖 style.css 中菜单选中项的默认灰底
      `${HL} ${S_MENU} ${S_OPT}[data-ag-perm-selected="1"]{background-color:${cm(ink, 10)}!important;box-shadow:inset 0 0 0 1px ${cm(ink, 22)}!important}`
    );
    return rules.join('\n');
  }

  const PERM_ICONS_CSS = buildPermIconsCss();

  const ga = (e, k) => e?.getAttribute?.(k);
  const sa = (e, k, v) => e?.setAttribute?.(k, String(v));
  const ha = (e, k) => Boolean(e?.hasAttribute?.(k));
  const ra = (e, k) => e?.removeAttribute?.(k);
  const qs = (e, s) => e?.querySelector?.(s) || null;
  const qa = (e, s) => e?.querySelectorAll?.(s) || [];

  // 仅识别英文宿主原文与已验证的 zh-CN / tr host-i18n 译文，未知值一律 Fail-Closed 返回空串
  function normPermPreset(raw) {
    // 剥离土耳其语大写 İ 经 toLowerCase() 产生的组合上点 U+0307，确保 'İnceleme İste' 正确匹配
    const s = String(raw || '').trim().toLowerCase().replace(/\u0307/g, '');
    if (!s) return '';
    if (/request[_ -]?review|请求审查|inceleme iste/.test(s)) return 'request_review';
    if (/\bturbo\b|极速/.test(s)) return 'turbo';
    if (/\bauto\b|\botomatik\b|自动/.test(s)) return 'auto';
    if (/\bdefault\b|\bvarsay[ıi]lan\b|默认/.test(s)) return 'default';
    return '';
  }

  // 从权限图标 SVG 向上回溯 React Fiber，读取宿主 eid 组件的 preset 属性（语言无关）
  function readFiberPreset(svgNode) {
    if (!svgNode) return '';
    try {
      const fk = Object.keys(svgNode).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      for (let d = 0, f = fk ? svgNode[fk] : null; d < 10 && f; d++, f = f.return) {
        const p = f.memoizedProps?.preset;
        if (typeof p === 'string' && p) {
          const norm = normPermPreset(p);
          if (norm) return norm;
        }
      }
    } catch {}
    return '';
  }

  // 预设解析链：data-testid 后缀 -> SVG React Fiber preset -> 模拟器 data-ag-perm-mode / aria-label / 文本兜底
  function readPermPreset(el) {
    if (!el) return '';
    const tid = ga(el, 'data-testid') || '';
    if (tid.startsWith('permissions-preset-option-')) return normPermPreset(tid.slice(26));
    const fromFiber = readFiberPreset(qs(el, 'svg'));
    if (fromFiber) return fromFiber;
    // permissions-use-global-settings 仅信 Fiber，避免描述文本误命中关键词
    if (tid === 'permissions-use-global-settings') return '';
    // data-ag-perm-mode 仅由本地模拟器 workbench/replica.js 输出，真实宿主走 aria-label / textContent 兜底
    return normPermPreset(ga(el, 'data-ag-perm-mode')) || normPermPreset(ga(el, 'aria-label')) || normPermPreset(el.textContent);
  }

  function ensureStyle(doc) {
    if (!doc || typeof doc.createElement !== 'function') return null;
    const existing = doc.getElementById?.(STYLE_ID);
    if (existing) return existing;
    const host = doc.head || doc.documentElement;
    if (!host || typeof host.appendChild !== 'function') return null;
    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = PERM_ICONS_CSS;
    host.appendChild(st);
    return st;
  }

  // 先读后写并交由调用方 runMut / setA 批处理，避免触发 DOM MutationObserver 自激
  function sync(doc, runMut, setA) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    const trigs = qa(doc, S_TRIG);
    const menus = qa(doc, S_MENU);
    const hasStyle = Boolean(doc.getElementById?.(STYLE_ID));
    if (hasStyle && !trigs.length && !menus.length) return;
    const run = typeof runMut === 'function' ? runMut : (fn) => fn();
    const put =
      typeof setA === 'function'
        ? setA
        : (el, k, v) => {
            if (el && ga(el, k) !== v) sa(el, k, v);
          };
    const tagPreset = (el, p) => {
      if (p) put(el, ATTR_PRESET, p);
      else if (ha(el, ATTR_PRESET)) ra(el, ATTR_PRESET);
    };
    run(() => {
      if (!hasStyle) ensureStyle(doc);
      for (const tr of trigs) tagPreset(tr, readPermPreset(tr));
      for (const menu of menus) {
        for (const o of qa(menu, S_OPT)) tagPreset(o, readPermPreset(o));
        const glob = qs(menu, S_GLOB);
        if (glob) tagPreset(glob, readPermPreset(glob));
      }
    });
  }

  function destroy(doc) {
    if (!doc) return;
    try { doc.getElementById?.(STYLE_ID)?.remove?.(); } catch {}
    try {
      for (const el of qa(doc, `[${ATTR_PRESET}]`)) ra(el, ATTR_PRESET);
    } catch {}
  }

  const api = {
    STYLE_ID,
    ATTR_PRESET,
    PERM_PRESET_PALETTE,
    PERM_ICONS_CSS,
    normPermPreset,
    readFiberPreset,
    readPermPreset,
    ensureStyle,
    sync,
    destroy,
  };
  G.__agPrismPermIcons = api;
  if (G.window && G.window !== G) G.window.__agPrismPermIcons = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
