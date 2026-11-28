// Module-domain test suite: Safe OS custom.css opener/RPC, Antigravity-native 3-tier Font Picker & single-button custom.css UI
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertCssHygiene, assertFileHygiene } from './helpers/mini-dom.mjs';
import { createInteractiveDom, mountSettingsScaffold } from './helpers/custom-style-dom.mjs';
import { openExternalFileSafe } from '../src/daemon/custom-css-rpc.mjs';
import { createRpcDispatcher, handleSettingBinding } from '../src/daemon/rpc-dispatcher.mjs';
import { syncStaleCustomStyleSettingsUiOnEntry } from '../src/daemon/channel-sync-engine.mjs';
import { PAGE_HEALTH_PROBE_EXPRESSION, planChannelsForHeal, healSecondaryChannels } from '../src/daemon/session-heal-channels.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

const cdp = require(path.join(ROOT, 'cdp.js'));
const customCssLoader = require(path.join(ROOT, 'src', 'channels', 'custom-css-loader.cjs'));
const fontCustomizer = require(path.join(ROOT, 'src', 'runtime', 'font-customizer.js'));
const customStyleI18n = require(path.join(ROOT, 'vendor', 'custom-style', 'custom-style-i18n.js'));
const customStyleClient = require(path.join(ROOT, 'vendor', 'custom-style', 'custom-style-client.js'));
const fontPickerUi = require(path.join(ROOT, 'vendor', 'custom-style', 'font-picker-ui.js'));
const customStyleSettingsUi = require(path.join(ROOT, 'vendor', 'custom-style', 'custom-style-settings-ui.js'));

const CANONICAL_9_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'tr'];
const NON_CJK_LOCALES = ['en', 'ko', 'es', 'fr', 'de', 'tr'];
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const FORBIDDEN_TERM_RE = /八方旅人|octopath/i;

const mkTempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
const stripJsComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
const flushMicrotasks = () => new Promise((r) => setImmediate(r));

function createSymlinkOrJunction(targetFile, targetDir, linkPath) {
  try {
    fs.symlinkSync(targetFile, linkPath, 'file');
    return 'file';
  } catch (err) {
    if (process.platform === 'win32' && (err.code === 'EPERM' || err.code === 'EACCES')) {
      fs.symlinkSync(targetDir, linkPath, 'junction');
      return 'junction';
    }
    throw err;
  }
}

