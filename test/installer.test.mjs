import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

function runExe(exePath, args, timeoutMs = 20000, customEnv = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, args, {
      stdio: 'ignore',
      windowsHide: true,
      env: customEnv || process.env,
    });
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error(`Timeout running ${path.basename(exePath)} ${args.join(' ')}`));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(exePath)} exited with code ${code}`));
    });
  });
}

import { VALIDATORS, buildInstaller } from '../scripts/build-installer.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const cdp = require(path.join(ROOT_DIR, 'cdp.js'));
const cliInstaller = require(path.join(ROOT_DIR, 'tools', 'install-plugin.cjs'));

function createMockCdpServer(options = {}) {
  const extraTargets = Array.isArray(options.extraTargets) ? options.extraTargets : [];
  const receivedCalls = [];
  const sockets = new Set();
  let prismMounted = false;
  let lastInjectedExpr = null;
  let lastRemovedExpr = null;
  const thoughtInjectExprs = [];
  const thoughtRemoveExprs = [];
  const addedScriptsById = new Map();

  function encodeWsTextFrame(str) {
    const payload = Buffer.from(str, 'utf8');
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
  }

  function sendWsMessage(socket, obj) {
    if (!socket.destroyed) {
      socket.write(encodeWsTextFrame(JSON.stringify(obj)));
    }
  }

  function handleCdpCommand(socket, msg) {
    receivedCalls.push(msg);
    let result = {};
    if (msg.method === 'Page.addScriptToEvaluateOnNewDocument') {
      const id = 'script-' + receivedCalls.length;
      addedScriptsById.set(id, (msg.params && msg.params.source) || '');
      result = { identifier: id };
    } else if (msg.method === 'Page.getFrameTree') {
      result = { frameTree: { frame: { id: 'MAIN_FRAME' } } };
    } else if (msg.method === 'Runtime.enable') {
      sendWsMessage(socket, {
        method: 'Runtime.executionContextCreated',
        params: {
          context: {
            id: 1,
            auxData: { frameId: 'MAIN_FRAME', isDefault: true, type: 'default' },
          },
        },
      });
    } else if (msg.method === 'Runtime.evaluate') {
      const expr = msg.params && msg.params.expression ? msg.params.expression : '';
      if (expr.startsWith('Boolean(window.__agPrism') || expr === 'Boolean(window.__agClaudeStyle)') {
        result = { result: { type: 'boolean', value: prismMounted } };
      } else if (expr.includes('delete globalThis.__agCsUiMain')) {
        lastRemovedExpr = expr;
        prismMounted = false;
        result = { result: { type: 'object', value: { removed: 3 } } };
      } else if (expr.includes('const isHostDom = Boolean(')) {
        result = {
          result: {
            type: 'object',
            value: {
              ready: true,
              isHostDom: true,
              prismAttr: cdp.PLUGIN_VERSION,
              hasPrism: prismMounted,
              hasRepoBridge: prismMounted,
              hasThoughtBridge: prismMounted,
              hasUsageBridge: prismMounted,
              hasOmniBridge: prismMounted,
              hasOmniServerMeta: prismMounted,
              hasOmni: prismMounted,
              omniMode: 'on',
              hasInlineDiff: prismMounted,
              codeHash: '',
              hasLegacyCss: false,
              needsDashboardSync: false,
            },
          },
        };
      } else if (expr.includes('const serverMeta = window.__agPrismOmniServerMeta')) {
        result = {
          result: {
            type: 'object',
            value: { ok: true, status: 'mounted' },
          },
        };
      } else if (expr.includes('const targetHash =') && expr.includes('__agPrismInlineDiff')) {
        result = {
          result: {
            type: 'object',
            value: { ok: true, status: 'mounted' },
          },
        };
      } else if (
        expr.includes('delete window.__agPrismInlineDiff') &&
        expr.includes("status: 'off'") &&
        !expr.includes('const targetHash =')
      ) {
        result = {
          result: {
            type: 'object',
            value: { ok: true, status: 'off' },
          },
        };
      } else if (expr.includes('const targetHash =') && expr.includes('__agPrismThoughtSettingsUi')) {
        thoughtInjectExprs.push(expr);
        result = {
          result: {
            type: 'object',
            value: { ok: true, status: 'mounted' },
          },
        };
      } else if (
        expr.includes('delete window.__agPrismThoughtSettingsUi') &&
        expr.includes("status: 'off'") &&
        !expr.includes('const targetHash =')
      ) {
        thoughtRemoveExprs.push(expr);
        result = {
          result: {
            type: 'object',
            value: { ok: true, status: 'off' },
          },
        };
      } else if (
        expr.includes('window.__agPrismRepoBridge') &&
        expr.includes('window.__agPrismThoughtBridge') &&
        !expr.includes('globalThis.__agCsUiMain')
      ) {
        result = {
          result: {
            type: 'object',
            value: { ok: true },
          },
        };
      } else {
        lastInjectedExpr = expr;
        prismMounted = true;
        result = {
          result: {
            type: 'object',
            value: { version: cdp.PLUGIN_VERSION, status: 'ok', state: { mounted: true } },
          },
        };
      }
    }
    sendWsMessage(socket, { id: msg.id, result });
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/json/list') {
      const addr = server.address();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const baseTargets = [
        {
          id: 'PAGE_1',
          type: 'page',
          title: 'Antigravity',
          url: 'https://127.0.0.1:9999/',
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/PAGE_1`,
        },
        {
          id: 'BARE_UNTITLED_1',
          type: 'page',
          title: 'Untitled',
          url: 'https://127.0.0.1:9999/',
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/BARE_UNTITLED_1`,
        },
        {
          id: 'LAUNCHPAD_1',
          type: 'page',
          title: 'Antigravity Launchpad',
          url: 'https://127.0.0.1:9999/launchpad.html',
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/LAUNCHPAD_1`,
        },
        {
          id: 'USER_PREVIEW_1',
          type: 'page',
          title: 'AI Rap Video Generator',
          url: 'http://127.0.0.1:3115/',
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/USER_PREVIEW_1`,
        },
        {
          id: 'EXT_WEB_1',
          type: 'page',
          title: 'Antigravity Spoofed External',
          url: 'https://example.com/',
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/EXT_WEB_1`,
        },
        {
          id: 'DEVTOOLS_1',
          type: 'page',
          title: 'DevTools',
          url: 'devtools://devtools/bundled/inspector.html',
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/DEVTOOLS_1`,
        },
      ];
      for (const extra of extraTargets) {
        baseTargets.push({
          ...extra,
          webSocketDebuggerUrl: `ws://127.0.0.1:${addr.port}/devtools/page/${extra.id}`,
        });
      }
      res.end(JSON.stringify(baseTargets));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));

    let buf = Buffer.alloc(0);
    let fragChunks = [];
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const b0 = buf[0];
        const b1 = buf[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;
        if (payloadLen === 126) {
          if (buf.length < 4) return;
          payloadLen = buf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buf.length < 10) return;
          payloadLen = Number(buf.readBigUInt64BE(2));
          offset = 10;
        }
        const maskLen = masked ? 4 : 0;
        if (buf.length < offset + maskLen + payloadLen) return;
        let payload = buf.subarray(offset + maskLen, offset + maskLen + payloadLen);
        if (masked) {
          const mask = buf.subarray(offset, offset + 4);
          const unmasked = Buffer.allocUnsafe(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ mask[i & 3];
          }
          payload = unmasked;
        }
        buf = buf.subarray(offset + maskLen + payloadLen);

        if (opcode === 0x8) {
          socket.end();
          return;
        }
        if (opcode === 0x9) {
          const pong = Buffer.alloc(2 + payload.length);
          pong[0] = 0x8a;
          pong[1] = payload.length;
          payload.copy(pong, 2);
          socket.write(pong);
          continue;
        }
        if (opcode === 0x1 || opcode === 0x0) {
          fragChunks.push(payload);
          if (fin) {
            const fullText = Buffer.concat(fragChunks).toString('utf8');
            fragChunks = [];
            try {
              const msg = JSON.parse(fullText);
              handleCdpCommand(socket, msg);
            } catch {}
          }
        }
      }
    });
  });

  return {
    async start() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      return server.address().port;
    },
    emitBindingCalled(name, payload, executionContextId = 1) {
      for (const s of sockets) {
        sendWsMessage(s, {
          method: 'Runtime.bindingCalled',
          params: { name, payload: JSON.stringify(payload), executionContextId },
        });
      }
    },
    getCalls() {
      return receivedCalls;
    },
    getLastInjectedExpr() {
      return lastInjectedExpr;
    },
    getLastRemovedExpr() {
      return lastRemovedExpr;
    },
    getThoughtInjectExprs() {
      return thoughtInjectExprs;
    },
    getThoughtRemoveExprs() {
      return thoughtRemoveExprs;
    },
    getAddedScriptsById() {
      return addedScriptsById;
    },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function waitFor(fn, timeoutMs = 6000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const val = await fn();
      if (val) return val;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw lastErr || new Error('Timed out waiting for condition');
}

