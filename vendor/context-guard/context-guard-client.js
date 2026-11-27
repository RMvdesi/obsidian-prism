// Obsidian Prism Channel 17 — Context Auto-Compact, Reading Scroll Shield & /clear Clean Restart
// Default-off on-demand channel: 0 B when disabled, 0 HTML-sink writes, 0 prototype pollution, 9 locales.
(function (root, factory) {
  const api = factory(root);
  if (root) root.__agPrismContextGuardFactory = api;
  if (typeof window !== 'undefined' && window && window !== root) window.__agPrismContextGuardFactory = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';

  const OWNER_KEY = '__agSessionGuardOwner';
  const STANDALONE_KEY = '__agSessionGuard';
  const OWNER_TAG = 'obsidian-prism';
  const COMPACT_CMD = '/compact';
  const THRESHOLDS = Object.freeze(['off', '75', '80', '85', '90']);
  const AUTO_SEND_COOLDOWN_MS = 120000;
  const SCROLL_NAV_KEYS = new Set(['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' ']);
  const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const LOCALE_MAP = Object.freeze({
    'zh-cn': 0, 'zh-sg': 0, zh: 0, 'zh-tw': 1, 'zh-hk': 1, 'zh-mo': 1, 'zh-hant': 1,
    en: 2, ja: 3, ko: 4, es: 5, fr: 6, de: 7, tr: 8,
  });

  const COPY = Object.freeze({
    title: ['自动压缩', '自動壓縮', 'Auto-Compact', '自動圧縮', '자동 압축', 'Autocompactar', 'Auto-compaction', 'Auto-Kompakt', 'Oto Sikistir'],
    titleTip: [
      '达到阈值后空闲静默 /compact，并锁住阅读位置',
      '達到閾值後空閒靜默 /compact，並鎖住閱讀位置',
      'Silently runs /compact when idle without scrolling away',
      '閾値到達時に待機中で閲覧位置を保ち自動 /compact',
      '임계치 도달 시 유휴 상태에서 위치 고정 자동 /compact',
      'Ejecuta /compact en silencio sin mover tu lectura',
      'Lance /compact en silence sans deplacer votre lecture',
      'Lautloses /compact im Leerlauf ohne Wegscrollen',
      'Bosta iken okuma konumunu bozmadan sessiz /compact',
    ],
    off: ['关闭', '關閉', 'Off', 'オフ', '끄기', 'Apagado', 'Desactive', 'Aus', 'Kapali'],
    clearBtn: ['轻量重开', '輕量重開', 'Clean Restart', '軽量リスタート', '가볍게 재시작', 'Reinicio limpio', 'Reprise legere', 'Neustart', 'Temiz Baslat'],
    clearTip: [
      '带脱敏要点同项目开 0% 新会话（或敲 /clear）',
      '帶脫敏要點同專案開 0% 新會話（或敲 /clear）',
      'Fresh 0% same-project session with redacted brief (/clear)',
      '同プロジェクトで要約引継ぎ 0% 新規会話 (/clear)',
      '같은 프로젝트 민감정보 제거 요약 0% 새 대화 (/clear)',
      'Nueva sesion 0% en el mismo proyecto con resumen (/clear)',
      'Nouvelle session 0% meme projet avec resume (/clear)',
      'Neue 0%-Sitzung im selben Projekt mit Kurzfassung (/clear)',
      'Ayni projede temiz ozetle %0 yeni oturum (/clear)',
    ],
    briefHead: ['【轻量重开】', '【輕量重開】', '[Clean Restart]', '【軽量再開】', '[재시작 요약]', '[Reinicio]', '[Reprise]', '[Neustart]', '[Temiz Ozet]'],
    briefGoal: ['目标', '目標', 'Goal', '目標', '목표', 'Objetivo', 'Objectif', 'Ziel', 'Hedef'],
    briefLatest: ['进展', '進展', 'Latest', '最新', '최근', 'Ultimo', 'Dernier', 'Stand', 'Son'],
    briefNext: ['焦点', '焦點', 'Next', '焦点', '초점', 'Foco', 'Focus', 'Fokus', 'Odak'],
    briefTail: [
      '请直接继续。', '請直接繼續。', 'Continue directly.', 'そのまま続行してください。', '바로 이어서 진행해 주세요.',
      'Continua.', 'Continuez.', 'Bitte fortfahren.', 'Devam edin.',
    ],
  });

  const CARD_CSS = [
    '.ag-pcg-sec{grid-column:2;margin-top:8px;padding-top:8px;border-top:1px solid var(--d,rgba(148,163,184,.18));display:flex;flex-direction:column;gap:6px;font-family:var(--ui,system-ui,sans-serif);}',
    '.ag-pcg-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:1.2;color:var(--mu,#94a3b8);}',
    '.ag-pcg-lbl{font-weight:600;color:var(--f,#eef1f7);}',
    '.ag-pcg-clr{border:1px solid var(--d,rgba(148,163,184,.24));background:var(--ct,rgba(148,163,184,.1));color:var(--f,#eef1f7);border-radius:6px;padding:2px 7px;font-size:10.5px;font-weight:500;cursor:pointer;}',
    '.ag-pcg-clr:hover,.ag-pcg-btn:hover{border-color:var(--ac,#3186ff);color:var(--f,#eef1f7);}',
    '.ag-pcg-seg{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}',
    '.ag-pcg-btn{flex:1 1 auto;min-width:34px;border:1px solid var(--d,rgba(148,163,184,.22));background:var(--ct,rgba(148,163,184,.08));color:var(--mu,#94a3b8);border-radius:6px;padding:3px 6px;font-size:10.5px;font-weight:500;cursor:pointer;text-align:center;}',
    '.ag-pcg-btn[aria-pressed="true"]{background:var(--sl,rgba(49,134,255,.18));color:var(--f,#eef1f7);border-color:var(--ac,#3186ff);font-weight:600;}',
  ].join('\n');

  function resolveLocaleIdx(rawLang, doc, win) {
    const raw = String(
      (rawLang && rawLang !== 'auto' ? rawLang : '') ||
      doc?.documentElement?.getAttribute?.('data-ag-cs-lang') ||
      doc?.documentElement?.getAttribute?.('data-ag-prism-lang') ||
      win?.navigator?.language || 'en'
    ).trim().toLowerCase().replace(/_/g, '-');
    if (Object.prototype.hasOwnProperty.call(LOCALE_MAP, raw)) return LOCALE_MAP[raw];
    if (/^zh-(tw|hk|mo|hant)/.test(raw)) return 1;
    if (/^zh|^yue/.test(raw)) return 0;
    const base = raw.split('-')[0];
    return Object.prototype.hasOwnProperty.call(LOCALE_MAP, base) ? LOCALE_MAP[base] : 2;
  }

  const tCopy = (k, i) => (COPY[k] ? COPY[k][i] || COPY[k][2] || '' : '');
  const normalizeThreshold = (raw) => {
    const s = String(raw ?? '80').trim().toLowerCase();
    return THRESHOLDS.includes(s) ? s : '80';
  };

  function markNoTranslate(el) {
    if (!el || typeof el.setAttribute !== 'function') return el;
    el.setAttribute('data-ag-prism-cg-owned', '1');
    el.setAttribute('data-ag-no-i18n', '1');
    el.setAttribute('translate', 'no');
    el.setAttribute('data-no-translate', 'true');
    el.setAttribute('data-ag-localization-skip', 'true');
    el.setAttribute('data-antigravity-zh-skip', '1');
    return el;
  }

  function redactText(input) {
    return String(input || '')
      .replace(/```[\s\S]*?```/g, ' [code] ')
      .replace(/-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]+PRIVATE KEY-----/g, '[REDACTED_KEY]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
      .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{25,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_TOKEN]')
      .replace(/\s+/g, ' ').trim();
  }

  function parseClearCommand(raw) {
    const m = /^\/clear(?:\s+([\s\S]+))?$/i.exec(String(raw || '').replace(/\u200B/g, '').trim());
    if (!m) return null;
    const arg = String(m[1] || '').trim();
    if (!arg || arg.toLowerCase() === 'keep') return { mode: 'keep', focus: '' };
    if (/^(?:blank|empty|fresh)$/i.test(arg)) return { mode: 'blank', focus: '' };
    return { mode: 'keep', focus: arg.slice(0, 240) };
  }

  function findProtoDesc(obj, prop) {
    let cur = obj ? Object.getPrototypeOf(obj) : null;
    while (cur) {
      const d = Object.getOwnPropertyDescriptor(cur, prop);
      if (d) return d;
      cur = Object.getPrototypeOf(cur);
    }
    return null;
  }

  function isEditableTarget(t) {
    if (!t || typeof t !== 'object') return false;
    const tag = String(t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      Boolean(t.isContentEditable || t.getAttribute?.('contenteditable') === 'true' ||
      t.closest?.('[contenteditable="true"], [data-lexical-editor="true"]'));
  }

  function createContextGuardController(options = {}) {
    const win = options.win || G;
    const doc = options.doc || win?.document || null;
    const nowFn = typeof options.now === 'function' ? options.now : () => Date.now();
    const storage = options.storage !== undefined ? options.storage : (() => { try { return win?.sessionStorage || null; } catch { return null; } })();
    const PENDING_CLEAR_KEY = 'agPrism.pendingCleanRestart.v1';

    let cfg = {
      enabled: options.enabled !== undefined ? Boolean(options.enabled) : true,
      threshold: normalizeThreshold(options.compactThreshold ?? '80'),
      lang: String(options.lang || 'auto'),
    };
    let destroyed = false, blurred = false, pollTimer = null, silentTimer = null, clearFillTimer = null;
    const slashTimers = new Set();
    let activeShield = null, lastUserScrollAtMs = 0, lastSnapshot = null;
    let activeCardRoot = null, cardSectionEl = null, cardStyleEl = null, cardObserver = null;
    const listeners = [], sessionState = new Map(), canceledSessions = new Set();

    const getSess = (cid) => {
      const k = cid || 'default-session';
      let s = sessionState.get(k);
      if (!s) { s = { autoSentAtPct: null, lastAutoSentAtMs: 0, lastCompactedCount: 0, lowDropStreak: 0 }; sessionState.set(k, s); }
      return s;
    };

    try {
      if (win && cfg.enabled) {
        win[OWNER_KEY] = OWNER_TAG;
        if (typeof win[STANDALONE_KEY]?.destroy === 'function') win[STANDALONE_KEY].destroy();
      }
    } catch {}

    const addL = (target, ev, fn, opts) => {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(ev, fn, opts);
      listeners.push(() => target.removeEventListener?.(ev, fn, opts));
    };

    const isHibernated = () => Boolean(blurred || doc?.hidden || doc?.documentElement?.getAttribute?.('data-ag-cs-win-blur') === '1');
    const findConvView = () =>
      doc?.querySelector?.('[data-testid="conversation-view"][data-active="true"], [data-testid="conversation-view"][data-focused="true"]') ||
      doc?.querySelector?.('[data-testid="conversation-view"]') || null;

    const detectCascadeId = () => {
      try {
        const cv = findConvView();
        const cid = cv?.getAttribute?.('data-cascade-id') || cv?.closest?.('[data-cascade-id]')?.getAttribute?.('data-cascade-id') || '';
        if (cid && GUID_RE.test(cid.trim())) return cid.trim().toLowerCase();
        const m = String(win?.location?.pathname || '').match(/\/c\/([0-9a-f-]{36})/i);
        if (m && m[1]) return m[1].toLowerCase();
      } catch {}
      return 'default-session';
    };

    const isStreaming = () => Boolean(doc?.querySelector?.(
      '[data-testid="agent-input-box"] [data-testid="input-cancel-button"], [data-testid="agent-input-box"] [data-testid="stop-button"], [data-testid="stop-button"], [data-testid="cancel-button"]'
    ));

    const findComposer = () => {
      const box = doc?.querySelector?.('[data-testid="agent-input-box"], .surface-composer-card') || doc;
      return box?.querySelector?.('[data-lexical-editor="true"], [contenteditable="true"], textarea') || null;
    };

    const readDraft = () => {
      const ed = findComposer();
      if (!ed) return '';
      const tag = String(ed.tagName || '').toUpperCase();
      return String((tag === 'TEXTAREA' || tag === 'INPUT' ? ed.value : ed.textContent) || '').replace(/\u200B/g, '').trim();
    };

    const releaseShield = () => {
      if (activeShield) { try { activeShield.release(); } catch {} activeShield = null; }
    };

    const engageScrollShield = () => {
      releaseShield();
      const cv = findConvView();
      const vp = cv?.querySelector?.('[data-testid="autoscroll-viewport"]') || doc?.querySelector?.('[data-testid="autoscroll-viewport"]') || null;
      if (!vp || vp.isConnected === false) return { active: false, release() {} };

      const shieldMs = Number.isFinite(Number(options.scrollShieldMs)) ? Math.max(50, Number(options.scrollShieldMs)) : 2800;
      const maxMs = Number.isFinite(Number(options.scrollShieldMaxMs)) ? Math.max(shieldMs, Number(options.scrollShieldMaxMs)) : 14000;
      const startCid = lastSnapshot?.cascadeId || detectCascadeId();
      const hadOwnTop = Object.prototype.hasOwnProperty.call(vp, 'scrollTop');
      const ownTopDesc = hadOwnTop ? Object.getOwnPropertyDescriptor(vp, 'scrollTop') : null;
      const protoTopDesc = findProtoDesc(vp, 'scrollTop');

      let getRawTop, setRawTop;
      if (protoTopDesc?.get && protoTopDesc?.set) {
        getRawTop = () => Number(protoTopDesc.get.call(vp)) || 0;
        setRawTop = (v) => { try { protoTopDesc.set.call(vp, v); } catch {} };
      } else if (ownTopDesc?.get && ownTopDesc?.set) {
        getRawTop = () => Number(ownTopDesc.get.call(vp)) || 0;
        setRawTop = (v) => { try { ownTopDesc.set.call(vp, v); } catch {} };
      } else {
        let rawTop = Number(vp.scrollTop) || 0;
        getRawTop = () => rawTop;
        setRawTop = (v) => { rawTop = Math.max(0, Number(v) || 0); };
      }

      let pinnedTop = getRawTop(), intentUntil = 0, lastDeltaY = 0, dragging = false, released = false, sawStream = false, relTimer = null;
      let topOverridden = false;
      const startedAt = nowFn(), sListeners = [], overridden = [];
      const isIntent = () => dragging || nowFn() <= intentUntil;
      const markIntent = (ms = 400) => { intentUntil = Math.max(intentUntil, nowFn() + ms); };
      const handle = { active: true, release: () => {} };

      const release = () => {
        if (released) return;
        released = true;
        handle.active = false;
        if (relTimer) { clearTimeout(relTimer); relTimer = null; }
        while (sListeners.length) { try { sListeners.pop()(); } catch {} }
        if (topOverridden) {
          try {
            if (!hadOwnTop) delete vp.scrollTop;
            else if (ownTopDesc) Object.defineProperty(vp, 'scrollTop', 'value' in ownTopDesc ? { ...ownTopDesc, value: getRawTop() } : ownTopDesc);
          } catch {}
          topOverridden = false;
        }
        while (overridden.length) {
          const it = overridden.pop();
          try {
            if (!it.hadOwn) delete vp[it.name];
            else if (it.prevDesc) Object.defineProperty(vp, it.name, it.prevDesc);
          } catch {}
        }
        if (activeShield === handle) activeShield = null;
      };
      handle.release = release;

      try {
        if (!hadOwnTop || ownTopDesc?.configurable !== false) {
          Object.defineProperty(vp, 'scrollTop', { configurable: true, enumerable: Boolean(ownTopDesc?.enumerable), get: () => getRawTop(), set: () => {} });
          topOverridden = true;
        }
      } catch {}
      for (const name of ['scrollTo', 'scroll', 'scrollBy']) {
        try {
          const hadOwn = Object.prototype.hasOwnProperty.call(vp, name);
          const prevDesc = hadOwn ? Object.getOwnPropertyDescriptor(vp, name) : null;
          if (!hadOwn || prevDesc?.configurable !== false) {
            Object.defineProperty(vp, name, { configurable: true, writable: true, enumerable: Boolean(prevDesc?.enumerable), value: () => {} });
            overridden.push({ name, hadOwn, prevDesc });
          }
        } catch {}
      }

      const addSL = (t, ev, fn, o) => { if (t?.addEventListener) { t.addEventListener(ev, fn, o); sListeners.push(() => t.removeEventListener?.(ev, fn, o)); } };
      const onWheel = (ev) => { lastDeltaY = Number(ev?.deltaY) || 0; lastUserScrollAtMs = nowFn(); markIntent(420); };
      addSL(vp, 'wheel', onWheel, { passive: true, capture: true });
      addSL(doc, 'wheel', onWheel, { passive: true, capture: true });
      addSL(vp, 'touchstart', () => { lastDeltaY = 0; lastUserScrollAtMs = nowFn(); markIntent(480); }, { passive: true });
      addSL(vp, 'touchmove', () => { lastDeltaY = 0; lastUserScrollAtMs = nowFn(); markIntent(480); }, { passive: true });
      addSL(doc, 'pointerdown', (ev) => {
        if (ev?.target?.closest?.('[data-testid="conversation-row-sidebar"]')) { release(); return; }
        const btn = ev?.target?.closest?.('button');
        if (btn && /scroll.?to.?bottom|滚动到底部|回到最新/i.test(`${btn.getAttribute?.('aria-label') || ''} ${btn.getAttribute?.('data-testid') || ''} ${btn.textContent || ''}`)) {
          release(); return;
        }
        if (ev?.target === vp || vp.contains?.(ev?.target)) { dragging = true; markIntent(450); }
      }, true);
      addSL(doc, 'pointermove', (ev) => { if (dragging && (ev?.buttons === undefined || ev.buttons > 0)) markIntent(350); }, true);
      addSL(doc, 'pointerup', () => { if (dragging) { dragging = false; markIntent(220); } }, true);
      addSL(doc, 'pointercancel', () => { dragging = false; }, true);
      addSL(doc, 'keydown', (ev) => {
        if (!ev || !SCROLL_NAV_KEYS.has(ev.key) || isEditableTarget(ev.target)) return;
        lastDeltaY = ev.key === 'ArrowUp' || ev.key === 'PageUp' || ev.key === 'Home' ? -1 : 1;
        lastUserScrollAtMs = nowFn();
        markIntent(380);
      }, true);
      addSL(vp, 'scroll', () => {
        if (released || destroyed) return;
        const curTop = getRawTop();
        if ((!isIntent() || (lastDeltaY < 0 && curTop - pinnedTop > 260)) && Math.abs(curTop - pinnedTop) > 1) {
          setRawTop(pinnedTop);
          return;
        }
        pinnedTop = curTop;
        if (isIntent() && lastDeltaY > 0 && (Number(vp.scrollHeight) || 0) - (Number(vp.clientHeight) || 0) - curTop <= 24) release();
      }, false);

      const scheduleCheck = (ms) => {
        if (released || destroyed) return;
        relTimer = setTimeout(() => {
          relTimer = null;
          if (released || destroyed || vp.isConnected === false) { release(); return; }
          const curCid = detectCascadeId();
          if (startCid !== 'default-session' && curCid !== 'default-session' && curCid !== startCid) { release(); return; }
          const elapsed = nowFn() - startedAt;
          const stNow = isStreaming();
          if (stNow) sawStream = true;
          if (elapsed < maxMs && stNow) { scheduleCheck(Math.min(600, maxMs - elapsed)); return; }
          if (sawStream && elapsed < maxMs) { sawStream = false; scheduleCheck(Math.min(900, maxMs - elapsed)); return; }
          release();
        }, ms);
        relTimer?.unref?.();
      };
      scheduleCheck(shieldMs);
      activeShield = handle;
      return handle;
    };

    const writeComposer = (text, { allowEmptyOnly = true } = {}) => {
      if (allowEmptyOnly && readDraft().length > 0) return { ok: false, reason: 'draft-present' };
      const ed = findComposer();
      if (!ed) return { ok: false, reason: 'no-editor' };
      try {
        try { ed.focus?.({ preventScroll: true }); } catch { ed.focus?.(); }
        const tag = String(ed.tagName || '').toUpperCase();
        if (tag === 'TEXTAREA' || tag === 'INPUT') {
          ed.value = text;
          ed.dispatchEvent?.(new (win.Event || Event)('input', { bubbles: true }));
        } else {
          try {
            const sel = win?.getSelection?.() || doc?.getSelection?.();
            if (sel?.removeAllRanges && doc?.createRange) {
              const r = doc.createRange();
              r.selectNodeContents(ed);
              r.collapse(false);
              sel.removeAllRanges();
              sel.addRange(r);
            }
          } catch {}
          if (!(typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text))) {
            ed.textContent = text;
            ed.dispatchEvent?.(new (win.Event || Event)('input', { bubbles: true }));
          }
        }
        return { ok: true, editor: ed };
      } catch {
        return { ok: false, reason: 'insert-failed' };
      }
    };

    const findSlashCompactTarget = () => {
      const opts = Array.from(doc?.querySelectorAll?.('[id^="typeahead-item-"][role="option"], [role="option"], [data-testid*="command-item"]') || []);
      for (const el of opts) {
        if (!el || el.getAttribute?.('aria-disabled') === 'true' || el.querySelector?.('[data-testid="menu-category-row"], [aria-disabled="true"]')) continue;
        const id = String(el.getAttribute?.('id') || ''), tid = String(el.getAttribute?.('data-testid') || '').toLowerCase();
        if (!(id.startsWith('typeahead-item-') || tid.includes('command-item') || el.closest?.('[role="listbox"], [data-testid*="slash"], [data-testid*="typeahead"]'))) continue;
        const lbl = el.querySelector?.('[data-testid="menu-option-label"]');
        if (lbl) {
          const lv = String(lbl.textContent || '').trim().toLowerCase();
          if (lv === 'compact' || lv === '/compact') return { opt: el, clickTarget: lbl };
          continue;
        }
        if (/(?:^|\s)\/compact(?:\s|$)|^compact(?:\s|$)/.test(String(el.textContent || el.getAttribute?.('data-value') || '').trim().toLowerCase())) {
          return { opt: el, clickTarget: el };
        }
      }
      return null;
    };

    const clickSendBtn = (ed) => {
      const sels = ['[data-testid="input-send-button"]', '[data-testid="send-button"]', 'button[aria-label*="Send" i]', 'button[type="submit"]'];
      const inSide = (n) => Boolean(n?.closest?.('[data-side-panel-focus-scope="true"], [data-testid="side-question-panel"]'));
      const box = ed?.closest?.('[data-testid="agent-input-box"], .surface-composer-card') || null;
      for (const sc of [box, doc].filter(Boolean)) {
        for (const sel of sels) {
          const btn = Array.from(sc.querySelectorAll?.(sel) || []).find(
            (b) => b && !inSide(b) && !b.disabled && !b.hasAttribute?.('disabled') && b.getAttribute?.('aria-disabled') !== 'true' && typeof b.click === 'function'
          );
          if (btn) { btn.click(); return true; }
        }
      }
      return false;
    };

    const scheduleSlash = (fn, ms) => {
      const t = setTimeout(() => { slashTimers.delete(t); if (!destroyed) fn(); }, ms);
      t?.unref?.();
      slashTimers.add(t);
    };

    const triggerSilentCompact = () => {
      if (destroyed || !cfg.enabled || isStreaming() || readDraft().length > 0) return { ok: false };
      const edPrev = findComposer(), prevAct = doc?.activeElement || null;
      const inEd = Boolean(prevAct && edPrev && (prevAct === edPrev || edPrev.contains?.(prevAct)));
      const restoreFocus = (ed) => {
        if (inEd) return;
        try { ed?.blur?.(); } catch {}
        if (prevAct && prevAct !== doc?.body && prevAct !== doc?.documentElement && prevAct.isConnected !== false) {
          try { prevAct.focus?.({ preventScroll: true }); } catch {}
        }
      };
      const shield = engageScrollShield(), wr = writeComposer(COMPACT_CMD, { allowEmptyOnly: true });
      if (!wr.ok) { shield.release(); return wr; }
      const startCid = lastSnapshot?.cascadeId || detectCascadeId(), sess = getSess(startCid);
      sess.autoSentAtPct = lastSnapshot?.usedPct ?? (Number(cfg.threshold) || 80);
      sess.lastAutoSentAtMs = nowFn();
      if (typeof options.onSubmitCompact === 'function') {
        options.onSubmitCompact({ command: COMPACT_CMD, cascadeId: startCid });
        restoreFocus(wr.editor);
        return { ok: true, submitted: true };
      }
      const isLex = Boolean(wr.editor?.getAttribute?.('data-lexical-editor') === 'true' || wr.editor?.getAttribute?.('contenteditable') === 'true');
      if (!isLex) { clickSendBtn(wr.editor); restoreFocus(wr.editor); return { ok: true, submitted: true }; }
      const pollMs = Number.isFinite(Number(options.slashPollMs)) ? Math.max(5, Number(options.slashPollMs)) : 45;
      const delayMs = Number.isFinite(Number(options.slashSubmitDelayMs)) ? Math.max(0, Number(options.slashSubmitDelayMs)) : 50;
      const sameSess = () => !destroyed && wr.editor?.isConnected !== false && !(startCid !== 'default-session' && detectCascadeId() !== 'default-session' && detectCascadeId() !== startCid);
      const pick = (t) => {
        try { t.clickTarget.click(); } catch {}
        const fin = () => { if (!sameSess()) { shield.release(); return; } clickSendBtn(wr.editor); restoreFocus(wr.editor); };
        if (delayMs === 0) fin(); else scheduleSlash(fin, delayMs);
      };
      const imm = findSlashCompactTarget();
      if (imm) { pick(imm); return { ok: true, submitted: true }; }
      let tries = 0;
      const poll = () => {
        if (!sameSess()) { shield.release(); return; }
        const hit = findSlashCompactTarget();
        if (hit) { pick(hit); return; }
        if (++tries < 8) scheduleSlash(poll, pollMs); else { restoreFocus(wr.editor); shield.release(); }
      };
      scheduleSlash(poll, pollMs);
      return { ok: true, pendingSlashOption: true };
    };

    const buildCleanBrief = (focusText = '') => {
      const idx = resolveLocaleIdx(cfg.lang, doc, win), cv = findConvView() || doc;
      const uNodes = Array.from(cv?.querySelectorAll?.('[data-testid="user-message-bubble"]') || []);
      const aNodes = Array.from(cv?.querySelectorAll?.('[data-testid="planner-response-text"], [data-testid="agent-response"]') || []);
      const g = redactText(uNodes[0]?.textContent || '').slice(0, 260);
      const lu = uNodes.length > 1 ? redactText(uNodes[uNodes.length - 1]?.textContent || '').slice(0, 220) : '';
      const la = redactText(aNodes[aNodes.length - 1]?.textContent || '').slice(0, 380);
      const lines = [tCopy('briefHead', idx)];
      if (g) lines.push(`- ${tCopy('briefGoal', idx)}: ${g}`);
      if (lu) lines.push(`- ${tCopy('briefLatest', idx)}: ${lu}`);
      if (la) lines.push(`- ${tCopy('briefLatest', idx)}: ${la}`);
      if (focusText) lines.push(`- ${tCopy('briefNext', idx)}: ${redactText(focusText).slice(0, 220)}`);
      lines.push('', tCopy('briefTail', idx));
      return lines.join('\n').slice(0, 1200);
    };

    const findSameProjectNewLink = () => {
      try {
        const pm = /[?&]project=([^&#]+)/.exec(String(win?.location?.search || '')), pid = pm ? decodeURIComponent(pm[1]) : '';
        const links = Array.from(doc?.querySelectorAll?.('a[href]') || []);
        if (pid) {
          const ex = links.find((a) => { const h = String(a.getAttribute?.('href') || ''); return h === `/?project=${pid}` || h.endsWith(`/?project=${pid}`); });
          if (ex) return ex;
        }
        return links.find((a) => String(a.getAttribute?.('href') || '') === '/') || null;
      } catch { return null; }
    };

    const consumePendingBrief = () => {
      if (!storage || destroyed) return false;
      try {
        const raw = storage.getItem(PENDING_CLEAR_KEY);
        if (!raw) return false;
        const p = JSON.parse(raw);
        if (!p?.prompt || nowFn() - Number(p.at || 0) > 30000) { storage.removeItem(PENDING_CLEAR_KEY); return false; }
        if (p.fromCid && p.fromCid !== 'default-session' && detectCascadeId() === p.fromCid) return false;
        if (!findComposer() || readDraft().length > 0) return false;
        if (writeComposer(p.prompt, { allowEmptyOnly: true }).ok) { storage.removeItem(PENDING_CLEAR_KEY); return true; }
      } catch {}
      return false;
    };

    const triggerCleanRestart = ({ mode = 'keep', focus = '' } = {}) => {
      if (destroyed || !cfg.enabled) return { ok: false };
      const fromCid = detectCascadeId(), prompt = mode === 'blank' ? '' : buildCleanBrief(focus);
      if (prompt && storage) { try { storage.setItem(PENDING_CLEAR_KEY, JSON.stringify({ fromCid, prompt, at: nowFn() })); } catch {} }
      if (typeof options.onNavigateNewConversation === 'function') options.onNavigateNewConversation({ fromCid, mode, prompt });
      else {
        const link = findSameProjectNewLink();
        if (link?.click) link.click(); else return { ok: false, reason: 'no-new-conv-link', prompt };
      }
      if (prompt) {
        if (clearFillTimer) clearTimeout(clearFillTimer);
        let tries = 0;
        const retry = () => { clearFillTimer = null; if (!destroyed && !consumePendingBrief() && ++tries < 12) { clearFillTimer = setTimeout(retry, 350); clearFillTimer?.unref?.(); } };
        clearFillTimer = setTimeout(retry, 400); clearFillTimer?.unref?.();
      }
      return { ok: true, mode, prompt };
    };

    const detachCardSection = () => {
      try { cardSectionEl?.remove?.(); } catch {}
      try { cardStyleEl?.remove?.(); } catch {}
      cardSectionEl = cardStyleEl = activeCardRoot = null;
    };

    const persistThreshold = (nextVal) => {
      const norm = normalizeThreshold(nextVal);
      cfg.threshold = norm;
      try { win?.__agPrismSetting?.('compactThreshold', norm); } catch {}
      try { const st = (win?.__agPrism || G?.__agPrism)?.getState?.(); if (st?.cfg) st.cfg.compactThreshold = norm; } catch {}
      renderCardSection();
      void evaluateNow();
    };

    const renderCardSection = () => {
      if (destroyed || !cfg.enabled || !doc) { detachCardSection(); return false; }
      const host = doc.getElementById?.('ag-prism-pulse-bar') || doc.querySelector?.('[data-ag-prism-pulse-bar="true"], #ag-pulse-status-bar, [data-ag-pulse-bar="true"]');
      const sr = host?.shadowRoot || null, card = sr?.getElementById?.('context-card') || sr?.querySelector?.('#context-card') || null;
      if (!sr || !card) return false;
      const idx = resolveLocaleIdx(cfg.lang, doc, win);
      if (activeCardRoot !== sr || !cardStyleEl || cardStyleEl.isConnected === false) {
        detachCardSection(); activeCardRoot = sr;
        cardStyleEl = markNoTranslate(doc.createElement('style'));
        cardStyleEl.textContent = CARD_CSS;
        sr.appendChild(cardStyleEl);
      }
      if (!cardSectionEl || cardSectionEl.parentNode !== card) {
        const sec = markNoTranslate(doc.createElement('section')), hd = doc.createElement('div'), lbl = doc.createElement('span'), clrBtn = doc.createElement('button'), seg = doc.createElement('div');
        sec.className = 'ag-pcg-sec'; sec.setAttribute('data-testid', 'ag-prism-context-guard-sec');
        hd.className = 'ag-pcg-hd'; lbl.className = 'ag-pcg-lbl';
        clrBtn.type = 'button'; clrBtn.className = 'ag-pcg-clr'; clrBtn.setAttribute('data-ag-pcg-act', 'clear');
        clrBtn.addEventListener('click', (ev) => { ev?.preventDefault?.(); ev?.stopPropagation?.(); triggerCleanRestart({ mode: 'keep' }); });
        hd.appendChild(lbl); hd.appendChild(clrBtn); seg.className = 'ag-pcg-seg';
        for (const val of THRESHOLDS) {
          const b = doc.createElement('button');
          b.type = 'button'; b.className = 'ag-pcg-btn'; b.setAttribute('data-ag-pcg-th', val);
          b.addEventListener('click', (ev) => { ev?.preventDefault?.(); ev?.stopPropagation?.(); persistThreshold(val); });
          seg.appendChild(b);
        }
        sec.appendChild(hd); sec.appendChild(seg);
        const note = sr.getElementById?.('context-note') || sr.querySelector?.('#context-note');
        if (note && note.parentNode === card) card.insertBefore(sec, note); else card.appendChild(sec);
        cardSectionEl = sec;
      }
      const lblEl = cardSectionEl.querySelector?.('.ag-pcg-lbl'), clrEl = cardSectionEl.querySelector?.('.ag-pcg-clr');
      if (lblEl) { lblEl.textContent = tCopy('title', idx); lblEl.title = tCopy('titleTip', idx); }
      if (clrEl) { clrEl.textContent = tCopy('clearBtn', idx); clrEl.title = tCopy('clearTip', idx); }
      for (const b of cardSectionEl.querySelectorAll?.('button[data-ag-pcg-th]') || []) {
        const v = b.getAttribute('data-ag-pcg-th');
        b.textContent = v === 'off' ? tCopy('off', idx) : `${v}%`;
        b.setAttribute('aria-pressed', String(cfg.threshold === v));
      }
      return true;
    };

    const sampleSnapshot = async () => {
      const cid = detectCascadeId(), streaming = isStreaming(), draft = readDraft();
      if (typeof options.getContextSnapshot === 'function') {
        const c = await options.getContextSnapshot({ cascadeId: cid });
        if (c && Number.isFinite(c.usedFraction)) {
          return { cascadeId: c.cascadeId || cid, usedPct: Math.round(Math.max(0, c.usedFraction) * 100), compactedCount: Number(c.compactedCount) || 0, streaming: c.streaming !== undefined ? Boolean(c.streaming) : streaming, draft: c.draft !== undefined ? String(c.draft) : draft };
        }
      }
      const bridge = win?.__agPrismMetricsBridge;
      if (bridge && typeof bridge.getMetrics === 'function') {
        try {
          const payload = await Promise.race([Promise.resolve(bridge.getMetrics({ conversationId: cid, force: false })), new Promise((r) => setTimeout(() => r(null), 1500))]);
          const pCid = String(payload?.conversationId || payload?.cascadeId || payload?.speed?.conversationId || '').trim().toLowerCase();
          const frac = payload?.speed?.context?.usedFraction ?? payload?.context?.usedFraction;
          if ((!pCid || !GUID_RE.test(cid) || pCid === cid) && Number.isFinite(frac)) {
            const comp = payload?.compactedAtStepIndices || payload?.speed?.compactedAtStepIndices;
            return { cascadeId: cid, usedPct: Math.round(Math.max(0, frac) * 100), compactedCount: Array.isArray(comp) ? comp.length : 0, streaming, draft };
          }
        } catch {}
      }
      const host = doc?.getElementById?.('ag-prism-pulse-bar') || doc?.querySelector?.('[data-ag-prism-pulse-bar="true"], #ag-pulse-status-bar');
      const pm = /(\d+(?:\.\d+)?)\s*%/.exec(host?.shadowRoot?.getElementById?.('context-percent')?.textContent || '');
      return pm ? { cascadeId: cid, usedPct: Math.round(Number(pm[1])), compactedCount: 0, streaming, draft } : null;
    };

    const stopSilent = () => { if (silentTimer) { clearTimeout(silentTimer); silentTimer = null; } };

    const evaluateNow = async () => {
      if (destroyed || !cfg.enabled || isHibernated()) return lastSnapshot;
      renderCardSection();
      consumePendingBrief();
      const snap = await sampleSnapshot();
      const prevCid = lastSnapshot?.cascadeId || '';
      lastSnapshot = snap;
      if (activeShield && prevCid && snap?.cascadeId && snap.cascadeId !== prevCid) releaseShield();
      if (!snap || cfg.threshold === 'off') { stopSilent(); return snap; }

      const th = Number(cfg.threshold), sess = getSess(snap.cascadeId);
      const isLow = snap.usedPct <= th - 10;
      sess.lowDropStreak = isLow ? sess.lowDropStreak + 1 : 0;
      if (snap.compactedCount > sess.lastCompactedCount || (isLow && sess.lowDropStreak >= 2)) {
        sess.lastCompactedCount = Math.max(sess.lastCompactedCount, snap.compactedCount);
        sess.autoSentAtPct = null;
        sess.lowDropStreak = 0;
        canceledSessions.delete(snap.cascadeId);
      }

      const inCooldown = Boolean(sess.lastAutoSentAtMs && nowFn() - sess.lastAutoSentAtMs < AUTO_SEND_COOLDOWN_MS);
      if (snap.streaming || snap.draft || snap.usedPct < th || sess.autoSentAtPct !== null || inCooldown || canceledSessions.has(snap.cascadeId)) {
        stopSilent();
        return snap;
      }
      if (silentTimer) return snap;

      const delayMs = Number.isFinite(Number(options.silentIdleDelayMs)) ? Math.max(0, Number(options.silentIdleDelayMs)) : 450;
      const settleMs = Number.isFinite(Number(options.scrollSettleMs)) ? Math.max(0, Number(options.scrollSettleMs)) : (options.silentIdleDelayMs === 0 ? 0 : 800);
      const targetCid = snap.cascadeId;

      const fire = () => {
        silentTimer = null;
        if (destroyed || !cfg.enabled || isHibernated() || isStreaming()) return;
        if (readDraft().length > 0) { canceledSessions.add(targetCid); return; }
        const curCid = lastSnapshot?.cascadeId || detectCascadeId();
        if (targetCid && curCid && targetCid !== curCid) return;
        if (settleMs > 0 && lastUserScrollAtMs > 0) {
          const since = nowFn() - lastUserScrollAtMs;
          if (since >= 0 && since < settleMs) { silentTimer = setTimeout(fire, Math.max(25, settleMs - since + 40)); silentTimer?.unref?.(); return; }
        }
        triggerSilentCompact();
      };
      const sinceInit = lastUserScrollAtMs > 0 ? nowFn() - lastUserScrollAtMs : Infinity;
      const effDelay = Math.max(delayMs, settleMs > 0 && sinceInit >= 0 && sinceInit < settleMs ? settleMs - sinceInit + 40 : 0);
      if (effDelay === 0) fire();
      else { silentTimer = setTimeout(fire, effDelay); silentTimer?.unref?.(); }
      return snap;
    };

    const onScrollAct = () => { if (!destroyed) lastUserScrollAtMs = nowFn(); };
    addL(doc, 'wheel', onScrollAct, { passive: true, capture: true });
    addL(doc, 'touchmove', onScrollAct, { passive: true, capture: true });
    addL(doc, 'keydown', (ev) => {
      if (destroyed || !cfg.enabled || !ev) return;
      if (SCROLL_NAV_KEYS.has(ev.key) && !isEditableTarget(ev.target)) { lastUserScrollAtMs = nowFn(); return; }
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.isComposing) {
        const ed = findComposer();
        if (ed && (ev.target === ed || ed.contains?.(ev.target))) {
          const parsed = parseClearCommand(readDraft());
          if (parsed) {
            ev.preventDefault?.(); ev.stopPropagation?.(); ev.stopImmediatePropagation?.();
            writeComposer('', { allowEmptyOnly: false });
            triggerCleanRestart(parsed);
          }
        }
      }
    }, true);
    addL(doc, 'input', (ev) => {
      if (!silentTimer) return;
      const ed = findComposer();
      if (ed && (ev?.target === ed || ed.contains?.(ev?.target)) && readDraft().length > 0) {
        stopSilent();
        const cid = lastSnapshot?.cascadeId || detectCascadeId();
        if (cid) canceledSessions.add(cid);
      }
    }, true);

    const stopPoll = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
    const startPoll = () => {
      stopPoll();
      if (destroyed || !cfg.enabled || options.autoPoll === false || isHibernated()) return;
      pollTimer = setInterval(() => {
        if (destroyed || !cfg.enabled || isHibernated()) { stopPoll(); stopSilent(); return; }
        void evaluateNow();
      }, Math.max(500, Number(options.pollIntervalMs) || 3000));
      pollTimer?.unref?.();
    };

    addL(win, 'blur', () => { blurred = true; stopPoll(); stopSilent(); });
    addL(win, 'focus', () => { blurred = false; void evaluateNow(); startPoll(); });
    addL(doc, 'visibilitychange', () => { if (doc?.hidden) { stopPoll(); stopSilent(); } else { blurred = false; void evaluateNow(); startPoll(); } });

    if (options.autoObserve !== false && typeof win?.MutationObserver === 'function' && doc?.body) {
      let queued = false;
      cardObserver = new win.MutationObserver(() => {
        if (destroyed || !cfg.enabled || isHibernated() || queued) return;
        queued = true;
        setTimeout(() => { queued = false; if (!destroyed && cfg.enabled && !isHibernated()) renderCardSection(); }, 120);
      });
      try { cardObserver.observe(doc.body, { childList: true, subtree: true }); } catch {}
    }

    const sync = (next = {}) => {
      if (destroyed) return;
      if (next.enabled !== undefined) cfg.enabled = Boolean(next.enabled);
      if (next.compactThreshold !== undefined) cfg.threshold = normalizeThreshold(next.compactThreshold);
      if (next.lang !== undefined) cfg.lang = String(next.lang || 'auto');
      if (!cfg.enabled) { stopPoll(); stopSilent(); releaseShield(); detachCardSection(); return; }
      renderCardSection();
      startPoll();
      if (options.autoPoll !== false) void evaluateNow();
    };

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      stopPoll(); stopSilent();
      if (clearFillTimer) { clearTimeout(clearFillTimer); clearFillTimer = null; }
      for (const t of slashTimers) { try { clearTimeout(t); } catch {} }
      slashTimers.clear();
      releaseShield(); detachCardSection();
      try { cardObserver?.disconnect?.(); } catch {}
      cardObserver = null;
      while (listeners.length) { try { listeners.pop()(); } catch {} }
      sessionState.clear(); canceledSessions.clear();
      try { if (win && win[OWNER_KEY] === OWNER_TAG) delete win[OWNER_KEY]; } catch {}
    };

    const getDebugState = () => ({
      destroyed, enabled: cfg.enabled, threshold: cfg.threshold, lang: cfg.lang,
      cardMounted: Boolean(cardSectionEl && cardSectionEl.isConnected !== false),
      silentPending: Boolean(silentTimer),
      scrollShieldActive: Boolean(activeShield?.active),
      lastSnapshot: lastSnapshot ? { ...lastSnapshot } : null,
    });

    if (cfg.enabled) { renderCardSection(); startPoll(); if (options.autoPoll !== false) void evaluateNow(); }
    return { sync, evaluateNow, triggerSilentCompact, triggerCleanRestart, renderCardSection, getDebugState, destroy };
  }

  return { THRESHOLDS, COPY, parseClearCommand, redactText, createContextGuardController };
});
