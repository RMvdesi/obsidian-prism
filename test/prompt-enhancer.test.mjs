import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import {
  DEFAULT_PROMPT_ENHANCER_CONFIG,
  PromptEnhancerService,
  buildEnhancementSystemPrompt,
  classifyEnhancementTask,
  sanitizeEnhancerTurns,
  stripPromptAsterisks,
} from '../vendor/prompt-enhancer/prompt-enhancer-service.mjs';
import {
  PROMPT_ENHANCER_BINDING,
  buildPromptEnhancerExpression,
  buildSuggesterExpression,
} from '../cdp.js';
import { PrismDaemon, SUGGESTER_BINDING } from '../sidecars/daemon/main.mjs';

function makeTranslator({ body = { choices: [{ message: { content: '**目标**\n*完成任务*' } }] }, status = 200, delayMs = 0 } = {}) {
  const store = {
    activeProfileId: 'default',
    profiles: [{ id: 'default', name: 'Shared', baseUrl: 'https://api.example.test/v1', model: 'gpt-mini', apiKey: 'secret-token-1234' }],
  };
  return {
    loadStore: () => store,
    getSanitizedConfig: () => ({ profiles: [{ id: 'default', name: 'Shared', baseUrl: store.profiles[0].baseUrl, model: store.profiles[0].model, hasApiKey: true, keylessAllowed: false }] }),
    _resolveEffectiveCredentials: ({ profileId, model }) => ({ baseUrl: store.profiles[0].baseUrl, apiKey: store.profiles[0].apiKey, model: model || store.profiles[0].model }),
    _request: async (_url, options) => {
      if (delayMs) await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
      });
      return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), body: null };
    },
    _readResponseTextBounded: async (response) => await response.text(),
    fetchModels: async () => ({ ok: true, models: ['gpt-mini', 'gpt-pro'], latencyMs: 4 }),
    testConnection: async () => ({ ok: true, latencyMs: 3, reply: 'OK' }),
  };
}

class FakeNode {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || '').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName)) this.value = '';
    this._text = '';
    this.isConnected = false;
  }
  get firstChild() { return this.children[0] || null; }
  get options() { return this.children.filter((child) => child.tagName === 'OPTION'); }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.children.forEach((child) => { child.parentNode = null; child.isConnected = false; }); this.children = []; this._text = String(value || ''); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { if (!node) return node; node.parentNode?.removeChild?.(node); node.parentNode = this; node.isConnected = this.isConnected || this.tagName === 'BODY' || this.tagName === 'HTML'; this.children.push(node); return node; }
  removeChild(node) { const index = this.children.indexOf(node); if (index >= 0) { this.children.splice(index, 1); node.parentNode = null; node.isConnected = false; } return node; }
  remove() { this.parentNode?.removeChild?.(this); }
  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.get(String(name)) ?? null; }
  removeAttribute(name) { this.attributes.delete(String(name)); }
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  dispatchEvent(event) { event.target ||= this; for (const fn of this.listeners.get(event.type) || []) fn(event); return true; }
  click() { if (!this.disabled && !this.hidden) this.dispatchEvent({ type: 'click', target: this }); }
  focus() {}
  closest(selector) {
    if (selector.includes('.surface-composer') || selector.includes('agent-input-box')) return this.testRoot || null;
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const match = (node) => {
      const testId = /data-testid=["']([^"']+)["']/.exec(selector)?.[1];
      if (testId && node.getAttribute('data-testid') === testId) return true;
      if (selector === 'button' && node.tagName === 'BUTTON') return true;
      if (selector === 'span:last-child') return node.tagName === 'SPAN' && node.parentNode?.children.at(-1) === node;
      if (selector.includes('contenteditable') || selector.includes('textarea')) return node === this.ownerDocument.editor;
      if (selector.includes('user-message-content')) return node.getAttribute('data-testid') === 'user-message-content';
      return false;
    };
    const walk = (node) => { for (const child of node.children) { if (match(child)) out.push(child); walk(child); } };
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { left: 180, right: 780, top: 520, bottom: 600, width: 600, height: 80 }; }
}