test('installer manifest validators match inject.js, cdp.js, and config.example.json 100%', () => {
  const injectSrc = fs.readFileSync(path.join(ROOT_DIR, 'inject.js'), 'utf8');
  assert.ok(injectSrc.includes('validateConfigEntry'), 'inject.js must delegate directly to cdp.validateConfigEntry');
  assert.deepEqual(Object.keys(VALIDATORS).sort(), Object.keys(cdp.VALIDATORS).sort());

  const exampleCfg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'config.example.json'), 'utf8'));
  assert.deepEqual(Object.keys(exampleCfg).sort(), Object.keys(cdp.VALIDATORS).sort());
  for (const k of Object.keys(cdp.VALIDATORS)) {
    assert.ok(k in cdp.DEFAULT_CONFIG, `DEFAULT_CONFIG includes ${k}`);
    assert.ok(k in exampleCfg, `config.example.json includes ${k}`);
  }

  assert.equal(cdp.STYLE_ID, 'ag-prism-css');
  assert.equal(cdp.DEFAULT_CONFIG.palette, 'obsidian');
  assert.equal(cdp.DEFAULT_CONFIG.lightPreset, 'crystal');
  assert.equal(cdp.DEFAULT_CONFIG.motionLevel, 'ultra');
  assert.equal(cdp.DEFAULT_CONFIG.telemetryModule, 'auto');
  assert.equal(cdp.DEFAULT_CONFIG.effortSliderModule, 'auto');

  assert.deepEqual(VALIDATORS.palette, ['host', 'obsidian', 'warm', 'claude']);
  assert.deepEqual(VALIDATORS.lightPreset, ['crystal', 'alabaster']);
  assert.deepEqual(VALIDATORS.motionLevel, ['off', 'subtle', 'standard', 'ultra']);
  assert.deepEqual(VALIDATORS.telemetryModule, ['auto', 'on', 'off']);
  assert.deepEqual(VALIDATORS.effortSliderModule, ['auto', 'on', 'off']);

  assert.equal(exampleCfg.palette, 'obsidian');
  assert.equal(exampleCfg.lightPreset, 'crystal');
  assert.equal(exampleCfg.motionLevel, 'ultra');
  assert.equal(exampleCfg.telemetryModule, 'auto');
  assert.equal(exampleCfg.effortSliderModule, 'auto');

  // Wave 2: 6 new settings + host-workbench-enhancer.js registration parity
  assert.deepEqual(VALIDATORS.accentTone, ['follow', 'cobalt', 'iris', 'amber', 'mono']);
  assert.deepEqual(VALIDATORS.cornerStyle, ['sharp', 'balanced', 'soft']);
  assert.deepEqual(VALIDATORS.codeFont, ['default', 'jetbrains', 'cascadia', 'sfmono']);
  assert.equal(VALIDATORS.codeLigatures, 'boolean');
  assert.deepEqual(VALIDATORS.ambientIntensity, ['0', '35', '70', '100']);
  assert.deepEqual(VALIDATORS.thoughtView, ['immersive', 'bilingual']);
  assert.equal(exampleCfg.accentTone, 'follow');
  assert.equal(exampleCfg.cornerStyle, 'balanced');
  assert.equal(exampleCfg.codeFont, 'default');
  assert.equal(exampleCfg.codeLigatures, false);
  assert.equal(exampleCfg.ambientIntensity, '100');
  assert.equal(exampleCfg.thoughtView, 'immersive');
  assert.ok(cdp.RUNTIME_PARTS.includes('host-workbench-enhancer.js'));
  assert.ok(cdp.SYNC_ROOT_FILES.includes('host-workbench-enhancer.js'));
});

