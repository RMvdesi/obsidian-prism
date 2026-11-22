import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const usageCore = require('../usage-core.js');

test('formatCompactTokens matches expected units and rounding', () => {
  assert.equal(usageCore.formatCompactTokens(0), '0');
  assert.equal(usageCore.formatCompactTokens(949), '949');
  assert.equal(usageCore.formatCompactTokens(1540), '1.5k');
  assert.equal(usageCore.formatCompactTokens(999990), '1M');
  assert.equal(usageCore.formatCompactTokens(647800000), '647.8M');
  assert.equal(usageCore.formatCompactTokens(2500000000), '2.5B');
});

test('formatHomeHour formats AM/PM in zh and en', () => {
  assert.equal(usageCore.formatHomeHour(0, true), '上午 12 点');
  assert.equal(usageCore.formatHomeHour(12, true), '下午 12 点');
  assert.equal(usageCore.formatHomeHour(15, true), '下午 3 点');
  assert.equal(usageCore.formatHomeHour(0, false), '12 AM');
  assert.equal(usageCore.formatHomeHour(14, false), '2 PM');
});

test('analyzeTrajectoryForUsage extracts calls, days, hours, models, and retryInfos fallback', () => {
  const t0 = Math.floor(new Date(2026, 10, 10, 14, 15, 0).getTime() / 1000);
  const t1 = Math.floor(new Date(2026, 10, 11, 9, 30, 0).getTime() / 1000);
  const traj = {
    trajectory: {
      steps: [
        { metadata: { createdAt: { seconds: String(t0), nanos: 0 } } },
        { metadata: { createdAt: { seconds: String(t1), nanos: 0 } } },
      ],
      generatorMetadata: [
        {
          stepIndices: [0],
          metadata: {
            value: {
              modelDisplayName: 'Gemini 4 Argon (High)',
              usage: { inputTokens: '1000', cacheReadTokens: '4000', outputTokens: '500' },
            },
          },
        },
        {
          stepIndices: [1],
          metadata: {
            value: {
              responseModel: 'claude-opus-5.5',
              retryInfos: [
                { usage: { inputTokens: '100', outputTokens: '10' } },
                { usage: { inputTokens: '2000', cacheReadTokens: '8000', cacheWriteTokens: '500', outputTokens: '1000' } },
              ],
            },
          },
        },
      ],
    },
  };
  const rec = usageCore.analyzeTrajectoryForUsage(traj, { stepCount: 2, lastModifiedTime: { seconds: String(t1) } }, 'c1');
  assert.equal(rec.cascadeId, 'c1');
  assert.equal(rec.subagent, false);
  assert.equal(rec.calls, 2);
  assert.equal(rec.days['2026-11-10'].total, 5500);
  assert.equal(rec.days['2026-11-10'].hours[14], 1);
  assert.equal(rec.days['2026-11-11'].total, 11500);
  assert.equal(rec.days['2026-11-11'].hours[9], 1);
  assert.equal(rec.days['2026-11-11'].models['claude-opus-5.5'].total, 11500);
});

test('aggregateUsageRollup excludes subagents from sessions, filters ranges, and picks book yardstick', () => {
  const now = new Date(2026, 10, 14, 12, 0, 0);
  const dToday = usageCore.homeDayKey(now);
  const d10 = usageCore.homeDayKey(new Date(2026, 10, 4, 12, 0, 0));
  const d45 = usageCore.homeDayKey(new Date(2026, 8, 25, 12, 0, 0));

  const records = [
    {
      cascadeId: 'main-1',
      subagent: false,
      days: {
        [dToday]: {
          calls: 3,
          input: 10000,
          output: 2000,
          cacheRead: 30000,
          cacheWrite: 0,
          total: 42000,
          hours: (() => { const a = new Array(24).fill(0); a[15] = 3; return a; })(),
          models: { 'Gemini 4 Argon': { input: 10000, output: 2000, cacheRead: 30000, cacheWrite: 0, total: 42000, calls: 3 } },
        },
        [d45]: {
          calls: 1,
          input: 5000,
          output: 1000,
          cacheRead: 0,
          cacheWrite: 0,
          total: 6000,
          hours: (() => { const a = new Array(24).fill(0); a[8] = 1; return a; })(),
          models: { 'Claude Opus': { input: 5000, output: 1000, cacheRead: 0, cacheWrite: 0, total: 6000, calls: 1 } },
        },
      },
    },
    {
      cascadeId: 'sub-1',
      subagent: true,
      days: {
        [d10]: {
          calls: 2,
          input: 8000,
          output: 2000,
          cacheRead: 0,
          cacheWrite: 0,
          total: 10000,
          hours: (() => { const a = new Array(24).fill(0); a[15] = 2; return a; })(),
          models: { 'Gemini 4 Argon': { input: 8000, output: 2000, cacheRead: 0, cacheWrite: 0, total: 10000, calls: 2 } },
        },
      },
    },
  ];

  const all = usageCore.aggregateUsageRollup(records, 'all', 0.0, true, now);
  assert.equal(all.sessions, 1); // sub-1 excluded!
  assert.equal(all.calls, 6);
  assert.equal(all.tokens, 58000);
  assert.equal(all.activeDays, 3);
  assert.equal(all.peakHour, '下午 3 点');
  assert.equal(all.model, 'Gemini 4 Argon');
  assert.match(all.funBook, /《道德经》/);

  const seven = usageCore.aggregateUsageRollup(records, '7d', 0.0, true, now);
  assert.equal(seven.sessions, 1);
  assert.equal(seven.calls, 3);
  assert.equal(seven.tokens, 42000);
  assert.equal(seven.activeDays, 1);

  const thirty = usageCore.aggregateUsageRollup(records, '30d', 0.0, false, now);
  assert.equal(thirty.tokens, 52000);
  assert.equal(thirty.activeDays, 2);
});

