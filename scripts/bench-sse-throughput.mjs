#!/usr/bin/env node
// High-speed SSE throughput & main-thread non-blocking benchmark for obsidian-prism.
// Verifies:
// 1. ThoughtTranslatorService.translateAiStream sustains 500+ tokens/s with minimal event-loop lag,
//    throttled onPartial emission (~56ms), lossless split-UTF8/EOF flushing, and noThink rejection caching.
// 2. stream-choreography.js onStreamMutations handles 1,000 rapid token mutations without blocking.

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { ThoughtTranslatorService } from '../vendor/thought-translator/translator-service.mjs';

const require = createRequire(import.meta.url);

function makeSseStream(tokens, { paceTps = 0 } = {}) {
  const encoder = new TextEncoder();
  let idx = 0;
  const intervalMs = paceTps > 0 ? 1000 / paceTps : 0;
  let startAt = 0;

  return new ReadableStream({
    async pull(controller) {
      if (idx === 0) startAt = performance.now();
      if (idx >= tokens.length) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }
      if (intervalMs > 0) {
        const targetAt = startAt + idx * intervalMs;
        const waitMs = targetAt - performance.now();
        if (waitMs >= 1) {
          await new Promise((r) => setTimeout(r, Math.floor(waitMs)));
        }
      }
      // Emit batch of chunks that fall due up to now (simulating realistic 600+ tok/s TCP packets)
      const batchEnd = intervalMs > 0
        ? Math.min(tokens.length, Math.max(idx + 1, Math.floor((performance.now() - startAt) / intervalMs) + 1))
        : Math.min(tokens.length, idx + 1);
      for (; idx < batchEnd; idx++) {
        const line = `data: ${JSON.stringify({ choices: [{ delta: { content: tokens[idx] } }] })}\n\n`;
        const bytes = encoder.encode(line);
        // Deliberately split multi-byte UTF-8 across chunk boundaries on every 17th token
        if (idx % 17 === 0 && bytes.length > 8) {
          const splitAt = Math.floor(bytes.length / 2);
          controller.enqueue(bytes.subarray(0, splitAt));
          controller.enqueue(bytes.subarray(splitAt));
        } else {
          controller.enqueue(bytes);
        }
      }
    },
  });
}

async function measureEventLoopLag(fn) {
  let maxLagMs = 0;
  let lastTick = performance.now();
  const probe = setInterval(() => {
    const now = performance.now();
    const lag = Math.max(0, now - lastTick - 10);
    if (lag > maxLagMs) maxLagMs = lag;
    lastTick = now;
  }, 10);
  try {
    const result = await fn();
    return { result, maxLagMs };
  } finally {
    clearInterval(probe);
  }
}

