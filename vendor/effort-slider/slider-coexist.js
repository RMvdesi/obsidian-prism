(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    try { root.__agPrismEffortSlider?.destroy?.(); } catch {}
    if (typeof window !== 'undefined' && window !== root) {
      try { window.__agPrismEffortSlider?.destroy?.(); } catch {}
    }
    const api = factory(root);
    root.__agPrismEffortSlider = api;
    if (typeof window !== 'undefined') window.__agPrismEffortSlider = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (globalRoot) {
  'use strict';

  const SLIDER_STYLE_ID = 'ag-codex-effort-slider-styles';
  const HIDE_STYLE_ID = 'ag-prism-effort-slider-hide';
  const PRISM_OWNER_ATTR = 'data-ag-prism-slider';
  const THROTTLE_MS = 120;
  const MENU_THROTTLE_MS = 32;

  const ga = (e, k) => e?.getAttribute?.(k), sa = (e, k, v) => e?.setAttribute?.(k, v), ra = (e, k) => e?.removeAttribute?.(k);
  const qs = (e, s) => e?.querySelector?.(s), qa = (e, s) => e?.querySelectorAll?.(s) || [];

  function resLib(win) {
    if (win?.AntigravityCodexEffortSlider) return win.AntigravityCodexEffortSlider;
    if (globalRoot?.AntigravityCodexEffortSlider) return globalRoot.AntigravityCodexEffortSlider;
    if (typeof require === 'function') {
      try {
        globalRoot.__agCodexEffortSliderDisableAutoBoot = true;
        if (win) win.__agCodexEffortSliderDisableAutoBoot = true;
        return require('./upstream-client.js');
      } catch {}
    }
    return null;
  }

  const isMenu = (doc) => Boolean(qs(doc, '[data-testid="model-selector-panel"], .ces-menu-section, [data-ces-effort-row="true"], [role="dialog"] [data-ces-settings]'));

  const IGNORED_CHAT_SEL =
    '[data-testid="autoscroll-viewport"],[data-testid="planner-response-text"],[data-testid="agent-response"],[data-markdown-root],[data-testid="user-message-bubble"],aside,[data-op-thought="1"],.ag-prism-thought-overlay,.ag-cs-crab,.ag-cs-conv-aura-host,#ag-pulse-status-bar,#ag-prism-pulse-bar,[data-ag-prism-pulse-bar="true"],.ag-cs-panel-row-glyph,[data-testid="orchestrator-effort-bar"],.ag-cs-smooth-caret,.ag-anim-icon,[data-agy-hans-ui],#agy-theme-switcher,#agy-theme-menu,#antigravity-quota-widget,#antigravity-translation-audit';

  const EFF_MAP = Object.create(null);
  for (const g of 'xhigh:xhigh|extra|超高|极高|特高|超高思考;high:high|高|高思考|高推理|高强度;medium:medium|med|中|中等|中思考|中等思考|中推理;low:low|低|低思考|低推理;minimal:minimal|极低|最小|最低;max:max|最高|最大;off:off|关闭|关;auto:auto|自动;thinking:thinking|深度思考|思考中|思考'.split(';')) {
    const [k, vs] = g.split(':');
    for (const v of vs.split('|')) EFF_MAP[v] = k;
  }
  const EFF_LABELS = { off: 'Off', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra', max: 'Max', auto: 'Auto', thinking: 'Thinking' };
  const NO_TR_ATTRS = [['translate', 'no'], ['data-no-translate', 'true'], ['data-ag-localization-skip', 'true'], ['data-agy-no-translate', 'true'], ['data-antigravity-zh-skip', '1']];

  function normalizeEffortToken(raw) {
    const s = String(raw || '').trim().replace(/^[(\uff08]+|[)\uff09]+$/g, '').trim().replace(/\s+thinking$/i, '').toLowerCase();
    return EFF_MAP[s] || '';
  }

  function parseLocalizedModelLabel(raw) {
    const s = String(raw || '').trim().replace(/^(?:Select model|选择模型)\s*[:：]\s*/i, '').trim();
    if (!s) return null;
    const m = /^(.*?)\s*[\(\uff08]([^()\uff08\uff09]+)[\)\uff09]\s*$/.exec(s);
    const eff = m ? normalizeEffortToken(m[2]) : '';
    if (!m || !eff) return { base: s, rawBase: s, effort: '', effortLabel: '', canonicalLabel: s, isThinking: false };
    const rawBase = m[1].trim(), isThinking = eff === 'thinking', effortLabel = EFF_LABELS[eff] || m[2].trim();
    return { base: isThinking ? `${rawBase} (Thinking)` : rawBase, rawBase, effort: eff, effortLabel, canonicalLabel: `${rawBase} (${effortLabel})`, isThinking };
  }

  function markOwnedNoTr(doc) {
    for (const el of qa(doc, '.ces-ag-section, .ces-set')) {
      if (ga(el, 'data-antigravity-zh-skip') === '1') continue;
      for (const [k, v] of NO_TR_ATTRS) sa(el, k, v);
    }
  }

  function syncBilingualDom(doc) {
    const p = qs(doc, '[data-testid="model-selector-panel"]');
    if (!p) return;
    for (const g of qa(p, '[data-testid="model-selector-effort-group"]')) {
      if (!ga(g, 'data-model-base')) {
        const pr = parseLocalizedModelLabel(g.textContent);
        if (pr?.rawBase && pr.effort && !pr.isThinking) sa(g, 'data-model-base', pr.rawBase);
      }
      const sib = g.nextElementSibling;
      if (sib?.tagName === 'SPAN') {
        const ek = normalizeEffortToken(sib.textContent);
        if (ek && EFF_LABELS[ek] && sib.textContent.trim() !== EFF_LABELS[ek]) sa(sib, 'data-ces-eff-key', ek);
      }
    }
    for (const it of qa(p, '[data-testid="model-selector-item"]')) {
      if (!ga(it, 'data-model-label')) {
        const pr = parseLocalizedModelLabel(it.textContent);
        if (pr?.effort) sa(it, 'data-model-label', pr.canonicalLabel);
      }
    }
  }

  function isIgnTarget(node) {
    if (!node) return false;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return false;
    if (el.classList?.contains?.('ag-prism-thought-chunk') || el.classList?.contains?.('ag-prism-thought-overlay')) return true;
    return typeof el.closest === 'function' ? Boolean(el.closest(IGNORED_CHAT_SEL)) : false;
  }

  function allIgn(records) {
    if (!Array.isArray(records) || records.length === 0) return false;
    for (let i = 0; i < records.length; i++) {
      const t = records[i] && records[i].target;
      if (!t || !isIgnTarget(t)) return false;
    }
    return true;
  }

  function touchesModel(records, doc, mOpen) {
    if (!Array.isArray(records) || records.length === 0) return true;
    if (typeof mOpen === 'boolean' ? mOpen : isMenu(doc)) return true;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i], t = rec && rec.target;
      if (t && isIgnTarget(t)) continue;
      const el = t && (t.nodeType === 1 ? t : t.parentElement);
      if (el && typeof el.getAttribute === 'function') {
        if ((el.getAttribute('data-testid') || '').includes('model-selector')) return true;
        if (el.closest?.('[data-testid="model-selector-trigger"], [data-testid="model-selector-panel"], [role="menu"], [role="listbox"]')) return true;
      }
      const added = rec && rec.addedNodes;
      if (added && added.length) {
        for (let j = 0; j < added.length; j++) {
          const n = added[j];
          if (!n || n.nodeType !== 1) continue;
          if ((n.getAttribute?.('data-testid') || '').includes('model-selector')) return true;
          const role = n.getAttribute?.('role') || '';
          if (role === 'menu' || role === 'listbox' || role === 'dialog') return true;
          if ((n.tagName === 'DIV' || n.tagName === 'BUTTON') && n.querySelector?.('[data-testid="model-selector-panel"], [data-testid="model-selector-trigger"]')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function mkThrottledMO(BaseMO, doc, stats) {
    if (typeof BaseMO !== 'function') return null;
    return function TMO(cb) {
      let tm = null, closeTm = null, lastAt = 0, q = [], disc = false, wasOpen = false, curTrig = null;
      const syncTrig = () => {
        if (disc) return;
        const tr = qs(doc, '[data-testid="model-selector-trigger"],button[aria-label^="Select model"]');
        if (!tr || tr === curTrig) return;
        curTrig = tr;
        try { inner.observe(tr, { characterData: true, subtree: true }); } catch {}
      };
      const flush = (fSync) => {
        tm = null;
        if (disc) return;
        const batch = q;
        q = [];
        const open = isMenu(doc), closed = wasOpen && !open;
        if (!Boolean(fSync || closed) && !touchesModel(batch, doc, open)) {
          wasOpen = open;
          stats.skippedIrrelevant += 1;
          return;
        }
        wasOpen = open;
        lastAt = Date.now();
        stats.executedScans += 1;
        syncBilingualDom(doc);
        cb(batch, wrap);
        markOwnedNoTr(doc);
        syncTrig();
        if (closed) {
          if (closeTm !== null) clearTimeout(closeTm);
          closeTm = setTimeout(() => { closeTm = null; if (!disc) flush(true); }, 48);
          closeTm?.unref?.();
        }
      };
      const inner = new BaseMO((recs) => {
        if (disc) return;
        stats.rawMutations += 1;
        if (allIgn(recs)) { stats.skippedIrrelevant += 1; return; }
        const open = isMenu(doc), closed = wasOpen && !open;
        if (!closed && !touchesModel(recs, doc, open)) { stats.skippedIrrelevant += 1; return; }
        if (Array.isArray(recs)) for (let i = 0; i < recs.length && q.length < 48; i++) q.push(recs[i]);
        const el = Date.now() - lastAt, wMs = open ? MENU_THROTTLE_MS : THROTTLE_MS;
        let subAdded = false;
        if (open && Array.isArray(recs)) {
          for (let ri = 0; ri < recs.length && !subAdded; ri++) {
            const an = recs[ri]?.addedNodes;
            if (!an) continue;
            for (let aj = 0; aj < an.length; aj++) {
              const nd = an[aj];
              const nr = nd && nd.nodeType === 1 ? nd.getAttribute?.('role') : '';
              if (
                nd &&
                nd.nodeType === 1 &&
                (nr === 'menu' ||
                  nr === 'listbox' ||
                  nd.classList?.contains('agy-overlay') ||
                  nd.querySelector?.('[role="menu"],[role="listbox"],[role^="menuitem"],[data-testid="context-menu-submenu-popup"],.agy-overlay'))
              ) {
                subAdded = true;
                break;
              }
            }
          }
        }
        if (closed || subAdded || (open && !wasOpen) || (el >= wMs && tm === null)) {
          if (tm !== null) { clearTimeout(tm); tm = null; }
          flush(closed);
        } else if (tm === null) {
          tm = setTimeout(() => flush(false), Math.max(16, wMs - el));
          tm?.unref?.();
        }
      });
      const wrap = {
        observe(t, o) {
          disc = false;
          const r = inner.observe(t, t === doc?.body && o?.characterData ? { ...o, characterData: false } : o);
          syncTrig();
          return r;
        },
        disconnect() {
          disc = true;
          if (tm !== null) { clearTimeout(tm); tm = null; }
          if (closeTm !== null) { clearTimeout(closeTm); closeTm = null; }
          curTrig = null;
          q = [];
          return inner.disconnect();
        },
        takeRecords: () => (typeof inner.takeRecords === 'function' ? inner.takeRecords() : []),
      };
      return wrap;
    };
  }

  function createEffortSliderController(envOpts) {
    const gW = () => (envOpts && envOpts.window) || (typeof window !== 'undefined' ? window : globalRoot);
    const gD = () => (envOpts && envOpts.document) || gW()?.document || null;
    let mode = 'auto', inst = null, yielded = false;
    const perfStats = { rawMutations: 0, executedScans: 0, skippedIrrelevant: 0 };

    function hasExtInst() {
      const w = gW(), d = gD();
      if (!w) return false;
      if (w.__agCodexEffortSliderInstance && !w.__agCodexEffortSliderInstance.__prismOwned) return true;
      const st = d?.getElementById?.(SLIDER_STYLE_ID);
      return Boolean(st && st.getAttribute(PRISM_OWNER_ATTR) !== '1' && !inst);
    }

    const HIDE_CSS_TEXT =
      '.ces-ag-section,.ces-menu-section,[data-ces-effort-row="true"],.ces-set,.ces-settings-panel{display:none!important}' +
      '[data-ces-part="trigger-effort"]{color:inherit!important;opacity:.7!important;font-weight:inherit!important}';

    function clrTint(doc) {
      for (const sp of qa(doc, '[data-ces-part="trigger-effort"], [data-testid="model-selector-trigger"] span[style]')) {
        if (sp.style) sp.style.color = sp.style.opacity = sp.style.fontWeight = '';
        ra(sp, 'data-ces-part');
      }
      for (const p of qa(doc, '.ces-ag-panel-enhanced')) p.classList?.remove?.('ces-ag-panel-enhanced');
      for (const it of qa(doc, '[data-ces-model-selected]')) ra(it, 'data-ces-model-selected');
    }

    function setHideCss(hidden) {
      const doc = gD();
      if (!doc || typeof doc.getElementById !== 'function') return;
      const ex = doc.getElementById(HIDE_STYLE_ID);
      if (!hidden) { ex?.remove?.(); return; }
      if (ex) { if (ex.textContent !== HIDE_CSS_TEXT) ex.textContent = HIDE_CSS_TEXT; return; }
      if (doc.head || doc.documentElement) {
        const st = doc.createElement('style');
        st.id = HIDE_STYLE_ID;
        st.textContent = HIDE_CSS_TEXT;
        (doc.head || doc.documentElement).appendChild(st);
      }
    }

    function stopInst() {
      const w = gW(), d = gD();
      if (inst) {
        try { inst.stop(); } catch {}
        if (w && w.__agCodexEffortSliderInstance === inst) delete w.__agCodexEffortSliderInstance;
        inst = null;
      }
      clrTint(d);
      const st = d?.getElementById?.(SLIDER_STYLE_ID);
      if (st && st.getAttribute(PRISM_OWNER_ATTR) === '1') st.remove();
    }

    function mountBuiltIn() {
      const w = gW(), d = gD();
      if (!w || !d || !d.body) return false;
      const lib = resLib(w);
      if (!lib || typeof lib.installCodexEffortSlider !== 'function') return false;
      const BaseMO = w.MutationObserver || (typeof MutationObserver === 'function' ? MutationObserver : null);
      const next = lib.installCodexEffortSlider({
        document: d,
        window: w,
        MutationObserver: mkThrottledMO(BaseMO, d, perfStats) || undefined,
        skipGenericMenuObserver: true,
      });
      if (!next) return false;
      next.__prismOwned = true;
      w.__agCodexEffortSliderInstance = prismSyncRef(next);
      d.getElementById?.(SLIDER_STYLE_ID)?.setAttribute(PRISM_OWNER_ATTR, '1');
      return true;
    }

    function prismSyncRef(v) {
      inst = v;
      return v;
    }

    function sync(cfg) {
      const raw = cfg && cfg.effortSliderModule;
      mode = raw === 'on' || raw === 'off' ? raw : 'auto';
      if (mode === 'off') {
        yielded = false;
        stopInst();
        clrTint(gD());
        setHideCss(true);
        return getState();
      }
      setHideCss(false);
      if (hasExtInst()) {
        yielded = true;
        stopInst();
        try { gW()?.__agCodexEffortSliderInstance?.rescan?.(); } catch {}
        return getState();
      }
      yielded = false;
      syncBilingualDom(gD());
      if (!inst) mountBuiltIn();
      else try { inst.rescan?.(); } catch {}
      markOwnedNoTr(gD());
      return getState();
    }

    function destroy() {
      stopInst();
      setHideCss(false);
      yielded = false;
    }

    function getState() {
      return {
        mode,
        mountedPrism: Boolean(inst),
        yieldedToExternal: Boolean(yielded || (mode !== 'off' && hasExtInst())),
        hasExternal: hasExtInst(),
        throttleMs: THROTTLE_MS,
        perfStats: { ...perfStats },
      };
    }

    return {
      THROTTLE_MS,
      normalizeEffortToken,
      parseLocalizedModelLabel,
      syncBilingualDom,
      sync,
      destroy,
      getState,
      createEffortSliderController,
    };
  }

  return createEffortSliderController();
});
