#!/usr/bin/env node
// Build standalone Windows installer.exe & watcher.exe for Obsidian Prism (obsidian-prism).
// Zero external npm dependencies: uses built-in Node zlib + Windows .NET Framework csc.exe.
// Supports SignPath Foundation two-step signing:
//   Step 1: node scripts/build-installer.mjs --watcher-only --out dist/unsigned/obsidian-prism-watcher.exe
//   (Sign obsidian-prism-watcher.exe via SignPath)
//   Step 2: node scripts/build-installer.mjs --prebuilt-watcher dist/signed/obsidian-prism-watcher.exe --out dist/unsigned/obsidian-prism-installer.exe
//   (Sign obsidian-prism-installer.exe via SignPath)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseSemver } from './bump-version.mjs';
import {
  ROOT_DIR,
  cdp,
  VALIDATORS,
  createManifest,
  resolveActiveConfigFile,
  collectOptionalOmniTopEntries,
  collectNativePluginEntries,
  createInstallManifestPayload,
  INSTALL_MANIFEST_FILENAME,
  buildMultiResIco,
  buildZip,
} from './build-common.mjs';

const __filename = fileURLToPath(import.meta.url);

function findCsc() {
  const winDir = process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    path.join(winDir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(winDir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('csc.exe (.NET Framework 4.x) not found');
}

function resolveBuildVersion(overrideVersion = null) {
  let raw = overrideVersion;
  if (!raw) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
      if (pkg && typeof pkg.version === 'string' && pkg.version.trim()) {
        raw = pkg.version.trim();
      }
    } catch {}
  }
  const parsed = parseSemver(raw || cdp.PLUGIN_VERSION || '1.0.8-beta.4');
  if (!parsed) {
    throw new Error(`Invalid package version for PE metadata: "${raw}"`);
  }
  return parsed;
}

