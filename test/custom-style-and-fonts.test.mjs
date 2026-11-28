// Module-domain test suite: Global 3-Tier Fonts, Channel 18 (customStyle), custom.css loader, Ch9 UI, daemon hot-reload & presets
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { assertFileHygiene } from './helpers/mini-dom.mjs';
import { createInteractiveDom as createDomWithTraps } from './helpers/custom-style-dom.mjs';
import { PrismDaemon } from '../src/daemon/index.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

const cdp = require(path.join(ROOT, 'cdp.js'));
const customCssLoader = require(path.join(ROOT, 'src', 'channels', 'custom-css-loader.cjs'));
const {
  CUSTOM_STYLE_FILES,
  CUSTOM_STYLE_SETTINGS_UI_FILES,
  createCustomStyleChannelBuilders,
} = require(path.join(ROOT, 'src', 'channels', 'builders-custom-style.cjs'));
const { PROTECTED_USER_PATHS, USER_OWNED_ASSET_PATHS } = require(path.join(ROOT, 'src', 'platform', 'install-manifest.cjs'));
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
const extractTargetHash = (expr) => (typeof expr === 'string' && expr.match(/const targetHash = "([^"]+)";/)?.[1]) || '';

async function waitUntil(pred, timeoutMs = 3500, stepMs = 35) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return Boolean(await pred());
}

