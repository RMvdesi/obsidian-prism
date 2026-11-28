// Obsidian Prism - Right Side Panel Vertical Tabs Read-Only Fiber/Redux/AgentState (vtabs-fiber.js)
(function (G) {
  'use strict';

  function init(ns) {
    const { REDUX_MISS_COOLDOWN_MS, safe, isFn, ga, qs, qa, isTreeVisible, isOwnNode, getTabId } = ns;
    const CASCADE_RUNNING_STR_RE = /running|canceling|busy|streaming|in_progress|loading/i;

    const isReduxStoreLike = (s) => Boolean(s && typeof s === 'object' && safe(() => isFn(s.getState)));
    const isAgentStateMgr = (v) =>
      Boolean(v && typeof v === 'object' && safe(() => isFn(v.getAgentStates) && isFn(v.peek) && isFn(v.subscribe)));

    function inspectFiberHostTargets(obj, needStore, needAgentMgr) {
      let store = null;
      let agentMgr = null;
      if (!obj || typeof obj !== 'object') return { store, agentMgr };
      safe(() => {
        const mp = safe(() => obj.memoizedProps);
        const pp = safe(() => obj.pendingProps);
        const mpVal = safe(() => mp?.value);
        const ppVal = safe(() => pp?.value);
        const objVal = safe(() => obj.value);
        if (needStore) {
          const sCands = [safe(() => mpVal?.store), safe(() => ppVal?.store), safe(() => mp?.store), safe(() => pp?.store), safe(() => objVal?.store), safe(() => obj.store)];
          for (let i = 0; i < sCands.length; i++) if (isReduxStoreLike(sCands[i])) { store = sCands[i]; break; }
        }
        if (needAgentMgr) {
          const aCands = [mpVal, safe(() => mpVal?.agentStateManager), ppVal, safe(() => ppVal?.agentStateManager), safe(() => mp?.agentStateManager), safe(() => pp?.agentStateManager), objVal, safe(() => objVal?.agentStateManager), safe(() => obj.agentStateManager), obj];
          for (let i = 0; i < aCands.length; i++) if (isAgentStateMgr(aCands[i])) { agentMgr = aCands[i]; break; }
        }
      });
      return { store, agentMgr };
    }

    function findReadOnlyHostContext(doc, strip, needStore, needAgentMgr) {
      const empty = { store: null, agentMgr: null };
      if (!doc || (!needStore && !needAgentMgr)) return empty;
      return safe(() => {
        let foundStore = null;
        let foundAgentMgr = null;
        const done = () => (!needStore || Boolean(foundStore)) && (!needAgentMgr || Boolean(foundAgentMgr));
        const probe = (node) => {
          const hit = inspectFiberHostTargets(node, needStore && !foundStore, needAgentMgr && !foundAgentMgr);
          if (hit.store && !foundStore) foundStore = hit.store;
          if (hit.agentMgr && !foundAgentMgr) foundAgentMgr = hit.agentMgr;
          return done();
        };
        const seen = new WeakSet();
        const queue = [];
        const enqueue = (n) => { if (n && typeof n === 'object' && !seen.has(n)) { seen.add(n); queue.push(n); } };
        const roots = [strip, strip?.parentElement, qs(doc, '[data-testid="aux-pane-split"]'), qs(doc, '[data-testid="conversation-view"]'), doc.getElementById?.('root'), doc.body?.firstElementChild, doc.body];
        for (let rIdx = 0; rIdx < roots.length; rIdx++) {
          const r = roots[rIdx];
          if (!r || typeof r !== 'object') continue;
          const keys = safe(() => Object.keys(r)) || [];
          for (let kIdx = 0; kIdx < keys.length; kIdx++) {
            const k = keys[kIdx];
            if (k.startsWith('__reactProps$')) {
              if (probe(safe(() => r[k]))) return { store: foundStore, agentMgr: foundAgentMgr };
              continue;
            }
            if (!k.startsWith('__reactFiber$') && !k.startsWith('__reactContainer$')) continue;
            const val = safe(() => r[k]);
            if (!val || typeof val !== 'object') continue;
            const starts = [safe(() => val.current), safe(() => val.stateNode?.current), val];
            for (let sIdx = 0; sIdx < starts.length; sIdx++) {
              const s0 = starts[sIdx];
              if (!s0 || typeof s0 !== 'object') continue;
              let cur = s0;
              for (let depth = 0; cur && typeof cur === 'object' && depth < 256 && !seen.has(cur); depth++) {
                seen.add(cur);
                if (probe(cur)) return { store: foundStore, agentMgr: foundAgentMgr };
                if (cur === s0) { enqueue(safe(() => cur.child)); enqueue(safe(() => cur.sibling)); }
                cur = safe(() => cur.return);
              }
            }
          }
        }
        for (let qIdx = 0; qIdx < queue.length && qIdx < 2500; qIdx++) {
          const f = queue[qIdx];
          if (probe(f)) return { store: foundStore, agentMgr: foundAgentMgr };
          enqueue(safe(() => f.child));
          enqueue(safe(() => f.sibling));
        }
        return { store: foundStore, agentMgr: foundAgentMgr };
      }) || empty;
    }

    function findFocusedCascadeFromLayout(layoutState) {
      return safe(() => {
        if (!layoutState || typeof layoutState !== 'object') return '';
        const focusedId = layoutState.focusedPaneId;
        if (!layoutState.rootNode) return typeof focusedId === 'string' && focusedId ? focusedId : '';
        const panes = [];
        const visited = new WeakSet();
        let nodeCount = 0;
        const walk = (node, depth) => {
          if (!node || typeof node !== 'object' || depth > 32 || nodeCount >= 512 || visited.has(node)) return;
          visited.add(node);
          nodeCount += 1;
          const nodeType = safe(() => node.type);
          const kids = safe(() => node.children);
          const hasKids = Array.isArray(kids) && kids.length > 0;
          if (nodeType === 'pane' || nodeType === 'leaf' || (!hasKids && typeof safe(() => node.cascadeId) === 'string' && node.cascadeId)) {
            panes.push(node);
            return;
          }
          if (hasKids) for (let i = 0; i < kids.length && nodeCount < 512; i++) walk(kids[i], depth + 1);
        };
        walk(layoutState.rootNode, 0);
        const hit = panes.find((p) => safe(() => p.id === focusedId || p.cascadeId === focusedId)) || panes[0] || null;
        const hitCid = safe(() => hit?.cascadeId);
        if (typeof hitCid === 'string' && hitCid) return hitCid;
        return typeof focusedId === 'string' && focusedId ? focusedId : '';
      }) || '';
    }

    function resolveReadOnlyReduxContext(doc, win, strip, store) {
      const state = store ? safe(() => store.getState()) || null : null;
      let cascadeId = state ? findFocusedCascadeFromLayout(safe(() => state.multiConvoLayout)) : '';
      if (!cascadeId) {
        const pathname = String(safe(() => win?.location?.pathname || G.location?.pathname) || '');
        const m = pathname.match(/\/c\/([^/?#]+)/);
        if (m?.[1]) cascadeId = safe(() => decodeURIComponent(m[1])) || m[1];
      }
      if (!cascadeId && doc) {
        const activePane = qs(doc, '[data-tiling-pane][data-focused="true"] [data-cascade-id]') || qs(doc, '[data-testid="conversation-view"][data-cascade-id]') || qs(doc, '[data-cascade-id]');
        cascadeId = String(ga(activePane, 'data-cascade-id') || '').trim();
      }
      const search = String(safe(() => win?.location?.search || G.location?.search) || '');
      const projectId = search ? safe(() => new URLSearchParams(search).get('project') || '') || '' : '';

      const pane = safe(() => {
        const sliceObj = state?.sidePanelV2 || state?.sidePanel || null;
        if (!sliceObj || typeof sliceObj !== 'object') return null;
        const convPanes = sliceObj.conversationPanes;
        if (cascadeId && convPanes && typeof convPanes === 'object' && convPanes[cascadeId]) return convPanes[cascadeId];
        const newConvPanes = sliceObj.newConversationPanes;
        if (projectId && newConvPanes && typeof newConvPanes === 'object' && newConvPanes[projectId]) return newConvPanes[projectId];
        if (sliceObj.homePane && (!cascadeId || !convPanes)) return sliceObj.homePane;
        if (convPanes && typeof convPanes === 'object') {
          const paneKeys = Object.keys(convPanes);
          if (paneKeys.length === 1) return convPanes[paneKeys[0]];
        }
        if (Array.isArray(sliceObj.tabs)) return sliceObj;
        return sliceObj.homePane || null;
      }) || null;

      const rawTabs = safe(() => pane?.tabs);
      return { state, cascadeId, pane, reduxTabs: Array.isArray(rawTabs) ? rawTabs : [] };
    }

    function matchReduxTab(tab, idx, visibleText, domCount, reduxTabs, claimed, tabId, closeBtn) {
      if (!reduxTabs || !reduxTabs.length) return null;
      return safe(() => {
        const isFree = (rt) => Boolean(rt && typeof rt === 'object' && (!claimed || !claimed.has(rt)));
        const claim = (rt) => { if (claimed && rt) claimed.add(rt); return rt; };
        const domId = String(tabId || getTabId(tab, closeBtn) || '').trim();
        if (domId) {
          for (let i = 0; i < reduxTabs.length; i++) {
            const rt = reduxTabs[i];
            if (!isFree(rt)) continue;
            const rid = String(safe(() => rt.id || rt.tabId) || '').trim();
            if (rid && rid === domId) return claim(rt);
          }
        }
        const normTitle = String(visibleText || '').trim().toLowerCase();
        const titleOf = (rt) => String(safe(() => rt.title || rt.label || rt.content?.title) || '').trim().toLowerCase();
        if (normTitle && domCount === reduxTabs.length && idx < reduxTabs.length) {
          const atIdx = reduxTabs[idx];
          if (isFree(atIdx) && titleOf(atIdx) === normTitle) return claim(atIdx);
        }
        if (normTitle) {
          for (let i = 0; i < reduxTabs.length; i++) {
            const rt = reduxTabs[i];
            if (isFree(rt) && titleOf(rt) === normTitle) return claim(rt);
          }
        }
        if (domCount === reduxTabs.length && idx < reduxTabs.length && isFree(reduxTabs[idx])) return claim(reduxTabs[idx]);
        return null;
      }) || null;
    }

    function classifyFromReduxTab(rt) {
      if (!rt || typeof rt !== 'object') return '';
      return safe(() => {
        const content = rt.content && typeof rt.content === 'object' ? rt.content : {};
        const cType = String(content.type || rt.type || '');
        const customKey = String(content.customView?.customPaneKey || content.customPaneKey || rt.customPaneKey || '');
        const tid = String(rt.id || rt.tabId || '');
        if (cType === 'sideQuestionView' || /^side[_-]?question/i.test(tid)) return 'btw';
        if ((cType === 'customView' && /^browser$/i.test(customKey)) || /^browser/i.test(tid) || /browser/i.test(cType)) return 'browser';
        if (/diff|review|changes/i.test(cType) || /diff|review|changes/i.test(customKey)) return 'diff';
        if (/terminal|pty|shell/i.test(cType) || /terminal|pty|shell/i.test(customKey)) return 'term';
        if (/artifact|file|editor|document|markdown|pdf|preview/i.test(cType) || /artifact|file|editor|document|markdown|pdf|preview/i.test(customKey)) return 'doc';
        if (/subagent|customView|plugin|mcp|swarm/i.test(cType) || /subagent|plugin|mcp|swarm/i.test(customKey)) return 'plugin';
        return '';
      }) || '';
    }

    function isStatusValueRunning(v) {
      if (v === 2 || v === 3 || v === 4) return true;
      if (v === 0 || v === 1 || v === null || v === undefined || v === false) return false;
      return typeof v === 'string' && CASCADE_RUNNING_STR_RE.test(v);
    }

    function isCascadeStatusRunning(st) {
      if (st === null || st === undefined) return false;
      if (typeof st === 'number' || typeof st === 'string') return isStatusValueRunning(st);
      if (typeof st !== 'object') return false;
      return Boolean(safe(() => isStatusValueRunning(st.status) || isStatusValueRunning(st.executorLoopStatus)));
    }

    function extractSideQuestionCascadeId(matchedRedux, tabId) {
      const raw = String(
        safe(() => matchedRedux?.content?.sideQuestionView?.cascadeId || matchedRedux?.sideQuestionView?.cascadeId) ||
        (tabId && tabId.startsWith('side_question__') ? tabId.slice('side_question__'.length) : '') || ''
      ).trim();
      return !raw || raw.toLowerCase() === 'draft' ? '' : raw;
    }

    function readEphemeralForkQueryData(reduxState, sqCascadeId) {
      if (!sqCascadeId || !reduxState) return null;
      return safe(() => {
        const queries = reduxState.ephemeralForkTrajectoriesApi?.queries;
        if (!queries || typeof queries !== 'object') return null;
        const direct = queries[sqCascadeId];
        if (direct && typeof direct === 'object') return direct.data ?? null;
        const keys = Object.keys(queries);
        for (let i = 0; i < keys.length && i < 64; i++) {
          const k = keys[i];
          const q = queries[k];
          if (!q || typeof q !== 'object') continue;
          const arg = q.originalArgs;
          if (arg === sqCascadeId || arg?.cascadeId === sqCascadeId || k.includes(sqCascadeId)) return q.data ?? null;
        }
        return null;
      }) || null;
    }

    function isObjRunningFlag(obj) {
      if (!obj || typeof obj !== 'object') return false;
      return Boolean(safe(() =>
        obj.running === true || obj.isRunning === true || obj.streaming === true ||
        obj.isStreaming === true || obj.inProgress === true || obj.loading === true ||
        isCascadeStatusRunning(obj)
      ));
    }

    function hasVisibleSelector(scope, sel, doc) {
      if (!scope) return false;
      const list = qa(scope, sel);
      for (let i = 0; i < list.length; i++) if (!isOwnNode(list[i]) && isTreeVisible(list[i], doc)) return true;
      return false;
    }

    function detectBtwRunning(tab, matchedReduxTab, reduxState, active, bodyEl, doc, agentMgr, sqCascadeId, subProvider) {
      if (sqCascadeId && (agentMgr || subProvider)) {
        const prov = safe(() => agentMgr?.peek?.(sqCascadeId)) || subProvider || null;
        if (isCascadeStatusRunning(safe(() => prov?.getState?.()))) return { running: true, scope: 'tab' };
      }
      if (sqCascadeId && reduxState) {
        if (isCascadeStatusRunning(readEphemeralForkQueryData(reduxState, sqCascadeId))) return { running: true, scope: 'tab' };
        const tsRunning = Boolean(safe(() => {
          const ts = reduxState.trajectorySummaries;
          if (!ts || typeof ts !== 'object') return false;
          return Boolean(ts.indexes?.active?.[sqCascadeId] || isCascadeStatusRunning(ts.summaries?.[sqCascadeId]));
        }));
        if (tsRunning) return { running: true, scope: 'tab' };
      }
      const tabReduxRunning = Boolean(safe(() => {
        if (!matchedReduxTab) return false;
        if (isObjRunningFlag(matchedReduxTab) || isObjRunningFlag(matchedReduxTab.content) || isObjRunningFlag(matchedReduxTab.content?.sideQuestionView)) return true;
        const sqId = sqCascadeId || matchedReduxTab.content?.sideQuestionView?.cascadeId || matchedReduxTab.content?.sideQuestionView?.id || matchedReduxTab.sideQuestionId || matchedReduxTab.cascadeId || matchedReduxTab.id || matchedReduxTab.tabId || '';
        if (sqId && reduxState) {
          const hit = reduxState.sideQuestion?.byId?.[sqId] || reduxState.sideQuestion?.sessions?.[sqId] || reduxState.sideQuestions?.[sqId] || reduxState.cascades?.[sqId] || null;
          if (isObjRunningFlag(hit)) return true;
        }
        return false;
      }));
      if (tabReduxRunning) return { running: true, scope: 'tab' };
      if (hasVisibleSelector(tab, '[data-testid="status-loading-spinner"], [data-testid="status-task-running"], .animate-spin', doc)) {
        return { running: true, scope: 'tab' };
      }
      if (active) {
        if (safe(() => isObjRunningFlag(reduxState?.sideQuestion))) return { running: true, scope: 'active' };
        if (bodyEl) {
          const sqScopes = qa(bodyEl, '[data-testid="side-question-conversation"], [data-testid="side-question-panel"]');
          for (let i = 0; i < sqScopes.length; i++) {
            if (!isTreeVisible(sqScopes[i], doc)) continue;
            if (hasVisibleSelector(sqScopes[i], '[data-testid="input-cancel-button"], [data-testid="status-loading-spinner"]', doc)) {
              return { running: true, scope: 'active' };
            }
          }
        }
      }
      return { running: false, scope: 'none' };
    }

    function extractUnsubFn(sub) {
      if (isFn(sub?.unsubscribe)) return () => sub.unsubscribe();
      if (isFn(sub?.dispose)) return () => sub.dispose();
      return isFn(sub) ? sub : null;
    }

    function captureReduxRelevantSnap(st, sqIds) {
      if (!st || typeof st !== 'object') return null;
      return safe(() => {
        let sqSig = '';
        if (Array.isArray(sqIds) && sqIds.length > 0) {
          const parts = [];
          const ts = st.trajectorySummaries;
          for (let i = 0; i < sqIds.length; i++) {
            const id = sqIds[i];
            const efRun = isCascadeStatusRunning(readEphemeralForkQueryData(st, id)) ? '1' : '0';
            const tsAct = ts?.indexes?.active?.[id] ? '1' : '0';
            const tsSum = isCascadeStatusRunning(ts?.summaries?.[id]) ? '1' : '0';
            parts.push(`${id}:${efRun}${tsAct}${tsSum}`);
          }
          sqSig = parts.join('|');
        }
        return { sidePanelV2: st.sidePanelV2, sidePanel: st.sidePanel, sideQuestion: st.sideQuestion, multiConvoLayout: st.multiConvoLayout, sqSig };
      }) || null;
    }

    function hasReduxRelevantChange(prev, next) {
      if (!prev || !next) return prev !== next;
      return prev.sidePanelV2 !== next.sidePanelV2 || prev.sidePanel !== next.sidePanel || prev.sideQuestion !== next.sideQuestion || prev.multiConvoLayout !== next.multiConvoLayout || prev.sqSig !== next.sqSig;
    }

    function createHostSubscriptionManager(ctx) {
      let cachedReduxStore = null;
      let cachedAgentMgr = null;
      let lastStoreMissAt = 0;
      let lastAgentMissAt = 0;
      const btwAgentSubs = new Map();
      let syncingSubs = false;
      let reduxSubStore = null;
      let reduxUnsub = null;
      let lastReduxSnap = null;
      let trackedBtwSqIds = [];

      function invalidate() { cachedReduxStore = null; cachedAgentMgr = null; lastStoreMissAt = 0; lastAgentMissAt = 0; }

      function getCachedHostContext(strip) {
        if (cachedReduxStore && !isReduxStoreLike(cachedReduxStore)) cachedReduxStore = null;
        if (cachedAgentMgr && !isAgentStateMgr(cachedAgentMgr)) cachedAgentMgr = null;
        const now = Date.now();
        const wantStore = !cachedReduxStore && !(lastStoreMissAt > 0 && now - lastStoreMissAt < REDUX_MISS_COOLDOWN_MS);
        const wantAgent = !cachedAgentMgr && !(lastAgentMissAt > 0 && now - lastAgentMissAt < REDUX_MISS_COOLDOWN_MS);
        if (wantStore || wantAgent) {
          const found = findReadOnlyHostContext(ctx.doc, strip, wantStore, wantAgent);
          if (wantStore) { if (found.store) { cachedReduxStore = found.store; lastStoreMissAt = 0; } else lastStoreMissAt = now; }
          if (wantAgent) { if (found.agentMgr) { cachedAgentMgr = found.agentMgr; lastAgentMissAt = 0; } else lastAgentMissAt = now; }
        }
        return { store: cachedReduxStore, agentMgr: cachedAgentMgr };
      }

      function disposeEntry(entry) {
        if (!entry) return;
        const d = entry.dispose;
        const u = entry.unsubscribe;
        entry.dispose = null;
        entry.unsubscribe = null;
        if (d) safe(d);
        if (u) safe(u);
      }

      function teardownReduxSub() {
        const u = reduxUnsub;
        reduxUnsub = null;
        reduxSubStore = null;
        lastReduxSnap = null;
        trackedBtwSqIds = [];
        if (u) safe(u);
      }

      function teardownAll() {
        for (const entry of btwAgentSubs.values()) disposeEntry(entry);
        btwAgentSubs.clear();
        teardownReduxSub();
      }

      function attachProviderDidChange(entry, sqId, prov, agentMgr) {
        if (!entry || !prov || !isFn(prov.onDidChange) || entry.dispose) return;
        const disp = safe(() => prov.onDidChange(() => {
          if (syncingSubs || !ctx.isActive()) return;
          if (!entry.unsubscribe && agentMgr && isCascadeStatusRunning(safe(() => prov.getState?.()))) {
            const prevSync = syncingSubs;
            syncingSubs = true;
            try { entry.unsubscribe = extractUnsubFn(safe(() => agentMgr.subscribe?.(sqId))); }
            finally { syncingSubs = prevSync; }
          }
          ctx.scheduleSync();
        }));
        entry.dispose = extractUnsubFn(disp);
      }

      function syncBtwLiveSubscriptions(agentMgr, reduxStore, reduxState, activeBtwSqIds, runningBtwSqIds) {
        const prevSyncing = syncingSubs;
        syncingSubs = true;
        try {
          for (const [sqId, entry] of Array.from(btwAgentSubs.entries())) {
            if (!activeBtwSqIds.has(sqId) || !agentMgr) { disposeEntry(entry); btwAgentSubs.delete(sqId); }
          }
          if (agentMgr && activeBtwSqIds.size > 0) {
            for (const sqId of activeBtwSqIds) {
              const isRunningFromScan = Boolean(runningBtwSqIds?.has(sqId));
              let entry = btwAgentSubs.get(sqId) || null;
              let prov = safe(() => agentMgr.peek?.(sqId)) || null;
              if (!prov) {
                if (isRunningFromScan) {
                  if (!entry) { entry = { provider: null, dispose: null, unsubscribe: null }; btwAgentSubs.set(sqId, entry); }
                  if (!entry.unsubscribe) {
                    const sub = safe(() => agentMgr.subscribe?.(sqId));
                    entry.unsubscribe = extractUnsubFn(sub);
                    prov = safe(() => sub?.agentStateProvider) || safe(() => agentMgr.peek?.(sqId)) || null;
                  } else {
                    prov = entry.provider || safe(() => agentMgr.peek?.(sqId)) || null;
                  }
                  if (prov) {
                    if (entry.provider && entry.provider !== prov) { const oldD = entry.dispose; entry.dispose = null; if (oldD) safe(oldD); }
                    entry.provider = prov;
                    attachProviderDidChange(entry, sqId, prov, agentMgr);
                  }
                } else if (entry) { disposeEntry(entry); btwAgentSubs.delete(sqId); }
                continue;
              }
              if (entry && entry.provider && entry.provider !== prov) { disposeEntry(entry); btwAgentSubs.delete(sqId); entry = null; }
              if (!entry) { entry = { provider: prov, dispose: null, unsubscribe: null }; btwAgentSubs.set(sqId, entry); }
              else entry.provider = prov;
              attachProviderDidChange(entry, sqId, prov, agentMgr);
              const shouldHoldSub = isCascadeStatusRunning(safe(() => prov.getState?.())) || isRunningFromScan;
              if (shouldHoldSub && !entry.unsubscribe) {
                const sub = safe(() => agentMgr.subscribe?.(sqId));
                entry.unsubscribe = extractUnsubFn(sub);
                const subProv = safe(() => sub?.agentStateProvider);
                if (subProv && !entry.dispose) { entry.provider = subProv; attachProviderDidChange(entry, sqId, subProv, agentMgr); }
              } else if (!shouldHoldSub && entry.unsubscribe) {
                const u = entry.unsubscribe; entry.unsubscribe = null; safe(u);
              }
            }
          }
          if (activeBtwSqIds.size > 0 && reduxStore && isFn(reduxStore.subscribe)) {
            trackedBtwSqIds = Array.from(activeBtwSqIds);
            lastReduxSnap = captureReduxRelevantSnap(reduxState, trackedBtwSqIds);
            if (reduxSubStore !== reduxStore || !reduxUnsub) {
              const oldU = reduxUnsub; reduxUnsub = null; reduxSubStore = null; if (oldU) safe(oldU);
              const targetStore = reduxStore;
              reduxSubStore = targetStore;
              reduxUnsub = extractUnsubFn(safe(() => targetStore.subscribe(() => {
                if (!ctx.isActive() || !ctx.getBoundStrip() || trackedBtwSqIds.length === 0) return;
                const nextSnap = captureReduxRelevantSnap(safe(() => targetStore.getState?.()) || null, trackedBtwSqIds);
                if (!hasReduxRelevantChange(lastReduxSnap, nextSnap)) return;
                lastReduxSnap = nextSnap;
                ctx.scheduleSync();
              })));
            }
          } else teardownReduxSub();
        } finally { syncingSubs = prevSyncing; }
      }

      return {
        invalidate, getCachedHostContext,
        getBtwSubProvider: (sqId) => (sqId ? btwAgentSubs.get(sqId)?.provider || null : null),
        syncBtwLiveSubscriptions,
        hasActiveSubscriptions: () => btwAgentSubs.size > 0 || Boolean(reduxUnsub),
        teardownAll,
      };
    }

    Object.assign(ns, {
      isReduxStoreLike, isAgentStateMgr, inspectFiberHostTargets, findReadOnlyHostContext,
      findFocusedCascadeFromLayout, resolveReadOnlyReduxContext, matchReduxTab,
      classifyFromReduxTab, isStatusValueRunning, isCascadeStatusRunning,
      extractSideQuestionCascadeId, readEphemeralForkQueryData, isObjRunningFlag,
      hasVisibleSelector, detectBtwRunning, createHostSubscriptionManager,
    });
  }

  if (typeof __vtabsInit === 'function') __vtabsInit(init);
  else if (typeof module === 'object' && module && module.exports) module.exports = init;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
