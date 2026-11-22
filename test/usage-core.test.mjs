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

// ==================== PR #19 / PR #22 / Todo 3 (Remote-SSH Isolation) Regressions ====================

function createMockStudioDom(initialTitle = 'obsidian-prism — Antigravity') {
  class MockNode {
    constructor(tag) {
      this.tagName = String(tag || 'DIV').toUpperCase();
      this.className = '';
      this.id = '';
      this._textContent = '';
      this.title = '';
      this.value = '';
      this.type = '';
      this.disabled = false;
      this.style = {
        setProperty(k, v) { this[k] = v; },
        getPropertyValue(k) { return this[k] || ''; },
      };
      this.attrs = new Map();
      this.children = [];
      this.parentElement = null;
      this.listeners = new Map();
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === doc.body || cur === doc.head || cur === doc.documentElement) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    get childElementCount() { return this.children.length; }
    get previousSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx > 0 ? this.parentElement.children[idx - 1] : null;
    }
    get nextSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx >= 0 && idx + 1 < this.parentElement.children.length ? this.parentElement.children[idx + 1] : null;
    }
    get textContent() {
      if (this.children.length === 0) return this._textContent;
      return this._textContent + this.children.map((c) => c.textContent).join('');
    }
    set textContent(v) {
      this._textContent = String(v ?? '');
      this.children = [];
    }
    set innerHTML(v) {
      this._innerHTML = String(v ?? '');
      this.children = [];
      this._textContent = '';
    }
    get innerHTML() { return this._innerHTML || ''; }
    setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(k); }
    removeAttribute(k) { this.attrs.delete(k); }
    addEventListener(ev, fn) { this.listeners.set(ev, fn); }
    appendChild(child) {
      if (!child) return child;
      if (child.tagName === '#FRAGMENT') {
        for (const c of child.children.slice()) this.appendChild(c);
        child.children = [];
        return child;
      }
      if (child.parentElement) child.parentElement.removeChild(child);
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    insertBefore(child, ref) {
      if (!ref) return this.appendChild(child);
      if (child.parentElement) child.parentElement.removeChild(child);
      const idx = this.children.indexOf(ref);
      child.parentElement = this;
      if (idx === -1) this.children.push(child);
      else this.children.splice(idx, 0, child);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) { this.children.splice(idx, 1); child.parentElement = null; }
      return child;
    }
    matches(sel) {
      const parts = String(sel || '').trim().split(/\s+/);
      if (parts.length > 1) {
        if (!this.matches(parts[parts.length - 1])) return false;
        let cur = this.parentElement;
        for (let i = parts.length - 2; i >= 0; i--) {
          while (cur && !cur.matches(parts[i])) cur = cur.parentElement;
          if (!cur) return false;
          cur = cur.parentElement;
        }
        return true;
      }
      if (sel.startsWith('.')) return this.className.split(/\s+/).includes(sel.slice(1));
      const attrEq = sel.match(/^\[([^=\]]+)="([^"]*)"\]$/);
      if (attrEq) return this.getAttribute(attrEq[1]) === attrEq[2];
      const attrHas = sel.match(/^\[([^\]]+)\]$/);
      if (attrHas) return this.hasAttribute(attrHas[1]);
      return this.tagName === sel.toUpperCase();
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (node) => {
        for (const ch of node.children) {
          if (ch.matches(sel)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }

  const doc = {
    title: initialTitle,
    documentElement: null,
    head: null,
    body: null,
    createElement(tag) { return new MockNode(tag); },
    createDocumentFragment() { return new MockNode('#FRAGMENT'); },
    getElementById(id) {
      const find = (n) => {
        if (!n) return null;
        if (n.id === id) return n;
        for (const c of n.children) { const r = find(c); if (r) return r; }
        return null;
      };
      return find(doc.head) || find(doc.body);
    },
    querySelector(sel) { return doc.body.querySelector(sel); },
    querySelectorAll(sel) { return doc.body.querySelectorAll(sel); },
  };
  doc.documentElement = new MockNode('html');
  doc.head = new MockNode('head');
  doc.body = new MockNode('body');
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);

  const home = doc.createElement('div');
  home.className = 'agy-home';
  const greeting = doc.createElement('div');
  greeting.setAttribute('data-testid', 'home-greeting');
  const h1 = doc.createElement('h1');
  h1.textContent = 'Good evening';
  greeting.appendChild(h1);
  home.appendChild(greeting);
  doc.body.appendChild(home);
  return { doc, home, greeting };
}