async function runBench() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-sse-bench-'));
  try {
    const tokenCount = 1200;
    const tokens = Array.from({ length: tokenCount }, (_, i) =>
      i % 5 === 0 ? `【步骤${i}】` : `tok${i} `
    );
    const expectedText = tokens.join('').trim();

    let fetchCalls = 0;
    const svc = new ThoughtTranslatorService({
      configFile: path.join(tmpDir, 'cfg.json'),
      cacheFile: path.join(tmpDir, 'cache.json'),
      fetchImpl: async (_url, init) => {
        fetchCalls++;
        const body = JSON.parse(String(init?.body || '{}'));
        // First call with enable_thinking simulates a strict provider returning 400
        if (body.enable_thinking === false) {
          return new Response(JSON.stringify({ error: 'unsupported param enable_thinking' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          });
        }
        const stream = makeSseStream(tokens, { paceTps: 0 });
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        });
      },
    });
    svc.saveConfig({
      activeProfileId: 'bench',
      proxyMode: 'direct',
      profiles: [
        {
          id: 'bench',
          name: 'Bench',
          apiKey: 'sk-bench-test',
          baseUrl: 'https://api.example.com/v1',
          model: 'qwen3-32b',
        },
      ],
    });

    // 1. Burst benchmark (pure SSE parser ceiling + noThink 400 caching)
    let burstPartials = 0;
    const burstStart = performance.now();
    const { result: burstRes, maxLagMs: burstLag } = await measureEventLoopLag(() =>
      svc.translateAiStream('English thought to translate', () => {
        burstPartials++;
      })
    );
    const burstMs = Math.max(0.1, performance.now() - burstStart);
    const burstTps = Math.round((tokenCount / burstMs) * 1000);

    assert.equal(burstRes.text, expectedText, 'Burst SSE text must match 100% losslessly (including split UTF-8)');
    assert.equal(fetchCalls, 2, 'First call should retry once after 400 on enable_thinking');
    assert.ok(burstTps >= 500, `Burst SSE throughput (${burstTps} tok/s) must exceed 500 tok/s`);
    assert.ok(burstPartials <= 25, `Burst partials (${burstPartials}) must be throttled, not per-token`);

    // 2. Second request: verify noThink rejection is cached (zero serial 400 pre-request!)
    fetchCalls = 0;
    let pacedPartials = 0;
    const svcPaced = svc;
    svcPaced.fetchImpl = async (_url, init) => {
      fetchCalls++;
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.enable_thinking, undefined, 'Cached rejected noThinkParams must not be resent');
      const stream = makeSseStream(tokens, { paceTps: 650 });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      });
    };

    const pacedStart = performance.now();
    const { result: pacedRes, maxLagMs: pacedLag } = await measureEventLoopLag(() =>
      svcPaced.translateAiStream('Second thought to translate', () => {
        pacedPartials++;
      })
    );
    const pacedMs = Math.max(0.1, performance.now() - pacedStart);
    const pacedTps = Math.round((tokenCount / pacedMs) * 1000);

    assert.equal(fetchCalls, 1, 'Second request must make exactly 1 HTTP request (no serial pre-request)');
    assert.equal(pacedRes.text, expectedText, 'Paced 650 tok/s SSE text must match 100%');
    assert.ok(pacedTps >= 500, `Paced SSE throughput (${pacedTps} tok/s) must sustain >= 500 tok/s`);
    assert.ok(pacedLag < 50, `Event loop lag (${pacedLag.toFixed(1)}ms) must stay < 50ms under 650 tok/s`);
    assert.ok(pacedPartials < tokenCount / 15, `onPartial (${pacedPartials}) must be throttled (~56ms cadence)`);

    // 3. stream-choreography.js 1,000 rapid characterData mutations benchmark
    const prevDoc = globalThis.document;
    const prevCss = globalThis.CSS;
    const prevHl = globalThis.Highlight;
    const prevRaf = globalThis.requestAnimationFrame;
    const prevCaf = globalThis.cancelAnimationFrame;
    try {
      const hlMap = new Map();
      class FakeHighlight extends Set {}
      globalThis.CSS = { highlights: hlMap };
      globalThis.Highlight = FakeHighlight;
      globalThis.requestAnimationFrame = () => 1;
      globalThis.cancelAnimationFrame = () => {};

      const makeEl = (tag, attrs = {}) => {
        const el = {
          nodeType: 1,
          tagName: tag.toUpperCase(),
          parentElement: null,
          childNodes: [],
          isConnected: true,
          classList: { contains: () => false, add: () => {}, remove: () => {} },
          getAttribute: (k) => attrs[k] ?? null,
          hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k),
          setAttribute: (k, v) => { attrs[k] = String(v); },
          removeAttribute: (k) => { delete attrs[k]; },
          closest(sel) {
            if (sel.includes('planner-response-text')) {
              let c = this;
              while (c) {
                if (c.getAttribute('data-testid') === 'planner-response-text') return c;
                c = c.parentElement;
              }
            }
            return null;
          },
          querySelector: () => null,
          querySelectorAll: () => [],
        };
        return el;
      };
      const html = makeEl('html');
      const body = makeEl('body');
      const prose = makeEl('div', { 'data-testid': 'planner-response-text' });
      const para = makeEl('p');
      prose.parentElement = body;
      para.parentElement = prose;
      const textNode = { nodeType: 3, data: '', parentElement: para, isConnected: true };
      para.childNodes.push(textNode);

      globalThis.document = {
        documentElement: html,
        body,
        hidden: false,
        createRange: () => ({
          startOffset: 0,
          endOffset: 0,
          setStart(_n, s) { this.startOffset = s; },
          setEnd(_n, e) { this.endOffset = e; },
        }),
      };

      require('../stream-choreography.js');
      const ctl = globalThis.__agPrismStreamChoreography.createStreamChoreographyController({
        isDestroyed: () => false,
        isMotionUltra: () => true,
        isMotionStandardOrUltra: () => true,
        isConvRunning: () => true,
        isThoughtIsolatedNode: () => false,
        isThoughtMutationRecord: () => false,
        isManagedThoughtPanel: () => false,
        runGuardedMut: (fn) => fn(),
      });

      const muts = [];
      const mutStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        textNode.data += 'tok ';
        muts.push({ type: 'characterData', target: textNode });
      }
      ctl.onStreamMutations(muts);
      const mutMs = performance.now() - mutStart;
      assert.ok(mutMs < 30, `1,000 rapid characterData mutations took ${mutMs.toFixed(2)}ms (expected < 30ms)`);
      ctl.clearHighlightFade();
      ctl.clearTransientTimers();

      console.log(
        JSON.stringify(
          {
            ok: true,
            burst: { tokens: tokenCount, elapsedMs: Number(burstMs.toFixed(2)), tps: burstTps, partials: burstPartials, maxLagMs: Number(burstLag.toFixed(2)) },
            paced650: { tokens: tokenCount, elapsedMs: Number(pacedMs.toFixed(2)), tps: pacedTps, partials: pacedPartials, maxLagMs: Number(pacedLag.toFixed(2)), httpCalls: fetchCalls },
            domMutations1000: { elapsedMs: Number(mutMs.toFixed(2)) },
          },
          null,
          2
        )
      );
    } finally {
      globalThis.document = prevDoc;
      globalThis.CSS = prevCss;
      globalThis.Highlight = prevHl;
      globalThis.requestAnimationFrame = prevRaf;
      globalThis.cancelAnimationFrame = prevCaf;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runBench().catch((err) => {
  console.error(err);
  process.exit(1);
});