test('openExternalFileSafe: exact zero-AV spawn args/opts (win32/darwin/linux) & path/file security refusals', () => {
  const tmpDir = mkTempDir('prism-safe-opener-');
  const outsideDir = mkTempDir('prism-safe-opener-out-');
  try {
    const cssPath = path.join(tmpDir, 'custom.css');
    fs.writeFileSync(cssPath, ':root { --ag-prism-ui-font: "Inter"; }\n', 'utf8');

    const calls = [];
    const fakeSpawn = (cmd, args, opts) => {
      const rec = { cmd, args, opts, errBound: false, unrefed: false };
      calls.push(rec);
      return {
        on(ev, fn) { if (ev === 'error' && typeof fn === 'function') rec.errBound = true; },
        unref() { rec.unrefed = true; },
      };
    };

    // 1) Platform matrix: win32 -> explorer.exe, darwin -> open, linux -> xdg-open
    const winForward = cssPath.replace(/\\/g, '/');
    assert.equal(openExternalFileSafe(winForward, { platform: 'win32', spawnFn: fakeSpawn }), true);
    assert.equal(openExternalFileSafe(cssPath, { platform: 'darwin', spawnFn: fakeSpawn }), true);
    assert.equal(openExternalFileSafe(cssPath, { platform: 'linux', spawnFn: fakeSpawn }), true);
    assert.equal(calls.length, 3);

    assert.equal(calls[0].cmd, 'explorer.exe');
    assert.deepEqual(calls[0].args, [cssPath.replace(/\//g, '\\')]);
    assert.equal(calls[1].cmd, 'open');
    assert.deepEqual(calls[1].args, [cssPath]);
    assert.equal(calls[2].cmd, 'xdg-open');
    assert.deepEqual(calls[2].args, [cssPath]);

    for (const c of calls) {
      assert.equal(c.opts.detached, true);
      assert.equal(c.opts.stdio, 'ignore');
      assert.equal(c.opts.windowsHide, true);
      assert.equal(Boolean(c.opts.shell), false, 'Must NEVER pass shell:true');
      assert.equal('shell' in c.opts, false, 'shell option must be absent');
      assert.equal(c.errBound, true, 'Must attach error listener on child');
      assert.equal(c.unrefed, true, 'Must call child.unref()');
    }

    // 2) Automated test runtime safety guard (default spawn never opens real editor in npm test)
    assert.equal(openExternalFileSafe(cssPath), false);

    // 3) Refusal matrix: non-.css, UNC, relative, control chars, missing, directory, symlink, oversized
    const beforeRefusals = calls.length;
    const exePath = path.join(tmpDir, 'bad.exe');
    const txtPath = path.join(tmpDir, 'notes.txt');
    const dirCss = path.join(tmpDir, 'dir-as.css');
    const bigCss = path.join(tmpDir, 'too-large.css');
    const exactCss = path.join(tmpDir, 'exact-limit.css');
    const outsideCss = path.join(outsideDir, 'escape.css');
    const symCss = path.join(tmpDir, 'link.css');

    fs.writeFileSync(exePath, 'MZ', 'utf8');
    fs.writeFileSync(txtPath, 'hello', 'utf8');
    fs.mkdirSync(dirCss);
    fs.writeFileSync(bigCss, 'a'.repeat(customCssLoader.MAX_CUSTOM_CSS_BYTES + 1), 'utf8');
    fs.writeFileSync(exactCss, 'a'.repeat(customCssLoader.MAX_CUSTOM_CSS_BYTES), 'utf8');
    fs.writeFileSync(outsideCss, 'body { color: red; }\n', 'utf8');
    createSymlinkOrJunction(outsideCss, outsideDir, symCss);

    for (const bad of [
      null, '', '   ', 'custom.css', './custom.css',
      path.join(tmpDir, 'bad\ncustom.css'), `${cssPath}\0`, `\x07${cssPath}`,
      '\\\\evil-server\\share\\custom.css', '//evil-server/share/custom.css', '\\\\.\\pipe\\custom.css',
      exePath, txtPath, path.join(tmpDir, 'nonexistent.css'), dirCss, symCss, bigCss,
    ]) {
      assert.equal(openExternalFileSafe(bad, { platform: 'win32', spawnFn: fakeSpawn }), false, `Must refuse: ${String(bad)}`);
    }
    assert.equal(calls.length, beforeRefusals, 'Refused targets must trigger 0 spawns');

    // Exact 256 KB boundary regular .css file is permitted
    assert.equal(openExternalFileSafe(exactCss, { platform: 'win32', spawnFn: fakeSpawn }), true);
    assert.equal(calls.length, beforeRefusals + 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('Daemon RPC custom-css-open & custom-css-create-template: strict status gating, wx safety, attacker path ignored & DI hooks', async () => {
  const outsideDir = mkTempDir('prism-rpc-outside-');
  const outsideCss = path.join(outsideDir, 'attacker.css');
  fs.writeFileSync(outsideCss, 'body { background: red; }\n', 'utf8');

  const makeHarness = () => {
    const rootDir = mkTempDir('prism-rpc-root-');
    const opened = [];
    let refreshCalls = 0;
    const rpc = createRpcDispatcher({
      rootDir,
      getCdp: () => cdp,
      openExternalFile: (fp) => { opened.push(fp); return true; },
      channelOrchestrator: {
        refreshCustomStyleChannel: async (opts) => { refreshCalls += 1; return { ok: true, forceEval: Boolean(opts?.forceEval) }; },
      },
    });
    const entry = {
      mainFrameId: 'F1',
      contextFrames: new Map([[1, { frameId: 'F1', isDefault: true, type: 'default', docGen: 0 }]]),
      session: { closed: false },
    };
    const call = (payloadObj, deps = null) =>
      deps
        ? handleSettingBinding(rpc, entry, JSON.stringify(payloadObj), 1, deps)
        : rpc.handleBindingCall(entry, { name: cdp.SETTING_BINDING, payload: JSON.stringify(payloadObj), executionContextId: 1 });
    return { rootDir, cssPath: path.join(rootDir, 'custom.css'), opened, getRefreshCalls: () => refreshCalls, call };
  };

  try {
    // 1) custom-css-open: missing -> refuse; empty/active -> open ONLY canonical <root>/custom.css (ignore attacker filePath)
    const h1 = makeHarness();
    try {
      const rMissing = await h1.call({ action: 'custom-css-open', filePath: outsideCss, path: outsideCss });
      assert.deepEqual({ ok: rMissing.ok, status: rMissing.status, opened: rMissing.opened, blocked: rMissing.blocked },
        { ok: false, status: 'missing', opened: false, blocked: false });
      assert.equal(h1.opened.length, 0);

      fs.writeFileSync(h1.cssPath, '/* empty comment */\n', 'utf8');
      const rEmpty = await h1.call({ action: 'custom-css-open', filePath: outsideCss });
      assert.deepEqual({ ok: rEmpty.ok, status: rEmpty.status, opened: rEmpty.opened, blocked: rEmpty.blocked },
        { ok: true, status: 'empty', opened: true, blocked: false });
      assert.deepEqual(h1.opened, [fs.realpathSync(h1.cssPath)]);

      fs.writeFileSync(h1.cssPath, '@import url("https://evil.example/x.css");\n:root { --ag-prism-ui-font: "Inter"; }\n', 'utf8');
      const rActive = await h1.call({ action: 'custom-css-open', filePath: 'C:\\Windows\\System32\\calc.exe' });
      assert.equal(rActive.ok, true);
      assert.equal(rActive.status, 'active');
      assert.equal(rActive.opened, true);
      assert.equal(rActive.blocked, false);
      assert.equal(rActive.blockedImports, 1);
      assert.equal(h1.opened.at(-1), fs.realpathSync(h1.cssPath));

      // Direct handleSettingBinding deps.openExternalFile override
      const depOpened = [];
      const rDep = await h1.call({ action: 'custom-css-open' }, { openExternalFile: (fp) => { depOpened.push(fp); return true; } });
      assert.equal(rDep.ok, true);
      assert.deepEqual(depOpened, [fs.realpathSync(h1.cssPath)]);

      // rejected-too-large (> 256 KB) blocks opener on BOTH open and create-template
      fs.writeFileSync(h1.cssPath, '/* big */\n' + 'x'.repeat(customCssLoader.MAX_CUSTOM_CSS_BYTES), 'utf8');
      const openBeforeBig = h1.opened.length;
      const rOpenBig = await h1.call({ action: 'custom-css-open' });
      assert.deepEqual({ ok: rOpenBig.ok, status: rOpenBig.status, opened: rOpenBig.opened, blocked: rOpenBig.blocked },
        { ok: false, status: 'rejected-too-large', opened: false, blocked: true });
      const rCreateBig = await h1.call({ action: 'custom-css-create-template' });
      assert.deepEqual({ ok: rCreateBig.ok, created: rCreateBig.created, opened: rCreateBig.opened, blocked: rCreateBig.blocked, status: rCreateBig.status },
        { ok: false, created: false, opened: false, blocked: true, status: 'rejected-too-large' });
      assert.equal(h1.opened.length, openBeforeBig, 'Oversized custom.css must NEVER call opener');
    } finally {
      fs.rmSync(h1.rootDir, { recursive: true, force: true });
    }

    // 2) custom-css-create-template: wx creation without overwrite + Ch18 refresh + immediate open
    const h2 = makeHarness();
    try {
      const rCreate = await h2.call({ action: 'custom-css-create-template' });
      assert.deepEqual(
        { ok: rCreate.ok, created: rCreate.created, exists: rCreate.exists, status: rCreate.status, opened: rCreate.opened, blocked: rCreate.blocked },
        { ok: true, created: true, exists: true, status: 'empty', opened: true, blocked: false }
      );
      assert.equal(h2.getRefreshCalls(), 1);
      assert.deepEqual(h2.opened, [fs.realpathSync(h2.cssPath)]);
      assert.equal(fs.readFileSync(h2.cssPath, 'utf8'), customCssLoader.DEFAULT_CUSTOM_CSS_TEMPLATE);

      const userCss = '/* keep-me */\n:root { --ag-prism-chat-font: "Georgia"; }\n';
      fs.writeFileSync(h2.cssPath, userCss, 'utf8');
      const rKeep = await h2.call({ action: 'custom-css-create-template' });
      assert.deepEqual(
        { ok: rKeep.ok, created: rKeep.created, exists: rKeep.exists, status: rKeep.status, opened: rKeep.opened, blocked: rKeep.blocked },
        { ok: true, created: false, exists: true, status: 'active', opened: true, blocked: false }
      );
      assert.equal(fs.readFileSync(h2.cssPath, 'utf8'), userCss, 'wx must never overwrite existing custom.css');
      assert.equal(h2.getRefreshCalls(), 2);
      assert.equal(h2.opened.length, 2);
    } finally {
      fs.rmSync(h2.rootDir, { recursive: true, force: true });
    }

    // 3) rejected-non-file (directory) blocks both open and create-template (0 opener calls)
    const hDir = makeHarness();
    try {
      fs.mkdirSync(hDir.cssPath);
      const rOpenDir = await hDir.call({ action: 'custom-css-open' });
      const rCreateDir = await hDir.call({ action: 'custom-css-create-template' });
      assert.deepEqual({ ok: rOpenDir.ok, status: rOpenDir.status, opened: rOpenDir.opened, blocked: rOpenDir.blocked },
        { ok: false, status: 'rejected-non-file', opened: false, blocked: true });
      assert.deepEqual({ ok: rCreateDir.ok, status: rCreateDir.status, opened: rCreateDir.opened, blocked: rCreateDir.blocked },
        { ok: false, status: 'rejected-non-file', opened: false, blocked: true });
      assert.equal(hDir.opened.length, 0);
    } finally {
      fs.rmSync(hDir.rootDir, { recursive: true, force: true });
    }

    // 4) rejected-symlink blocks both open and create-template (0 opener calls)
    const hSym = makeHarness();
    try {
      createSymlinkOrJunction(outsideCss, outsideDir, hSym.cssPath);
      const rOpenSym = await hSym.call({ action: 'custom-css-open' });
      const rCreateSym = await hSym.call({ action: 'custom-css-create-template' });
      assert.deepEqual({ ok: rOpenSym.ok, status: rOpenSym.status, opened: rOpenSym.opened, blocked: rOpenSym.blocked },
        { ok: false, status: 'rejected-symlink', opened: false, blocked: true });
      assert.deepEqual({ ok: rCreateSym.ok, status: rCreateSym.status, opened: rCreateSym.opened, blocked: rCreateSym.blocked },
        { ok: false, status: 'rejected-symlink', opened: false, blocked: true });
      assert.equal(hSym.opened.length, 0);
    } finally {
      fs.rmSync(hSym.rootDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('Native Font Picker: hygiene, 3-tier takeover, lazy queryLocalFonts cache, 60-item batching, search/custom/reset, fallback & zero-leak dispose', async () => {
  // 1) Static file & code hygiene
  for (const name of ['font-picker-ui.js', 'custom-style-settings-ui.js', 'custom-style-i18n.js']) {
    const fp = path.join(ROOT, 'vendor', 'custom-style', name);
    assertFileHygiene([fp]);
    const buf = fs.readFileSync(fp);
    const src = buf.toString('utf8');
    assert.ok(buf.length <= 40960 && src.split('\n').length <= 800, `${name} must stay <= 800L / 40KB`);
    const clean = stripJsComments(src);
    assert.equal(/\.\s*(?:innerHTML|outerHTML)\s*[+]?=|\.\s*insertAdjacentHTML\s*\(/.test(clean), false, `${name}: 0 HTML sinks`);
    assert.equal(/:has\(/.test(clean), false, `${name}: 0 :has()`);
    assert.equal(/\bsetInterval\s*\(/.test(clean), false, `${name}: 0 setInterval`);
  }

  const dom = createInteractiveDom({ 'data-ag-cs-style': '1', 'data-ag-cs-lang': 'en' });
  const { doc, body, win, flushRafs, setTriggerRect } = dom;
  const { sec, chatRow, codeRow, ligRow } = mountSettingsScaffold(doc, body);

  const mockFonts = Array.from({ length: 220 }, (_, i) => ({ family: `Mock Font ${String(i + 1).padStart(3, '0')}` }));
  let queryCalls = 0;
  const rpcPayloads = [];
  win.queryLocalFonts = async () => { queryCalls += 1; return mockFonts; };
  win.__agPrismSetting = (raw) => rpcPayloads.push(JSON.parse(raw));
  win.__agPrismCustomStyle = customStyleClient;
  win.__agPrismCustomStyleI18n = customStyleI18n;
  win.__agPrismFontPickerUi = fontPickerUi;
  win.__agPrismFontCustomizer = fontCustomizer;

  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const liveTimers = new Set();
  globalThis.setTimeout = (fn, ms, ...r) => {
    const id = origSetTimeout((...a) => { liveTimers.delete(id); return fn(...a); }, ms, ...r);
    liveTimers.add(id);
    return id;
  };
  globalThis.clearTimeout = (id) => { liveTimers.delete(id); return origClearTimeout(id); };

  try {
    customStyleSettingsUi.install(doc, win);
    customStyleSettingsUi.syncIfPresent(doc, win, { uiFont: 'inter', chatFont: 'default', codeFont: 'jetbrains', customCss: 'on' });
    customStyleSettingsUi.syncIfPresent(doc, win, { uiFont: 'inter', chatFont: 'default', codeFont: 'jetbrains', customCss: 'on' });

    // Pure-ASCII CSS hygiene on both injected stylesheets
    assertCssHygiene(doc.getElementById(fontPickerUi.PICKER_STYLE_ID).textContent, 'font-picker-css');
    assertCssHygiene(doc.getElementById(customStyleSettingsUi.UI_STYLE_ID).textContent, 'custom-style-ui-css');

    // All 3 font rows taken over with exactly 1 .agy-select-trigger each (0 duplicates); codeLigatures untouched
    assert.equal(sec.querySelectorAll('.agy-select-trigger').length, 3);
    const uiTrigger = sec.querySelector('[data-ag-cs-row="uiFont"] button.agy-select-trigger[data-ag-cs-fp-trigger="ui"]');
    const chatTrigger = chatRow.querySelector('button.agy-select-trigger[data-ag-cs-fp-trigger="chat"]');
    const codeTrigger = codeRow.querySelector('button.agy-select-trigger[data-ag-cs-fp-trigger="code"]');
    assert.ok(uiTrigger && chatTrigger && codeTrigger);
    assert.equal(chatRow.getAttribute('data-ag-cs-fp-enhanced'), '1');
    assert.equal(codeRow.getAttribute('data-ag-cs-fp-enhanced'), '1');
    assert.equal(ligRow.hasAttribute('data-ag-cs-fp-enhanced'), false);
    assert.equal(ligRow.querySelector('.agy-select-trigger'), null);

    // Privacy: 0 queryLocalFonts() calls on mount/sync
    assert.equal(queryCalls, 0, 'Must NEVER call queryLocalFonts() on mount');

    // First click on uiFont picker triggers exactly 1 lazy queryLocalFonts() call + starting-style / selected state
    uiTrigger.click();
    let portal = body.querySelector('.agy-overlay[data-ag-cs-font-picker-portal="1"]');
    assert.ok(portal && portal.hasAttribute('data-starting-style'));
    flushRafs();
    assert.equal(portal.hasAttribute('data-starting-style'), false);
    await flushMicrotasks();
    assert.equal(queryCalls, 1, 'First click must invoke queryLocalFonts() exactly once');
    assert.equal(portal.querySelector('.agy-overlay-item[data-ag-fp-val="inter"]')?.getAttribute('data-selected'), 'true');

    // 300Hz: initial local items <= 60 (exact BATCH_SIZE=60), uniform UI font (0 per-item fontFamily), scroll appends next batch
    const listEl = portal.querySelector('[data-ag-fp-list="ui"]');
    const getLocalBtns = () => portal.querySelectorAll('[data-ag-fp-local-group="1"] button[data-ag-fp-kind="local"]');
    assert.equal(getLocalBtns().length, fontPickerUi.BATCH_SIZE);
    assert.ok(getLocalBtns().length <= 60);
    for (const btn of getLocalBtns()) {
      assert.equal(Boolean(btn.style.fontFamily), false, 'Local font items must use uniform UI font');
    }
    listEl.scrollTop = 980;
    listEl.clientHeight = 276;
    listEl.scrollHeight = 1280;
    listEl.dispatchEvent({ type: 'scroll' });
    assert.equal(getLocalBtns().length, 120, 'Scrolling near bottom must incrementally append next batch');

    // Live search filtering down to exact 10 matches
    const searchInp = portal.querySelector('input[data-ag-fp-search="ui"]');
    searchInp.value = 'Mock Font 19';
    searchInp.dispatchEvent({ type: 'input' });
    assert.equal(getLocalBtns().length, 10);

    // Purely invalid custom stack -> inline warning, portal stays open, 0 RPCs
    const rpcBeforeInvalid = rpcPayloads.length;
    searchInp.value = 'Evil; } body{} @import url(x)';
    searchInp.dispatchEvent({ type: 'input' });
    portal.dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.equal(rpcPayloads.length, rpcBeforeInvalid);
    const inlineWarn = portal.querySelector('[data-ag-fp-warn="1"]');
    assert.equal(inlineWarn.hidden, false);
    assert.ok(inlineWarn.textContent.length > 0);

    // Oversized > 160-char comma-separated stack -> sanitized <= 160 chars & schema-valid
    const longStack = Array.from({ length: 24 }, (_, i) => `CustomFamily${String(i).padStart(2, '0')}`).join(', ');
    assert.ok(longStack.length > 160);
    searchInp.value = longStack;
    searchInp.dispatchEvent({ type: 'input' });
    portal.dispatchEvent({ type: 'keydown', key: 'Enter' });
    const longRpc = rpcPayloads.at(-1);
    assert.equal(longRpc.action, 'patch-batch');
    assert.equal(longRpc.entries.uiFont, 'custom');
    assert.ok(longRpc.entries.uiFontCustom.length > 0 && longRpc.entries.uiFontCustom.length <= 160);
    assert.equal(cdp.validateConfigEntry('uiFontCustom', longRpc.entries.uiFontCustom), true);

    // Opening chat & code pickers reuses in-memory cache (0 extra queryLocalFonts() calls)
    setTriggerRect({ left: 140, top: 720, right: 340, bottom: 750, width: 200, height: 30 });
    chatTrigger.click();
    portal = body.querySelector('.agy-overlay[data-ag-cs-font-picker-portal="1"]');
    assert.equal(queryCalls, 1, 'Cached local fonts must serve chat tier with 0 extra queries');
    assert.equal(portal.style.top, 'auto', 'Near-bottom trigger must flip overlay upward');
    assert.notEqual(portal.style.bottom, 'auto');
    const chatSearch = portal.querySelector('input[data-ag-fp-search="chat"]');
    chatSearch.value = 'Inter, MiSans, PingFang SC';
    chatSearch.dispatchEvent({ type: 'input' });
    portal.dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.deepEqual(rpcPayloads.at(-1), { action: 'patch-batch', entries: { chatFont: 'custom', chatFontCustom: 'Inter, MiSans, PingFang SC' } });
    assert.equal(cdp.validateConfigEntry('chatFontCustom', 'Inter, MiSans, PingFang SC'), true);

    // Code tier: mixed unsafe stack sanitizes & shows row warning; Reset clears both
    setTriggerRect(null);
    codeTrigger.click();
    portal = body.querySelector('.agy-overlay[data-ag-cs-font-picker-portal="1"]');
    assert.equal(queryCalls, 1, 'Cached local fonts must serve code tier with 0 extra queries');
    const codeSearch = portal.querySelector('input[data-ag-fp-search="code"]');
    codeSearch.value = 'Maple Mono, Evil; } body{display:none}, JetBrains Mono';
    codeSearch.dispatchEvent({ type: 'input' });
    portal.dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.deepEqual(rpcPayloads.at(-1), { action: 'patch-batch', entries: { codeFont: 'custom', codeFontCustom: 'Maple Mono, JetBrains Mono' } });
    const rowWarn = codeRow.querySelector('[data-ag-cs-fp-warn="1"]');
    assert.ok(rowWarn && rowWarn.hidden === false && rowWarn.textContent.length > 0);

    codeTrigger.click();
    body.querySelector('button[data-ag-fp-reset="code"]').click();
    assert.deepEqual(rpcPayloads.at(-1), { action: 'patch-batch', entries: { codeFont: 'default', codeFontCustom: '' } });
    assert.equal(codeRow.querySelector('[data-ag-cs-fp-warn="1"]').hidden, true);

    // Keyboard navigation (ArrowDown / Escape) & click-outside close
    uiTrigger.click();
    portal = body.querySelector('.agy-overlay[data-ag-cs-font-picker-portal="1"]');
    portal.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    assert.ok(portal.querySelector('[data-highlighted="1"]'));
    portal.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(uiTrigger.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.activeElement, uiTrigger);
    assert.equal(portal.hasAttribute('data-ending-style'), true);

    chatTrigger.click();
    assert.equal(chatTrigger.getAttribute('aria-expanded'), 'true');
    doc.dispatchEvent({ type: 'mousedown', target: body });
    assert.equal(chatTrigger.getAttribute('aria-expanded'), 'false');

    // Re-open so doc/win listeners + rAF + closing timer are active, then dispose() -> 0 leaks
    uiTrigger.click();
    customStyleSettingsUi.dispose(doc);
    assert.equal(dom.getDocListenerCount(), 0, 'dispose() must leak 0 document listeners');
    assert.equal(dom.getWinListenerCount(), 0, 'dispose() must leak 0 window listeners');
    assert.equal(dom.getPendingRafCount(), 0, 'dispose() must leak 0 rAFs');
    assert.equal(liveTimers.size, 0, 'dispose() must leak 0 timers');
    assert.equal(body.querySelectorAll('[data-ag-cs-font-picker-portal="1"]').length, 0);
    assert.equal(doc.getElementById(fontPickerUi.PICKER_STYLE_ID), null);
    assert.equal(doc.getElementById(customStyleSettingsUi.UI_STYLE_ID), null);
    assert.equal(sec.querySelectorAll('[data-ag-cs-fp-enhanced="1"]').length, 0);
    assert.equal(dom.getInnerHtmlWrites(), 0);

    // Graceful degradation #1: permission denied
    win.queryLocalFonts = async () => { throw new Error('Permission denied'); };
    customStyleSettingsUi.install(doc, win);
    sec.querySelector('[data-ag-cs-fp-trigger="ui"]').click();
    await flushMicrotasks();
    const deniedStatus = body.querySelector('.ag-fp-status');
    assert.ok(deniedStatus && /declined|permission/i.test(deniedStatus.textContent));
    body.querySelector('.agy-overlay-item[data-ag-fp-val="harmony"]').click();
    assert.deepEqual(rpcPayloads.at(-1), { key: 'uiFont', value: 'harmony' });
    customStyleSettingsUi.dispose(doc);

    // Graceful degradation #2: missing queryLocalFonts API
    delete win.queryLocalFonts;
    customStyleSettingsUi.install(doc, win);
    sec.querySelector('[data-ag-cs-fp-trigger="ui"]').click();
    await flushMicrotasks();
    const unsupStatus = body.querySelector('.ag-fp-status');
    assert.ok(unsupStatus && /unavailable/i.test(unsupStatus.textContent));
    body.querySelector('.agy-overlay-item[data-ag-fp-val="inter"]').click();
    assert.deepEqual(rpcPayloads.at(-1), { key: 'uiFont', value: 'inter' });
  } finally {
    customStyleSettingsUi.dispose(doc);
    customStyleClient.destroy(doc);
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

test('Single-button custom.css row state machine & 9-locale auto hot-reload / security-block contract', () => {
  const dom = createInteractiveDom({ 'data-ag-cs-style': '1', 'data-ag-cs-lang': 'en' });
  const { doc, body, win } = dom;
  const { sec } = mountSettingsScaffold(doc, body);
  const rpcPayloads = [];
  win.__agPrismSetting = (raw) => rpcPayloads.push(JSON.parse(raw));
  win.__agPrismCustomStyle = customStyleClient;
  win.__agPrismCustomStyleI18n = customStyleI18n;
  win.__agPrismFontPickerUi = fontPickerUi;

  try {
    customStyleSettingsUi.install(doc, win);
    const cssRow = sec.querySelector('[data-ag-cs-row="customCss"]');
    assert.ok(cssRow);

    // Strictly 0 Reload buttons; strictly 1 dynamic action button
    assert.equal(cssRow.querySelectorAll('button[data-ag-cs-ext-action="reload-custom-css"]').length, 0);
    assert.equal(cssRow.querySelectorAll('.ag-cs-css-actions button').length, 1);
    const btn = cssRow.querySelector('.ag-cs-css-actions button');
    const descEl = cssRow.querySelector('[data-k="d"]');
    assert.ok(/auto|hot-reload/i.test(descEl.textContent), 'Description must reflect auto hot-reload');

    // 1) missing -> Create Template -> emits custom-css-create-template & flips immediately to Open
    customStyleSettingsUi.syncIfPresent(doc, win, { customCss: 'on' }, { status: 'missing', bytes: 0, blockedImports: 0 });
    assert.equal(btn.disabled, false);
    assert.equal(btn.getAttribute('data-ag-cs-ext-action'), 'create-custom-css-template');
    assert.equal(btn.textContent, customStyleI18n.getStrings('en').btnCreateCustomCss);
    btn.click();
    assert.deepEqual(rpcPayloads.at(-1), { action: 'custom-css-create-template' });
    assert.equal(btn.getAttribute('data-ag-cs-ext-action'), 'open-custom-css');
    assert.equal(btn.textContent, customStyleI18n.getStrings('en').btnOpenCustomCss);

    // Clicking flipped Open button now dispatches custom-css-open
    btn.click();
    assert.deepEqual(rpcPayloads.at(-1), { action: 'custom-css-open' });

    // 2) empty & active -> Open -> custom-css-open; small active file (47 B / 1 B) clamps to 0.1 KB (never 0.0 KB)
    const statusEl = cssRow.querySelector('[data-ag-cs-css-status="1"]');
    for (const [st, bytes] of [['empty', 0], ['active', 1], ['active', 47], ['active', 1024]]) {
      customStyleSettingsUi.syncIfPresent(doc, win, { customCss: 'on' }, { status: st, bytes, blockedImports: 0 });
      assert.equal(btn.disabled, false);
      assert.equal(btn.hasAttribute('aria-disabled'), false);
      assert.equal(btn.getAttribute('data-ag-cs-ext-action'), 'open-custom-css');
      if (st === 'active' && bytes < 100) {
        assert.ok(statusEl.textContent.includes('0.1 KB'), `${bytes} B active CSS must display 0.1 KB, got: ${statusEl.textContent}`);
        assert.equal(statusEl.textContent.includes('0.0 KB'), false, 'Active non-empty CSS must never display 0.0 KB');
      }
      const before = rpcPayloads.length;
      btn.click();
      assert.equal(rpcPayloads.length, before + 1);
      assert.deepEqual(rpcPayloads.at(-1), { action: 'custom-css-open' });
    }

    // 3) rejected-symlink / rejected-non-file / rejected-too-large / error -> disabled + aria-disabled="true" + 0 RPCs
    for (const badStatus of ['rejected-symlink', 'rejected-non-file', 'rejected-too-large', 'error']) {
      customStyleSettingsUi.syncIfPresent(doc, win, { customCss: 'on' }, { status: badStatus, bytes: 0, blockedImports: 0 });
      assert.equal(btn.disabled, true, `${badStatus} must disable button`);
      assert.equal(btn.getAttribute('aria-disabled'), 'true', `${badStatus} must set aria-disabled="true"`);
      assert.equal(btn.getAttribute('data-blocked'), '1');
      assert.ok(String(btn.getAttribute('title') || '').length > 0, `${badStatus} must expose localized warning tooltip`);
      const before = rpcPayloads.length;
      btn.click();
      btn.dispatchEvent({ type: 'click' });
      assert.equal(rpcPayloads.length, before, `${badStatus} must trigger 0 RPCs even on direct click event`);
    }

    // 4) All 9 canonical locales: identical keys, required upgrade keys, 0 dead Reload key, 0 CJK in non-CJK, 0 yue
    assert.deepEqual([...customStyleI18n.LOCALES], CANONICAL_9_LOCALES);
    assert.equal(customStyleI18n.LOCALES.includes('yue'), false);
    const expectedKeys = Object.keys(customStyleI18n.TABLE).sort();
    assert.equal(expectedKeys.includes('btnReloadCustomCss'), false, 'Legacy Reload i18n key must be removed');
    for (const reqKey of [
      'btnCreateCustomCss', 'btnOpenCustomCss', 'cssOpenTooltip',
      'cssOpenBlockedSymlink', 'cssOpenBlockedTooLarge', 'cssOpenBlockedError',
      'fontPickerSearchPlaceholder', 'fontPickerGroupPresets', 'fontPickerGroupLocal',
      'fontPickerApplyCustom', 'fontPickerEmpty', 'fontPickerResetDefault',
      'fontPickerCurrentCustom', 'fontPickerInvalidStack',
    ]) {
      assert.ok(expectedKeys.includes(reqKey), `Missing i18n key: ${reqKey}`);
    }
    for (const loc of CANONICAL_9_LOCALES) {
      const d = customStyleI18n.getStrings(loc);
      assert.deepEqual(Object.keys(d).sort(), expectedKeys);
      const maxPhLen = ['zh-CN', 'zh-TW', 'ja', 'ko'].includes(loc) ? 16 : 32;
      assert.ok(
        d.fontPickerSearchPlaceholder.length <= maxPhLen,
        `${loc}.fontPickerSearchPlaceholder too long (${d.fontPickerSearchPlaceholder.length} > ${maxPhLen}): "${d.fontPickerSearchPlaceholder}"`
      );
      for (const k of expectedKeys) {
        assert.ok(typeof d[k] === 'string' && d[k].trim().length > 0, `Empty ${loc}.${k}`);
        assert.equal(FORBIDDEN_TERM_RE.test(d[k]), false, `Forbidden term in ${loc}.${k}`);
        if (NON_CJK_LOCALES.includes(loc)) assert.equal(CJK_RE.test(d[k]), false, `CJK leaked into ${loc}.${k}`);
      }
    }
  } finally {
    customStyleSettingsUi.dispose(doc);
    customStyleClient.destroy(doc);
  }
});

test('Hot-upgrade Settings companion auto-heal: 0 eval when !hasSettingsPanel, auto-delivers on stale hash, 0 redundant eval when fresh', async () => {
  const expectedUiHash = cdp.getCustomStyleSettingsUiRuntimeHash();
  assert.ok(typeof expectedUiHash === 'string' && expectedUiHash.length > 0);
  assert.ok(PAGE_HEALTH_PROBE_EXPRESSION.includes('customStyleUiRuntimeHash:'));

  // 1) syncStaleCustomStyleSettingsUiOnEntry (applyAllChannelsToEntry hook)
  const makeSyncMock = (probeReply) => {
    let buildCalls = 0;
    const deliveredExprs = [];
    const mockCdp = {
      readConfig: () => ({ ...cdp.DEFAULT_CONFIG }),
      getCustomStyleSettingsUiRuntimeHash: () => expectedUiHash,
      buildCustomStyleSettingsUiExpression: (cfg) => {
        buildCalls += 1;
        return cdp.buildCustomStyleSettingsUiExpression(cfg);
      },
    };
    const orch = { getCdp: () => mockCdp };
    const entry = {
      settingsChannelDelivered: false,
      session: {
        closed: false,
        async evaluate(expr) {
          if (expr.includes('__prismUiRuntimeHash') && expr.includes('hasSet')) return probeReply;
          deliveredExprs.push(expr);
          return { ok: true, status: 'mounted', codeHash: expectedUiHash };
        },
      },
    };
    return { orch, entry, getBuildCalls: () => buildCalls, deliveredExprs };
  };

  // !hasSettingsPanel -> strictly 0 companion build & 0 delivery evals
  const sNoSet = makeSyncMock({ hasSet: false });
  assert.equal(await syncStaleCustomStyleSettingsUiOnEntry(sNoSet.orch, sNoSet.entry), false);
  assert.equal(sNoSet.getBuildCalls(), 0);
  assert.equal(sNoSet.deliveredExprs.length, 0);
  assert.equal(sNoSet.entry.settingsChannelDelivered, false);

  // hasSettingsPanel + stale hash -> delivers fresh companion immediately
  const sStale = makeSyncMock({ hasSet: true, hash: '1ej8qaf' });
  assert.equal(await syncStaleCustomStyleSettingsUiOnEntry(sStale.orch, sStale.entry), true);
  assert.equal(sStale.getBuildCalls(), 1);
  assert.equal(sStale.deliveredExprs.length, 1);
  assert.ok(sStale.deliveredExprs[0].includes('__agPrismFontPickerUi'));
  assert.equal(sStale.entry.settingsChannelDelivered, true);

  // hasSettingsPanel + matching current hash -> 0 redundant delivery
  const sFresh = makeSyncMock({ hasSet: true, hash: expectedUiHash });
  assert.equal(await syncStaleCustomStyleSettingsUiOnEntry(sFresh.orch, sFresh.entry), false);
  assert.equal(sFresh.getBuildCalls(), 0);
  assert.equal(sFresh.deliveredExprs.length, 0);
  assert.equal(sFresh.entry.settingsChannelDelivered, true);

  // 2) planChannelsForHeal + healSecondaryChannels
  const runHealCase = async (probe) => {
    let ch9Deliveries = 0;
    const companionEvals = [];
    const orch = {
      getCdp: () => cdp,
      getChannelExprHash: () => 'ch9-fresh-hash',
      ensureSettingsExpr: () => '/*ch9*/',
      isChannelEnabled: () => false,
      hasChannelFile: () => false,
      getChannelExpr: () => '',
      deliverSettingsChannelToEntry: async () => { ch9Deliveries += 1; return true; },
      cleanupChannelOnEntry: async () => {},
    };
    const entry = {
      session: {
        closed: false,
        async evaluate(expr) {
          companionEvals.push(expr);
          return { ok: true, status: 'mounted', codeHash: expectedUiHash };
        },
      },
    };
    const now = Date.now();
    const plan = planChannelsForHeal(orch, entry, { ...cdp.DEFAULT_CONFIG }, probe, now);
    const settingsItem = plan.items.find((it) => it.spec.id === 'settings');
    const healed = await healSecondaryChannels(orch, entry, { ...cdp.DEFAULT_CONFIG }, probe, plan, { afterCh1Heal: false, now });
    return { settingsItem, healed, ch9Deliveries, companionEvals };
  };

  // Case A: Settings never opened -> needsCompanionHeal=false, 0 evals
  const hNoSet = await runHealCase({ hasSettingsPanel: false, needsSettingsChannel: false, settingsCodeHash: '', customStyleUiRuntimeHash: '' });
  assert.equal(hNoSet.settingsItem.needsHeal, false);
  assert.equal(hNoSet.settingsItem.needsCompanionHeal, false);
  assert.equal(hNoSet.healed, false);
  assert.equal(hNoSet.ch9Deliveries, 0);
  assert.equal(hNoSet.companionEvals.length, 0);

  // Case B: Settings already open with stale companion hash -> heals companion only without Ch9 reload
  const hStale = await runHealCase({ hasSettingsPanel: true, needsSettingsChannel: false, settingsCodeHash: 'ch9-fresh-hash', customStyleUiRuntimeHash: '1ej8qaf' });
  assert.equal(hStale.settingsItem.needsHeal, false);
  assert.equal(hStale.settingsItem.needsCompanionHeal, true);
  assert.equal(hStale.healed, true);
  assert.equal(hStale.ch9Deliveries, 0);
  assert.equal(hStale.companionEvals.length, 1);
  assert.ok(hStale.companionEvals[0].includes('__agPrismFontPickerUi'));

  // Case C: Settings open with up-to-date companion hash -> 0 redundant evals
  const hFresh = await runHealCase({ hasSettingsPanel: true, needsSettingsChannel: false, settingsCodeHash: 'ch9-fresh-hash', customStyleUiRuntimeHash: expectedUiHash });
  assert.equal(hFresh.settingsItem.needsHeal, false);
  assert.equal(hFresh.settingsItem.needsCompanionHeal, false);
  assert.equal(hFresh.healed, false);
  assert.equal(hFresh.ch9Deliveries, 0);
  assert.equal(hFresh.companionEvals.length, 0);
});
