// Obsidian Prism — FastDOM Smooth Typing Caret Engine
// Extracted from ui-runtime.js: separates measure & mutate phases with zero forced layout reflow.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  function snapDevicePx(value, dpr = 1) {
    const v = Number(value) || 0;
    const d = Number.isFinite(Number(dpr)) && Number(dpr) > 0 ? Math.min(4, Number(dpr)) : 1;
    return +(Math.round(v * d) / d).toFixed(3);
  }

  function createSmoothCaretController({ isDestroyed, isEnabled, setAttrIfChanged, runGuardedMut }) {
    let caretTypingTimer = null;
    let caretRaf = 0;
    let pendingCaretTyping = false;
    let pendingCaretRefreshMetrics = false;
    let pendingCaretScroll = false;
    let editorMetricsEpoch = 1;
    let selectionSigEpoch = 1;
    let cachedEditors = [];
    let lastEditorScanAt = 0;
    const editorMetricsCache = new WeakMap();
    let emptyCaretProbeCache = new WeakMap();
    const caretPrevState = new WeakMap();
    const caretNodeCache = new WeakMap();
    const selectionSigCache = new WeakMap();

    function teardown() {
      if (caretTypingTimer) {
        clearTimeout(caretTypingTimer);
        caretTypingTimer = null;
      }
      if (caretRaf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(caretRaf);
        caretRaf = 0;
      }
      pendingCaretTyping = false;
      pendingCaretRefreshMetrics = false;
      pendingCaretScroll = false;
      cachedEditors = [];
      lastEditorScanAt = 0;
      if (typeof document === 'undefined') return;
      document.querySelectorAll('.ag-cs-smooth-caret').forEach((n) => n.remove());
      document.querySelectorAll('[data-ag-cs-smooth-caret]').forEach((n) => n.removeAttribute('data-ag-cs-smooth-caret'));
      document.querySelectorAll('[data-ag-cs-caret-host]').forEach((n) => n.removeAttribute('data-ag-cs-caret-host'));
    }

    function bumpMetricsEpoch() {
      editorMetricsEpoch += 1;
      lastEditorScanAt = 0;
      emptyCaretProbeCache = new WeakMap();
    }

    function invalidateSelection() {
      selectionSigEpoch += 1;
    }

    function getCachedEditorMetrics(ed, forceRefresh = false) {
      let rec = editorMetricsCache.get(ed);
      if (rec && !forceRefresh && rec.epoch === editorMetricsEpoch) return rec;
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(ed) : null;
      const padL = parseFloat(cs?.paddingLeft || '8') || 8;
      const padT = parseFloat(cs?.paddingTop || '8') || 8;
      const fontSize = parseFloat(cs?.fontSize || '14') || 14;
      const lineH = parseFloat(cs?.lineHeight || '22') || fontSize * 1.5 || 22;
      const estGlyphH = Math.max(16, Math.min(24, Math.round(fontSize * 1.28)));
      const defaultH = Math.max(16, Math.min(28, lineH));
      const estEmptyTopOffset = padT + Math.max(0, Math.round((defaultH - estGlyphH) / 2));
      rec = { padL, padT, fontSize, lineH, estGlyphH, defaultH, estEmptyTopOffset, epoch: editorMetricsEpoch };
      editorMetricsCache.set(ed, rec);
      return rec;
    }

    function measureEditorCaretBox(ed, refreshMetrics = false) {
      if (!ed) return null;
      const edRect = ed.getBoundingClientRect();
      const { padL, estGlyphH, estEmptyTopOffset } = getCachedEditorMetrics(ed, refreshMetrics);

      const checkScrollBounds = (box) => {
        if (!box || !box.collapsed) return box;
        if ((ed.scrollHeight || 0) > (ed.clientHeight || 0) + 2 && edRect.height > 0) {
          if (box.top < edRect.top - 4 || box.top + box.height > edRect.bottom + 6) {
            return { collapsed: false };
          }
        }
        return box;
      };

      const cacheEmptyProbe = (boxRect) => {
        if (boxRect && boxRect.height > 0 && boxRect.height < 36 && edRect.height > 0) {
          emptyCaretProbeCache.set(ed, {
            dx: boxRect.left - edRect.left,
            dy: boxRect.top - edRect.top,
            height: boxRect.height,
            epoch: editorMetricsEpoch,
          });
        }
      };

      if (typeof document !== 'undefined' && typeof document.getSelection === 'function') {
        const sel = document.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = typeof sel.getRangeAt === 'function' ? sel.getRangeAt(0) : null;
          const isCol0 = range && typeof range.collapsed === 'boolean' ? range.collapsed : Boolean(sel.isCollapsed);
          if (!isCol0) return { collapsed: false };
          if (range && ed.contains && ed.contains(range.startContainer)) {
            const sc = range.startContainer;
            const so = range.startOffset;

            const isInlineChip = (node) => {
              if (!node || node.nodeType !== 1 || node.nodeName === 'BR') return false;
              if (node.getAttribute?.('contenteditable') === 'false' || node.isContentEditable === false) return true;
              if (node.hasAttribute?.('data-lexical-decorator')) return true;
              try {
                return Boolean(node.querySelector?.('[contenteditable="false"],[data-lexical-decorator]'));
              } catch {
                return false;
              }
            };

            const lastNonZeroRect = (el) => {
              if (!el || typeof el.getBoundingClientRect !== 'function') return null;
              const cRects = typeof el.getClientRects === 'function' ? el.getClientRects() : [];
              if (cRects && cRects.length > 0) {
                for (let i = cRects.length - 1; i >= 0; i--) {
                  const r = cRects[i];
                  if (r && r.height > 0 && (r.right > 0 || r.top > 0)) return r;
                }
              }
              const br = el.getBoundingClientRect();
              return br && br.height > 0 && (br.right > 0 || br.top > 0) ? br : null;
            };

            const rectAfterChip = (el) => {
              const pr = lastNonZeroRect(el);
              if (!pr) return null;
              const h = Math.min(estGlyphH, pr.height);
              const top = pr.top + Math.max(0, (pr.height - h) / 2);
              return { collapsed: true, left: pr.right + 1, top, height: h };
            };

            const isBlockBreak = (el) =>
              Boolean(el && el.nodeType === 1 && /^(?:P|DIV|LI|BLOCKQUOTE|PRE|H[1-6]|BR)$/.test(el.nodeName));

            const findPrecedingRenderedNode = (startNode, startOffset, rootEd) => {
              let cur = null;
              let parent = startNode;
              if (startNode.nodeType === 1 && startOffset > 0) {
                cur = startNode.childNodes?.[startOffset - 1] || null;
              } else {
                cur = startNode.previousSibling;
                parent = startNode.parentNode;
              }
              for (let steps = 0; steps < 64 && parent; steps++) {
                while (cur) {
                  if (cur.nodeType === 3) {
                    const cleaned = (cur.nodeValue || '').replace(/[\u200b\ufeff]/g, '');
                    if (cleaned.length > 0) return cur;
                    cur = cur.previousSibling;
                    continue;
                  }
                  if (cur.nodeType === 1) {
                    if (cur.nodeName === 'BR') return cur;
                    if (isInlineChip(cur) || lastNonZeroRect(cur)) return cur;
                    cur = cur.previousSibling;
                    continue;
                  }
                  cur = cur.previousSibling;
                }
                if (!parent || parent === rootEd || isBlockBreak(parent)) break;
                cur = parent.previousSibling;
                parent = parent.parentNode;
              }
              return null;
            };

            const rectAtEndOfNode = (node) => {
              if (!node) return null;
              if (node.nodeType === 1) return rectAfterChip(node);
              if (node.nodeType === 3 && typeof document.createRange === 'function') {
                const len = (node.nodeValue || '').length;
                if (len <= 0) return null;
                try {
                  const tr = document.createRange();
                  tr.setStart(node, len);
                  tr.setEnd(node, len);
                  const tRects = typeof tr.getClientRects === 'function' ? tr.getClientRects() : [];
                  const tr0 = tRects && tRects.length > 0 ? tRects[tRects.length - 1] : tr.getBoundingClientRect();
                  if (tr0 && tr0.height > 0 && (tr0.left > 0 || tr0.top > 0)) {
                    return { collapsed: true, left: tr0.left, top: tr0.top, height: tr0.height };
                  }
                  tr.setStart(node, Math.max(0, len - 1));
                  tr.setEnd(node, len);
                  const chRects = typeof tr.getClientRects === 'function' ? tr.getClientRects() : [];
                  const ch0 = chRects && chRects.length > 0 ? chRects[chRects.length - 1] : tr.getBoundingClientRect();
                  if (ch0 && ch0.height > 0 && (ch0.right > 0 || ch0.top > 0)) {
                    return { collapsed: true, left: ch0.right, top: ch0.top, height: ch0.height };
                  }
                } catch {}
              }
              return null;
            };

            // Guard 1: caret reported inside a non-editable chip / Lexical decorator
            const scEl = sc.nodeType === 1 ? sc : sc.parentElement;
            const hostChip = scEl?.closest?.('[contenteditable="false"],[data-lexical-decorator]');
            if (hostChip && ed.contains(hostChip)) {
              const box = rectAfterChip(hostChip);
              if (box) return checkScrollBounds(box);
            }

            // Guard 2: element-level caret immediately after an inline chip/element BEFORE trusting range.getClientRects()
            if (sc.nodeType === 1 && so > 0) {
              const prevNode = sc.childNodes?.[so - 1];
              if (
                prevNode &&
                prevNode.nodeType === 1 &&
                prevNode.nodeName !== 'BR' &&
                (isInlineChip(prevNode) || (prevNode.getBoundingClientRect?.().height || 0) > 0)
              ) {
                const box = rectAfterChip(prevNode);
                if (box) return checkScrollBounds(box);
              }
            }

            const rects = typeof range.getClientRects === 'function' ? range.getClientRects() : [];
            let r0 =
              rects && rects.length > 0
                ? rects[rects.length - 1]
                : typeof range.getBoundingClientRect === 'function'
                ? range.getBoundingClientRect()
                : null;

            // Guard 3: text/empty-span caret at offset 0 (or zero-width text) immediately following an inline chip on the same line
            if (r0 && r0.height > 0 && (r0.left > 0 || r0.top > 0)) {
              const isStartOrZwsp =
                so === 0 || (sc.nodeType === 3 && ((sc.nodeValue || '').replace(/[\u200b\ufeff]/g, '').length === 0));
              if (isStartOrZwsp) {
                const prev = findPrecedingRenderedNode(sc, so, ed);
                if (prev && prev.nodeType === 1 && prev.nodeName !== 'BR') {
                  const pr = lastNonZeroRect(prev);
                  if (pr && Math.abs(r0.top - pr.top) < Math.max(estGlyphH, pr.height) && r0.left < pr.right - 2) {
                    r0 = { left: pr.right + 1, top: r0.top, height: r0.height };
                  }
                }
              }
              return checkScrollBounds({ collapsed: true, left: r0.left, top: r0.top, height: r0.height });
            }

            // Guard 4: empty / ZWSP Text node or nested span when range.getClientRects() returns empty/zero-height
            const prevRendered = findPrecedingRenderedNode(sc, so, ed);
            if (prevRendered && prevRendered.nodeName !== 'BR') {
              const box = rectAtEndOfNode(prevRendered);
              if (box) return checkScrollBounds(box);
            }
            if (sc?.nodeName === 'BR' && typeof sc.getBoundingClientRect === 'function') {
              const brRect = sc.getBoundingClientRect();
              if (brRect && brRect.height > 0 && (brRect.left > 0 || brRect.top > 0)) {
                if (!ed.textContent) cacheEmptyProbe(brRect);
                return checkScrollBounds({ collapsed: true, left: brRect.left, top: brRect.top, height: brRect.height });
              }
            }
            if (sc && sc.nodeType === 1) {
              const childAt = sc.childNodes?.[so];
              if (childAt?.nodeName === 'BR' && typeof childAt.getBoundingClientRect === 'function') {
                const brRect = childAt.getBoundingClientRect();
                if (brRect && brRect.height > 0 && (brRect.left > 0 || brRect.top > 0)) {
                  if (sc.childNodes.length <= 1 && !ed.textContent) cacheEmptyProbe(brRect);
                  return checkScrollBounds({ collapsed: true, left: brRect.left, top: brRect.top, height: brRect.height });
                }
              }
              const childPrev = so > 0 ? sc.childNodes?.[so - 1] : null;
              if (childPrev?.nodeName === 'BR' && typeof childPrev.getBoundingClientRect === 'function') {
                const brRect = childPrev.getBoundingClientRect();
                if (brRect && brRect.height > 0 && (brRect.left > 0 || brRect.top > 0)) {
                  const isManagedEmptyLine =
                    (typeof childPrev.hasAttribute === 'function' && childPrev.hasAttribute('data-lexical-managed-linebreak')) ||
                    sc.childNodes.length === 1;
                  const scRect = typeof sc.getBoundingClientRect === 'function' ? sc.getBoundingClientRect() : null;
                  const lineLeft = scRect && scRect.left > 0 ? scRect.left : brRect.left;
                  const lineTop = isManagedEmptyLine ? brRect.top : brRect.bottom;
                  const box = { collapsed: true, left: lineLeft, top: lineTop, height: brRect.height };
                  if (isManagedEmptyLine && sc.childNodes.length <= 1 && !ed.textContent) cacheEmptyProbe(box);
                  return checkScrollBounds(box);
                }
              }
              // Handle collapsed caret adjacent to inline chips/pills (e.g. Lexical Cmd+L quote chips) or text nodes
              if (childPrev && childPrev.nodeName !== 'BR') {
                if (childPrev.nodeType === 1) {
                  const pRects = typeof childPrev.getClientRects === 'function' ? childPrev.getClientRects() : [];
                  const pr =
                    pRects && pRects.length > 0
                      ? pRects[pRects.length - 1]
                      : typeof childPrev.getBoundingClientRect === 'function'
                      ? childPrev.getBoundingClientRect()
                      : null;
                  if (pr && pr.height > 0 && (pr.right > 0 || pr.top > 0)) {
                    const h = Math.min(estGlyphH, pr.height);
                    const top = pr.top + Math.max(0, (pr.height - h) / 2);
                    return checkScrollBounds({ collapsed: true, left: pr.right, top, height: h });
                  }
                } else if (childPrev.nodeType === 3 && typeof document.createRange === 'function') {
                  try {
                    const tr = document.createRange();
                    const tLen = (childPrev.nodeValue || '').length;
                    tr.setStart(childPrev, tLen);
                    tr.setEnd(childPrev, tLen);
                    const tRects = typeof tr.getClientRects === 'function' ? tr.getClientRects() : [];
                    const tr0 = tRects && tRects.length > 0 ? tRects[tRects.length - 1] : tr.getBoundingClientRect();
                    if (tr0 && tr0.height > 0 && (tr0.left > 0 || tr0.top > 0)) {
                      return checkScrollBounds({ collapsed: true, left: tr0.left, top: tr0.top, height: tr0.height });
                    }
                  } catch {}
                }
              }
              if (childAt && childAt.nodeName !== 'BR') {
                if (childAt.nodeType === 1) {
                  const nRects = typeof childAt.getClientRects === 'function' ? childAt.getClientRects() : [];
                  const nr =
                    nRects && nRects.length > 0
                      ? nRects[0]
                      : typeof childAt.getBoundingClientRect === 'function'
                      ? childAt.getBoundingClientRect()
                      : null;
                  if (nr && nr.height > 0 && (nr.left > 0 || nr.top > 0)) {
                    const h = Math.min(estGlyphH, nr.height);
                    const top = nr.top + Math.max(0, (nr.height - h) / 2);
                    return checkScrollBounds({ collapsed: true, left: nr.left, top, height: h });
                  }
                } else if (childAt.nodeType === 3 && typeof document.createRange === 'function') {
                  try {
                    const tr = document.createRange();
                    tr.setStart(childAt, 0);
                    tr.setEnd(childAt, 0);
                    const tRects = typeof tr.getClientRects === 'function' ? tr.getClientRects() : [];
                    const tr0 = tRects && tRects.length > 0 ? tr0[0] : tr.getBoundingClientRect();
                    if (tr0 && tr0.height > 0 && (tr0.left > 0 || tr0.top > 0)) {
                      return checkScrollBounds({ collapsed: true, left: tr0.left, top: tr0.top, height: tr0.height });
                    }
                  } catch {}
                }
              }
              if (typeof sc.getBoundingClientRect === 'function' && sc !== ed) {
                const scRect = sc.getBoundingClientRect();
                if (scRect && (scRect.left > 0 || scRect.top > 0)) {
                  return checkScrollBounds({
                    collapsed: true,
                    left: scRect.left,
                    top: scRect.top,
                    height: Math.min(estGlyphH, scRect.height || estGlyphH),
                  });
                }
              }
            }
          }
        }
      }

      // Guard 5: never fall back to top-left emptyCaretProbeCache when editor has content (fail-safe reveals native OS caret)
      const editorHasContent = Boolean(
        (ed.textContent || '').replace(/[\u200b\ufeff]/g, '').length > 0 ||
          ed.querySelector?.('[contenteditable="false"],[data-lexical-decorator],button,img,svg')
      );
      if (editorHasContent) return { collapsed: false };

      const cached = emptyCaretProbeCache.get(ed);
      if (cached && cached.epoch === editorMetricsEpoch) {
        return checkScrollBounds({
          collapsed: true,
          left: edRect.left + cached.dx,
          top: edRect.top + cached.dy,
          height: cached.height,
        });
      }

      return checkScrollBounds({
        collapsed: true,
        left: edRect.left + padL,
        top: edRect.top + estEmptyTopOffset,
        height: estGlyphH,
      });
    }

    function resolveComposerEditors(activeEl, refreshMetrics) {
      const now = Date.now();
      const activeIsEditable = Boolean(
        activeEl && (activeEl.isContentEditable || activeEl.getAttribute?.('contenteditable') === 'true')
      );
      const cacheValid =
        !refreshMetrics &&
        cachedEditors.length > 0 &&
        now - lastEditorScanAt < 1200 &&
        cachedEditors.every((e) => e && e.isConnected !== false) &&
        (!activeIsEditable || cachedEditors.includes(activeEl));
      if (cacheValid) return cachedEditors;
      cachedEditors = Array.from(document.querySelectorAll('[data-testid="agent-input-box"] [contenteditable="true"]'));
      lastEditorScanAt = now;
      return cachedEditors;
    }

    function measureSnapshot(refreshMetrics = false, checkScroll = true) {
      if (isDestroyed() || !isEnabled() || typeof document === 'undefined') return null;
      const activeEl = document.activeElement;
      const editors = resolveComposerEditors(activeEl, refreshMetrics);
      if (editors.length === 0) return null;
      const sel = typeof document.getSelection === 'function' ? document.getSelection() : null;
      const list = [];
      for (const ed of editors) {
        const host = ed.parentElement;
        if (!host) continue;
        const isFocused = activeEl === ed || Boolean(activeEl && ed.contains && ed.contains(activeEl));
        if (!isFocused) {
          selectionSigCache.delete(ed);
          const cachedCaret = caretNodeCache.get(host);
          const caretVis = cachedCaret && cachedCaret.isConnected !== false
            ? cachedCaret.getAttribute?.('data-ag-cs-caret-visible') === '1'
            : Boolean(host.querySelector?.('.ag-cs-smooth-caret[data-ag-cs-caret-visible="1"]'));
          if (!host.hasAttribute?.('data-ag-cs-caret-host') || ed.hasAttribute?.('data-ag-cs-smooth-caret') || caretVis) {
            list.push({ ed, host, isFocused: false, measured: null, hostRect: null, clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0, isNowEmpty: true });
          }
          continue;
        }
        let scrolledOnly = false;
        const rc = sel ? sel.rangeCount || 0 : 0;
        const r0 = rc > 0 && typeof sel.getRangeAt === 'function' ? sel.getRangeAt(0) : null;
        const isCol = r0 && typeof r0.collapsed === 'boolean' ? r0.collapsed : rc > 0 ? Boolean(sel.isCollapsed) : true;
        const fNode = r0 && r0.endContainer !== undefined ? r0.endContainer : rc > 0 ? sel.focusNode : null;
        const fOff = r0 && typeof r0.endOffset === 'number' ? r0.endOffset : rc > 0 ? sel.focusOffset : -1;
        const childCnt = ed.childNodes ? ed.childNodes.length : 0;
        const descCnt = ed.querySelectorAll ? ed.querySelectorAll('*').length : 0;
        const edTextLen = typeof ed.textContent === 'string' ? ed.textContent.length : 0;
        const localTextLen =
          fNode && typeof fNode.nodeValue === 'string'
            ? fNode.nodeValue.length
            : (ed.firstChild && typeof ed.firstChild.textContent === 'string' ? ed.firstChild.textContent.length : edTextLen);
        const fParentChildCnt =
          fNode && fNode.parentNode && fNode.parentNode.childNodes ? fNode.parentNode.childNodes.length : -1;
        const textSig = `${edTextLen}:${localTextLen}:${fParentChildCnt}`;
        const prevSig = selectionSigCache.get(ed);
        const alreadySynced = Boolean(prevSig) && (ed.hasAttribute?.('data-ag-cs-smooth-caret') || prevSig.hidden);
        let sameSelection = false;
        if (!refreshMetrics && alreadySynced) {
          sameSelection =
            prevSig.epoch === editorMetricsEpoch &&
            prevSig.selEpoch === selectionSigEpoch &&
            prevSig.rc === rc &&
            prevSig.isCollapsed === isCol &&
            prevSig.focusNode === fNode &&
            prevSig.focusOffset === fOff &&
            prevSig.childCnt === childCnt &&
            prevSig.descCnt === descCnt &&
            prevSig.textSig === textSig;
          // Zero forced-reflow fast path: skip scrollLeft/scrollTop DOM layout reads unless scroll was flagged or selection actually changed!
          if (sameSelection && !checkScroll) continue;
        }
        const edScrollLeft = ed.scrollLeft || 0;
        const edScrollTop = ed.scrollTop || 0;
        const hostScrollLeft = host.scrollLeft || 0;
        const hostScrollTop = host.scrollTop || 0;
        if (!refreshMetrics && alreadySynced && sameSelection) {
          const sameScroll =
            prevSig.edScrollLeft === edScrollLeft &&
            prevSig.edScrollTop === edScrollTop &&
            prevSig.hostScrollLeft === hostScrollLeft &&
            prevSig.hostScrollTop === hostScrollTop;
          if (sameScroll) continue;
          scrolledOnly = true;
        }
        const measured = measureEditorCaretBox(ed, refreshMetrics);
        const hostRect = measured && measured.collapsed ? host.getBoundingClientRect() : null;
        selectionSigCache.set(ed, {
          epoch: editorMetricsEpoch,
          selEpoch: selectionSigEpoch,
          rc,
          isCollapsed: isCol,
          focusNode: fNode,
          focusOffset: fOff,
          childCnt,
          descCnt,
          textSig,
          edScrollLeft,
          edScrollTop,
          hostScrollLeft,
          hostScrollTop,
          hidden: !(measured && measured.collapsed && hostRect),
        });
        const clientLeft = host.clientLeft || 0;
        const clientTop = host.clientTop || 0;
        const cleanText = (ed.textContent || '').replace(/\u200b/g, '');
        const isNowEmpty = cleanText.length === 0 && ed.querySelectorAll('p, div').length <= 1;
        list.push({
          ed,
          host,
          isFocused,
          measured,
          hostRect,
          clientLeft,
          clientTop,
          scrollLeft: hostScrollLeft,
          scrollTop: hostScrollTop,
          isNowEmpty,
          scrolledOnly,
        });
      }
      return list;
    }

    function applyMutations(snapshotList, isTypingEvent = false) {
      if (isDestroyed() || !isEnabled()) {
        teardown();
        return;
      }
      if (!snapshotList || snapshotList.length === 0 || typeof document === 'undefined') return;
      runGuardedMut(() => {
        for (const item of snapshotList) {
          const { ed, host, isFocused, measured, hostRect, clientLeft, clientTop, scrollLeft, scrollTop, isNowEmpty, scrolledOnly } = item;
          setAttrIfChanged(host, 'data-ag-cs-caret-host', '1');
          let caret = caretNodeCache.get(host);
          if (!caret || caret.parentElement !== host) caret = host.querySelector('.ag-cs-smooth-caret');
          if (!caret) {
            caret = document.createElement('div');
            caret.className = 'ag-cs-smooth-caret';
            caret.setAttribute('aria-hidden', 'true');
            caret.setAttribute('data-ag-no-i18n', '');
            host.appendChild(caret);
          }
          caretNodeCache.set(host, caret);

          if (!measured || !measured.collapsed || !hostRect) {
            if (caret.hasAttribute('data-ag-cs-caret-visible')) caret.removeAttribute('data-ag-cs-caret-visible');
            if (ed.hasAttribute('data-ag-cs-smooth-caret')) ed.removeAttribute('data-ag-cs-smooth-caret');
            continue;
          }

          const rawDpr = (typeof window !== 'undefined' && Number(window.devicePixelRatio)) || 1;
          const x = snapDevicePx(measured.left - hostRect.left - clientLeft + scrollLeft, rawDpr);
          const y = snapDevicePx(measured.top - hostRect.top - clientTop + scrollTop, rawDpr);
          const h = Math.max(15, snapDevicePx(measured.height || 18, rawDpr));
          const wasVisible = caret.getAttribute('data-ag-cs-caret-visible') === '1';
          const prev = caretPrevState.get(caret);
          const clearedToEmpty = Boolean(prev && prev.empty === false && isNowEmpty);

          if ((isFocused && !wasVisible) || clearedToEmpty || scrolledOnly) {
            caret.style.transition = 'none';
            caret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            caret.style.height = `${h}px`;
            if (typeof requestAnimationFrame === 'function') {
              requestAnimationFrame(() => {
                if (caret.isConnected) caret.style.transition = '';
              });
            } else {
              caret.style.transition = '';
            }
          } else {
            if (!prev || prev.x !== x || prev.y !== y) {
              caret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
            if (!prev || prev.h !== h) {
              caret.style.height = `${h}px`;
            }
          }
          caretPrevState.set(caret, { x, y, h, empty: isNowEmpty });

          if (isFocused) {
            setAttrIfChanged(caret, 'data-ag-cs-caret-visible', '1');
            setAttrIfChanged(ed, 'data-ag-cs-smooth-caret', '1');
            if (isTypingEvent) {
              setAttrIfChanged(caret, 'data-ag-cs-caret-typing', '1');
              if (caretTypingTimer) clearTimeout(caretTypingTimer);
              caretTypingTimer = setTimeout(() => {
                caretTypingTimer = null;
                if (caret.isConnected) caret.removeAttribute('data-ag-cs-caret-typing');
              }, 420);
            } else if (prev && (prev.x !== x || prev.y !== y) && typeof caret.getAnimations === 'function') {
              for (const anim of caret.getAnimations()) {
                if (anim && anim.animationName === 'ag-cs-caret-blink') anim.currentTime = 0;
              }
            }
          } else {
            if (caret.hasAttribute('data-ag-cs-caret-visible')) caret.removeAttribute('data-ag-cs-caret-visible');
            if (ed.hasAttribute('data-ag-cs-smooth-caret')) ed.removeAttribute('data-ag-cs-smooth-caret');
          }
        }
      });
    }

    function sync(isTypingEvent = false, refreshMetrics = false, checkScroll = true) {
      if (isDestroyed() || !isEnabled()) {
        teardown();
        return;
      }
      const snap = measureSnapshot(refreshMetrics, checkScroll);
      applyMutations(snap, isTypingEvent);
    }

    function queue(isTyping = false, immediate = false, refreshMetrics = false, isScroll = false) {
      if (isDestroyed() || !isEnabled()) return;
      if (isTyping) pendingCaretTyping = true;
      if (refreshMetrics) pendingCaretRefreshMetrics = true;
      if (isScroll) pendingCaretScroll = true;
      if (immediate) {
        if (caretRaf && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(caretRaf);
          caretRaf = 0;
        }
        const typingNow = pendingCaretTyping || isTyping;
        const refreshNow = pendingCaretRefreshMetrics || refreshMetrics;
        const scrollNow = pendingCaretScroll || isScroll;
        pendingCaretTyping = false;
        pendingCaretRefreshMetrics = false;
        pendingCaretScroll = false;
        sync(typingNow, refreshNow, scrollNow);
        return;
      }
      if (caretRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(caretRaf);
      if (typeof requestAnimationFrame === 'function') {
        caretRaf = requestAnimationFrame(() => {
          caretRaf = 0;
          const typingNow = pendingCaretTyping;
          const refreshNow = pendingCaretRefreshMetrics;
          const scrollNow = pendingCaretScroll;
          pendingCaretTyping = false;
          pendingCaretRefreshMetrics = false;
          pendingCaretScroll = false;
          sync(typingNow, refreshNow, scrollNow);
        });
      }
    }

    return {
      teardown,
      bumpMetricsEpoch,
      invalidateSelection,
      measureSnapshot,
      applyMutations,
      sync,
      queue,
    };
  }

  const api = { createSmoothCaretController, snapDevicePx };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismSmoothCaret = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