test('homeHeatGrid produces Sunday-aligned 26+ week cells with levels 0..5', () => {
  const now = new Date(2026, 10, 14, 12, 0, 0); // Saturday
  const dToday = usageCore.homeDayKey(now);
  const dPrev = usageCore.homeDayKey(new Date(2026, 10, 13, 12, 0, 0));
  const grid = usageCore.homeHeatGrid({ [dToday]: 10000, [dPrev]: 1500 }, now);
  assert.ok(grid.cells.length >= 26 * 7);
  assert.equal(grid.cells[0].date.length, 10);
  const last = grid.cells[grid.cells.length - 1];
  assert.equal(last.date, dToday);
  assert.equal(last.level, 5);
  const prevCell = grid.cells.find((c) => c.date === dPrev);
  assert.equal(prevCell.level, 1);
});

test('homeChartTicks never produce overlapping labels', () => {
  const widths = new Array(30).fill(42);
  const ticks = usageCore.homeChartTicks(widths, 420, 8, 2);
  assert.ok(ticks.length >= 1);
  assert.equal(ticks[ticks.length - 1].index, 29);
  for (let i = 1; i < ticks.length; i++) {
    assert.ok(ticks[i - 1].left + widths[ticks[i - 1].index] + 8 <= ticks[i].left);
  }
});

test('analyzeTrajectoryForUsage metadata-only span interpolation & mergeUsageRecordDelta O(delta) accumulation', () => {
  const cSec = Math.floor(new Date(2026, 10, 10, 10, 0, 0).getTime() / 1000);
  const mSec = Math.floor(new Date(2026, 10, 12, 16, 0, 0).getTime() / 1000);
  const sum1 = { stepCount: 100, createdTime: { seconds: cSec }, lastModifiedTime: { seconds: mSec } };
  const base = usageCore.analyzeTrajectoryForUsage(
    {
      numTotalSteps: 100,
      numTotalGeneratorMetadata: 2,
      trajectory: {
        cascadeId: 'conv-inc',
        steps: [],
        generatorMetadata: [
          { stepIndices: [5], metadata: { value: { modelDisplayName: 'Gemini 4 Carbon', usage: { inputTokens: 1000, outputTokens: 200 } } } },
          { stepIndices: [95], metadata: { value: { modelDisplayName: 'Gemini 4 Carbon', usage: { inputTokens: 2000, outputTokens: 300 } } } },
        ],
      },
    },
    sum1,
    'conv-inc'
  );
  assert.equal(base.gmCount, 2);
  assert.equal(base.calls, 2);

  const mSec2 = Math.floor(new Date(2026, 10, 12, 17, 0, 0).getTime() / 1000);
  const delta = usageCore.analyzeTrajectoryForUsage(
    {
      numTotalSteps: 110,
      numTotalGeneratorMetadata: 3,
      trajectory: {
        cascadeId: 'conv-inc',
        steps: [],
        generatorMetadata: [
          { stepIndices: [108], metadata: { value: { modelDisplayName: 'Gemini 4 Carbon', usage: { inputTokens: 500, outputTokens: 100 } } } },
        ],
      },
    },
    { stepCount: 110, createdTime: { seconds: mSec2 }, lastModifiedTime: { seconds: mSec2 } },
    'conv-inc'
  );
  const merged = usageCore.mergeUsageRecordDelta(base, delta, {
    cascadeId: 'conv-inc',
    stepCount: 110,
    lastModifiedSec: mSec2,
    gmCount: 3,
    subagent: false,
  });
  assert.equal(merged.gmCount, 3);
  assert.equal(merged.stepCount, 110);
  assert.equal(merged.calls, 3);
  const rollup = usageCore.aggregateUsageRollup([merged], 'all', 0, true, new Date(2026, 10, 14, 12, 0, 0));
  assert.equal(rollup.tokens, 4100);
  assert.equal(rollup.calls, 3);
});

test('v0.9.1 chatModel parsing, Swarm subagent token split, cacheHitRate, and workspace filtering with parent inheritance', () => {
  const isoDay = '2026-11-15T10:30:00.000Z';
  const mainRec = usageCore.analyzeTrajectoryForUsage(
    {
      trajectory: {
        steps: [{ metadata: { createdAt: isoDay } }],
        generatorMetadata: [
          {
            stepIndices: [0],
            chatModel: {
              modelDisplayName: 'Gemini 4 Carbon (High)',
              usage: { inputTokens: 2000, cacheReadTokens: 18000, cacheWriteTokens: 0, outputTokens: 1000 },
            },
          },
        ],
      },
    },
    {
      stepCount: 1,
      lastModifiedTime: isoDay,
      workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c%3A/projects/obsidian-prism/' }],
    },
    'conv-main'
  );
  assert.equal(mainRec.workspace, 'obsidian-prism');
  assert.equal(mainRec.subagent, false);
  assert.equal(mainRec.calls, 1);

  const subRec = usageCore.analyzeTrajectoryForUsage(
    {
      trajectory: {
        steps: [{ metadata: { createdAt: isoDay } }],
        generatorMetadata: [
          {
            stepIndices: [0],
            chatModel: {
              modelDisplayName: 'Gemini 4 Hydrogen (High)',
              usage: { inputTokens: 5000, cacheReadTokens: 15000, cacheWriteTokens: 0, outputTokens: 2000 },
            },
          },
        ],
      },
    },
    {
      stepCount: 1,
      lastModifiedTime: isoDay,
      trajectoryMetadata: { parentConversationId: 'conv-main', nestingDepth: 1 },
    },
    'conv-sub-1'
  );
  assert.equal(subRec.subagent, true);
  assert.equal(subRec.parentId, 'conv-main');
  assert.equal(subRec.workspace, ''); // subagent summary lacks workspace, should inherit from parentId during rollup

  const otherWsRec = usageCore.analyzeTrajectoryForUsage(
    {
      trajectory: {
        steps: [{ metadata: { createdAt: isoDay } }],
        generatorMetadata: [
          {
            stepIndices: [0],
            chatModel: {
              modelDisplayName: 'Claude Opus 4.6',
              usage: { inputTokens: 4000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 1000 },
            },
          },
        ],
      },
    },
    {
      stepCount: 1,
      lastModifiedTime: isoDay,
      workspaceUri: 'file:///Users/dev/another-repo',
    },
    'conv-other'
  );
  assert.equal(otherWsRec.workspace, 'another-repo');

  const now = new Date('2026-11-16T12:00:00.000Z');
  const fullRollup = usageCore.aggregateUsageRollup([mainRec, subRec, otherWsRec], 'all', 0, 'zh-CN', now);
  assert.equal(fullRollup.sessions, 2);
  assert.equal(fullRollup.subagentSessions, 1);
  assert.equal(fullRollup.mainTokens, 21000 + 5000);
  assert.equal(fullRollup.subagentTokens, 22000);
  assert.equal(fullRollup.tokens, 48000);
  // Total input = (2000+18000) + (5000+15000) + 4000 = 44000, cacheRead = 33000 -> 0.75
  assert.ok(Math.abs(fullRollup.cacheHitRate - 0.75) < 1e-6);
  assert.equal(fullRollup.workspaces.length, 2);
  assert.equal(fullRollup.workspaces[0].id, 'obsidian-prism');
  assert.equal(fullRollup.workspaces[0].tokens, 43000); // includes inherited subagent!

  // Filtered by obsidian-prism workspace
  const wsRollup = usageCore.aggregateUsageRollup([mainRec, subRec, otherWsRec], 'all', 0, 'zh-CN', now, {
    workspace: 'obsidian-prism',
  });
  assert.equal(wsRollup.sessions, 1);
  assert.equal(wsRollup.subagentSessions, 1);
  assert.equal(wsRollup.tokens, 43000);
  assert.equal(wsRollup.subagentTokens, 22000);
});

