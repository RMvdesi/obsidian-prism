import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  buildRendererRpcExpression,
  extractModelLabelMap,
  normalizeRendererUserStatus,
  normalizeRendererQuotaSummary,
  normalizeRendererSummaries,
  normalizeRendererTrajectory,
} from '../vendor/pulse-dashboard/sidecars/panel/renderer-rpc-adapter.mjs';
import { AntigravityClient } from '../vendor/pulse-dashboard/sidecars/panel/client.mjs';
import { MetricsStore } from '../vendor/pulse-dashboard/sidecars/panel/store.mjs';
import { quotaMetrics, trajectoryMetrics } from '../vendor/pulse-dashboard/sidecars/panel/metrics.mjs';
import { quotaModelFamily } from '../vendor/pulse-dashboard/sidecars/panel/usage.mjs';
import { formatModelName } from '../vendor/pulse-dashboard/sidecars/panel/context.mjs';

const require = createRequire(import.meta.url);
globalThis.__agCodexEffortSliderDisableAutoBoot = true;
const effortSlider = require('../vendor/effort-slider/upstream-client.js');
const usageCore = require('../usage-core.js');

test('v2.34.0 Effort Slider: normalizes kebab-case slug effortIndex and unlocks all multi-effort models', () => {
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'claude-opus-5-5-low', value: 1400 };
  const opusMed = { label: 'Claude Opus 5.5 (Medium)', modelId: 'claude-opus-5-5-medium', value: 1401 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'claude-opus-5-5-high', value: 1402 };
  const flashLow = { label: 'Gemini 3.8 Flash (Low)', modelId: 'gemini-3.8-flash-low', value: 1320 };
  const flashHigh = { label: 'Gemini 3.8 Flash (High)', modelId: 'gemini-3.8-flash-high', value: 1318 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };
  const gptOss = { label: 'GPT-OSS 120B (Medium)', modelId: 'gpt-oss-120b-medium', value: 342 };

  const slugEffortIndex = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])],
    ['claude-opus-5-5', new Map([['low', opusLow], ['medium', opusMed], ['high', opusHigh]])],
    ['gemini-3.8-flash', new Map([['low', flashLow], ['high', flashHigh]])],
  ]);

  const modelOptions = [neonLow, neonMed, neonHigh, neonXHigh, opusLow, opusMed, opusHigh, flashLow, flashHigh, orchNeon, gptOss];
  const normalized = effortSlider.normalizeEffortIndex(slugEffortIndex, modelOptions);
  assert.equal(normalized.has('Gemini 4 Neon'), true);
  assert.equal(normalized.has('Claude Opus 5.5'), true);
  assert.equal(normalized.has('Gemini 3.8 Flash'), true);
  assert.equal(normalized.has('Orchestrator'), false);

  // Works both with normalized display-name keys AND directly with raw slug-keyed Map
  for (const idx of [normalized, slugEffortIndex]) {
    const ctx = { effortIndex: idx, modelOptions, selectedModel: neonXHigh };
    const neonProf = effortSlider.resolveModelEffortProfile(ctx, neonXHigh);
    assert.equal(neonProf.locked, false);
    assert.equal(neonProf.baseName, 'Gemini 4 Neon');
    assert.deepEqual(neonProf.levels.map((l) => l.effort), ['low', 'medium', 'high', 'xhigh']);
    assert.equal(neonProf.currentEffort, 'xhigh');
    assert.equal(neonProf.currentLabel, 'Extra');

    const opusProf = effortSlider.resolveModelEffortProfile(ctx, 'Claude Opus 5.5');
    assert.equal(opusProf.locked, false);
    assert.equal(opusProf.isClaude, true);
    assert.equal(opusProf.theme, 'claude');
    assert.equal(opusProf.levels.length, 3);

    const flashProf = effortSlider.resolveModelEffortProfile(ctx, 'Gemini 3.8 Flash');
    assert.equal(flashProf.locked, false);
    assert.deepEqual(flashProf.levels.map((l) => l.effort), ['low', 'high']);

    const singleProf = effortSlider.resolveModelEffortProfile(ctx, gptOss);
    assert.equal(singleProf.locked, true);
  }
});