function createUiHarness(options = {}) {
  const doc = {
    documentElement: null,
    title: 'Antigravity',
    readyState: 'complete',
    createElement(tag) { return new FakeNode(tag, doc); },
    createElementNS(_namespace, tag) { return new FakeNode(tag, doc); },
    createTextNode(text) { const node = new FakeNode('#text', doc); node.textContent = text; return node; },
    getElementById(id) { return this.querySelector(`#${id}`); },
    querySelectorAll(selector) {
      if (selector.includes('conversation-view')) return [this.view];
      if (selector.includes('data-testid') && !selector.includes(',')) return [this.body, this.documentElement].flatMap((root) => root.querySelectorAll(selector));
      if (selector.includes(',')) return [this.body, this.documentElement].flatMap((root) => root.querySelectorAll(selector));
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return [this.head, this.body, this.documentElement].flatMap((root) => [root, ...root.querySelectorAll('*')]).filter((node) => node.id === id);
      }
      return [];
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    execCommand() { return false; },
  };
  const win = {
    document: doc,
    innerWidth: 1024,
    Event: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    InputEvent: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    navigator: { clipboard: { writeText: async (text) => { win.copied = text; } } },
  };
  win.window = win;
  doc.defaultView = win;
  doc.documentElement = new FakeNode('html', doc);
  doc.documentElement.lang = 'en';
  doc.documentElement.isConnected = true;
  doc.head = new FakeNode('head', doc);
  doc.body = new FakeNode('body', doc);
  doc.head.isConnected = true;
  doc.body.isConnected = true;
  doc.documentElement.append(doc.head, doc.body);
  const root = new FakeNode('div', doc);
  root.className = 'surface-composer';
  root.isConnected = true;
  const editor = new FakeNode(options.editorTag || 'div', doc);
  if (editor.tagName === 'TEXTAREA') editor.value = '实现一个设置页';
  else {
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('data-lexical-editor', 'true');
    editor.textContent = '实现一个设置页';
  }
  editor.isConnected = true;
  editor.testRoot = root;
  root.appendChild(editor);
  doc.view = new FakeNode('section', doc);
  doc.view.setAttribute('data-testid', 'conversation-view');
  doc.view.isConnected = true;
  const priorTurn = new FakeNode('div', doc);
  priorTurn.setAttribute('data-testid', 'user-message-content');
  priorTurn.textContent = '项目使用 React 和 TypeScript';
  doc.view.appendChild(priorTurn);
  doc.view.appendChild(root);
  doc.body.appendChild(doc.view);
  doc.editor = editor;
  const requests = [];
  win.__agPrismSuggestCall = (raw) => {
    const request = JSON.parse(raw);
    const bridge = win.__agPrismPromptEnhancerBridge;
    requests.push(request);
    if (request.action === 'enhancer-get-config') {
      queueMicrotask(() => bridge?.resolve(request.id, { ok: true, config: { enabled: true, profileId: 'shared', model: 'gpt-mini' } }));
    } else if (request.action === 'enhancer-cancel') {
      const pending = requests.find((item) => item.action === 'enhance' && item.payload.requestId === request.payload.requestId);
      if (pending) queueMicrotask(() => bridge?.resolve(pending.id, { ok: false, cancelled: true, reason: 'cancelled' }));
      queueMicrotask(() => bridge?.resolve(request.id, { ok: true, cancelled: true }));
    }
  };
  vm.runInNewContext(fs.readFileSync(new URL('../vendor/prompt-enhancer/prompt-enhancer-client.js', import.meta.url), 'utf8'), win);
  const runtime = win.__agPrismPromptEnhancerFactory({ window: win, document: doc, initialConfig: options.initialConfig });
  return { win, doc, editor, root, requests, runtime };
}

async function until(predicate, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for UI state');
}

test('Prompt Enhancer defaults closed and classifies requested task families', () => {
  assert.equal(DEFAULT_PROMPT_ENHANCER_CONFIG.enabled, false);
  assert.equal(classifyEnhancementTask('请修复这个 bug 并补回归测试'), 'bugFix');
  assert.equal(classifyEnhancementTask('把服务部署到生产环境并提供回滚步骤'), 'deployment');
  assert.equal(classifyEnhancementTask('分析销售数据并定义指标'), 'dataAnalysis');
  assert.equal(classifyEnhancementTask('研究竞品并给出证据来源'), 'research');
  assert.equal(classifyEnhancementTask('实现一个 API 和单元测试'), 'development');
  assert.match(buildEnhancementSystemPrompt('bugFix'), /根因未知时要求先调查/);
  assert.equal(stripPromptAsterisks('**目标**\n*完成任务*'), '目标\n完成任务');
});