test('PR #19: isMainEntry handles Windows Junction / symlinked CLI entrypoints in main.mjs & conversation-archive.mjs', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { pathToFileURL, fileURLToPath } = await import('node:url');
  const { execFileSync } = await import('node:child_process');
  const { isMainEntry: mainIsEntry } = await import('../sidecars/daemon/main.mjs');
  const { isMainEntry: archiveIsEntry } = await import('../sidecars/daemon/conversation-archive.mjs');

  const daemonDir = path.resolve(fileURLToPath(new URL('../sidecars/daemon', import.meta.url)));
  const mainFile = path.join(daemonDir, 'main.mjs');
  const archiveFile = path.join(daemonDir, 'conversation-archive.mjs');
  const mainUrl = pathToFileURL(mainFile).href;
  const archiveUrl = pathToFileURL(archiveFile).href;

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pr19-'));
  const linkDir = path.join(tmpBase, 'daemon-link');
  try {
    fs.symlinkSync(daemonDir, linkDir, process.platform === 'win32' ? 'junction' : 'dir');
    const linkedMain = path.join(linkDir, 'main.mjs');
    const linkedArchive = path.join(linkDir, 'conversation-archive.mjs');

    assert.equal(mainIsEntry(linkedMain, mainFile), true, 'main.mjs isMainEntry must return true for junction/symlinked argv[1]');
    assert.equal(mainIsEntry(linkedMain, mainUrl), true, 'main.mjs isMainEntry must accept file:// moduleUrl');
    assert.equal(archiveIsEntry(linkedArchive, archiveUrl), true, 'conversation-archive.mjs isMainEntry must return true for junction/symlinked argv[1]');

    if (process.platform === 'win32') {
      const flippedDrive = linkedMain.replace(/^([A-Za-z]):/, (_, d) => `${d === d.toUpperCase() ? d.toLowerCase() : d.toUpperCase()}:`);
      assert.equal(mainIsEntry(flippedDrive, mainFile), true, 'Win32 drive-letter casing difference must still match');
      assert.equal(archiveIsEntry(linkedArchive.toUpperCase(), archiveUrl), true, 'Win32 case-insensitive junction path must match');
    }

    // Negative cases
    assert.equal(mainIsEntry('', mainFile), false);
    assert.equal(mainIsEntry(path.join(linkDir, 'non-existent.mjs'), mainFile), false);
    assert.equal(mainIsEntry(linkedArchive, mainFile), false, 'Different script must not match');
    assert.equal(archiveIsEntry(linkedMain, archiveUrl), false, 'Different script must not match');

    // End-to-end CLI execution through junction/symlink directory (isolated HOME/USERPROFILE)
    const cliOut = execFileSync(process.execPath, [linkedArchive, '--list-batches', '--json'], {
      encoding: 'utf8',
      timeout: 8000,
      env: { ...process.env, USERPROFILE: tmpBase, HOME: tmpBase },
    });
    assert.deepEqual(JSON.parse(cliOut), [], 'CLI invoked via junction/symlink must enter CLI main branch and output JSON batches');

    // Security redline preserved in daemon/main.mjs
    const mainSrc = fs.readFileSync(mainFile, 'utf8');
    assert.ok(mainSrc.includes('assertNotSymlinkSync'), 'assertNotSymlinkSync security boundary must remain intact in sidecars/daemon/main.mjs');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('PR #22: usage rollup disk cache uses ~/.gemini/config, enforces non-symlink/4MB/1200/0o600, supports v1 compat & cold-restart 0-RPC hit', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { PrismDaemon, resolveUsageCachePath } = await import('../sidecars/daemon/main.mjs');

  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const prevEnv = process.env.PRISM_USAGE_CACHE_PATH;
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pr22-'));
  const tmpCfg = path.join(tmpBase, 'cfg');
  fs.mkdirSync(tmpCfg, { recursive: true });

  const coldId = '11111111-1111-4111-8111-111111111101';
  const legacyId = '11111111-1111-4111-8111-111111111102';
  const symRecId = '11111111-1111-4111-8111-111111111103';

  try {
    // 1. Default path points to ~/.gemini/config/obsidian-prism-usage-rollup-cache.json, overridable via env / param
    delete process.env.PRISM_USAGE_CACHE_PATH;
    const defaultPath = resolveUsageCachePath().replace(/\\/g, '/');
    assert.ok(defaultPath.endsWith('/.gemini/config/obsidian-prism-usage-rollup-cache.json'), `Unexpected default cache path: ${defaultPath}`);

    const envPath = path.join(tmpCfg, 'env-cache.json');
    process.env.PRISM_USAGE_CACHE_PATH = envPath;
    assert.equal(resolveUsageCachePath(), path.resolve(envPath));

    const explicitPath = path.join(tmpCfg, 'explicit-cache.json');
    assert.equal(resolveUsageCachePath(explicitPath), path.resolve(explicitPath));

    // 2. Daemon #1 populates rollup cache & flushes atomically with 0o600, never polluting rootDir
    const dSec = 1763400100;
    const fakeTraj = {
      trajectory: {
        steps: [{ metadata: { createdAt: { seconds: String(dSec), nanos: 0 } } }],
        generatorMetadata: [{
          stepIndices: [0],
          metadata: {
            value: {
              modelDisplayName: 'Gemini 4 Carbon',
              usage: { inputTokens: '5000', cacheReadTokens: '15000', outputTokens: '2000' },
            },
          },
        }],
      },
    };
    const fakeSummaries = {
      [coldId]: {
        stepCount: 4,
        lastModifiedTime: { seconds: String(dSec) },
        createdTime: { seconds: String(dSec - 60) },
        workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c:/proj/prism' }],
      },
    };

    const daemon1 = new PrismDaemon({ rootDir: repoRoot, usageCachePath: explicitPath, silent: true });
    daemon1._discoverLocalAppConversations = () => [];
    let rpcTrajCalls1 = 0;
    daemon1._lazyLsClient = {
      server: { port: 0, mode: 'renderer-proxy' },
      call: async (method) => {
        if (method === 'GetAllCascadeTrajectories') return { trajectorySummaries: fakeSummaries };
        return {};
      },
      trajectory: async () => { rpcTrajCalls1 += 1; return fakeTraj; },
    };

    const batch1 = await daemon1.fetchUsageRollupBatch(
      [{ id: coldId, stepCount: 4, lastModifiedSec: dSec, createdSec: dSec - 60 }],
      { action: 'fetch-batch' }
    );
    assert.equal(batch1.ok, true);
    assert.equal(rpcTrajCalls1, 1);
    assert.equal(batch1.records[0].mode, 'full');
    assert.equal(batch1.records[0].record.calls, 1);
    daemon1._flushUsageDiskCache();

    // Must NOT pollute repo rootDir
    assert.equal(fs.existsSync(path.join(repoRoot, '.usage-rollup-cache.json')), false, 'Must never write cache inside rootDir');
    assert.equal(fs.existsSync(explicitPath), true, 'Cache file must be persisted to configured usageCachePath');
    const st = fs.lstatSync(explicitPath);
    assert.equal(st.isSymbolicLink(), false);
    if (process.platform !== 'win32') {
      assert.equal(st.mode & 0o777, 0o600, 'POSIX cache file mode must be 0o600');
    }
    const mainSrc = fs.readFileSync(new URL('../sidecars/daemon/main.mjs', import.meta.url), 'utf8');
    assert.match(mainSrc, /writeFileAtomicSync\(cacheFile,\s*serialized,\s*\{\s*mode:\s*0o600\s*\}\)/, 'Must write cache via writeFileAtomicSync with mode 0o600');

    // 3. Cold restart: Daemon #2 serves list-summaries & fetch-batch with 0 trajectory RPCs
    const daemon2 = new PrismDaemon({ rootDir: repoRoot, usageCachePath: explicitPath, silent: true });
    daemon2._discoverLocalAppConversations = () => [];
    let rpcTrajCalls2 = 0;
    daemon2._lazyLsClient = {
      server: { port: 0, mode: 'renderer-proxy' },
      call: async (method) => {
        if (method === 'GetAllCascadeTrajectories') return { trajectorySummaries: fakeSummaries };
        rpcTrajCalls2 += 1;
        throw new Error(`Unexpected RPC on cache hit: ${method}`);
      },
      trajectory: async () => { rpcTrajCalls2 += 1; throw new Error('Should not be called on cache hit'); },
    };
    const list2 = await daemon2.fetchUsageRollupBatch(null, { action: 'list-summaries' });
    assert.equal(list2.ok, true);
    assert.equal(list2.records.length, 1);
    assert.equal(list2.records[0].id, coldId);
    const batch2 = await daemon2.fetchUsageRollupBatch(
      [{ id: coldId, stepCount: 4, lastModifiedSec: dSec }],
      { action: 'fetch-batch' }
    );
    assert.equal(batch2.ok, true);
    assert.equal(batch2.records[0].mode, 'full');
    assert.equal(rpcTrajCalls2, 0, 'Cold-restarted daemon must hit disk cache with 0 trajectory RPCs');

    // 4. v1 flat format backward compatibility into local scope
    const v1Path = path.join(tmpCfg, 'v1-compat.json');
    fs.writeFileSync(v1Path, JSON.stringify({
      [legacyId]: {
        stepCount: 3,
        lastModifiedSec: dSec,
        record: {
          cascadeId: legacyId,
          stepCount: 3,
          lastModifiedSec: dSec,
          gmCount: 1,
          calls: 1,
          days: { '2026-11-18': { calls: 1, input: 1000, output: 500, cacheRead: 0, cacheWrite: 0, total: 1500, hours: new Array(24).fill(0), models: {} } },
        },
      },
    }), 'utf8');
    const daemonV1 = new PrismDaemon({ rootDir: repoRoot, usageCachePath: v1Path, silent: true });
    daemonV1._discoverLocalAppConversations = () => [];
    daemonV1._lazyLsClient = {
      server: { port: 12347, mode: 'http' },
      call: async (method) => {
        if (method === 'GetAllCascadeTrajectories') {
          return { trajectorySummaries: { [legacyId]: { stepCount: 3, lastModifiedTime: { seconds: String(dSec) } } } };
        }
        return {};
      },
    };
    const v1Res = await daemonV1.fetchUsageRollupBatch(null, { action: 'list-summaries' });
    assert.equal(v1Res.records.length, 1);
    assert.equal(v1Res.records[0].id, legacyId);

    // 5. > 4 MB file rejected cleanly
    const bigPath = path.join(tmpCfg, 'oversize.json');
    fs.writeFileSync(bigPath, ' '.repeat(4 * 1024 * 1024 + 128), 'utf8');
    const daemonBig = new PrismDaemon({ rootDir: repoRoot, usageCachePath: bigPath, silent: true });
    assert.equal(daemonBig._loadUsageDiskCache().size, 0, 'Oversize (>4MB) cache file must be ignored');

    // 6. > 1200 records per scope trimmed to newest 1200 on flush
    const capPath = path.join(tmpCfg, 'cap-1200.json');
    const daemonCap = new PrismDaemon({ rootDir: repoRoot, usageCachePath: capPath, silent: true });
    const makeUuid = (i) => `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`;
    for (let i = 0; i < 1250; i++) {
      const id = makeUuid(i);
      daemonCap._putUsageDiskCache(id, 2, 1700000000 + i, {
        cascadeId: id,
        stepCount: 2,
        lastModifiedSec: 1700000000 + i,
        calls: 1,
        days: { '2026-11-18': { calls: 1, total: 100 } },
      }, 'local');
    }
    daemonCap._flushUsageDiskCache();
    const savedCap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    const savedKeys = Object.keys(savedCap.scopes.local);
    assert.equal(savedKeys.length, 1200, 'Per-scope cache must trim to at most 1200 records');
    assert.ok(savedCap.scopes.local[makeUuid(1249)], 'Newest record must be retained');
    assert.equal(savedCap.scopes.local[makeUuid(0)], undefined, 'Oldest records must be evicted');

    // 7. Symlink target refused on both read and write (victim untouched)
    const victimDir = path.join(tmpBase, 'victim-dir');
    fs.mkdirSync(victimDir, { recursive: true });
    const victimFile = path.join(victimDir, 'victim.txt');
    fs.writeFileSync(victimFile, 'DO_NOT_OVERWRITE', 'utf8');
    let symCachePath = path.join(tmpCfg, 'symlink-cache.json');
    let symlinkCreated = false;
    try {
      fs.symlinkSync(victimFile, symCachePath, 'file');
      symlinkCreated = true;
    } catch {
      // Windows without Developer Mode: test directory junction parent defense instead
      const juncDir = path.join(tmpBase, 'junc-cfg');
      fs.symlinkSync(victimDir, juncDir, 'junction');
      symCachePath = path.join(juncDir, 'victim.txt');
    }
    const daemonSym = new PrismDaemon({ rootDir: repoRoot, usageCachePath: symCachePath, silent: true });
    assert.equal(daemonSym._loadUsageDiskCache().size, 0, 'Symlinked/junction cache path must be refused on load');
    daemonSym._putUsageDiskCache(symRecId, 1, dSec, { cascadeId: symRecId, stepCount: 1, lastModifiedSec: dSec, calls: 1, days: { '2026-11-18': { total: 500, calls: 1 } } }, 'local');
    daemonSym._flushUsageDiskCache();
    assert.equal(fs.readFileSync(victimFile, 'utf8'), 'DO_NOT_OVERWRITE', `Symlink/junction write must be refused (fileSymlink=${symlinkCreated})`);
  } finally {
    if (prevEnv === undefined) delete process.env.PRISM_USAGE_CACHE_PATH;
    else process.env.PRISM_USAGE_CACHE_PATH = prevEnv;
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('PR #22 edge fixes: offline/0-session exits skeleton within bounded wait and offline >240-step fallback preserves real stats', async () => {
  const homeStudioPanel = require('../home-studio-panel.js');
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;
  const storeMem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
    setItem: (k, v) => { storeMem.set(k, String(v)); },
    removeItem: (k) => { storeMem.delete(k); },
  };
  const { doc } = createMockStudioDom('obsidian-prism — Antigravity');
  globalThis.document = doc;

  let online = false;
  let onlineChecks = 0;
  let listCalls = 0;
  let fetchBatchCalls = 0;
  let lastBatchIds = [];
  const dKey = usageCore.homeDayKey(new Date(1763400100 * 1000));
  const realRecord = (id, stepCount, lastModifiedSec, total) => ({
    cascadeId: id,
    stepCount,
    lastModifiedSec,
    gmCount: 5,
    subagent: false,
    workspace: 'obsidian-prism',
    parentId: '',
    calls: 12,
    days: {
      [dKey]: {
        calls: 12,
        input: Math.floor(total * 0.4),
        output: Math.floor(total * 0.1),
        cacheRead: Math.floor(total * 0.5),
        cacheWrite: 0,
        total,
        hours: new Array(24).fill(0),
        models: { 'Gemini 4 Carbon': { input: Math.floor(total * 0.4), output: Math.floor(total * 0.1), cacheRead: Math.floor(total * 0.5), cacheWrite: 0, total, calls: 12 } },
      },
    },
  });

  globalThis.window = {
    document: doc,
    location: { href: 'vscode-file://vscode-app/workbench.html' },
    __agPrismUsageBridge: {
      isOnline: () => { onlineChecks += 1; return online; },
      listSummaries: async () => {
        listCalls += 1;
        return { ok: true, scopeKey: 'local', summaries: [], records: [{ id: 'online-hydrated-1', record: realRecord('online-hydrated-1', 10, 1763400100, 42000) }] };
      },
      fetchBatch: async (items) => {
        fetchBatchCalls += 1;
        lastBatchIds = items.map((x) => x.id);
        return {
          ok: true,
          scopeKey: 'local',
          records: items.map((it) => ({ id: it.id, mode: 'full', record: realRecord(it.id, it.stepCount, it.lastModifiedSec, 125000) })),
        };
      },
    },
  };

  try {
    // Part A: Cold start skeleton (0 fake "0" KPI flash) + offline 0-session exits skeleton within <= 10 poll ticks
    let reduxSummaries = {};
    let directTrajCalls = 0;
    const ctlA = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:pr22:offlineA',
      waitTickMs: 5,
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({
        store: { getState: () => ({ trajectorySummaries: { summaries: reduxSummaries } }) },
        svc: { getCascadeTrajectory: async () => { directTrajCalls += 1; return {}; } },
      }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });

    ctlA.renderHomePanel(true);
    const skelBefore = doc.querySelectorAll('[data-skeleton]');
    assert.ok(skelBefore.length >= 6, 'Cold start with empty cache must render skeleton placeholders');
    const statValsBefore = doc.querySelectorAll('.ag-cs-home-stat-value').map((n) => n.textContent);
    assert.equal(statValsBefore.every((t) => t === ''), true, 'Cold-start skeleton must never flash fake "0" KPI numbers');

    onlineChecks = 0;
    await ctlA.refreshUsageRollup(true);
    assert.ok(onlineChecks <= 15, `Offline cold wait must be tightly bounded (<=10 ticks), saw ${onlineChecks} checks`);
    assert.equal(doc.querySelectorAll('[data-skeleton]').length, 0, 'Offline/0-session refresh must exit skeleton cleanly (no permanent deadlock)');

    // Bridge comes back online -> force=false must immediately refresh (lastUsageFetchAt was not locked during offline pass)
    online = true;
    await ctlA.refreshUsageRollup(false);
    assert.equal(listCalls, 1, 'Coming online after offline pass must immediately invoke listSummaries() even with force=false');
    assert.equal(ctlA.getUsageRecordsCount(), 1, 'Online hydration must populate cached record');

    // Part B: Offline >240-step conversation preserves existing cached real stats (never overwritten with 0) and auto-backfills once online
    online = false;
    storeMem.set('test:pr22:bigConv', JSON.stringify({
      'big-conv-1': realRecord('big-conv-1', 250, 1763400100, 98000),
    }));
    reduxSummaries = {
      'big-conv-1': { stepCount: 265, lastModifiedTime: { seconds: 1763400200 }, workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c:/proj/obsidian-prism' }] },
    };
    const ctlB = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:pr22:bigConv',
      waitTickMs: 5,
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({
        store: { getState: () => ({ trajectorySummaries: { summaries: reduxSummaries } }) },
        svc: { getCascadeTrajectory: async () => { directTrajCalls += 1; return {}; } },
      }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });

    await ctlB.refreshUsageRollup(true);
    ctlB.flushUsageCacheNow();
    assert.equal(directTrajCalls, 0, 'Offline fallback must skip direct getCascadeTrajectory for >240-step conversation');
    const afterOffline = JSON.parse(storeMem.get('test:pr22:bigConv') || '{}')['big-conv-1'];
    assert.equal(afterOffline.calls, 12, 'Existing real call count must be preserved when offline skips >240-step conversation');
    assert.equal(afterOffline.days[dKey].total, 98000, 'Existing real token total must NEVER be overwritten with 0');
    assert.equal(afterOffline.stepCount, 265, 'Cursor must advance stepCount during offline skip to prevent repeated spin/write storms');
    assert.equal(afterOffline.lastModifiedSec, 1763400200, 'Cursor must advance lastModifiedSec during offline skip');
    assert.equal(afterOffline._do, 1, 'Deferred offline flag must be set to guarantee future backfill');

    // Subsequent offline pass with unchanged steps must NOT re-write localStorage in a spin loop
    let offlineWrites = 0;
    const origSetItem = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = (k, v) => { offlineWrites += 1; origSetItem(k, v); };
    try {
      await ctlB.refreshUsageRollup(false);
      await new Promise((r) => setTimeout(r, 30));
    } finally {
      globalThis.localStorage.setItem = origSetItem;
    }
    assert.equal(offlineWrites, 0, 'Offline refresh must not spin-write localStorage for unchanged >240-step conversation');

    // Once bridge comes back online, big-conv-1 auto-backfills via fetchBatch and clears _do
    online = true;
    fetchBatchCalls = 0;
    lastBatchIds = [];
    await ctlB.refreshUsageRollup(true);
    ctlB.flushUsageCacheNow();
    assert.equal(fetchBatchCalls, 1);
    assert.deepEqual(lastBatchIds, ['big-conv-1']);
    const afterOnline = JSON.parse(storeMem.get('test:pr22:bigConv') || '{}')['big-conv-1'];
    assert.equal(afterOnline.days[dKey].total, 125000);
    assert.equal(afterOnline.stepCount, 265);
    assert.equal(afterOnline._do, undefined, 'Online backfill must clear deferred _do marker');
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});

test('Todo 3: Daemon isolates Local vs Remote-SSH targeted RPC, summary cache buckets, local disk scan & v2 partitioned disk cache', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const {
    PrismDaemon,
    normalizeUsageScopeKey,
    extractScopeKeyFromUri,
    extractScopeKeyFromTitle,
    resolveUsageScopeKey,
  } = await import('../sidecars/daemon/main.mjs');

  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

  // 1. Pure scopeKey normalization & security checks
  assert.equal(normalizeUsageScopeKey('local'), 'local');
  assert.equal(extractScopeKeyFromUri('vscode-remote://ssh-remote+prod-gpu/home/dev/repo'), 'ssh:prod-gpu');
  const hexAuth = Buffer.from(JSON.stringify({ hostName: 'gpu-box.internal' }), 'utf8').toString('hex');
  assert.equal(extractScopeKeyFromUri(`vscode-remote://ssh-remote+${hexAuth}/srv/app`), 'ssh:gpu-box.internal');
  assert.equal(extractScopeKeyFromUri('vscode-file://vscode-app/workbench.html?remoteAuthority=ssh-remote%2Bml-node-1'), 'ssh:ml-node-1');
  assert.equal(extractScopeKeyFromTitle('ml-repo [SSH: prod-gpu] — Antigravity'), 'ssh:prod-gpu');
  assert.equal(extractScopeKeyFromTitle('proj [WSL: Ubuntu-22.04] — Antigravity'), 'remote:wsl-ubuntu-22.04');
  assert.equal(normalizeUsageScopeKey('ssh:__proto__'), '');
  assert.equal(normalizeUsageScopeKey('remote:constructor'), '');
  assert.equal(resolveUsageScopeKey({ entry: { title: 'plain-repo — Antigravity', url: 'vscode-file://vscode-app/workbench.html' } }), 'local');

  // 2. Dual + Hidden-SSH multi-window daemon routing & isolation
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-todo3-'));
  const cacheFile = path.join(tmpBase, 'usage-cache.json');

  const localCid = '33333333-3333-4333-8333-333333333301';
  const sshCid = '33333333-3333-4333-8333-333333333302';
  const sshNewCid = '33333333-3333-4333-8333-333333333303';
  const hiddenSshCid = '33333333-3333-4333-8333-333333333304';
  const diskLocalCid = '33333333-3333-4333-8333-333333333399';
  const dSec = 1763400200;

  // Raw renderer-proxy trajectory shape normalized by normalizeRendererTrajectory()
  const makeRawRendererTraj = (model, totalInput, output) => ({
    trajectory: {
      steps: [{ type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: { seconds: String(dSec), nanos: 0 } } }],
      generatorMetadata: [{
        stepIndices: [0],
        chatModel: {
          model,
          usage: { inputTokens: String(totalInput), outputTokens: String(output) },
        },
      }],
    },
  });

  const makeMockEntry = (pageId, title, url, rpcHandler) => {
    const responses = [];
    const wsUrl = `ws://127.0.0.1:9222/devtools/page/${pageId}`;
    const mainFrameId = `frame-${pageId}`;
    return {
      pageId,
      wsUrl,
      title,
      url,
      mainFrameId,
      contextFrames: new Map([[1, { frameId: mainFrameId, isDefault: true, type: 'default' }]]),
      detectedScopeKey: '',
      responses,
      session: {
        closed: false,
        evaluate: async (expr) => {
          const text = String(expr || '');
          const pMatch = text.match(/\}\)\((\{[\s\S]*\})\)\s*$/);
          if (pMatch) {
            const rpcParams = JSON.parse(pMatch[1]);
            return await rpcHandler(rpcParams.method, rpcParams);
          }
          return null;
        },
        send: async (method, params) => {
          if (method !== 'Runtime.evaluate') return {};
          const expr = String(params?.expression || '');
          const resolveMatch = expr.match(/__agPrismUsageResolve\((\d+),\s*(\{[\s\S]*\})\)/);
          if (resolveMatch) {
            responses.push({ id: Number(resolveMatch[1]), payload: JSON.parse(resolveMatch[2]) });
            return { result: { value: true } };
          }
          return { result: { value: null } };
        },
      },
    };
  };

  try {
    const localRpcLog = [];
    const sshRpcLog = [];
    const hiddenSshRpcLog = [];
    let sshBroken = false;

    const localEntry = makeMockEntry(
      'page-local-1',
      'obsidian-prism — Antigravity',
      'vscode-file://vscode-app/workbench.html',
      async (method, body) => {
        localRpcLog.push({ method, cascadeId: body.cascadeId || '' });
        if (method === 'GetAllCascadeTrajectories') {
          return {
            ok: true,
            data: {
              trajectorySummaries: {
                [localCid]: {
                  stepCount: 5,
                  lastModifiedTime: { seconds: String(dSec) },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c:/proj/obsidian-prism' }],
                },
              },
            },
          };
        }
        if (body.cascadeId === localCid) {
          return { ok: true, data: makeRawRendererTraj('Gemini 4 Carbon', 40000, 10000) };
        }
        return { ok: false, error: 'local-unknown-cascade' };
      }
    );

    const sshEntry = makeMockEntry(
      'page-ssh-1',
      'ml-repo [SSH: prod-gpu] — Antigravity',
      'vscode-file://vscode-app/workbench.html?remoteAuthority=ssh-remote%2Bprod-gpu',
      async (method, body) => {
        sshRpcLog.push({ method, cascadeId: body.cascadeId || '' });
        if (sshBroken) return { ok: false, error: 'ssh-ls-unreachable' };
        if (method === 'GetAllCascadeTrajectories') {
          return {
            ok: true,
            data: {
              scopeHint: 'ssh:prod-gpu',
              trajectorySummaries: {
                [sshCid]: {
                  stepCount: 8,
                  lastModifiedTime: { seconds: String(dSec) },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'vscode-remote://ssh-remote+prod-gpu/home/dev/ml-repo' }],
                },
              },
            },
          };
        }
        if (body.cascadeId === sshCid) {
          return { ok: true, data: makeRawRendererTraj('Claude Opus 4.6', 100000, 20000) };
        }
        return { ok: false, error: 'ssh-unknown-cascade' };
      }
    );

    const hiddenSshEntry = makeMockEntry(
      'page-ssh-hidden',
      'Antigravity',
      'vscode-file://vscode-app/workbench.html',
      async (method) => {
        hiddenSshRpcLog.push({ method });
        if (method === 'GetAllCascadeTrajectories') {
          return {
            ok: true,
            data: {
              trajectorySummaries: {
                [hiddenSshCid]: {
                  stepCount: 3,
                  lastModifiedTime: { seconds: String(dSec) },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'vscode-remote://ssh-remote+hidden-box/srv/app' }],
                },
              },
            },
          };
        }
        return { ok: false, error: 'not-found' };
      }
    );

    const makeRendererProxyDaemon = () => {
      const d = new PrismDaemon({ rootDir: repoRoot, usageCachePath: cacheFile, silent: true });
      d.sessions.set(localEntry.wsUrl, localEntry);
      d.sessions.set(sshEntry.wsUrl, sshEntry);
      d.sessions.set(hiddenSshEntry.wsUrl, hiddenSshEntry);
      // Simulate v2.34+ renderer-proxy LS client (routes via AsyncLocalStorage -> _invokeRendererLsRpc)
      d._lazyLsClient = {
        server: { port: 0, csrf: '', pid: 0, mode: 'renderer-proxy' },
        call: (method, body = {}) => d._invokeRendererLsRpc(method, body),
        trajectory: (cascadeId) => d._invokeRendererLsRpc('GetCascadeTrajectory', { cascadeId }),
      };
      return d;
    };

    const daemon = makeRendererProxyDaemon();

    let localDiskScanCalls = 0;
    daemon._discoverLocalAppConversations = async () => {
      localDiskScanCalls += 1;
      return { conversations: [{ id: diskLocalCid, mtimeMs: dSec * 1000 }] };
    };

    const callUsageBinding = async (d, entry, reqId, payload) => {
      const beforeLen = entry.responses.length;
      await d.handleBindingCall(entry, {
        name: '__agPrismUsageCall',
        payload: JSON.stringify({ id: reqId, ...payload }),
        executionContextId: 1,
      });
      assert.equal(entry.responses.length, beforeLen + 1, 'Binding call must resolve response to caller entry');
      return entry.responses[entry.responses.length - 1].payload;
    };

    // A. Local window list-summaries & fetch-batch
    const localList = await callUsageBinding(daemon, localEntry, 1, { action: 'list-summaries' });
    assert.equal(localList.ok, true);
    assert.equal(localList.scopeKey, 'local');
    assert.ok(localList.summaries.some((s) => s.id === localCid));
    assert.ok(localList.summaries.some((s) => s.id === diskLocalCid), 'Local scope may include local disk conversations');
    assert.equal(localDiskScanCalls, 1);
    assert.equal(sshRpcLog.length, 0, 'Local request must never hit SSH window');

    const localBatch = await callUsageBinding(daemon, localEntry, 2, {
      action: 'fetch-batch',
      items: [{ id: localCid, stepCount: 5, lastModifiedSec: dSec }],
    });
    assert.equal(localBatch.ok, true);
    assert.equal(localBatch.scopeKey, 'local');
    assert.equal(localBatch.records[0].mode, 'full');
    assert.equal(localBatch.records[0].record.days[usageCore.homeDayKey(new Date(dSec * 1000))].total, 50000);
    assert.equal(sshRpcLog.length, 0, 'Local fetch-batch must never route to SSH window');

    // B. Immediate SSH window request within 15s TTL: must NOT read local _backendSummariesCache, must NOT scan local disk, must route ONLY to sshEntry!
    const localRpcBeforeSsh = localRpcLog.length;
    const sshList = await callUsageBinding(daemon, sshEntry, 3, { action: 'list-summaries' });
    assert.equal(sshList.ok, true);
    assert.equal(sshList.scopeKey, 'ssh:prod-gpu');
    assert.deepEqual(sshList.summaries.map((s) => s.id), [sshCid], 'SSH summaries must contain ONLY remote SSH conversations (no local cache or disk bleed)');
    assert.equal(localDiskScanCalls, 1, 'SSH scope must make 0 calls to _discoverLocalAppConversations()');
    assert.equal(localRpcLog.length, localRpcBeforeSsh, 'SSH list-summaries must make 0 RPCs to local window');

    const sshBatch = await callUsageBinding(daemon, sshEntry, 4, {
      action: 'fetch-batch',
      items: [{ id: sshCid, stepCount: 8, lastModifiedSec: dSec }],
    });
    assert.equal(sshBatch.ok, true);
    assert.equal(sshBatch.scopeKey, 'ssh:prod-gpu');
    assert.equal(sshBatch.records[0].mode, 'full');
    const sshDay = sshBatch.records[0].record.days[usageCore.homeDayKey(new Date(dSec * 1000))];
    assert.equal(sshDay.total, 120000, 'SSH trajectory must yield real remote tokens (never 0 from cross-routed local window)');
    assert.ok(sshDay.models['Claude Opus 4.6'], 'SSH favorite model must reflect remote SSH model');
    assert.equal(localRpcLog.length, localRpcBeforeSsh, 'SSH fetch-batch must make 0 RPCs to local window');

    // C. When SSH window RPC fails, daemon must return mode:'error' and NEVER fall back to localEntry!
    sshBroken = true;
    const sshFailBatch = await callUsageBinding(daemon, sshEntry, 5, {
      action: 'fetch-batch',
      items: [{ id: sshNewCid, stepCount: 3, lastModifiedSec: dSec + 10 }],
    });
    assert.equal(sshFailBatch.ok, true);
    assert.equal(sshFailBatch.records[0].mode, 'error', 'Failed SSH RPC must fail closed with mode:"error"');
    assert.equal(localRpcLog.length, localRpcBeforeSsh, 'Failed SSH RPC must NEVER fall back to local window');
    sshBroken = false;

    // D. Title-less hidden SSH window dynamically upgrades scope from returned workspace URIs BEFORE local disk scan
    const hiddenList = await callUsageBinding(daemon, hiddenSshEntry, 6, { action: 'list-summaries' });
    assert.equal(hiddenList.ok, true);
    assert.equal(hiddenList.scopeKey, 'ssh:hidden-box');
    assert.deepEqual(hiddenList.summaries.map((s) => s.id), [hiddenSshCid]);
    assert.equal(localDiskScanCalls, 1, 'Dynamically upgraded hidden SSH window must still make 0 local disk scan calls');

    // E. v2 Partitioned Disk Cache survives restart without local/SSH cross-overwriting
    daemon._flushUsageDiskCache();
    const persisted = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    assert.equal(persisted.version, 2);
    assert.ok(persisted.scopes.local[localCid], 'v2 cache must isolate local records under scopes.local');
    assert.equal(persisted.scopes.local[sshCid], undefined, 'SSH record must never leak into scopes.local');
    assert.ok(persisted.scopes['ssh:prod-gpu'][sshCid], 'v2 cache must isolate SSH records under scopes["ssh:prod-gpu"]');
    assert.equal(persisted.scopes['ssh:prod-gpu'][localCid], undefined, 'Local record must never leak into SSH scope');
    assert.equal(persisted.scopes['ssh:prod-gpu'][sshNewCid], undefined, 'Failed SSH fetch must not pollute cache with 0-token stub');

    const daemonRestart = makeRendererProxyDaemon();
    daemonRestart._discoverLocalAppConversations = () => [];
    const coldSshList = await callUsageBinding(daemonRestart, sshEntry, 7, { action: 'list-summaries' });
    assert.equal(coldSshList.records.length, 1);
    assert.equal(coldSshList.records[0].id, sshCid);
    const coldLocalList = await callUsageBinding(daemonRestart, localEntry, 8, { action: 'list-summaries' });
    assert.equal(coldLocalList.records.length, 1);
    assert.equal(coldLocalList.records[0].id, localCid);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('Todo 3: Frontend home-studio-panel namespaces localStorage by scopeKey and renders pure-DOM XSS-safe scope badge', async () => {
  const fs = await import('node:fs');
  const homeStudioPanel = require('../home-studio-panel.js');
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;
  const storeMem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
    setItem: (k, v) => { storeMem.set(k, String(v)); },
    removeItem: (k) => { storeMem.delete(k); },
  };
  const dKey = usageCore.homeDayKey(new Date(1763400300 * 1000));
  const makeRec = (id, model, total) => ({
    cascadeId: id,
    stepCount: 4,
    lastModifiedSec: 1763400300,
    gmCount: 2,
    subagent: false,
    workspace: 'proj',
    parentId: '',
    calls: 2,
    days: {
      [dKey]: {
        calls: 2,
        input: Math.floor(total * 0.7),
        output: Math.floor(total * 0.3),
        cacheRead: 0,
        cacheWrite: 0,
        total,
        hours: new Array(24).fill(0),
        models: { [model]: { input: Math.floor(total * 0.7), output: Math.floor(total * 0.3), cacheRead: 0, cacheWrite: 0, total, calls: 2 } },
      },
    },
  });

  try {
    // 1. Local window: default storage key, NO scope badge rendered
    const localDom = createMockStudioDom('obsidian-prism — Antigravity');
    globalThis.document = localDom.doc;
    globalThis.window = {
      document: localDom.doc,
      location: { href: 'vscode-file://vscode-app/workbench.html' },
      __agPrismUsageBridge: {
        isOnline: () => true,
        listSummaries: async () => ({ ok: true, scopeKey: 'local', summaries: [{ id: 'local-1', stepCount: 4, lastModifiedSec: 1763400300 }], records: [] }),
        fetchBatch: async (items) => ({ ok: true, scopeKey: 'local', records: items.map((it) => ({ id: it.id, mode: 'full', record: makeRec(it.id, 'Gemini 4 Carbon', 30000) })) }),
      },
    };
    const localCtl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:scope:v1',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: {} } }) }, svc: {} }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });
    await localCtl.refreshUsageRollup(true);
    localCtl.flushUsageCacheNow();
    assert.equal(localCtl.getScopeKey(), 'local');
    assert.ok(JSON.parse(storeMem.get('test:scope:v1') || '{}')['local-1'], 'Local scope must persist under un-suffixed default storage key');
    assert.equal(localDom.doc.querySelector('.ag-cs-home-scope-badge'), null, 'Local window must NOT render redundant remote scope badge');

    // 2. Remote-SSH window sharing same localStorage: separate namespaced key, local records untouched, pure DOM badge rendered
    const sshDom = createMockStudioDom('ml-repo [SSH: prod-gpu] — Antigravity');
    globalThis.document = sshDom.doc;
    globalThis.window = {
      document: sshDom.doc,
      location: { href: 'vscode-file://vscode-app/workbench.html?remoteAuthority=ssh-remote%2Bprod-gpu' },
      __agPrismUsageBridge: {
        isOnline: () => true,
        listSummaries: async () => ({ ok: true, scopeKey: 'ssh:prod-gpu', summaries: [{ id: 'ssh-1', stepCount: 4, lastModifiedSec: 1763400300 }], records: [] }),
        fetchBatch: async (items) => ({ ok: true, scopeKey: 'ssh:prod-gpu', records: items.map((it) => ({ id: it.id, mode: 'full', record: makeRec(it.id, 'Claude Opus 4.6', 90000) })) }),
      },
    };
    const sshCtl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:scope:v1',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: {} } }) }, svc: {} }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });
    await sshCtl.refreshUsageRollup(true);
    sshCtl.flushUsageCacheNow();
    assert.equal(sshCtl.getScopeKey(), 'ssh:prod-gpu');
    assert.ok(JSON.parse(storeMem.get('test:scope:v1:ssh:prod-gpu') || '{}')['ssh-1'], 'SSH scope must persist under namespaced storage key');
    assert.ok(JSON.parse(storeMem.get('test:scope:v1') || '{}')['local-1'], 'SSH pruning must NEVER delete local storage records');
    assert.equal(JSON.parse(storeMem.get('test:scope:v1') || '{}')['ssh-1'], undefined, 'SSH records must NEVER leak into local storage key');

    const badge = sshDom.doc.querySelector('.ag-cs-home-scope-badge');
    assert.ok(badge, 'SSH window must render scope badge next to tabs');
    assert.equal(badge.textContent, 'SSH · prod-gpu');
    assert.equal(badge.getAttribute('data-scope'), 'ssh:prod-gpu');
    assert.equal(badge.getAttribute('data-scope-kind'), 'ssh');
    assert.equal(badge.getAttribute('translate'), 'no');
    assert.equal(badge.getAttribute('data-ag-no-i18n'), '');

    // 3. XSS payload in SSH title must be strictly sanitized and never use innerHTML
    const xssDom = createMockStudioDom('repo [SSH: <img src=x onerror=alert(1)>prod] — Antigravity');
    globalThis.document = xssDom.doc;
    globalThis.window = { document: xssDom.doc, location: { href: 'vscode-file://vscode-app/workbench.html' } };
    const xssCtl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:scope:v1',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: {} } }) }, svc: {} }),
      canMountRealCanvas: () => false,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });
    xssCtl.renderHomePanel(true);
    const xssBadge = xssDom.doc.querySelector('.ag-cs-home-scope-badge');
    assert.ok(xssBadge);
    assert.equal(/[<>"]/.test(xssBadge.textContent), false, 'Scope badge textContent must strip HTML metacharacters');
    assert.equal(/[<>"]/.test(xssBadge.getAttribute('data-scope') || ''), false, 'Scope data-scope attribute must strip HTML metacharacters');

    const panelSrc = fs.readFileSync(new URL('../home-studio-panel.js', import.meta.url), 'utf8');
    const badgeLine = panelSrc.split('\n').find((l) => l.includes('ag-cs-home-scope-badge') && l.includes('markNoTr'));
    assert.ok(badgeLine && !badgeLine.includes('innerHTML'), 'Scope badge must be built via pure DOM textContent with 0 innerHTML');
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});

test('Redteam #192 [P0-1 & P2-4]: unverified SSH window bypasses local HTTP LS, AntigravityClient isolates concurrent scopes, MetricsStore pins local, and >4MB cache evicts oldest scope', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const { fileURLToPath } = await import('node:url');
  const { PrismDaemon } = await import('../sidecars/daemon/main.mjs');
  const { AntigravityClient } = await import('../vendor/pulse-dashboard/sidecars/panel/client.mjs');

  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-rt192-'));
  const cacheFile = path.join(tmpBase, 'usage-cache.json');
  const localCid = '44444444-4444-4444-8444-444444444401';
  const sshCid = '44444444-4444-4444-8444-444444444402';
  const sharedCid = '44444444-4444-4444-8444-444444444499';
  const dSec = 1763400500;

  const makeEntry = (pageId, title, url, rpcHandler) => {
    const responses = [];
    return {
      pageId,
      wsUrl: `ws://127.0.0.1:9222/devtools/page/${pageId}`,
      title,
      url,
      mainFrameId: `f-${pageId}`,
      contextFrames: new Map([[1, { frameId: `f-${pageId}`, isDefault: true, type: 'default' }]]),
      detectedScopeKey: '',
      _usageScopeVerified: false,
      responses,
      session: {
        closed: false,
        evaluate: async (expr) => {
          const m = String(expr || '').match(/\}\)\((\{[\s\S]*\})\)\s*$/);
          if (!m) return null;
          const p = JSON.parse(m[1]);
          return await rpcHandler(p.method, p);
        },
        send: async (method, params) => {
          if (method === 'Runtime.evaluate') {
            const rm = String(params?.expression || '').match(/__agPrismUsageResolve\((\d+),\s*(\{[\s\S]*\})\)/);
            if (rm) responses.push({ id: Number(rm[1]), payload: JSON.parse(rm[2]) });
          }
          return { result: { value: true } };
        },
      },
    };
  };

  try {
    // 1) Title-less unverified Remote-SSH window while local HTTP LS is active must NEVER hit ensureLsClient() or localEntry!
    let localHttpLsCalls = 0;
    let localEntryRpcCalls = 0;
    let hiddenSshRpcCalls = 0;
    let localDiskScanCalls = 0;
    let hiddenShouldFail = false;

    const localEntry = makeEntry(
      'page-local',
      'obsidian-prism — Antigravity',
      'vscode-file://vscode-app/workbench.html',
      async (method) => {
        localEntryRpcCalls += 1;
        if (method === 'GetAllCascadeTrajectories') {
          return {
            ok: true,
            data: {
              trajectorySummaries: {
                [localCid]: {
                  stepCount: 4,
                  lastModifiedTime: { seconds: String(dSec) },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c:/proj/local-app' }],
                },
              },
            },
          };
        }
        return { ok: false, error: 'local-only' };
      }
    );

    const hiddenSshEntry = makeEntry(
      'page-ssh-first',
      'Antigravity',
      'vscode-file://vscode-app/workbench.html',
      async (method) => {
        hiddenSshRpcCalls += 1;
        if (hiddenShouldFail) return { ok: false, error: 'renderer_ls_unavailable' };
        if (method === 'GetAllCascadeTrajectories') {
          return {
            ok: true,
            data: {
              scopeHint: 'ssh:gpu-node-9',
              trajectorySummaries: {
                [sshCid]: {
                  stepCount: 9,
                  lastModifiedTime: { seconds: String(dSec) },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'vscode-remote://ssh-remote+gpu-node-9/srv/ml' }],
                },
              },
            },
          };
        }
        return { ok: false, error: 'not-found' };
      }
    );

    const daemon = new PrismDaemon({ rootDir: repoRoot, usageCachePath: cacheFile, silent: true });
    daemon.sessions.set(localEntry.wsUrl, localEntry);
    daemon.sessions.set(hiddenSshEntry.wsUrl, hiddenSshEntry);
    daemon._discoverLocalAppConversations = async () => {
      localDiskScanCalls += 1;
      return { conversations: [{ id: '44444444-4444-4444-8444-444444444488', mtimeMs: dSec * 1000 }] };
    };
    daemon._lazyLsClient = {
      server: { port: 51234, csrf: 'local-csrf', mode: 'http' },
      call: async () => {
        localHttpLsCalls += 1;
        return {
          trajectorySummaries: {
            [localCid]: {
              stepCount: 4,
              lastModifiedTime: { seconds: String(dSec) },
              workspaces: [{ workspaceFolderAbsoluteUri: 'file:///c:/proj/local-app' }],
            },
          },
        };
      },
    };

    // 1a) Even when unverified SSH renderer temporarily fails, must fail closed and NEVER fall back to localEntry or local HTTP LS
    hiddenShouldFail = true;
    await daemon.handleBindingCall(hiddenSshEntry, {
      name: '__agPrismUsageCall',
      payload: JSON.stringify({ id: 101, action: 'list-summaries' }),
      executionContextId: 1,
    });
    assert.equal(localHttpLsCalls, 0, 'Unverified window must NEVER bypass renderer to hit local HTTP LS');
    assert.equal(localEntryRpcCalls, 0, 'Unverified SSH probe failure must NEVER fall back to localEntry');
    assert.equal(localDiskScanCalls, 0, 'Unverified failed probe must NEVER scan local disk');
    assert.equal(hiddenSshEntry._usageScopeVerified, false);

    // 1b) Once SSH renderer responds, scope calibrates to ssh:gpu-node-9 with 0 local LS or local disk touches
    hiddenShouldFail = false;
    await daemon.handleBindingCall(hiddenSshEntry, {
      name: '__agPrismUsageCall',
      payload: JSON.stringify({ id: 102, action: 'list-summaries' }),
      executionContextId: 1,
    });
    const calibrated = hiddenSshEntry.responses[hiddenSshEntry.responses.length - 1].payload;
    assert.equal(calibrated.ok, true);
    assert.equal(calibrated.scopeKey, 'ssh:gpu-node-9');
    assert.deepEqual(calibrated.summaries.map((s) => s.id), [sshCid]);
    assert.equal(localHttpLsCalls, 0, 'First calibrated SSH packet must make 0 calls to local HTTP ensureLsClient()');
    assert.equal(localEntryRpcCalls, 0, 'First calibrated SSH packet must make 0 RPCs to localEntry');
    assert.equal(localDiskScanCalls, 0, 'Calibrated SSH scope must make 0 local disk scan calls');
    assert.equal(hiddenSshEntry.detectedScopeKey, 'ssh:gpu-node-9');
    assert.equal(hiddenSshEntry._usageScopeVerified, true);
    assert.ok(hiddenSshRpcCalls >= 2);

    // 2) AntigravityClient isolates concurrent multi-scope discover() & _proxyTrajInFlight/_proxyTrajCache
    const scopeAls = new AsyncLocalStorage();
    let procScans = 0;
    const probeScopes = [];
    const trajScopes = [];
    const sharedClient = new AntigravityClient({
      processes: async () => {
        procScans += 1;
        return [];
      },
      scopeResolver: () => scopeAls.getStore() || 'local',
      rendererRpc: async (method, body) => {
        const cur = scopeAls.getStore() || 'local';
        await new Promise((r) => setTimeout(r, 15));
        if (method === 'Probe') {
          probeScopes.push(cur);
          return { available: true };
        }
        if (method === 'GetCascadeTrajectory') {
          trajScopes.push({ scope: cur, id: body.cascadeId });
          return { status: 'IDLE', numTotalSteps: 1, trajectory: { cascadeId: body.cascadeId, steps: [], generatorMetadata: [], _tag: cur } };
        }
        return {};
      },
    });
    try {
      const [trajA, trajB] = await Promise.all([
        scopeAls.run('ssh:host-a', () => sharedClient.trajectory(sharedCid)),
        scopeAls.run('ssh:host-b', () => sharedClient.trajectory(sharedCid)),
      ]);
      assert.equal(procScans, 0, 'Scoped remote discover() must never scan local processes');
      assert.deepEqual(probeScopes.slice().sort(), ['ssh:host-a', 'ssh:host-b'], 'Concurrent discover() must not coalesce across different scopes');
      assert.equal(trajScopes.length, 2, 'Concurrent _proxyTrajInFlight must not coalesce same cascadeId across different scopes');
      assert.equal(trajA.trajectory._tag, 'ssh:host-a');
      assert.equal(trajB.trajectory._tag, 'ssh:host-b');
      // Cached hit must also stay isolated per scope
      const cachedA = await scopeAls.run('ssh:host-a', () => sharedClient.trajectory(sharedCid));
      const cachedB = await scopeAls.run('ssh:host-b', () => sharedClient.trajectory(sharedCid));
      assert.equal(cachedA.trajectory._tag, 'ssh:host-a');
      assert.equal(cachedB.trajectory._tag, 'ssh:host-b');
      assert.equal(trajScopes.length, 2, 'Per-scope proxy cache hits must not cross-serve');
    } finally {
      sharedClient.dispose();
    }

    // 3) ensureMetricsCollector rendererRpc pins { scopeKey: 'local' } so SSH-only session is never scraped into local telemetryDataDir
    const sshOnlyDaemon = new PrismDaemon({ rootDir: repoRoot, usageCachePath: cacheFile, silent: true });
    let explicitSshScrapes = 0;
    const onlySshEntry = makeEntry(
      'page-only-ssh',
      'ml [SSH: remote-only] — Antigravity',
      'vscode-file://vscode-app/workbench.html?remoteAuthority=ssh-remote%2Bremote-only',
      async () => {
        explicitSshScrapes += 1;
        return { ok: true, data: { available: true } };
      }
    );
    const hiddenOnlySshEntry = makeEntry(
      'page-only-hidden-ssh',
      'Antigravity',
      'vscode-file://vscode-app/workbench.html',
      async (method) => {
        if (method === 'GetAllCascadeTrajectories') {
          return {
            ok: true,
            data: {
              trajectorySummaries: {
                [sshCid]: {
                  stepCount: 3,
                  lastModifiedTime: { seconds: String(dSec) },
                  workspaces: [{ workspaceFolderAbsoluteUri: 'vscode-remote://ssh-remote+stealth/srv/app' }],
                },
              },
            },
          };
        }
        return { ok: false, error: 'unavail' };
      }
    );
    sshOnlyDaemon.sessions.set(onlySshEntry.wsUrl, onlySshEntry);
    await sshOnlyDaemon.ensureMetricsCollector();
    try {
      await assert.rejects(
        () => sshOnlyDaemon._lazyStore.client.rendererRpc('Probe', {}),
        /等待 Antigravity 主窗口连接/,
        'MetricsStore local-pinned rendererRpc must reject when only SSH window is open'
      );
      assert.equal(explicitSshScrapes, 0, 'MetricsStore must make 0 RPCs to SSH window');

      // Even if a title-less hidden SSH window is the only session, local-pinned GetAllCascadeTrajectories must reject remote summaries
      sshOnlyDaemon.sessions.set(hiddenOnlySshEntry.wsUrl, hiddenOnlySshEntry);
      await assert.rejects(
        () => sshOnlyDaemon._lazyStore.client.rendererRpc('GetAllCascadeTrajectories', {}),
        /renderer_scope_mismatch/,
        'Local-pinned MetricsStore must reject remote summaries from an unlabelled SSH window'
      );
      assert.equal(hiddenOnlySshEntry.detectedScopeKey, 'ssh:stealth');
    } finally {
      sshOnlyDaemon._lazyStore?.dispose?.();
    }

    // 4) [P2-4] _flushUsageDiskCache >4MB deadlock guard evicts oldest scope's single oversized record instead of dropping flush
    const bigCacheFile = path.join(tmpBase, 'big-4mb-cache.json');
    const daemonBig = new PrismDaemon({ rootDir: repoRoot, usageCachePath: bigCacheFile, silent: true });
    const hugeStr = 'x'.repeat(4 * 1024 * 1024 + 4096);
    daemonBig._putUsageDiskCache(
      sshCid,
      5,
      1700000100,
      { cascadeId: sshCid, stepCount: 5, lastModifiedSec: 1700000100, calls: 1, days: { '2026-11-18': { calls: 1, total: 100, blob: hugeStr } } },
      'ssh:old-oversized'
    );
    daemonBig._putUsageDiskCache(
      localCid,
      6,
      1700000900,
      { cascadeId: localCid, stepCount: 6, lastModifiedSec: 1700000900, calls: 2, days: { '2026-11-18': { calls: 2, total: 5000 } } },
      'local'
    );
    daemonBig._flushUsageDiskCache();
    assert.equal(fs.existsSync(bigCacheFile), true, '>4MB single-entry scope must evict oldest scope instead of aborting flush');
    const rawSaved = fs.readFileSync(bigCacheFile, 'utf8');
    assert.ok(Buffer.byteLength(rawSaved, 'utf8') <= 4 * 1024 * 1024, 'Flushed cache must stay strictly <= 4MB');
    const parsedSaved = JSON.parse(rawSaved);
    assert.equal(parsedSaved.scopes['ssh:old-oversized'], undefined, 'Oldest oversized scope entry must be evicted');
    assert.ok(parsedSaved.scopes.local[localCid], 'Newer normal local record must survive flush intact');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('Redteam #193 [P0-2, P1-3, P2-1]: style hot-upgrade overwrite, data-ag-prism-scope unlock, canPrune tightening, fetchBatch catch exit, ja punctuation & null body guard', async () => {
  const homeStudioPanel = require('../home-studio-panel.js');
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;
  const storeMem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
    setItem: (k, v) => { storeMem.set(k, String(v)); },
    removeItem: (k) => { storeMem.delete(k); },
  };
  const dKey = usageCore.homeDayKey(new Date(1763400600 * 1000));
  const makeRec = (id, total) => ({
    cascadeId: id,
    stepCount: 5,
    lastModifiedSec: 1763400600,
    gmCount: 2,
    subagent: false,
    workspace: 'proj',
    parentId: '',
    calls: 2,
    days: {
      [dKey]: {
        calls: 2,
        input: Math.floor(total * 0.7),
        output: Math.floor(total * 0.3),
        cacheRead: 0,
        cacheWrite: 0,
        total,
        hours: new Array(24).fill(0),
        models: { 'Gemini 4 Carbon': { input: Math.floor(total * 0.7), output: Math.floor(total * 0.3), cacheRead: 0, cacheWrite: 0, total, calls: 2 } },
      },
    },
  });

  try {
    // 1) Hot-upgrade: existing stale <style id="ag-prism-studio-v101-css"> must be overwritten in-place
    const dom1 = createMockStudioDom('obsidian-prism — Antigravity');
    const staleStyle = dom1.doc.createElement('style');
    staleStyle.id = 'ag-prism-studio-v101-css';
    staleStyle.textContent = '.legacy-v100{color:red}';
    dom1.doc.head.appendChild(staleStyle);
    // Pre-seed stale data-ag-prism-scope attribute on <html> to verify self-lock removal
    dom1.doc.documentElement.setAttribute('data-ag-prism-scope', 'ssh:stale-host');

    let activeLang = 'ja';
    let activeName = '太郎';
    let bridgeScope = 'local';
    let bridgeOnline = true;
    let shouldThrowBatch = false;
    let reduxSums = {
      'stale-rem-1': {
        stepCount: 2,
        lastModifiedTime: { seconds: 1763400600 },
        workspaces: [{ workspaceFolderAbsoluteUri: 'vscode-remote://ssh-remote+stale-host/srv/old' }],
      },
    };
    globalThis.document = dom1.doc;
    globalThis.window = {
      document: dom1.doc,
      location: { href: 'vscode-file://vscode-app/workbench.html' },
      __agPrismUsageBridge: {
        isOnline: () => bridgeOnline,
        listSummaries: async () => ({
          ok: true,
          scopeKey: bridgeScope,
          summaries: [{ id: 'local-fresh-1', stepCount: 5, lastModifiedSec: 1763400600 }],
          records: [],
        }),
        fetchBatch: async (items) => {
          if (shouldThrowBatch) throw new Error('bridge_fetch_boom');
          return {
            ok: true,
            scopeKey: bridgeScope,
            records: items.map((it) => ({ id: it.id, mode: 'full', record: makeRec(it.id, 15000) })),
          };
        },
      },
    };

    const ctl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:rt193:v1',
      waitTickMs: 5,
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => activeLang,
      uiText: () => ({}),
      getDisplayName: () => activeName,
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: reduxSums } }) }, svc: {} }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });

    ctl.renderHomePanel(true);
    assert.equal(staleStyle.textContent.includes('.legacy-v100'), false, 'Hot-upgrade must overwrite stale #ag-prism-studio-v101-css');
    assert.ok(staleStyle.textContent.includes('.ag-cs-home-panel-head{flex-wrap:wrap;row-gap:8px}'), 'Updated CSS must include narrow-screen header wrap rule');
    assert.ok(staleStyle.textContent.includes('.ag-cs-home-tab,.ag-cs-home-range{white-space:nowrap}'), 'Updated CSS must prevent tab/range wrap');
    assert.ok(staleStyle.textContent.includes('.ag-cs-home-ws-select option{background:var(--card,#141418);color:var(--foreground,#F2F2F5);}'));

    // 2) Authoritative bScope='local' overrides stale Redux remote summary & removes data-ag-prism-scope attribute
    await ctl.refreshUsageRollup(true);
    assert.equal(ctl.getScopeKey(), 'local', 'Authoritative bScope="local" must override stale data-ag-prism-scope & Redux heuristic');
    assert.equal(dom1.doc.documentElement.getAttribute('data-ag-prism-scope'), null, 'Switching to local must remove data-ag-prism-scope');

    // Switching to another remote host works (never self-locked) and switching back removes attribute again
    bridgeScope = 'ssh:host-b';
    await ctl.refreshUsageRollup(true);
    assert.equal(ctl.getScopeKey(), 'ssh:host-b');
    assert.equal(dom1.doc.documentElement.getAttribute('data-ag-prism-scope'), 'ssh:host-b');
    bridgeScope = 'local';
    await ctl.refreshUsageRollup(true);
    assert.equal(ctl.getScopeKey(), 'local');
    assert.equal(dom1.doc.documentElement.getAttribute('data-ag-prism-scope'), null);

    // 3) [P2-1] Japanese greeting uses Japanese ideographic comma '、' while zh-CN uses '，'
    ctl.syncGreeting(true);
    const h1 = dom1.doc.querySelector('[data-testid="home-greeting"] h1');
    assert.equal(h1.textContent, '次は何をしますか、太郎？', 'Japanese greeting must use Japanese comma 、');
    activeLang = 'zh-CN';
    activeName = '小明';
    ctl.syncGreeting(true);
    assert.equal(h1.textContent, '接下来做什么，小明？', 'zh-CN greeting must use Chinese comma ，');

    // 4) [P0-2] canPrune tightened to bridgeOnline only (missing bridge never prunes archived cache)
    storeMem.set('test:rt193:prune', JSON.stringify({ 'archived-port-1': makeRec('archived-port-1', 88000) }));
    globalThis.window.__agPrismUsageBridge = null;
    reduxSums = { 'live-only-1': { stepCount: 3, lastModifiedTime: { seconds: 1763400650 } } };
    const ctlNoBridge = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:rt193:prune',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: reduxSums } }) }, svc: {} }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });
    await ctlNoBridge.refreshUsageRollup(true);
    assert.equal(ctlNoBridge.getUsageRecordsCount(), 2, 'Missing __agPrismUsageBridge must NEVER prune cached cross-port localStorage records');

    // 5) [P0-2] Title-less window with offline usageBridge and no explicit scope signal must NOT overwrite default local cache key
    storeMem.set('test:rt193:titleless', JSON.stringify({ 'pure-local-1': makeRec('pure-local-1', 50000) }));
    const domTitleless = createMockStudioDom('Antigravity');
    globalThis.document = domTitleless.doc;
    globalThis.window = {
      document: domTitleless.doc,
      location: { href: 'vscode-file://vscode-app/workbench.html' },
      __agPrismUsageBridge: { isOnline: () => false, listSummaries: async () => ({ ok: false }), fetchBatch: async () => ({ ok: false }) },
    };
    const ctlTitleless = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:rt193:titleless',
      waitTickMs: 5,
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({
        store: { getState: () => ({ trajectorySummaries: { summaries: { 'mystery-ssh-1': { stepCount: 300, lastModifiedTime: { seconds: 1763400700 } } } } }) },
        svc: {},
      }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });
    await ctlTitleless.refreshUsageRollup(true);
    ctlTitleless.flushUsageCacheNow();
    const persistedTitleless = JSON.parse(storeMem.get('test:rt193:titleless') || '{}');
    assert.ok(persistedTitleless['pure-local-1'], 'Existing local cache entry must remain untouched');
    assert.equal(persistedTitleless['mystery-ssh-1'], undefined, 'Title-less offline window with no explicit scope must NEVER pollute default local cache key');

    // 6) [P1-3] fetchBatch throwing must exit skeleton cleanly (never deadlock) & [P2-1] null doc.body guard
    const domErr = createMockStudioDom('obsidian-prism — Antigravity');
    globalThis.document = domErr.doc;
    globalThis.window = {
      document: domErr.doc,
      location: { href: 'vscode-file://vscode-app/workbench.html' },
      __agPrismUsageBridge: {
        isOnline: () => true,
        listSummaries: async () => ({ ok: true, scopeKey: 'local', summaries: [{ id: 'boom-1', stepCount: 5, lastModifiedSec: 1763400800 }], records: [] }),
        fetchBatch: async () => { throw new Error('simulated_rpc_crash'); },
      },
    };
    const ctlErr = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:rt193:err',
      waitTickMs: 5,
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: {} } }) }, svc: {} }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });
    ctlErr.renderHomePanel(true);
    assert.ok(domErr.doc.querySelectorAll('[data-skeleton]').length >= 6, 'Initially in skeleton state');
    await assert.doesNotReject(() => ctlErr.refreshUsageRollup(true));
    assert.equal(domErr.doc.querySelectorAll('[data-skeleton]').length, 0, 'Throwing fetchBatch must still exit skeleton cleanly');

    // Null document.body safety in scheduleUsageRollupRefresh
    globalThis.document = null;
    assert.doesNotThrow(() => ctlErr.scheduleUsageRollupRefresh(10));
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});

