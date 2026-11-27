import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkStorageGuardAndNotify } from '../src/daemon/storage-guard-coordinator.mjs';
import { buildStorageGuardBannerExpression } from '../sidecars/daemon/storage-guard-ui.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const i18nExt = require(path.join(ROOT, 'src/runtime/i18n-ext-beta4.js'));

test('storageGuard=off permanently suppresses reminders & banner exposes permanent disable action', async () => {
  const upd = { isRunning: () => true, getCdp: () => ({ readConfig: () => ({ storageGuard: 'off' }) }) };
  const res = await checkStorageGuardAndNotify(upd, { storageGuard: 'off' });
  assert.deepEqual(res, { shown: false, reason: 'disabled' });

  const expr = buildStorageGuardBannerExpression({ copy: { disableGuardBtn: '不再提醒' } });
  assert.ok(expr.includes('disable-guard'), 'Banner must render permanent disable-guard button');
  assert.ok(expr.includes('storage-guard-mode'), 'Banner must persist storageGuard=off cleanly');
});

test('storageGuard schema and 9-locale policy copy are complete with 0 CJK leaks', () => {
  assert.ok(cdp.CONFIG_SCHEMA.storageGuard && settingsPanel.PRISM_SETTINGS_SCHEMA.storageGuard);
  const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
  const keys = ['storageCardTitle', 'setStoragePolicyTitle', 'setStoragePolicyDesc', 'optStorageOff', 'optStorageRemind', 'optStorageAuto', 'storageAdvTitle', 'storageGuardDisableBtn', 'storageGuardDisabledMsg'];
  for (const loc of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'tr']) {
    const s = i18nExt.getStrings(loc);
    for (const k of keys) {
      assert.ok(typeof s[k] === 'string' && s[k].trim().length > 0, `Missing ${k} for ${loc}`);
      if (!['zh-CN', 'zh-TW', 'ja'].includes(loc)) assert.equal(CJK_RE.test(s[k]), false);
    }
  }
});