test('v2.34.0 Effort Slider: Orchestrator exposes tunable planner effort levels & falls back cleanly on legacy hosts', () => {
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'claude-opus-5-5-low', value: 1400 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'claude-opus-5-5-high', value: 1402 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };

  const planners = [neonLow, neonHigh, neonXHigh, opusLow, opusHigh];
  const rawPlannerIdx = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['high', neonHigh], ['xhigh', neonXHigh]])],
    ['claude-opus-5-5', new Map([['low', opusLow], ['high', opusHigh]])],
  ]);
  const orchCtx = {
    effortIndex: new Map(),
    modelOptions: [...planners, orchNeon],
    selectedModel: orchNeon,
    orchPlanners: planners,
    orchIdx: effortSlider.normalizeEffortIndex(rawPlannerIdx, planners),
    orchDef: neonXHigh,
    orchPick: { model: null, select: () => {} },
  };

  // Default planner (Gemini 4 Neon XHigh)
  const defProf = effortSlider.resolveModelEffortProfile(orchCtx, orchNeon);
  assert.equal(defProf.isOrchestrator, true);
  assert.equal(defProf.orchestratorTunable, true);
  assert.equal(defProf.locked, false);
  assert.equal(defProf.baseName, 'Gemini 4 Neon');
  assert.equal(defProf.currentEffort, 'xhigh');
  assert.equal(defProf.theme, 'codex');

  // Custom planner override (Claude Opus 5.5 High) switches theme to claude automatically
  const claudeOrchProf = effortSlider.resolveModelEffortProfile(
    { ...orchCtx, orchPick: { model: 1402, select: () => {} } },
    orchNeon
  );
  assert.equal(claudeOrchProf.isOrchestrator, true);
  assert.equal(claudeOrchProf.orchestratorTunable, true);
  assert.equal(claudeOrchProf.locked, false);
  assert.equal(claudeOrchProf.baseName, 'Claude Opus 5.5');
  assert.equal(claudeOrchProf.isClaude, true);
  assert.equal(claudeOrchProf.theme, 'claude');
  assert.equal(claudeOrchProf.currentEffort, 'high');

  // Legacy host without orchestratorPick stays locked so crystal Auto bar takes over
  const legacyOrchProf = effortSlider.resolveModelEffortProfile(
    { effortIndex: new Map(), modelOptions: [orchNeon], selectedModel: orchNeon },
    orchNeon
  );
  assert.equal(legacyOrchProf.isOrchestrator, true);
  assert.equal(legacyOrchProf.orchestratorTunable, false);
  assert.equal(legacyOrchProf.locked, true);
});