test('disabled runtime does not start the enhancer bridge or DOM listeners', async () => {
  const harness = createUiHarness({ initialConfig: { enabled: false, profileId: '', model: '' } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'), null);
  assert.equal(harness.runtime.getDebugState().active, false);
  harness.runtime.destroy();
});

test('context is bounded to recent turns and explicit character limits', () => {
  const turns = sanitizeEnhancerTurns([
    { role: 'user', text: 'a'.repeat(3000) },
    { role: 'assistant', text: 'b'.repeat(3000) },
    { role: 'user', text: 'recent' },
  ]);
  assert.ok(turns.length <= 4);
  assert.ok(turns.every((turn) => turn.text.length <= 1500));
  assert.ok(turns.reduce((sum, turn) => sum + turn.text.length, 0) <= 4800);
  assert.equal(turns.at(-1).text, 'recent');
});

test('service reuses shared provider credentials without persisting a second API key', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pe-'));
  const translator = makeTranslator();
  const svc = new PromptEnhancerService({ configDir: dir, translatorService: translator });
  const saved = svc.saveConfig({ enabled: true, profileId: 'default', model: 'gpt-mini' });
  assert.equal(saved.ok, true);
  const enhanced = await svc.enhance({ original: '帮我写一个登录页', context: [{ role: 'user', text: '项目使用 React' }] });
  assert.equal(enhanced.ok, true);
  assert.equal(enhanced.model, 'gpt-mini');
  assert.equal(enhanced.enhanced.includes('*'), false);
  const raw = fs.readFileSync(path.join(dir, 'obsidian-prism-prompt-enhancer.json'), 'utf8');
  assert.equal(raw.includes('secret-token-1234'), false);
  assert.equal(raw.includes('apiKey'), false);
  svc.dispose();
});

test('service redacts upstream errors and supports timeout/cancel', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pe-'));
  const failing = new PromptEnhancerService({ configDir: dir, translatorService: makeTranslator({ status: 500, body: { error: 'secret-token-1234 failed' } }) });
  failing.saveConfig({ enabled: true, profileId: 'default', model: 'gpt-mini' });
  const error = await failing.enhance({ original: 'debug' });
  assert.equal(error.ok, false);
  assert.equal(String(error.error).includes('secret-token-1234'), false);

  const slow = new PromptEnhancerService({ configDir: dir, translatorService: makeTranslator({ delayMs: 100 }), requestTimeoutMs: 10 });
  slow.saveConfig({ enabled: true, profileId: 'default', model: 'gpt-mini' });
  const timeout = await slow.enhance({ original: 'timeout' });
  assert.equal(timeout.reason, 'timeout');
  slow.dispose();

  const cancellable = new PromptEnhancerService({ configDir: dir, translatorService: makeTranslator({ delayMs: 250 }), requestTimeoutMs: 1200 });
  cancellable.saveConfig({ enabled: true, profileId: 'default', model: 'gpt-mini' });
  const pending = cancellable.enhance({ original: 'cancel me', requestId: 'cancel-test' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cancellable.cancelRequest('cancel-test').cancelled, true);
  assert.equal((await pending).reason, 'cancelled');
  cancellable.dispose();
});

test('service exposes shared profiles without secrets and reuses them for model and connection checks', async () => {
  const translator = makeTranslator();
  const svc = new PromptEnhancerService({ configDir: fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pe-state-')), translatorService: translator });
  const state = await svc.getPublicState();
  assert.equal(state.profiles[0].id, 'default');
  assert.equal(JSON.stringify(state).includes('secret-token-1234'), false);
  assert.deepEqual(await svc.fetchModels({ profileId: 'default' }), { ok: true, models: ['gpt-mini', 'gpt-pro'], count: 2, latencyMs: 4 });
  assert.equal((await svc.testConnection({ profileId: 'default', model: 'gpt-pro' })).ok, true);
  svc.dispose();
});

test('service refuses symlinked config directories and config files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pe-link-'));
  const realDir = path.join(temp, 'real');
  const linkedDir = path.join(temp, 'linked');
  fs.mkdirSync(realDir);
  fs.symlinkSync(realDir, linkedDir, 'dir');
  const dirService = new PromptEnhancerService({ configDir: linkedDir, translatorService: makeTranslator() });
  assert.equal(dirService.saveConfig({ enabled: true }).ok, false);

  const target = path.join(realDir, 'target.json');
  const linkFile = path.join(realDir, 'obsidian-prism-prompt-enhancer.json');
  fs.writeFileSync(target, '{"untouched":true}\n');
  fs.symlinkSync(target, linkFile);
  const fileService = new PromptEnhancerService({ configDir: realDir, translatorService: makeTranslator() });
  assert.equal(fileService.loadConfig().enabled, false);
  assert.equal(fileService.saveConfig({ enabled: true }).ok, false);
  assert.equal(fs.readFileSync(target, 'utf8'), '{"untouched":true}\n');
  dirService.dispose();
  fileService.dispose();
});