test('custom-css-loader.cjs: status states, SHA-256, size/symlink guards, @import blocking & wx template', () => {
  const tmpDir = mkTempDir('prism-custom-css-loader-');
  const outsideDir = mkTempDir('prism-custom-css-outside-');
  try {
    // 1) Missing file & empty rootDir
    assert.equal(customCssLoader.readCustomCssSafe('   ').status, 'missing');
    const missing = customCssLoader.readCustomCssSafe(tmpDir);
    assert.deepEqual({ status: missing.status, css: missing.css, bytes: missing.bytes, sha256: missing.sha256, blockedImports: missing.blockedImports },
      { status: 'missing', css: '', bytes: 0, sha256: '', blockedImports: 0 });

    // 2) Empty & comment-only files -> 'empty'; DEFAULT_CUSTOM_CSS_TEMPLATE keeps comments with blockedImports===0
    const cssPath = path.join(tmpDir, 'custom.css');
    fs.writeFileSync(cssPath, '', 'utf8');
    assert.equal(customCssLoader.readCustomCssSafe(tmpDir).status, 'empty');
    fs.writeFileSync(cssPath, '  \n\t/* comment 1 */\n/* comment 2 */\n', 'utf8');
    const commentOnly = customCssLoader.readCustomCssSafe(tmpDir);
    assert.equal(commentOnly.status, 'empty');
    assert.equal(commentOnly.css, '');
    assert.equal(commentOnly.blockedImports, 0);

    const tplSan = customCssLoader.sanitizeCustomCssContent(customCssLoader.DEFAULT_CUSTOM_CSS_TEMPLATE);
    assert.equal(tplSan.blockedImports, 0);
    assert.equal(tplSan.css, customCssLoader.DEFAULT_CUSTOM_CSS_TEMPLATE);

    // 3) Active CSS + exact SHA-256 + BOM/NUL strip
    const activeBody = ':root { --ag-prism-ui-font: "Inter", sans-serif; }\n';
    fs.writeFileSync(cssPath, `\uFEFF${activeBody}\0`, 'utf8');
    const activeRes = customCssLoader.readCustomCssSafe(tmpDir);
    assert.equal(activeRes.status, 'active');
    assert.equal(activeRes.css, activeBody);
    assert.equal(activeRes.bytes, Buffer.byteLength(activeBody, 'utf8'));
    assert.equal(activeRes.sha256, crypto.createHash('sha256').update(activeBody, 'utf8').digest('hex'));
    assert.equal(activeRes.blockedImports, 0);

    // 4) Size cap: exact 256 KB accepted, 256 KB + 1 rejected
    const maxBytes = customCssLoader.MAX_CUSTOM_CSS_BYTES;
    assert.equal(maxBytes, 256 * 1024);
    const exactCss = ':root{--ag-prism-pad:"' + 'a'.repeat(maxBytes - 25) + '";}';
    assert.equal(Buffer.byteLength(exactCss, 'utf8'), maxBytes);
    fs.writeFileSync(cssPath, exactCss, 'utf8');
    assert.equal(customCssLoader.readCustomCssSafe(tmpDir).status, 'active');
    fs.writeFileSync(cssPath, exactCss + ' ', 'utf8');
    const tooLarge = customCssLoader.readCustomCssSafe(tmpDir);
    assert.equal(tooLarge.status, 'rejected-too-large');
    assert.equal(tooLarge.css, '');
    assert.equal(tooLarge.rawBytes, maxBytes + 1);
    fs.unlinkSync(cssPath);

    // 5) Non-regular-file (directory) & symlink rejection
    const nfDir = mkTempDir('prism-custom-css-nonfile-');
    const symDir = mkTempDir('prism-custom-css-symlink-');
    try {
      fs.mkdirSync(path.join(nfDir, 'custom.css'));
      assert.equal(customCssLoader.readCustomCssSafe(nfDir).status, 'rejected-non-file');

      const nfTpl = customCssLoader.createDefaultCustomCssTemplate(nfDir);
      assert.equal(nfTpl.ok, false);
      assert.equal(nfTpl.status, 'rejected-non-file');
      const outsideCss = path.join(outsideDir, 'escape.css');
      fs.writeFileSync(outsideCss, 'body { color: red; }\n', 'utf8');
      const linkPath = path.join(symDir, 'custom.css');
      try {
        fs.symlinkSync(outsideCss, linkPath, 'file');
      } catch (err) {
        if (process.platform === 'win32' && (err.code === 'EPERM' || err.code === 'EACCES')) {
          fs.symlinkSync(outsideDir, linkPath, 'junction');
        } else throw err;
      }
      assert.equal(customCssLoader.readCustomCssSafe(symDir).status, 'rejected-symlink');
      assert.equal(customCssLoader.createDefaultCustomCssTemplate(symDir).status, 'rejected-symlink');
    } finally {
      fs.rmSync(nfDir, { recursive: true, force: true });
      fs.rmSync(symDir, { recursive: true, force: true });
    }

    // 6) @import blocking (plain, multiline, case-insensitive, hex & non-hex backslash escapes) while keeping comments & CSS strings
    const importMix = [
      '/* Keep comment: @import url("https://example.com/in-comment.css"); */',
      '.keep-str::after { content: "@import url(https://example.com/in-string.css)"; }',
      '@import url("https://evil.example/plain.css");',
      "@import 'local-plain.css';",
      '@import\n  url(\n  "https://evil.example/multiline.css"\n);',
      '@IMPORT URL("https://evil.example/upper.css");',
      '@ImPoRt "https://evil.example/mixed.css";',
      '@\\import "https://evil.example/esc1.css";',
      '@\\i\\m\\p\\o\\r\\t "https://evil.example/esc2.css";',
      '@impor\\t "https://evil.example/esc3.css";',
      '@\\69\r\nmport url("https://evil.example/hex-crlf.css");',
      '@\\69\\6d\\70\\6f\\72\\74 "https://evil.example/hex-all.css";',
      '@\\000049\\00004d\\000050\\00004f\\000052\\000054 url("https://evil.example/hex6.css");',
      ':root { --ag-prism-safe: 1; }',
    ].join('\n');
    const san = customCssLoader.sanitizeCustomCssContent(importMix);
    assert.equal(san.blockedImports, 11);
    assert.ok(san.css.includes('/* Keep comment: @import url("https://example.com/in-comment.css"); */'));
    assert.ok(san.css.includes('content: "@import url(https://example.com/in-string.css)"'));
    assert.ok(san.css.includes(':root { --ag-prism-safe: 1; }'));
    assert.equal(san.css.includes('evil.example') || san.css.includes('local-plain.css'), false);

    // 7) createDefaultCustomCssTemplate wx non-overwriting behavior
    const tplDir = mkTempDir('prism-custom-css-tpl-');
    try {
      assert.equal(customCssLoader.createDefaultCustomCssTemplate(path.join(tplDir, 'missing')).status, 'invalid-root');
      const created = customCssLoader.createDefaultCustomCssTemplate(tplDir);
      assert.deepEqual({ ok: created.ok, created: created.created, exists: created.exists, status: created.status },
        { ok: true, created: true, exists: true, status: 'created' });
      assert.equal(fs.readFileSync(created.filePath, 'utf8'), customCssLoader.DEFAULT_CUSTOM_CSS_TEMPLATE);
      assert.equal(customCssLoader.readCustomCssSafe(tplDir).status, 'empty');

      const userCss = '/* user-authored */\n:root { --ag-prism-ui-font: "Inter"; }\n';
      fs.writeFileSync(created.filePath, userCss, 'utf8');
      const second = customCssLoader.createDefaultCustomCssTemplate(tplDir);
      assert.deepEqual({ ok: second.ok, created: second.created, exists: second.exists, status: second.status },
        { ok: true, created: false, exists: true, status: 'exists' });
      assert.equal(fs.readFileSync(created.filePath, 'utf8'), userCss);
    } finally {
      fs.rmSync(tplDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('Channel 18 (customStyle): gating matrix, 64 KB budget, targetHash sensitivity, companion UI & teardown split', () => {
  const ND = { noDiskCache: true };
  const ch18 = cdp.findChannel('customStyle');
  assert.ok(ch18 && ch18.channelNumber === 18 && ch18.budgetBytes === 64 * 1024);
  assert.deepEqual([...CUSTOM_STYLE_FILES], ['vendor/custom-style/custom-style-client.js']);
  assert.deepEqual([...CUSTOM_STYLE_SETTINGS_UI_FILES], [
    'vendor/custom-style/custom-style-i18n.js',
    'vendor/custom-style/font-picker-ui.js',
    'vendor/custom-style/custom-style-settings-ui.js',
  ]);
  assert.deepEqual([...ch18.files], [
    'vendor/custom-style/custom-style-i18n.js',
    'vendor/custom-style/custom-style-client.js',
    'vendor/custom-style/font-picker-ui.js',
    'vendor/custom-style/custom-style-settings-ui.js',
  ]);

  for (const [cfg, expected] of [
    [{ customCss: 'off', uiFont: 'default' }, false],
    [{ customCss: false, uiFont: 'default' }, false],
    [{ customCss: 'on', uiFont: 'default' }, true],
    [{ customCss: true, uiFont: 'default' }, true],
    [{ customCss: 'off', uiFont: 'inter' }, true],
    [{ customCss: 'off', uiFont: 'custom', uiFontCustom: 'Inter' }, true],
    [{ customCss: 'on', uiFont: 'harmony' }, true],
  ]) {
    assert.equal(cdp.shouldEnableCustomStyle(cfg), expected);
    assert.equal(ch18.shouldEnable(cfg), expected);
  }

  const offCfg = { ...cdp.DEFAULT_CONFIG, customCss: 'off', uiFont: 'default' };
  assert.equal(cdp.buildCustomStyleChannelExpression(offCfg, ND), '');
  assert.equal(cdp.getChannelCode('customStyle', offCfg, ND), '');
  // On-demand Settings UI companion & meta-sync remain available when Ch18 is off (prevents GUI lockout)
  const uiCompanionExpr = cdp.buildCustomStyleSettingsUiExpression(offCfg);
  const metaSyncExpr = cdp.buildCustomStyleSettingsMetaSyncExpression(offCfg);
  assert.ok(uiCompanionExpr.length > 0 && metaSyncExpr.length > 0 && Buffer.byteLength(metaSyncExpr, 'utf8') < 2048);
  assert.ok(
    uiCompanionExpr.includes('__agPrismCustomStyleI18n') &&
      uiCompanionExpr.includes('__agPrismFontPickerUi') &&
      uiCompanionExpr.includes('__agPrismCustomStyleSettingsUi')
  );
  assert.doesNotThrow(() => new vm.Script(uiCompanionExpr));
  assert.doesNotThrow(() => new vm.Script(metaSyncExpr));
  const refExpr = cdp.buildConfigRefreshExpression({ uiFont: 'inter', customCss: 'on' });
  assert.ok(refExpr.includes("P('CustomStyle')?.sync") && Buffer.byteLength(refExpr, 'utf8') < 4096);

  const enabledExpr = cdp.buildCustomStyleChannelExpression({ ...cdp.DEFAULT_CONFIG, customCss: 'on', uiFont: 'inter' }, ND);
  assert.ok(enabledExpr.length > 0 && Buffer.byteLength(enabledExpr, 'utf8') <= 64 * 1024);
  assert.ok(enabledExpr.includes('ch18BootPatch'));
  assert.equal(enabledExpr.includes('__agPrismFontPickerUi'), false, 'Ch18 must not bundle font-picker UI');
  assert.equal(enabledExpr.includes('__agPrismCustomStyleI18n'), false, 'Ch18 must not bundle Settings i18n');
  assert.doesNotThrow(() => new vm.Script(enabledExpr));

  // targetHash sensitivity across config keys + on-disk custom.css content/blockedImports
  const isoRoot = mkTempDir('prism-ch18-hash-');
  try {
    fs.cpSync(path.join(ROOT, 'vendor', 'custom-style'), path.join(isoRoot, 'vendor', 'custom-style'), { recursive: true });
    let memSlot = null;
    const builders = createCustomStyleChannelBuilders({
      rootDir: isoRoot,
      readConfig: () => ({ ...cdp.DEFAULT_CONFIG }),
      bundleCache: {
        getChannelMemCache: () => memSlot,
        resolveChannelAssetsWithDiskCache: ({ sig, compileFn }) => (memSlot = { sig, ...compileFn() }),
      },
    });
    const baseCfg = {
      ...cdp.DEFAULT_CONFIG, customCss: 'on', uiFont: 'default', uiFontCustom: '',
      chatFont: 'default', chatFontCustom: '', codeFont: 'default', codeFontCustom: '', language: 'en',
    };
    const hBase = extractTargetHash(builders.buildCustomStyleChannelExpression(baseCfg, ND));
    assert.ok(hBase.length > 0);
    for (const patch of [
      { uiFont: 'inter' }, { uiFont: 'custom', uiFontCustom: 'MiSans' }, { chatFont: 'harmony' },
      { chatFont: 'custom', chatFontCustom: 'Georgia' }, { codeFont: 'jetbrains' },
      { codeFont: 'custom', codeFontCustom: 'Maple Mono' }, { language: 'ja' }, { customCss: 'off', uiFont: 'inter' },
    ]) {
      assert.notEqual(extractTargetHash(builders.buildCustomStyleChannelExpression({ ...baseCfg, ...patch }, ND)), hBase);
    }

    const diskCss = path.join(isoRoot, 'custom.css');
    fs.writeFileSync(diskCss, ':root { --ag-prism-ui-font: "Inter"; }\n', 'utf8');
    const hCss1 = extractTargetHash(builders.buildCustomStyleChannelExpression(baseCfg, ND));
    assert.notEqual(hCss1, hBase);
    fs.writeFileSync(diskCss, '@import url("https://evil.example/x.css");\n:root { --ag-prism-ui-font: "Inter"; }\n', 'utf8');
    assert.notEqual(extractTargetHash(builders.buildCustomStyleChannelExpression(baseCfg, ND)), hCss1);

    // Split teardown contract: CUSTOM_STYLE_REMOVE_EXPRESSION cleans runtime client only (preserves Settings UI & calls syncIfPresent),
    // while SETTINGS_REMOVE_EXPRESSION & REMOVE_EXPRESSION dispose Settings UI; none delete disk custom.css
    const runTeardown = (expr) => {
      const { doc, html, head, body } = createDomWithTraps({
        'data-ag-cs-style': '1', 'data-ag-cs-ui-font': 'inter', 'data-ag-prism-custom-css': 'active',
      });
      for (const sid of ['ag-prism-ui-font-style', 'ag-prism-user-custom-css', 'ag-prism-custom-style-ui-css', 'ag-prism-font-picker-css']) {
        const s = doc.createElement('style'); s.id = sid; head.appendChild(s);
      }
      const owned = doc.createElement('div');
      owned.setAttribute('data-ag-cs-custom-style-owned', '1');
      const portal = doc.createElement('div');
      portal.setAttribute('data-ag-cs-font-picker-portal', '1');
      const enhRow = doc.createElement('div');
      enhRow.setAttribute('data-ag-cs-fp-enhanced', '1');
      body.appendChild(owned);
      body.appendChild(portal);
      body.appendChild(enhRow);
      let destroyed = 0; let disposed = 0; let pickerDisposed = 0; let syncedUi = 0;
      const sandbox = {
        document: doc,
        __agPrismCustomStyle: { destroy() { destroyed += 1; } },
        __agPrismCustomStyleI18n: { LOCALES: CANONICAL_9_LOCALES },
        __agPrismFontPickerUi: { dispose() { pickerDisposed += 1; } },
        __agPrismCustomStyleSettingsUi: { dispose() { disposed += 1; }, syncIfPresent() { syncedUi += 1; } },
      };
      sandbox.window = sandbox.globalThis = sandbox;
      vm.runInNewContext(expr, sandbox);
      return { doc, html, sandbox, destroyed, disposed, pickerDisposed, syncedUi, enhRow };
    };

    const rtOff = runTeardown(cdp.CUSTOM_STYLE_REMOVE_EXPRESSION);
    assert.deepEqual(
      { destroyed: rtOff.destroyed, disposed: rtOff.disposed, pickerDisposed: rtOff.pickerDisposed, syncedUi: rtOff.syncedUi },
      { destroyed: 1, disposed: 0, pickerDisposed: 0, syncedUi: 1 }
    );
    assert.equal(rtOff.doc.getElementById('ag-prism-ui-font-style'), null);
    assert.equal(rtOff.doc.getElementById('ag-prism-user-custom-css'), null);
    assert.ok(rtOff.doc.getElementById('ag-prism-custom-style-ui-css') && rtOff.doc.getElementById('ag-prism-font-picker-css'));
    assert.ok(rtOff.doc.querySelector('[data-ag-cs-custom-style-owned="1"]') && rtOff.enhRow.hasAttribute('data-ag-cs-fp-enhanced'));
    assert.equal(rtOff.html.hasAttribute('data-ag-cs-ui-font'), false);
    assert.equal(rtOff.html.hasAttribute('data-ag-prism-custom-css'), false);
    assert.equal(rtOff.sandbox.__agPrismCustomStyle, undefined);
    assert.ok(rtOff.sandbox.__agPrismCustomStyleSettingsUi && rtOff.sandbox.__agPrismCustomStyleI18n && rtOff.sandbox.__agPrismFontPickerUi);

    const setOff = runTeardown(cdp.SETTINGS_REMOVE_EXPRESSION);
    assert.deepEqual({ disposed: setOff.disposed, pickerDisposed: setOff.pickerDisposed }, { disposed: 1, pickerDisposed: 1 });
    assert.equal(setOff.doc.getElementById('ag-prism-custom-style-ui-css'), null);
    assert.equal(setOff.doc.getElementById('ag-prism-font-picker-css'), null);
    assert.equal(setOff.doc.querySelector('[data-ag-cs-font-picker-portal="1"]'), null);
    assert.equal(setOff.doc.querySelector('[data-ag-cs-custom-style-owned="1"]'), null);
    assert.equal(setOff.enhRow.hasAttribute('data-ag-cs-fp-enhanced'), false);
    for (const g of ['__agPrismCustomStyleSettingsUi', '__agPrismCustomStyleI18n', '__agPrismFontPickerUi']) {
      assert.equal(setOff.sandbox[g], undefined);
    }

    const fullOff = runTeardown(cdp.REMOVE_EXPRESSION);
    assert.deepEqual({ destroyed: fullOff.destroyed, disposed: fullOff.disposed, pickerDisposed: fullOff.pickerDisposed }, { destroyed: 1, disposed: 1, pickerDisposed: 1 });
    for (const sid of ['ag-prism-ui-font-style', 'ag-prism-user-custom-css', 'ag-prism-custom-style-ui-css', 'ag-prism-font-picker-css']) {
      assert.equal(fullOff.doc.getElementById(sid), null);
    }
    assert.equal(fullOff.doc.querySelector('[data-ag-cs-font-picker-portal="1"]'), null);
    assert.equal(fullOff.doc.querySelector('[data-ag-cs-custom-style-owned="1"]'), null);
    assert.equal(fullOff.enhRow.hasAttribute('data-ag-cs-fp-enhanced'), false);
    assert.equal(fullOff.html.hasAttribute('data-ag-cs-ui-font'), false);
    assert.equal(fullOff.html.hasAttribute('data-ag-prism-custom-css'), false);
    for (const g of ['__agPrismCustomStyle', '__agPrismCustomStyleI18n', '__agPrismFontPickerUi', '__agPrismCustomStyleSettingsUi']) {
      assert.equal(fullOff.sandbox[g], undefined);
    }
    assert.equal(fs.existsSync(diskCss), true, 'Teardown must NEVER delete custom.css on disk');
    assert.equal(cdp.PURGE_DATA_FILES.includes('custom.css'), false);
    assert.equal(PROTECTED_USER_PATHS.includes('custom.css'), true);
    assert.equal(USER_OWNED_ASSET_PATHS.includes('custom.css'), true);
  } finally {
    fs.rmSync(isoRoot, { recursive: true, force: true });
  }
});

test('4-layer typography cascade, icon immunity, pinned-last custom.css & CSS var precedence', () => {
  const { doc, html, head } = createDomWithTraps({ 'data-ag-cs-style': '1' });
  const prevCs = globalThis.__agPrismCustomStyle;
  const prevFc = globalThis.__agPrismFontCustomizer;
  globalThis.__agPrismCustomStyle = customStyleClient;
  globalThis.__agPrismFontCustomizer = fontCustomizer;

  try {
    const r1 = customStyleClient.sync(
      { uiFont: 'inter', uiFontCustom: '', chatFont: 'default', chatFontCustom: '', codeFont: 'default', codeFontCustom: '', customCss: 'on' },
      { status: 'missing', css: '', bytes: 0, blockedImports: 0 }, doc
    );
    assert.deepEqual({ ok: r1.ok, uiFontActive: r1.uiFontActive, customCssActive: r1.customCssActive }, { ok: true, uiFontActive: true, customCssActive: false });
    assert.equal(html.getAttribute('data-ag-cs-ui-font'), 'inter');
    assert.equal(html.getAttribute('data-ag-prism-custom-css'), 'missing');

    const css1 = doc.getElementById(customStyleClient.UI_FONT_STYLE_ID).textContent;
    for (const tok of [
      '--ag-prism-ui-font-resolved:var(--ag-prism-ui-font,',
      ':where(button,input,select,textarea):where(:not(.codicon):not([class*="codicon-"]):not(.octicon):not([data-icon-font]))',
      'html:root[data-ag-cs-style] :is(.codicon,[class*="codicon-"]){font-family:codicon !important;}',
      'html:root[data-ag-cs-style] .octicon{font-family:octicons !important;}',
      'font-family:var(--ag-prism-chat-font,var(--ag-prism-ui-font-resolved)) !important;',
      'font-family:var(--ag-prism-code-font,var(--ag-cs-mono-stack)) !important;',
    ]) assert.ok(css1.includes(tok), `Missing L1 CSS token: ${tok}`);
    assert.equal(css1.includes(':has(') || css1.includes('*{') || css1.includes('* {'), false);

    const customUiStack = customStyleClient.resolveUiFontStack('custom', 'Evil; } body{display:none}, "MiSans", PingFang SC');
    assert.ok(customUiStack.startsWith('"MiSans", "PingFang SC", ') && !/Evil|display|;|\{|\}/.test(customUiStack));

    const userCss = ':root { --ag-prism-ui-font: "CustomUI", sans-serif; --ag-prism-chat-font: "CustomChat", serif; --ag-prism-code-font: "CustomMono", monospace; }\n';
    const multiCfg = { uiFont: 'inter', uiFontCustom: '', chatFont: 'custom', chatFontCustom: 'Georgia, Noto Serif SC', codeFont: 'custom', codeFontCustom: 'Maple Mono, JetBrains Mono', customCss: 'on' };
    assert.equal(customStyleClient.sync(multiCfg, { status: 'active', css: userCss, bytes: userCss.length, blockedImports: 0 }, doc).customCssActive, true);
    const css2 = doc.getElementById(customStyleClient.UI_FONT_STYLE_ID).textContent;
    assert.equal(css2.includes('var(--ag-prism-ui-font-resolved)) !important;'), false);
    assert.ok(css2.includes('[data-testid="side-question-panel"],[data-testid="subagent-tab-conversation"]') && css2.includes('var(--ag-prism-chat-font, "Georgia", "Noto Serif SC"'));

    const fcRes = fontCustomizer.applyCustomFonts(multiCfg, doc);
    assert.ok(fcRes.active && fcRes.css.includes('var(--ag-prism-chat-font,"Georgia", "Noto Serif SC"') && fcRes.css.includes('var(--ag-prism-code-font,"Maple Mono", "JetBrains Mono"') && fcRes.css.includes('font-variant-ligatures:var(--_fvl) !important'));
    assert.equal(head.lastElementChild?.id, customStyleClient.USER_CSS_STYLE_ID);

    fontCustomizer.applyCustomFonts({ ...multiCfg, chatFontCustom: 'Charter' }, doc);
    assert.equal(head.lastElementChild?.id, customStyleClient.USER_CSS_STYLE_ID);

    const r4 = customStyleClient.sync(
      { uiFont: 'default', uiFontCustom: '', chatFont: 'default', chatFontCustom: '', codeFont: 'default', codeFontCustom: '', customCss: 'on' },
      { status: 'active', css: userCss, bytes: userCss.length, blockedImports: 0 }, doc
    );
    assert.deepEqual({ uiFontActive: r4.uiFontActive, customCssActive: r4.customCssActive }, { uiFontActive: false, customCssActive: true });
    const css4 = doc.getElementById(customStyleClient.UI_FONT_STYLE_ID).textContent;
    assert.ok(css4.includes('--font-sans:var(--ag-prism-ui-font,') && css4.includes('var(--ag-prism-chat-font,var(--ag-prism-ui-font,var(--font-sans)))') && css4.includes('--ag-cs-mono-stack:var(--ag-prism-code-font,'));
    assert.equal(head.lastElementChild?.id, customStyleClient.USER_CSS_STYLE_ID);

    customStyleClient.destroy(doc);
    fontCustomizer.dispose(doc);
    assert.equal(doc.getElementById(customStyleClient.UI_FONT_STYLE_ID), null);
    assert.equal(doc.getElementById(customStyleClient.USER_CSS_STYLE_ID), null);
  } finally {
    if (prevCs === undefined) delete globalThis.__agPrismCustomStyle; else globalThis.__agPrismCustomStyle = prevCs;
    if (prevFc === undefined) delete globalThis.__agPrismFontCustomizer; else globalThis.__agPrismFontCustomizer = prevFc;
  }
});

test('Ch9 custom-style-settings-ui: 0 innerHTML, 3-tier picker takeover, single-button custom.css & 0 leaked timers on dispose', () => {
  for (const name of ['custom-style-i18n.js', 'custom-style-client.js', 'font-picker-ui.js', 'custom-style-settings-ui.js']) {
    const fp = path.join(ROOT, 'vendor', 'custom-style', name);
    assertFileHygiene([fp]);
    const clean = stripJsComments(fs.readFileSync(fp, 'utf8'));
    assert.equal(/\.\s*(?:innerHTML|outerHTML)\s*[+]?=|\.\s*insertAdjacentHTML\s*\(|:has\(|\bsetInterval\s*\(/.test(clean), false, name);
  }
  const { doc, head, body, getInnerHtmlWrites } = createDomWithTraps({ 'data-ag-cs-style': '1', 'data-ag-cs-lang': 'en' });
  const sec = doc.createElement('div');
  sec.id = 'ag-cs-settings-sec'; sec.setAttribute('data-body-built', '1'); sec.setAttribute('data-ag-cs-lang', 'en');
  const groupBody = doc.createElement('div');
  const rows = {};
  for (const r of ['chatFont', 'codeFont', 'codeLigatures']) {
    rows[r] = doc.createElement('div'); rows[r].setAttribute('data-ag-cs-row', r);
    const inner = doc.createElement('div'); inner.className = 'py-2';
    const ctrl = doc.createElement('div'); ctrl.className = 'shrink-0';
    inner.appendChild(ctrl); rows[r].appendChild(inner); groupBody.appendChild(rows[r]);
  }
  sec.appendChild(groupBody); body.appendChild(sec);

  const rpcPayloads = [];
  const fakeWin = {
    document: doc, innerWidth: 1280, innerHeight: 800,
    __agPrismSetting: (raw) => rpcPayloads.push(JSON.parse(raw)),
    __agPrismCustomStyle: customStyleClient, __agPrismCustomStyleI18n: customStyleI18n,
    __agPrismFontPickerUi: fontPickerUi, __agPrismFontCustomizer: fontCustomizer,
  };
  doc.defaultView = fakeWin;
  const origSetTimeout = globalThis.setTimeout, origClearTimeout = globalThis.clearTimeout, origSetInterval = globalThis.setInterval;
  let intervalCalls = 0; const liveTimers = new Set();
  globalThis.setInterval = (...a) => { intervalCalls += 1; return origSetInterval(...a); };
  globalThis.setTimeout = (fn, ms, ...r) => { const id = origSetTimeout((...a) => { liveTimers.delete(id); return fn(...a); }, ms, ...r); liveTimers.add(id); return id; };
  globalThis.clearTimeout = (id) => { liveTimers.delete(id); return origClearTimeout(id); };

  try {
    customStyleClient.sync({ uiFont: 'default', uiFontCustom: '', customCss: 'on' }, { status: 'active', css: ':root { --ag-prism-ui-font: "Inter"; }\n', bytes: 2048, blockedImports: 1 }, doc);
    customStyleSettingsUi.install(doc, fakeWin);
    assert.equal(intervalCalls, 0); assert.equal(liveTimers.size, 0);

    let baseSyncCalls = 0;
    const origSync = () => { baseSyncCalls += 1; return true; };
    const mockBeta4 = { sync: origSync };
    fakeWin.__agPrismSettingsExtBeta4 = mockBeta4;
    assert.equal(mockBeta4.__agCustomStyleHooked, true);

    const uiRow = sec.querySelector('[data-ag-cs-row="uiFont"]');
    const cssRow = sec.querySelector('[data-ag-cs-row="customCss"]');
    assert.ok(uiRow && cssRow && groupBody.children.indexOf(uiRow) < groupBody.children.indexOf(rows.chatFont) && groupBody.children.indexOf(cssRow) > groupBody.children.indexOf(rows.codeLigatures));
    assert.equal(head.lastElementChild?.id, customStyleClient.USER_CSS_STYLE_ID);
    assert.equal(getInnerHtmlWrites(), 0);

    const uiTrigger = uiRow.querySelector('button.agy-select-trigger[data-ag-cs-fp-trigger="ui"]');
    const chatTrigger = rows.chatFont.querySelector('button.agy-select-trigger[data-ag-cs-fp-trigger="chat"]');
    const codeTrigger = rows.codeFont.querySelector('button.agy-select-trigger[data-ag-cs-fp-trigger="code"]');
    assert.ok(uiTrigger && chatTrigger && codeTrigger);
    assert.equal(rows.chatFont.getAttribute('data-ag-cs-fp-enhanced'), '1');
    assert.equal(rows.codeFont.getAttribute('data-ag-cs-fp-enhanced'), '1');
    assert.equal(rows.codeLigatures.hasAttribute('data-ag-cs-fp-enhanced') || Boolean(rows.codeLigatures.querySelector('.agy-select-trigger')), false);

    const statusEl = cssRow.querySelector('[data-ag-cs-css-status="1"]');
    assert.equal(statusEl.getAttribute('data-tone'), 'warn');
    assert.ok(statusEl.textContent.includes('2.0 KB') && statusEl.textContent.includes('1'));
    assert.equal(cssRow.querySelector('button[data-ag-cs-ext-action="reload-custom-css"]'), null);
    assert.equal(cssRow.querySelectorAll('.ag-cs-css-actions button').length, 1);
    const actionBtn = cssRow.querySelector('.ag-cs-css-actions button');
    assert.equal(actionBtn.getAttribute('data-ag-cs-ext-action'), 'open-custom-css');
    actionBtn.click();
    assert.deepEqual(rpcPayloads.at(-1), { action: 'custom-css-open' });

    customStyleSettingsUi.syncIfPresent(doc, fakeWin, { uiFont: 'harmony', customCss: 'off' });
    assert.equal(uiTrigger.getAttribute('data-ag-fp-mode'), 'harmony');
    assert.ok(statusEl.textContent.toLowerCase().includes('disabled'));

    uiTrigger.click();
    const portal = body.querySelector('.agy-overlay[data-ag-cs-font-picker-portal="1"]');
    assert.equal(portal?.querySelector('.agy-overlay-item[data-ag-fp-val="harmony"]')?.getAttribute('data-selected'), 'true');
    const searchInp = portal.querySelector('input[data-ag-fp-search="ui"]');
    searchInp.value = 'MiSans, Inter'; searchInp.dispatchEvent({ type: 'input' });
    portal.dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.deepEqual(rpcPayloads.at(-1), { action: 'patch-batch', entries: { uiFont: 'custom', uiFontCustom: 'MiSans, Inter' } });
    assert.ok(cdp.validateConfigEntry('uiFont', 'custom') && cdp.validateConfigEntry('uiFontCustom', 'MiSans, Inter'));

    uiTrigger.click();
    body.querySelector('button[data-ag-fp-reset="ui"]').click();
    assert.deepEqual(rpcPayloads.at(-1), { action: 'patch-batch', entries: { uiFont: 'default', uiFontCustom: '' } });

    cssRow.querySelector('button[data-ag-cs-ext-role="off"]').click();
    assert.deepEqual(rpcPayloads.at(-1), { key: 'customCss', value: 'off' });
    assert.equal(cdp.validateConfigEntry('customCss', 'off'), true);

    customStyleSettingsUi.syncIfPresent(doc, fakeWin, { customCss: 'on' }, { status: 'missing', bytes: 0, blockedImports: 0 });
    assert.equal(actionBtn.getAttribute('data-ag-cs-ext-action'), 'create-custom-css-template');
    actionBtn.click();
    assert.deepEqual(rpcPayloads.at(-1), { action: 'custom-css-create-template' });
    assert.equal(actionBtn.getAttribute('data-ag-cs-ext-action'), 'open-custom-css');

    customStyleSettingsUi.syncIfPresent(doc, fakeWin, { customCss: 'on' }, { status: 'rejected-symlink', bytes: 0, blockedImports: 0 });
    assert.equal(actionBtn.disabled, true); assert.equal(actionBtn.getAttribute('aria-disabled'), 'true');
    const beforeBlocked = rpcPayloads.length;
    actionBtn.click(); actionBtn.dispatchEvent({ type: 'click' });
    assert.equal(rpcPayloads.length, beforeBlocked);

    uiTrigger.click(); fontPickerUi.closeActiveMenu();
    assert.ok(liveTimers.size >= 1);
    customStyleSettingsUi.dispose(doc);
    assert.equal(liveTimers.size, 0, 'dispose() must leak 0 timers');
    assert.equal(intervalCalls, 0);
    assert.equal(doc.getElementById(customStyleSettingsUi.UI_STYLE_ID), null);
    assert.equal(doc.getElementById(fontPickerUi.PICKER_STYLE_ID), null);
    assert.equal(body.querySelector('[data-ag-cs-font-picker-portal="1"]'), null);
    assert.equal(sec.querySelector('[data-ag-cs-custom-style-owned="1"]'), null);
    assert.equal(rows.chatFont.hasAttribute('data-ag-cs-fp-enhanced'), false);
    assert.equal(mockBeta4.sync, origSync); assert.equal(mockBeta4.__agCustomStyleHooked, undefined);
    assert.equal(typeof Object.getOwnPropertyDescriptor(fakeWin, '__agPrismSettingsExtBeta4').get, 'undefined');
    assert.equal(getInnerHtmlWrites(), 0);
    mockBeta4.sync(); assert.equal(baseSyncCalls, 1);
  } finally {
    customStyleSettingsUi.dispose(doc); customStyleClient.destroy(doc);
    globalThis.setTimeout = origSetTimeout; globalThis.clearTimeout = origClearTimeout; globalThis.setInterval = origSetInterval;
  }
});

test('custom-style-i18n.js: all 9 canonical locales complete, identical keysets, 0 CJK in non-CJK, 0 yue', () => {
  assert.deepEqual([...customStyleI18n.LOCALES], CANONICAL_9_LOCALES);
  assert.equal(customStyleI18n.LOCALES.includes('yue'), false);
  const tableKeys = Object.keys(customStyleI18n.TABLE).sort();
  assert.ok(tableKeys.length >= 16);
  for (const k of tableKeys) assert.equal(customStyleI18n.TABLE[k].length, 9);

  for (const loc of CANONICAL_9_LOCALES) {
    const dict = customStyleI18n.getStrings(loc);
    assert.deepEqual(Object.keys(dict).sort(), tableKeys);
    for (const k of tableKeys) {
      assert.ok(typeof dict[k] === 'string' && dict[k].trim().length > 0, `Empty ${loc}.${k}`);
      assert.equal(FORBIDDEN_TERM_RE.test(dict[k]), false, `Forbidden term in ${loc}.${k}`);
      if (NON_CJK_LOCALES.includes(loc)) assert.equal(CJK_RE.test(dict[k]), false, `CJK in ${loc}.${k}`);
    }
  }
  for (const [raw, norm] of [
    ['yue', 'zh-CN'], ['yue-HK', 'zh-CN'], ['zh-yue', 'zh-CN'], ['cantonese', 'zh-CN'],
    ['zh-HK', 'zh-TW'], ['zh-hk-Hant', 'zh-TW'], ['tr-TR', 'tr'], ['auto', 'en'],
  ]) {
    assert.equal(customStyleI18n.normalizeLocale(raw), norm);
  }
});

test('Daemon hot-reload & RPC: create-template (non-overwriting), custom-css-reload, and watched custom.css rebuilds Ch18 with 0 Ch1 rebuilds', async () => {
  const tmpDir = mkTempDir('prism-daemon-custom-css-');
  const tmpCdpPath = path.join(tmpDir, 'cdp.js');
  let daemon = null;

  try {
    fs.cpSync(path.join(ROOT, 'vendor', 'custom-style'), path.join(tmpDir, 'vendor', 'custom-style'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ ...cdp.DEFAULT_CONFIG, customCss: 'on', uiFont: 'default' }, null, 2) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      tmpCdpPath,
      [
        "'use strict';",
        `const r = require(${JSON.stringify(path.join(ROOT, 'cdp.js'))});`,
        `const { createConfigStore } = require(${JSON.stringify(path.join(ROOT, 'src', 'config', 'store.cjs'))});`,
        `const { createCustomStyleChannelBuilders } = require(${JSON.stringify(path.join(ROOT, 'src', 'channels', 'builders-custom-style.cjs'))});`,
        'const st = createConfigStore({ rootDir: __dirname }), mem = new Map();',
        'const cs = createCustomStyleChannelBuilders({ rootDir: __dirname, readConfig: st.readConfig, bundleCache: { getChannelMemCache: (k) => mem.get(k) || null, resolveChannelAssetsWithDiskCache: ({ channelName, sig, compileFn }) => { const v = { sig, ...compileFn() }; mem.set(channelName, v); return v; } } });',
        'let ch1Builds = 0, ch18Builds = 0;',
        'const buildCs = (...a) => { ch18Builds += 1; return cs.buildCustomStyleChannelExpression(...a); };',
        "module.exports = { ...r, CONFIG_PATH: st.CONFIG_PATH, readConfig: st.readConfig, writeConfig: st.writeConfig, invalidateConfigCache: st.invalidateConfigCache, shouldEnableCustomStyle: cs.shouldEnableCustomStyle, buildCustomStyleChannelExpression: buildCs, buildInjectExpression: (...a) => { ch1Builds += 1; return r.buildInjectExpression(...a); }, findChannel: (id) => { const b = r.findChannel(id); return id === 'customStyle' && b ? Object.freeze({ ...b, shouldEnable: cs.shouldEnableCustomStyle, build: buildCs }) : b; }, __getCounters: () => ({ ch1Builds, ch18Builds }) };",
      ].join('\n'),
      'utf8'
    );

    const openedPaths = [];
    daemon = new PrismDaemon({
      rootDir: tmpDir, bundleCachePath: false, portFile: path.join(tmpDir, 'nonexistent.port'),
      pollIntervalMs: 60000, enableAutoUpdateTimer: false, enableStorageGuardTimer: false, silent: true,
      openExternalFile: (fp) => { openedPaths.push(fp); return true; },
    });
    daemon.tick = async () => ({ attached: daemon.sessionRegistry.sessions.size });

    let nextScriptId = 1;
    const evalExprs = [];
    const addedScripts = [];
    const mockEntry = {
      wsUrl: 'ws://127.0.0.1:9222/page/custom-css-test',
      pageId: 'page-custom-css',
      mainFrameId: 'F-MAIN',
      contextFrames: new Map([[1, { frameId: 'F-MAIN', isDefault: true, type: 'default', docGen: 0 }]]),
      session: {
        closed: false,
        async send(method, params) {
          if (method === 'Page.addScriptToEvaluateOnNewDocument') {
            const id = `cs-script-${nextScriptId++}`;
            addedScripts.push({ id, source: params.source });
            return { identifier: id };
          }
          return method === 'Page.removeScriptToEvaluateOnNewDocument' ? {} : { result: { value: { ok: true } } };
        },
        async evaluate(expr) {
          evalExprs.push(expr);
          return { ok: true, status: 'mounted', codeHash: extractTargetHash(expr) };
        },
      },
    };
    daemon.sessionRegistry.sessions.set(mockEntry.wsUrl, mockEntry);

    daemon.start({ claimPid: false, watchFiles: true });
    const counters = () => daemon.channelOrchestrator.getCdp().__getCounters();
    const ch1Baseline = counters().ch1Builds;
    const customCssPath = path.join(tmpDir, 'custom.css');

    const sendRpc = (action) => daemon.handleBindingCall(mockEntry, { name: cdp.SETTING_BINDING, payload: JSON.stringify({ action }), executionContextId: 1 });
    const createRes = await sendRpc('custom-css-create-template');
    assert.equal(createRes?.ok, true);
    assert.equal(createRes?.opened, true);
    assert.equal(openedPaths.length, 1);
    assert.equal(openedPaths[0], fs.realpathSync(customCssPath));
    assert.equal(fs.readFileSync(customCssPath, 'utf8'), customCssLoader.DEFAULT_CUSTOM_CSS_TEMPLATE);
    assert.equal(counters().ch1Builds, ch1Baseline);
    assert.ok(evalExprs.length >= 1 && addedScripts.length >= 1);

    const userV1 = '/* user-preserved-v1 */\n:root { --ag-prism-ui-font: "Inter", sans-serif; }\n';
    fs.writeFileSync(customCssPath, userV1, 'utf8');
    await sendRpc('custom-css-create-template');
    assert.equal(fs.readFileSync(customCssPath, 'utf8'), userV1);
    assert.equal(counters().ch1Builds, ch1Baseline);

    const openRes = await sendRpc('custom-css-open');
    assert.equal(openRes?.ok, true);
    assert.equal(openRes?.status, 'active');
    assert.equal(openedPaths.at(-1), fs.realpathSync(customCssPath));

    fs.writeFileSync(customCssPath, '/* rpc-reload-v2 */\n:root { --ag-prism-chat-font: "Georgia", serif; }\n', 'utf8');
    const evalsBeforeReload = evalExprs.length;
    await sendRpc('custom-css-reload');
    assert.ok(evalExprs.length > evalsBeforeReload && evalExprs.at(-1).includes('rpc-reload-v2'));
    assert.equal(counters().ch1Builds, ch1Baseline);

    // 4) Watched custom.css change triggers fs.watch -> Ch18 rebuild only (0 Ch1 rebuilds)
    const hashBeforeWatch = daemon.channelOrchestrator.getChannelHash('customStyle');
    const evalsBeforeWatch = evalExprs.length;
    fs.writeFileSync(customCssPath, '/* watched-hot-reload-v3 */\n:root { --ag-prism-code-font: "Maple Mono", monospace; }\n', 'utf8');
    const hotReloaded = await waitUntil(
      () =>
        daemon.channelOrchestrator.getChannelHash('customStyle') !== hashBeforeWatch &&
        evalExprs.length > evalsBeforeWatch &&
        evalExprs.at(-1).includes('watched-hot-reload-v3')
    );
    assert.equal(hotReloaded, true, 'fs.watch on custom.css must hot-reload Ch18');
    assert.ok(daemon.channelOrchestrator.getChannelExpr('customStyle').includes('watched-hot-reload-v3'));
    assert.equal(counters().ch1Builds, ch1Baseline);
  } finally {
    if (daemon) await daemon.stop(false, { skipAutoArchive: true });
    delete require.cache[tmpCdpPath];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