test('v0.9.1 quota helpers: Argon weekly pool matching, linear depletion forecast, and multi-language pace status', () => {
  const nowMs = Date.parse('2026-11-18T06:00:00.000Z');
  const groups = [
    {
      id: 'gemini',
      name: 'Gemini',
      windows: {
        '5h': { available: true, id: 'gemini-5h', remaining: 0.72, resetAt: new Date(nowMs + 2.5 * 3600 * 1000).toISOString() },
        weekly: { available: true, id: 'gemini-weekly', remaining: 0.84, resetAt: new Date(nowMs + 4 * 86400 * 1000).toISOString() },
      },
    },
    {
      id: 'gemini-argon-wtu',
      name: 'Gemini (Argon)',
      windows: {
        '5h': { available: false },
        weekly: { available: true, id: 'gemini-argon-wtu-weekly', remaining: 0.2, resetAt: new Date(nowMs + 5 * 86400 * 1000).toISOString() },
      },
    },
    {
      id: 'claude',
      name: 'Claude / GPT',
      windows: {
        '5h': { available: true, id: 'claude-5h', remaining: 0.9, resetAt: new Date(nowMs + 4 * 3600 * 1000).toISOString() },
        weekly: { available: true, id: 'claude-weekly', remaining: 0.92, resetAt: new Date(nowMs + 6 * 86400 * 1000).toISOString() },
      },
    },
  ];

  assert.equal(usageCore.chooseQuotaGroup(groups, 'Gemini 4 Argon (High)').id, 'gemini-argon-wtu');
  assert.equal(usageCore.chooseQuotaGroup(groups, 'Gemini 4 Carbon (High)').id, 'gemini');
  assert.equal(usageCore.chooseQuotaGroup(groups, 'Claude Sonnet 4.6').id, 'claude');
  assert.equal(usageCore.chooseQuotaGroup(groups, 'Gemini 4 Carbon', 'claude').id, 'claude');

  // Gemini 5h: 2.5h elapsed, 28% used -> projected another 28% drop -> endRemaining ~ 0.44, status 'ok'
  const fcOk = usageCore.quotaForecast(groups[0].windows['5h'], '5h', nowMs);
  assert.equal(fcOk.status, 'ok');
  assert.equal(fcOk.willExhaust, false);
  assert.ok(Math.abs(fcOk.endRemaining - 0.44) < 0.01);
  assert.ok(Math.abs(fcOk.forecastDrop - 0.28) < 0.01);

  // Argon weekly: 2 days elapsed out of 7, 80% already burned (remaining 0.20) -> will exhaust well before 5 days reset!
  const fcExhaust = usageCore.quotaForecast(groups[1].windows.weekly, 'weekly', nowMs);
  assert.equal(fcExhaust.status, 'exhaust');
  assert.equal(fcExhaust.willExhaust, true);
  assert.equal(fcExhaust.endRemaining, 0);
  assert.ok(Math.abs(fcExhaust.forecastDrop - 0.2) < 0.01);

  const paceZh = usageCore.groupQuotaPace(groups[1], 'zh-CN', nowMs);
  assert.equal(paceZh.status, 'exhaust');
  assert.equal(paceZh.label, '提前耗尽');
  assert.match(paceZh.detail, /预计 .*后耗尽/);

  const paceEn = usageCore.groupQuotaPace(groups[0], 'en', nowMs);
  assert.equal(paceEn.status, 'ok');
  assert.equal(paceEn.label, 'On track');
});