test('v1.0.7-beta.2 regression: Home Studio handles Protobuf BigInt timestamps in Redux summaries and renderer-rpc-adapter falls back to Redux store when getAllCascadeTrajectories is absent', async () => {
  const vm = await import('node:vm');
  const homeStudioPanel = require('../home-studio-panel.js');
  const { buildRendererRpcExpression, normalizeRendererSummaries } = await import(
    '../vendor/pulse-dashboard/sidecars/panel/renderer-rpc-adapter.mjs'
  );
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;
  const storeMem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
    setItem: (k, v) => { storeMem.set(k, String(v)); },
    removeItem: (k) => { storeMem.delete(k); },
  };
  const cid = '22779ae5-6a08-4dcb-b118-09731c05030a';
  const secNum = 1763400900;
  const secBig = BigInt(secNum);
  const dKey = usageCore.homeDayKey(new Date(secNum * 1000));

  try {
    const dom = createMockStudioDom('Antigravity');
    globalThis.document = dom.doc;
    const reduxSums = {
      [cid]: {
        summary: '',
        stepCount: 6n,
        lastModifiedTime: { seconds: secBig, nanos: 0 },
        createdTime: { seconds: secBig, nanos: 0 },
        workspaces: [{ workspaceFolderAbsoluteUri: 'file:///d:/proj/vibe-coding' }],
        trajectoryMetadata: {
          workspaces: [{ workspaceFolderAbsoluteUri: 'file:///d:/proj/vibe-coding' }],
          nestingDepth: 0n,
        },
      },
    };
    globalThis.window = {
      document: dom.doc,
      location: { href: 'https://127.0.0.1:12497/' },
      __agPrismUsageBridge: {
        isOnline: () => true,
        listSummaries: async () => ({
          ok: true,
          scopeKey: 'local',
          summaries: [{ id: cid, stepCount: 6, lastModifiedSec: secNum, workspaces: ['file:///d:/proj/vibe-coding'] }],
          records: [],
        }),
        fetchBatch: async (items) => ({
          ok: true,
          scopeKey: 'local',
          records: items.map((it) => ({
            id: it.id,
            mode: 'full',
            record: {
              cascadeId: it.id,
              stepCount: it.stepCount,
              lastModifiedSec: it.lastModifiedSec,
              gmCount: 1,
              subagent: false,
              workspace: 'vibe-coding',
              parentId: '',
              calls: 3,
              days: {
                [dKey]: {
                  calls: 3,
                  input: 20000,
                  output: 5000,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 25000,
                  hours: new Array(24).fill(0),
                  models: { 'Gemini 4 Argon': { input: 20000, output: 5000, cacheRead: 0, cacheWrite: 0, total: 25000, calls: 3 } },
                },
              },
            },
          })),
        }),
      },
    };

    const ctl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:bigint:v1',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'zh-CN',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: reduxSums } }) }, svc: {} }),
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
      runGuardedMut: (fn) => fn(),
    });

    ctl.renderHomePanel(true);
    await assert.doesNotReject(() => ctl.refreshUsageRollup(true));
    assert.equal(dom.doc.querySelectorAll('[data-skeleton]').length, 0, 'BigInt timestamps must not leave overview stuck in skeleton state');
    const tokVal = dom.doc.querySelector('[data-stat="tokens"] .ag-cs-home-stat-value');
    assert.equal(tokVal?.textContent, '25k', 'Overview must render aggregated token count after BigInt summary resolution');
    ctl.flushUsageCacheNow();
    assert.ok(JSON.parse(storeMem.get('test:bigint:v1') || '{}')[cid], 'Flushed cache must contain record');

    // A controller whose loadScopeCache is empty and never completed refreshUsageRollup must NOT overwrite existing localStorage cache on teardown flushUsageCacheNow()
    const savedBefore = storeMem.get('test:bigint:v1');
    storeMem.set('test:bigint:v1', '{}');
    const idleCtl = homeStudioPanel.createHomeStudioPanelController({
      usageCore,
      storageUsageCacheKey: 'test:bigint:v1',
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'zh-CN',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => null,
      canMountRealCanvas: () => true,
      setAttrIfChanged: () => {},
      runGuardedMut: (fn) => fn(),
    });
    storeMem.set('test:bigint:v1', savedBefore);
    idleCtl.flushUsageCacheNow();
    assert.ok(JSON.parse(storeMem.get('test:bigint:v1') || '{}')[cid], 'Teardown flushUsageCacheNow() on un-fetched controller must never wipe existing cache');

    // Also verify renderer-rpc-adapter GetAllCascadeTrajectories uses Redux Fiber store when getAllCascadeTrajectories is absent
    const lsWithoutGetAll = {
      getUserStatus: async () => ({}),
      getCascadeTrajectory: async () => ({}),
      searchConversations: async () => ({
        results: [{ cascadeId: cid, title: 'Backfilled Title', workspaceName: 'vibe-coding', lastModifiedTime: { seconds: secBig, nanos: 0 } }],
      }),
    };
    const anchorEl = {
      '__reactFiber$1': {
        memoizedProps: { store: { getState: () => ({ trajectorySummaries: { summaries: reduxSums } }) } },
        return: null,
      },
    };
    const rootEl = {
      '__reactContainer$1': {
        memoizedProps: { value: lsWithoutGetAll },
        child: null,
        sibling: null,
      },
    };
    const sandbox = vm.createContext({
      document: {
        getElementById: (id) => (id === 'root' ? rootEl : null),
        querySelectorAll: () => [anchorEl],
        body: rootEl,
      },
      WeakRef: globalThis.WeakRef,
      Promise,
    });
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const expr = buildRendererRpcExpression('GetAllCascadeTrajectories', {});
    const rpcRes = await vm.runInContext(expr, sandbox);
    assert.equal(rpcRes.ok, true);
    const norm = normalizeRendererSummaries(rpcRes.data);
    assert.equal(norm.trajectorySummaries[cid].summary, 'Backfilled Title');
    assert.equal(norm.trajectorySummaries[cid].stepCount, 6);
    assert.equal(norm.trajectorySummaries[cid].workspaces[0].workspaceFolderAbsoluteUri, 'file:///d:/proj/vibe-coding');
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});