function escapeCSharpString(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function generateAssemblyInfoCs({ title, description, version, windows4 }) {
  const year = new Date().getUTCFullYear();
  return [
    'using System.Reflection;',
    '',
    `[assembly: AssemblyTitle("${escapeCSharpString(title)}")]`,
    `[assembly: AssemblyDescription("${escapeCSharpString(description)}")]`,
    '[assembly: AssemblyCompany("Obsidian Prism Open Source Contributors")]',
    '[assembly: AssemblyProduct("Obsidian Prism")]',
    `[assembly: AssemblyCopyright("Copyright (c) ${year} Obsidian Prism Contributors. Licensed under GPL-3.0-only.")]`,
    `[assembly: AssemblyVersion("${escapeCSharpString(windows4)}")]`,
    `[assembly: AssemblyFileVersion("${escapeCSharpString(windows4)}")]`,
    `[assembly: AssemblyInformationalVersion("${escapeCSharpString(version)}")]`,
    '',
  ].join('\n');
}

function compileWatcherBinary({ csc, icoPath, stageDir, watcherOut, verInfo }) {
  const watcherAsmInfoPath = path.join(stageDir, 'WatcherAssemblyInfo.cs');
  fs.writeFileSync(
    watcherAsmInfoPath,
    generateAssemblyInfoCs({
      title: 'Obsidian Prism Watcher',
      description: 'Obsidian Prism Background Optical Bridge Watcher for Antigravity',
      version: verInfo.version,
      windows4: verInfo.windows4,
    }),
    'utf8'
  );

  const watcherManifest = path.join(ROOT_DIR, 'installer', 'watcher', 'app.manifest');
  if (!fs.existsSync(watcherManifest)) {
    throw new Error(`Missing watcher application manifest: ${watcherManifest}`);
  }
  const commonMiniJson = path.join(ROOT_DIR, 'installer', 'common', 'MiniJson.cs');
  const commonCdpClient = path.join(ROOT_DIR, 'installer', 'common', 'CdpClient.cs');
  const commonRuntimeChannels = path.join(ROOT_DIR, 'installer', 'common', 'RuntimeChannels.cs');
  const watcherMain = path.join(ROOT_DIR, 'installer', 'watcher', 'Program.cs');
  const watcherPicker = path.join(ROOT_DIR, 'installer', 'watcher', 'FilePicker.cs');

  execFileSync(csc, [
    '/nologo',
    '/utf8output',
    '/codepage:65001',
    '/warnaserror',
    '/target:winexe',
    '/optimize+',
    `/win32icon:${icoPath}`,
    `/win32manifest:${watcherManifest}`,
    `/out:${watcherOut}`,
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Drawing.dll',
    '/r:System.Net.Http.dll',
    '/r:System.Windows.Forms.dll',
    watcherAsmInfoPath,
    commonMiniJson,
    commonCdpClient,
    commonRuntimeChannels,
    watcherMain,
    watcherPicker,
  ], { stdio: 'inherit' });
}

function resolveValidatedPrebuiltWatcher(prebuiltWatcherPath) {
  const resolved = path.resolve(prebuiltWatcherPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Prebuilt watcher binary not found: ${resolved}`);
  }
  const st = fs.lstatSync(resolved);
  if (st.isSymbolicLink() || !st.isFile() || st.size === 0) {
    throw new Error(`Prebuilt watcher must be a non-empty regular file: ${resolved}`);
  }
  return resolved;
}

function buildWatcher({ outputPath = path.join(ROOT_DIR, 'dist', 'obsidian-prism-watcher.exe'), version = null } = {}) {
  const csc = findCsc();
  const verInfo = resolveBuildVersion(version);
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-watcher-build-'));
  try {
    const icoPath = path.join(stageDir, 'app.ico');
    fs.writeFileSync(icoPath, buildMultiResIco());
    const watcherTemp = path.join(stageDir, 'obsidian-prism-watcher.exe');
    compileWatcherBinary({ csc, icoPath, stageDir, watcherOut: watcherTemp, verInfo });

    const resolvedOut = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.copyFileSync(watcherTemp, resolvedOut);
    const stat = fs.statSync(resolvedOut);
    return {
      mode: 'watcher-only',
      outputPath: resolvedOut,
      watcherPath: resolvedOut,
      sizeBytes: stat.size,
      watcherSizeBytes: stat.size,
      version: verInfo.version,
      windows4: verInfo.windows4,
    };
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

function buildInstaller({
  outputPath = path.join(ROOT_DIR, 'installer.exe'),
  configPath,
  watcherOnly = false,
  prebuiltWatcherPath = null,
  version = null,
} = {}) {
  if (watcherOnly) {
    return buildWatcher({ outputPath, version });
  }

  const csc = findCsc();
  const verInfo = resolveBuildVersion(version);
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-build-'));

  try {
    const icoPath = path.join(stageDir, 'app.ico');
    fs.writeFileSync(icoPath, buildMultiResIco());

    const manifest = createManifest();
    const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
    fs.writeFileSync(path.join(stageDir, 'manifest.json'), manifestJson, 'utf8');

    let watcherPath;
    if (prebuiltWatcherPath) {
      watcherPath = resolveValidatedPrebuiltWatcher(prebuiltWatcherPath);
    } else {
      watcherPath = path.join(stageDir, 'obsidian-prism-watcher.exe');
      compileWatcherBinary({ csc, icoPath, stageDir, watcherOut: watcherPath, verInfo });
    }

    const activeConfigFile = resolveActiveConfigFile(configPath);
    const optionalOmniTopEntries = collectOptionalOmniTopEntries();
    const watcherBytes = fs.readFileSync(watcherPath);

    const topEntries = [
      { name: 'obsidian-prism-watcher.exe', data: watcherBytes },
      { name: 'manifest.json', data: Buffer.from(manifestJson, 'utf8') },
      { name: 'style.css', data: Buffer.from(cdp.readCss(), 'utf8') },
      { name: 'config.json', data: fs.readFileSync(activeConfigFile) },
      { name: 'config.example.json', data: fs.readFileSync(path.join(ROOT_DIR, 'config.example.json')) },
      ...manifest.parts.map((part) => ({
        name: part,
        data: Buffer.from(cdp.prepareRuntimePart(part, fs.readFileSync(path.join(ROOT_DIR, part), 'utf8')), 'utf8'),
      })),
      ...optionalOmniTopEntries,
    ];
    const nativeEntries = collectNativePluginEntries(activeConfigFile);
    const installManifestPayload = createInstallManifestPayload({
      version: verInfo.version,
      installEntries: topEntries,
      pluginEntries: nativeEntries,
    });

    const payloadFiles = [
      ...topEntries,
      { name: INSTALL_MANIFEST_FILENAME, data: installManifestPayload.buffer },
      ...nativeEntries,
      { name: `native-plugin/${INSTALL_MANIFEST_FILENAME}`, data: installManifestPayload.buffer },
    ];

    const payloadZip = path.join(stageDir, 'payload.zip');
    fs.writeFileSync(payloadZip, buildZip(payloadFiles));

    const installerAsmInfoPath = path.join(stageDir, 'InstallerAssemblyInfo.cs');
    fs.writeFileSync(
      installerAsmInfoPath,
      generateAssemblyInfoCs({
        title: 'Obsidian Prism Installer',
        description: 'Obsidian Prism Standalone Installer & Uninstaller for Antigravity',
        version: verInfo.version,
        windows4: verInfo.windows4,
      }),
      'utf8'
    );

    const setupManifest = path.join(ROOT_DIR, 'installer', 'setup', 'app.manifest');
    const commonMiniJson = path.join(ROOT_DIR, 'installer', 'common', 'MiniJson.cs');
    const commonCdpClient = path.join(ROOT_DIR, 'installer', 'common', 'CdpClient.cs');
    const commonRuntimeChannels = path.join(ROOT_DIR, 'installer', 'common', 'RuntimeChannels.cs');
    const commonInstallManifest = path.join(ROOT_DIR, 'installer', 'common', 'InstallManifest.cs');
    const setupMain = path.join(ROOT_DIR, 'installer', 'setup', 'Program.cs');
    const tempOut = path.join(stageDir, 'installer.exe');

    execFileSync(csc, [
      '/nologo',
      '/utf8output',
      '/codepage:65001',
      '/warnaserror',
      '/target:winexe',
      '/optimize+',
      `/win32icon:${icoPath}`,
      `/win32manifest:${setupManifest}`,
      `/resource:${payloadZip},AGY_PAYLOAD.zip`,
      `/out:${tempOut}`,
      '/r:System.dll',
      '/r:System.Core.dll',
      '/r:System.Drawing.dll',
      '/r:System.IO.Compression.dll',
      '/r:System.IO.Compression.FileSystem.dll',
      '/r:System.Net.Http.dll',
      '/r:System.Windows.Forms.dll',
      installerAsmInfoPath,
      commonMiniJson,
      commonCdpClient,
      commonRuntimeChannels,
      commonInstallManifest,
      setupMain,
    ], { stdio: 'inherit' });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(tempOut, outputPath);
    const stat = fs.statSync(outputPath);
    return {
      mode: prebuiltWatcherPath ? 'prebuilt-watcher' : 'full',
      outputPath,
      sizeBytes: stat.size,
      watcherSizeBytes: watcherBytes.length,
      payloadZipBytes: fs.statSync(payloadZip).size,
      fileCount: payloadFiles.length,
      version: verInfo.version,
      windows4: verInfo.windows4,
      usedPrebuiltWatcher: Boolean(prebuiltWatcherPath),
    };
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let outputPath = null;
  let watcherOnly = false;
  let prebuiltWatcherPath = null;
  let version = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--out' || args[i] === '-o') && i + 1 < args.length) {
      outputPath = path.resolve(args[++i]);
    } else if (args[i] === '--watcher-only') {
      watcherOnly = true;
    } else if (args[i] === '--prebuilt-watcher' && i + 1 < args.length) {
      prebuiltWatcherPath = path.resolve(args[++i]);
    } else if (args[i] === '--version' && i + 1 < args.length) {
      version = args[++i];
    }
  }
  if (watcherOnly && prebuiltWatcherPath) {
    throw new Error('--watcher-only and --prebuilt-watcher cannot be combined');
  }
  const finalOut = outputPath || (
    watcherOnly
      ? path.join(ROOT_DIR, 'dist', 'obsidian-prism-watcher.exe')
      : path.join(ROOT_DIR, 'installer.exe')
  );
  const res = buildInstaller({ outputPath: finalOut, watcherOnly, prebuiltWatcherPath, version });
  if (watcherOnly) {
    console.log(
      `[✓] Built watcher ${res.outputPath} (${(res.sizeBytes / 1024).toFixed(1)} KB; v${res.version} / PE ${res.windows4})`
    );
  } else {
    console.log(
      `[✓] Built ${res.outputPath} (${(res.sizeBytes / 1024).toFixed(1)} KB; ` +
      `payload ${(res.payloadZipBytes / 1024).toFixed(1)} KB, ${res.fileCount} files; ` +
      `v${res.version} / PE ${res.windows4}${res.usedPrebuiltWatcher ? ', prebuilt watcher' : ''})`
    );
  }
}

export {
  VALIDATORS,
  generateAssemblyInfoCs,
  buildWatcher,
  buildInstaller,
  buildZip,
  buildMultiResIco,
};
