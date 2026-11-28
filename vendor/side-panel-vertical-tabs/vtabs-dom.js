// Obsidian Prism - Right Side Panel Vertical Tabs DOM Discovery, Anatomy, Mutations & Cleanup (vtabs-dom.js)
(function (G) {
  'use strict';

  function init(ns) {
    const {
      STYLE_ID, MAX_ANCESTOR_STEPS, SVG_NS, TOP_INSET_CLUSTER_SEL, ALL_MARK_ATTRS,
      VTABS_SWEEP_SEL, OWNED_NODE_SEL, OWNED_CLOSEST_SEL, CLOSE_HINT_RE, NON_CLOSE_BTN_RE,
      CLOSE_GLYPH_RE, ACTION_TID_RE, LABEL_HINT_RE, META_HINT_RE,
      CAT_BTW_RE, CAT_BTW_ICON_RE, CAT_BROWSER_RE, CAT_BROWSER_ICON_RE, CAT_DIFF_RE,
      CAT_DIFF_ICON_RE, CAT_TERM_RE, CAT_TERM_ICON_RE, CAT_DOC_RE, CAT_DOC_ICON_RE,
      CAT_PLUGIN_RE, CAT_PLUGIN_ICON_RE,
      isFn, ga, ha, sa, ra, qs, qa, tagU, isEl, clsOf, removeCssVar, markOwned, removeEl,
    } = ns;

    function isElVisible(el) {
      if (!isEl(el) || el.isConnected === false) return false;
      if (el.hidden === true || ha(el, 'hidden') || el.classList?.contains?.('hidden')) return false;
      if (String(el.style?.display || '').trim().toLowerCase() === 'none') return false;
      if (String(el.style?.visibility || '').trim().toLowerCase() === 'hidden') return false;
      return true;
    }

    function isTreeVisible(el, doc) {
      if (!isElVisible(el)) return false;
      const stop = doc?.documentElement || null;
      let cur = el.parentElement;
      for (let d = 0; cur && cur !== stop && d < 48; d++, cur = cur.parentElement) {
        if (!isElVisible(cur)) return false;
      }
      return true;
    }

    function isOwnNode(node) {
      if (!node) return false;
      const el = isEl(node) ? node : node.parentElement;
      if (!el) return false;
      if (ha(el, 'data-ag-owned') || el.id === STYLE_ID) return true;
      const cl = el.classList;
      if (
        cl?.contains?.('ag-cs-vtabs-head') || cl?.contains?.('ag-cs-vtabs-toggle') ||
        cl?.contains?.('ag-cs-vtabs-sash') || cl?.contains?.('ag-cs-vtabs-sash-line') ||
        cl?.contains?.('ag-cs-vtabs-glide-bar') || cl?.contains?.('ag-cs-vtabs-ord')
      ) return true;
      return Boolean(el.closest?.(OWNED_CLOSEST_SEL));
    }

    function getTabId(tab, closeBtn) {
      if (!tab) return '';
      const direct = String(ga(tab, 'data-tab-id') || '').trim();
      if (direct) return direct;
      const inner = qa(tab, '[data-tab-id]');
      for (let i = 0; i < inner.length; i++) {
        const n = inner[i];
        if (isOwnNode(n) || (closeBtn && (n === closeBtn || closeBtn.contains?.(n)))) continue;
        const v = String(ga(n, 'data-tab-id') || '').trim();
        if (v) return v;
      }
      return String(ga(tab, 'id') || '').trim();
    }

    function checkExplicitTabActiveAttr(el) {
      if (!el) return null;
      const ariaSel = ga(el, 'aria-selected');
      if (ariaSel === 'true') return true;
      if (ariaSel === 'false') return false;
      const dataActive = ga(el, 'data-active');
      if (dataActive === 'true') return true;
      if (dataActive === 'false') return false;
      const dataState = ga(el, 'data-state');
      if (dataState === 'active') return true;
      if (dataState === 'inactive') return false;
      return null;
    }

    function isTabActive(tab, stripActiveTabId, reduxActiveTabId, tabId, closeBtn) {
      if (!tab) return false;
      const ownExplicit = checkExplicitTabActiveAttr(tab);
      if (ownExplicit !== null) return ownExplicit;
      const roleTabs = qa(tab, '[role="tab"]');
      for (let i = 0; i < roleTabs.length; i++) {
        const rt = roleTabs[i];
        if (isOwnNode(rt) || (closeBtn && (rt === closeBtn || closeBtn.contains?.(rt)))) continue;
        const childExplicit = checkExplicitTabActiveAttr(rt);
        if (childExplicit !== null) return childExplicit;
      }
      const effTabId = tabId || getTabId(tab, closeBtn);
      if (effTabId && stripActiveTabId) return effTabId === stripActiveTabId;
      if (effTabId && reduxActiveTabId) return effTabId === reduxActiveTabId;
      const cls = clsOf(tab);
      const hasBgSec = Boolean(tab.classList?.contains?.('bg-secondary') || /(?:^|\s)bg-secondary(?:\s|$)/.test(cls));
      const hasBgTrans = Boolean(tab.classList?.contains?.('bg-transparent') || /(?:^|\s)bg-transparent(?:\s|$)/.test(cls));
      return hasBgSec && !hasBgTrans;
    }

    // @host-compat: mobile-layout / aux-drawer-popup / data-has-drawer-browser-hole yield
    function isMobileOrDrawerActive(doc, strip, body) {
      if (!doc) return false;
      if (ga(doc.body, 'data-has-drawer-browser-hole') === 'true') return true;
      const mobEls = qa(doc, '[data-testid="mobile-layout"]');
      for (let i = 0; i < mobEls.length; i++) if (isTreeVisible(mobEls[i], doc)) return true;
      const backdrops = qa(doc, '.aux-drawer-backdrop');
      for (let i = 0; i < backdrops.length; i++) if (isTreeVisible(backdrops[i], doc)) return true;
      if (strip?.closest?.('.aux-drawer-popup, [data-testid="mobile-layout"]')) return true;
      if (body?.closest?.('.aux-drawer-popup, [data-testid="mobile-layout"]')) return true;
      return false;
    }

    // @host-compat: reject shell / aux-pane-split / sidebar-split left / conversation-view
    function isForbiddenHost(cand, doc) {
      if (!isEl(cand) || cand === doc.body || cand === doc.documentElement) return true;
      if (cand.classList?.contains?.('agy-shell') || cand.classList?.contains?.('aux-drawer-popup')) return true;
      const tid = ga(cand, 'data-testid');
      if (tid === 'aux-pane-split' || tid === 'mobile-layout' || tid === 'sidebar-split' || tid === 'conversation-view') return true;
      if (cand.closest?.('aside, [data-testid="conversation-view"]')) return true;
      const sbSplit = cand.closest?.('[data-testid="sidebar-split"]');
      if (sbSplit) {
        const leftPane = sbSplit.firstElementChild || sbSplit.children?.[0] || null;
        if (leftPane && (cand === leftPane || leftPane.contains?.(cand))) return true;
      }
      return Boolean(qs(cand, '[data-testid="conversation-view"], [data-testid="sidebar-split"]'));
    }

    function resolveBranchSlot(ancestor, descendant, maxSteps) {
      let cur = descendant;
      const chain = [];
      for (let steps = 1; cur && cur.parentElement && steps <= maxSteps; steps++) {
        if (cur.parentElement === ancestor) return { slot: cur, steps, wraps: chain };
        if (cur !== descendant) chain.push(cur);
        cur = cur.parentElement;
      }
      return null;
    }

    // @host-compat: native tab selectors .agy-aux-tab / [role="tab"]
    function findNativeTabs(strip) {
      if (!strip) return [];
      const raw = qa(strip, '.agy-aux-tab, [role="tab"]');
      if (!raw.length) return [];
      const valid = [];
      const validSet = new Set();
      for (let i = 0; i < raw.length; i++) {
        const el = raw[i];
        if (!isElVisible(el) || isOwnNode(el)) continue;
        valid.push(el);
        validSet.add(el);
      }
      if (valid.length <= 1) return valid;
      return valid.filter((el) => {
        for (let p = el.parentElement; p && p !== strip; p = p.parentElement) {
          if (validSet.has(p)) return false;
        }
        return true;
      });
    }

    // @host-compat: discover paired [data-side-panel-strip] & [data-side-panel-body]
    function discoverSidePanel(doc) {
      if (!doc || isMobileOrDrawerActive(doc, null, null)) return null;
      const strips = qa(doc, '[data-side-panel-strip]');
      const bodies = qa(doc, '[data-side-panel-body]');
      if (!strips.length || !bodies.length) return null;
      const visibleBodies = bodies.filter((b) => isTreeVisible(b, doc) && !isOwnNode(b));
      if (!visibleBodies.length) return null;

      for (let s = 0; s < strips.length; s++) {
        const strip = strips[s];
        if (!isTreeVisible(strip, doc) || isOwnNode(strip) || isMobileOrDrawerActive(doc, strip, null)) continue;
        const tabs = findNativeTabs(strip);
        if (tabs.length < 1) continue;
        let cand = strip.parentElement;
        for (let steps = 1; cand && steps <= MAX_ANCESTOR_STEPS; steps++, cand = cand.parentElement) {
          if (isForbiddenHost(cand, doc)) break;
          const stripBranch = resolveBranchSlot(cand, strip, MAX_ANCESTOR_STEPS);
          if (!stripBranch) continue;
          for (let b = 0; b < visibleBodies.length; b++) {
            const body = visibleBodies[b];
            if (body === strip || strip.contains?.(body) || body.contains?.(strip)) continue;
            if (isMobileOrDrawerActive(doc, strip, body)) continue;
            const bodyBranch = resolveBranchSlot(cand, body, MAX_ANCESTOR_STEPS);
            if (bodyBranch && stripBranch.slot !== bodyBranch.slot) {
              return { host: cand, strip, body, tabs, stripSlot: stripBranch.slot, stripWraps: stripBranch.wraps, bodySlot: bodyBranch.slot };
            }
          }
        }
      }
      return null;
    }

    function findTabListContainer(strip, tabs) {
      if (!strip || !tabs.length) return strip;
      for (let cur = tabs[0].parentElement; cur && cur !== strip; cur = cur.parentElement) {
        let allInside = true;
        for (let i = 1; i < tabs.length; i++) {
          if (!cur.contains?.(tabs[i])) { allInside = false; break; }
        }
        if (allInside) return cur;
      }
      return strip;
    }

    function isActionSibling(el) {
      if (!isEl(el) || isOwnNode(el)) return false;
      const tag = tagU(el);
      const role = ga(el, 'role');
      if (tag === 'BUTTON' || role === 'button' || role === 'toolbar') return true;
      const tid = ga(el, 'data-testid') || '';
      if (tid && ACTION_TID_RE.test(tid)) return true;
      return Boolean(qs(el, 'button, [role="button"]'));
    }

    function stampStripTopology(strip, tabs, tabParent, isFlat, stamp) {
      const tabSet = new Set(tabs);
      if (isFlat) {
        stamp(strip, 'data-ag-vtabs-flat');
        const kids = strip.children || [];
        for (let i = 0; i < kids.length; i++) {
          const ch = kids[i];
          if (tabSet.has(ch) || isOwnNode(ch) || tabs.some((t) => ch.contains?.(t))) continue;
          if (isActionSibling(ch)) stamp(ch, 'data-ag-vtabs-actions');
        }
        return;
      }
      stamp(tabParent, 'data-ag-vtabs-list');
      let cur = tabParent.parentElement;
      let tabBranchChild = tabParent;
      while (cur && cur !== strip) {
        stamp(cur, 'data-ag-vtabs-wrap');
        const wrapKids = cur.children || [];
        for (let i = 0; i < wrapKids.length; i++) {
          const sib = wrapKids[i];
          if (sib === tabBranchChild || sib.contains?.(tabParent) || isOwnNode(sib)) continue;
          if (isActionSibling(sib)) stamp(sib, 'data-ag-vtabs-actions');
        }
        tabBranchChild = cur;
        cur = cur.parentElement;
      }
      const stripKids = strip.children || [];
      for (let i = 0; i < stripKids.length; i++) {
        const ch = stripKids[i];
        if (ch === tabBranchChild || ch.contains?.(tabParent) || isOwnNode(ch)) continue;
        if (isActionSibling(ch)) stamp(ch, 'data-ag-vtabs-actions');
      }
    }

    function extractTextExcluding(node, skipEl) {
      if (!node || node === skipEl || isOwnNode(node)) return '';
      if (node.nodeType === 3) return String(node.nodeValue ?? node.data ?? '');
      if (!isEl(node)) return '';
      const tag = tagU(node);
      if (tag === 'SVG' || tag === 'STYLE' || tag === 'SCRIPT') return '';
      const cn = node.childNodes;
      if (cn && cn.length > 0) {
        let out = '';
        for (let i = 0; i < cn.length; i++) {
          const child = cn[i];
          if (!child || child === skipEl || isOwnNode(child)) continue;
          const part = extractTextExcluding(child, skipEl);
          if (!part) continue;
          if (child.nodeType === 3) out += part;
          else { if (out && !/\s$/.test(out) && !/^\s/.test(part)) out += ' '; out += part; }
        }
        return out.replace(/\s+/g, ' ').trim();
      }
      return String(node.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function detectCloseButton(tab) {
      const btns = qa(tab, 'button, [role="button"]').filter((b) => b !== tab && !isOwnNode(b) && ga(b, 'role') !== 'tab');
      if (!btns.length) return null;
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        const hint = `${ga(b, 'aria-label') || ''} ${ga(b, 'title') || ''} ${ga(b, 'data-testid') || ''} ${clsOf(b)}`;
        if (CLOSE_HINT_RE.test(hint)) return b;
        const txt = String(b.textContent || '').trim();
        if (txt && CLOSE_GLYPH_RE.test(txt)) return b;
      }
      const last = btns[btns.length - 1];
      const lastHint = `${ga(last, 'aria-label') || ''} ${ga(last, 'title') || ''} ${ga(last, 'data-testid') || ''} ${clsOf(last)}`;
      if (NON_CLOSE_BTN_RE.test(lastHint) || qs(last, '[role="tab"]')) return null;
      const lastText = extractTextExcluding(last, null);
      if (lastText.length > 1 && !CLOSE_GLYPH_RE.test(lastText)) return null;
      const wrapsLabel = qa(last, 'span, div, p, label').some((el) => {
        const t = extractTextExcluding(el, null);
        return t.length > 1 && !CLOSE_GLYPH_RE.test(t);
      });
      if (wrapsLabel || extractTextExcluding(tab, last).length === 0) return null;
      return last;
    }

    function hasNonCloseIcon(tab, closeBtn) {
      const icons = qa(tab, 'svg, img');
      for (let i = 0; i < icons.length; i++) {
        const ic = icons[i];
        if (isOwnNode(ic) || (closeBtn && (ic === closeBtn || closeBtn.contains?.(ic)))) continue;
        return true;
      }
      return false;
    }

    function findTabIconTarget(tab, closeBtn) {
      const wrapped = qs(tab, '[data-ag-vtabs-icon="1"]');
      if (wrapped && !isOwnNode(wrapped)) return wrapped;
      const icons = qa(tab, 'svg, img');
      for (let i = 0; i < icons.length; i++) {
        const ic = icons[i];
        if (isOwnNode(ic) || (closeBtn && (ic === closeBtn || closeBtn.contains?.(ic)))) continue;
        return ic;
      }
      return null;
    }

    function containsIconOrButton(el, closeBtn) {
      if (!isEl(el)) return false;
      const tag = tagU(el);
      if (tag === 'SVG' || tag === 'IMG' || tag === 'BUTTON' || ga(el, 'role') === 'button' || ga(el, 'role') === 'tab') return true;
      if (closeBtn && (el === closeBtn || el.contains?.(closeBtn))) return true;
      return Boolean(qs(el, 'svg, img, button, [role="button"], [role="tab"]'));
    }

    function isPureIconWrapper(el, closeBtn) {
      if (!isEl(el) || el === closeBtn || isOwnNode(el)) return false;
      if (closeBtn && (closeBtn.contains?.(el) || el.contains?.(closeBtn))) return false;
      const tag = tagU(el);
      const role = ga(el, 'role');
      if (tag === 'SVG' || tag === 'IMG' || tag === 'BUTTON' || role === 'button' || role === 'tab') return false;
      if (qs(el, 'button, [role="button"], [role="tab"]') || !qs(el, 'svg, img')) return false;
      return extractTextExcluding(el, closeBtn) === '';
    }

    function inspectTabElements(tab, closeBtn) {
      const labelCandidates = [];
      const iconWrappers = [];
      const walk = (parent, depth) => {
        const kids = parent?.children || [];
        for (let i = 0; i < kids.length; i++) {
          const ch = kids[i];
          if (!isEl(ch) || ch === closeBtn || isOwnNode(ch) || (closeBtn && closeBtn.contains?.(ch))) continue;
          const tag = tagU(ch);
          if (tag === 'SVG' || tag === 'IMG') continue;
          if (isPureIconWrapper(ch, closeBtn)) { iconWrappers.push(ch); continue; }
          const role = ga(ch, 'role');
          if (tag === 'BUTTON' || role === 'button') {
            if (role === 'tab') { if (depth < 6) walk(ch, depth + 1); continue; }
            const btnTxt = extractTextExcluding(ch, closeBtn);
            if (btnTxt && !CLOSE_GLYPH_RE.test(btnTxt)) {
              if (ch.children?.length > 0 && depth < 6) walk(ch, depth + 1);
              else if (!qs(ch, 'svg, img') && btnTxt.length > 1) labelCandidates.push({ el: ch, score: btnTxt.length * 10 - depth });
            }
            continue;
          }
          if (containsIconOrButton(ch, closeBtn)) { if (depth < 6) walk(ch, depth + 1); continue; }
          const txt = extractTextExcluding(ch, closeBtn);
          if (!txt) continue;
          const hint = `${clsOf(ch)} ${ga(ch, 'data-testid') || ''}`;
          const score = txt.length * 10 + (LABEL_HINT_RE.test(hint) ? 50 : 0) - (META_HINT_RE.test(hint) ? 80 : 0) - (ga(ch, 'aria-hidden') === 'true' ? 500 : 0) - depth;
          labelCandidates.push({ el: ch, score });
        }
      };
      walk(tab, 0);
      let labelEl = null;
      let bestScore = -Infinity;
      for (let i = 0; i < labelCandidates.length; i++) {
        if (labelCandidates[i].score > bestScore) { bestScore = labelCandidates[i].score; labelEl = labelCandidates[i].el; }
      }
      const metaEls = [];
      for (let i = 0; i < labelCandidates.length; i++) if (labelCandidates[i].el !== labelEl) metaEls.push(labelCandidates[i].el);
      return { labelEl, metaEls, iconWrappers };
    }

    function collectIconHints(tab, closeBtn) {
      const hints = [];
      const nodes = qa(tab, 'svg, img, [data-host-icon], [data-icon], [data-ag-vtabs-icon="1"]');
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (isOwnNode(n) || (closeBtn && (n === closeBtn || closeBtn.contains?.(n)))) continue;
        for (const v of [ga(n, 'data-host-icon'), ga(n, 'data-icon'), ga(n, 'aria-label'), clsOf(n)]) {
          if (v) hints.push(v);
        }
      }
      return hints.join(' ');
    }

    function classifyFromDom(tab, closeBtn, visibleText, tabId) {
      const effTabId = tabId || getTabId(tab, closeBtn);
      const combined = `${ga(tab, 'data-testid') || ''} ${ga(tab, 'aria-label') || ''} ${effTabId} ${ga(tab, 'id') || ''} ${visibleText || ''}`.trim();
      const iconHints = collectIconHints(tab, closeBtn);
      if (CAT_BTW_RE.test(combined) || CAT_BTW_ICON_RE.test(iconHints)) return 'btw';
      if (CAT_BROWSER_RE.test(combined) || CAT_BROWSER_ICON_RE.test(iconHints)) return 'browser';
      if (CAT_DIFF_RE.test(combined) || CAT_DIFF_ICON_RE.test(iconHints)) return 'diff';
      if (CAT_TERM_RE.test(combined) || CAT_TERM_ICON_RE.test(iconHints)) return 'term';
      if (CAT_DOC_RE.test(combined) || CAT_DOC_ICON_RE.test(iconHints)) return 'doc';
      if (CAT_PLUGIN_RE.test(combined) || CAT_PLUGIN_ICON_RE.test(iconHints)) return 'plugin';
      return 'other';
    }

    // @host-compat: detect WebContentsView browser hole on body/host/ancestors/panelBody
    function detectBrowserHole(doc, host, body) {
      return Boolean(
        ga(doc?.body, 'data-has-browser-hole') === 'true' ||
        ga(host, 'data-has-browser-hole') === 'true' ||
        host?.closest?.('[data-has-browser-hole="true"]') ||
        ga(body, 'data-has-browser-hole') === 'true' ||
        qs(body, '[data-has-browser-hole="true"]')
      );
    }

    // @host-compat: RC-3 detect opaque z-50 top-right host cluster inside .agy-inset-shell
    function hasHostTopRightCluster(host, doc) {
      if (!host) return false;
      const shell = host.classList?.contains?.('agy-inset-shell') ? host : host.closest?.('.agy-inset-shell') || null;
      if (!shell) return false;
      const btns = qa(shell, TOP_INSET_CLUSTER_SEL);
      for (let i = 0; i < btns.length; i++) {
        const btn = btns[i];
        if (isOwnNode(btn) || !isTreeVisible(btn, doc) || btn.closest?.('[data-side-panel-body]')) continue;
        return true;
      }
      return false;
    }

    // @host-compat: RC-4 resolve clipping parent of [data-split-sized] (auxLast)
    function findClipTarget(host) {
      const parent = host?.closest?.('[data-split-sized]')?.parentElement || null;
      return parent && parent !== host ? parent : null;
    }

    function readResizeEntryWidth(entry) {
      if (!entry) return -1;
      for (let i = 0; i < 2; i++) {
        const raw = entry[i === 0 ? 'borderBoxSize' : 'contentBoxSize'];
        const box = Array.isArray(raw) ? raw[0] : raw;
        if (box && typeof box.inlineSize === 'number' && Number.isFinite(box.inlineSize)) return box.inlineSize;
      }
      const w = entry.contentRect?.width;
      return typeof w === 'number' && Number.isFinite(w) ? w : -1;
    }

    function upsertOrdChip(doc, tab, ord) {
      const existing = qa(tab, '.ag-cs-vtabs-ord');
      let chip = existing[0] || null;
      for (let i = 1; i < existing.length; i++) removeEl(existing[i]);
      const txt = `#${ord}`;
      if (!chip) {
        chip = markOwned(doc.createElement('span'), false);
        chip.className = 'ag-cs-vtabs-ord';
        sa(chip, 'aria-hidden', 'true');
        chip.textContent = txt;
        tab.appendChild(chip);
      } else {
        markOwned(chip, false);
        if (chip.textContent !== txt) chip.textContent = txt;
        const kids = tab.children || [];
        if (kids[kids.length - 1] !== chip) tab.appendChild(chip);
      }
    }

    function removeOrdChips(tab) {
      qa(tab, '.ag-cs-vtabs-ord').forEach(removeEl);
    }

    function stripNodeVtabsAttrs(el, styleMutSet) {
      if (!el) return;
      if (ga(el, 'data-ag-vtabs-title') === '1') { ra(el, 'title'); ra(el, 'data-ag-vtabs-title'); }
      if (ha(el, 'data-ag-vtabs-host') || ha(el, 'data-ag-vtabs-strip') || ha(el, 'data-ag-vtabs-top-inset')) {
        if (removeCssVar(el, '--ag-vtabs-w') && styleMutSet) styleMutSet.add(el);
        if (removeCssVar(el, '--ag-vtabs-top-inset') && styleMutSet) styleMutSet.add(el);
      }
      for (let i = 0; i < ALL_MARK_ATTRS.length; i++) if (ha(el, ALL_MARK_ATTRS[i])) ra(el, ALL_MARK_ATTRS[i]);
    }

    function cleanupOrphanDom(doc) {
      if (!doc) return;
      removeEl(doc.getElementById?.(STYLE_ID) || qs(doc, '#' + STYLE_ID));
      qa(doc, OWNED_NODE_SEL).forEach(removeEl);
      qa(doc, VTABS_SWEEP_SEL).forEach((el) => stripNodeVtabsAttrs(el, null));
    }

    function buildToggleIcon(doc, collapsed) {
      if (!doc || !isFn(doc.createElementNS)) {
        const sp = doc.createElement('span');
        sa(sp, 'aria-hidden', 'true');
        return { svg: sp, arrow: null };
      }
      const mkSvg = (tag, attrs) => {
        const n = doc.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) sa(n, k, v);
        return n;
      };
      const svg = mkSvg('svg', {
        width: '14', height: '14', viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
        'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
      });
      svg.appendChild(mkSvg('rect', { x: '2', y: '2.5', width: '12', height: '11', rx: '2' }));
      svg.appendChild(mkSvg('line', { x1: '10', y1: '2.5', x2: '10', y2: '13.5' }));
      const arrow = mkSvg('polyline', { points: collapsed ? '7.2 6.2 5.2 8 7.2 9.8' : '5.2 6.2 7.2 8 5.2 9.8' });
      svg.appendChild(arrow);
      return { svg, arrow };
    }

    function nodeHasSpecialSurface(node) {
      if (!isEl(node)) return false;
      if (node.matches?.('[data-side-panel-strip], [data-has-browser-hole="true"]')) return true;
      return Boolean(qs(node, '[data-side-panel-strip], [data-has-browser-hole="true"]'));
    }

    function isRelevantMutation(records, ownTitles, ownStyles, state) {
      if (!Array.isArray(records) || records.length === 0) return true;
      const { boundStrip, boundStripSlot, toggleHeadEl, sashEl } = state;
      for (let i = 0; i < records.length; i++) {
        const m = records[i];
        if (!m) continue;
        const tgt = m.target;
        if (tgt && isOwnNode(tgt)) continue;
        if (m.type === 'characterData') {
          const parentEl = isEl(tgt) ? tgt : tgt?.parentElement;
          if (parentEl && !isOwnNode(parentEl) && ((boundStrip && boundStrip.contains?.(parentEl)) || parentEl.closest?.('[data-side-panel-strip]'))) return true;
          continue;
        }
        if (m.type === 'attributes') {
          const name = m.attributeName || '';
          if (name.startsWith('data-ag-vtabs-') || name === 'data-ag-cs-resizing') continue;
          if (name === 'title' && ownTitles?.has(tgt)) continue;
          if (name === 'style' && ownStyles?.has(tgt)) continue;
          if (name !== 'data-has-browser-hole' && name !== 'data-has-drawer-browser-hole' && tgt?.closest?.('[data-testid="conversation-view"]')) continue;
          return true;
        }
        if (m.type === 'childList') {
          const added = m.addedNodes ? Array.from(m.addedNodes) : [];
          const removed = m.removedNodes ? Array.from(m.removedNodes) : [];
          if (
            tgt?.closest?.('[data-testid="conversation-view"]') &&
            !qs(tgt, '[data-side-panel-strip]') && !qs(tgt, '[data-has-browser-hole="true"]') &&
            !added.some(nodeHasSpecialSurface) && !removed.some(nodeHasSpecialSurface)
          ) continue;
          if (added.some((n) => !isOwnNode(n)) || removed.some((n) => !isOwnNode(n))) return true;
          if (
            (boundStrip && tgt === boundStrip && toggleHeadEl && removed.includes(toggleHeadEl)) ||
            ((tgt === boundStrip || (boundStripSlot && tgt === boundStripSlot)) && sashEl && removed.includes(sashEl))
          ) return true;
          continue;
        }
        return true;
      }
      return false;
    }

    Object.assign(ns, {
      isElVisible, isTreeVisible, isOwnNode, getTabId, checkExplicitTabActiveAttr, isTabActive,
      isMobileOrDrawerActive, isForbiddenHost, resolveBranchSlot, findNativeTabs, discoverSidePanel,
      findTabListContainer, isActionSibling, stampStripTopology, extractTextExcluding,
      detectCloseButton, hasNonCloseIcon, findTabIconTarget, containsIconOrButton,
      isPureIconWrapper, inspectTabElements, collectIconHints, classifyFromDom, detectBrowserHole,
      hasHostTopRightCluster, findClipTarget, readResizeEntryWidth, upsertOrdChip, removeOrdChips,
      stripNodeVtabsAttrs, cleanupOrphanDom, buildToggleIcon, nodeHasSpecialSurface, isRelevantMutation,
    });
  }

  if (typeof __vtabsInit === 'function') __vtabsInit(init);
  else if (typeof module === 'object' && module && module.exports) module.exports = init;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
