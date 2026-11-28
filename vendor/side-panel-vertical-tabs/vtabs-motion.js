// Obsidian Prism - Right Side Panel Vertical Tabs FLIP Glide, Icon Spring & /btw Caustic (vtabs-motion.js)
(function (G) {
  'use strict';

  function init(ns) {
    const {
      CAUSTIC_DURATION_MS,
      GLIDE_SAFETY_MS,
      safe,
      isFn,
      ga,
      ha,
      sa,
      ra,
      setAttrIfChanged,
      qa,
      markOwned,
      removeEl,
      findTabIconTarget,
      detectBtwRunning,
    } = ns;

    function createVtabsMotionManager(ctx) {
      let glideBarEl = null;
      let glideSession = null;
      let iconPopHandle = null;
      let prevActiveTab = null;

      const causticTimers = new Map();
      const readyTabs = new Set();
      const btwRunMap = new Map();
      const lastTabIdentityByEl = new Map();

      function cancelGlideSession() {
        if (iconPopHandle) {
          safe(() => iconPopHandle.cancel?.());
          iconPopHandle = null;
        }
        if (!glideSession) return;
        const sess = glideSession;
        glideSession = null;
        if (sess.timerId !== null) {
          safe(() => ctx.clrT(sess.timerId));
          sess.timerId = null;
        }
        safe(() => sess.handle?.cancel?.());
        ctx.runInternalMut(() => {
          if (sess.container && ha(sess.container, 'data-ag-vtabs-gliding')) {
            ra(sess.container, 'data-ag-vtabs-gliding');
          }
          if (sess.container) ctx.deletePrevMark(sess.container, 'data-ag-vtabs-gliding');
          if (glideBarEl?.style) glideBarEl.style.opacity = '0';
        });
      }

      function unmountGlideBar() {
        cancelGlideSession();
        if (glideBarEl) {
          removeEl(glideBarEl);
          glideBarEl = null;
        }
      }

      function ensureGlideBarMounted(container) {
        const doc = ctx.doc;
        if (!doc || !container) return null;
        const strays = qa(doc, '.ag-cs-vtabs-glide-bar');
        for (let i = 0; i < strays.length; i++) {
          if (strays[i] !== glideBarEl) removeEl(strays[i]);
        }
        if (!glideBarEl) {
          const bar = markOwned(doc.createElement('div'), false);
          bar.className = 'ag-cs-vtabs-glide-bar';
          sa(bar, 'aria-hidden', 'true');
          if (bar.style) bar.style.opacity = '0';
          glideBarEl = bar;
        }
        if (glideBarEl.parentElement !== container) {
          container.appendChild(glideBarEl);
        }
        return glideBarEl;
      }

      function triggerActiveTabMotion(
        prevTab,
        nextTab,
        tabs,
        glideContainer,
        closeBtnOfNext,
        tier,
        blurFrozen,
        isResizing,
        effectiveCollapsed
      ) {
        const boundStrip = ctx.getBoundStrip();
        if (!prevTab || !nextTab || prevTab === nextTab) return;
        if (prevTab.isConnected === false || nextTab.isConnected === false) return;
        if (!boundStrip || !boundStrip.contains?.(prevTab) || !boundStrip.contains?.(nextTab)) {
          return;
        }
        if (
          (tier !== 'ultra' && tier !== 'standard') ||
          blurFrozen ||
          isResizing ||
          ctx.isDragging()
        ) {
          return;
        }
        if (ctx.doc?.hidden === true) return;
        if (!glideContainer) return;

        cancelGlideSession();

        const bar = ensureGlideBarMounted(glideContainer);
        if (!bar) return;

        const nextCat = ga(nextTab, 'data-ag-vtabs-cat') || 'other';
        const nextTone = ga(nextTab, 'data-ag-vtabs-tone') || '0';
        setAttrIfChanged(bar, 'data-ag-vtabs-cat', nextCat);
        setAttrIfChanged(bar, 'data-ag-vtabs-tone', nextTone);

        const barInset = effectiveCollapsed ? 1.5 : 2;
        const prevIdx = Math.max(0, tabs.indexOf(prevTab));
        const nextIdx = Math.max(0, tabs.indexOf(nextTab));
        const makeBarRect = (tabEl, idx) => {
          const r = safe(() => tabEl.getBoundingClientRect?.());
          if (r && Number.isFinite(r.top) && Number.isFinite(r.height) && r.height > 0) {
            return {
              left: (Number.isFinite(r.left) ? r.left : 0) + barInset,
              top: r.top + 4,
              width: 3,
              height: Math.max(12, r.height - 8),
            };
          }
          return { left: 4 + barInset, top: idx * 36 + 4, width: 3, height: 24 };
        };
        let prevBarRect = makeBarRect(prevTab, prevIdx);
        let nextBarRect = makeBarRect(nextTab, nextIdx);
        if (
          Math.abs(prevBarRect.top - nextBarRect.top) < 0.5 &&
          Math.abs(prevBarRect.left - nextBarRect.left) < 0.5 &&
          prevIdx !== nextIdx
        ) {
          prevBarRect = {
            left: prevBarRect.left,
            top: prevIdx * 36 + 4,
            width: 3,
            height: Math.max(12, prevBarRect.height),
          };
          nextBarRect = {
            left: nextBarRect.left,
            top: nextIdx * 36 + 4,
            width: 3,
            height: Math.max(12, nextBarRect.height),
          };
        }

        const containerRect = safe(() => glideContainer.getBoundingClientRect?.()) || null;
        const cTop = containerRect && Number.isFinite(containerRect.top) ? containerRect.top : 0;
        const cLeft = containerRect && Number.isFinite(containerRect.left) ? containerRect.left : 0;
        const cClientTop = Number.isFinite(glideContainer.clientTop) ? glideContainer.clientTop : 0;
        const cClientLeft = Number.isFinite(glideContainer.clientLeft)
          ? glideContainer.clientLeft
          : 0;
        const cScrollTop = Number.isFinite(glideContainer.scrollTop) ? glideContainer.scrollTop : 0;
        const cScrollLeft = Number.isFinite(glideContainer.scrollLeft)
          ? glideContainer.scrollLeft
          : 0;
        const barTop = Math.max(0, nextBarRect.top - cTop - cClientTop + cScrollTop);
        const barLeft = containerRect
          ? Math.max(0, nextBarRect.left - cLeft - cClientLeft + cScrollLeft)
          : 6;

        ctx.runInternalMut(() => {
          if (bar.style) {
            bar.style.left = `${barLeft}px`;
            bar.style.top = `${barTop}px`;
            bar.style.height = `${nextBarRect.height}px`;
            bar.style.opacity = '1';
          }
          setAttrIfChanged(glideContainer, 'data-ag-vtabs-gliding', '1');
          ctx.recordPrevMark(glideContainer, 'data-ag-vtabs-gliding');
        });

        const eng = ctx.win?.__agMotionEngine || G.__agMotionEngine;
        let handle = null;
        if (isFn(eng?.glideIndicator)) {
          handle = safe(() =>
            eng.glideIndicator(bar, prevBarRect, nextBarRect, {
              stiffness: 430,
              damping: 30,
              mass: 0.9,
              motionTier: tier,
            })
          );
        }
        if (!handle && isFn(bar.animate)) {
          const dy = prevBarRect.top - nextBarRect.top;
          const sy = prevBarRect.height / Math.max(1, nextBarRect.height);
          const anim = safe(() =>
            bar.animate(
              [
                { transform: `translate3d(0, ${dy.toFixed(2)}px, 0) scaleY(${sy.toFixed(4)})` },
                { transform: 'translate3d(0, 0, 0) scaleY(1)' },
              ],
              { duration: 240, easing: 'cubic-bezier(0.22, 1.25, 0.36, 1)' }
            )
          );
          if (anim) {
            handle = {
              durationMs: 240,
              finished: anim.finished,
              cancel: () => safe(() => anim.cancel?.()),
            };
          }
        }

        if (!handle) {
          ctx.runInternalMut(() => {
            if (ha(glideContainer, 'data-ag-vtabs-gliding')) {
              ra(glideContainer, 'data-ag-vtabs-gliding');
            }
            ctx.deletePrevMark(glideContainer, 'data-ag-vtabs-gliding');
            if (bar.style) bar.style.opacity = '0';
          });
        } else {
          const session = { handle, timerId: null, container: glideContainer };
          const finishGlide = (fromTimeout) => {
            if (glideSession !== session) return;
            if (session.timerId !== null) {
              safe(() => ctx.clrT(session.timerId));
              session.timerId = null;
            }
            glideSession = null;
            if (fromTimeout) safe(() => session.handle?.cancel?.());
            if (ctx.isDestroyed()) return;
            ctx.runInternalMut(() => {
              if (ha(session.container, 'data-ag-vtabs-gliding')) {
                ra(session.container, 'data-ag-vtabs-gliding');
              }
              ctx.deletePrevMark(session.container, 'data-ag-vtabs-gliding');
              if (glideBarEl?.style) glideBarEl.style.opacity = '0';
            });
          };

          const rawDur = Number(handle?.durationMs);
          const safetyMs = Math.max(
            GLIDE_SAFETY_MS,
            (Number.isFinite(rawDur) && rawDur > 0 ? rawDur : 0) + 120
          );
          session.timerId = ctx.setT(() => finishGlide(true), safetyMs);
          glideSession = session;

          const donePromise = isFn(handle?.finished?.then)
            ? handle.finished
            : isFn(handle?.then)
              ? handle
              : null;
          if (donePromise) {
            donePromise.then(
              () => finishGlide(false),
              () => finishGlide(false)
            );
          }
        }

        const iconEl = findTabIconTarget(nextTab, closeBtnOfNext);
        if (iconEl && isFn(eng?.spring)) {
          const popHandle = safe(() =>
            eng.spring(
              iconEl,
              [
                { transform: 'scale(0.84)' },
                { transform: 'scale(1.15)' },
                { transform: 'scale(1)' },
              ],
              { stiffness: 450, damping: 22, mass: 0.85, slot: 'vtab-active', motionTier: tier }
            )
          );
          iconPopHandle = popHandle || null;
          const popDone = isFn(popHandle?.finished?.then)
            ? popHandle.finished
            : isFn(popHandle?.then)
              ? popHandle
              : null;
          if (popDone) {
            popDone.then(
              () => {
                if (iconPopHandle === popHandle) iconPopHandle = null;
              },
              () => {
                if (iconPopHandle === popHandle) iconPopHandle = null;
              }
            );
          }
        }
      }

      function clearTabCausticAndReady(tab) {
        if (!tab) return;
        const tid = causticTimers.get(tab);
        if (tid !== undefined) {
          safe(() => ctx.clrT(tid));
          causticTimers.delete(tab);
        }
        readyTabs.delete(tab);
        if (ha(tab, 'data-ag-vtabs-caustic')) ra(tab, 'data-ag-vtabs-caustic');
        if (ha(tab, 'data-ag-vtabs-ready')) ra(tab, 'data-ag-vtabs-ready');
        ctx.deletePrevMark(tab, 'data-ag-vtabs-caustic');
        ctx.deletePrevMark(tab, 'data-ag-vtabs-ready');
      }

      function clearAllCausticsAndReady() {
        for (const [tab, tid] of causticTimers.entries()) {
          safe(() => ctx.clrT(tid));
          if (ha(tab, 'data-ag-vtabs-caustic')) ra(tab, 'data-ag-vtabs-caustic');
          ctx.deletePrevMark(tab, 'data-ag-vtabs-caustic');
        }
        causticTimers.clear();
        for (const tab of readyTabs) {
          if (ha(tab, 'data-ag-vtabs-ready')) ra(tab, 'data-ag-vtabs-ready');
          ctx.deletePrevMark(tab, 'data-ag-vtabs-ready');
        }
        readyTabs.clear();
      }

      function processTabBtwState(info, opts) {
        const { tab, matchedRedux, cat, sqCascadeId, stableId, runKey, active } = info;
        const {
          reduxState,
          body,
          agentMgr,
          subProv,
          motionTier,
          blurFrozen,
          runningBtwSqIds,
        } = opts;

        const prevIdent = lastTabIdentityByEl.get(tab);
        if (prevIdent && (prevIdent.cat !== cat || prevIdent.stableId !== stableId)) {
          clearTabCausticAndReady(tab);
          if (!stableId) btwRunMap.delete(tab);
        }
        lastTabIdentityByEl.set(tab, { cat, stableId });

        if (cat !== 'btw') {
          clearTabCausticAndReady(tab);
          return;
        }

        if (active) readyTabs.delete(tab);
        const prevEntry = btwRunMap.get(runKey);
        const nextRun = detectBtwRunning(
          tab,
          matchedRedux,
          reduxState,
          active,
          body,
          ctx.doc,
          agentMgr,
          sqCascadeId,
          subProv
        );
        if (nextRun.running && sqCascadeId) runningBtwSqIds.add(sqCascadeId);

        const switchedAwayFromActiveOnly = Boolean(
          prevEntry && prevEntry.scope === 'active' && prevEntry.wasActive === true && !active
        );
        if (
          prevEntry &&
          prevEntry.running === true &&
          !nextRun.running &&
          !switchedAwayFromActiveOnly
        ) {
          if (
            (motionTier === 'ultra' || motionTier === 'standard') &&
            ctx.doc?.hidden !== true &&
            !blurFrozen
          ) {
            const oldTid = causticTimers.get(tab);
            if (oldTid !== undefined) safe(() => ctx.clrT(oldTid));
            const tid = ctx.setT(() => {
              causticTimers.delete(tab);
              if (ctx.isDestroyed()) return;
              ctx.runInternalMut(() => {
                if (ha(tab, 'data-ag-vtabs-caustic')) ra(tab, 'data-ag-vtabs-caustic');
                ctx.deletePrevMark(tab, 'data-ag-vtabs-caustic');
              });
            }, CAUSTIC_DURATION_MS);
            causticTimers.set(tab, tid);
          }
          if (!active) readyTabs.add(tab);
          else readyTabs.delete(tab);
        }

        btwRunMap.set(runKey, {
          running: nextRun.running,
          scope: nextRun.scope,
          wasActive: active,
          cat: 'btw',
        });
      }

      function pruneStaleTabState(currentRunKeys, currentTabEls) {
        for (const k of Array.from(btwRunMap.keys())) {
          if (!currentRunKeys.has(k)) btwRunMap.delete(k);
        }
        for (const t of Array.from(lastTabIdentityByEl.keys())) {
          if (!currentTabEls.has(t)) lastTabIdentityByEl.delete(t);
        }
        for (const [t, tid] of Array.from(causticTimers.entries())) {
          if (!currentTabEls.has(t)) {
            safe(() => ctx.clrT(tid));
            causticTimers.delete(t);
          }
        }
        for (const t of Array.from(readyTabs)) {
          if (!currentTabEls.has(t)) readyTabs.delete(t);
        }
      }

      return {
        cancelGlideSession,
        unmountGlideBar,
        ensureGlideBarMounted,
        triggerActiveTabMotion,
        clearTabCausticAndReady,
        clearAllCausticsAndReady,
        processTabBtwState,
        pruneStaleTabState,
        isTabCaustic: (tab) => causticTimers.has(tab),
        isTabReady: (tab) => readyTabs.has(tab),
        getGlideBarEl: () => glideBarEl,
        getGlideSession: () => glideSession,
        getPrevActiveTab: () => prevActiveTab,
        setPrevActiveTab: (tab) => {
          prevActiveTab = tab;
        },
        hasTimersOrState: () =>
          Boolean(glideBarEl || glideSession || causticTimers.size > 0 || readyTabs.size > 0),
        resetForScopeChange: () => {
          btwRunMap.clear();
          lastTabIdentityByEl.clear();
          clearAllCausticsAndReady();
          cancelGlideSession();
          prevActiveTab = null;
        },
        resetForUnbind: () => {
          prevActiveTab = null;
          btwRunMap.clear();
          lastTabIdentityByEl.clear();
        },
      };
    }

    Object.assign(ns, {
      createVtabsMotionManager,
    });
  }

  if (typeof __vtabsInit === 'function') {
    __vtabsInit(init);
  } else if (typeof module === 'object' && module && module.exports) {
    module.exports = init;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