test('Prompt Enhancer runs in the background, auto-replaces the composer, and never sends', async () => {
  const { win, doc, editor, root, requests, runtime } = createUiHarness();
  const editorEvents = [];
  editor.addEventListener('input', () => editorEvents.push('input'));
  editor.addEventListener('change', () => editorEvents.push('change'));
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  const trigger = doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]');
  assert.equal(trigger.parentNode, doc.body);
  assert.equal(root.children.length, 1);
  trigger.click();
  await until(() => requests.some((request) => request.action === 'enhance'));
  const request = requests.find((entry) => entry.action === 'enhance');
  assert.equal(request.payload.original, '实现一个设置页');
  assert.deepEqual(request.payload.context, [{ role: 'user', text: '项目使用 React 和 TypeScript' }]);
  assert.equal(doc.querySelector('[data-testid="prism-prompt-enhancer-panel"]'), null);
  win.__agPrismPromptEnhancerBridge.resolve(request.id, { ok: true, enhanced: '**Goal**\nImplement a *settings* page' });
  await until(() => editor.textContent === 'Goal\nImplement a settings page');
  assert.equal(editor.textContent.includes('*'), false);
  assert.deepEqual(editorEvents, ['input', 'change']);
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]')?.getAttribute('data-status')?.includes('automatically'));
  assert.equal(requests.some((entry) => entry.action === 'send' || entry.action === 'submit'), false);
  runtime.destroy();
});

test('Prompt Enhancer prevents duplicate enhancement requests while the first request is pending', async () => {
  const { doc, requests, runtime } = createUiHarness();
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  const trigger = doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]');
  trigger.click();
  trigger.click();
  await until(() => requests.some((request) => request.action === 'enhance'));
  assert.equal(requests.filter((request) => request.action === 'enhance').length, 1);
  runtime.destroy();
});

test('Prompt Enhancer keeps the draft and reports upstream errors without opening a panel', async () => {
  const { win, doc, editor, requests, runtime } = createUiHarness();
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]').click();
  await until(() => requests.some((request) => request.action === 'enhance'));
  const request = requests.find((entry) => entry.action === 'enhance');
  win.__agPrismPromptEnhancerBridge.resolve(request.id, { ok: false, reason: 'upstream-error' });
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]')?.getAttribute('data-status')?.includes('Enhancement failed'));
  assert.equal(editor.textContent, '实现一个设置页');
  assert.equal(doc.querySelector('[data-testid="prism-prompt-enhancer-panel"]'), null);
  runtime.destroy();
});

test('Prompt Enhancer handles an empty composer without sending a request', async () => {
  const { doc, editor, requests, runtime } = createUiHarness();
  editor.textContent = '   ';
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  const before = requests.filter((request) => request.action === 'enhance').length;
  doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]').click();
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]')?.getAttribute('data-status')?.includes('Enter text'));
  assert.equal(requests.filter((request) => request.action === 'enhance').length, before);
  assert.equal(editor.textContent, '   ');
  runtime.destroy();
});