test(
  'installer.exe builds cleanly and executes full install, native Sidecar deployment, CDP injection, patch-batch sync, polite daemon yield, upgrade, and uninstall lifecycle',
  { skip: process.platform !== 'win32' ? 'Windows-only installer.exe E2E test' : false },
  async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-e2e-'));
    const installerExe = path.join(workDir, 'installer.exe');
    const installDir = path.join(workDir, 'installed');
    const nativePluginDir = path.join(workDir, 'plugins', 'obsidian-prism');
    const outInstall = path.join(workDir, 'install.json');
    const outUpgrade = path.join(workDir, 'upgrade.json');
    const outUninstall = path.join(workDir, 'uninstall.json');
    const outStatus = path.join(workDir, 'status.json');
    const mockCdp = createMockCdpServer();

    try {
      const buildRes = buildInstaller({ outputPath: installerExe });
      assert.ok(fs.existsSync(installerExe));
      assert.ok(buildRes.sizeBytes > 50 * 1024);

      const port = await mockCdp.start();

      // 1. Check --status CLI
      await runExe(
        installerExe,
        ['--status', '--install-dir', installDir, '--plugin-dir', nativePluginDir, '--cdp-port', String(port), '--out', outStatus],
        10000
      );
      const st = JSON.parse(fs.readFileSync(outStatus, 'utf8'));
      assert.equal(st.installed, false);
      assert.equal(st.nativePluginInstalled, false);
      assert.equal(st.cdpPort, port);

      // Prepare 0-byte empty host config.json, user secret file, and ephemeral cache file in sandbox config root
      const sandboxHostCfgPath = path.join(workDir, 'config.json');
      const sandboxSecretPath = path.join(workDir, 'obsidian-prism-thought.json');
      const sandboxCachePath = path.join(workDir, 'obsidian-prism-thought-cache.json');
      fs.writeFileSync(sandboxHostCfgPath, '', 'utf8');
      fs.writeFileSync(sandboxSecretPath, JSON.stringify({ engine: 'gemini', apiKey: 'test-user-secret' }), 'utf8');
      fs.writeFileSync(sandboxCachePath, JSON.stringify({ entries: { a: '1' } }), 'utf8');

      // 2. Run --silent install (--no-native-daemon to specifically exercise C# Watcher standalone fallback)
      await runExe(
        installerExe,
        [
          '--silent',
          '--no-autostart',
          '--no-kill-legacy',
          '--no-native-daemon',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--cdp-port',
          String(port),
          '--out',
          outInstall,
        ],
        20000
      );

      const installResult = JSON.parse(fs.readFileSync(outInstall, 'utf8'));
      assert.equal(installResult.ok, true);
      assert.equal(installResult.nativePluginDeployed, true);
      assert.equal(installResult.preservedExistingConfig, false);
      assert.deepEqual(installResult.injectedPages, ['Antigravity']);
      const hostRegistryAfterInstall = JSON.parse(fs.readFileSync(sandboxHostCfgPath, 'utf8'));
      assert.deepEqual(hostRegistryAfterInstall.plugins['obsidian-prism'], { enabled: true });
      assert.ok(fs.existsSync(path.join(installDir, 'obsidian-prism-watcher.exe')));
      assert.ok(fs.existsSync(path.join(installDir, 'obsidian-prism-installer.exe')));
      assert.ok(fs.existsSync(path.join(installDir, 'manifest.json')));
      assert.ok(fs.existsSync(path.join(installDir, 'host-workbench-enhancer.js')));
      assert.ok(fs.existsSync(path.join(installDir, 'vendor', 'pulse-dashboard', 'inline-fallback.js')));
      assert.ok(fs.existsSync(path.join(installDir, 'vendor', 'effort-slider', 'slider-coexist.js')));
      assert.ok(fs.existsSync(path.join(installDir, 'vendor', 'thought-translator', 'thought-client.js')));
      assert.ok(fs.existsSync(path.join(installDir, 'vendor', 'thought-translator', 'thought-settings-ui.js')));
      assert.ok(fs.existsSync(path.join(installDir, '.watch.pid')));

      // Verify full 5-channel native Sidecar plugin directory deployed cleanly
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'plugin.json')));
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'sidecars', 'daemon', 'sidecar.json')));
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'sidecars', 'daemon', 'main.mjs')));
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'vendor', 'thought-translator', 'translator-service.mjs')));
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'vendor', 'pulse-dashboard', 'sidecars', 'panel', 'store.mjs')));
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'host-workbench-enhancer.js')));
      assert.ok(fs.existsSync(path.join(nativePluginDir, 'config.json')));

      const activeCfgPath = path.join(ROOT_DIR, 'config.example.json');
      const expectedCfg = fs.readFileSync(activeCfgPath, 'utf8');
      assert.equal(fs.readFileSync(path.join(installDir, 'config.json'), 'utf8'), expectedCfg);

      // Verify exact CDP sequence & valid JS payload
      const calls = mockCdp.getCalls();
      assert.ok(calls.some((c) => c.method === 'Page.enable'));
      assert.ok(calls.some((c) => c.method === 'Runtime.enable'));
      assert.ok(
        calls.some(
          (c) =>
            c.method === 'Runtime.addBinding' &&
            c.params &&
            c.params.name === cdp.SETTING_BINDING
        )
      );
      assert.ok(calls.some((c) => c.method === 'Page.addScriptToEvaluateOnNewDocument'));
      const injectedExpr = mockCdp.getLastInjectedExpr();
      assert.ok(injectedExpr, 'injected expression was sent over CDP');
      assert.doesNotThrow(() => new vm.Script(injectedExpr), 'C# injected JS compiles cleanly');

      // Verify codeHash parity and active config values between Node cdp.js and C# watcher
      const nodeExpr = cdp.buildInjectExpression();
      const nodeHash = nodeExpr.match(/"codeHash":"([^"]+)"/)[1];
      const csHash = injectedExpr.match(/"codeHash":"([^"]+)"/)[1];
      assert.equal(csHash, nodeHash);
      const expectedCfgObj = JSON.parse(expectedCfg);
      assert.ok(injectedExpr.includes(`"palette":"${expectedCfgObj.palette}"`));
      assert.ok(injectedExpr.includes(`"lightPreset":"${expectedCfgObj.lightPreset}"`));

      // Verify watcher --once CLI mode works standalone against CDP
      const watcherExe = path.join(installDir, 'obsidian-prism-watcher.exe');
      const onceOut = path.join(workDir, 'once.json');
      await runExe(
        watcherExe,
        ['--once', '--dir', installDir, '--cdp-port', String(port), '--out', onceOut],
        10000
      );
      const onceResult = JSON.parse(fs.readFileSync(onceOut, 'utf8'));
      assert.equal(onceResult.ok, true);
      assert.deepEqual(onceResult.pages, ['Antigravity']);

      // 3. Test Runtime.bindingCalled (single + patch-batch) -> config.json update & hot-reload
      const beforeCallCount = mockCdp.getCalls().length;
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, { key: 'palette', value: 'hacker-invalid' });
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, { key: 'lightPreset', value: 'invalid-preset' });
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, { key: 'lightPreset', value: 'alabaster' });
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, { key: 'palette', value: 'warm' });
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, {
        action: 'patch-batch',
        entries: {
          accentTone: 'iris',
          cornerStyle: 'soft',
          ambientIntensity: '70',
          thoughtView: 'bilingual',
          codeLigatures: true,
        },
      });

      const updatedCfg = await waitFor(() => {
        const parsed = JSON.parse(fs.readFileSync(path.join(installDir, 'config.json'), 'utf8'));
        return parsed.palette === 'warm' &&
          parsed.lightPreset === 'alabaster' &&
          parsed.accentTone === 'iris' &&
          parsed.cornerStyle === 'soft' &&
          parsed.ambientIntensity === '70' &&
          parsed.thoughtView === 'bilingual' &&
          parsed.codeLigatures === true
          ? parsed
          : null;
      });
      assert.equal(updatedCfg.palette, 'warm');
      assert.equal(updatedCfg.lightPreset, 'alabaster');
      assert.equal(updatedCfg.accentTone, 'iris');
      assert.equal(updatedCfg.ambientIntensity, '70');

      const syncedPluginCfg = await waitFor(() => {
        const parsed = JSON.parse(fs.readFileSync(path.join(nativePluginDir, 'config.json'), 'utf8'));
        return parsed.accentTone === 'iris' && parsed.thoughtView === 'bilingual' ? parsed : null;
      });
      assert.equal(syncedPluginCfg.accentTone, 'iris');
      assert.equal(syncedPluginCfg.thoughtView, 'bilingual');

      // Confirm hot-reload fired on watcher
      await waitFor(() => {
        const newer = mockCdp.getCalls().slice(beforeCallCount);
        return newer.some((c) => c.method === 'Page.removeScriptToEvaluateOnNewDocument') ? true : null;
      });

      // 3a. Channel 5 (thought-translator): default off must not inject; hot-toggle ai -> off injects then removes cleanly
      assert.equal(
        mockCdp.getThoughtInjectExprs().length,
        0,
        'Channel 5 thought expression must NOT be injected when thoughtTranslate defaults to off'
      );
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, { key: 'thoughtTranslate', value: 'ai' });
      const thoughtInjected = await waitFor(() => {
        const arr = mockCdp.getThoughtInjectExprs();
        return arr.length > 0 ? arr[arr.length - 1] : null;
      }, 6000, 100);
      assert.doesNotThrow(() => new vm.Script(thoughtInjected), 'C# Channel 5 thought JS must compile cleanly');
      assert.ok(thoughtInjected.includes('"thoughtTranslate":"ai"'), 'C# Channel 5 bootCfg reflects ai mode');
      const registeredThoughtScriptId = Array.from(mockCdp.getAddedScriptsById().entries())
        .reverse()
        .find(([, src]) => src.includes('const targetHash =') && src.includes('__agPrismThoughtSettingsUi'))?.[0];
      assert.ok(registeredThoughtScriptId, 'C# Watcher must register Channel 5 via Page.addScriptToEvaluateOnNewDocument');

      const beforeDisableCallIdx = mockCdp.getCalls().length;
      mockCdp.emitBindingCalled(cdp.SETTING_BINDING, { key: 'thoughtTranslate', value: 'off' });
      await waitFor(() => {
        const removedExprs = mockCdp.getThoughtRemoveExprs();
        const removedScript = mockCdp
          .getCalls()
          .slice(beforeDisableCallIdx)
          .some(
            (c) =>
              c.method === 'Page.removeScriptToEvaluateOnNewDocument' &&
              c.params?.identifier === registeredThoughtScriptId
          );
        return removedExprs.length > 0 && removedScript ? true : null;
      }, 6000, 100);

      // 3b. Test Watcher polite yield when native Sidecar daemon (.daemon.pid) is alive & auto-resume on exit
      const daemonPidPath = path.join(nativePluginDir, '.daemon.pid');
      const watchLogPath = path.join(installDir, 'watch.log');
      fs.writeFileSync(daemonPidPath, JSON.stringify({ pid: process.pid }), 'utf8');
      await waitFor(() => {
        const logText = fs.existsSync(watchLogPath) ? fs.readFileSync(watchLogPath, 'utf8') : '';
        return logText.includes('检测到原生 Sidecar Daemon 运行中') ? true : null;
      }, 6000, 120);
      fs.unlinkSync(daemonPidPath);
      await waitFor(() => {
        const logText = fs.existsSync(watchLogPath) ? fs.readFileSync(watchLogPath, 'utf8') : '';
        return logText.includes('原生 Sidecar Daemon 已离线') ? true : null;
      }, 6000, 120);

      // 4. Test re-install / upgrade preserves existing user config.json across both dirs
      await runExe(
        installerExe,
        [
          '--silent',
          '--no-autostart',
          '--no-kill-legacy',
          '--no-native-daemon',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--cdp-port',
          String(port),
          '--out',
          outUpgrade,
        ],
        20000
      );
      const upgradeResult = JSON.parse(fs.readFileSync(outUpgrade, 'utf8'));
      assert.equal(upgradeResult.ok, true);
      assert.equal(upgradeResult.preservedExistingConfig, true);
      const cfgAfterUpgrade = JSON.parse(fs.readFileSync(path.join(installDir, 'config.json'), 'utf8'));
      assert.equal(cfgAfterUpgrade.palette, 'warm');
      assert.equal(cfgAfterUpgrade.lightPreset, 'alabaster');
      assert.equal(cfgAfterUpgrade.accentTone, 'iris');

      // 5. Test --uninstall from installed copy inside installDir (exercises self-delete, plugin cleanup & CDP cleanup)
      const installedSelf = path.join(installDir, 'obsidian-prism-installer.exe');
      await runExe(
        installedSelf,
        [
          '--uninstall',
          '--silent',
          '--no-autostart',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--cdp-port',
          String(port),
          '--out',
          outUninstall,
        ],
        20000
      );

      const uninstallResult = JSON.parse(fs.readFileSync(outUninstall, 'utf8'));
      assert.equal(uninstallResult.ok, true);
      assert.equal(uninstallResult.selfDeleteScheduled, true);
      assert.deepEqual(uninstallResult.injectedPages, ['Antigravity']);
      assert.equal(mockCdp.getLastRemovedExpr(), cdp.REMOVE_EXPRESSION);
      assert.equal(fs.existsSync(nativePluginDir), false);
      const hostRegistryAfterUninstall = JSON.parse(fs.readFileSync(sandboxHostCfgPath, 'utf8'));
      assert.equal(hostRegistryAfterUninstall.plugins?.['obsidian-prism'], undefined);
      assert.equal(fs.existsSync(sandboxCachePath), false, 'ephemeral thought cache must be removed on uninstall');
      assert.equal(fs.existsSync(sandboxSecretPath), true, 'user secret file obsidian-prism-thought.json must be preserved');

      await waitFor(() => (!fs.existsSync(installDir) ? true : null), 20000, 150);
      assert.equal(fs.existsSync(installDir), false);
    } finally {
      try {
        const pidPath = path.join(installDir, '.watch.pid');
        if (fs.existsSync(pidPath)) {
          const pid = parseInt(fs.readFileSync(pidPath, 'utf8'), 10);
          if (pid) process.kill(pid);
        }
      } catch {}
      await mockCdp.close();
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
);