test('v2.34.0 Telemetry adapter: enforces read-only allowlist, UUID guard, Protobuf-ES normalization & strips prompts', () => {
  assert.throws(() => buildRendererRpcExpression('SendUserCascadeMessage', {}), /Unsupported renderer RPC/);
  assert.throws(() => buildRendererRpcExpression('DeleteCascadeTrajectory', {}), /Unsupported renderer RPC/);
  assert.throws(() => buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: '../bad' }), /Invalid cascadeId/);
  assert.throws(() => buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: "');alert(1)//" }), /Invalid cascadeId/);

  const validId = '11111111-2222-3333-4444-555555555555';
  const expr = buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: validId });
  assert.equal(expr.includes(validId), true);

  // Quota Protobuf-ES oneof remaining + Timestamp -> quotaMetrics()
  const normQuota = normalizeRendererQuotaSummary({
    response: {
      groups: [
        {
          displayName: 'Gemini Models',
          description: 'Gemini 4 family',
          buckets: [
            {
              bucketId: 'gemini-5h',
              window: '5h',
              remaining: { case: 'remainingFraction', value: 0.75 },
              resetTime: { seconds: '1795228894', nanos: 0 },
              disabled: false,
            },
            {
              bucketId: 'gemini-weekly',
              window: 'weekly',
              remaining: { case: 'remainingFraction', value: 0.25 },
              resetTime: { seconds: '1795564219', nanos: 0 },
              disabled: false,
            },
          ],
        },
      ],
    },
  });
  const qm = quotaMetrics(normQuota, 1795200000000);
  assert.equal(qm.length, 1);
  assert.equal(qm[0].id, 'gemini');
  assert.equal(qm[0].windows['5h'].remaining, 0.75);
  assert.equal(typeof qm[0].windows['5h'].resetAt, 'string');
  assert.equal(qm[0].windows.weekly.remaining, 0.25);

  // UserStatus -> model label map
  const normUser = normalizeRendererUserStatus({
    userStatus: {
      email: 'dev@example.com',
      cascadeModelConfigData: {
        clientModelConfigs: [
          { label: 'Gemini 4 Carbon (High)', modelId: 'gemini-4-carbon-high', modelOrAlias: { choice: { case: 'model', value: 1427 } } },
        ],
      },
    },
  });
  const labelMap = extractModelLabelMap(normUser);
  assert.equal(labelMap.get('1427'), 'Gemini 4 Carbon (High)');

  // Trajectory normalization -> trajectoryMetrics()
  const childId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const normTraj = normalizeRendererTrajectory(
    {
      status: 2,
      numTotalSteps: 4,
      numTotalGeneratorMetadata: 1,
      trajectory: {
        cascadeId: validId,
        steps: [
          { type: 14, stepCase: 'userInput', metadata: { createdAt: { seconds: '1795214000', nanos: 0 } } },
          {
            type: 15,
            stepCase: 'plannerResponse',
            hasToolCalls: false,
            hasResponseText: true,
            metadata: { createdAt: { seconds: '1795214002', nanos: 0 } },
          },
          {
            type: 21,
            stepCase: 'runCommand',
            metadata: {
              startedAt: { seconds: '1795214010', nanos: 0 },
              completedAt: { seconds: '1795214015', nanos: 0 },
              hasToolCall: true,
            },
          },
          {
            type: 127,
            stepCase: 'invokeSubagent',
            invokeSubagent: { conversationId: childId, results: [] },
            metadata: { createdAt: { seconds: '1795214016', nanos: 0 } },
          },
        ],
        generatorMetadata: [
          {
            stepIndices: [1],
            chatModel: {
              model: 1427,
              responseModel: 'gemini-4-carbon',
              systemPrompt: 'SHOULD_NEVER_LEAK',
              messagePrompts: ['SECRET_USER_TEXT'],
              timeToFirstToken: { seconds: '2', nanos: 500000000 },
              streamingDuration: { seconds: '5', nanos: 0 },
              usage: {
                model: 1427,
                inputTokens: '2000',
                outputTokens: '800',
                thinkingOutputTokens: '300',
                responseOutputTokens: '500',
                cacheReadTokens: '18000',
                cacheWriteTokens: '0',
                apiProvider: 24,
                responseId: 'resp-1',
              },
              chatStartMetadata: {
                createdAt: { seconds: '1795214001', nanos: 0 },
                contextWindowMetadata: { estimatedTokensUsed: 128000, maxContextTokens: 512000 },
              },
            },
          },
        ],
      },
    },
    validId,
    labelMap
  );

  const serialized = JSON.stringify(normTraj);
  assert.equal(serialized.includes('SHOULD_NEVER_LEAK'), false);
  assert.equal(serialized.includes('SECRET_USER_TEXT'), false);
  assert.equal(normTraj.trajectory.steps[0].type, 'CORTEX_STEP_TYPE_USER_INPUT');
  assert.equal(normTraj.trajectory.steps[3].invokeSubagent.conversationId, childId);

  const tm = trajectoryMetrics(normTraj);
  assert.equal(tm.rounds, 1);
  assert.equal(tm.model, 'Gemini 4 Carbon (High)');
  assert.equal(tm.tps, 100);
  assert.equal(tm.ttftSeconds, 2.5);
  assert.equal(tm.toolSeconds, 5);
  assert.equal(tm.cache.hitRate, 0.9);
  assert.equal(tm.cache.complete, true);
  assert.equal(tm.context.usedTokens, 128000);
  assert.equal(tm.context.maxTokens, 512000);
  assert.equal(tm.context.usedFraction, 0.25);
});