test('v0.9.1 telemetry sidecar isolation & selectServerByCdpLineage multi-instance matching', async () => {
  const { platformPaths } = await import('../vendor/pulse-dashboard/compat/platform.mjs');
  const { selectServerByCdpLineage, extractHubPort } = await import('../vendor/pulse-dashboard/sidecars/panel/discovery.mjs');

  const defaultPaths = platformPaths();
  assert.ok(
    defaultPaths.data.includes('obsidian-prism'),
    `Default telemetry data dir must be isolated under obsidian-prism, got ${defaultPaths.data}`
  );
  assert.equal(
    defaultPaths.data.includes('antigravity-pulse'),
    false,
    'Must never collide with external antigravity-pulse data lock directory'
  );

  // Simulate two Antigravity Electron instances (PID 1000 on CDP 9222 -> child language_server 1050; PID 2000 on CDP 9223 -> child helper 2010 -> language_server 2050)
  const allRows = [
    { ProcessId: 1000, ParentProcessId: 100, Name: 'Antigravity.exe', CommandLine: 'Antigravity.exe --remote-debugging-port=9222' },
    { ProcessId: 1050, ParentProcessId: 1000, Name: 'language_server.exe', CommandLine: 'language_server.exe --standalone --hub-port 51111' },
    { ProcessId: 2000, ParentProcessId: 100, Name: 'Antigravity.exe', CommandLine: 'Antigravity.exe --remote-debugging-port=9223' },
    { ProcessId: 2010, ParentProcessId: 2000, Name: 'Antigravity.exe', CommandLine: 'Antigravity.exe --type=utility' },
    { ProcessId: 2050, ParentProcessId: 2010, Name: 'language_server.exe', CommandLine: 'language_server.exe --standalone --hub-port=52222' },
  ];
  const candidates = [allRows[1], allRows[4]];
  const portOwners = new Map([
    [9222, new Set([1000])],
    [9223, new Set([2000])],
  ]);

  const matched9223 = selectServerByCdpLineage(candidates, allRows, portOwners, 9223);
  assert.equal(matched9223.length, 1);
  assert.equal(matched9223[0].ProcessId, 2050);
  assert.equal(extractHubPort(matched9223[0].CommandLine), 52222);

  const matched9222 = selectServerByCdpLineage(candidates, allRows, portOwners, 9222);
  assert.equal(matched9222.length, 1);
  assert.equal(matched9222[0].ProcessId, 1050);
  assert.equal(extractHubPort(matched9222[0].CommandLine), 51111);
});

test('home-studio-panel backfills Swarm subagent summaries via usageBridge.listSummaries flat fields without deleting cached subagents', async () => {
  const homeStudioPanel = require('../home-studio-panel.js');
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;

  let listSummariesCalls = 0;
  let fetchBatchItems = [];
  const dKey = usageCore.homeDayKey(new Date(1763400000 * 1000));
  const storeMem = new Map();

  globalThis.localStorage = {
    getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
    setItem: (k, v) => storeMem.set(k, String(v)),
  };
  globalThis.document = {
    title: 'obsidian-prism - Antigravity',
    body: {},
    querySelector: () => null,
  };
  globalThis.window = {
    __agPrismUsageBridge: {
      isOnline: () => true,
      listSummaries: async () => {
        listSummariesCalls += 1;
        return {
          ok: true,
          summaries: [
            {
              id: 'sub-swarm-1',
              stepCount: 6,
              lastModifiedSec: 1763400050,
              createdSec: 1763400000,
              subagent: true,
              parentId: 'main-conv-1',
              rootId: 'main-conv-1',
            },
          ],
        };
      },
      fetchBatch: async (items) => {
        fetchBatchItems = items;
        return {
          ok: true,
          records: items.map((it) => ({
            id: it.id,
            mode: 'full',
            record: {
              cascadeId: it.id,
              stepCount: it.stepCount,
              lastModifiedSec: it.lastModifiedSec,
              gmCount: 2,
              subagent: it.subagent,
              workspace: it.workspace || '',
              parentId: it.parentId || '',
              calls: 2,
              days: {
                [dKey]: {
                  calls: 2,
                  input: 4000,
                  output: 1000,
                  cacheRead: 6000,
                  cacheWrite: 0,
                  total: 11000,
                  hours: new Array(24).fill(0),
                  models: { 'Gemini 4 Carbon': { input: 4000, output: 1000, cacheRead: 6000, cacheWrite: 0, total: 11000, calls: 2 } },
                },
              },
            },
          })),
        };
      },
    },
  };

  try {
    const ctl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:rollup:v101',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'zh-CN',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({
        store: {
          getState: () => ({
            trajectorySummaries: {
              // Redux only exposes main-conv-1, NOT sub-swarm-1!
              summaries: {
                'main-conv-1': {
                  stepCount: 8,
                  lastModifiedTime: { seconds: 1763400060 },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c:/projects/obsidian-prism' }],
                },
              },
            },
          }),
        },
        svc: {},
      }),
      canMountRealCanvas: () => false,
      setAttrIfChanged: () => {},
      runGuardedMut: (fn) => fn(),
    });

    await ctl.refreshUsageRollup(true);
    assert.equal(listSummariesCalls, 1, 'Must invoke usageBridge.listSummaries()');
    assert.equal(ctl.getUsageRecordsCount(), 2, 'Both main-conv-1 and backfilled sub-swarm-1 must be retained');
    const subItem = fetchBatchItems.find((x) => x.id === 'sub-swarm-1');
    assert.ok(subItem, 'sub-swarm-1 must be included in fetchBatch');
    assert.equal(subItem.subagent, true);
    assert.equal(subItem.parentId, 'main-conv-1');
    assert.equal(subItem.lastModifiedSec, 1763400050);

    // Simulate temporary daemon bridge offline on subsequent refresh: cached sub-swarm-1 must NOT be deleted while parent main-conv-1 is present!
    globalThis.window.__agPrismUsageBridge = null;
    await ctl.refreshUsageRollup(true);
    assert.equal(ctl.getUsageRecordsCount(), 2, 'Cached subagent must not be purged while parent conversation remains active');

    ctl.flushUsageCacheNow();
    const persisted = JSON.parse(storeMem.get('test:rollup:v101') || '{}');
    const wsRollup = usageCore.aggregateUsageRollup(Object.values(persisted), 'all', 0, 'zh-CN', new Date(1763400100 * 1000), {
      workspace: 'obsidian-prism',
    });
    assert.equal(wsRollup.tokens, 22000, 'Subagent tokens must inherit parent workspace during workspace filtering');
    assert.equal(wsRollup.subagentTokens, 11000);

    // #256 guard: home-studio-panel STUDIO_EXTRA_CSS & renderQuotasView must eliminate zebra hatch (.ag-cs-qbar-hatch)
    const fsMod = await import('node:fs');
    const homePanelSrc = fsMod.readFileSync(new URL('../home-studio-panel.js', import.meta.url), 'utf8');
    assert.equal(homePanelSrc.includes('repeating-linear-gradient'), false, 'Studio quota bars must have zero zebra hatch stripes');
    assert.equal(homePanelSrc.includes('ag-cs-qbar-hatch'), false, 'Studio quota bars must render 100% solid remaining width only');
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});

