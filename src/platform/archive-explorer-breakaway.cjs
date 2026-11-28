'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const EXPLORER_ARCHIVE_TASK_FILENAME = '.archive-task-explorer.json';

/**
 * Windows non-Watcher fallback: Node's detached spawn inherits Antigravity's Job Object
 * (JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE), killing the worker when Browser.close shuts down the host.
 * Delegating a static .cmd launcher via explorer.exe hands execution to the desktop shell outside the Job Object.
 */
function trySpawnWindowsExplorerBreakaway({
  targetPlatform,
  opts = {},
  archiveDir,
  defaultArchiveDir,
  scriptPath,
  safePayload,
  useElectronAsNode,
  cleanEnv,
  baseEnv = process.env,
  assertSafeHelperPath,
  atomicWriteJsonSync,
  writeActiveArchiveTask,
  cleanupTaskFile,
}) {
  if (targetPlatform !== 'win32' || opts.disableExplorerBreakaway) return null;
  const spawnFn = typeof opts.spawnFn === 'function' ? opts.spawnFn : spawn;
  const existsFn = typeof opts.existsSync === 'function' ? opts.existsSync : fs.existsSync;
  const resolvedDefault = path.resolve(opts.defaultArchiveDir || defaultArchiveDir);
  if (path.resolve(archiveDir).toLowerCase() !== resolvedDefault.toLowerCase()) return null;

  const launcherCmdPath = path.join(path.dirname(scriptPath), 'run-archive-task.cmd');
  if (!existsFn(launcherCmdPath)) return null;

  try {
    const safeLauncherCmd = assertSafeHelperPath(launcherCmdPath, 'launcherCmdPath');
    const explorerTaskFile = path.join(archiveDir, EXPLORER_ARCHIVE_TASK_FILENAME);
    atomicWriteJsonSync(explorerTaskFile, safePayload);
    if (typeof cleanupTaskFile === 'function') cleanupTaskFile();
    const sysRoot =
      typeof baseEnv.SystemRoot === 'string' && baseEnv.SystemRoot.trim() ? baseEnv.SystemRoot.trim() : '';
    const explorerCandidate = sysRoot ? path.join(sysRoot, 'explorer.exe') : '';
    const explorerExe = explorerCandidate && existsFn(explorerCandidate) ? explorerCandidate : 'explorer.exe';
    const child = spawnFn(explorerExe, [safeLauncherCmd], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: cleanEnv,
    });
    if (child && typeof child.on === 'function') child.on('error', () => {});
    if (child && typeof child.unref === 'function') child.unref();
    writeActiveArchiveTask(archiveDir, { action: safePayload.action, pid: 0 });
    return {
      spawned: true,
      pid: 0,
      method: 'explorer-breakaway',
      useElectronAsNode,
      taskFile: explorerTaskFile,
    };
  } catch {
    return null;
  }
}

function spawnDetachedArchiveWorkerProcess({
  targetPlatform,
  opts = {},
  safeNodeExec,
  scriptPath,
  taskFile,
  archiveDir,
  safePayload,
  useElectronAsNode,
  cleanEnv,
  assertSafeHelperPath,
  writeActiveArchiveTask,
  cleanupTaskFile,
}) {
  const spawnFn = typeof opts.spawnFn === 'function' ? opts.spawnFn : spawn;
  const safeTaskFile = targetPlatform === 'win32' ? assertSafeHelperPath(taskFile, 'taskFile') : taskFile;
  const spawnOpts = {
    detached: true,
    stdio: 'ignore',
    cwd: os.tmpdir(),
    env: cleanEnv,
    ...(targetPlatform === 'win32' ? { windowsHide: true } : {}),
  };

  try {
    const child = spawnFn(safeNodeExec, [scriptPath, `--run-task=${safeTaskFile}`], spawnOpts);
    if (child && typeof child.on === 'function') child.on('error', () => {});
    if (!child || !child.pid) {
      cleanupTaskFile();
      return { spawned: false, code: 'SPAWN_FAILED', error: 'Failed to launch detached archive worker', taskFile: '' };
    }
    if (typeof child.unref === 'function') child.unref();
    writeActiveArchiveTask(archiveDir, { action: safePayload.action, pid: child.pid });
    return { spawned: true, pid: child.pid, method: 'detached-spawn', useElectronAsNode, taskFile };
  } catch (err) {
    cleanupTaskFile();
    return { spawned: false, code: 'SPAWN_FAILED', error: String(err?.message || err), taskFile: '' };
  }
}

module.exports = {
  EXPLORER_ARCHIVE_TASK_FILENAME,
  trySpawnWindowsExplorerBreakaway,
  spawnDetachedArchiveWorkerProcess,
};