test('v2.34.0 AntigravityClient & MetricsStore: seamlessly falls back to renderer-proxy when --csrf_token is absent', async () => {
  const cid = '22222222-3333-4444-5555-666666666666';
  const rpcCalls = [];
  const rendererRpc = async (method, body) => {
    rpcCalls.push(method);
    if (method === 'Probe') return { available: true };
    if (method === 'GetUserStatus') {
      return normalizeRendererUserStatus({
        userStatus: { email: 'test@example.com', cascadeModelConfigData: { clientModelConfigs: [] } },
      });
    }
    if (method === 'RetrieveUserQuotaSummary') {
      return normalizeRendererQuotaSummary({
        response: {
          groups: [
            {
              displayName: 'Gemini Models',
              buckets: [
                {
                  bucketId: 'gemini-5h',
                  window: '5h',
                  remaining: { case: 'remainingFraction', value: 0.88 },
                  resetTime: { seconds: '1795228894', nanos: 0 },
                },
              ],
            },
          ],
        },
      });
    }
    if (method === 'GetAllCascadeTrajectories') {
      return normalizeRendererSummaries({
        results: [
          {
            cascadeId: cid,
            title: 'Test Session',
            workspaceName: 'demo-ws',
            lastModifiedTime: { seconds: '1795214500', nanos: 0 },
          },
        ],
      });
    }
    if (method === 'GetCascadeTrajectory') {
      assert.equal(body.cascadeId, cid);
      return normalizeRendererTrajectory(
        {
          status: 2,
          numTotalSteps: 2,
          numTotalGeneratorMetadata: 1,
          trajectory: {
            cascadeId: cid,
            steps: [
              { type: 14, stepCase: 'userInput', metadata: { createdAt: { seconds: '1795214490', nanos: 0 } } },
              { type: 15, stepCase: 'plannerResponse', hasResponseText: true, metadata: { createdAt: { seconds: '1795214495', nanos: 0 } } },
            ],
            generatorMetadata: [
              {
                stepIndices: [1],
                chatModel: {
                  modelDisplayName: 'Gemini 4 Neon (XHigh)',
                  timeToFirstToken: { seconds: '3', nanos: 0 },
                  streamingDuration: { seconds: '4', nanos: 0 },
                  usage: {
                    inputTokens: '1000',
                    outputTokens: '400',
                    responseOutputTokens: '400',
                    cacheReadTokens: '9000',
                    cacheWriteTokens: '0',
                    apiProvider: 24,
                    responseId: 'r-v234',
                  },
                  chatStartMetadata: {
                    createdAt: { seconds: '1795214491', nanos: 0 },
                    contextWindowMetadata: { estimatedTokensUsed: 64000, maxContextTokens: 512000 },
                  },
                },
              },
            ],
          },
        },
        cid
      );
    }
    throw new Error(`Unexpected RPC: ${method}`);
  };

  const client = new AntigravityClient({
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => [
      {
        ProcessId: 57948,
        CommandLine: 'language_server.exe --standalone --override_ide_version 2.34.0 --read_host_bridge_token_from_stdin',
        Ports: [11244],
      },
    ],
    rendererRpc,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-v234-store-'));
  const store = new MetricsStore(client, { dataDir: tmpDir });
  try {
    const snap = await store.snapshot({ force: true });
    assert.equal(snap.connection, 'live');
    assert.equal(snap.error, null);
    assert.equal(snap.sessionError, null);
    assert.equal(client.server?.mode, 'renderer-proxy');
    assert.equal(snap.groups.length, 1);
    assert.equal(snap.groups[0].windows['5h'].remaining, 0.88);
    assert.equal(snap.speed.model, 'Gemini 4 Neon (XHigh)');
    assert.equal(snap.speed.rounds, 1);
    assert.equal(snap.speed.tps, 100);
    assert.equal(snap.speed.cache.hitRate, 0.9);
    assert.equal(snap.speed.context.usedTokens, 64000);
    assert.equal(store.startBackground('scope', cid, {}, () => true), false);
    assert.equal(rpcCalls.includes('Probe'), true);
    assert.equal(rpcCalls.includes('GetCascadeTrajectory'), true);
  } finally {
    store.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v2.34.0 follow-up fixes: usage-core stepCount/hours, renderer-proxy 120s discovery TTL, neon family & stream-choreography selector', async () => {
  // 1) usage-core must not collapse stepCount to 0 when summaryObj.stepCount===0 and must spread hours by step createdAt
  const d1 = new Date('2026-11-20T02:10:00Z');
  const d2 = new Date('2026-11-20T14:20:00Z');
  const rec = usageCore.analyzeTrajectoryForUsage(
    {
      numTotalSteps: 1642,
      numTotalGeneratorMetadata: 2,
      trajectory: {
        cascadeId: '33333333-4444-5555-6666-777777777777',
        steps: [
          { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: d1.toISOString() } },
          { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: d2.toISOString() } },
        ],
        generatorMetadata: [
          { stepIndices: [0], chatModel: { modelDisplayName: 'Gemini 4 Neon (XHigh)', usage: { inputTokens: '100', outputTokens: '50', cacheReadTokens: '0', cacheWriteTokens: '0' } } },
          { stepIndices: [1], chatModel: { modelDisplayName: 'Gemini 4 Neon (XHigh)', usage: { inputTokens: '200', outputTokens: '80', cacheReadTokens: '0', cacheWriteTokens: '0' } } },
        ],
      },
    },
    { stepCount: 0, lastModifiedTime: { seconds: Math.floor(d2.getTime() / 1000) } },
    '33333333-4444-5555-6666-777777777777'
  );
  assert.equal(rec.stepCount, 1642);
  const allHours = Object.values(rec.days).flatMap((d) => d.hours.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0));
  assert.equal(allHours.length >= 2, true);

  // 2) renderer-proxy discovery TTL >= 120s avoids 15s process-scan churn
  let nowMs = 1_000_000;
  let processScans = 0;
  const client = new AntigravityClient({
    now: () => nowMs,
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => {
      processScans += 1;
      return [{ ProcessId: 1234, CommandLine: 'language_server.exe --standalone --read_host_bridge_token_from_stdin', Ports: [11244] }];
    },
    rendererRpc: async (method) => (method === 'Probe' ? { available: true } : {}),
  });
  await client.discover();
  assert.equal(processScans, 1);
  nowMs += 60_000;
  await client.discover();
  assert.equal(processScans, 1);
  nowMs += 70_000;
  await client.discover();
  assert.equal(processScans, 2);
  client.dispose();

  // 3) Model family & context name normalization for Gemini 4 Neon / Orchestrator
  assert.equal(quotaModelFamily('neon'), 'gemini');
  assert.equal(quotaModelFamily('Gemini 4 Neon (XHigh)'), 'gemini');
  assert.equal(formatModelName('gemini-4-neon-xhigh'), 'Gemini 4 Neon (XHigh)');
  assert.equal(formatModelName('gemini-pro-orchestrator-neon'), 'Orchestrator (Neon)');

  // 4) stream-choreography & inline-fallback include v2.34.0 agent-response [data-markdown-root]
  const scSrc = fs.readFileSync(new URL('../stream-choreography.js', import.meta.url), 'utf8');
  assert.equal(scSrc.includes('[data-testid="agent-response"] [data-markdown-root]'), true);
  assert.equal(scSrc.includes("tid === 'agent-response'"), true);
  const fbSrc = fs.readFileSync(new URL('../vendor/pulse-dashboard/inline-fallback.js', import.meta.url), 'utf8');
  assert.equal(fbSrc.includes('[data-testid="agent-response"]'), true);
});