test('UX-4 & UX-9 Effort Slider off-mode trigger tint cleanup and 5-language title resolution', async () => {
  const sliderCoexist = (await import('../vendor/effort-slider/slider-coexist.js')).default || (await import('../vendor/effort-slider/slider-coexist.js'));
  const upstreamSlider = (await import('../vendor/effort-slider/upstream-client.js')).default || (await import('../vendor/effort-slider/upstream-client.js'));

  // Minimal DOM mock for slider-coexist off-mode cleanup
  const stylesById = new Map();
  const effortSpan = {
    style: { color: 'rgb(245, 158, 11)', opacity: '1', fontWeight: '600' },
    attrs: new Map([['data-ces-part', 'trigger-effort']]),
    removeAttribute(k) {
      this.attrs.delete(k);
    },
  };
  const enhancedPanel = {
    classes: new Set(['ces-ag-panel-enhanced']),
    classList: {
      remove(c) {
        enhancedPanel.classes.delete(c);
      },
    },
  };
  const mockDoc = {
    documentElement: {
      langAttr: 'en',
      getAttribute(k) {
        return k === 'data-ag-cs-lang' ? this.langAttr : null;
      },
      appendChild(el) {
        if (el.id) stylesById.set(el.id, el);
      },
    },
    head: {
      appendChild(el) {
        if (el.id) stylesById.set(el.id, el);
      },
    },
    body: {},
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        id: '',
        textContent: '',
        remove() {
          if (this.id) stylesById.delete(this.id);
        },
      };
    },
    getElementById(id) {
      return stylesById.get(id) || null;
    },
    querySelectorAll(sel) {
      if (sel.includes('trigger-effort')) return [effortSpan];
      if (sel === '.ces-ag-panel-enhanced') return [enhancedPanel];
      return [];
    },
  };
  const mockWin = { document: mockDoc };
  const ctl = sliderCoexist.createEffortSliderController({ window: mockWin, document: mockDoc });

  ctl.sync({ effortSliderModule: 'off' });
  assert.equal(effortSpan.style.color, '', 'Off mode must strip inline trigger effort color');
  assert.equal(effortSpan.style.fontWeight, '', 'Off mode must strip inline trigger effort fontWeight');
  assert.equal(effortSpan.attrs.has('data-ces-part'), false, 'Off mode must remove data-ces-part="trigger-effort"');
  assert.equal(enhancedPanel.classes.has('ces-ag-panel-enhanced'), false, 'Off mode must strip .ces-ag-panel-enhanced');
  const hideCss = stylesById.get('ag-prism-effort-slider-hide')?.textContent || '';
  assert.ok(hideCss.includes('.ces-ag-section') && hideCss.includes('trigger-effort'), 'Hide CSS must cover .ces-ag-section and trigger-effort');

  // Verify upstream mountCodexEffortSlider localizes aria-label to English / Japanese via data-ag-cs-lang
  const makeNode = (tag) => {
    const attrs = new Map();
    const children = [];
    const styleObj = {
      setProperty(k, v) {
        styleObj[k] = v;
      },
      removeProperty(k) {
        delete styleObj[k];
      },
      getPropertyValue(k) {
        return styleObj[k] || '';
      },
    };
    const clsSet = new Set();
    return {
      tagName: tag.toUpperCase(),
      className: '',
      classList: {
        add: (...cs) => cs.forEach((c) => clsSet.add(c)),
        remove: (...cs) => cs.forEach((c) => clsSet.delete(c)),
        toggle: (c, f) => (f === undefined ? (clsSet.has(c) ? clsSet.delete(c) : clsSet.add(c)) : f ? clsSet.add(c) : clsSet.delete(c)),
        contains: (c) => clsSet.has(c),
      },
      innerHTML: '',
      style: styleObj,
      children,
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      removeAttribute: (k) => attrs.delete(k),
      appendChild: (c) => { children.push(c); return c; },
      removeChild: (c) => {
        const idx = children.indexOf(c);
        if (idx >= 0) children.splice(idx, 1);
      },
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, width: 120, top: 0, height: 24 }),
    };
  };
  let curSliderLang = 'en';
  const sliderDoc = {
    documentElement: { getAttribute: (k) => (k === 'data-ag-cs-lang' ? curSliderLang : null) },
    head: makeNode('head'),
    getElementById: () => null,
    createElement: makeNode,
  };
  const hostBox = makeNode('div');
  const mountedEn = upstreamSlider.mountCodexEffortSlider({
    container: hostBox,
    document: sliderDoc,
    window: { document: sliderDoc },
    seat: { getLevels: () => ['low', 'medium', 'high'], getIndex: () => 1, setIndex() {} },
  });
  assert.equal(hostBox.children[0].getAttribute('aria-label'), 'Reasoning Effort');
  mountedEn.unmount();

  curSliderLang = 'ja';
  const hostBoxJa = makeNode('div');
  const mountedJa = upstreamSlider.mountCodexEffortSlider({
    container: hostBoxJa,
    document: sliderDoc,
    window: { document: sliderDoc },
    seat: { getLevels: () => ['low', 'medium', 'high'], getIndex: () => 1, setIndex() {} },
  });
  assert.equal(hostBoxJa.children[0].getAttribute('aria-label'), '推論レベル');
  mountedJa.unmount();
  ctl.destroy();
});