test('CLI syncHostPluginRegistry safely initializes 0-byte config.json and preserves user secret file on uninstall', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-cli-reg-'));
  try {
    const cfgPath = path.join(workDir, 'config.json');
    const secretPath = path.join(workDir, 'obsidian-prism-thought.json');
    const cachePath = path.join(workDir, 'obsidian-prism-thought-cache.json');
    fs.writeFileSync(cfgPath, '', 'utf8');
    fs.writeFileSync(secretPath, '{"apiKey":"keep-me"}', 'utf8');
    fs.writeFileSync(cachePath, '{"cached":1}', 'utf8');

    assert.equal(cliInstaller.syncHostPluginRegistry(workDir, true), true);
    const enabledCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.deepEqual(enabledCfg.plugins['obsidian-prism'], { enabled: true });

    enabledCfg.plugins['antigravity-prism'] = { enabled: true };
    enabledCfg.sidecars = { 'obsidian-prism/daemon': { enabled: true }, other: { enabled: true } };
    fs.writeFileSync(cfgPath, JSON.stringify(enabledCfg, null, 2), 'utf8');

    assert.equal(cliInstaller.syncHostPluginRegistry(workDir, false), true);
    const cleanedCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.equal(cleanedCfg.plugins['obsidian-prism'], undefined);
    assert.equal(cleanedCfg.plugins['antigravity-prism'], undefined);
    assert.equal(cleanedCfg.sidecars['obsidian-prism/daemon'], undefined);
    assert.deepEqual(cleanedCfg.sidecars.other, { enabled: true });
    assert.equal(fs.existsSync(cachePath), false);
    assert.equal(fs.existsSync(secretPath), true);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test(
  'installer.exe zero-Node bare-machine mode boots full 5-channel native Sidecar via ELECTRON_RUN_AS_NODE=1, injects Untitled Conversation, and auto-respawns daemon',
  { skip: process.platform !== 'win32' ? 'Windows-only zero-Node native daemon E2E test' : false },
  async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-zero-node-'));
    const installerExe = path.join(workDir, 'installer.exe');
    const installDir = path.join(workDir, 'installed');
    const nativePluginDir = path.join(workDir, 'plugins', 'obsidian-prism');
    const outInstall = path.join(workDir, 'install.json');
    const outStatus = path.join(workDir, 'status.json');
    const outUninstall = path.join(workDir, 'uninstall.json');
    const mockCdp = createMockCdpServer({
      extraTargets: [
        {
          id: 'SWARM_FULL_VIEW_1',
          type: 'page',
          title: 'Untitled Conversation - antigravity - Antigravity',
          url: 'https://127.0.0.1:9999/?view=agent',
        },
      ],
    });

    try {
      buildInstaller({ outputPath: installerExe });
      const port = await mockCdp.start();

      // Strip all Node.js directories from PATH to simulate a bare Windows machine without system Node.js
      const rawPath = process.env.PATH || process.env.Path || '';
      const strippedPath = rawPath
        .split(path.delimiter)
        .filter((seg) => {
          if (!seg) return false;
          try {
            return !fs.existsSync(path.join(seg.trim(), 'node.exe'));
          } catch {
            return true;
          }
        })
        .join(path.delimiter);

      const localAppData = process.env.LOCALAPPDATA || '';
      const realAgExe = localAppData
        ? path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe')
        : '';
      const bareEnv = {
        ...process.env,
        PATH: strippedPath,
        Path: strippedPath,
      };
      delete bareEnv.AG_PRISM_NO_NATIVE_DAEMON;
      if (!realAgExe || !fs.existsSync(realAgExe)) {
        bareEnv.AG_PRISM_ELECTRON_EXE = process.execPath;
      }

      await runExe(
        installerExe,
        [
          '--silent',
          '--no-autostart',
          '--no-kill-legacy',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--cdp-port',
          String(port),
          '--out',
          outInstall,
        ],
        25000,
        bareEnv
      );

      const installRes = JSON.parse(fs.readFileSync(outInstall, 'utf8'));
      assert.equal(installRes.ok, true);
      assert.equal(installRes.nativePluginDeployed, true);
      assert.equal(installRes.nativeDaemonStarted, true, 'Setup must immediately boot native 5-channel daemon');

      await runExe(
        installerExe,
        ['--status', '--install-dir', installDir, '--plugin-dir', nativePluginDir, '--cdp-port', String(port), '--out', outStatus],
        10000,
        bareEnv
      );
      const statusObj = JSON.parse(fs.readFileSync(outStatus, 'utf8'));
      assert.equal(statusObj.nativeDaemonAlive, true);

      // Wait for all 6 privileged 5-channel bindings to be registered by sidecars/daemon/main.mjs
      const requiredBindings = [
        '__agPrismSetting',
        '__agPrismMetricsCall',
        '__agPrismThoughtCall',
        '__agPrismUsageCall',
        '__agPrismRepoCall',
        '__agPrismOmniCall',
      ];
      await waitFor(() => {
        const bound = new Set(
          mockCdp
            .getCalls()
            .filter((c) => c.method === 'Runtime.addBinding' && c.params?.name)
            .map((c) => c.params.name)
        );
        return requiredBindings.every((b) => bound.has(b)) ? true : null;
      }, 8000, 120);

      // Verify Untitled Conversation Swarm Full View was injected alongside Antigravity main window (2 pages, bare Untitled/launchpad skipped)
      assert.ok(
        installRes.injectedPages.some((t) => t.startsWith('Untitled Conversation')),
        `Expected Untitled Conversation to be injected, got: ${JSON.stringify(installRes.injectedPages)}`
      );
      assert.equal(installRes.injectedPages.includes('Untitled'), false);

      // Kill the native daemon and verify background C# Watcher auto-respawns it
      const pidFile = path.join(nativePluginDir, '.daemon.pid');
      const firstLock = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
      assert.ok(firstLock.pid > 0);
      try {
        process.kill(firstLock.pid);
      } catch {}

      const respawnedLock = await waitFor(() => {
        if (!fs.existsSync(pidFile)) return null;
        const parsed = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
        return parsed.pid > 0 && parsed.pid !== firstLock.pid ? parsed : null;
      }, 12000, 200);
      assert.notEqual(respawnedLock.pid, firstLock.pid, 'Watcher must auto-respawn native Sidecar daemon');

      // Clean uninstall stops both Watcher and Electron RunAsNode native daemon
      await runExe(
        installerExe,
        [
          '--uninstall',
          '--silent',
          '--no-autostart',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--cdp-port',
          String(port),
          '--out',
          outUninstall,
        ],
        25000,
        bareEnv
      );
      const unRes = JSON.parse(fs.readFileSync(outUninstall, 'utf8'));
      assert.equal(unRes.ok, true);
      assert.equal(fs.existsSync(nativePluginDir), false);
      assert.equal(fs.existsSync(installDir), false);
    } finally {
      try {
        const pidFile = path.join(nativePluginDir, '.daemon.pid');
        if (fs.existsSync(pidFile)) {
          const parsed = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
          if (parsed.pid) process.kill(parsed.pid);
        }
      } catch {}
      try {
        const wPidFile = path.join(installDir, '.watch.pid');
        if (fs.existsSync(wPidFile)) {
          const wPid = parseInt(fs.readFileSync(wPidFile, 'utf8'), 10);
          if (wPid) process.kill(wPid);
        }
      } catch {}
      await mockCdp.close();
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
);

test(
  'installer.exe v2.33.0+ compatibility: patches Antigravity.lnk with --remote-debugging-port=0 (ignoring Antigravity Tools.lnk), writes shared .relaunch-prompt-state.json once, and restores original .lnk args on uninstall',
  { skip: process.platform !== 'win32' ? 'Windows-only .lnk & relaunch-state E2E test' : false },
  async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-v233-'));
    const installerExe = path.join(workDir, 'installer.exe');
    const installDir = path.join(workDir, 'installed');
    const nativePluginDir = path.join(workDir, 'plugins', 'obsidian-prism');
    const shortcutDir = path.join(workDir, 'shortcuts');
    const fakeBinDir = path.join(workDir, 'fake-bin');
    const fakeAppData = path.join(workDir, 'appdata');
    const outInstall = path.join(workDir, 'install.json');
    const outUninstall = path.join(workDir, 'uninstall.json');

    fs.mkdirSync(shortcutDir, { recursive: true });
    fs.mkdirSync(fakeBinDir, { recursive: true });
    fs.mkdirSync(fakeAppData, { recursive: true });

    const fakeAgExe = path.join(fakeBinDir, 'Antigravity.exe');
    const fakeToolsExe = path.join(fakeBinDir, 'antigravity-tools.exe');
    fs.writeFileSync(fakeAgExe, 'stub', 'utf8');
    fs.writeFileSync(fakeToolsExe, 'stub', 'utf8');

    const agLnk = path.join(shortcutDir, 'Antigravity.lnk');
    const toolsLnk = path.join(shortcutDir, 'Antigravity Tools.lnk');

    const createLnkPs = [
      '$sh = New-Object -ComObject WScript.Shell;',
      '$s1 = $sh.CreateShortcut($env:TEST_AG_LNK);',
      '$s1.TargetPath = $env:TEST_AG_EXE;',
      '$s1.Arguments = "--reuse-window";',
      '$s1.Save();',
      '$s2 = $sh.CreateShortcut($env:TEST_TOOLS_LNK);',
      '$s2.TargetPath = $env:TEST_TOOLS_EXE;',
      '$s2.Arguments = "--helper";',
      '$s2.Save();',
    ].join(' ');
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', createLnkPs], {
      env: {
        ...process.env,
        TEST_AG_LNK: agLnk,
        TEST_AG_EXE: fakeAgExe,
        TEST_TOOLS_LNK: toolsLnk,
        TEST_TOOLS_EXE: fakeToolsExe,
      },
    });

    const readLnkArgs = (lnkFile) =>
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '$sh = New-Object -ComObject WScript.Shell; Write-Output ($sh.CreateShortcut($env:TEST_LNK).Arguments)',
        ],
        {
          encoding: 'utf8',
          env: { ...process.env, TEST_LNK: lnkFile },
        }
      ).trim();

    const dummyBareHost = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    try {
      buildInstaller({ outputPath: installerExe });

      const testEnv = {
        ...process.env,
        APPDATA: fakeAppData,
        AG_PRISM_SHORTCUT_DIRS: shortcutDir,
        AG_PRISM_MOCK_BARE_HOST_PID: String(dummyBareHost.pid),
        AG_PRISM_MOCK_BARE_HOST_UPTIME_MS: '12000',
        AG_PRISM_MOCK_RELAUNCH_DECISION: 'no',
      };
      delete testEnv.NODE_ENV;
      delete testEnv.PRISM_NO_RELAUNCH_PROMPT;
      delete testEnv.AG_PRISM_NO_RELAUNCH_PROMPT;

      await runExe(
        installerExe,
        [
          '--silent',
          '--no-autostart',
          '--no-kill-legacy',
          '--no-native-daemon',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--out',
          outInstall,
        ],
        20000,
        testEnv
      );

      const installRes = JSON.parse(fs.readFileSync(outInstall, 'utf8'));
      assert.equal(installRes.ok, true);
      assert.equal(installRes.patchedShortcuts, 1);
      assert.equal(installRes.bareHostDetected, true);
      assert.equal(readLnkArgs(agLnk), '--reuse-window --remote-debugging-port=0');
      assert.equal(readLnkArgs(toolsLnk), '--helper', 'must not touch Antigravity Tools.lnk');

      const patchedRecord = JSON.parse(
        fs.readFileSync(path.join(nativePluginDir, '.patched-shortcuts.json'), 'utf8')
      );
      assert.ok(Array.isArray(patchedRecord.patchedPaths) && patchedRecord.patchedPaths.length === 1);

      // Verify background Watcher writes shared .relaunch-prompt-state.json deduplication lock once
      const promptStatePath = path.join(nativePluginDir, '.relaunch-prompt-state.json');
      const stateObj = await waitFor(() => {
        if (!fs.existsSync(promptStatePath)) return null;
        const parsed = JSON.parse(fs.readFileSync(promptStatePath, 'utf8'));
        return parsed.hostPid === dummyBareHost.pid && parsed.decision === 'no' ? parsed : null;
      }, 8000, 150);
      assert.equal(stateObj.hostPid, dummyBareHost.pid);
      assert.ok(String(stateObj.hostKey).startsWith(`${dummyBareHost.pid}:`));

      // Uninstall must cleanly strip --remote-debugging-port=0 while preserving original --reuse-window
      await runExe(
        installerExe,
        [
          '--uninstall',
          '--silent',
          '--no-autostart',
          '--install-dir',
          installDir,
          '--plugin-dir',
          nativePluginDir,
          '--out',
          outUninstall,
        ],
        20000,
        testEnv
      );

      const unRes = JSON.parse(fs.readFileSync(outUninstall, 'utf8'));
      assert.equal(unRes.ok, true);
      assert.equal(unRes.restoredShortcuts, 1);
      assert.equal(readLnkArgs(agLnk), '--reuse-window');
      assert.equal(readLnkArgs(toolsLnk), '--helper');
    } finally {
      try {
        dummyBareHost.kill();
      } catch {}
      try {
        const wPidFile = path.join(installDir, '.watch.pid');
        if (fs.existsSync(wPidFile)) {
          const wPid = parseInt(fs.readFileSync(wPidFile, 'utf8'), 10);
          if (wPid) process.kill(wPid);
        }
      } catch {}
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
);