test('v2.34.0 Orchestrator patch: Claude planner shows Claude icon & tunable Orchestrator mounts unlocked crystal prism bar', () => {
  const mgc = require('../model-glyph-crystal.js');
  // 1) parseModelLabelInfo recognizes Orchestrator + Claude -> brand=claude, isOrchestrator=true
  const orchClaude = mgc.parseModelLabelInfo('Orchestrator Claude Opus 5.5 High');
  assert.equal(orchClaude.isOrchestrator, true);
  assert.equal(orchClaude.brand, 'claude');
  assert.equal(orchClaude.camp, 'claude');
  assert.equal(orchClaude.tier, 'high');

  const orchCarbon = mgc.parseModelLabelInfo('Orchestrator Gemini 4 Carbon High');
  assert.equal(orchCarbon.isOrchestrator, true);
  assert.equal(orchCarbon.brand, 'antigravity');
  assert.equal(orchCarbon.camp, 'gemini');
  assert.equal(orchCarbon.tier, 'high');

  const orchLegacy = mgc.parseModelLabelInfo('Orchestrator');
  assert.equal(orchLegacy.isOrchestrator, true);
  assert.equal(orchLegacy.brand, 'antigravity');
  assert.equal(orchLegacy.tier, 'auto');

  // 2) Fallback data-ces-orch-b="claude" on truncated trigger button
  const fakeBtn = {
    nodeType: 1,
    childNodes: [{ nodeType: 3, nodeValue: 'Orchestrator' }],
    getAttribute: (k) => (k === 'data-ces-orch-b' ? 'claude' : ''),
    querySelectorAll: () => [],
  };
  const ctl = mgc.createModelGlyphCrystalController({
    animatedIcons: null,
    crystalPrismCore: null,
    isDestroyed: () => false,
    isComposerRestyleEnabled: () => true,
    isZh: () => true,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    canMountRealCanvas: () => true,
    getLastPointerPos: () => null,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });
  const trigInfo = ctl.parseModelTriggerInfo(fakeBtn);
  assert.equal(trigInfo.isOrchestrator, true);
  assert.equal(trigInfo.brand, 'claude');
  assert.equal(trigInfo.camp, 'claude');

  // 3) crystal-prism-core supports hideLock + Scheme-A fillRatio split without adding new GLSL uniforms
  const cpSrc = fs.readFileSync(new URL('../crystal-prism-core.js', import.meta.url), 'utf8');
  assert.equal(cpSrc.includes('u_reduce < 1.5'), true);
  assert.equal(cpSrc.includes('u_reduce > 1.5'), true);
  assert.equal(cpSrc.includes('if (!hideLock) drawLaserEtchedLock'), true);
  assert.equal(cpSrc.includes('sliderFillRatio'), true);

  // 4) style.css defines frosted crystal knob with compact 32px mouse-tracking prism rim & crisp detent ticks
  const cssSrc = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.equal(cssSrc.includes('32px circle at var(--knob-px'), true);
  assert.equal(cssSrc.includes('.ces-tick.is-on'), true);
  assert.equal(cssSrc.includes('.ces-knob-notch'), true);
});

