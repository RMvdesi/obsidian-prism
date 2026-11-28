// 专项单测：Antigravity 本地权限图标语义色系统（Ch15 permission-icons 4 预设染色、多语兜底、全链路卸载与打包门禁）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createSettingsMiniDom } from './helpers/mini-dom.mjs';
import { collectNativePluginEntries } from '../scripts/build-common.mjs';
import { collectLinuxPortableEntries } from '../scripts/build-linux.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const permIcons = require(path.join(ROOT, 'src', 'runtime', 'permission-icons.js'));
const enhancerMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));
const hostSelectors = require(path.join(ROOT, 'src', 'compat', 'host-selectors.cjs'));
const cdp = require(path.join(ROOT, 'cdp.js'));

function createPermMiniDom() {
  const { doc } = createSettingsMiniDom();
  const { documentElement: html, head, body } = doc;
  body.children.length = 0;
  const make = (tag, attrs = {}) => {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    return el;
  };
  const patchQuery = (root) => {
    const origQsa = root.querySelectorAll.bind(root);
    root.querySelectorAll = (sel) => {
      if (!sel.includes('^=')) return origQsa(sel);
      const out = [];
      const m = /\[([^\]^=]+)\^="([^"]*)"\]/.exec(sel);
      const walk = (n) => {
        for (const c of n.children || []) {
          if (m && String(c.getAttribute?.(m[1]) || '').startsWith(m[2])) out.push(c);
          walk(c);
        }
      };
      walk(root);
      return out;
    };
    return root;
  };
  patchQuery(doc);
  return { doc, html, head, body, make, patchQuery };
}

test('Permission icon colors: shared host-selectors align with permission-icons.js and host-workbench-enhancer.js', () => {
  const s = hostSelectors.HOST_INTERACTION_SELECTORS;
  const permSrc = fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'permission-icons.js'), 'utf8');
  const enhSrc = fs.readFileSync(path.join(ROOT, 'host-workbench-enhancer.js'), 'utf8');
  for (const key of ['permissionsSelectorTrigger', 'permissionsMenu', 'permissionsPresetOption']) {
    const sel = s[key];
    assert.ok(typeof sel === 'string' && sel.length > 0, `HOST_INTERACTION_SELECTORS.${key} must exist`);
    assert.ok(permSrc.includes(sel), `permission-icons.js must use ${key} (${sel})`);
    assert.ok(enhSrc.includes(sel), `host-workbench-enhancer.js must use ${key} (${sel})`);
  }
});

test('Permission icon colors: palette and normalizer strictly cover only the 4 real presets (EN + verified zh-CN/tr)', () => {
  assert.deepEqual(
    Object.keys(permIcons.PERM_PRESET_PALETTE),
    ['request_review', 'default', 'auto', 'turbo'],
    'PERM_PRESET_PALETTE must strictly contain only the 4 real Antigravity local permission presets'
  );

  // English native labels & preset keys
  assert.equal(permIcons.normPermPreset('request_review'), 'request_review');
  assert.equal(permIcons.normPermPreset('Request Review'), 'request_review');
  assert.equal(permIcons.normPermPreset('Default'), 'default');
  assert.equal(permIcons.normPermPreset('Auto'), 'auto');
  assert.equal(permIcons.normPermPreset('Agent permissions preset: Turbo, Permissions cannot be changed'), 'turbo');

  // Verified host-i18n zh-CN labels
  assert.equal(permIcons.normPermPreset('智能体权限预设选择器，当前：请求审查'), 'request_review');
  assert.equal(permIcons.normPermPreset('默认'), 'default');
  assert.equal(permIcons.normPermPreset('自动'), 'auto');
  assert.equal(permIcons.normPermPreset('极速'), 'turbo');

  // Verified host-i18n tr labels (including Turkish dotted uppercase İ -> combining U+0307)
  assert.equal(permIcons.normPermPreset('Ajan izinleri hazır ayar seçici, geçerli: İnceleme İste'), 'request_review');
  assert.equal(permIcons.normPermPreset('Varsayılan'), 'default');
  assert.equal(permIcons.normPermPreset('Otomatik (Önizleme)'), 'auto');
  assert.equal(permIcons.normPermPreset('Turbo'), 'turbo');

  // Unknown / non-preset strings must fail-closed to empty string
  assert.equal(permIcons.normPermPreset('unknown'), '');
  assert.equal(permIcons.normPermPreset('standard'), '');
  assert.equal(permIcons.normPermPreset(''), '');
});