test('#209 Windows zero-WMI discoverProcesses fast-path & multi-instance cdpPort lineage disambiguation', async () => {
  const { discoverProcesses } = await import('../vendor/pulse-dashboard/sidecars/panel/discovery.mjs');

  // 1. Single instance with cdpPort=3014: must run ONLY 1 PowerShell fast scan + 1 netstat (zero full-tree second PS call!)
  const singleCalls = [];
  const singleRes = await discoverProcesses({
    platform: 'win32',
    cdpPort: 3014,
    run: async (bin, args) => {
      singleCalls.push({ bin, args });
      if (/powershell/i.test(bin)) {
        return {
          stdout: JSON.stringify({
            ProcessId: 113040,
            ParentProcessId: 58892,
            Name: 'language_server.exe',
            CommandLine: 'language_server.exe --standalone --csrf_token tok123',
          }),
        };
      }
      if (/netstat/i.test(bin)) {
        return {
          stdout: '  TCP    127.0.0.1:5506         0.0.0.0:0              LISTENING       113040\r\n',
        };
      }
      return { stdout: '' };
    },
  });
  assert.equal(singleRes.length, 1);
  assert.equal(singleRes[0].ProcessId, 113040);
  assert.deepEqual(singleRes[0].Ports, [5506]);
  assert.equal(singleCalls.filter((c) => /powershell/i.test(c.bin)).length, 1, 'Single candidate must skip full process tree scan');
  assert.ok(singleCalls[0].args.join(' ').includes('AgFastProc'), 'Must use zero-WMI AgFastProc kernel fast-path');

  // 2. Multi-instance disambiguation: picks the language_server descended from the Antigravity PID owning cdpPort=3018
  let psCount = 0;
  const multiRes = await discoverProcesses({
    platform: 'win32',
    cdpPort: 3018,
    run: async (bin) => {
      if (/powershell/i.test(bin)) {
        psCount += 1;
        if (psCount === 1) {
          return {
            stdout: JSON.stringify([
              { ProcessId: 2001, ParentProcessId: 1000, Name: 'language_server.exe', CommandLine: 'language_server.exe --standalone --csrf_token a' },
              { ProcessId: 3001, ParentProcessId: 2000, Name: 'language_server.exe', CommandLine: 'language_server.exe --standalone --csrf_token b' },
            ]),
          };
        }
        return {
          stdout: JSON.stringify([
            { ProcessId: 1000, ParentProcessId: 4, Name: 'Antigravity.exe' },
            { ProcessId: 2000, ParentProcessId: 4, Name: 'Antigravity.exe' },
          ]),
        };
      }
      return {
        stdout: [
          '  TCP    127.0.0.1:3014         0.0.0.0:0              LISTENING       1000',
          '  TCP    127.0.0.1:3018         0.0.0.0:0              LISTENING       2000',
          '  TCP    127.0.0.1:6101         0.0.0.0:0              LISTENING       2001',
          '  TCP    127.0.0.1:6202         0.0.0.0:0              LISTENING       3001',
        ].join('\r\n'),
      };
    },
  });
  assert.equal(multiRes.length, 1);
  assert.equal(multiRes[0].ProcessId, 3001);
  assert.deepEqual(multiRes[0].Ports, [6202]);
});

