import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const importRel = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

test('security-sidecar 1: translator-service blocks cross-origin saved API key reuse, bounds responses & strips thought_source tags', async () => {
  const { ThoughtTranslatorService } = await importRel('vendor/thought-translator/translator-service.mjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-sec-tr-'));
  try {
    const svc = new ThoughtTranslatorService({
      configFile: path.join(tmpDir, 'thought.json'),
      cacheFile: path.join(tmpDir, 'cache.json'),
    });
    const saved = svc.saveConfig({
      activeProfileId: 'p1',
      profiles: [
        {
          id: 'p1',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test-secret-0123456789abcdef',
          model: 'gpt-4o-mini',
        },
      ],
    });
    assert.notEqual(saved.ok, false);

    // Same-origin URL can reuse saved key when apiKey input is blank/masked
    const sameOrigin = svc._resolveEffectiveCredentials({
      profileId: 'p1',
      baseUrl: 'https://api.openai.com/v1/chat',
      apiKey: '',
    });
    assert.equal(sameOrigin.apiKey, 'sk-test-secret-0123456789abcdef');

    // Different-origin URL must NEVER inherit the previous provider's saved API key
    const crossOrigin = svc._resolveEffectiveCredentials({
      profileId: 'p1',
      baseUrl: 'https://evil.example.com/v1',
      apiKey: '',
    });
    assert.equal(crossOrigin.apiKey, '');

    // Bounded response reader must reject oversized payloads
    const fakeRes = {
      text: async () => 'x'.repeat(2048),
    };
    await assert.rejects(
      () => svc._readResponseTextBounded(fakeRes, 1024),
      /exceeded size limit/i
    );

    const src = fs.readFileSync(
      path.join(ROOT, 'vendor/thought-translator/translator-service.mjs'),
      'utf8'
    );
    assert.ok(
      src.includes('.replace(/<\\/?thought_source\\b[^>]*>/gi'),
      'translator-service must strip thought_source boundary tags from untrusted input'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('security-sidecar 2: omni-server blocks extended UNC bypasses, empty Host header & expanded exec/sensitive lists; workbench fails closed', async () => {
  const { OmniServer, isBlockedUncPath, isSensitiveFilePath } = await importRel('vendor/omni-viewer/omni-server.mjs');

  assert.equal(isBlockedUncPath('\\\\?\\GLOBAL\\UNC\\evil.local\\share\\a.txt'), true);
  assert.equal(isBlockedUncPath('\\\\?\\GLOBALROOT\\Device\\Mup\\evil.local\\share\\a.txt'), true);
  assert.equal(isBlockedUncPath('\\\\?\\GLOBAL\\UNC\\localhost\\share\\a.txt'), false);

  for (const name of ['.envrc', '.pgpass', '.bash_history', 'logins.json', 'key4.db', 'obsidian-prism-sidebar.json']) {
    assert.equal(isSensitiveFilePath(path.join(os.tmpdir(), name)), true, `Expected sensitive file blocked: ${name}`);
  }

  const srv = new OmniServer({ rootDir: ROOT });
  assert.equal(srv._isValidHostHeader({ headers: {} }), false, 'Missing Host header must fail closed');
  assert.equal(srv._isValidHostHeader({ headers: { host: '' } }), false, 'Empty Host header must fail closed');

  const blockedRes = await srv.handleRpcAction('openExternal', { target: '\\\\?\\GLOBAL\\UNC\\attacker.invalid\\x\\a.txt' });
  assert.equal(blockedRes.ok, false);
  assert.equal(blockedRes.blocked, true);

  const wbSrc = fs.readFileSync(
    path.join(ROOT, 'vendor/omni-viewer/workbench-page.mjs'),
    'utf8'
  );
  assert.ok(wbSrc.includes("lower.includes('image-set(')"), 'workbench must reject CSS image-set()');
  assert.ok(wbSrc.includes('MAX_PIXELS = 33554432'), 'workbench SVG rasterizer must enforce pixel cap');
  assert.ok(wbSrc.includes('showSandboxFail()'), 'workbench /sandbox-init failure must fail closed without falling back to /stream');
  assert.equal(
    wbSrc.includes("sandboxUrl = buildApiUrl('/stream')"),
    false,
    'workbench must not downgrade failed /sandbox-init to unsandboxed /stream'
  );
});

test('security-sidecar 3: sidebar-service blocks UNC paths & disables pick-folder in sandboxMode', async () => {
  const { SidebarStudioService } = await importRel('vendor/sidebar-studio/sidebar-service.mjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-sec-sb-'));
  try {
    const svc = new SidebarStudioService({
      statePath: path.join(tmpDir, 'sidebar.json'),
      sandboxMode: true,
    });
    const pickRes = await svc.handleAction('pick-folder', {});
    assert.equal(pickRes.ok, false);
    assert.match(String(pickRes.error?.message || pickRes.error || ''), /sandboxMode/i);

    const svcReal = new SidebarStudioService({
      statePath: path.join(tmpDir, 'sidebar-real.json'),
      sandboxMode: false,
    });
    const openRes = await svcReal.revealFolder({ path: '\\\\?\\GLOBAL\\UNC\\evil.invalid\\share' });
    assert.equal(openRes.ok, false);
    assert.match(String(openRes.error || ''), /无效/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('security-sidecar 4: update-service verifies SHA-256 in memory before writing executable to disk & inject.js enforces strict mainFrame gate', async () => {
  const { UpdateService } = await importRel('sidecars/daemon/update-service.mjs');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-sec-upd-'));
  try {
    const expectedSha = 'a'.repeat(64);
    const badPayload = Buffer.from('tampered-installer-binary');
    const svc = new UpdateService({
      currentVersion: '1.0.5',
      platform: 'win32',
      tmpRoot,
      fetchFn: async (url) => {
        if (String(url).includes('/releases/latest')) {
          return {
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({
              tag_name: 'v1.0.6',
              draft: false,
              prerelease: false,
              html_url: 'https://github.com/RMvdesi/obsidian-prism/releases/tag/v1.0.6',
              assets: [
                {
                  name: 'obsidian-prism-installer.exe',
                  browser_download_url: 'https://github.com/RMvdesi/obsidian-prism/releases/download/v1.0.6/obsidian-prism-installer.exe',
                  digest: `sha256:${expectedSha}`,
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Map(),
          arrayBuffer: async () => badPayload.buffer.slice(badPayload.byteOffset, badPayload.byteOffset + badPayload.byteLength),
        };
      },
      spawnFn: () => {
        throw new Error('spawnFn must NEVER be called on sha256_mismatch');
      },
    });
    const res = await svc.applyReleaseUpdate({ confirm: true });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'sha256_mismatch');
    assert.deepEqual(
      fs.readdirSync(tmpRoot),
      [],
      'Untrusted payload must fail SHA-256 in memory before creating any temp dir or writing .exe to disk'
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  const injectSrc = fs.readFileSync(path.join(ROOT, 'inject.js'), 'utf8');
  assert.ok(
    injectSrc.includes('isDefault: aux.isDefault === true'),
    'inject.js watch mode must require explicit aux.isDefault === true'
  );
  assert.ok(
    injectSrc.includes("if (SIDEBAR_BINDING && readConfig()?.sidebarStudio === 'on')"),
    'inject.js must not expose SIDEBAR_BINDING unless sidebarStudio is enabled'
  );
});