test('Permission icon colors: mounts scoped CSS, proves Fiber priority over aria-label, updates on menu click, and strips all nodes on destroy', () => {
  const { doc, head, body, make, patchQuery } = createPermMiniDom();
  const clickListeners = [];
  let rafQueue = [];
  const win = {
    document: doc,
    __agPrismPermIcons: permIcons,
    addEventListener(type, fn, cap) {
      if (type === 'click' && cap) clickListeners.push(fn);
    },
    removeEventListener() {},
    requestAnimationFrame(cb) {
      rafQueue.push(cb);
      return rafQueue.length;
    },
    cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };

  // 1) Composer trigger: Fiber preset ('turbo') must win even when aria-label has a generic/different text
  const trig = make('button', {
    'data-testid': 'permissions-selector-trigger',
    'aria-label': 'Agent permissions preset selector',
  });
  const trigSvg = make('svg');
  trigSvg.__reactFiber$test = { memoizedProps: { preset: 'turbo' }, return: null };
  trig.appendChild(trigSvg);
  body.appendChild(trig);

  // 2) Permissions dropdown menu with all 4 presets + Use Global Settings (Fiber-only)
  const menu = patchQuery(make('div', { 'data-testid': 'permissions-menu' }));
  const optReview = make('div', { 'data-testid': 'permissions-preset-option-request_review' });
  const optDefault = make('div', { 'data-testid': 'permissions-preset-option-default' });
  const optAuto = make('div', { 'data-testid': 'permissions-preset-option-auto' });
  const optTurbo = make('div', { 'data-testid': 'permissions-preset-option-turbo' });
  optTurbo.__reactFiber$test = { memoizedProps: { selected: true }, return: null };
  const optGlobal = make('div', { 'data-testid': 'permissions-use-global-settings' });
  const globSvg = make('svg');
  globSvg.__reactFiber$test = { memoizedProps: { preset: 'default' }, return: null };
  optGlobal.appendChild(globSvg);
  menu.appendChild(optReview);
  menu.appendChild(optDefault);
  menu.appendChild(optAuto);
  menu.appendChild(optTurbo);
  menu.appendChild(optGlobal);
  body.appendChild(menu);

  const ctl = enhancerMod.createHostEnhancerController({
    doc,
    win,
    getLang: () => 'zh-CN',
  });

  try {
    ctl.sync({ f: true });

    const styleEl = doc.getElementById(permIcons.STYLE_ID);
    assert.ok(styleEl, 'permission-icons must mount its scoped <style> element');
    assert.equal(/:has\(/.test(styleEl.textContent), false, 'permission-icons CSS must have 0 :has()');
    assert.equal(/[^\x09\x0A\x0D\x20-\x7E]/.test(styleEl.textContent), false, 'permission-icons CSS must be 100% ASCII');

    assert.equal(trig.getAttribute('data-ag-perm-preset'), 'turbo', 'Fiber preset must take precedence over generic aria-label');
    assert.equal(optReview.getAttribute('data-ag-perm-preset'), 'request_review');
    assert.equal(optDefault.getAttribute('data-ag-perm-preset'), 'default');
    assert.equal(optAuto.getAttribute('data-ag-perm-preset'), 'auto');
    assert.equal(optTurbo.getAttribute('data-ag-perm-preset'), 'turbo');
    assert.equal(optTurbo.getAttribute('data-ag-perm-selected'), '1');
    assert.equal(optGlobal.getAttribute('data-ag-perm-preset'), 'default');

    // Without Fiber, generic aria-label must not block textContent fallback
    body.removeChild(menu);
    delete trigSvg.__reactFiber$test;
    trig.setAttribute('aria-label', 'Agent permissions preset selector');
    trig.textContent = '请求审查';
    ctl.sync({ c: true });
    assert.equal(trig.getAttribute('data-ag-perm-preset'), 'request_review');

    // Clicking inside permissions-menu schedules sync so trigger updates right away
    body.appendChild(menu);
    trig.setAttribute('aria-label', 'Agent permissions preset selector, current: Auto');
    rafQueue = [];
    for (const fn of clickListeners) fn({ target: optAuto });
    assert.ok(rafQueue.length >= 1, 'clicking an option in permissions-menu must schedule sync rAF');
    rafQueue.forEach((cb) => cb());
    assert.equal(trig.getAttribute('data-ag-perm-preset'), 'auto');
  } finally {
    ctl.destroy();
  }

  // Every tagged node and style element must be cleaned up on destroy
  assert.equal(doc.getElementById(permIcons.STYLE_ID), null, 'destroy() must remove permission-icons <style>');
  assert.equal(head.children.some((n) => n.id === permIcons.STYLE_ID), false);
  for (const el of [trig, optReview, optDefault, optAuto, optTurbo, optGlobal]) {
    assert.equal(el.getAttribute('data-ag-perm-preset'), null, 'destroy() must strip data-ag-perm-preset from all tagged nodes');
  }
});

test('Permission icon colors: Channel 15 compilation, VM teardown (channel + full REMOVE_EXPRESSION) and packaging parity', () => {
  const ch = cdp.CHANNEL_REGISTRY.find((c) => c.id === 'workbenchEnhancer');
  assert.ok(ch, 'workbenchEnhancer channel must exist');
  assert.deepEqual([...ch.files], ['src/runtime/permission-icons.js', 'host-workbench-enhancer.js']);

  const expr = cdp.buildWorkbenchEnhancerChannelExpression(cdp.DEFAULT_CONFIG, { noDiskCache: true });
  assert.ok(expr.includes('__agPrismPermIcons'), 'compiled Channel 15 must include __agPrismPermIcons');
  assert.ok(expr.includes('ag-prism-perm-icons-css'), 'compiled Channel 15 must include scoped style id');
  assert.ok(Buffer.byteLength(expr, 'utf8') <= ch.budgetBytes, 'Channel 15 must remain within budgetBytes');
  assert.doesNotThrow(() => new vm.Script(expr), 'compiled Channel 15 expression must be valid JS');

  for (const hex of ['#34D399', '#60A5FA', '#FBBF24', '#F87171', '#059669', '#2563EB', '#D97706', '#DC2626']) {
    assert.ok(permIcons.PERM_ICONS_CSS.includes(hex), `PERM_ICONS_CSS must include semantic color ${hex}`);
  }

  // Verify WORKBENCH_ENHANCER_REMOVE_EXPRESSION cleans style, attrs & globals even if __agPrismPermIcons is already absent
  const chTeardownExpr = ch.teardown;
  assert.ok(typeof chTeardownExpr === 'string' && chTeardownExpr.includes('ag-prism-perm-icons-css'));
  const env1 = createPermMiniDom();
  permIcons.ensureStyle(env1.doc);
  const t1 = env1.make('button', { 'data-testid': 'permissions-selector-trigger', 'data-ag-perm-preset': 'turbo' });
  env1.body.appendChild(t1);
  const ctx1 = vm.createContext({ document: env1.doc });
  ctx1.window = ctx1;
  ctx1.__agPrismPermIcons = undefined;
  vm.runInContext(chTeardownExpr, ctx1);
  assert.equal(env1.doc.getElementById(permIcons.STYLE_ID), null, 'channel teardown must remove #ag-prism-perm-icons-css');
  assert.equal(t1.getAttribute('data-ag-perm-preset'), null, 'channel teardown must strip [data-ag-perm-preset]');

  // Verify global REMOVE_EXPRESSION (full uninstall) also removes #ag-prism-perm-icons-css, [data-ag-perm-preset] & __agPrismPermIcons
  assert.ok(typeof cdp.REMOVE_EXPRESSION === 'string' && cdp.REMOVE_EXPRESSION.includes('ag-prism-perm-icons-css'));
  const env2 = createPermMiniDom();
  permIcons.ensureStyle(env2.doc);
  const t2 = env2.make('button', { 'data-testid': 'permissions-selector-trigger', 'data-ag-perm-preset': 'auto' });
  env2.body.appendChild(t2);
  const ctx2 = vm.createContext({
    document: env2.doc,
    navigator: {},
    clearTimeout() {},
    clearInterval() {},
    cancelAnimationFrame() {},
  });
  ctx2.window = ctx2;
  ctx2.__agPrismPermIcons = permIcons;
  vm.runInContext(cdp.REMOVE_EXPRESSION, ctx2);
  assert.equal(env2.doc.getElementById(permIcons.STYLE_ID), null, 'REMOVE_EXPRESSION must remove #ag-prism-perm-icons-css');
  assert.equal(t2.getAttribute('data-ag-perm-preset'), null, 'REMOVE_EXPRESSION must strip [data-ag-perm-preset]');
  assert.equal(ctx2.__agPrismPermIcons, undefined, 'REMOVE_EXPRESSION must delete __agPrismPermIcons');

  // Verify packaging scripts auto-include src/runtime/permission-icons.js
  const nativeEntries = new Set(collectNativePluginEntries(ROOT).map((e) => e.name));
  assert.ok(nativeEntries.has('native-plugin/src/runtime/permission-icons.js'), 'build-common must include permission-icons.js');
  const linuxEntries = new Set(collectLinuxPortableEntries(ROOT).map((e) => e.name));
  assert.ok(linuxEntries.has('obsidian-prism-linux/native-plugin/src/runtime/permission-icons.js'), 'build-linux must include permission-icons.js');
});
