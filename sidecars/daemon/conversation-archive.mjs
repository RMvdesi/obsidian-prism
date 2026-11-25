#!/usr/bin/env node
/**
 * Obsidian Prism — Safe Antigravity Conversation Storage Health & Archiver
 *
 * 解决问题：
 *   Antigravity 官方 language_server.exe 启动时会把 ~/.gemini/antigravity/conversations/
 *   下的历史会话 .db（含大量不可见的后台子代理 / Swarm 子会话）加载进内存，长期积累易导致
 *   language_server.exe 开机即占 3~5 GB 内存。
 *
 * 安全红线（零数据丢失原则）：
 *   1. 绝不删除任何 .db 文件 —— 所有归档一律采用「移动备份 + manifest.json 清单」，随时可一键无损还原；
 *   2. 运行时 fail-closed 防锁破坏 —— 移动/还原前及每个会话处理前均复检 language_server 是否运行，
 *      任何检测命令失败/异常一律按“运行中”拒绝移动；
 *   3. 三件套捆绑移动 + 严控回滚异常 —— .db / .db-wal / .db-shm 同进同出，回滚失败显式升级并记录路径；
 *   4. 全路径链拒绝符号链接 + 排他随机临时文件 —— 逐级 lstatSync 拒绝祖先/末级 symlink，所有写盘均
 *      采用不可预测随机名 + O_EXCL ('wx') 排他创建；
 *   5. 唯一不可复用批次目录 + 默认仅归档已结束隐藏子代理 —— 100% 保留全部主对话。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DB_FILE_RE = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.db(?:-(wal|shm))?$/i;
const BATCH_NAME_RE = /^batch-[0-9T-]+(?:-[a-f0-9]{8})?$/;
const RUNNING_STATUS_RE = /RUNNING|IN_PROGRESS|ACTIVE/i;
const INDEX_FILENAME = '.last-catalog-index.json';
const WARN_TOTAL_MB = 1024;
const WARN_SUBAGENT_MB = 512;
const DEFAULT_SUBAGENT_MAX_AGE_HOURS = 6;
const DEFAULT_MAIN_MAX_AGE_DAYS = 14;
const DEFAULT_KEEP_RECENT_MAIN = 20;
const WIN_HOST_PROCESS_RE = /^(?:language_server[^"]*|antigravity|agy)\.exe$/i;
const POSIX_LS_RE = /(?:^|\/)language_server(?:[^\s/]*)?(?:\s|$)/i;
const POSIX_ANTIGRAVITY_APP_RE = /(?:^|\/)Antigravity(?:\s+Helper(?:\s+\([^)]+\))?)?\.app\/Contents\/MacOS\//i;
const POSIX_HOST_ARGV0_RE = /^(?:["']?)(?:\S*\/)?(?:antigravity(?:\.appimage)?|agy)(?:["']?)(?:\s|$)/i;
const POSIX_ELECTRON_APP_RE = /(?:^|\/)antigravity\/resources\/app/i;
const POSIX_SELF_SCRIPT_RE = /(?:^|[\/\s"'])(?:conversation-archive\.mjs|archive-subagents\.(?:sh|command)|restore-latest-archive\.(?:sh|command))(?:["'\s]|$)/i;

export function getDefaultAntigravityDir(homeDir = os.homedir()) {
  return path.join(homeDir, '.gemini', 'antigravity');
}

export function getDefaultConversationsDir(homeDir = os.homedir()) {
  return path.join(getDefaultAntigravityDir(homeDir), 'conversations');
}

export function getDefaultArchiveDir(homeDir = os.homedir()) {
  return path.join(getDefaultAntigravityDir(homeDir), 'conversations_archive');
}

function isDarwinSystemRootSymlink(curPath) {
  if (process.platform !== 'darwin') return false;
  if (curPath !== '/var' && curPath !== '/tmp') return false;
  try {
    const linkTarget = fs.readlinkSync(curPath);
    if (curPath === '/var') return linkTarget === 'private/var' || linkTarget === '/private/var';
    if (curPath === '/tmp') return linkTarget === 'private/tmp' || linkTarget === '/private/tmp';
  } catch {
    return false;
  }
  return false;
}

async function isDarwinSystemRootSymlinkAsync(curPath) {
  if (process.platform !== 'darwin') return false;
  if (curPath !== '/var' && curPath !== '/tmp') return false;
  try {
    const linkTarget = await fs.promises.readlink(curPath);
    if (curPath === '/var') return linkTarget === 'private/var' || linkTarget === '/private/var';
    if (curPath === '/tmp') return linkTarget === 'private/tmp' || linkTarget === '/private/tmp';
  } catch {
    return false;
  }
  return false;
}

async function assertPathChainNoSymlinksAsync(targetPath, label = 'path') {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const rel = resolved.slice(parsed.root.length);
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  let cur = parsed.root;
  let lastStat = null;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    try {
      const st = await fs.promises.lstat(cur);
      if (st.isSymbolicLink()) {
        if (await isDarwinSystemRootSymlinkAsync(cur)) {
          lastStat = await fs.promises.stat(cur);
          continue;
        }
        throw new Error(`Refusing symbolic link in ${label} chain: ${cur}`);
      }
      lastStat = st;
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        lastStat = null;
        break;
      }
      throw err;
    }
  }
  return lastStat;
}

function assertPathChainNoSymlinks(targetPath, label = 'path') {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const rel = resolved.slice(parsed.root.length);
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  let cur = parsed.root;
  let lastStat = null;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    try {
      const st = fs.lstatSync(cur);
      if (st.isSymbolicLink()) {
        if (isDarwinSystemRootSymlink(cur)) {
          lastStat = fs.statSync(cur);
          continue;
        }
        throw new Error(`Refusing symbolic link in ${label} chain: ${cur}`);
      }
      lastStat = st;
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        lastStat = null;
        break;
      }
      throw err;
    }
  }
  return lastStat;
}

function ensureSafeDir(dirPath) {
  const resolved = path.resolve(dirPath);
  const st = assertPathChainNoSymlinks(resolved, 'directory');
  if (!st) {
    fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
    const after = assertPathChainNoSymlinks(resolved, 'directory');
    if (!after || !after.isDirectory()) {
      throw new Error(`Failed to create safe directory: ${resolved}`);
    }
  } else if (!st.isDirectory()) {
    throw new Error(`Expected directory but found non-directory: ${resolved}`);
  }
  return resolved;
}

function createExclusiveBatchDir(archiveRoot, now = Date.now()) {
  const safeRoot = ensureSafeDir(archiveRoot);
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomBytes(4).toString('hex');
    const batchName = `batch-${stamp}-${suffix}`;
    const batchDir = path.join(safeRoot, batchName);
    try {
      fs.mkdirSync(batchDir, { mode: 0o700 });
      assertPathChainNoSymlinks(batchDir, 'batch directory');
      return { batchName, batchDir };
    } catch (err) {
      if (err && err.code === 'EEXIST') continue;
      throw err;
    }
  }
  throw new Error('Unable to allocate unique batch directory');
}

function atomicWriteTextExclusiveSync(filePath, text, mode = 0o600) {
  const resolved = path.resolve(filePath);
  assertPathChainNoSymlinks(resolved, 'target file');
  ensureSafeDir(path.dirname(resolved));
  const tmp = `${resolved}.tmp.${crypto.randomBytes(8).toString('hex')}`;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'wx', mode);
    fs.writeFileSync(fd, text, { encoding: 'utf8' });
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
    try { fs.chmodSync(tmp, mode); } catch {}
    fs.renameSync(tmp, resolved);
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

function withArchiveLock(archiveDir, fn) {
  const safeRoot = ensureSafeDir(archiveDir);
  const lockPath = path.join(safeRoot, '.archive.lock');
  assertPathChainNoSymlinks(lockPath, 'archive lock');
  let fd = null;
  try {
    fd = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n', 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch {} }
    if (err && err.code === 'EEXIST') {
      return {
        ok: false,
        code: 'ARCHIVE_LOCKED',
        error: `已有另一个归档/还原进程正在执行（锁文件存在：${lockPath}）。若确认无运行中进程，可手动移除该锁文件后重试。`,
      };
    }
    throw err;
  }
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

function atomicWriteJsonSync(filePath, data) {
  atomicWriteTextExclusiveSync(filePath, JSON.stringify(data, null, 2) + '\n', 0o600);
}

function safeMoveFileSync(src, dst) {
  const srcStat = assertPathChainNoSymlinks(src, 'source file');
  if (!srcStat || !srcStat.isFile()) {
    throw new Error(`Source is not a regular file: ${src}`);
  }
  const dstStat = assertPathChainNoSymlinks(dst, 'destination file');
  if (dstStat) {
    throw new Error(`Destination already exists: ${dst}`);
  }
  ensureSafeDir(path.dirname(dst));
  try {
    fs.renameSync(src, dst);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      const tmp = `${dst}.copy.${crypto.randomBytes(8).toString('hex')}`;
      try {
        fs.copyFileSync(src, tmp, fs.constants.COPYFILE_EXCL);
        const copied = fs.lstatSync(tmp);
        if (copied.isSymbolicLink() || !copied.isFile() || copied.size !== srcStat.size) {
          throw new Error(`Cross-device copy verification failed for ${path.basename(src)}`);
        }
        fs.renameSync(tmp, dst);
        fs.unlinkSync(src);
      } catch (copyErr) {
        try { fs.unlinkSync(tmp); } catch {}
        throw copyErr;
      }
      return;
    }
    throw err;
  }
}

export function parseWindowsTasklistCsv(csvText) {
  const text = String(csvText || '').trim();
  if (!text) return true; // unexpected empty output -> fail-closed
  let parsedCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = /^\s*"([^"]+)"\s*,\s*"\d+",/.exec(line);
    if (!m) continue;
    parsedCount++;
    if (WIN_HOST_PROCESS_RE.test(m[1])) {
      return true;
    }
  }
  // If tasklist returned non-CSV/error text with zero valid process rows -> fail-closed
  return parsedCount === 0;
}

export function parsePosixProcessList(psText, { selfPid = process.pid, selfPpid = process.ppid } = {}) {
  const text = String(psText || '').trim();
  if (!text) return true; // unexpected empty output -> fail-closed
  let parsedCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(.+)$/.exec(rawLine);
    if (!m) continue;
    parsedCount++;
    const pid = Number(m[1]);
    const cmd = m[2].trim();
    if (pid === selfPid) continue;
    // Exclude current archiver script or its helper shell wrapper to avoid self-match
    if (
      POSIX_SELF_SCRIPT_RE.test(cmd) &&
      (pid === selfPpid || /^(?:["']?)(?:\S*\/)?(?:node|bash|sh|zsh|env)(?:["']?)(?:\s|$)/i.test(cmd))
    ) {
      continue;
    }
    if (
      POSIX_LS_RE.test(cmd) ||
      POSIX_ANTIGRAVITY_APP_RE.test(cmd) ||
      POSIX_HOST_ARGV0_RE.test(cmd) ||
      POSIX_ELECTRON_APP_RE.test(cmd)
    ) {
      return true;
    }
  }
  return parsedCount === 0;
}

/**
 * Fail-closed check: returns true if language_server OR Antigravity/agy host is running,
 * or if process detection itself fails/errors/times out.
 * Note: offline CLI tool cannot enforce OS-level host startup mutex across closed-source
 * Antigravity; users must keep Antigravity closed until the archive command finishes.
 */