test('interactive GUI installers require explicit user confirmation before installing (Windows & macOS)', () => {
  const winSrc = fs.readFileSync(path.join(ROOT_DIR, 'installer', 'setup', 'Program.cs'), 'utf8');
  const winInitMatch = winSrc.match(/private\s+async\s+Task\s+StartInitialActionAsync\(\)[\s\S]*?\n\s{8}\}/);
  assert.ok(winInitMatch, 'Windows InstallerForm.StartInitialActionAsync must exist');
  assert.doesNotMatch(
    winInitMatch[0],
    /ExecuteInstallAsync\s*\(/,
    'Windows GUI must NOT auto-run ExecuteInstallAsync() on launch without user click'
  );
  assert.match(winInitMatch[0], /PrepareInstallChoiceAsync\s*\(/);
  assert.match(winSrc, /_installBtn\.Click\s*\+=\s*async\s*\(s,\s*e\)\s*=>\s*await\s+ExecuteInstallAsync\(\)/);
  assert.match(winSrc, /_closeBtn\.Text\s*=\s*"取消"/);

  const macSrc = fs.readFileSync(path.join(ROOT_DIR, 'installer', 'macos', 'Setup', 'main.swift'), 'utf8');
  const macInitMatch = macSrc.match(/private\s+func\s+startInitialAction\(\)[\s\S]*?\n\s{4}\}/);
  assert.ok(macInitMatch, 'macOS InstallerAppDelegate.startInitialAction must exist');
  assert.doesNotMatch(
    macInitMatch[0],
    /executeInstall\s*\(/,
    'macOS GUI must NOT auto-run executeInstall() on launch without user click'
  );
  assert.match(macInitMatch[0], /prepareInstallChoice\s*\(/);
  assert.match(macSrc, /#selector\(handleInstallClick\)/);
  assert.match(macSrc, /closeBtn\s*=\s*NSButton\(title:\s*"取消"/);
});

test('Windows InstallerForm configures 96-DPI AutoScaleDimensions with AutoScaleMode.Dpi (#28)', () => {
  const winSrc = fs.readFileSync(path.join(ROOT_DIR, 'installer', 'setup', 'Program.cs'), 'utf8');
  const ctorMatch = winSrc.match(/public\s+InstallerForm\s*\(InstallerOptions\s+opts\)[\s\S]*?\n\s{8}\}/);
  assert.ok(ctorMatch, 'InstallerForm constructor must exist');
  const ctor = ctorMatch[0];
  const suspendIdx = ctor.indexOf('SuspendLayout();');
  const dimsIdx = ctor.indexOf('AutoScaleDimensions = new SizeF(96F, 96F);');
  const modeIdx = ctor.indexOf('AutoScaleMode = AutoScaleMode.Dpi;');
  const resumeIdx = ctor.indexOf('ResumeLayout(false);');
  assert.ok(suspendIdx >= 0, 'InstallerForm must call SuspendLayout() before adding controls');
  assert.ok(dimsIdx > suspendIdx, 'InstallerForm must set AutoScaleDimensions to 96 DPI base');
  assert.ok(modeIdx > dimsIdx, 'InstallerForm must set AutoScaleMode.Dpi after AutoScaleDimensions');
  assert.ok(resumeIdx > modeIdx, 'InstallerForm must call ResumeLayout(false) after setting AutoScaleMode');
});

test('Windows C# installer & Watcher Channel 5 contracts and cdp.js REMOVE_EXPRESSION data-ces-model-selected cleanup', () => {
  const cdpCs = fs.readFileSync(path.join(ROOT_DIR, 'installer', 'common', 'CdpClient.cs'), 'utf8');
  const watcherCs = fs.readFileSync(path.join(ROOT_DIR, 'installer', 'watcher', 'Program.cs'), 'utf8');

  assert.ok(cdpCs.includes('public static bool ShouldEnableThought(Dictionary<string, object> cfg)'));
  assert.ok(cdpCs.includes('public static string BuildThoughtExpression(string pluginDir, Dictionary<string, object> cfg)'));
  assert.ok(cdpCs.includes('public const string ThoughtRemoveExpression'));
  assert.ok(cdpCs.includes('ResolveSafePluginFile'));
  assert.ok(cdpCs.includes('vendor/thought-translator/thought-client.js'));
  assert.ok(cdpCs.includes('vendor/thought-translator/thought-settings-ui.js'));

  assert.ok(watcherCs.includes('public string ThoughtScriptId;'));
  assert.ok(watcherCs.includes('CdpHelper.ShouldEnableThought('));
  assert.ok(watcherCs.includes('CdpHelper.BuildThoughtExpression('));
  assert.ok(watcherCs.includes('CdpHelper.ThoughtRemoveExpression'));
  assert.ok(watcherCs.includes('vendor/thought-translator/'));

  // Verify cdp.js REMOVE_EXPRESSION statically includes & strips data-ces-model-selected
  assert.ok(
    cdp.REMOVE_EXPRESSION.includes("'data-ces-model-selected'"),
    'cdp.REMOVE_EXPRESSION static attribute cleanup list must include data-ces-model-selected'
  );
  const removedAttrs = [];
  const fakeRow = {
    removeAttribute(attr) {
      removedAttrs.push(attr);
    },
  };
  const fakeDoc = {
    documentElement: {
      removeAttribute() {},
      getAttribute() { return null; },
      style: { removeProperty() {} },
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll(sel) {
      if (sel === '[data-ces-model-selected]') return [fakeRow];
      return [];
    },
  };
  const ctx = { window: {}, globalThis: {}, document: fakeDoc };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInNewContext(cdp.REMOVE_EXPRESSION, ctx);
  assert.ok(
    removedAttrs.includes('data-ces-model-selected'),
    'Executing cdp.REMOVE_EXPRESSION must strip data-ces-model-selected from DOM nodes'
  );
});

test('Windows C# CdpClient ReconcileConfigAliases (#5) & BuildConfigRefreshExpression thoughtView off removal (#7b)', () => {
  const cdpCs = fs.readFileSync(path.join(ROOT_DIR, 'installer', 'common', 'CdpClient.cs'), 'utf8');

  // Static contract parity
  for (const key of ['telemetryModule', 'effortSliderModule', 'omniModule', 'sidebarStudio', 'autoUpdate']) {
    assert.ok(cdpCs.includes(`"${key}"`), `C# ReconcileConfigAliases must handle boolean->on/off for ${key}`);
  }
  assert.ok(cdpCs.includes('"claude"') && cdpCs.includes('"warm"'), 'C# ReconcileConfigAliases maps palette claude->warm');
  assert.ok(cdpCs.includes('"dual"') && cdpCs.includes('"crab"'), 'C# ReconcileConfigAliases maps mascot dual->crab');
  assert.ok(
    cdpCs.includes("removeAttribute('data-ag-prism-thought-view')"),
    'C# BuildConfigRefreshExpression removes data-ag-prism-thought-view when thoughtTranslate is off'
  );

  // Live C# execution verification on Windows via csc.exe
  if (process.platform === 'win32') {
    const winDir = process.env.WINDIR || 'C:\\Windows';
    const csc = [
      path.join(winDir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
      path.join(winDir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
    ].find((p) => fs.existsSync(p));
    assert.ok(csc, 'Expected .NET Framework csc.exe on Windows');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-cs-alias-'));
    try {
      const probeCs = path.join(tmpDir, 'Probe.cs');
      const probeExe = path.join(tmpDir, 'probe.exe');
      const cfgDir = path.join(tmpDir, 'plugin');
      fs.mkdirSync(cfgDir, { recursive: true });
      fs.writeFileSync(path.join(cfgDir, 'style.css'), '/* stub */', 'utf8');
      fs.writeFileSync(path.join(cfgDir, 'ui-runtime.js'), '/* stub */', 'utf8');
      fs.writeFileSync(
        path.join(cfgDir, 'config.json'),
        JSON.stringify({
          palette: 'claude',
          mascot: 'dual',
          telemetryModule: true,
          effortSliderModule: false,
          omniModule: false,
          sidebarStudio: true,
          autoUpdate: true,
          thoughtTranslate: 'off',
          thoughtView: 'bilingual',
        }),
        'utf8'
      );

      fs.writeFileSync(
        probeCs,
        [
          'using System;',
          'using System.Collections.Generic;',
          'using AgyClaudeStyle;',
          'class Probe {',
          '  static void Main(string[] args) {',
          '    var m = new PluginManifest();',
          '    m.Version = "1.0.6";',
          '    m.SettingBinding = "__agPrismSetting";',
          '    m.Parts = new List<string> { "ui-runtime.js" };',
          '    m.DefaultConfig = new Dictionary<string, object>(StringComparer.Ordinal) {',
          '      { "palette", "obsidian" }, { "mascot", "crab" }, { "thoughtTranslate", "off" }, { "thoughtView", "immersive" }',
          '    };',
          '    var cfg = CdpHelper.ReadConfig(args[0], m);',
          '    var exprOff = CdpHelper.BuildConfigRefreshExpression(args[0], m);',
          '    var outObj = new Dictionary<string, object>(StringComparer.Ordinal) {',
          '      { "cfg", cfg },',
          '      { "exprOff", exprOff }',
          '    };',
          '    Console.Write(MiniJson.Stringify(outObj, false));',
          '  }',
          '}',
        ].join('\n'),
        'utf8'
      );

      execFileSync(
        csc,
        [
          '/nologo',
          '/utf8output',
          '/codepage:65001',
          '/target:exe',
          `/out:${probeExe}`,
          '/r:System.dll',
          '/r:System.Core.dll',
          '/r:System.Net.Http.dll',
          path.join(ROOT_DIR, 'installer', 'common', 'MiniJson.cs'),
          path.join(ROOT_DIR, 'installer', 'common', 'CdpClient.cs'),
          probeCs,
        ],
        { stdio: 'pipe' }
      );

      const rawOut = execFileSync(probeExe, [cfgDir], { encoding: 'utf8' });
      const parsed = JSON.parse(rawOut);
      assert.equal(parsed.cfg.palette, 'warm', 'C# ReadConfig/ReconcileConfigAliases must normalize palette claude->warm');
      assert.equal(parsed.cfg.mascot, 'crab', 'C# ReadConfig/ReconcileConfigAliases must normalize mascot dual->crab');
      assert.equal(parsed.cfg.telemetryModule, 'on');
      assert.equal(parsed.cfg.effortSliderModule, 'off');
      assert.equal(parsed.cfg.omniModule, 'off');
      assert.equal(parsed.cfg.sidebarStudio, 'on');
      assert.equal(parsed.cfg.autoUpdate, 'on');

      // Execute C#-generated BuildConfigRefreshExpression in VM for off vs ai
      assert.doesNotThrow(() => new vm.Script(parsed.exprOff), 'C# BuildConfigRefreshExpression must be valid JS');
      const attrs = new Map([['data-ag-prism-thought-view', 'bilingual']]);
      let liveCfg = null;
      const htmlEl = {
        hasAttribute: (k) => attrs.has(k),
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        setAttribute: (k, v) => attrs.set(k, String(v)),
        removeAttribute: (k) => attrs.delete(k),
      };
      const vmCtx = {
        document: { documentElement: htmlEl },
        window: {
          __agPrism: {
            version: '1.0.6',
            refreshConfig(c) {
              liveCfg = c;
            },
            getState() {
              return { cfg: liveCfg };
            },
          },
        },
      };
      const resOff = vm.runInNewContext(parsed.exprOff, vmCtx);
      assert.equal(resOff.refreshed, true);
      assert.equal(htmlEl.hasAttribute('data-ag-prism-thought-view'), false, 'C# refresh expr must strip thought-view when off');

      // Re-run with thoughtTranslate='ai' -> sets data-ag-prism-thought-view='bilingual'
      fs.writeFileSync(
        path.join(cfgDir, 'config.json'),
        JSON.stringify({ thoughtTranslate: 'ai', thoughtView: 'bilingual' }),
        'utf8'
      );
      const parsedOn = JSON.parse(execFileSync(probeExe, [cfgDir], { encoding: 'utf8' }));
      const resOn = vm.runInNewContext(parsedOn.exprOff, vmCtx);
      assert.equal(resOn.refreshed, true);
      assert.equal(htmlEl.getAttribute('data-ag-prism-thought-view'), 'bilingual');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
});
