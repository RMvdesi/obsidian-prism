import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_SUGGESTER_ACTIONS,
  PromptSuggesterService,
  curateChatModelList,
  detectConversationLang,
  parseSingleSuggestion,
  sanitizeConversationTurns,
} from '../vendor/prompt-suggester/suggester-service.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const cdp = require(path.join(ROOT_DIR, 'cdp.js'));

test('Channel 1 stays strictly < 685,000 B and Channel 8 suggester sources obey 0 innerHTML, 0 :has(), pure ASCII CSS, and 0 brand name-dropping', () => {
  const ch1 = cdp.buildInjectExpression();
  const ch1Bytes = Buffer.byteLength(ch1, 'utf8');
  assert.ok(ch1Bytes < 685000, `Expected Channel 1 < 685,000 B, got ${ch1Bytes} B`);

  const ch8 = cdp.buildSuggesterExpression();
  assert.ok(ch8.length > 1000, 'Expected non-empty Channel 8 expression');
  new vm.Script(ch8);
  new vm.Script(cdp.SUGGESTER_REMOVE_EXPRESSION);

  for (const rel of [
    'vendor/prompt-suggester/suggester-client.js',
    'vendor/prompt-suggester/suggester-settings-ui.js',
    'vendor/prompt-suggester/suggester-service.mjs',
  ]) {
    const src = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
    const codeOnly = src.replace(/\/\/.*$/gm, '');
    assert.equal(/\binnerHTML\b/.test(codeOnly), false, `${rel} must not use innerHTML`);
    assert.equal(/:has\s*\(/.test(codeOnly), false, `${rel} must not use :has() selectors`);
    assert.equal(/t3\s*code/i.test(src), false, `${rel} must not expose third-party product names`);
  }

  const clientSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'vendor', 'prompt-suggester', 'suggester-client.js'),
    'utf8'
  );
  const cssBlockMatch = clientSrc.match(/const SUGGESTER_CSS = \[([\s\S]*?)\]\.join/);
  assert.ok(cssBlockMatch, 'Expected SUGGESTER_CSS block');
  assert.equal(/[^\x00-\x7F]/.test(cssBlockMatch[1]), false, 'SUGGESTER_CSS must be pure ASCII');

  // Ensure daemon SUGGESTER_ALLOWED_ACTIONS matches ALLOWED_SUGGESTER_ACTIONS 1:1 (prevents Unknown suggester action)
  const daemonSrc = fs.readFileSync(path.join(ROOT_DIR, 'sidecars', 'daemon', 'main.mjs'), 'utf8');
  const allowMatch = daemonSrc.match(/const SUGGESTER_ALLOWED_ACTIONS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(allowMatch, 'Expected SUGGESTER_ALLOWED_ACTIONS in daemon main.mjs');
  const daemonActions = Array.from(allowMatch[1].matchAll(/'([^']+)'/g), (m) => m[1]).sort();
  assert.deepEqual(daemonActions, Array.from(ALLOWED_SUGGESTER_ACTIONS).sort());

  // Ensure settings-panel.js mounts prism-suggester-slot under Beta group
  const panelSrc = fs.readFileSync(path.join(ROOT_DIR, 'settings-panel.js'), 'utf8');
  assert.ok(
    /if\s*\(grp\.id\s*===\s*'beta'\)\s*\{\s*sgSlot\s*=/.test(panelSrc),
    'prism-suggester-slot must be mounted inside the Beta settings group'
  );
});

test('PromptSuggesterService shares profiles bidirectionally while keeping independent activeProfileId, supports fetch-models, and redacts secrets', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-sg-svc-'));
  try {
    // 1) Beta default is strictly OFF (enabled: false -> zero unexpected API requests)
    const unconfSvc = new PromptSuggesterService({
      configDir: tmpDir,
      translatorService: {
        loadStore: () => ({ activeProfileId: 'empty', profiles: [{ id: 'empty', name: 'Default' }] }),
        _resolveEffectiveCredentials: () => ({
          baseUrl: 'https://api.openai.com/v1',
          baseUrlError: '',
          apiKey: '',
          model: '',
        }),
      },
    });
    assert.equal(unconfSvc.loadConfig().enabled, false, 'Beta feature must default to enabled: false');
    const disabledByDefaultRes = await unconfSvc.handleAction('suggest', {
      turns: [{ role: 'assistant', text: '需要继续吗？' }],
      lang: 'zh-CN',
    });
    assert.equal(disabledByDefaultRes.ok, false);
    assert.equal(disabledByDefaultRes.reason, 'disabled');

    // 1b) Enabled with unconfigured AI -> returns ok:false ai-not-configured (NEVER fake boilerplate)
    unconfSvc.saveConfig({ enabled: true });
    const unconfRes = await unconfSvc.handleAction('suggest', {
      turns: [{ role: 'assistant', text: '需要继续吗？' }],
      lang: 'zh-CN',
    });
    assert.equal(unconfRes.ok, false);
    assert.equal(unconfRes.reason, 'ai-not-configured');
    assert.equal(unconfRes.suggestion, undefined);

    // 2) Shared profile store: Thought Translator keeps activeProfileId='p1' (flash-lite),
    // while Suggester independently selects 'p2' (gemini-3-flash-preview) with same-origin key inheritance!
    let upstreamCalls = 0;
    let lastBody = null;
    const sharedStore = {
      activeProfileId: 'p1',
      profiles: [
        {
          id: 'p1',
          name: 'Gemini AI Studio',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          model: 'gemini-flash-lite-latest',
          apiKey: 'AIzaSySecretTestKey1234567890',
        },
      ],
    };

    const mockTranslator = {
      loadStore: () => sharedStore,
      getSanitizedConfig: () => ({
        ok: true,
        activeProfileId: sharedStore.activeProfileId,
        profiles: sharedStore.profiles.map((p) => ({
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.model,
          hasApiKey: Boolean(p.apiKey),
          maskedKey: p.apiKey ? 'AIza••••7890' : '',
        })),
      }),
      saveConfig(input = {}) {
        const prevMap = new Map(sharedStore.profiles.map((p) => [p.id, p]));
        sharedStore.activeProfileId = input.activeProfileId || sharedStore.activeProfileId;
        sharedStore.profiles = input.profiles.map((p) => ({
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.model,
          apiKey: p.apiKey || (p.keepExistingKey ? prevMap.get(p.id)?.apiKey || '' : ''),
        }));
        return { ok: true };
      },
      async fetchModels() {
        return { ok: true, count: 2, latencyMs: 12, models: ['gemini-3-flash-preview', 'gemini-flash-lite-latest'] };
      },
      _resolveEffectiveCredentials(input = {}) {
        const target = sharedStore.profiles.find((p) => p.id === (input.profileId || sharedStore.activeProfileId));
        if (target) {
          return {
            baseUrl: target.baseUrl,
            baseUrlError: '',
            apiKey: target.apiKey,
            model: input.model || target.model,
          };
        }
        return { baseUrl: 'https://api.openai.com/v1', baseUrlError: '', apiKey: '', model: '' };
      },
      async _request(_url, init) {
        upstreamCalls += 1;
        lastBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              choices: [
                {
                  message: {
                    content: '本地4060的实验跑完了，帮我看一下结果，这个方向还值得继续做吗？',
                  },
                },
              ],
            });
          },
        };
      },
    };

    const svc = new PromptSuggesterService({
      configDir: tmpDir,
      translatorService: mockTranslator,
    });

    // Edit model of SAME provider 'p1' in Suggester -> syncs provider info ONLY; Thought Translator's model on 'p1' MUST remain 'gemini-flash-lite-latest'!
    const saveRes = await svc.handleAction('save-config', {
      enabled: true,
      activeProfileId: 'p1',
      profiles: [
        {
          id: 'p1',
          name: 'Gemini AI Studio',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          model: 'gemini-3-flash-preview',
          apiKey: '',
          keepExistingKey: true,
        },
      ],
    });
    assert.equal(saveRes.ok, true);
    assert.equal(
      sharedStore.profiles[0].model,
      'gemini-flash-lite-latest',
      'Modifying model in Suggester MUST NOT overwrite Thought Translator model on the same provider!'
    );
    assert.equal(
      saveRes.profiles[0].model,
      'gemini-3-flash-preview',
      'Suggester keeps its own independent model selection on the shared provider'
    );
    assert.equal(saveRes.backend.model, 'gemini-3-flash-preview');

    const modelsRes = await svc.handleAction('fetch-models', { profileId: 'p1' });
    assert.equal(modelsRes.ok, true);
    assert.deepEqual(modelsRes.models, ['gemini-3-flash-preview', 'gemini-flash-lite-latest']);

    const turns = [
      { role: 'user', text: '帮我接入 key AIzaSySecretTestKey1234567890 和 sk-abcdef1234567890' },
      { role: 'assistant', text: '跑完后，把同轮 L4/4060 对照表和两条时间线发给我就够了。' },
    ];

    const res1 = await svc.handleAction('suggest', { turns, lang: 'zh-CN' });
    assert.equal(res1.ok, true);
    assert.equal(res1.engine, 'ai');
    assert.equal(res1.profileName, 'Gemini AI Studio');
    assert.equal(res1.suggestion, '本地4060的实验跑完了，帮我看一下结果，这个方向还值得继续做吗？');
    assert.equal(upstreamCalls, 1);

    assert.equal(lastBody.model, 'gemini-3-flash-preview');
    assert.equal(lastBody.reasoning_effort, 'low');
    assert.ok(lastBody.messages.length >= 3);

    const sentUserContent = JSON.stringify(lastBody.messages);
    assert.equal(sentUserContent.includes('AIzaSySecretTestKey1234567890'), false);
    assert.equal(sentUserContent.includes('sk-abcdef1234567890'), false);
    assert.ok(sentUserContent.includes('***REDACTED***'));

    const res2 = await svc.handleAction('suggest', { turns, lang: 'zh-CN' });
    assert.equal(res2.ok, true);
    assert.equal(res2.cached, true);
    assert.equal(upstreamCalls, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('parseSingleSuggestion strips sycophantic prefixes, quotes, placeholders, and extra lines cleanly', () => {
  assert.equal(
    parseSingleSuggestion('太厉害了！帮我跑一下单元测试看看'),
    '帮我跑一下单元测试看看'
  );
  assert.equal(
    parseSingleSuggestion('Awesome! Run the test suite next\nSecond unwanted line'),
    'Run the test suite next'
  );
  assert.equal(parseSingleSuggestion('[实验数据或运行结果]'), '');
  assert.equal(
    parseSingleSuggestion('我去设置里看下现在Beta内容里的配置是不是清爽多了。'),
    '',
    'Self-action monologue MUST be rejected — suggestions must be prompts for the AI'
  );
  assert.equal(
    detectConversationLang([{ role: 'user', text: '你认为哪种模型提供方案好' }], 'zh-CN'),
    'zh-CN',
    'Simplified Chinese containing 方案 must NEVER be misclassified as zh-TW'
  );
  assert.equal(
    detectConversationLang([{ role: 'user', text: '請幫我檢查這個設定與驗證結果' }], 'zh-CN'),
    'zh-TW'
  );
  assert.equal(detectConversationLang([{ role: 'user', text: 'テストを実行してください' }]), 'ja');
  assert.equal(sanitizeConversationTurns([{ role: 'user', text: 'hello' }]).length, 1);

  const curated = curateChatModelList([
    'antigravity-preview-latest',
    'aqa',
    'deep-research-preview-04-2026',
    'gemini-2.5-computer-use-preview-10-2025',
    'gemini-2.5-pro',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-native-audio-latest',
    'gemini-2.5-flash-preview-tts',
    'gemini-3-flash-preview',
    'gemini-embedding-001',
    'lyria-3.5',
    'genie-4',
    'whisper-1',
    'dall-e-3',
  ]);
  assert.deepEqual(
    curated,
    ['gemini-3-flash-preview', 'gemini-2.5-pro'],
    'Non-chat models must be filtered out and fast models ranked first'
  );
  assert.deepEqual(
    curateChatModelList(['custom-local-embedding-only']),
    ['custom-local-embedding-only'],
    'Safety fallback: never return empty list when a custom endpoint only has non-standard names'
  );
});

test('Auto-only Ghost UI: zero ✨ button, fires strictly ONCE after reply completion, and zero double-insertion on Tab', async () => {
  class FakeElement {
    constructor(tagName, ownerDocument) {
      this.tagName = String(tagName || 'DIV').toUpperCase();
      this.nodeType = 1;
      this.ownerDocument = ownerDocument;
      this.parentNode = null;
      this.childNodes = [];
      this.attributes = new Map();
      this.listeners = new Map();
      this.className = '';
      this.id = '';
      this.hidden = false;
      this.isConnected = true;
      this._text = '';
      const styleMap = new Map();
      this.style = {
        display: '',
        visibility: '',
        opacity: '',
        setProperty: (k, v) => styleMap.set(k, String(v)),
        getPropertyValue: (k) => styleMap.get(k) || '',
        removeProperty: (k) => styleMap.delete(k),
      };
    }
    get parentElement() {
      return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
    }
    get firstChild() {
      return this.childNodes[0] || null;
    }
    get lastElementChild() {
      for (let i = this.childNodes.length - 1; i >= 0; i--) {
        if (this.childNodes[i].nodeType === 1) return this.childNodes[i];
      }
      return null;
    }
    get nextSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.childNodes.indexOf(this);
      return idx >= 0 ? this.parentNode.childNodes[idx + 1] || null : null;
    }
    get textContent() {
      if (this.childNodes.length === 0) return this._text;
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    }
    set textContent(v) {
      this.childNodes = [];
      this._text = String(v ?? '');
    }
    setAttribute(k, v) {
      const val = String(v);
      this.attributes.set(k, val);
      if (k === 'id') this.id = val;
      if (k === 'class') this.className = val;
    }
    getAttribute(k) {
      if (k === 'id' && this.id) return this.id;
      if (k === 'class' && this.className) return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(k) {
      return this.attributes.has(k);
    }
    removeAttribute(k) {
      this.attributes.delete(k);
      if (k === 'id') this.id = '';
    }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      child.isConnected = true;
      this.childNodes.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx >= 0) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
        child.isConnected = false;
      }
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    }
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    matches(sel) {
      return sel.split(',').some((raw) => {
        const s = raw.trim();
        if (!s) return false;
        if (s.startsWith('#') && !s.includes(' ')) return this.id === s.slice(1);
        if (s.startsWith('.') && !s.includes(' ')) return this.className.split(/\s+/).includes(s.slice(1));
        const attrEq = /^\[([^=\]]+)="([^"]*)"\]$/.exec(s);
        if (attrEq) return this.getAttribute(attrEq[1]) === attrEq[2];
        const attrHas = /^\[([^\]]+)\]$/.exec(s);
        if (attrHas) return this.hasAttribute(attrHas[1]);
        const compoundCls = /^\.([\w-]+)\s+\.([\w-]+)$/.exec(s);
        if (compoundCls) {
          return (
            this.className.split(/\s+/).includes(compoundCls[2]) &&
            Boolean(this.parentElement?.closest(`.${compoundCls[1]}`))
          );
        }
        const compound = /^\.([\w-]+)\s+\[([^=\]]+)="([^"]*)"\]$/.exec(s);
        if (compound) {
          return (
            this.getAttribute(compound[2]) === compound[3] &&
            Boolean(this.closest(`.${compound[1]}`))
          );
        }
        return this.tagName === s.toUpperCase();
      });
    }
    closest(sel) {
      let cur = this;
      while (cur && cur.nodeType === 1) {
        if (cur.matches(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const visit = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType === 1) {
            if (c.matches(sel)) out.push(c);
            visit(c);
          }
        }
      };
      visit(this);
      return out;
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
    addEventListener(type, fn, opts) {
      const cap = Boolean(typeof opts === 'object' ? opts?.capture : opts);
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ fn, cap });
    }
    removeEventListener(type, fn, opts) {
      const cap = Boolean(typeof opts === 'object' ? opts?.capture : opts);
      const arr = this.listeners.get(type);
      if (!arr) return;
      this.listeners.set(
        type,
        arr.filter((x) => !(x.fn === fn && x.cap === cap))
      );
    }
    dispatchEvent(ev) {
      ev.target = ev.target || this;
      const chain = [];
      let cur = this;
      while (cur) {
        chain.unshift(cur);
        cur = cur.parentNode || (cur !== this.ownerDocument ? this.ownerDocument : null);
      }
      for (const node of chain) {
        const list = node.listeners?.get(ev.type) || [];
        for (const item of [...list]) {
          if (item.cap) {
            item.fn(ev);
            if (ev._immediateStopped) return !ev.defaultPrevented;
          }
        }
        if (ev._stopped) return !ev.defaultPrevented;
      }
      for (let i = chain.length - 1; i >= 0; i--) {
        const list = chain[i].listeners?.get(ev.type) || [];
        for (const item of [...list]) {
          if (!item.cap) {
            item.fn(ev);
            if (ev._immediateStopped) return !ev.defaultPrevented;
          }
        }
        if (ev._stopped) return !ev.defaultPrevented;
      }
      return !ev.defaultPrevented;
    }
    focus() {
      this.ownerDocument.activeElement = this;
    }
  }

  let execCommandCount = 0;
  let lexicalDispatchCount = 0;
  let suggestRpcCount = 0;
  let insertedBuffer = '';

  const fakeDoc = {
    nodeType: 9,
    readyState: 'complete',
    listeners: new Map(),
    activeElement: null,
    execCommand(cmd, _ui, val) {
      if (cmd === 'insertText') {
        execCommandCount += 1;
        Promise.resolve().then(() => {
          insertedBuffer += val;
          lexicalEl.__lexicalTextContent = insertedBuffer;
          lexicalEl.textContent = insertedBuffer;
        });
        return true;
      }
      return false;
    },
    createElement(tag) {
      return new FakeElement(tag, fakeDoc);
    },
    createElementNS(_ns, tag) {
      return new FakeElement(tag, fakeDoc);
    },
    createTextNode(v) {
      return { nodeType: 3, nodeValue: String(v) };
    },
    addEventListener: FakeElement.prototype.addEventListener,
    removeEventListener: FakeElement.prototype.removeEventListener,
    getElementById(id) {
      return fakeDoc.documentElement.querySelector(`#${id}`);
    },
    querySelector(sel) {
      return fakeDoc.documentElement.querySelector(sel);
    },
    querySelectorAll(sel) {
      return fakeDoc.documentElement.querySelectorAll(sel);
    },
  };
  fakeDoc.documentElement = new FakeElement('html', fakeDoc);
  fakeDoc.documentElement.setAttribute('data-ag-cs-lang', 'zh-CN');
  fakeDoc.head = new FakeElement('head', fakeDoc);
  fakeDoc.body = new FakeElement('body', fakeDoc);
  fakeDoc.documentElement.appendChild(fakeDoc.head);
  fakeDoc.documentElement.appendChild(fakeDoc.body);

  const convView = fakeDoc.createElement('div');
  convView.setAttribute('data-testid', 'conversation-view');
  convView.setAttribute('data-cascade-id', 'cascade-a');
  const uMsg = fakeDoc.createElement('div');
  uMsg.setAttribute('data-testid', 'user-message-content');
  uMsg.appendChild(fakeDoc.createTextNode('验证4060迁移效果'));
  convView.appendChild(uMsg);
  fakeDoc.body.appendChild(convView);

  const composer = fakeDoc.createElement('div');
  composer.className = 'surface-composer';
  const caretHost = fakeDoc.createElement('div');
  caretHost.setAttribute('data-ag-cs-caret-host', '1');
  const lexicalEl = fakeDoc.createElement('div');
  lexicalEl.setAttribute('contenteditable', 'true');
  lexicalEl.setAttribute('data-lexical-editor', 'true');
  lexicalEl.__lexicalTextContent = '';
  const ctrlCmd = { type: 'CONTROLLED_TEXT_INSERTION_COMMAND' };
  lexicalEl.__lexicalEditor = {
    _commands: new Map([[ctrlCmd, true]]),
    focus() {
      lexicalEl.focus();
    },
    dispatchCommand(cmd, payload) {
      if (cmd === ctrlCmd) {
        lexicalDispatchCount += 1;
        Promise.resolve().then(() => {
          insertedBuffer += payload;
          lexicalEl.__lexicalTextContent = insertedBuffer;
          lexicalEl.textContent = insertedBuffer;
        });
        return true;
      }
      return false;
    },
  };
  const placeholder = fakeDoc.createElement('p');
  placeholder.setAttribute('data-ag-cs-placeholder', '描述任务或提出问题');
  caretHost.appendChild(lexicalEl);
  caretHost.appendChild(placeholder);

  const footer = fakeDoc.createElement('div');
  footer.className = 'agy-composer-footer';
  // Plant a legacy ✨ button to verify startup cleans it up
  const legacySparkle = fakeDoc.createElement('button');
  legacySparkle.setAttribute('data-testid', 'prism-suggest-trigger');
  footer.appendChild(legacySparkle);
  composer.appendChild(caretHost);
  composer.appendChild(footer);
  fakeDoc.body.appendChild(composer);

  const sgSlot = fakeDoc.createElement('div');
  sgSlot.setAttribute('data-testid', 'prism-suggester-slot');
  sgSlot.hidden = true;
  sgSlot.style.display = 'none';
  fakeDoc.body.appendChild(sgSlot);

  const EXPECTED = '本地4060的实验跑完了，帮我看一下结果，这个方向还值得继续做吗？';
  const storedCfg = { enabled: true, ttlMinutes: 15 };
  let fakeNow = 1_000_000;
  const fakeWin = {
    document: fakeDoc,
    Date: { now: () => fakeNow },
    location: { href: 'vscode-file://vscode-app/workbench.html' },
    setTimeout,
    clearTimeout,
    Event: class {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.defaultPrevented = false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
      stopPropagation() {
        this._stopped = true;
      }
      stopImmediatePropagation() {
        this._immediateStopped = true;
        this._stopped = true;
      }
    },
    __agPrismSuggestCall(rawPayload) {
      const msg = JSON.parse(rawPayload);
      setTimeout(() => {
        if (msg.action === 'get-config') {
          fakeWin.__agPrismSuggesterResolve(msg.id, {
            ok: true,
            config: storedCfg,
            backend: { aiReady: true, profileName: 'Gemini AI Studio', model: 'gemini-3-flash-preview' },
          });
        } else if (msg.action === 'suggest') {
          suggestRpcCount += 1;
          fakeWin.__agPrismSuggesterResolve(msg.id, {
            ok: true,
            engine: 'ai',
            suggestion: EXPECTED,
          });
        } else {
          fakeWin.__agPrismSuggesterResolve(msg.id, { ok: true });
        }
      }, 5);
    },
  };
  fakeWin.window = fakeWin;
  fakeWin.self = fakeWin;
  fakeWin.top = fakeWin;
  fakeDoc.defaultView = fakeWin;

  const ctx = vm.createContext(fakeWin);
  const evalRes = vm.runInContext(cdp.buildSuggesterExpression(), ctx);
  assert.equal(evalRes.ok, true);
  await new Promise((r) => setTimeout(r, 20));

  // 1) ZERO ✨ button in composer + Settings slot unhidden with switch & auto/manual model selectors
  assert.equal(fakeDoc.querySelector('[data-testid="prism-suggest-trigger"]'), null);
  assert.equal(sgSlot.hidden, false, 'Settings slot must be unhidden when UI mounts');
  assert.equal(sgSlot.style.display, '', 'Settings slot display:none must be cleared');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-suggester-card"]'), 'Settings card must be mounted');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-sg-enable-off"]'), 'Off button must be mounted');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-sg-ai-config"]'), 'Standard Thought-style AI config box must be mounted');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-sg-fetch-models-btn"]'), 'Fetch models button must be mounted');
  assert.equal(suggestRpcCount, 0, 'Must NOT fire on static history load');

  // 2) Simulate agent turn running -> completed transition
  const cancelBtn = fakeDoc.createElement('button');
  cancelBtn.setAttribute('data-testid', 'input-cancel-button');
  footer.appendChild(cancelBtn);
  fakeWin.__agPrismSuggester.checkAgentStateTransition();

  const aMsg = fakeDoc.createElement('div');
  aMsg.setAttribute('data-testid', 'planner-response-text');
  aMsg.appendChild(fakeDoc.createTextNode('跑完后把对照表发给我就够了。'));
  convView.appendChild(aMsg);
  cancelBtn.remove();
  fakeWin.__agPrismSuggester.checkAgentStateTransition();

  // Wait for 750ms settle timer + RPC round-trip
  await new Promise((r) => setTimeout(r, 820));
  assert.equal(suggestRpcCount, 1, 'Must fire suggest RPC once after turn completion');

  // Repeated transition checks on the same finished turn MUST NOT generate a second time
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(suggestRpcCount, 1, 'Must NEVER fire twice for the same completed reply');

  const overlay = fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]');
  assert.ok(overlay);
  assert.equal(overlay.textContent, `${EXPECTED}\u21e5 Tab`, 'Overlay must only contain suggestion + ⇥ Tab');

  // 2b) Switch to historical idle conversation 'cascade-b' -> MUST hide cascade-a's suggestion AND NEVER fire RPC!
  convView.setAttribute('data-cascade-id', 'cascade-b');
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  assert.equal(
    fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'),
    null,
    'Switching to another session MUST NEVER leak previous session suggestion'
  );
  await new Promise((r) => setTimeout(r, 820));
  assert.equal(suggestRpcCount, 1, 'Reopening historical idle session MUST NEVER fire suggest RPC');

  // 2c) Switch to running session 'cascade-c', then switch back to idle 'cascade-b' -> MUST NOT false-trigger!
  convView.setAttribute('data-cascade-id', 'cascade-c');
  footer.appendChild(cancelBtn);
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  convView.setAttribute('data-cascade-id', 'cascade-b');
  cancelBtn.remove();
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  await new Promise((r) => setTimeout(r, 820));
  assert.equal(suggestRpcCount, 1, 'Switching from running session to idle session MUST NOT false-trigger');

  // 2d) /btw side-panel answer running -> completed MUST NEVER trigger main composer suggestion!
  const sidePanel = fakeDoc.createElement('div');
  sidePanel.setAttribute('data-testid', 'side-question-panel');
  const sideCancel = fakeDoc.createElement('button');
  sideCancel.setAttribute('data-testid', 'input-cancel-button');
  sidePanel.appendChild(sideCancel);
  fakeDoc.body.appendChild(sidePanel);
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  sideCancel.remove();
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  await new Promise((r) => setTimeout(r, 820));
  assert.equal(suggestRpcCount, 1, '/btw side-panel turn completion MUST NEVER trigger main composer suggestion');

  // 2e) Switch back to 'cascade-a' (whose latest turn is unchanged) -> restores its own suggestion from memory (0 extra RPC)!
  convView.setAttribute('data-cascade-id', 'cascade-a');
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  assert.equal(suggestRpcCount, 1);
  assert.ok(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), 'Restores cascade-a suggestion when returning');

  // 3) Press Tab -> dispatches Lexical command ONCE (0 execCommand fallback, 0 duplication!)
  const tabEv = new fakeWin.Event('keydown', { bubbles: true });
  tabEv.key = 'Tab';
  lexicalEl.dispatchEvent(tabEv);
  await new Promise((r) => setTimeout(r, 15));

  assert.equal(lexicalDispatchCount, 1, 'Must dispatch Lexical insertion command exactly once');
  assert.equal(execCommandCount, 0, 'Must NOT also call execCommand when Lexical handled insertion');
  assert.equal(insertedBuffer, EXPECTED, 'Inserted text must NOT be duplicated');
  assert.equal(
    fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'),
    null,
    'Ghost overlay must stay hidden while composer has text'
  );

  // 3b) Deleting unsent text back to empty restores the cached suggestion instantly (0 extra RPCs)!
  fakeNow += 200;
  insertedBuffer = '';
  lexicalEl.__lexicalTextContent = '';
  lexicalEl.textContent = '';
  lexicalEl.dispatchEvent(new fakeWin.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(suggestRpcCount, 1, 'Restoring suggestion on composer clear must NOT fire extra RPC');
  assert.ok(
    fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'),
    'Ghost suggestion must reappear when unsent draft is cleared back to empty'
  );

  // Typing custom draft hides it -> clearing custom draft brings it back -> pressing Escape permanently dismisses for this turn!
  lexicalEl.__lexicalTextContent = '我自己先打几个字';
  lexicalEl.textContent = '我自己先打几个字';
  lexicalEl.dispatchEvent(new fakeWin.Event('input', { bubbles: true }));
  assert.equal(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), null, 'Custom draft hides ghost');

  lexicalEl.__lexicalTextContent = '';
  lexicalEl.textContent = '';
  lexicalEl.dispatchEvent(new fakeWin.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 35));
  assert.ok(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), 'Clearing custom draft restores ghost');

  const escEv = new fakeWin.Event('keydown', { bubbles: true });
  escEv.key = 'Escape';
  lexicalEl.dispatchEvent(escEv);
  assert.equal(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), null, 'Escape dismisses ghost');

  // 4) Background task completion + TTL expiry tests!
  insertedBuffer = '';
  lexicalEl.__lexicalTextContent = '';
  lexicalEl.textContent = '';

  const rowFresh = fakeDoc.createElement('div');
  rowFresh.setAttribute('data-testid', 'conversation-row-sidebar');
  rowFresh.setAttribute('data-cascade-id', 'cascade-bg-fresh');
  rowFresh.setAttribute('data-ag-cs-row-running', '1');

  const rowStale = fakeDoc.createElement('div');
  rowStale.setAttribute('data-testid', 'conversation-row-sidebar');
  rowStale.setAttribute('data-cascade-id', 'cascade-bg-stale');
  rowStale.setAttribute('data-ag-cs-row-running', '1');

  fakeDoc.body.appendChild(rowFresh);
  fakeDoc.body.appendChild(rowStale);
  fakeWin.__agPrismSuggester.checkAgentStateTransition();

  // Both finish in the background while user is still viewing 'cascade-a'
  rowFresh.removeAttribute('data-ag-cs-row-running');
  rowStale.removeAttribute('data-ag-cs-row-running');
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  assert.equal(suggestRpcCount, 1, 'Background completion must NOT waste quota before switching');

  // 4a) User switches to 'cascade-bg-fresh' 3 minutes later (<= 15m TTL) -> SHOULD predict & show!
  fakeNow += 3 * 60 * 1000;
  convView.setAttribute('data-cascade-id', 'cascade-bg-fresh');
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  await new Promise((r) => setTimeout(r, 420));
  assert.equal(suggestRpcCount, 2, 'Switching to background-completed task within 15m TTL must predict once');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), 'Fresh background suggestion shown');

  // 4b) Advance clock by 20 minutes (> 15m TTL) -> active suggestion expires AND 'cascade-bg-stale' stays silent!
  fakeNow += 20 * 60 * 1000;
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  assert.equal(
    fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'),
    null,
    'Displayed suggestion must auto-expire once past TTL'
  );

  convView.setAttribute('data-cascade-id', 'cascade-bg-stale');
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  await new Promise((r) => setTimeout(r, 420));
  assert.equal(
    suggestRpcCount,
    2,
    'Background-completed task switched to AFTER 15m TTL must NOT trigger suggest RPC'
  );
  assert.equal(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), null);

  // 4c) Delayed React DOM hydration (500ms after switching to background-completed task) MUST still fire!
  const rowHydrate = fakeDoc.createElement('div');
  rowHydrate.setAttribute('data-testid', 'conversation-row-sidebar');
  rowHydrate.setAttribute('data-cascade-id', 'cascade-bg-hydrate');
  const sbSpinner = fakeDoc.createElement('div');
  sbSpinner.setAttribute('data-testid', 'status-loading-spinner');
  rowHydrate.appendChild(sbSpinner);
  fakeDoc.body.appendChild(rowHydrate);
  fakeWin.__agPrismSuggester.checkAgentStateTransition();

  // Finishes in background while user is on 'cascade-bg-stale'
  sbSpinner.remove();
  fakeWin.__agPrismSuggester.checkAgentStateTransition();

  // User switches to 'cascade-bg-hydrate', but assistant turn is missing at frame 0 (mounts 500ms later!)
  const savedAgentNode = convView.querySelector('[data-testid="planner-response-text"]');
  if (savedAgentNode) savedAgentNode.remove();
  convView.setAttribute('data-cascade-id', 'cascade-bg-hydrate');
  fakeWin.__agPrismSuggester.checkAgentStateTransition();

  setTimeout(() => {
    const delayedReply = fakeDoc.createElement('div');
    delayedReply.setAttribute('data-testid', 'planner-response-text');
    delayedReply.appendChild(fakeDoc.createTextNode('已完成模型列表清洗，是否需要把闭环静默判定提到第一优先级？'));
    convView.appendChild(delayedReply);
    fakeWin.__agPrismSuggester.checkAgentStateTransition();
  }, 500);

  await new Promise((r) => setTimeout(r, 950));
  assert.equal(suggestRpcCount, 3, 'Delayed DOM hydration after background switch must NOT drop suggestion');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'), 'Hydrated background suggestion shown');

  // 4d) Foreground turn where ONLY the matching sidebar row spinner indicates running -> completed MUST still fire!
  fakeWin.__agPrismSuggester.dismissGhost({ markDismissed: true });
  rowHydrate.appendChild(sbSpinner);
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  const nextReply = fakeDoc.createElement('div');
  nextReply.setAttribute('data-testid', 'planner-response-text');
  nextReply.appendChild(fakeDoc.createTextNode('已修复延迟挂载丢提示的问题，还要调整静默优先级吗？'));
  convView.appendChild(nextReply);
  sbSpinner.remove();
  fakeWin.__agPrismSuggester.checkAgentStateTransition();
  await new Promise((r) => setTimeout(r, 850));
  assert.equal(suggestRpcCount, 4, 'Sidebar-row spinner running->completed transition must trigger suggestion');
  assert.ok(fakeDoc.querySelector('[data-testid="prism-ghost-overlay"]'));
  fakeWin.__agPrismSuggester.destroy();
});
