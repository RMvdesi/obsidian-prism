// Obsidian Prism — Studio Home Telemetry Dashboard & Rollup Cache Module (home-studio-panel.js)
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const MAX_FRONTEND_TRAJECTORY_STEPS = 240;
  const MAX_CACHED_USAGE_RECORDS = 1200;
  const STUDIO_STYLE_ID = 'ag-prism-studio-v101-css';
  function markNoTr(e) {
    if (e && e.setAttribute) for (const s of 'translate=no,data-no-translate=true,data-ag-localization-skip=true,data-agy-no-translate=true,data-antigravity-zh-skip=1'.split(',')) { const p = s.split('='); e.setAttribute(p[0], p[1]); }
    return e;
  }

  const STUDIO_EXTRA_CSS =
    '.ag-cs-home-head-right{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.ag-cs-home-ws-select{height:24px;max-width:156px;padding:0 20px 0 8px;border-radius:var(--ag-cs-r-sm,6px);border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.2));background:var(--ag-cs-pill-bg,rgba(128,138,158,.1));color:var(--foreground);color-scheme:inherit;font-size:11px;font-weight:500;outline:none;cursor:pointer;text-overflow:ellipsis}' +
    '.ag-cs-home-ws-select option{background:var(--card,#141418);color:var(--foreground,#F2F2F5);}' +
    '.ag-cs-home-stat-sub{display:block;margin-top:2px;font-size:10px;line-height:1.25;color:var(--muted-foreground);opacity:.82;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ag-cs-quota-wrap{display:flex;flex-direction:column;gap:10px;margin-top:4px;position:relative;z-index:1}' +
    '.ag-cs-quota-toolbar,.ag-cs-quota-card-head,.ag-cs-quota-win-row{display:flex;align-items:center;justify-content:space-between;gap:6px}' +
    '.ag-cs-quota-toolbar{font-size:11px;color:var(--muted-foreground)}' +
    '.ag-cs-quota-refresh{height:23px;padding:0 9px;border-radius:var(--ag-cs-r-sm,6px);border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.22));background:var(--ag-cs-pill-bg,rgba(128,138,158,.08));color:var(--foreground);font-size:11px;cursor:pointer}' +
    '.ag-cs-quota-refresh:hover{background:rgba(128,138,158,.16)}' +
    '.ag-cs-quota-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}' +
    '.ag-cs-quota-card{padding:11px 12px;border-radius:var(--ag-cs-r-md,10px);border:1px solid var(--ag-cs-border-1,rgba(148,163,184,.18));background:var(--ag-cs-pill-bg,rgba(128,138,158,.06));display:flex;flex-direction:column;gap:8px;font-variant-numeric:tabular-nums}' +
    '.ag-cs-quota-name{font-size:12px;font-weight:600;color:var(--foreground)}' +
    '.ag-cs-quota-pace{padding:1.5px 6.5px;border-radius:999px;font-size:10px;font-weight:600;border:1px solid rgba(148,163,184,.24);color:var(--muted-foreground)}' +
    '.ag-cs-quota-pace[data-pace="ok"]{color:var(--ag-cs-accent,var(--primary,#2563eb));border-color:color-mix(in srgb,var(--ag-cs-accent,var(--primary,#2563eb)) 30%,transparent);background:color-mix(in srgb,var(--ag-cs-accent,var(--primary,#2563eb)) 10%,transparent)}' +
    '.ag-cs-quota-pace[data-pace="tight"]{color:#d97706;border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.12)}' +
    '.dark .ag-cs-quota-pace[data-pace="tight"]{color:#fbbf24}' +
    '.ag-cs-quota-pace[data-pace="low"]{color:#dc2626;border-color:rgba(239,68,68,.38);background:rgba(239,68,68,.12)}' +
    '.dark .ag-cs-quota-pace[data-pace="low"]{color:#f87171}' +
    '.ag-cs-quota-win{display:flex;flex-direction:column;gap:4px}' +
    '.ag-cs-quota-win-row{align-items:baseline;font-size:11px}' +
    '.ag-cs-quota-win-lbl{color:var(--muted-foreground);font-size:10.5px}' +
    '.ag-cs-quota-win-val{font-weight:600;color:var(--foreground);font-size:11px;font-variant-numeric:tabular-nums}' +
    '.ag-cs-quota-bar{position:relative;height:6px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden}' +
    '.ag-cs-qbar-solid{position:absolute;inset:0 auto 0 0;border-radius:999px;background:linear-gradient(90deg,var(--ag-cs-accent,var(--primary,#2563eb)),color-mix(in srgb,var(--ag-cs-accent,var(--primary,#2563eb)) 68%,#ffffff))}' +
    '.ag-cs-quota-win[data-warn="1"] .ag-cs-qbar-solid{background:linear-gradient(90deg,#d97706,#fbbf24)}' +
    '.ag-cs-quota-win[data-warn="2"] .ag-cs-qbar-solid{background:linear-gradient(90deg,#dc2626,#f87171)}' +
    '.ag-cs-quota-foot{font-size:10px;color:var(--muted-foreground);opacity:.82}';

  const ORBITAL_SVG_HTML =
    '<svg class="ag-cs-orbital-svg" viewBox="0 0 760 280" fill="none" preserveAspectRatio="none">' +
    '<ellipse class="ag-cs-orbit-arc is-primary" cx="468" cy="136" rx="348" ry="118" transform="rotate(-10 468 136)"/>' +
    '<ellipse class="ag-cs-orbit-arc is-dashed" cx="468" cy="136" rx="252" ry="82" stroke-dasharray="2.5 5.5" transform="rotate(-10 468 136)"/>' +
    '<g class="ag-cs-orbit-reticle" transform="translate(466 36)"><path d="M-4 0H4M0 -4V4"/></g>' +
    '<g class="ag-cs-orbit-reticle" transform="translate(216 184)"><path d="M-3.5 0H3.5M0 -3.5V3.5"/></g>' +
    '<g class="ag-cs-orbit-reticle" transform="translate(698 92)"><path d="M-3.5 0H3.5M0 -3.5V3.5"/></g>' +
    '<circle class="ag-cs-orbit-node is-cobalt" cx="634" cy="54" r="2.2"/>' +
    '<circle class="ag-cs-orbit-node is-iris" cx="308" cy="64" r="1.8"/>' +
    '<circle class="ag-cs-orbit-node is-amber" cx="566" cy="212" r="1.8"/></svg>';

  function createHomeStudioPanelController({
    usageCore,
    storageUsageCacheKey = 'ag-prism:trajRollup.v1',
    isDestroyed,
    getHomeLayout,
    getLang,
    uiText,
    getDisplayName,
    ensureHooks,
    canMountRealCanvas,
    setAttrIfChanged,
    runGuardedMut,
  }) {
    const QUOTA_SUCCESS_COOLDOWN_MS = 45000;
    const QUOTA_FAIL_COOLDOWN_MS = 15000;
    const QUOTA_TAB_COOLDOWN_MS = 20000;
    const MANUAL_REFRESH_COOLDOWN_MS = 5000;
    const usageRecords = new Map();
    let usageLoading = false, quotaLoading = false, usageHasData = false;
    let lastUsageFetchAt = 0, lastQuotaFetchAt = 0, lastQuotaFailAt = 0, lastQuotaTabTriggerAt = 0, lastManualRefreshAt = 0;
    let liveQuotaSnap = null, quotaEpoch = 0, quotaPending = null, quotaBindingSeq = 0;
    let bookPick = 0.07, activeTab = 'overview', activeRange = 'all', activeWorkspace = 'all', detectedCurrentWorkspace = '';
    let modelsExpanded = false, lastPanelRenderKey = '', usageDataEpoch = 0, cachedAggKey = '', cachedAggData = null;
    let deferredUsageTimer = 0, saveUsageTimer = 0, saveUsageIdle = 0, wasHero = false;
    const replacedGreetings = new Map();
    let panelSeat = null, panelEl = null, heatTipEl = null, shownHeatCell = null, pendingHeatCell = null, pendingHeatGrid = null, heatTipRaf = 0;
    const modelColours = usageCore?.createHomeModelColours ? usageCore.createHomeModelColours() : () => ({});
    const mk = (tag, cls, txt) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt !== undefined) e.textContent = txt;
      return e;
    };

    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = JSON.parse(localStorage.getItem(storageUsageCacheKey) || '{}');
        if (raw && typeof raw === 'object') {
          for (const [id, rec] of Object.entries(raw)) if (rec?.days) usageRecords.set(id, rec);
          if (usageRecords.size > 0) { usageHasData = true; usageDataEpoch += 1; }
        }
      }
    } catch {}

    function flushUsageCacheNow() {
      if (saveUsageTimer) { clearTimeout(saveUsageTimer); saveUsageTimer = 0; }
      if (saveUsageIdle) {
        try { if (typeof cancelIdleCallback === 'function') cancelIdleCallback(saveUsageIdle); } catch {}
        saveUsageIdle = 0;
      }
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return;
        let entries = Array.from(usageRecords.entries());
        if (entries.length > MAX_CACHED_USAGE_RECORDS) {
          entries.sort((a, b) => Number(b[1]?.lastModifiedSec || 0) - Number(a[1]?.lastModifiedSec || 0));
          entries = entries.slice(0, MAX_CACHED_USAGE_RECORDS);
        }
        const obj = {};
        for (const [id, rec] of entries) obj[id] = rec;
        localStorage.setItem(storageUsageCacheKey, JSON.stringify(obj));
      } catch {}
    }
    function saveUsageCache() {
      if (isDestroyed() || typeof setTimeout !== 'function') { flushUsageCacheNow(); return; }
      if (saveUsageTimer) clearTimeout(saveUsageTimer);
      if (saveUsageIdle) {
        try { if (typeof cancelIdleCallback === 'function') cancelIdleCallback(saveUsageIdle); } catch {}
        saveUsageIdle = 0;
      }
      saveUsageTimer = setTimeout(() => {
        saveUsageTimer = 0;
        if (isDestroyed()) return;
        if (typeof requestIdleCallback === 'function') {
          saveUsageIdle = requestIdleCallback(() => { saveUsageIdle = 0; if (!isDestroyed()) flushUsageCacheNow(); }, { timeout: 2500 });
        } else {
          flushUsageCacheNow();
        }
      }, 1200);
    }

    function extractMeta(sum) {
      const workspace = usageCore?.extractWorkspaceId ? usageCore.extractWorkspaceId(sum) : String(sum?.workspace || '');
      const parentId = String(
        sum?.trajectoryMetadata?.parentConversationId ||
          sum?.parentConversationId ||
          sum?.parentId ||
          sum?.rootConversationId ||
          sum?.rootId ||
          ''
      ).trim();
      const subagent =
        Boolean(sum?.subagent || parentId) ||
        (usageCore?.isSubagentSummary ? usageCore.isSubagentSummary(sum) : false);
      const lastModifiedSec =
        Number(sum?.lastModifiedSec || sum?.lastModifiedTime?.seconds || 0) ||
        (typeof sum?.modifiedAt === 'string' ? Math.floor((Date.parse(sum.modifiedAt) || 0) / 1000) : 0);
      const createdSec =
        Number(sum?.createdSec || sum?.createdTime?.seconds || 0) ||
        (typeof sum?.createdAt === 'string' ? Math.floor((Date.parse(sum.createdAt) || 0) / 1000) : 0);
      return { workspace, parentId, subagent, lastModifiedSec, createdSec, stepCount: Number(sum?.stepCount ?? sum?.steps ?? 0) };
    }

    function advanceCachedCursor(prev, id, sum) {
      const m = extractMeta(sum);
      if (prev?.days) {
        return { ...prev, stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, subagent: prev.subagent || m.subagent, workspace: m.workspace || prev.workspace || '', parentId: m.parentId || prev.parentId || '' };
      }
      const sec = m.lastModifiedSec || m.createdSec || 0, days = {};
      if (sec > 0 && usageCore?.homeDayKey) {
        const d = new Date(sec * 1000), hours = new Array(24).fill(0);
        hours[d.getHours()] = 1;
        days[usageCore.homeDayKey(d)] = { calls: 1, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, hours, models: {} };
      }
      return { cascadeId: String(id || ''), stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, gmCount: 0, subagent: m.subagent, workspace: m.workspace, parentId: m.parentId, calls: 0, days };
    }

    function detectCurrentWorkspaceName(entries) {
      try {
        if (typeof document !== 'undefined' && document.title) {
          const cand = String(document.title).split(/\s+[-—|]\s+/).map((s) => s.trim()).find((p) => p && !/antigravity/i.test(p) && p.length <= 64);
          if (cand && /^[a-zA-Z0-9._\-\u4e00-\u9fa5]+$/.test(cand)) return cand;
        }
      } catch {}
      let latestSec = 0, latestWs = '';
      for (const [, sum] of entries || []) {
        const m = extractMeta(sum);
        if (!m.subagent && m.workspace && m.lastModifiedSec >= latestSec) { latestSec = m.lastModifiedSec; latestWs = m.workspace; }
      }
      return latestWs;
    }

    const inCooldown = (at, ms, now) => at > 0 && now >= at && now - at < ms;

    function hasUsableQuotas(snap) {
      return (
        Array.isArray(snap?.groups) &&
        snap.groups.length > 0 &&
        snap.groups.some((g) => g && (!usageCore?.quotaWindows || usageCore.quotaWindows(g).length > 0))
      );
    }

    function withTimeout(fn, ms, onTimeout) {
      return new Promise((resolve) => {
        let settled = false;
        const done = (val) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(val);
        };
        const timer = setTimeout(() => {
          try { onTimeout?.(); } catch {}
          done(null);
        }, ms);
        Promise.resolve().then(fn).then((v) => done(v || null), () => done(null));
      });
    }

    function callPrismMetricsBinding(win, input) {
      const callName = '__agPrismMetricsCall', resName = '__agPrismMetricsResolve';
      const reqId = 800000000 + (++quotaBindingSeq);
      const prev = win[resName];
      let cb = null, restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        if (win[resName] === cb) {
          if (prev !== undefined) win[resName] = prev;
          else delete win[resName];
        }
      };
      return withTimeout(() => new Promise((resolve) => {
        cb = (id, payload) => {
          if (id === reqId) {
            restore();
            resolve(payload && typeof payload === 'object' ? payload : null);
          } else if (typeof prev === 'function') {
            prev(id, payload);
          }
        };
        win[resName] = cb;
        try {
          win[callName](JSON.stringify({ id: reqId, input }));
        } catch {
          restore();
          resolve(null);
        }
      }), 10500, restore);
    }

    async function refreshLiveTelemetrySnapshot(force = false, opts = null) {
      if (isDestroyed()) return liveQuotaSnap;
      if (quotaLoading && quotaPending) return quotaPending;
      const now = Date.now();
      if (!force) {
        if (hasUsableQuotas(liveQuotaSnap) && inCooldown(lastQuotaFetchAt, QUOTA_SUCCESS_COOLDOWN_MS, now)) return liveQuotaSnap;
        if (!opts?.ignoreFailCooldown && inCooldown(lastQuotaFailAt, QUOTA_FAIL_COOLDOWN_MS, now)) return liveQuotaSnap;
      }
      const win = typeof window !== 'undefined' ? window : G;
      if (!win) return null;
      const doc = typeof document !== 'undefined' ? document : win.document || null;
      const telemetryOff = doc?.documentElement?.getAttribute?.('data-ag-cs-telemetry') === 'off';
      quotaLoading = true;
      if (activeTab === 'quotas') renderHomePanel();
      const pending = (async () => {
        try {
          const forceFlag = Boolean(force);
          const req = {
            conversationId: null,
            force: forceFlag,
            quotaRefresh: Boolean(opts?.quotaRefresh ?? forceFlag),
            selectLatest: false,
          };
          const host = win.agPulseHost;
          const isPrismHost = Boolean(host?.__prismFallback);
          const hasExternalHost = typeof host?.getMetrics === 'function' && !isPrismHost;
          const bridge = win.__agPrismMetricsBridge;
          const tel = win.__agPrismTelemetry;
          let snap = null;
          const pick = (v) => { if (hasUsableQuotas(v)) snap = v; };

          if (hasExternalHost) {
            pick(await withTimeout(() => host.getMetrics(req), 3000));
          }
          if (!hasUsableQuotas(snap) && !telemetryOff) {
            if (isPrismHost && typeof host?.getMetrics === 'function') {
              pick(await withTimeout(() => host.getMetrics(req), 10500));
            } else if (typeof bridge?.getMetrics === 'function') {
              pick(await withTimeout(() => bridge.getMetrics(req), 10500));
            } else if (typeof win.__agPrismMetricsCall === 'function') {
              pick(await callPrismMetricsBinding(win, req));
            } else if (!host?.getMetrics && typeof tel?.refresh === 'function') {
              pick(await withTimeout(() => tel.refresh(), 4500));
            }
            if (!hasUsableQuotas(snap)) pick(tel?.getLatestSnapshot?.());
          }

          if (hasUsableQuotas(snap)) {
            liveQuotaSnap = snap;
            lastQuotaFetchAt = Date.now();
            lastQuotaFailAt = 0;
            quotaEpoch += 1;
          } else {
            lastQuotaFailAt = Date.now();
          }
          return liveQuotaSnap;
        } catch {
          lastQuotaFailAt = Date.now();
          return liveQuotaSnap;
        } finally {
          quotaLoading = false;
          quotaPending = null;
          if (!isDestroyed() && activeTab === 'quotas') renderHomePanel();
        }
      })();
      quotaPending = pending;
      return pending;
    }

    function scheduleUsageRollupRefresh(delayMs = 1800) {
      if (isDestroyed() || usageLoading || getHomeLayout() !== 'studio') return;
      if (!usageHasData && !canMountRealCanvas(document.body)) { void refreshUsageRollup(false); return; }
      if (deferredUsageTimer) return;
      const onHome = () => !isDestroyed() && document.querySelector('.agy-home') && getHomeLayout() === 'studio';
      deferredUsageTimer = setTimeout(() => {
        deferredUsageTimer = 0;
        if (!onHome()) return;
        const run = () => { if (onHome()) void refreshUsageRollup(false); };
        if (usageHasData && typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2200 });
        else run();
      }, usageHasData ? Math.max(400, delayMs) : 80);
    }

    async function refreshUsageRollup(force = false) {
      if (isDestroyed() || usageLoading || !usageCore) return;
      const liveSnapProm = refreshLiveTelemetrySnapshot(force);
      const h = ensureHooks();
      if (!h) return;
      const now = Date.now();
      if (!force && usageHasData && now - lastUsageFetchAt < 60000) return;

      const win = typeof window !== 'undefined' ? window : G;
      const usageBridge = win?.__agPrismUsageBridge || null;
      if (canMountRealCanvas(document.body) && usageBridge && !usageBridge.isOnline?.()) {
        usageLoading = true;
        if (!usageHasData) renderHomePanel();
        for (let w = 0; w < 35 && !isDestroyed() && !usageBridge.isOnline?.(); w++) await new Promise((r) => setTimeout(r, 120));
        usageLoading = false;
        if (isDestroyed()) return;
        if (!hasUsableQuotas(liveQuotaSnap)) void refreshLiveTelemetrySnapshot(true, { ignoreFailCooldown: true });
      }
      const sumsMap = new Map();
      for (const [id, s] of Object.entries(h.store.getState().trajectorySummaries?.summaries || {})) if (s) sumsMap.set(id, s);

      let seededCache = false;
      if (usageBridge?.isOnline?.() && typeof usageBridge.listSummaries === 'function') {
        try {
          const sumRes = await usageBridge.listSummaries(8000);
          if (Array.isArray(sumRes?.records)) {
            for (const hit of sumRes.records) {
              if (hit?.id && hit.record?.days && !usageRecords.has(hit.id)) {
                usageRecords.set(hit.id, hit.record);
                seededCache = true;
              }
            }
          }
          const bList = Array.isArray(sumRes?.summaries)
            ? sumRes.summaries
            : sumRes?.summaries && typeof sumRes.summaries === 'object'
            ? Object.entries(sumRes.summaries).map(([k, v]) => ({ id: k, ...v }))
            : [];
          for (const item of bList) {
            const sid = String(item?.id || item?.cascadeId || '').trim();
            if (!sid) continue;
            if (!sumsMap.has(sid)) {
              sumsMap.set(sid, item);
            } else {
              const cur = sumsMap.get(sid);
              if (item.workspace && !cur.workspace && !cur.workspaces) cur.workspace = item.workspace;
              if ((item.parentId || item.parentConversationId) && !cur.parentId && !cur.parentConversationId && !cur.trajectoryMetadata?.parentConversationId) {
                cur.parentId = item.parentId || item.parentConversationId;
              }
            }
          }
        } catch {}
      } else if (!liveQuotaSnap) {
        try { await liveSnapProm; } catch {}
      }

      if (Array.isArray(liveQuotaSnap?.conversations)) {
        for (const c of liveQuotaSnap.conversations) {
          if (c?.id && !sumsMap.has(c.id)) {
            sumsMap.set(c.id, { stepCount: Number(c.steps || 0), subagent: Boolean(c.subagent), parentConversationId: c.parentConversationId || '', rootConversationId: c.rootConversationId || '', workspace: c.workspace || '', modifiedAt: c.modifiedAt || '' });
          }
        }
      }
      const entries = Array.from(sumsMap.entries()), canPrune = !usageBridge || Boolean(usageBridge.isOnline?.());
      detectedCurrentWorkspace = detectCurrentWorkspaceName(entries) || detectedCurrentWorkspace;
      if (entries.length === 0) { if (canPrune) usageHasData = true; renderHomePanel(); return; }

      const staleIds = [], presentIds = new Set();
      let patchedMeta = seededCache;
      for (const [id, sum] of entries) {
        presentIds.add(id);
        const m = extractMeta(sum), cached = usageRecords.get(id);
        if (!cached || cached.stepCount !== m.stepCount || cached.lastModifiedSec !== m.lastModifiedSec) staleIds.push([id, sum]);
        else if ((m.workspace && !cached.workspace) || (m.parentId && !cached.parentId)) {
          cached.workspace = m.workspace || cached.workspace || '';
          cached.parentId = m.parentId || cached.parentId || '';
          patchedMeta = true;
        }
      }
      if (patchedMeta) usageDataEpoch += 1;
      staleIds.sort((a, b) => extractMeta(b[1]).lastModifiedSec - extractMeta(a[1]).lastModifiedSec);

      let deletedAny = false;
      if (canPrune) {
        for (const oldId of Array.from(usageRecords.keys())) {
          if (!presentIds.has(oldId)) {
            const oldRec = usageRecords.get(oldId);
            if (oldRec?.subagent && oldRec?.parentId && presentIds.has(oldRec.parentId)) continue;
            usageRecords.delete(oldId);
            deletedAny = true;
          }
        }
      }
      if (deletedAny) usageDataEpoch += 1;
      if (staleIds.length === 0) { usageHasData = true; if (canPrune) lastUsageFetchAt = now; if (patchedMeta) saveUsageCache(); renderHomePanel(); return; }

      usageLoading = true;
      if (!usageHasData) renderHomePanel();
      try {
        if (usageBridge && typeof usageBridge.fetchBatch === 'function' && usageBridge.isOnline?.()) {
          for (let i = 0; i < staleIds.length && !isDestroyed(); i += 6) {
            const slice = staleIds.slice(i, i + 6);
            const reqItems = slice.map(([id, sum]) => {
              const c = usageRecords.get(id), m = extractMeta(sum);
              return { id, stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, createdSec: m.createdSec, subagent: m.subagent, workspace: m.workspace, parentId: m.parentId, gmOffset: c && Number.isInteger(c.gmCount) && c.gmCount > 0 ? c.gmCount : 0 };
            });
            const res = await usageBridge.fetchBatch(reqItems, 18000);
            const byId = res?.ok && Array.isArray(res.records) ? new Map(res.records.map((r) => [r.id, r])) : null;
            for (const [id, sum] of slice) {
              const prev = usageRecords.get(id), hit = byId?.get(id), m = extractMeta(sum);
              if (hit?.mode === 'full' && hit.record) {
                usageRecords.set(id, { ...hit.record, subagent: Boolean(hit.record.subagent || m.subagent), workspace: hit.record.workspace || m.workspace || '', parentId: hit.record.parentId || m.parentId || '' });
              } else if (hit?.mode === 'delta' && hit.delta && usageCore.mergeUsageRecordDelta) {
                usageRecords.set(id, usageCore.mergeUsageRecordDelta(prev, hit.delta, { cascadeId: id, stepCount: m.stepCount, lastModifiedSec: m.lastModifiedSec, gmCount: Number(hit.gmCount || 0), subagent: m.subagent, workspace: m.workspace, parentId: m.parentId }));
              } else usageRecords.set(id, advanceCachedCursor(prev, id, sum));
            }
            if (i + 6 < staleIds.length && !isDestroyed()) await new Promise((r) => setTimeout(r, 40));
          }
        } else {
          const CONC = usageHasData ? 1 : 2;
          for (let i = 0; i < staleIds.length && !isDestroyed(); i += CONC) {
            await Promise.all(
              staleIds.slice(i, i + CONC).map(async ([id, sum]) => {
                const prev = usageRecords.get(id), m = extractMeta(sum);
                if (m.stepCount > MAX_FRONTEND_TRAJECTORY_STEPS) { usageRecords.set(id, advanceCachedCursor(prev, id, sum)); return; }
                try {
                  let tId = null;
                  const toP = new Promise((_, rej) => { tId = setTimeout(() => rej(new Error('timeout')), 2800); });
                  const res = await Promise.race([h.svc.getCascadeTrajectory({ cascadeId: id }), toP]).finally(() => { if (tId !== null) clearTimeout(tId); });
                  const rec = usageCore.analyzeTrajectoryForUsage(res, sum, id);
                  usageRecords.set(id, { ...rec, subagent: Boolean(rec.subagent || m.subagent), workspace: rec.workspace || m.workspace || '', parentId: rec.parentId || m.parentId || '' });
                } catch {
                  usageRecords.set(id, advanceCachedCursor(prev, id, sum));
                }
              })
            );
            if (i + CONC < staleIds.length && !isDestroyed()) await new Promise((r) => setTimeout(r, usageHasData ? 120 : 24));
          }
        }
        if (!isDestroyed()) { usageHasData = true; usageDataEpoch += 1; lastUsageFetchAt = Date.now(); saveUsageCache(); }
      } finally {
        usageLoading = false;
        if (!isDestroyed()) renderHomePanel();
      }
    }

    function syncGreeting(inHero) {
      if (inHero && !wasHero) {
        if (!usageHasData) bookPick = Math.random();
        if (getHomeLayout() === 'studio') scheduleUsageRollupRefresh(1800);
      } else if (!inHero && deferredUsageTimer) { clearTimeout(deferredUsageTimer); deferredUsageTimer = 0; }
      wasHero = Boolean(inHero);

      const h1 = document.querySelector('[data-testid="home-greeting"] h1');
      if (!h1) return;
      if (getHomeLayout() !== 'studio') {
        h1.removeAttribute('data-ag-no-i18n');
        const orig = replacedGreetings.get(h1);
        if (orig !== undefined) { if (h1.textContent !== orig.host) h1.textContent = orig.host; replacedGreetings.delete(h1); }
        return;
      }
      const lang = getLang(), name = getDisplayName();
      const target = lang === 'zh-CN' ? (name ? `接下来做什么，${name}？` : '接下来做什么？')
        : lang === 'zh-TW' ? (name ? `接下來做什麼，${name}？` : '接下來做什麼？')
        : lang === 'yue' ? (name ? `跟住想做啲咩，${name}？` : '跟住想做啲咩？')
        : lang === 'ja' ? (name ? `次は何をしますか、${name}？` : '次は何をしますか？')
        : (name ? `What's up next, ${name}?` : "What's up next?");
      setAttrIfChanged(h1, 'data-ag-no-i18n', '');
      if (h1.textContent !== target) {
        const prev = replacedGreetings.get(h1);
        const hostText = prev && h1.textContent === prev.written ? prev.host : h1.textContent || '';
        h1.textContent = target;
        replacedGreetings.set(h1, { host: hostText, written: target });
      }
    }

    function restoreGreetings() {
      for (const [el, rec] of replacedGreetings.entries()) {
        el.removeAttribute('data-ag-no-i18n');
        if (el.isConnected && el.textContent === rec.written) el.textContent = rec.host;
      }
      replacedGreetings.clear();
    }

    function hideHeatTip() {
      shownHeatCell = pendingHeatCell = null;
      if (heatTipRaf && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(heatTipRaf); heatTipRaf = 0; }
      if (heatTipEl) heatTipEl.removeAttribute('data-shown');
    }

    function flushHeatTip() {
      heatTipRaf = 0;
      const cell = pendingHeatCell, grid = pendingHeatGrid;
      if (!cell || !grid || !heatTipEl || cell.isConnected === false) return;
      const tipText = cell.getAttribute('data-tip');
      if (!tipText) return;
      shownHeatCell = cell;
      const gW = grid.clientWidth || 480, gH = grid.clientHeight || 96, cL = cell.offsetLeft || 0, cT = cell.offsetTop || 0, cW = cell.offsetWidth || 10, cH = cell.offsetHeight || 10;
      const estW = Math.max(88, Math.min(240, tipText.length * 6.8 + 18)), tH = 24;
      const left = Math.min(Math.max(cL + cW * 0.5 - estW * 0.5, 0), Math.max(0, gW - estW));
      const below = gH - (cT + cH), top = below > cT && below >= tH + 6 ? cT + cH + 6 : cT - 6 - tH;
      runGuardedMut(() => {
        if (heatTipEl.textContent !== tipText) heatTipEl.textContent = tipText;
        heatTipEl.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
        setAttrIfChanged(heatTipEl, 'data-shown', 'true');
      });
    }

    function showHeatTip(cell, grid) {
      if (!cell || !heatTipEl || cell === shownHeatCell) return;
      pendingHeatCell = cell; pendingHeatGrid = grid;
      if (typeof requestAnimationFrame === 'function') { if (!heatTipRaf) heatTipRaf = requestAnimationFrame(flushHeatTip); }
      else flushHeatTip();
    }

    function parkPanelSeat() {
      hideHeatTip();
      if (panelSeat?.parentElement) panelSeat.parentElement.removeChild(panelSeat);
    }

    function unmountPanelSeat() {
      if (deferredUsageTimer) { clearTimeout(deferredUsageTimer); deferredUsageTimer = 0; }
      if (panelSeat?.parentElement) panelSeat.parentElement.removeChild(panelSeat);
      panelSeat = panelEl = heatTipEl = shownHeatCell = null;
      if (heatTipRaf && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(heatTipRaf); heatTipRaf = 0; }
      lastPanelRenderKey = '';
    }

    function ensurePanelSeat() {
      if (getHomeLayout() !== 'studio') { unmountPanelSeat(); return null; }
      if (typeof document !== 'undefined' && document.head && !document.getElementById(STUDIO_STYLE_ID)) {
        runGuardedMut(() => {
          if (!document.getElementById(STUDIO_STYLE_ID)) {
            const st = mk('style', '', STUDIO_EXTRA_CSS);
            st.id = STUDIO_STYLE_ID;
            st.setAttribute('data-ag-owned', '1');
            document.head.appendChild(st);
          }
        });
      }
      const home = document.querySelector('.agy-home');
      if (!home) { parkPanelSeat(); return null; }
      const greeting = home.querySelector('[data-testid="home-greeting"]');
      if (!greeting?.parentElement) return null;
      if (!panelSeat || !panelEl) {
        panelSeat = markNoTr(mk('div', 'ag-cs-home-panel-seat'));
        panelSeat.setAttribute('data-ag-no-i18n', '');
        panelSeat.setAttribute('data-ag-owned', '1');
        panelEl = mk('section', 'ag-cs-home-panel');
        panelSeat.appendChild(panelEl);
      }
      if (!panelSeat.isConnected || panelSeat.parentElement !== greeting.parentElement || panelSeat.previousSibling !== greeting) {
        greeting.parentElement.insertBefore(panelSeat, greeting.nextSibling);
      }
      return panelEl;
    }

    function renderQuotasView(panel, lang, ui) {
      const wrap = mk('div', 'ag-cs-quota-wrap');
      const toolbar = mk('div', 'ag-cs-quota-toolbar');
      toolbar.appendChild(mk('span', '', ui.quotaPoolsTitle || 'Model Quota Pools Remaining'));
      const refreshBtn = mk('button', 'ag-cs-quota-refresh', quotaLoading ? ui.thinkingEllipsis || 'Loading…' : ui.refreshBtnTitle || 'Refresh');
      refreshBtn.type = 'button';
      refreshBtn.disabled = quotaLoading;
      refreshBtn.addEventListener('click', () => {
        const now = Date.now();
        if (quotaLoading || inCooldown(lastManualRefreshAt, MANUAL_REFRESH_COOLDOWN_MS, now)) return;
        lastManualRefreshAt = now;
        lastQuotaTabTriggerAt = now;
        void refreshLiveTelemetrySnapshot(true);
      });
      toolbar.appendChild(refreshBtn);
      wrap.appendChild(toolbar);

      const groups = Array.isArray(liveQuotaSnap?.groups)
        ? liveQuotaSnap.groups.filter((g) => g && (usageCore.quotaWindows ? usageCore.quotaWindows(g).length > 0 : true))
        : [];
      if (groups.length === 0) {
        wrap.appendChild(mk('div', 'ag-cs-home-models-empty', quotaLoading ? ui.quotaLoading || 'Loading…' : ui.quotaEmptyHint || 'Waiting for live quota snapshot…'));
        panel.appendChild(wrap);
        return;
      }

      const grid = mk('div', 'ag-cs-quota-grid');
      const quotaWinUsage = liveQuotaSnap?.usage?.quotaWindows || null;
      const healthBadgeFor = (minRem) => {
        if (!(minRem >= 0 && minRem <= 1)) return { status: 'idle', label: '—' };
        if (minRem <= 0.15) {
          return {
            status: 'low',
            label: lang === 'en' ? 'Low Quota' : lang === 'ja' ? '残枠少' : lang === 'zh-TW' || lang === 'yue' ? '額度偏低' : '额度偏低',
          };
        }
        if (minRem <= 0.35) {
          return {
            status: 'tight',
            label: lang === 'en' ? 'Running Low' : lang === 'ja' ? '残り少なめ' : lang === 'zh-TW' ? '餘量偏緊' : lang === 'yue' ? '餘額偏緊' : '余量偏紧',
          };
        }
        return { status: 'ok', label: lang === 'en' ? 'Healthy' : lang === 'ja' ? '余裕あり' : '充裕' };
      };
      for (const grp of groups) {
        const card = mk('div', 'ag-cs-quota-card');
        card.setAttribute('data-quota-kind', usageCore.quotaGroupKind ? usageCore.quotaGroupKind(grp) : 'other');
        const cHead = mk('div', 'ag-cs-quota-card-head');
        cHead.appendChild(mk('span', 'ag-cs-quota-name', usageCore.quotaGroupLabel ? usageCore.quotaGroupLabel(grp, lang) : grp.name || grp.id));
        const winEntries = [];
        let minRem = 2;
        for (const [wk, bucket] of usageCore.quotaWindows ? usageCore.quotaWindows(grp) : []) {
          const fc = usageCore.quotaForecast ? usageCore.quotaForecast(bucket, wk) : null;
          if (!fc) continue;
          const rem = typeof fc.remaining === 'number' && Number.isFinite(fc.remaining) ? Math.max(0, Math.min(1, fc.remaining)) : 0;
          if (rem < minRem) minRem = rem;
          winEntries.push([wk, fc, rem]);
        }
        const badgeInfo = healthBadgeFor(minRem <= 1 ? minRem : -1);
        const paceBadge = mk('span', 'ag-cs-quota-pace', badgeInfo.label);
        paceBadge.setAttribute('data-pace', badgeInfo.status);
        cHead.appendChild(paceBadge);
        card.appendChild(cHead);

        for (const [wk, fc, rem] of winEntries) {
          const winBox = mk('div', 'ag-cs-quota-win');
          if (rem <= 0.15) winBox.setAttribute('data-warn', '2');
          else if (rem <= 0.35) winBox.setAttribute('data-warn', '1');
          const wRow = mk('div', 'ag-cs-quota-win-row');
          wRow.appendChild(mk('span', 'ag-cs-quota-win-lbl', wk === 'weekly' ? ui.weeklyLabel || 'Weekly' : ui.fiveHourLabel || '5h'));
          const eta = fc.resetInMs > 0 && usageCore.shortEta ? ` · ${usageCore.shortEta(fc.resetInMs, lang)}` : '';
          wRow.appendChild(mk('span', 'ag-cs-quota-win-val', `${Math.round(rem * 100)}%${eta}`));
          const bar = mk('div', 'ag-cs-quota-bar');
          const solid = mk('i', 'ag-cs-qbar-solid');
          solid.style.width = `${(rem * 100).toFixed(1)}%`;
          bar.appendChild(solid);
          winBox.appendChild(wRow);
          winBox.appendChild(bar);
          card.appendChild(winBox);
        }
        const footText = quotaWinUsage?.[grp.id]?.totalTokens > 0 ? `${usageCore.formatCompactTokens(quotaWinUsage[grp.id].totalTokens)} tok` : '';
        if (footText) card.appendChild(mk('div', 'ag-cs-quota-foot', footText));
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
      panel.appendChild(wrap);
    }

    function renderHomePanel(force = false) {
      if (!usageCore) return;
      const panel = ensurePanelSeat();
      if (!panel) return;
      const lang = getLang(), ui = uiText(lang), skeleton = !usageHasData;
      const aggKey = `${usageDataEpoch}|${usageRecords.size}|${activeRange}|${activeWorkspace}|${lang}|${bookPick}`;
      let data = cachedAggData;
      if (!data || cachedAggKey !== aggKey) {
        data = usageCore.aggregateUsageRollup(Array.from(usageRecords.values()), activeRange, bookPick, lang, undefined, { workspace: activeWorkspace });
        cachedAggKey = aggKey; cachedAggData = data;
      }
      const wsList = Array.isArray(data.workspaces) ? data.workspaces : [];
      if (activeWorkspace !== 'all' && wsList.length > 0 && !wsList.some((w) => w.id === activeWorkspace)) {
        activeWorkspace = 'all';
        return renderHomePanel(true);
      }
      const isQuotasTab = activeTab === 'quotas';
      const renderKey = [lang, activeTab, activeRange, activeWorkspace, modelsExpanded ? 1 : 0, skeleton ? 1 : 0, isQuotasTab ? (quotaLoading ? 1 : 0) : 0, isQuotasTab ? quotaEpoch : 0, usageRecords.size, data.sessions, data.calls, data.tokens, data.subagentTokens || 0, data.cacheHitRate != null ? data.cacheHitRate.toFixed(3) : '-', data.activeDays, data.model || ''].join('|');
      if (!force && renderKey === lastPanelRenderKey && panel.childElementCount > 0) return;
      lastPanelRenderKey = renderKey;

      runGuardedMut(() => {
        panel.innerHTML = '';
        const orbital = mk('div', 'ag-cs-orbital-backdrop');
        orbital.setAttribute('aria-hidden', 'true');
        orbital.innerHTML = ORBITAL_SVG_HTML;
        panel.appendChild(orbital);

        const head = mk('div', 'ag-cs-home-panel-head');
        const tabs = mk('div', 'ag-cs-home-tabs');
        for (const [id, label] of [['overview', ui.tabOverview || 'Overview'], ['models', ui.tabModels || 'Models'], ['quotas', ui.tabQuotas || 'Quotas']]) {
          const btn = mk('button', 'ag-cs-home-tab', label);
          btn.type = 'button';
          btn.setAttribute('data-tab', id);
          if (activeTab === id) btn.setAttribute('data-active', '');
          btn.addEventListener('click', () => {
            activeTab = id;
            if (id === 'quotas' && !hasUsableQuotas(liveQuotaSnap)) {
              const now = Date.now();
              if (!inCooldown(lastQuotaTabTriggerAt, QUOTA_TAB_COOLDOWN_MS, now)) {
                lastQuotaTabTriggerAt = now;
                void refreshLiveTelemetrySnapshot(false, { quotaRefresh: true, ignoreFailCooldown: true });
              }
            }
            renderHomePanel();
          });
          tabs.appendChild(btn);
        }

        const headRight = mk('div', 'ag-cs-home-head-right');
        if (activeTab !== 'quotas' && wsList.length > 0) {
          const sel = mk('select', 'ag-cs-home-ws-select');
          sel.setAttribute('data-ag-cs-ws-filter', '1');
          sel.setAttribute('aria-label', ui.workspaceFilterAria || 'Workspace filter');
          const optAll = mk('option', '', ui.workspaceAll || 'All Projects');
          optAll.value = 'all';
          sel.appendChild(optAll);
          for (const ws of wsList) {
            const prefix = detectedCurrentWorkspace && ws.id === detectedCurrentWorkspace ? '● ' : '';
            const opt = mk('option', '', `${prefix}${ws.id} (${usageCore.formatCompactTokens(ws.tokens)})`);
            opt.value = ws.id;
            sel.appendChild(opt);
          }
          sel.value = activeWorkspace;
          sel.addEventListener('change', () => { activeWorkspace = sel.value || 'all'; renderHomePanel(); });
          headRight.appendChild(sel);
        }
        if (activeTab !== 'quotas') {
          const ranges = mk('div', 'ag-cs-home-ranges');
          for (const r of usageCore.HOME_RANGES) {
            const btn = mk('button', 'ag-cs-home-range', usageCore.homeRangeLabel ? usageCore.homeRangeLabel(r, lang) : r.labelEn);
            btn.type = 'button';
            btn.setAttribute('data-range', r.id);
            if (activeRange === r.id) btn.setAttribute('data-active', '');
            btn.addEventListener('click', () => { activeRange = r.id; renderHomePanel(); });
            ranges.appendChild(btn);
          }
          headRight.appendChild(ranges);
        }
        head.appendChild(tabs);
        head.appendChild(headRight);
        panel.appendChild(head);

        if (activeTab === 'quotas') { renderQuotasView(panel, lang, ui); return; }

        if (activeTab === 'overview') {
          const stats = mk('div', 'ag-cs-home-stats');
          const cacheVal = typeof data.cacheHitRate === 'number' && Number.isFinite(data.cacheHitRate) ? usageCore.fmtPct(data.cacheHitRate * 100, 1) : '—';
          const cacheTitle = typeof data.cacheHitRate === 'number'
            ? `${ui.cacheRead || 'Cache'}: ${usageCore.formatCompactTokens(data.cacheReadTokens || 0)} / ${usageCore.formatCompactTokens(data.totalInput || 0)}${data.peakHour ? ` · ${data.peakHour}` : ''}`
            : data.peakHour || '—';
          const subTok = Number(data.subagentTokens || 0), subSes = Number(data.subagentSessions || 0);
          const subPct = data.tokens > 0 && subTok > 0 ? Math.round((subTok / data.tokens) * 100) : 0;
          const mainPct = 100 - subPct;
          const swarmSub =
            subTok > 0
              ? typeof ui.swarmSplitSub === 'function'
                ? ui.swarmSplitSub(mainPct, subPct)
                : `Main ${mainPct}% · Swarm ${subPct}%`
              : '';

          for (const [k, label, valText, titleText, subTxt] of [
            ['sessions', ui.kpiSessions || 'Sessions', usageCore.formatHomeCount(data.sessions), subSes > 0 ? `${data.sessions} + ${subSes} subagents` : String(data.sessions), ''],
            ['calls', ui.kpiCalls || 'Messages', usageCore.formatHomeCount(data.calls), String(data.calls), ''],
            ['tokens', ui.kpiTokens || 'Total tokens', usageCore.formatCompactTokens(data.tokens), `${usageCore.formatHomeCount(data.tokens)} tokens${swarmSub ? ` (${swarmSub})` : ''}`, swarmSub],
            ['days', ui.kpiDays || 'Active days', usageCore.formatHomeCount(data.activeDays), String(data.activeDays), ''],
            ['cache', ui.kpiCacheHit || 'Cache Hit Rate', cacheVal, cacheTitle, ''],
            ['model', ui.kpiFavModel || 'Favorite model', data.model || '—', data.model || '—', ''],
          ]) {
            const cell = mk('div', 'ag-cs-home-stat');
            cell.setAttribute('data-stat', k);
            if (skeleton) cell.setAttribute('data-skeleton', '');
            cell.appendChild(mk('span', 'ag-cs-home-stat-label', label));
            const val = mk('span', 'ag-cs-home-stat-value', skeleton ? '' : valText);
            if (!skeleton) val.title = titleText;
            cell.appendChild(val);
            if (!skeleton && subTxt) {
              const sEl = mk('span', 'ag-cs-home-stat-sub', subTxt);
              sEl.title = titleText;
              cell.appendChild(sEl);
            }
            stats.appendChild(cell);
          }
          panel.appendChild(stats);

          const heat = mk('div', 'ag-cs-home-heat');
          if (skeleton) heat.setAttribute('data-skeleton', '');
          const fmt = usageCore.homeShortDateFormat(lang);
          const heatFrag = typeof document.createDocumentFragment === 'function' ? document.createDocumentFragment() : heat;
          for (const c of data.grid.cells) {
            const sq = mk('span', 'ag-cs-home-heat-cell');
            sq.setAttribute('data-level', String(c.level));
            if (!skeleton) {
              const tip = `${usageCore.homeShortDate(fmt, c.date)} — ${usageCore.formatCompactTokens(c.tokens)} ${ui.tokenUnit || 'tokens'}`;
              sq.setAttribute('data-tip', tip);
              sq.setAttribute('aria-label', tip);
            }
            heatFrag.appendChild(sq);
          }
          if (heatFrag !== heat) heat.appendChild(heatFrag);
          heatTipEl = mk('span', 'ag-cs-home-heat-hint');
          heatTipEl.setAttribute('aria-hidden', 'true');
          heat.appendChild(heatTipEl);
          heat.addEventListener('mouseover', (ev) => { const t = ev.target?.closest?.('.ag-cs-home-heat-cell'); if (t) showHeatTip(t, heat); });
          heat.addEventListener('mouseleave', hideHeatTip);
          panel.appendChild(heat);
          if (data.funBook) panel.appendChild(mk('span', 'ag-cs-home-fun', data.funBook));
        } else {
          const models = data.models || [];
          if (models.length === 0) { panel.appendChild(mk('div', 'ag-cs-home-models-empty', ui.noModelUsage || 'No model usage data yet')); return; }
          const ids = models.map((m) => m.id);
          for (const col of data.modelDays || []) for (const id of Object.keys(col.models || {})) ids.push(id);
          const colours = modelColours(ids), columns = data.modelDays || [], fmt = usageCore.homeShortDateFormat(lang);

          if (columns.length > 0) {
            let peak = 0;
            for (const col of columns) {
              let sum = 0;
              for (const t of Object.values(col.models)) sum += t;
              if (sum > peak) peak = sum;
            }
            const top = usageCore.axisMax(peak), chart = mk('div', 'ag-cs-home-chart'), plot = mk('div', 'ag-cs-home-chart-plot');
            for (const at of [1, 0.75, 0.5, 0.25, 0]) {
              const tick = mk('span', 'ag-cs-home-chart-tick', top > 0 ? usageCore.formatCompactTokens(top * at) : '');
              tick.style.bottom = `${at * 100}%`;
              plot.appendChild(tick);
            }
            const bars = mk('div', 'ag-cs-home-chart-bars');
            for (const col of columns) {
              let dayTotal = 0;
              const stack = [];
              for (const [mId, tok] of Object.entries(col.models)) { dayTotal += tok; stack.push({ id: mId, tokens: tok }); }
              stack.sort((a, b) => b.tokens - a.tokens || a.id.localeCompare(b.id));
              const colEl = mk('span', 'ag-cs-home-chart-col');
              colEl.title = `${usageCore.homeShortDate(fmt, col.date)} · ${usageCore.formatCompactTokens(dayTotal)}`;
              colEl.style.height = `${top > 0 ? (dayTotal / top) * 100 : 0}%`;
              for (const slice of stack) {
                const seg = mk('span', 'ag-cs-home-chart-seg');
                seg.setAttribute('data-color', String(colours[slice.id] ?? 0));
                seg.style.height = `${dayTotal > 0 ? (slice.tokens / dayTotal) * 100 : 0}%`;
                colEl.appendChild(seg);
              }
              bars.appendChild(colEl);
            }
            plot.appendChild(bars);
            chart.appendChild(plot);
            const axis = mk('div', 'ag-cs-home-chart-axis');
            chart.appendChild(axis);
            panel.appendChild(chart);
            requestAnimationFrame(() => {
              if (!axis.isConnected) return;
              const plotW = plot.clientWidth || 420, labels = columns.map((c) => usageCore.homeShortDate(fmt, c.date));
              const ticks = usageCore.homeChartTicks(labels.map((l) => Math.max(32, l.length * 6.5)), plotW);
              runGuardedMut(() => {
                axis.innerHTML = '';
                for (const tk of ticks) {
                  const sp = mk('span', 'ag-cs-home-chart-label', labels[tk.index]);
                  sp.style.left = `${tk.left}px`;
                  axis.appendChild(sp);
                }
              });
            });
          }

          let totalAll = 0;
          for (const m of models) totalAll += m.tokens;
          const shown = modelsExpanded ? models : models.slice(0, usageCore.HOME_MODEL_ROWS);
          const listEl = mk('div', 'ag-cs-home-models');
          for (const m of shown) {
            const row = mk('div', 'ag-cs-home-model');
            const subShare = m.tokens > 0 && m.subagentTokens > 0 ? ` · Swarm ${Math.round((m.subagentTokens / m.tokens) * 100)}%` : '';
            row.title = `${m.id} · ${m.sessions} ${ui.sessionsUnit || 'sessions'}${subShare}`;
            const sw = mk('span', 'ag-cs-home-model-swatch');
            sw.setAttribute('data-color', String(colours[m.id] ?? 0));
            const inp = (m.input || 0) + (m.cacheRead || 0) + (m.cacheWrite || 0);
            const cacheTag = typeof m.cacheHitRate === 'number' && Number.isFinite(m.cacheHitRate) ? ` · ${Math.round(m.cacheHitRate * 100)}% ${ui.cacheShort || 'Cache'}` : '';
            row.appendChild(sw);
            row.appendChild(mk('span', 'ag-cs-home-model-name', m.id));
            row.appendChild(mk('span', 'ag-cs-home-model-split', `${usageCore.formatCompactTokens(inp)} in · ${usageCore.formatCompactTokens(m.output || 0)} out${cacheTag}`));
            row.appendChild(mk('span', 'ag-cs-home-model-share', totalAll > 0 ? (Math.round((m.tokens / totalAll) * 1000) / 10).toFixed(1) + '%' : '—'));
            listEl.appendChild(row);
          }
          if (models.length > usageCore.HOME_MODEL_ROWS) {
            const hiddenCount = models.length - shown.length;
            const more = mk('button', 'ag-cs-home-models-more', modelsExpanded ? ui.showLess || 'Show less' : typeof ui.showMoreN === 'function' ? ui.showMoreN(hiddenCount) : `Show ${hiddenCount} more`);
            more.type = 'button';
            more.addEventListener('click', () => { modelsExpanded = !modelsExpanded; renderHomePanel(); });
            listEl.appendChild(more);
          }
          panel.appendChild(listEl);
        }
      });
    }

    return {
      scheduleUsageRollupRefresh,
      refreshUsageRollup,
      refreshLiveTelemetrySnapshot,
      syncGreeting,
      restoreGreetings,
      parkPanelSeat,
      unmountPanelSeat,
      renderHomePanel,
      flushUsageCacheNow,
      wasHero: () => wasHero,
      getUsageRecordsCount: () => usageRecords.size,
      hasConnectedPanel: () => Boolean(panelEl && panelEl.isConnected),
    };
  }

  const api = { createHomeStudioPanelController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismHomeStudioPanel = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
