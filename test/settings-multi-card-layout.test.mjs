import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createSettingsMiniDom } from './helpers/mini-dom.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const i18nExt = require(path.join(ROOT, 'src', 'runtime', 'i18n-ext-beta4.js'));
const settingsExt = require(path.join(ROOT, 'src', 'runtime', 'settings-ext-beta4.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));
const i18nCore = require(path.join(ROOT, 'i18n-core.js'));

test('Settings panel splits Appearance (4 cards) and Workspace (3 cards), hides theme-irrelevant rows, and dims child rows', () => {
  const { doc } = createSettingsMiniDom();
  doc.documentElement.setAttribute('data-ag-cs-theme', 'dark');
  const state = {
    ...settingsPanel.getDefaultSettingsPatch(),
    language: 'zh-CN',
    ambientIntensity: '0',
    motionLevel: 'off',
    sidebarRestyle: false,
  };

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevI18nExt = globalThis.__agPrismI18nExtBeta4;
  const prevSetExt = globalThis.__agPrismSettingsExtBeta4;
  const fakeWin = { document: doc };
  doc.defaultView = fakeWin;
  globalThis.document = doc;
  globalThis.window = fakeWin;
  globalThis.__agPrismI18nExtBeta4 = i18nExt;
  globalThis.__agPrismSettingsExtBeta4 = settingsExt;

  try {
    const syncPanel = () => settingsPanel.mountOrSyncSettingsSection({
      version: '1.0.8-beta.5',
      lazyFold: false,
      getLang: () => state.language,
      uiText: (l) => i18nLocales.getUiStrings(l),
      isZh: () => state.language === 'zh-CN' || state.language === 'zh-TW',
      i18nCore,
      formatSettingsSummary: () => 'summary',
      resolveSettingRowActiveValue: (k) => state[k],
      isSettingButtonMatch: (k, valJson, cur) => JSON.stringify(cur) === valJson,
      saveSetting: (k, v) => { state[k] = v; },
      saveSettingsBatch: (p) => Object.assign(state, p),
      getThoughtTranslateMode: () => 'off',
      handledGroupClicks: new WeakSet(),
      runSettingsGroupGlide: () => {},
      runGuardedMut: (fn) => fn(),
    });

    syncPanel();
    const sec = doc.getElementById('ag-cs-settings-sec');
    assert.ok(sec, 'Settings section must mount');

    // activeSubTab attribute set on section for single-tab heading hiding
    assert.ok(sec.getAttribute('data-ag-cs-active-subtab'), 'applySubTab must set data-ag-cs-active-subtab');

    // Appearance split into 4 cards & Workspace split into 3 cards
    const appGrp = sec.querySelector('[data-ag-cs-group="appearance"]');
    const wsGrp = sec.querySelector('[data-ag-cs-group="interaction"]');
    const appCards = appGrp.querySelectorAll('[data-ag-cs-split-card]');
    const wsCards = wsGrp.querySelectorAll('[data-ag-cs-split-card]');
    assert.equal(appCards.length, 4, 'Appearance should split into 4 sub-cards');
    assert.equal(wsCards.length, 3, 'Workspace should split into 3 sub-cards');

    // Dark theme hides lightPreset; keeps darkAura visible
    const lpRow = sec.querySelector('[data-ag-cs-row="lightPreset"]');
    const daRow = sec.querySelector('[data-ag-cs-row="darkAura"]');
    assert.equal(lpRow.hidden, true, 'lightPreset must hide in dark theme');
    assert.equal(daRow.hidden, false, 'darkAura must remain visible in dark theme');

    // Parent-off dimming: ambientIntensity=0 dims darkAura, motionLevel=off dims targetFps, sidebarRestyle=false dims sidebarCompact
    assert.equal(daRow.getAttribute('data-ag-cs-dimmed'), '1');
    assert.equal(sec.querySelector('[data-ag-cs-row="targetFps"]').getAttribute('data-ag-cs-dimmed'), '1');
    assert.equal(sec.querySelector('[data-ag-cs-row="sidebarCompact"]').getAttribute('data-ag-cs-dimmed'), '1');

    // Switching to light theme flips visibility
    doc.documentElement.setAttribute('data-ag-cs-theme', 'light');
    settingsExt.sync(sec, {
      doc,
      win: fakeWin,
      lang: 'zh-CN',
      ui: i18nLocales.getUiStrings('zh-CN'),
      effVal: (k) => state[k],
      runGuardedMut: (fn) => fn(),
    });
    assert.equal(lpRow.hidden, false, 'lightPreset must show in light theme');
    assert.equal(daRow.hidden, true, 'darkAura must hide in light theme');

    // 9-locale sub-card headers complete with 0 CJK leaks in non-CJK locales
    const cjkRe = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
    for (const key of ['subSecAura', 'subSecEffects', 'subSecMotion', 'subSecLang', 'subSecEditor', 'subSecTypo', 'subSecChrome']) {
      assert.equal(i18nExt.TABLE[key].length, 9);
      for (let i = 2; i < 9; i++) {
        if (i === 3 || i === 4) continue;
        assert.equal(cjkRe.test(i18nExt.TABLE[key][i]), false, `CJK leak in ${key} idx ${i}`);
      }
    }
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.__agPrismI18nExtBeta4 = prevI18nExt;
    globalThis.__agPrismSettingsExtBeta4 = prevSetExt;
  }
});