test('v2.34.0 renderer-proxy perf: WeakRef LS cache, in-flight coalescing & settled/summary TTL avoid redundant full trajectory deserializations', async () => {
  const cidIdle = '44444444-5555-6666-7777-888888888888';
  const cidRun = '55555555-6666-7777-8888-999999999999';
  const expr = buildRendererRpcExpression('Probe', {});
  assert.equal(expr.includes('__agPrismLsRef'), true, 'renderer-rpc-adapter must cache discovered LS wrapper via WeakRef');

  let nowMs = 2_000_000;
  let trajCalls = 0;
  let releasePending = null;
  const rendererRpc = async (method, body) => {
    if (method === 'Probe') return { available: true };
    if (method === 'GetCascadeTrajectory') {
      trajCalls += 1;
      if (body.cascadeId === cidRun && trajCalls === 1) {
        await new Promise((r) => { releasePending = r; });
      }
      return {
        status: body.cascadeId === cidIdle ? 'CASCADE_RUN_STATUS_1' : 'CASCADE_RUN_STATUS_2',
        numTotalSteps: 2,
        numTotalGeneratorMetadata: 1,
        trajectory: { cascadeId: body.cascadeId, steps: [], generatorMetadata: [] },
      };
    }
    return {};
  };

  const client = new AntigravityClient({
    now: () => nowMs,
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => [{ ProcessId: 99, CommandLine: 'language_server --standalone', Ports: [11244] }],
    rendererRpc,
  });

  try {
    // 1) Concurrent calls to same cascadeId coalesce into a single renderer RPC
    const p1 = client.trajectory(cidRun);
    const p2 = client.trajectory(cidRun);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(trajCalls, 1, 'Concurrent trajectory() calls must coalesce');
    releasePending();
    await Promise.all([p1, p2]);

    // 2) Active trajectory caches for 4s (not bypassed by unconditional force=true)
    nowMs += 2000;
    await client.trajectory(cidRun);
    assert.equal(trajCalls, 1, 'Active trajectory must reuse cache within 4s');
    nowMs += 3000;
    await client.trajectory(cidRun);
    assert.equal(trajCalls, 2, 'Active trajectory must refresh after 4s');

    // 3) Settled (status=1 / IDLE) trajectory reuses cache for 20s, and 60s when summary stamp matches
    const sum = { stepCount: 2, lastModifiedTime: { seconds: '1795214500', nanos: 0 } };
    await client.trajectory(cidIdle, { summary: sum });
    assert.equal(trajCalls, 3);
    nowMs += 15000;
    await client.trajectory(cidIdle, { summary: sum });
    assert.equal(trajCalls, 3, 'Settled trajectory must reuse cache at 15s');
    nowMs += 30000;
    await client.trajectory(cidIdle, { summary: sum });
    assert.equal(trajCalls, 3, 'Settled trajectory with unchanged summary stamp must reuse cache up to 60s');
    // Force bypasses cache immediately
    await client.trajectory(cidIdle, { force: true, summary: sum });
    assert.equal(trajCalls, 4, 'force: true must bypass proxy cache immediately');
  } finally {
    client.dispose();
  }
});