export function isLanguageServerRunning({
  platform = process.platform,
  exec = execFileSync,
  selfPid = process.pid,
  selfPpid = process.ppid,
} = {}) {
  try {
    if (platform === 'win32') {
      const out = exec(
        'tasklist.exe',
        ['/NH', '/FO', 'CSV'],
        { encoding: 'utf8', windowsHide: true, timeout: 6000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      return parseWindowsTasklistCsv(out);
    }
    const out = exec('ps', ['-eo', 'pid=,args='], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parsePosixProcessList(out, { selfPid, selfPpid });
  } catch {
    // Any process query failure (non-zero exit, ENOENT, timeout, ENOBUFS) fails closed (true)
    return true;
  }
}

function parseSummaryTimeMs(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw < 1e11 ? Math.floor(raw * 1000) : Math.floor(raw);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return 0;
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n < 1e11 ? Math.floor(n * 1000) : Math.floor(n);
    }
    const parsed = Date.parse(s);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  if (typeof raw === 'object') {
    const sec = Number(raw.seconds ?? raw.sec);
    if (Number.isFinite(sec) && sec > 0) {
      const nanos = Number(raw.nanos || 0);
      return Math.floor(sec * 1000 + (Number.isFinite(nanos) ? nanos / 1e6 : 0));
    }
  }
  return 0;
}

export function extractCatalogIndexFromSummaries(rawSummaries) {
  const map = {};
  const entries = Array.isArray(rawSummaries)
    ? rawSummaries.map((s) => [s?.id || s?.cascadeId || '', s])
    : Object.entries(rawSummaries || {});
  for (const [rawId, s] of entries) {
    const id = String(rawId || s?.id || s?.cascadeId || '').trim().toLowerCase();
    if (!GUID_RE.test(id) || !s || typeof s !== 'object') continue;
    const meta = s.trajectoryMetadata && typeof s.trajectoryMetadata === 'object' ? s.trajectoryMetadata : {};
    const parentId = String(
      s.parentConversationId ||
        meta.parentConversationId ||
        s.parentId ||
        s.parentCascadeId ||
        meta.parentCascadeId ||
        ''
    ).trim().toLowerCase();
    const rootId = String(
      s.rootConversationId ||
        meta.rootConversationId ||
        s.rootId ||
        s.rootCascadeId ||
        meta.rootCascadeId ||
        ''
    ).trim().toLowerCase();
    const subagent = Boolean(
      s.subagent ||
        parentId ||
        Number(meta.nestingDepth || s.nestingDepth || 0) > 0 ||
        s.isSubagent ||
        meta.isSubagent ||
        meta.subagentName
    );
    const lastModifiedMs =
      parseSummaryTimeMs(s.lastModifiedTime) ||
      parseSummaryTimeMs(s.modifiedAt) ||
      parseSummaryTimeMs(s.updatedAt) ||
      parseSummaryTimeMs(s.createdTime) ||
      0;
    map[id] = {
      subagent,
      ...(parentId ? { parentId } : {}),
      ...(rootId ? { rootId } : {}),
      status: String(s.status || ''),
      stepCount: Math.max(0, Number(s.stepCount ?? s.numTotalSteps ?? 0) || 0),
      title: String(s.summary || s.title || '').slice(0, 120),
      ...(lastModifiedMs > 0 ? { lastModifiedMs } : {}),
    };
  }
  return map;
}

export function saveCatalogIndex(archiveDir, rawSummaries) {
  const safeArchive = ensureSafeDir(archiveDir);
  const index = extractCatalogIndexFromSummaries(rawSummaries);
  const payload = {
    schema: 1,
    updatedAt: new Date().toISOString(),
    count: Object.keys(index).length,
    entries: index,
  };
  const indexPath = path.join(safeArchive, INDEX_FILENAME);
  atomicWriteJsonSync(indexPath, payload);
  return { indexPath, count: payload.count, entries: index };
}

export function loadCatalogIndex(archiveDir) {
  try {
    const indexPath = path.join(path.resolve(archiveDir), INDEX_FILENAME);
    const st = assertPathChainNoSymlinks(indexPath, 'catalog index');
    if (!st || !st.isFile()) return null;
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!parsed || parsed.schema !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loadCatalogIndexAsync(archiveDir) {
  try {
    const indexPath = path.join(path.resolve(archiveDir), INDEX_FILENAME);
    const st = await assertPathChainNoSymlinksAsync(indexPath, 'catalog index');
    if (!st || !st.isFile()) return null;
    const parsed = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
    if (!parsed || parsed.schema !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeNonNegativeThreshold(value, fallback, { integer = false } = {}) {
  if (value === null || value === undefined || typeof value === 'boolean') return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return integer ? Math.floor(n) : n;
}

const ASYNC_SCAN_LSTAT_CONCURRENCY = 24;
const TOP_CONSUMERS_LIMIT = 5;

function sanitizeTitleForReport(raw) {
  return String(raw || '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\b(?:sk|rk|pk|ak|AIza)[A-Za-z0-9_\-]{10,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._\-]{10,}\b/gi, 'Bearer [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

function buildStorageScanReport({
  safeConvDir,
  safeArchiveDir,
  catalogEntries,
  catalogUpdatedAt,
  groups,
  totalBytes,
  walBytes,
  fileCount,
  subagentMaxAgeHours,
  mainMaxAgeDays,
  keepRecentMain,
  excluded,
  now,
}) {
  const items = [];
  for (const g of groups.values()) {
    const info = catalogEntries ? catalogEntries[g.id] || null : null;
    const kind = info ? (info.subagent ? 'subagent' : 'main') : 'unknown';
    // Prefer authoritative host trajectory lastModifiedTime over filesystem mtime
    // (opening SQLite DBs on language_server startup touches .db-wal/.db-shm timestamps).
    const fileMtimeMs = g.dbMtimeMs || g.mtimeMs || 0;
    const activityMs = info && Number(info.lastModifiedMs) > 0 ? Number(info.lastModifiedMs) : fileMtimeMs;
    const ageMs = Math.max(0, now - activityMs);
    items.push({
      id: g.id,
      kind,
      subagent: kind === 'subagent',
      bytes: g.bytes,
      mb: Number((g.bytes / 1048576).toFixed(2)),
      mtimeMs: activityMs,
      ageHours: Number((ageMs / 3600000).toFixed(2)),
      ageDays: Number((ageMs / 86400000).toFixed(2)),
      status: info?.status || '',
      running: RUNNING_STATUS_RE.test(info?.status || ''),
      stepCount: info?.stepCount || 0,
      title: info?.title || '',
      parentId: info?.parentId || '',
      files: g.files,
      excluded: excluded.has(g.id),
    });
  }

  const safeKeepRecentMain = normalizeNonNegativeThreshold(keepRecentMain, DEFAULT_KEEP_RECENT_MAIN, { integer: true });
  const safeSubagentMaxAgeHours = normalizeNonNegativeThreshold(subagentMaxAgeHours, DEFAULT_SUBAGENT_MAX_AGE_HOURS);
  const safeMainMaxAgeDays = normalizeNonNegativeThreshold(mainMaxAgeDays, DEFAULT_MAIN_MAX_AGE_DAYS);

  const mainItems = items.filter((it) => it.kind === 'main').sort((a, b) => b.mtimeMs - a.mtimeMs);
  const protectedMainIds = new Set(mainItems.slice(0, safeKeepRecentMain).map((it) => it.id));

  const subagentMinAgeMs = safeSubagentMaxAgeHours * 3600000;
  const mainMinAgeMs = safeMainMaxAgeDays * 86400000;

  const archivableSubagents = [];
  const archivableOldMain = [];
  let subagentBytes = 0;
  let mainBytes = 0;
  let unknownBytes = 0;
  let subagentCount = 0;
  let mainCount = 0;
  let unknownCount = 0;

  for (const it of items) {
    if (it.kind === 'subagent') {
      subagentCount++;
      subagentBytes += it.bytes;
      if (!it.excluded && !it.running && now - it.mtimeMs >= subagentMinAgeMs) {
        archivableSubagents.push(it);
      }
    } else if (it.kind === 'main') {
      mainCount++;
      mainBytes += it.bytes;
      if (!it.excluded && !it.running && !protectedMainIds.has(it.id) && now - it.mtimeMs >= mainMinAgeMs) {
        archivableOldMain.push(it);
      }
    } else {
      unknownCount++;
      unknownBytes += it.bytes;
    }
  }

  archivableSubagents.sort((a, b) => b.bytes - a.bytes);
  archivableOldMain.sort((a, b) => b.bytes - a.bytes);

  const topConsumers = [...items]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, TOP_CONSUMERS_LIMIT)
    .map((it) => ({
      id: it.id,
      kind: it.kind,
      mb: it.mb,
      ageDays: it.ageDays,
      running: it.running,
      title: sanitizeTitleForReport(it.title),
    }));

  const totalMb = Number((totalBytes / 1048576).toFixed(1));
  const subagentMb = Number((subagentBytes / 1048576).toFixed(1));
  const mainMb = Number((mainBytes / 1048576).toFixed(1));
  const unknownMb = Number((unknownBytes / 1048576).toFixed(1));
  const archivableSubagentBytes = archivableSubagents.reduce((s, x) => s + x.bytes, 0);
  const archivableOldMainBytes = archivableOldMain.reduce((s, x) => s + x.bytes, 0);

  return {
    ok: true,
    convDir: safeConvDir,
    archiveDir: safeArchiveDir,
    hasCatalogIndex: Boolean(catalogEntries && Object.keys(catalogEntries).length > 0),
    catalogUpdatedAt,
    fileCount,
    conversationCount: items.length,
    totalBytes,
    totalMb,
    walMb: Number((walBytes / 1048576).toFixed(1)),
    mainCount,
    mainMb,
    subagentCount,
    subagentMb,
    unknownCount,
    unknownMb,
    archivableSubagentCount: archivableSubagents.length,
    archivableSubagentMb: Number((archivableSubagentBytes / 1048576).toFixed(1)),
    archivableOldMainCount: archivableOldMain.length,
    archivableOldMainMb: Number((archivableOldMainBytes / 1048576).toFixed(1)),
    warn: totalMb >= WARN_TOTAL_MB || subagentMb >= WARN_SUBAGENT_MB,
    warnThresholds: { totalMb: WARN_TOTAL_MB, subagentMb: WARN_SUBAGENT_MB },
    topConsumers,
    archivableSubagents,
    archivableOldMain,
  };
}

export function scanConversationStorage({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  summaries = null,
  subagentMaxAgeHours = DEFAULT_SUBAGENT_MAX_AGE_HOURS,
  mainMaxAgeDays = DEFAULT_MAIN_MAX_AGE_DAYS,
  keepRecentMain = DEFAULT_KEEP_RECENT_MAIN,
  excludeIds = [],
  now = Date.now(),
} = {}) {
  const safeConvDir = path.resolve(convDir);
  const safeArchiveDir = path.resolve(archiveDir);
  const convStat = assertPathChainNoSymlinks(safeConvDir, 'conversations directory');
  const excluded = new Set((excludeIds || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean));

  let catalogEntries = null;
  let catalogUpdatedAt = null;
  if (summaries && typeof summaries === 'object') {
    catalogEntries = extractCatalogIndexFromSummaries(summaries);
    catalogUpdatedAt = new Date(now).toISOString();
  } else {
    const loaded = loadCatalogIndex(safeArchiveDir);
    if (loaded) {
      catalogEntries = loaded.entries;
      catalogUpdatedAt = loaded.updatedAt || null;
    }
  }

  const groups = new Map();
  let totalBytes = 0;
  let walBytes = 0;
  let fileCount = 0;

  if (convStat && convStat.isDirectory()) {
    for (const dirent of fs.readdirSync(safeConvDir, { withFileTypes: true })) {
      if (dirent.isSymbolicLink() || !dirent.isFile()) continue;
      const m = DB_FILE_RE.exec(dirent.name);
      if (!m) continue;
      const id = m[1].toLowerCase();
      const suffix = m[2] ? m[2].toLowerCase() : 'db';
      const fullPath = path.join(safeConvDir, dirent.name);
      let st;
      try {
        st = fs.lstatSync(fullPath);
        if (st.isSymbolicLink() || !st.isFile()) continue;
      } catch {
        continue;
      }
      fileCount++;
      totalBytes += st.size;
      if (suffix === 'wal' || suffix === 'shm') walBytes += st.size;
      let g = groups.get(id);
      if (!g) {
        g = { id, files: [], bytes: 0, mtimeMs: 0, dbMtimeMs: 0, hasDb: false };
        groups.set(id, g);
      }
      g.files.push({ name: dirent.name, bytes: st.size, suffix });
      g.bytes += st.size;
      if (suffix === 'db') {
        g.hasDb = true;
        if (st.mtimeMs > g.dbMtimeMs) g.dbMtimeMs = st.mtimeMs;
      }
      if (suffix !== 'shm' && st.mtimeMs > g.mtimeMs) g.mtimeMs = st.mtimeMs;
    }
  }

  return buildStorageScanReport({
    safeConvDir,
    safeArchiveDir,
    catalogEntries,
    catalogUpdatedAt,
    groups,
    totalBytes,
    walBytes,
    fileCount,
    subagentMaxAgeHours,
    mainMaxAgeDays,
    keepRecentMain,
    excluded,
    now,
  });
}

export async function scanConversationStorageAsync({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  summaries = null,
  subagentMaxAgeHours = DEFAULT_SUBAGENT_MAX_AGE_HOURS,
  mainMaxAgeDays = DEFAULT_MAIN_MAX_AGE_DAYS,
  keepRecentMain = DEFAULT_KEEP_RECENT_MAIN,
  excludeIds = [],
  now = Date.now(),
  concurrency = ASYNC_SCAN_LSTAT_CONCURRENCY,
} = {}) {
  const safeConvDir = path.resolve(convDir);
  const safeArchiveDir = path.resolve(archiveDir);
  const convStat = await assertPathChainNoSymlinksAsync(safeConvDir, 'conversations directory');
  const excluded = new Set((excludeIds || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean));

  let catalogEntries = null;
  let catalogUpdatedAt = null;
  if (summaries && typeof summaries === 'object') {
    catalogEntries = extractCatalogIndexFromSummaries(summaries);
    catalogUpdatedAt = new Date(now).toISOString();
  } else {
    const loaded = await loadCatalogIndexAsync(safeArchiveDir);
    if (loaded) {
      catalogEntries = loaded.entries;
      catalogUpdatedAt = loaded.updatedAt || null;
    }
  }

  const groups = new Map();
  let totalBytes = 0;
  let walBytes = 0;
  let fileCount = 0;

  if (convStat && convStat.isDirectory()) {
    const dirents = await fs.promises.readdir(safeConvDir, { withFileTypes: true });
    const candidates = [];
    for (const dirent of dirents) {
      if (dirent.isSymbolicLink() || !dirent.isFile()) continue;
      const m = DB_FILE_RE.exec(dirent.name);
      if (!m) continue;
      candidates.push({
        name: dirent.name,
        id: m[1].toLowerCase(),
        suffix: m[2] ? m[2].toLowerCase() : 'db',
        fullPath: path.join(safeConvDir, dirent.name),
      });
    }

    const stats = new Array(candidates.length).fill(null);
    const maxWorkers = Math.max(1, Math.min(Number(concurrency) || ASYNC_SCAN_LSTAT_CONCURRENCY, candidates.length));
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= candidates.length) return;
        try {
          const st = await fs.promises.lstat(candidates[idx].fullPath);
          if (!st.isSymbolicLink() && st.isFile()) {
            stats[idx] = st;
          }
        } catch {}
      }
    };
    if (candidates.length > 0) {
      await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
    }

    for (let i = 0; i < candidates.length; i++) {
      const st = stats[i];
      if (!st) continue;
      const { name, id, suffix } = candidates[i];
      fileCount++;
      totalBytes += st.size;
      if (suffix === 'wal' || suffix === 'shm') walBytes += st.size;
      let g = groups.get(id);
      if (!g) {
        g = { id, files: [], bytes: 0, mtimeMs: 0, dbMtimeMs: 0, hasDb: false };
        groups.set(id, g);
      }
      g.files.push({ name, bytes: st.size, suffix });
      g.bytes += st.size;
      if (suffix === 'db') {
        g.hasDb = true;
        if (st.mtimeMs > g.dbMtimeMs) g.dbMtimeMs = st.mtimeMs;
      }
      if (suffix !== 'shm' && st.mtimeMs > g.mtimeMs) g.mtimeMs = st.mtimeMs;
    }
  }

  return buildStorageScanReport({
    safeConvDir,
    safeArchiveDir,
    catalogEntries,
    catalogUpdatedAt,
    groups,
    totalBytes,
    walBytes,
    fileCount,
    subagentMaxAgeHours,
    mainMaxAgeDays,
    keepRecentMain,
    excluded,
    now,
  });
}

function collectLiveCompanionFiles(convDir, id) {
  const suffixes = ['.db', '.db-wal', '.db-shm'];
  const found = [];
  for (const sfx of suffixes) {
    const name = `${id}${sfx}`;
    const full = path.join(convDir, name);
    const st = assertPathChainNoSymlinks(full, 'conversation file');
    if (st && st.isFile()) {
      found.push({ name, bytes: st.size });
    }
  }
  return found;
}

export function archiveConversations({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  summaries = null,
  mode = 'subagents',
  subagentMaxAgeHours = 6,
  mainMaxAgeDays = 14,
  keepRecentMain = 20,
  excludeIds = [],
  dryRun = false,
  now = Date.now(),
  checkRunning = isLanguageServerRunning,
} = {}) {
  const scan = scanConversationStorage({
    convDir,
    archiveDir,
    summaries,
    subagentMaxAgeHours,
    mainMaxAgeDays,
    keepRecentMain,
    excludeIds,
    now,
  });

  if (!scan.hasCatalogIndex) {
    return {
      ok: false,
      code: 'NO_CATALOG_INDEX',
      error: '未找到会话分类索引（无法区分隐藏子代理与主对话）。请在 Antigravity 运行时先执行 --prepare 或在设置面板点击「生成归档脚本」刷新索引。',
      scan,
    };
  }

  const targets =
    mode === 'subagents+old-main'
      ? [...scan.archivableSubagents, ...scan.archivableOldMain]
      : [...scan.archivableSubagents];

  const targetBytes = targets.reduce((s, x) => s + x.bytes, 0);
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      mode,
      candidateCount: targets.length,
      candidateMb: Number((targetBytes / 1048576).toFixed(1)),
      remainingEstimatedMb: Number(Math.max(0, (scan.totalBytes - targetBytes) / 1048576).toFixed(1)),
      targets: targets.map((t) => ({ id: t.id, kind: t.kind, mb: t.mb, ageHours: t.ageHours, title: t.title })),
      scan,
    };
  }

  const isRunning = () => {
    try {
      return typeof checkRunning === 'function' ? Boolean(checkRunning()) : isLanguageServerRunning();
    } catch {
      return true; // fail-closed
    }
  };

  if (isRunning()) {
    return {
      ok: false,
      code: 'LANGUAGE_SERVER_RUNNING',
      error: '检测到 language_server 正在运行（或进程状态无法确认）。为防止损坏数据，请先完全退出 Antigravity，再运行归档脚本！',
      candidateCount: targets.length,
      candidateMb: Number((targetBytes / 1048576).toFixed(1)),
    };
  }

  if (targets.length === 0) {
    return {
      ok: true,
      dryRun: false,
      mode,
      movedCount: 0,
      movedMb: 0,
      batchDir: null,
      message: '当前没有符合归档条件的旧子代理或过期会话，无需移动。',
    };
  }

  return withArchiveLock(scan.archiveDir, () => {
    const { batchName, batchDir } = createExclusiveBatchDir(scan.archiveDir, now);
    const manifestPath = path.join(batchDir, 'manifest.json');
    const movedItems = [];
    const failedItems = [];
    const partialSplits = [];
    let movedBytes = 0;
    let abortedByHostRestart = false;

    const persistManifest = (status) => {
      const m = {
        schema: 1,
        status,
        batchName,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date().toISOString(),
        mode,
        sourceConvDir: scan.convDir,
        movedCount: movedItems.length,
        movedBytes,
        movedMb: Number((movedBytes / 1048576).toFixed(1)),
        failedCount: failedItems.length,
        rollbackFailed: partialSplits.length > 0,
        abortedByHostRestart,
        partialSplits,
        items: movedItems,
      };
      atomicWriteJsonSync(manifestPath, m);
      return m;
    };

    // Write pre-move journal manifest BEFORE moving any file so crashes are always discoverable
    persistManifest('in-progress');

    for (const item of targets) {
      if (isRunning()) {
        abortedByHostRestart = true;
        failedItems.push({ id: item.id, error: 'LANGUAGE_SERVER_STARTED_MID_ARCHIVE' });
        break;
      }
      let liveFiles;
      try {
        liveFiles = collectLiveCompanionFiles(scan.convDir, item.id);
      } catch (err) {
        failedItems.push({ id: item.id, error: err?.message || String(err) });
        continue;
      }
      if (liveFiles.length === 0) continue;

      const movedFiles = [];
      let itemFailed = null;
      for (const f of liveFiles) {
        const src = path.join(scan.convDir, f.name);
        const dst = path.join(batchDir, f.name);
        try {
          safeMoveFileSync(src, dst);
          movedFiles.push(f.name);
        } catch (err) {
          itemFailed = err?.message || String(err);
          const rollbackErrors = [];
          for (const backName of [...movedFiles].reverse()) {
            try {
              safeMoveFileSync(path.join(batchDir, backName), path.join(scan.convDir, backName));
            } catch (rbErr) {
              rollbackErrors.push({
                file: backName,
                stuckAt: path.join(batchDir, backName),
                expectedAt: path.join(scan.convDir, backName),
                error: rbErr?.message || String(rbErr),
              });
            }
          }
          if (rollbackErrors.length > 0) {
            partialSplits.push({ id: item.id, originalError: itemFailed, rollbackErrors });
          }
          break;
        }
      }
      if (itemFailed) {
        failedItems.push({ id: item.id, error: itemFailed });
      } else {
        const bundleBytes = liveFiles.reduce((s, f) => s + f.bytes, 0);
        movedBytes += bundleBytes;
        movedItems.push({
          id: item.id,
          kind: item.kind,
          bytes: bundleBytes,
          mb: Number((bundleBytes / 1048576).toFixed(2)),
          title: item.title,
          parentId: item.parentId,
          files: movedFiles,
        });
      }
      // Incrementally commit manifest after each conversation so crash recovery never loses track
      persistManifest('in-progress');
      if (isRunning()) {
        abortedByHostRestart = true;
        break;
      }
    }

    const finalManifest = persistManifest(abortedByHostRestart ? 'aborted' : 'completed');

    return {
      ok: failedItems.length === 0 && partialSplits.length === 0 && !abortedByHostRestart,
      ...(partialSplits.length > 0 ? { code: 'ROLLBACK_FAILED', error: '部分会话三件套回滚失败，请按 manifest.json 中的 partialSplits 核对文件位置。' } : {}),
      ...(abortedByHostRestart ? { code: 'LANGUAGE_SERVER_RUNNING', error: '归档途中检测到 Antigravity/language_server 启动，已立即中止剩余移动；已完成部分可通过 --restore latest 还原。' } : {}),
      dryRun: false,
      mode,
      batchName,
      batchDir,
      movedCount: movedItems.length,
      movedMb: finalManifest.movedMb,
      failedItems,
      partialSplits,
      remainingEstimatedMb: Number(Math.max(0, (scan.totalBytes - movedBytes) / 1048576).toFixed(1)),
    };
  });
}

function scanBatchDirForFallbackItems(batchDir) {
  const byId = new Map();
  let totalBytes = 0;
  for (const dirent of fs.readdirSync(batchDir, { withFileTypes: true })) {
    if (dirent.isSymbolicLink() || !dirent.isFile()) continue;
    const m = DB_FILE_RE.exec(dirent.name);
    if (!m) continue;
    const id = m[1].toLowerCase();
    const st = fs.lstatSync(path.join(batchDir, dirent.name));
    if (st.isSymbolicLink() || !st.isFile()) continue;
    totalBytes += st.size;
    let rec = byId.get(id);
    if (!rec) {
      rec = { id, files: [], bytes: 0 };
      byId.set(id, rec);
    }
    rec.files.push(dirent.name);
    rec.bytes += st.size;
  }
  return { items: [...byId.values()], totalBytes };
}

export function listArchiveBatches(archiveDir = getDefaultArchiveDir()) {
  const safeArchiveRoot = path.resolve(archiveDir);
  const st = assertPathChainNoSymlinks(safeArchiveRoot, 'archive directory');
  if (!st || !st.isDirectory()) return [];
  const batches = [];
  for (const dirent of fs.readdirSync(safeArchiveRoot, { withFileTypes: true })) {
    if (dirent.isSymbolicLink() || !dirent.isDirectory() || !BATCH_NAME_RE.test(dirent.name)) continue;
    const batchDir = path.join(safeArchiveRoot, dirent.name);
    const manifestPath = path.join(batchDir, 'manifest.json');
    let parsed = null;
    try {
      const mStat = assertPathChainNoSymlinks(manifestPath, 'batch manifest');
      if (mStat && mStat.isFile()) {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (raw && raw.schema === 1) parsed = raw;
      }
    } catch {}
    if (parsed) {
      batches.push({
        batchName: dirent.name,
        batchDir,
        status: parsed.status || 'completed',
        createdAt: parsed.createdAt || '',
        mode: parsed.mode || 'subagents',
        movedCount: Number(parsed.movedCount || 0),
        movedMb: Number(parsed.movedMb || 0),
        rollbackFailed: Boolean(parsed.rollbackFailed),
      });
    } else {
      // Crash-recovery discovery: surface batches containing orphaned DB files even if manifest is absent/corrupt
      try {
        const fb = scanBatchDirForFallbackItems(batchDir);
        if (fb.items.length > 0) {
          batches.push({
            batchName: dirent.name,
            batchDir,
            status: 'recovered-no-manifest',
            createdAt: '',
            mode: 'unknown',
            movedCount: fb.items.length,
            movedMb: Number((fb.totalBytes / 1048576).toFixed(1)),
            rollbackFailed: false,
          });
        }
      } catch {}
    }
  }
  batches.sort((a, b) => String(b.batchName).localeCompare(String(a.batchName)));
  return batches;
}

export function restoreArchiveBatch({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  batchName = 'latest',
  checkRunning = isLanguageServerRunning,
} = {}) {
  const isRunning = () => {
    try {
      return typeof checkRunning === 'function' ? Boolean(checkRunning()) : isLanguageServerRunning();
    } catch {
      return true; // fail-closed
    }
  };
  if (isRunning()) {
    return {
      ok: false,
      code: 'LANGUAGE_SERVER_RUNNING',
      error: '检测到 Antigravity/language_server 正在运行（或状态无法确认）。请先完全退出 Antigravity，再执行一键还原。',
    };
  }
  const safeConvDir = ensureSafeDir(convDir);
  const safeArchiveRoot = path.resolve(archiveDir);
  return withArchiveLock(safeArchiveRoot, () => {
    const batches = listArchiveBatches(safeArchiveRoot);
    if (batches.length === 0) {
      return { ok: false, code: 'NO_BATCH', error: '未找到任何历史归档批次。' };
    }
    const chosen =
      batchName === 'latest'
        ? batches[0]
        : BATCH_NAME_RE.test(String(batchName || ''))
        ? batches.find((b) => b.batchName === batchName)
        : null;
    if (!chosen) {
      return { ok: false, code: 'BATCH_NOT_FOUND', error: `未找到指定归档批次: ${batchName}` };
    }
    const manifestPath = path.join(chosen.batchDir, 'manifest.json');
    let restoreItems = [];
    try {
      const mStat = assertPathChainNoSymlinks(manifestPath, 'batch manifest');
      if (mStat && mStat.isFile()) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest && Array.isArray(manifest.items) && manifest.items.length > 0 && manifest.status === 'completed') {
          restoreItems = manifest.items;
        }
      }
    } catch {}
    // For missing/corrupt/in-progress manifests, synthesize directly from live files inside batchDir
    if (restoreItems.length === 0) {
      restoreItems = scanBatchDirForFallbackItems(chosen.batchDir).items;
    }

    const restored = [];
    const skipped = [];
    const failed = [];
    const partialSplits = [];

    for (const item of restoreItems) {
      if (isRunning()) {
        failed.push({ id: item.id, error: 'LANGUAGE_SERVER_STARTED_MID_RESTORE' });
        break;
      }
      const files = (Array.isArray(item.files) ? item.files : []).filter((fn) => typeof fn === 'string' && DB_FILE_RE.test(fn));
      if (files.length === 0) continue;
      const anyConflict = files.some((fn) => fs.existsSync(path.join(safeConvDir, fn)));
      if (anyConflict) {
        skipped.push({ id: item.id, reason: 'destination-exists' });
        continue;
      }
      const doneFiles = [];
      let errMsg = null;
      for (const fn of files) {
        const src = path.join(chosen.batchDir, fn);
        const dst = path.join(safeConvDir, fn);
        if (!fs.existsSync(src)) continue;
        try {
          safeMoveFileSync(src, dst);
          doneFiles.push(fn);
        } catch (err) {
          errMsg = err?.message || String(err);
          const rollbackErrors = [];
          for (const bfn of [...doneFiles].reverse()) {
            try {
              safeMoveFileSync(path.join(safeConvDir, bfn), path.join(chosen.batchDir, bfn));
            } catch (rbErr) {
              rollbackErrors.push({
                file: bfn,
                stuckAt: path.join(safeConvDir, bfn),
                expectedAt: path.join(chosen.batchDir, bfn),
                error: rbErr?.message || String(rbErr),
              });
            }
          }
          if (rollbackErrors.length > 0) {
            partialSplits.push({ id: item.id, originalError: errMsg, rollbackErrors });
          }
          break;
        }
      }
      if (errMsg) failed.push({ id: item.id, error: errMsg });
      else if (doneFiles.length > 0) restored.push(item.id);
    }

    return {
      ok: failed.length === 0 && partialSplits.length === 0,
      batchName: chosen.batchName,
      restoredCount: restored.length,
      skippedCount: skipped.length,
      failed,
      partialSplits,
    };
  });
}

function assertSafeHelperPath(p, label) {
  const s = String(p || '');
  if (!s || /[\r\n\0"&|<>^`$;!]/.test(s)) {
    throw new Error(`Unsafe characters in ${label}: refusing to generate shell script`);
  }
  return s;
}

function escapeBatchArg(p) {
  return `"${p.replace(/%/g, '%%')}"`;
}

function escapePosixSingleQuoted(p) {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

export function validateBatchSelector(batchName = 'latest') {
  const raw = String(batchName || 'latest').trim();
  if (raw === 'latest') return 'latest';
  if (BATCH_NAME_RE.test(raw)) return raw;
  throw new Error(`Invalid archive batch name: ${raw.slice(0, 64)}`);
}

export function writeHelperScripts({
  scriptPath,
  archiveDir = getDefaultArchiveDir(),
  nodeExecPath = process.execPath,
  mode = 'subagents',
  mainDays = DEFAULT_MAIN_MAX_AGE_DAYS,
  keepRecentMain = DEFAULT_KEEP_RECENT_MAIN,
  restoreBatch = 'latest',
} = {}) {
  const safeArchive = ensureSafeDir(archiveDir);
  const absScript = assertSafeHelperPath(path.resolve(scriptPath), 'scriptPath');
  const isElectronHost = /antigravity(?:\.exe)?$/i.test(path.basename(nodeExecPath || ''));
  const safeNodeExec = isElectronHost ? 'node' : assertSafeHelperPath(path.resolve(nodeExecPath), 'nodeExecPath');
  const safeMode = mode === 'subagents+old-main' ? 'subagents+old-main' : 'subagents';
  const safeMainDays = normalizeNonNegativeThreshold(mainDays, DEFAULT_MAIN_MAX_AGE_DAYS, { integer: true });
  const safeKeepMain = normalizeNonNegativeThreshold(keepRecentMain, DEFAULT_KEEP_RECENT_MAIN, { integer: true });
  const safeRestoreBatch = validateBatchSelector(restoreBatch);
  const archiveFlags =
    safeMode === 'subagents+old-main'
      ? `--archive --wait-exit --include-old-main --subagent-hours=1 --main-days=${safeMainDays} --keep-main=${safeKeepMain}`
      : '--archive --wait-exit --subagent-hours=1';
  const restoreFlags = `--restore ${safeRestoreBatch} --wait-exit`;

  if (process.platform === 'win32') {
    const nodeCmd = safeNodeExec === 'node' ? 'node' : escapeBatchArg(safeNodeExec);
    const scriptArg = escapeBatchArg(absScript);
    const archiveCmdPath = path.join(safeArchive, '归档旧子代理释放内存.cmd');
    const restoreCmdPath = path.join(safeArchive, '一键还原最近归档.cmd');
    const archiveCmd = [
      '@echo off',
      'setlocal DisableDelayedExpansion',
      'chcp 65001 >nul',
      'echo ============================================================',
      'echo  Obsidian Prism — Antigravity 对话库安全归档工具（只移动不删除）',
      'echo ============================================================',
      'echo  请确认已完全关闭 Antigravity（等待 language_server.exe 退出）',
      'echo.',
      `${nodeCmd} ${scriptArg} ${archiveFlags}`,
      'echo.',
      'pause',
      '',
    ].join('\r\n');
    const restoreCmd = [
      '@echo off',
      'setlocal DisableDelayedExpansion',
      'chcp 65001 >nul',
      'echo ============================================================',
      `echo  Obsidian Prism — 一键无损还原对话归档 (${safeRestoreBatch})`,
      'echo ============================================================',
      'echo  请确认已完全关闭 Antigravity',
      'echo.',
      `${nodeCmd} ${scriptArg} ${restoreFlags}`,
      'echo.',
      'pause',
      '',
    ].join('\r\n');
    atomicWriteTextExclusiveSync(archiveCmdPath, archiveCmd, 0o600);
    atomicWriteTextExclusiveSync(restoreCmdPath, restoreCmd, 0o600);
    return {
      archiveScriptPath: archiveCmdPath,
      restoreScriptPath: restoreCmdPath,
      archiveDir: safeArchive,
      mode: safeMode,
      restoreBatch: safeRestoreBatch,
    };
  }

  const ext = process.platform === 'darwin' ? '.command' : '.sh';
  const nodeCmd = safeNodeExec === 'node' ? 'node' : escapePosixSingleQuoted(safeNodeExec);
  const scriptArg = escapePosixSingleQuoted(absScript);
  const archiveShPath = path.join(safeArchive, `archive-subagents${ext}`);
  const restoreShPath = path.join(safeArchive, `restore-latest-archive${ext}`);
  const archiveSh = `#!/usr/bin/env bash\nset -euo pipefail\n${nodeCmd} ${scriptArg} ${archiveFlags}\n`;
  const restoreSh = `#!/usr/bin/env bash\nset -euo pipefail\n${nodeCmd} ${scriptArg} ${restoreFlags}\n`;
  atomicWriteTextExclusiveSync(archiveShPath, archiveSh, 0o700);
  atomicWriteTextExclusiveSync(restoreShPath, restoreSh, 0o700);
  return {
    archiveScriptPath: archiveShPath,
    restoreScriptPath: restoreShPath,
    archiveDir: safeArchive,
    mode: safeMode,
    restoreBatch: safeRestoreBatch,
  };
}

const STORAGE_WB_I18N = {
  'zh-CN': {
    summary: '存储明细与无损归档工作台',
    archiveOldMain: '含>14天旧主对话',
    restoreBtn: '生成还原脚本',
    refreshBtn: '刷新',
    restoreReadyTpl: '还原脚本就绪 ({0})：{1}（关闭宿主后运行）',
    breakdown: '空间构成',
    main: '主对话',
    subagent: '隐藏子代理',
    wal: 'WAL日志',
    unknown: '未索引',
    archivable: '可安全归档',
    archSub: '已结束子代理 (>1h)',
    archOld: '>14天旧主对话 (保留最近20条)',
    topTitle: '体积 Top 5 会话（只读）',
    batchTitle: '历史无损归档批次',
    none: '暂无',
    hint: '安全红线：只移动不删除，支持按批次一键无损还原；请在关闭 Antigravity 后运行脚本。',
  },
  'zh-TW': {
    summary: '儲存明細與無損歸檔工作台',
    archiveOldMain: '含>14天舊主對話',
    restoreBtn: '產生還原腳本',
    refreshBtn: '重新整理',
    restoreReadyTpl: '還原腳本就緒 ({0})：{1}（關閉宿主後執行）',
    breakdown: '空間構成',
    main: '主對話',
    subagent: '隱藏子代理',
    wal: 'WAL日誌',
    unknown: '未索引',
    archivable: '可安全歸檔',
    archSub: '已結束子代理 (>1h)',
    archOld: '>14天舊主對話 (保留最近20筆)',
    topTitle: '體積 Top 5 會話（唯讀）',
    batchTitle: '歷史無損歸檔批次',
    none: '暫無',
    hint: '安全紅線：只移動不刪除，支援按批次一鍵無損還原；請先關閉 Antigravity 再執行腳本。',
  },
  yue: {
    summary: '儲存明細同無損歸檔工作台',
    archiveOldMain: '連>14日舊主對話',
    restoreBtn: '產生還原腳本',
    refreshBtn: '重新整理',
    restoreReadyTpl: '還原腳本就緒 ({0})：{1}（閂咗宿主之後行）',
    breakdown: '空間構成',
    main: '主對話',
    subagent: '隱藏子代理',
    wal: 'WAL日誌',
    unknown: '未索引',
    archivable: '可安全歸檔',
    archSub: '已結束子代理 (>1h)',
    archOld: '>14日舊主對話 (留返最近20個)',
    topTitle: '體積 Top 5 對話（唯讀）',
    batchTitle: '歷史無損歸檔批次',
    none: '暫時冇',
    hint: '安全紅線：只搬移唔刪除，隨時可以按批次無損還原；請先閂晒 Antigravity 再行腳本。',
  },
  en: {
    summary: 'Storage Details & Lossless Archive Workbench',
    archiveOldMain: 'Include >14d Main',
    restoreBtn: 'Restore Script',
    refreshBtn: 'Refresh',
    restoreReadyTpl: 'Restore script ready ({0}): {1} (quit host first)',
    breakdown: 'Breakdown',
    main: 'Main',
    subagent: 'Subagents',
    wal: 'WAL',
    unknown: 'Unindexed',
    archivable: 'Archivable',
    archSub: 'Finished subagents (>1h)',
    archOld: 'Old main >14d (keeps latest 20)',
    topTitle: 'Top 5 Largest Conversations (Read-only)',
    batchTitle: 'Lossless Archive Batches',
    none: 'None',
    hint: 'Zero-loss policy: move-only with manifest.json; quit Antigravity before running helper scripts.',
  },
  ja: {
    summary: 'ストレージ詳細・無損失アーカイブ管理',
    archiveOldMain: '>14日前の主会話も含む',
    restoreBtn: '復元スクリプト生成',
    refreshBtn: '更新',
    restoreReadyTpl: '復元スクリプト準備完了 ({0}): {1}（終了後に実行）',
    breakdown: '容量内訳',
    main: '主会話',
    subagent: 'サブエージェント',
    wal: 'WAL',
    unknown: '未分類',
    archivable: '安全にアーカイブ可能',
    archSub: '終了済サブエージェント (>1h)',
    archOld: '>14日前の主会話 (最新20件保持)',
    topTitle: '容量 Top 5 会話（参照のみ）',
    batchTitle: '過去の無損失アーカイブバッチ',
    none: 'なし',
    hint: '安全方針：削除せず移動のみ（manifest.json付）。スクリプト実行前に Antigravity を終了してください。',
  },
};

export function getStorageWorkbenchLabels(lang = 'zh-CN') {
  return STORAGE_WB_I18N[lang] || STORAGE_WB_I18N['zh-CN'];
}

function fmtSizeMb(mb) {
  const n = Number(mb) || 0;
  return n >= 1024 ? `${(n / 1024).toFixed(2)} GB` : `${n.toFixed(1)} MB`;
}

export function formatStorageDetailReport(detail = {}, lang = 'zh-CN') {
  const L = getStorageWorkbenchLabels(lang);
  const lines = [];
  const unkPart = Number(detail.unknownCount) > 0 ? ` · ${L.unknown} ${detail.unknownCount} (${fmtSizeMb(detail.unknownMb)})` : '';
  lines.push(
    `${L.breakdown}: ${fmtSizeMb(detail.totalMb)} (${detail.conversationCount || 0}) | ${L.main} ${detail.mainCount || 0} (${fmtSizeMb(detail.mainMb)}) · ${L.subagent} ${detail.subagentCount || 0} (${fmtSizeMb(detail.subagentMb)}) · ${L.wal} ${fmtSizeMb(detail.walMb)}${unkPart}`
  );
  lines.push(
    `${L.archivable}: ${L.archSub} ${detail.archivableSubagentCount || 0} (${fmtSizeMb(detail.archivableSubagentMb)}) | ${L.archOld} ${detail.archivableOldMainCount || 0} (${fmtSizeMb(detail.archivableOldMainMb)})`
  );
  lines.push('');
  lines.push(`${L.topTitle}:`);
  const top = Array.isArray(detail.topConsumers) ? detail.topConsumers : [];
  if (top.length === 0) {
    lines.push(`  - ${L.none}`);
  } else {
    top.forEach((it, idx) => {
      const tag = it.kind === 'subagent' ? L.subagent : it.kind === 'main' ? L.main : L.unknown;
      const titlePart = it.title ? ` · ${it.title}` : ` · ${String(it.id || '').slice(0, 8)}`;
      const agePart = Number.isFinite(it.ageDays) ? ` · ${Math.round(it.ageDays)}d` : '';
      lines.push(`  ${idx + 1}. [${tag}] ${fmtSizeMb(it.mb)}${agePart}${titlePart}`);
    });
  }
  lines.push('');
  lines.push(`${L.batchTitle}:`);
  const batches = Array.isArray(detail.batches) ? detail.batches : [];
  if (batches.length === 0) {
    lines.push(`  - ${L.none}`);
  } else {
    batches.forEach((b) => {
      const ts = b.createdAt ? ` · ${String(b.createdAt).slice(0, 16).replace('T', ' ')}` : '';
      lines.push(`  - ${b.batchName} (${b.movedCount || 0} / ${fmtSizeMb(b.movedMb)} · ${b.status || 'completed'}${ts})`);
    });
  }
  lines.push('');
  lines.push(L.hint);
  return lines.join('\n');
}

async function fetchLiveSummariesViaClient() {
  try {
    const clientUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/client.mjs', import.meta.url);
    const { AntigravityClient } = await import(clientUrl.href);
    const cli = new AntigravityClient();
    try {
      const res = await cli.call('GetAllCascadeTrajectories', { excludeSubtrajectories: false });
      return res?.trajectorySummaries || null;
    } finally {
      cli.dispose();
    }
  } catch {
    return null;
  }
}

async function waitForLanguageServerExit(timeoutMs = 120000) {
  if (!isLanguageServerRunning()) return true;
  console.log('[等待] 检测到 language_server 仍在运行。请完全退出 Antigravity，脚本检测到退出后将自动开始安全归档…');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (!isLanguageServerRunning()) {
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    }
  }
  return false;
}

function parseStrictCliNonNegativeNumber(flagName, rawValue, { integer = false } = {}) {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new Error(`Invalid CLI option ${flagName}: expected a non-empty non-negative finite number`);
  }
  const n = Number(rawValue.trim());
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw new Error(
      `Invalid CLI option ${flagName}=${rawValue}: expected a non-negative finite ${integer ? 'integer' : 'number'}`
    );
  }
  return n;
}

export function parseCliArgs(argv) {
  const opts = {
    action: 'scan',
    mode: 'subagents',
    subagentHours: DEFAULT_SUBAGENT_MAX_AGE_HOURS,
    mainDays: DEFAULT_MAIN_MAX_AGE_DAYS,
    keepRecentMain: DEFAULT_KEEP_RECENT_MAIN,
    dryRun: false,
    waitExit: false,
    json: false,
    restoreBatch: 'latest',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scan') opts.action = 'scan';
    else if (a === '--prepare') opts.action = 'prepare';
    else if (a === '--archive') opts.action = 'archive';
    else if (a === '--restore') {
      opts.action = 'restore';
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.restoreBatch = argv[++i];
    } else if (a === '--list-batches') opts.action = 'list';
    else if (a === '--include-old-main') opts.mode = 'subagents+old-main';
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--wait-exit') opts.waitExit = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--subagent-hours' || a === '--main-days' || a === '--keep-main') {
      throw new Error(`Invalid CLI option ${a}: missing "=value"`);
    } else if (a.startsWith('--subagent-hours=')) {
      opts.subagentHours = parseStrictCliNonNegativeNumber('--subagent-hours', a.slice('--subagent-hours='.length));
    } else if (a.startsWith('--main-days=')) {
      opts.mainDays = parseStrictCliNonNegativeNumber('--main-days', a.slice('--main-days='.length));
    } else if (a.startsWith('--keep-main=')) {
      opts.keepRecentMain = parseStrictCliNonNegativeNumber('--keep-main', a.slice('--keep-main='.length), {
        integer: true,
      });
    }
  }
  return opts;
}