test('Prompt Enhancer blocks replacement when the user changes the draft during enhancement', async () => {
  const { win, doc, editor, requests, runtime } = createUiHarness();
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]').click();
  await until(() => requests.some((request) => request.action === 'enhance'));
  const request = requests.find((entry) => entry.action === 'enhance');
  editor.textContent = '用户刚刚修改的草稿';
  win.__agPrismPromptEnhancerBridge.resolve(request.id, { ok: true, enhanced: '## Goal\n替换后的提示词' });
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]')?.getAttribute('data-status')?.includes('input changed'));
  assert.equal(editor.textContent, '用户刚刚修改的草稿');
  assert.equal(doc.querySelector('[data-testid="prism-prompt-enhancer-panel"]'), null);
  runtime.destroy();
});

test('Prompt Enhancer keeps the draft when the target editor disappears or the result is empty', async () => {
  const missing = createUiHarness();
  await until(() => missing.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  missing.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]').click();
  await until(() => missing.requests.some((request) => request.action === 'enhance'));
  const missingRequest = missing.requests.find((entry) => entry.action === 'enhance');
  missing.editor.remove();
  missing.win.__agPrismPromptEnhancerBridge.resolve(missingRequest.id, { ok: true, enhanced: 'replacement' });
  await until(() => missing.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]')?.getAttribute('data-status')?.includes('original input'));
  assert.equal(missing.doc.querySelector('[data-testid="prism-prompt-enhancer-panel"]'), null);
  missing.runtime.destroy();

  const empty = createUiHarness();
  await until(() => empty.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  empty.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]').click();
  await until(() => empty.requests.some((request) => request.action === 'enhance'));
  const emptyRequest = empty.requests.find((entry) => entry.action === 'enhance');
  empty.win.__agPrismPromptEnhancerBridge.resolve(emptyRequest.id, { ok: true, enhanced: '   ' });
  await until(() => empty.doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]')?.getAttribute('data-status')?.includes('enhanced result is empty'));
  assert.equal(empty.editor.textContent, '实现一个设置页');
  assert.equal(empty.doc.querySelector('[data-testid="prism-prompt-enhancer-panel"]'), null);
  empty.runtime.destroy();
});

test('Prompt Enhancer replaces a textarea value through input and change events', async () => {
  const { win, doc, editor, requests, runtime } = createUiHarness({ editorTag: 'textarea' });
  const events = [];
  editor.addEventListener('input', () => events.push('input'));
  editor.addEventListener('change', () => events.push('change'));
  await until(() => doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]'));
  doc.querySelector('[data-testid="prism-prompt-enhancer-trigger"]').click();
  await until(() => requests.some((request) => request.action === 'enhance'));
  const request = requests.find((entry) => entry.action === 'enhance');
  win.__agPrismPromptEnhancerBridge.resolve(request.id, { ok: true, enhanced: '**textarea** replacement' });
  await until(() => editor.value === 'textarea replacement');
  assert.equal(editor.value, 'textarea replacement');
  assert.deepEqual(events, ['input', 'change']);
  assert.equal(doc.querySelector('[data-testid="prism-prompt-enhancer-panel"]'), null);
  runtime.destroy();
});