test('#209 inline-fallback.js: telemetryModule="on" overrides external Pulse & "auto" rescues blocked/parked external bar immediately', async () => {
  const telemetryMod = (await import('../vendor/pulse-dashboard/inline-fallback.js')).default || (await import('../vendor/pulse-dashboard/inline-fallback.js'));

  const makeEl = (tag) => {
    const attrs = new Map();
    const styleProps = new Map();
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      children: [],
      parentNode: null,
      parentElement: null,
      shadowRoot: null,
      isConnected: true,
      hidden: false,
      textContent: '',
      className: '',
      style: {
        setProperty(k, v) { styleProps.set(k, String(v)); },
        getPropertyValue(k) { return styleProps.get(k) || ''; },
        removeProperty(k) { styleProps.delete(k); },
        get display() { return styleProps.get('display') || ''; },
        set display(v) { if (v) styleProps.set('display', String(v)); else styleProps.delete('display'); },
      },
      get id() { return attrs.get('id') || ''; },
      set id(v) { attrs.set('id', String(v)); },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) {
        if (c.parentNode) c.remove();
        c.parentNode = el;
        c.parentElement = el.tagName === '#SHADOW-ROOT' ? null : el;
        c.isConnected = el.isConnected;
        el.children.push(c);
        return c;
      },
      insertBefore(c, ref) {
        const idx = ref ? el.children.indexOf(ref) : -1;
        if (idx < 0) return el.appendChild(c);
        if (c.parentNode) c.remove();
        c.parentNode = el;
        c.parentElement = el.tagName === '#SHADOW-ROOT' ? null : el;
        c.isConnected = el.isConnected;
        el.children.splice(idx, 0, c);
        return c;
      },
      removeChild(c) {
        const i = el.children.indexOf(c);
        if (i >= 0) {
          el.children.splice(i, 1);
          c.parentNode = null;
          c.parentElement = null;
          c.isConnected = false;
        }
        return c;
      },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      attachShadow() {
        const sr = makeEl('#shadow-root');
        sr.host = el;
        el.shadowRoot = sr;
        return sr;
      },
      getElementById(id) {
        let hit = null;
        const walk = (n) => {
          for (const ch of n.children || []) {
            if (!hit && ch.id === id) hit = ch;
            if (!hit) walk(ch);
          }
        };
        walk(el);
        return hit;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const parts = String(sel).split(',').map((s) => s.trim()).filter(Boolean);
        const match = (n, p) => {
          if (p.startsWith('#')) return n.id === p.slice(1);
          if (p.startsWith('.')) return String(n.className || '').split(/\s+/).includes(p.slice(1));
          const am = p.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]+)")?\]$/);
          if (am) return n.hasAttribute(am[1]) && (am[2] === undefined || n.getAttribute(am[1]) === am[2]);
          return n.tagName === p.toUpperCase();
        };
        const walk = (n) => {
          for (const ch of n.children || []) {
            if (parts.some((p) => match(ch, p))) out.push(ch);
            walk(ch);
          }
        };
        walk(el);
        return out;
      },
      closest() { return null; },
      contains() { return false; },
      addEventListener() {},
      removeEventListener() {},
    };
    return el;
  };

  const html = makeEl('html');
  const body = makeEl('body');
  html.appendChild(body);
  const footer = makeEl('div');
  footer.className = 'agy-composer-footer flex items-center';
  const leftSlot = makeEl('div');
  const rightSendSlot = makeEl('div');
  footer.appendChild(leftSlot);
  footer.appendChild(rightSendSlot);
  body.appendChild(footer);

  const extBar = makeEl('div');
  extBar.id = 'ag-pulse-status-bar';
  extBar.setAttribute('data-ag-pulse-bar', 'true');
  footer.insertBefore(extBar, rightSendSlot);

  const doc = {
    hidden: false,
    readyState: 'complete',
    documentElement: html,
    body,
    createElement: makeEl,
    getElementById: (id) => html.getElementById(id),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    location: { pathname: '/c/11111111-2222-3333-4444-555555555555' },
    __agPulseRuntimeOwner: 'external-pulse-v091',
  };

  const ctl = telemetryMod.createTelemetryController({ window: win, document: doc });

  // 1. In "auto" mode with healthy external bar -> politely yields
  const stAutoHealthy = ctl.sync({ telemetryModule: 'auto' });
  assert.equal(stAutoHealthy.yieldedToExternal, true);
  assert.equal(stAutoHealthy.mountedFallback, false);
  assert.ok(win.__agPrismMetricsBridge?.getMetrics, 'Must expose __agPrismMetricsBridge even when yielding');

  // 2. External bar gets squeezed into data-layout="blocked" -> "auto" mode rescues immediately (0ms)
  extBar.setAttribute('data-layout', 'blocked');
  const stAutoRescue = ctl.sync({ telemetryModule: 'auto' });
  assert.equal(stAutoRescue.mountedFallback, true, 'Auto mode must immediately mount fallback when external bar is blocked');
  assert.equal(stAutoRescue.yieldedToExternal, false);

  // External bar recovers to data-layout="ready" -> "auto" mode yields back cleanly
  extBar.setAttribute('data-layout', 'ready');
  const stAutoRecover = ctl.sync({ telemetryModule: 'auto' });
  assert.equal(stAutoRecover.mountedFallback, false);
  assert.equal(stAutoRecover.yieldedToExternal, true);

  // 3. User explicitly selects telemetryModule="on" -> disposes external runtime, holds __agPulseInlineInstalled=true guard, & offscreen-hides external bar!
  let pulseDisposed = 0;
  win.__agPulseDispose = () => {
    pulseDisposed += 1;
    win.__agPulseInlineInstalled = false;
    delete win.__agPulseDispose;
  };
  const stForcedOn = ctl.sync({ telemetryModule: 'on' });
  assert.equal(stForcedOn.mountedFallback, true, 'telemetryModule="on" must force built-in fallback even when external exists');
  assert.equal(stForcedOn.yieldedToExternal, false);
  assert.equal(pulseDisposed, 1, 'telemetryModule="on" must invoke win.__agPulseDispose()');
  assert.equal(win.__agPulseInlineInstalled, true, '#285: must immediately pin __agPulseInlineInstalled=true to block external sidecar 2s CDP re-injection');
  assert.equal(extBar.getAttribute('data-ag-prism-hidden'), '1');
  assert.notEqual(extBar.style.display, 'none', 'Must NOT set display:none (avoids getClientRects()===0 forced-reflow loop)');
  assert.equal(extBar.style.getPropertyValue('opacity'), '0', 'External bar must be offscreen-hidden with opacity:0');
  assert.equal(extBar.style.getPropertyValue('position'), 'fixed');
  // Seated before rightSendSlot inside .agy-composer-footer
  const fbNode = doc.querySelector('[data-ag-prism-fallback="1"]');
  assert.ok(fbNode);
  assert.equal(footer.children[footer.children.length - 1], rightSendSlot, 'Fallback bar must seat before trailing send controls');

  ctl.destroy();
  assert.equal(win.__agPulseInlineInstalled, false, '#285: destroy()/showExt() must restore __agPulseInlineInstalled=false when external was disposed');
  assert.equal(win.__agPrismMetricsBridge, undefined, 'destroy() must clean up __agPrismMetricsBridge');
});