async function runCli() {
  const opts = parseCliArgs(process.argv.slice(2));
  const convDir = getDefaultConversationsDir();
  const archiveDir = getDefaultArchiveDir();

  if (opts.action === 'list') {
    const batches = listArchiveBatches(archiveDir);
    if (opts.json) console.log(JSON.stringify(batches, null, 2));
    else console.log(batches.length ? batches : '暂无归档批次。');
    return;
  }

  if (opts.action === 'prepare' || opts.action === 'scan') {
    const liveSums = await fetchLiveSummariesViaClient();
    if (liveSums) saveCatalogIndex(archiveDir, liveSums);
    const report = scanConversationStorage({
      convDir,
      archiveDir,
      summaries: liveSums,
      subagentMaxAgeHours: opts.subagentHours,
      mainMaxAgeDays: opts.mainDays,
      keepRecentMain: opts.keepRecentMain,
    });
    let helpers = null;
    if (opts.action === 'prepare') {
      helpers = writeHelperScripts({
        scriptPath: fileURLToPath(import.meta.url),
        archiveDir,
      });
    }
    if (opts.json) {
      const { archivableSubagents, archivableOldMain, ...summary } = report;
      console.log(JSON.stringify({ ...summary, helpers }, null, 2));
      return;
    }
    console.log(`[体检] 对话库路径: ${report.convDir}`);
    console.log(`[体检] 总大小: ${report.totalMb} MB（${report.conversationCount} 个会话，其中主对话 ${report.mainCount} 个 / ${report.mainMb} MB，隐藏子代理 ${report.subagentCount} 个 / ${report.subagentMb} MB）`);
    console.log(`[建议] 可安全归档的已结束子代理（>${opts.subagentHours}h）: ${report.archivableSubagentCount} 个，预计立省 ${report.archivableSubagentMb} MB`);
    if (helpers) {
      console.log(`[就绪] 一键安全归档脚本已生成: ${helpers.archiveScriptPath}`);
      console.log(`[就绪] 一键无损还原脚本已生成: ${helpers.restoreScriptPath}`);
    }
    return;
  }

  if (opts.action === 'archive') {
    if (!opts.dryRun && opts.waitExit && isLanguageServerRunning()) {
      const exited = await waitForLanguageServerExit(120000);
      if (!exited) {
        console.error('[中止] 等待超时，language_server 仍在运行。请完全退出 Antigravity 后重试。');
        process.exitCode = 1;
        return;
      }
    }
    const res = archiveConversations({
      convDir,
      archiveDir,
      mode: opts.mode,
      subagentMaxAgeHours: opts.subagentHours,
      mainMaxAgeDays: opts.mainDays,
      keepRecentMain: opts.keepRecentMain,
      dryRun: opts.dryRun,
    });
    if (opts.json) console.log(JSON.stringify(res, null, 2));
    else if (!res.ok) {
      console.error(`[拒绝] ${res.error}`);
      process.exitCode = 1;
    } else if (res.dryRun) {
      console.log(`[预演] 将移动归档 ${res.candidateCount} 个会话（共 ${res.candidateMb} MB），归档后对话库预计降至 ${res.remainingEstimatedMb} MB（所有主对话保留不变）。`);
    } else {
      console.log(`[完成] 已安全移动归档 ${res.movedCount} 个会话（释放 ${res.movedMb} MB）到: ${res.batchDir}`);
      console.log(`[完成] 对话库剩余预计约 ${res.remainingEstimatedMb} MB。现在可以重新打开 Antigravity！`);
    }
    return;
  }

  if (opts.action === 'restore') {
    if (opts.waitExit && isLanguageServerRunning()) {
      const exited = await waitForLanguageServerExit(120000);
      if (!exited) {
        console.error('[中止] 等待超时，language_server 仍在运行。请完全退出 Antigravity 后重试。');
        process.exitCode = 1;
        return;
      }
    }
    const res = restoreArchiveBatch({ convDir, archiveDir, batchName: opts.restoreBatch });
    if (opts.json) console.log(JSON.stringify(res, null, 2));
    else if (!res.ok) {
      console.error(`[失败] ${res.error}`);
      process.exitCode = 1;
    } else {
      console.log(`[完成] 已无损还原批次 ${res.batchName}：恢复 ${res.restoredCount} 个会话（跳过冲突 ${res.skippedCount} 个）。`);
    }
  }
}