test('Prompt Enhancer settings UI selects a shared profile, accepts a custom model, tests and saves it', async () => {
  const { win, doc } = createUiHarness();
  await new Promise((resolve) => setImmediate(resolve));
  const calls = [];
  const profiles = [
    { id: 'one', name: 'Shared One', model: 'small', hasApiKey: true },
    { id: 'two', name: 'Shared Two', model: 'large', hasApiKey: false, keylessAllowed: true },
  ];
  win.__agPrismPromptEnhancerBridge = {
    async call(action, payload) {
      calls.push({ action, payload });
      if (action === 'enhancer-get-config') return { ok: true, config: { enabled: false, profileId: 'one', model: 'small' }, profiles, backend: { profileId: 'one', model: 'small' } };
      if (action === 'enhancer-fetch-models') return { ok: true, models: ['small', 'large'] };
      if (action === 'enhancer-test-connection') return { ok: true };
      if (action === 'enhancer-save-config') return { ok: true, config: payload, profiles, backend: { profileId: payload.profileId, model: payload.model } };
      return { ok: false, error: 'unexpected action' };
    },
  };
  win.__agPrismPromptEnhancer = { applyConfig: (config) => { win.appliedConfig = config; } };
  vm.runInNewContext(fs.readFileSync(new URL('../vendor/prompt-enhancer/prompt-enhancer-settings-ui.js', import.meta.url), 'utf8'), win);
  const slot = doc.createElement('div');
  doc.body.appendChild(slot);
  const handle = win.__prismMountPromptEnhancerUi(slot, { lang: 'en' });
  await until(() => slot.querySelector('[data-testid="prism-pe-profile"]')?.options.length === 3);
  const profile = slot.querySelector('[data-testid="prism-pe-profile"]');
  const model = slot.querySelector('[data-testid="prism-pe-model"]');
  const enabled = slot.querySelector('[data-testid="prism-pe-enabled"]');
  profile.value = 'two';
  profile.dispatchEvent({ type: 'change' });
  assert.equal(model.value, 'large');
  model.value = 'custom/agent-pro';
  enabled.checked = true;
  slot.querySelectorAll('button').find((button) => button.textContent === 'Fetch models').click();
  await until(() => calls.some((call) => call.action === 'enhancer-fetch-models'));
  assert.equal(calls.find((call) => call.action === 'enhancer-fetch-models').payload.profileId, 'two');
  slot.querySelectorAll('button').find((button) => button.textContent === 'Test connection').click();
  await until(() => calls.some((call) => call.action === 'enhancer-test-connection'));
  assert.equal(calls.find((call) => call.action === 'enhancer-test-connection').payload.profileId, 'two');
  slot.querySelectorAll('button').find((button) => button.textContent === 'Save settings').click();
  await until(() => calls.some((call) => call.action === 'enhancer-save-config'));
  const saved = calls.find((call) => call.action === 'enhancer-save-config').payload;
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), { enabled: true, profileId: 'two', model: 'custom/agent-pro' });
  await until(() => win.appliedConfig);
  assert.deepEqual(JSON.parse(JSON.stringify(win.appliedConfig)), JSON.parse(JSON.stringify(saved)));
  handle.destroy();
});

test('Channel 13 expression exists and Channel 11 keeps enhancer lifecycle independent', () => {
  const expression = buildPromptEnhancerExpression();
  assert.ok(expression.length > 1000);
  assert.equal(PROMPT_ENHANCER_BINDING, '__agPrismSuggestCall');
  const suggester = buildSuggesterExpression();
  assert.doesNotMatch(suggester, /__agPrismPromptEnhancerFactory/);
  assert.doesNotMatch(suggester, /prompt-enhancer/);
});

test('Daemon routes enhancer actions through the shared trusted binding and resolves the enhancer RPC namespace', async () => {
  const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
  const daemon = new PrismDaemon({ rootDir, bundleCachePath: false, silent: true, enableAutoUpdateTimer: false, enableStorageGuardTimer: false });
  const evals = [];
  const entry = {
    wsUrl: 'ws://127.0.0.1:9222/devtools/page/enhancer-test',
    mainFrameId: 'main-enhancer',
    hasFrameTree: true,
    contextFrames: new Map([[123, { frameId: 'main-enhancer', isDefault: true, type: 'default', docGen: 1 }]]),
    sidebarHostVerified: true,
    sidebarVerifiedDocument: 1,
    sidebarDocument: 1,
    sidebarHostContextId: 123,
    session: { closed: false, async send(method, params) { if (method === 'Runtime.evaluate') evals.push(params.expression); return { result: { value: true } }; } },
  };
  daemon.sessions.set(entry.wsUrl, entry);
  daemon._lazyPromptEnhancerService = { async handleAction(action, payload) { return { ok: true, action, payload }; } };
  try {
    const result = await daemon.handleBindingCall(entry, {
      name: SUGGESTER_BINDING,
      executionContextId: 123,
      payload: JSON.stringify({ id: 7, action: 'enhancer-get-config', payload: { test: true } }),
    });
    assert.deepEqual(result, { ok: true, action: 'get-config', payload: { test: true } });
    assert.ok(evals.some((expression) => expression.includes('__agPrismPromptEnhancerResolve(7')));
    assert.equal(evals.some((expression) => expression.includes('__agPrismSuggesterResolve(7')), false);
  } finally {
    await daemon.stop(false).catch(() => {});
  }
});
