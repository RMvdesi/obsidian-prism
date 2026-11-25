import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import * as arch from '../sidecars/daemon/conversation-archive.mjs';
import { PrismDaemon } from '../sidecars/daemon/main.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));
const i18nCore = require(path.join(ROOT, 'i18n-core.js'));

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeSizedFile(filePath, bytes, mtimeMs) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.alloc(bytes, 0x61));
  if (Number.isFinite(mtimeMs)) {
    const t = mtimeMs / 1000;
    fs.utimesSync(filePath, t, t);
  }
}

test('conversation-archive: topConsumers sorts by size, redacts secrets, and formats 5-language detail report', () => {
  const tmpRoot = makeTempDir('ag-prism-wb-scan-');
  try {
    const convDir = path.join(tmpRoot, 'conversations');
    const archiveDir = path.join(tmpRoot, 'archive');
    const now = Date.parse('2026-11-25T08:00:00Z');
    const idMainOld = '11111111-1111-4111-8111-111111111111';
    const idSubBig = '22222222-2222-4222-8222-222222222222';
    const idUnknown = '33333333-3333-4333-8333-333333333333';

    writeSizedFile(path.join(convDir, `${idSubBig}.db`), 3 * 1024 * 1024, now - 5 * 3600000);
    writeSizedFile(path.join(convDir, `${idSubBig}.db-wal`), 512 * 1024, now - 5 * 3600000);
    writeSizedFile(path.join(convDir, `${idMainOld}.db`), 2 * 1024 * 1024, now - 20 * 86400000);
    writeSizedFile(path.join(convDir, `${idUnknown}.db`), 1 * 1024 * 1024, now - 2 * 86400000);

    const summaries = {
      [idSubBig]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 18,
        summary: 'Subagent token sk-secret1234567890abcd and Bearer tok_xyz1234567890',
        lastModifiedTime: new Date(now - 5 * 3600000).toISOString(),
        trajectoryMetadata: { parentConversationId: idMainOld },
      },
      [idMainOld]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 40,
        summary: 'Legacy Main Session',
        lastModifiedTime: new Date(now - 20 * 86400000).toISOString(),
      },
    };

    const scan = arch.scanConversationStorage({
      convDir,
      archiveDir,
      summaries,
      subagentMaxAgeHours: 1,
      mainMaxAgeDays: 14,
      keepRecentMain: 0,
      now,
    });

    assert.equal(scan.topConsumers.length, 3);
    assert.equal(scan.topConsumers[0].id, idSubBig);
    assert.equal(scan.topConsumers[0].kind, 'subagent');
    assert.equal(scan.topConsumers[0].title.includes('sk-secret'), false, 'API keys must be redacted from topConsumers title');
    assert.equal(scan.topConsumers[0].title.includes('tok_xyz'), false, 'Bearer tokens must be redacted from topConsumers title');
    assert.ok(scan.topConsumers[0].title.includes('[REDACTED]'));
    assert.equal(scan.topConsumers[1].id, idMainOld);
    assert.equal(scan.topConsumers[2].id, idUnknown);
    assert.equal(scan.archivableOldMainCount, 1);

    for (const lang of ['zh-CN', 'zh-TW', 'yue', 'en', 'ja']) {
      const labels = arch.getStorageWorkbenchLabels(lang);
      assert.ok(labels.summary && labels.archiveOldMain && labels.restoreBtn && labels.refreshBtn);
      const txt = arch.formatStorageDetailReport({ ...scan, batches: [] }, lang);
      assert.ok(txt.includes('Legacy Main Session'), `Detail report for ${lang} should include top consumer title`);
      assert.ok(txt.includes(labels.topTitle), `Detail report for ${lang} should include localized heading`);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('conversation-archive: validateBatchSelector & writeHelperScripts support old-main mode, per-batch restore, and reject injection', () => {
  assert.equal(arch.validateBatchSelector('latest'), 'latest');
  assert.equal(arch.validateBatchSelector('batch-2026-11-25T08-00-00-deadbeef'), 'batch-2026-11-25T08-00-00-deadbeef');
  assert.throws(() => arch.validateBatchSelector('../evil'));
  assert.throws(() => arch.validateBatchSelector('batch-1; rm -rf /'));
  assert.throws(() => arch.validateBatchSelector('batch-1 && echo hi'));

  const tmpRoot = makeTempDir('ag-prism-wb-scripts-');
  try {
    const archiveDir = path.join(tmpRoot, 'archive');
    const scriptPath = path.join(ROOT, 'sidecars', 'daemon', 'conversation-archive.mjs');
    const batchId = 'batch-2026-11-25T08-00-00-a1b2c3d4';

    const helpers = arch.writeHelperScripts({
      scriptPath,
      archiveDir,
      mode: 'subagents+old-main',
      mainDays: 14,
      keepRecentMain: 20,
      restoreBatch: batchId,
    });

    assert.equal(helpers.mode, 'subagents+old-main');
    assert.equal(helpers.restoreBatch, batchId);
    const archScript = fs.readFileSync(helpers.archiveScriptPath, 'utf8');
    const restScript = fs.readFileSync(helpers.restoreScriptPath, 'utf8');
    assert.ok(archScript.includes('--include-old-main'), 'Old-main mode must include --include-old-main flag');
    assert.ok(archScript.includes('--main-days=14') && archScript.includes('--keep-main=20'));
    assert.ok(restScript.includes(`--restore ${batchId} --wait-exit`), 'Restore helper must target chosen batch with --wait-exit');
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(helpers.archiveScriptPath).mode & 0o777, 0o700);
      assert.equal(fs.statSync(helpers.restoreScriptPath).mode & 0o777, 0o700);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('PrismDaemon: storage-detail, prepare-archive(old-main), prepare-restore(batch), and RPC path isolation', async () => {
  const tmpRoot = makeTempDir('ag-prism-wb-daemon-');
  try {
    const convDir = path.join(tmpRoot, 'conversations');
    const archiveDir = path.join(tmpRoot, 'archive');
    const now = Date.parse('2026-11-25T09:00:00Z');
    const subId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const mainId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    writeSizedFile(path.join(convDir, `${subId}.db`), 2 * 1024 * 1024, now - 4 * 3600000);
    writeSizedFile(path.join(convDir, `${mainId}.db`), 3 * 1024 * 1024, now - 30 * 86400000);

    const summaries = {
      [subId]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 5,
        summary: 'Hidden Subagent',
        lastModifiedTime: new Date(now - 4 * 3600000).toISOString(),
        trajectoryMetadata: { parentConversationId: mainId },
      },
      [mainId]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 12,
        summary: 'Old Main Conversation',
        lastModifiedTime: new Date(now - 30 * 86400000).toISOString(),
      },
    };
    arch.saveCatalogIndex(archiveDir, summaries);

    // Create a real archived batch via archiveConversations (with checkRunning: () => false)
    const archived = arch.archiveConversations({
      convDir,
      archiveDir,
      summaries,
      mode: 'subagents',
      subagentMaxAgeHours: 1,
      now,
      checkRunning: () => false,
    });
    assert.equal(archived.ok, true);
    assert.equal(archived.movedCount, 1);

    const daemon = Object.create(PrismDaemon.prototype);
    daemon.rootDir = ROOT;
    daemon._storageHealthCache = null;
    daemon._storageHealthAt = 0;
    daemon._telemetryInFlight = 0;
    daemon._lastTelemetryActivityAt = 0;
    daemon._lazyStore = { client: { reader: { summaries } } };
    daemon.ensureLsClient = async () => ({ call: async () => ({ trajectorySummaries: summaries }) });

    // 1) storage-detail returns topConsumers, batches, and 5-lang formatted detailText
    const detail = await daemon._handleStorageAction('storage-detail', { convDir, archiveDir, now }, { lang: 'en' });
    assert.equal(detail.ok, true);
    assert.equal(detail.batches.length, 1);
    assert.equal(detail.batches[0].batchName, archived.batchName);
    assert.equal(detail.topConsumers[0].id, mainId);
    assert.ok(detail.detailText.includes(archived.batchName));
    assert.ok(detail.detailText.includes('Old Main Conversation'));
    assert.equal(daemon._storageHealthCache, null, 'storage-detail must not clobber storage-health cache');

    // 2) prepare-archive with mode='subagents+old-main' writes old-main script
    const prepOld = await daemon._handleStorageAction(
      'prepare-archive',
      { convDir, archiveDir, now },
      { lang: 'zh-CN', mode: 'subagents+old-main' }
    );
    assert.equal(prepOld.ok, true);
    assert.equal(prepOld.mode, 'subagents+old-main');
    assert.ok(fs.readFileSync(prepOld.archiveScriptPath, 'utf8').includes('--include-old-main'));

    // 3) prepare-restore for existing batch succeeds; missing or malicious batch fails closed
    const prepRes = await daemon._handleStorageAction(
      'prepare-restore',
      { convDir, archiveDir, now },
      { lang: 'zh-CN', batchName: archived.batchName }
    );
    assert.equal(prepRes.ok, true);
    assert.equal(prepRes.batchName, archived.batchName);
    assert.ok(fs.readFileSync(prepRes.restoreScriptPath, 'utf8').includes(`--restore ${archived.batchName} --wait-exit`));

    const missingRes = await daemon._handleStorageAction(
      'prepare-restore',
      { convDir, archiveDir, now },
      { batchName: 'batch-2099-01-01T00-00-00-00000000' }
    );
    assert.equal(missingRes.ok, false);
    assert.equal(missingRes.error, 'batch_not_found');

    const badRes = await daemon._handleStorageAction(
      'prepare-restore',
      { convDir, archiveDir, now },
      { batchName: '../escape;id' }
    );
    assert.equal(badRes.ok, false);
    assert.ok(/Invalid archive batch/i.test(badRes.error));

    // 4) Untrusted rpcOpts cannot inject convDir/archiveDir via executeRepoAction
    let capturedOverrides = 'unset';
    daemon._handleStorageAction = async (act, ov, opts) => {
      capturedOverrides = ov;
      return { ok: true, act, opts };
    };
    await daemon.executeRepoAction({ action: 'storage-detail', convDir: '/etc', archiveDir: '/tmp/evil', lang: 'en' });
    assert.equal(capturedOverrides, null, 'executeRepoAction must never pass renderer rawInput as _testOverrides');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('settings-panel: About sheet Storage Workbench drawer lazy-loads storage-detail, prepares old-main archive, restores selected batch, and keeps Channel 1 < 685,000 B', async () => {
  const bytes = Buffer.byteLength(cdp.buildInjectExpression(cdp.DEFAULT_CONFIG), 'utf8');
  assert.ok(bytes < 685000, `Channel 1 DEFAULT_CONFIG bundle must stay < 685,000 B, got ${bytes} B`);
  assert.ok(fs.statSync(path.join(ROOT, 'pulse-vial-bridge.js')).size < 31000, 'pulse-vial-bridge.js must stay < 31,000 B');

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevStorage = globalThis.localStorage;

  const matches = (n, selList) =>
    selList.split(',').some((raw) => {
      const s = raw.trim();
      if (!s) return false;
      if (s.startsWith('#')) return n.id === s.slice(1);
      let rest = s;
      const tm = rest.match(/^[a-zA-Z0-9-]+/);
      if (tm) {
        if (n.tagName !== tm[0].toUpperCase()) return false;
        rest = rest.slice(tm[0].length);
      }
      for (const m of rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        if (!n.classList.contains(m[1])) return false;
      }
      for (const m of rest.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
        if (!n.hasAttribute(m[1])) return false;
        if (m[2] !== undefined && n.getAttribute(m[1]) !== m[2]) return false;
      }
      return true;
    });

  const makeEl = (tag, doc) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      id: '',
      innerHTML: '',
      ownerDocument: doc,
      parentElement: null,
      parentNode: null,
      children: [],
      hidden: false,
      disabled: false,
      open: false,
      value: '',
      className: '',
      _text: '',
      style: { setProperty() {}, removeProperty() {} },
      classList: {
        add(c) { if (!el.className.split(/\s+/).includes(c)) el.className = `${el.className} ${c}`.trim(); },
        remove(c) { el.className = el.className.split(/\s+/).filter((x) => x !== c).join(' '); },
        contains(c) { return el.className.split(/\s+/).includes(c); },
      },
      get isConnected() {
        let p = el;
        while (p) { if (p === doc.documentElement) return true; p = p.parentElement; }
        return false;
      },
      get textContent() {
        return el.children.length ? el._text + el.children.map((c) => c.textContent).join('') : el._text;
      },
      set textContent(v) {
        el._text = String(v ?? '');
        el.children.length = 0;
      },
      get firstChild() { return el.children[0] || null; },
      setAttribute(k, v) {
        attrs.set(k, String(v));
        if (k === 'id') el.id = String(v);
        if (k === 'hidden') el.hidden = true;
      },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) {
        attrs.delete(k);
        if (k === 'hidden') el.hidden = false;
      },
      toggleAttribute(k, f) {
        const on = f === undefined ? !attrs.has(k) : Boolean(f);
        if (on) attrs.set(k, '');
        else attrs.delete(k);
        return on;
      },
      appendChild(c) {
        c.parentElement = el;
        c.parentNode = el;
        el.children.push(c);
        if (el.tagName === 'SELECT' && c.tagName === 'OPTION' && !el.value) el.value = c.value;
        return c;
      },
      removeChild(c) {
        el.children = el.children.filter((x) => x !== c);
        c.parentElement = null;
        c.parentNode = null;
        return c;
      },
      remove() {
        if (el.parentElement) el.parentElement.removeChild(el);
      },
      closest(sel) {
        let cur = el;
        while (cur) { if (matches(cur, sel)) return cur; cur = cur.parentElement; }
        return null;
      },
      addEventListener(ev, fn) {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      removeEventListener() {},
      dispatchEvent(ev) {
        for (const fn of listeners.get(ev.type) || []) fn(ev);
      },
      click() {
        if (el.disabled) return;
        for (const fn of listeners.get('click') || []) fn({ preventDefault() {}, stopPropagation() {} });
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children || []) {
            if (matches(c, sel)) out.push(c);
            walk(c);
          }
        };
        walk(el);
        return out;
      },
    };
    return el;
  };

  const doc = {
    body: null,
    head: null,
    documentElement: null,
    createElement(tag) { return makeEl(tag, doc); },
    getElementById(id) { return doc.documentElement.querySelector('#' + id); },
    querySelectorAll(s) { return doc.documentElement.querySelectorAll(s); },
    querySelector(s) { return doc.documentElement.querySelector(s); },
  };
  doc.documentElement = makeEl('html', doc);
  doc.head = makeEl('head', doc);
  doc.body = makeEl('body', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  const storeMap = new Map([['ag-prism:settings-open', '1'], ['ag-prism:settings-subtab', 'about']]);
  const storage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k),
  };

  const dialog = makeEl('div', doc);
  dialog.setAttribute('role', 'dialog');
  const panel = makeEl('div', doc);
  const h2 = makeEl('h2', doc);
  h2.textContent = 'Appearance';
  const anchor = makeEl('div', doc);
  anchor.className = 'space-y-2';
  panel.appendChild(h2);
  panel.appendChild(anchor);
  dialog.appendChild(panel);
  doc.body.appendChild(dialog);

  const calls = [];
  const win = {
    document: doc,
    localStorage: storage,
    __agPrismRepoBridge: (payload) => {
      calls.push(payload);
      if (payload.action === 'storage-health') {
        return { ok: true, totalMb: 1200, mainCount: 25, subagentCount: 40, subagentMb: 600, warn: true };
      }
      if (payload.action === 'storage-detail') {
        const L = arch.getStorageWorkbenchLabels(payload.lang || 'zh-CN');
        return {
          ok: true,
          detailText: 'Breakdown: 1.17 GB\nTop 1: Old Main',
          labels: L,
          wbL: [L.summary, L.archiveOldMain, L.restoreBtn, L.refreshBtn],
          batches: [{ batchName: 'batch-2026-11-25T08-00-00-a1b2c3d4', movedCount: 8, movedMb: 320 }],
          wbB: [['batch-2026-11-25T08-00-00-a1b2c3d4', 'batch-2026-11-25T08-00-00-a1b2c3d4 (8/320 MB)']],
        };
      }
      if (payload.action === 'prepare-archive') {
        return {
          ok: true,
          mode: payload.oldMain ? 'subagents+old-main' : payload.mode || 'subagents',
          archivableSubagentCount: 10,
          archivableSubagentMb: 200,
          archivableOldMainCount: 5,
          archivableOldMainMb: 300,
          archiveScriptPath: '/tmp/archive-subagents.command',
        };
      }
      if (payload.action === 'prepare-restore') {
        const L = arch.getStorageWorkbenchLabels(payload.lang || 'zh-CN');
        return {
          ok: true,
          batchName: payload.batchName,
          restoreScriptPath: '/tmp/restore-latest-archive.command',
          chipText: L.restoreReadyTpl.replace('{0}', payload.batchName).replace('{1}', '/tmp/restore-latest-archive.command'),
          clipPath: '/tmp/restore-latest-archive.command',
          labels: L,
          wbL: [L.summary, L.archiveOldMain, L.restoreBtn, L.refreshBtn],
        };
      }
      return { ok: true, noRemote: true, branch: 'local' };
    },
  };

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = storage;

  const state = settingsPanel.getDefaultSettingsPatch();
  try {
    settingsPanel.mountOrSyncSettingsSection({
      version: '1.0.7',
      getLang: () => state.language,
      uiText: (l) => i18nLocales.getUiStrings(l),
      isZh: () => true,
      i18nCore,
      formatSettingsSummary: () => 'summary',
      resolveSettingRowActiveValue: (k) => state[k],
      isSettingButtonMatch: (_k, valJson, cur) => JSON.parse(valJson) === cur,
      saveSetting: (k, v) => { state[k] = v; },
      saveSettingsBatch: (p) => Object.assign(state, p),
      getThoughtTranslateMode: () => state.thoughtTranslate,
      handledGroupClicks: new WeakSet(),
      runSettingsGroupGlide: () => {},
      runGuardedMut: (fn) => fn(),
    });
    await new Promise((r) => setTimeout(r, 15));

    // Must NOT call storage-detail while drawer is collapsed
    assert.equal(calls.some((c) => c.action === 'storage-detail'), false, 'storage-detail must be lazy until drawer expands');

    const sec = doc.getElementById(settingsPanel.SETTINGS_SEC_ID);
    const wb = sec.querySelector('[data-ag-cs-storage-wb="1"]');
    assert.ok(wb, 'Storage workbench details drawer must exist');
    wb.open = true;
    wb.dispatchEvent({ type: 'toggle' });
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(calls.some((c) => c.action === 'storage-detail'), true, 'Expanding drawer must fetch storage-detail');
    const pre = sec.querySelector('[data-ag-cs-storage-detail="1"]');
    assert.ok(pre.textContent.includes('Breakdown: 1.17 GB'));

    const oldBtn = sec.querySelector('[data-ag-cs-storage-old="1"]');
    oldBtn.click();
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(calls.some((c) => c.action === 'prepare-archive' && c.oldMain === true));

    const resBtn = sec.querySelector('[data-ag-cs-storage-res="1"]');
    resBtn.click();
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(calls.some((c) => c.action === 'prepare-restore' && c.batchName === 'batch-2026-11-25T08-00-00-a1b2c3d4'));
    const chip = sec.querySelector('[data-ag-cs-storage-status]');
    assert.equal(chip.getAttribute('data-status'), 'updated');
    assert.ok(chip.textContent.includes('/tmp/restore-latest-archive.command'));
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});