function resolveRealpathForEntry(targetPath) {
  if (typeof fs.realpathSync.native === 'function') {
    try {
      return fs.realpathSync.native(targetPath);
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EACCES' || err.code === 'EPERM')) {
        return path.resolve(targetPath);
      }
    }
  }
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

/**
 * 判断当前模块是否作为 CLI 主入口直接启动。
 * 解析符号链接与 Windows Junction（例如 ~/.gemini 迁至其他盘符），并在 Win32 下归一化盘符大小写。
 */
export function isMainEntry(argv1, moduleUrl = import.meta.url) {
  if (!argv1 || !moduleUrl) return false;
  const modulePath = String(moduleUrl).startsWith('file:') ? fileURLToPath(moduleUrl) : String(moduleUrl);
  const resolvedArgv = resolveRealpathForEntry(argv1);
  const resolvedSelf = resolveRealpathForEntry(modulePath);
  if (process.platform === 'win32') {
    return (
      resolvedArgv.replace(/^\\\\\?\\/, '').toLowerCase() ===
      resolvedSelf.replace(/^\\\\\?\\/, '').toLowerCase()
    );
  }
  return resolvedArgv === resolvedSelf;
}

const isEntry = isMainEntry(process.argv[1], import.meta.url);

if (isEntry) {
  runCli().catch((err) => {
    console.error('[错误]', err?.message || err);
    process.exitCode = 1;
  });
}