test('Cross-port usage rollup disk cache persists safely across PrismDaemon restarts & home-studio-panel avoids cold-start 0-KPI flash', async () => {
  const fsMod = await import('node:fs');
  const osMod = await import('node:os');
  const pathMod = await import('node:path');
  const { PrismDaemon } = await import('../sidecars/daemon/main.mjs');
  const homePanelMod = (await import('../home-studio-panel.js')).default || globalThis.__agPrismHomeStudioPanel;

  const tmpRoot = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'ag-prism-usage-cache-'));
  try {
    const repoRoot = pathMod.resolve(pathMod.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
    fsMod.copyFileSync(pathMod.join(repoRoot, 'cdp.js'), pathMod.join(tmpRoot, 'cdp.js'));
    fsMod.copyFileSync(pathMod.join(repoRoot, 'usage-core.js'), pathMod.join(tmpRoot, 'usage-core.js'));

    const cid = '11111111-2222-3333-4444-555555555555';
    const sampleRec = {
      cascadeId: cid,
      stepCount: 12,
      lastModifiedSec: 1763400100,
      gmCount: 4,
      subagent: false,
      workspace: 'obsidian-prism',
      parentId: '',
      calls: 4,
      days: { '2026-11-21': { calls: 4, tokens: 15000, cachedTokens: 12000, subagentTokens: 0 } },
      hours: { 10: 15000 },
      models: { 'Gemini 4 Neon': 15000 },
    };

    // 1) Daemon #1 writes disk cache atomically
    const d1 = new PrismDaemon({ rootDir: tmpRoot, silent: true, enableAutoUpdateTimer: false });
    d1._putUsageDiskCache(cid, 12, 1763400100, sampleRec);
    d1._flushUsageDiskCache();
    const cachePath = pathMod.join(tmpRoot, '.usage-rollup-cache.json');
    assert.equal(fsMod.existsSync(cachePath), true, 'Disk usage cache must be persisted');

    // 2) Daemon #2 (simulating cold restart on rotated port) serves cached record on list-summaries & fetch-batch with 0 trajectory RPC calls
    const d2 = new PrismDaemon({ rootDir: tmpRoot, silent: true, enableAutoUpdateTimer: false });
    let trajectoryCalls = 0;
    d2.ensureLsClient = async () => ({
      server: { mode: 'renderer-proxy' },
      async trajectory() { trajectoryCalls += 1; throw new Error('Should hit disk cache'); },
    });
    d2._fetchBackendTrajectorySummaries = async () => ({
      list: [{ id: cid, stepCount: 0, lastModifiedSec: 1763400080, workspace: 'obsidian-prism' }],
      byId: new Map([[cid, { id: cid, stepCount: 0, lastModifiedSec: 1763400080, workspace: 'obsidian-prism' }]]),
    });

    const listRes = await d2.fetchUsageRollupBatch([], { action: 'list-summaries' });
    assert.equal(listRes.ok, true);
    assert.equal(listRes.records.length, 1, 'list-summaries must return cached disk records for matching summary IDs');
    assert.equal(listRes.records[0].id, cid);
    assert.equal(listRes.records[0].record.calls, 4);

    const batchRes = await d2.fetchUsageRollupBatch([{ id: cid, stepCount: 12, lastModifiedSec: 1763400100 }], { action: 'fetch-batch' });
    assert.equal(batchRes.ok, true);
    assert.equal(batchRes.records.length, 1);
    assert.equal(trajectoryCalls, 0, 'Exact (stepCount, lastModifiedSec) disk hit must skip trajectory RPC');

    // 3) home-studio-panel stays in skeleton before usageHasData (no fake 0-KPI flash) & hydrates immediately from listSummaries().records
    const prevWin = globalThis.window;
    const prevDoc = globalThis.document;
    const prevStorage = globalThis.localStorage;
    try {
      const makeNode = (tag) => {
        const n = {
          tagName: String(tag).toUpperCase(),
          className: '',
          textContent: '',
          children: [],
          attrs: new Map(),
          style: {},
          setAttribute(k, v) { this.attrs.set(k, String(v)); },
          getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
          hasAttribute(k) { return this.attrs.has(k); },
          removeAttribute(k) { this.attrs.delete(k); },
          appendChild(c) { c.parentElement = this; c.isConnected = true; this.children.push(c); return c; },
          insertBefore(c) { c.parentElement = this; c.isConnected = true; this.children.push(c); return c; },
          removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentElement = null; c.isConnected = false; },
          addEventListener() {},
          remove() {},
          get childElementCount() { return this.children.length; },
          set innerHTML(_v) { this.children = []; },
          querySelectorAll(sel) {
            const out = [];
            const walk = (x) => {
              for (const ch of x.children || []) {
                if (sel === '[data-skeleton]' && ch.hasAttribute('data-skeleton')) out.push(ch);
                else if (sel === '.ag-cs-home-stat-value' && ch.className.includes('ag-cs-home-stat-value')) out.push(ch);
                else if (sel.includes('home-greeting') && ch.getAttribute('data-testid') === 'home-greeting') out.push(ch);
                walk(ch);
              }
            };
            walk(this);
            return out;
          },
          querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
        };
        return n;
      };
      const homeEl = makeNode('div');
      homeEl.className = 'agy-home';
      const greetingEl = makeNode('div');
      greetingEl.setAttribute('data-testid', 'home-greeting');
      const doc = {
        head: makeNode('head'),
        body: makeNode('body'),
        documentElement: makeNode('html'),
        createElement: makeNode,
        getElementById: () => null,
        querySelector: (s) => (s === '.agy-home' ? homeEl : s.includes('home-greeting') ? greetingEl : null),
      };
      doc.body.appendChild(homeEl);
      homeEl.appendChild(greetingEl);
      greetingEl.insertAdjacentElement = (_pos, el) => homeEl.appendChild(el);
      globalThis.document = doc;
      globalThis.localStorage = { getItem: () => null, setItem() {} };
      globalThis.window = {
        document: doc,
        __agPrismUsageBridge: {
          isOnline: () => true,
          listSummaries: async () => listRes,
          fetchBatch: async () => ({ ok: true, records: [] }),
        },
      };

      const ctl = homePanelMod.createHomeStudioPanelController({
        usageCore,
        isDestroyed: () => false,
        getHomeLayout: () => 'studio',
        getLang: () => 'zh-CN',
        uiText: () => ({
          homeTabOverview: '概览', homeTabModels: '模型', homeTabQuotas: '模型配额',
          homeRangeAll: '全部', homeRange30d: '30天', homeRange7d: '7天',
          homeAllWorkspaces: '全部项目', homeSessions: '会话数', homeMessages: '消息数',
          homeTokens: 'Token 总量', homeActiveDays: '活跃天数', homeCacheHit: '缓存命中率', homeTopModel: '最常用模型',
        }),
        getDisplayName: () => 'User',
        ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: { [cid]: { stepCount: 12, lastModifiedTime: { seconds: 1763400100 } } } } }) } }),
        canMountRealCanvas: () => false,
        setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
        runGuardedMut: (fn) => fn(),
      });

      // Before refreshUsageRollup completes, renderHomePanel must show skeleton (0 fake "0" KPI values)
      ctl.renderHomePanel(true);
      const skelCells = homeEl.querySelectorAll('[data-skeleton]');
      assert.ok(skelCells.length >= 6, `Cold-start before data must render skeleton cells instead of 0, got ${skelCells.length}`);
      const preVals = homeEl.querySelectorAll('.ag-cs-home-stat-value').map((n) => n.textContent);
      assert.equal(preVals.includes('0'), false, 'Cold-start must never flash fake "0" KPI before data arrives');

      // After refreshUsageRollup, listSummaries().records seeds usageRecords directly without fetchBatch
      await ctl.refreshUsageRollup(true);
      assert.equal(homeEl.querySelectorAll('[data-skeleton]').length, 0, 'Skeleton must clear once disk-cached records hydrate');
      assert.equal(ctl.getUsageRecordsCount(), 1);
      ctl.unmountPanelSeat();
    } finally {
      if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevStorage;
    }
  } finally {
    fsMod.rmSync(tmpRoot, { recursive: true, force: true });
  }
});



