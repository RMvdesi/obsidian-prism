// 配置持久化存储与 mtimeMs:size 浅拷贝缓存（绑定实例 rootDir，严格无 symlink 原子落盘）
'use strict';

const fs = require('fs');
const path = require('path');
const { isSymlinkPathSync, writeFileAtomicNoSymlinkSync } = require('../utils/fs-safe.cjs');
const { DEFAULT_CONFIG, reconcileConfigAliases } = require('./schema.cjs');

function createConfigStore({ rootDir = path.resolve(__dirname, '..', '..'), configFile = null } = {}) {
  const CONFIG_FILE = configFile ? path.resolve(configFile) : path.join(rootDir, 'config.json');
  const CONFIG_PATH = CONFIG_FILE;
  const PARTITIONS_FILE = path.join(path.dirname(CONFIG_FILE), 'project-partitions.json');
  let _configCache = { sig: '', value: null };

  function invalidateConfigCache() {
    _configCache = { sig: '', value: null };
  }

  function readConfig() {
    try {
      const st = fs.statSync(CONFIG_FILE);
      if (!st.isFile()) {
        _configCache = { sig: '', value: null };
        return { ...DEFAULT_CONFIG };
      }
      const sig = `${st.mtimeMs}:${st.size}:${st.ctimeMs}`;
      if (_configCache.value && _configCache.sig === sig) {
        return { ..._configCache.value };
      }
      const diskRaw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const merged = reconcileConfigAliases({ ...DEFAULT_CONFIG, ...reconcileConfigAliases(diskRaw) });
      _configCache = { sig, value: merged };
      return { ...merged };
    } catch {
      _configCache = { sig: '', value: null };
      return { ...DEFAULT_CONFIG };
    }
  }

  function writeConfig(nextConfig) {
    const normalized = reconcileConfigAliases({
      ...DEFAULT_CONFIG,
      ...(nextConfig && typeof nextConfig === 'object' ? reconcileConfigAliases(nextConfig) : {}),
    });
    const resolved = path.resolve(CONFIG_FILE);
    const dir = path.dirname(resolved);
    if (isSymlinkPathSync(dir) || isSymlinkPathSync(resolved)) {
      throw new Error(`Refusing symbolic link config path: ${resolved}`);
    }
    const content = JSON.stringify(normalized, null, 2) + '\n';
    writeFileAtomicNoSymlinkSync(resolved, content, {
      mkdir: true,
      mode: 0o600,
      fsync: false,
      checkExistingRegular: false,
    });
    // 写盘成功后立即失效缓存，防止同一毫秒写入后读到陈旧值
    invalidateConfigCache();
    return { ...normalized };
  }

  function normalizeProjectPartitionsData(raw) {
    const def = { version: 1, partitions: [], projectToPartition: {}, expandedProjects: {} };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def;
    const partitions = [];
    const seenIds = new Set();
    if (Array.isArray(raw.partitions)) {
      for (const p of raw.partitions) {
        if (partitions.length >= 100) break;
        if (!p || typeof p !== 'object') continue;
        const id = typeof p.id === 'string' ? p.id.trim().slice(0, 80) : '';
        const name = typeof p.name === 'string' ? p.name.trim().slice(0, 60) : '';
        if (!id || !name || seenIds.has(id)) continue;
        seenIds.add(id);
        partitions.push({ id, name, collapsed: Boolean(p.collapsed) });
      }
    }
    const projectToPartition = {};
    if (raw.projectToPartition && typeof raw.projectToPartition === 'object' && !Array.isArray(raw.projectToPartition)) {
      let count = 0;
      for (const [k, v] of Object.entries(raw.projectToPartition)) {
        if (count >= 500) break;
        const pid = typeof k === 'string' ? k.trim().slice(0, 128) : '';
        const partId = typeof v === 'string' ? v.trim().slice(0, 80) : '';
        if (!pid || !seenIds.has(partId)) continue;
        projectToPartition[pid] = partId;
        count += 1;
      }
    }
    const expandedProjects = {};
    if (raw.expandedProjects && typeof raw.expandedProjects === 'object' && !Array.isArray(raw.expandedProjects)) {
      let count = 0;
      for (const [k, v] of Object.entries(raw.expandedProjects)) {
        if (count >= 500) break;
        const pid = typeof k === 'string' ? k.trim().slice(0, 128) : '';
        if (!pid || !v) continue;
        expandedProjects[pid] = true;
        count += 1;
      }
    }
    return { version: 1, partitions, projectToPartition, expandedProjects };
  }

  function readProjectPartitionsData(filePath = PARTITIONS_FILE) {
    const resolved = path.resolve(filePath);
    try {
      if (!fs.existsSync(resolved) || isSymlinkPathSync(resolved)) {
        return { exists: false, data: normalizeProjectPartitionsData(null) };
      }
      const st = fs.statSync(resolved);
      if (!st.isFile() || st.size > 256 * 1024) {
        return { exists: false, data: normalizeProjectPartitionsData(null) };
      }
      const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      return { exists: true, data: normalizeProjectPartitionsData(parsed) };
    } catch {
      return { exists: false, data: normalizeProjectPartitionsData(null) };
    }
  }

  function writeProjectPartitionsData(rawData, filePath = PARTITIONS_FILE) {
    const normalized = normalizeProjectPartitionsData(rawData);
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    if (isSymlinkPathSync(dir) || isSymlinkPathSync(resolved)) {
      throw new Error(`Refusing symbolic link partitions path: ${resolved}`);
    }
    const content = JSON.stringify(normalized, null, 2) + '\n';
    writeFileAtomicNoSymlinkSync(resolved, content, {
      mkdir: true,
      mode: 0o600,
      fsync: false,
      checkExistingRegular: false,
    });
    return normalized;
  }

  return {
    CONFIG_FILE,
    CONFIG_PATH,
    PARTITIONS_FILE,
    readConfig,
    writeConfig,
    invalidateConfigCache,
    normalizeProjectPartitionsData,
    readProjectPartitionsData,
    writeProjectPartitionsData,
  };
}

module.exports = {
  createConfigStore,
};
