using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;

namespace AgyClaudeStyle.Installer
{
    internal sealed class InstallManifestInfo
    {
        public int SchemaVersion = 2;
        public int LayoutVersion = 2;
        public List<string> ProtectedUserPaths = new List<string>();
        public List<string> ObsoletePaths = new List<string>();
        public List<string> PurgeDataFiles = new List<string>();
    }

    internal static class InstallManifestHelper
    {
        public static readonly string[] DefaultProtectedUserPaths = new string[]
        {
            "config.json",
            "custom.css",
            ".bundle-cache.json",
            ".daemon.pid",
            ".watch.pid",
            ".relaunch-prompt-state.json",
            ".pending-restore-run-in-bg.json",
            "repo-meta.json",
            "wallpapers/",
            "backups/",
        };

        public static readonly string[] UserOwnedAssetPaths = new string[]
        {
            "custom.css",
            "wallpapers/",
            "backups/",
        };

        private static readonly int[] RetryBackoffsMs = new int[] { 100, 250, 500 };

        public static bool IsSafeManagedRelPath(string relPath, bool allowTrailingSlash)
        {
            if (string.IsNullOrEmpty(relPath)) return false;
            if (!string.Equals(relPath.Trim(), relPath, StringComparison.Ordinal)) return false;
            if (relPath.IndexOf('\0') >= 0 || relPath.IndexOf('\r') >= 0 || relPath.IndexOf('\n') >= 0) return false;

            string unified = relPath.Replace('\\', '/');
            if (unified.StartsWith("/", StringComparison.Ordinal)) return false;
            if (unified.IndexOf(':') >= 0) return false;

            bool hasTrailing = unified.EndsWith("/", StringComparison.Ordinal);
            if (hasTrailing && !allowTrailingSlash) return false;

            string core = hasTrailing ? unified.Substring(0, unified.Length - 1) : unified;
            if (string.IsNullOrEmpty(core) || core.EndsWith("/", StringComparison.Ordinal)) return false;

            string[] segments = core.Split('/');
            for (int i = 0; i < segments.Length; i++)
            {
                string seg = segments[i];
                if (string.IsNullOrEmpty(seg) || seg == "." || seg == "..") return false;
            }
            return true;
        }

        public static bool IsProtectedUserPath(string relPath, IList<string> manifestProtectedPaths)
        {
            if (string.IsNullOrEmpty(relPath)) return false;
            string unified = relPath.Trim().Replace('\\', '/');
            while (unified.StartsWith("./", StringComparison.Ordinal))
            {
                unified = unified.Substring(2);
            }
            unified = unified.TrimEnd('/');
            if (string.IsNullOrEmpty(unified)) return false;
            string lowerRel = unified.ToLowerInvariant();

            if (MatchesAnyRule(lowerRel, DefaultProtectedUserPaths)) return true;
            if (manifestProtectedPaths != null && manifestProtectedPaths.Count > 0)
            {
                if (MatchesAnyRule(lowerRel, manifestProtectedPaths)) return true;
            }
            return false;
        }

        private static bool MatchesAnyRule(string lowerRel, IList<string> rules)
        {
            for (int i = 0; i < rules.Count; i++)
            {
                string raw = rules[i];
                if (string.IsNullOrEmpty(raw)) continue;
                string norm = raw.Trim().Replace('\\', '/');
                while (norm.StartsWith("./", StringComparison.Ordinal))
                {
                    norm = norm.Substring(2);
                }
                string core = norm.TrimEnd('/');
                if (!IsSafeManagedRelPath(core, false)) continue;
                string lowerRule = core.ToLowerInvariant();
                if (string.Equals(lowerRel, lowerRule, StringComparison.Ordinal) ||
                    lowerRel.StartsWith(lowerRule + "/", StringComparison.Ordinal))
                {
                    return true;
                }
            }
            return false;
        }

        public static InstallManifestInfo LoadFromZip(ZipArchive archive, string entryPath)
        {
            InstallManifestInfo info = CreateDefault();
            if (archive == null || string.IsNullOrEmpty(entryPath)) return info;
            try
            {
                ZipArchiveEntry entry = archive.GetEntry(entryPath);
                if (entry == null) return info;
                using (Stream s = entry.Open())
                using (StreamReader sr = new StreamReader(s, Encoding.UTF8))
                {
                    return ParseJson(sr.ReadToEnd());
                }
            }
            catch
            {
                return info;
            }
        }

        public static InstallManifestInfo ParseJson(string rawJson)
        {
            InstallManifestInfo info = CreateDefault();
            if (string.IsNullOrEmpty(rawJson)) return info;
            try
            {
                string clean = rawJson.TrimStart('\uFEFF').Trim();
                Dictionary<string, object> obj = MiniJson.ParseObject(clean);
                if (obj == null) return info;
                AppendStringList(obj, "protectedUserPaths", info.ProtectedUserPaths, true);
                AppendStringList(obj, "obsoletePaths", info.ObsoletePaths, false);
                AppendStringList(obj, "purgeDataFiles", info.PurgeDataFiles, false);
            }
            catch
            {
                // 解析失败时降级使用内置受保护默认列表，绝不阻塞安装
            }
            return info;
        }

        private static InstallManifestInfo CreateDefault()
        {
            InstallManifestInfo info = new InstallManifestInfo();
            for (int i = 0; i < DefaultProtectedUserPaths.Length; i++)
            {
                info.ProtectedUserPaths.Add(DefaultProtectedUserPaths[i]);
            }
            return info;
        }

        private static void AppendStringList(
            Dictionary<string, object> obj,
            string key,
            List<string> target,
            bool allowTrailingSlash)
        {
            object rawVal;
            if (!obj.TryGetValue(key, out rawVal)) return;
            List<object> list = rawVal as List<object>;
            if (list == null) return;
            for (int i = 0; i < list.Count; i++)
            {
                string item = list[i] as string;
                if (string.IsNullOrEmpty(item)) continue;
                string trimmed = item.Trim();
                if (!IsSafeManagedRelPath(trimmed, allowTrailingSlash)) continue;
                bool exists = false;
                for (int j = 0; j < target.Count; j++)
                {
                    if (string.Equals(target[j], trimmed, StringComparison.OrdinalIgnoreCase))
                    {
                        exists = true;
                        break;
                    }
                }
                if (!exists) target.Add(trimmed);
            }
        }

        public static int CleanupObsoletePaths(
            string targetRoot,
            InstallManifestInfo manifest,
            Func<string, bool> isReparsePoint,
            Action<string, string> assertNoReparseChain)
        {
            if (string.IsNullOrEmpty(targetRoot) || manifest == null || manifest.ObsoletePaths.Count == 0) return 0;
            if (!Directory.Exists(targetRoot)) return 0;

            string rootFull = Path.GetFullPath(targetRoot).TrimEnd('\\', '/');
            string rootPrefix = rootFull + Path.DirectorySeparatorChar;
            int removed = 0;

            for (int i = 0; i < manifest.ObsoletePaths.Count; i++)
            {
                string rel = manifest.ObsoletePaths[i];
                if (!IsSafeManagedRelPath(rel, false)) continue;
                if (IsProtectedUserPath(rel, manifest.ProtectedUserPaths)) continue;

                string destFull = Path.GetFullPath(Path.Combine(rootFull, rel.Replace('/', '\\')));
                if (!destFull.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase)) continue;
                if (!File.Exists(destFull)) continue;

                try
                {
                    string parent = Path.GetDirectoryName(destFull);
                    if (!string.IsNullOrEmpty(parent) && assertNoReparseChain != null)
                    {
                        assertNoReparseChain(parent, rootFull);
                    }
                    if (isReparsePoint != null && isReparsePoint(destFull)) continue;

                    CdpHelper.ClearReadOnlyAndHiddenAttributes(destFull);
                    if (DeleteFileWithRetry(destFull))
                    {
                        removed++;
                        TryPruneEmptyParentDirs(destFull, rootFull, isReparsePoint);
                    }
                }
                catch
                {
                    // 单条清理失败不中断主安装流程
                }
            }
            return removed;
        }

        private static bool DeleteFileWithRetry(string filePath)
        {
            for (int attempt = 0; attempt <= RetryBackoffsMs.Length; attempt++)
            {
                try
                {
                    if (!File.Exists(filePath)) return true;
                    File.Delete(filePath);
                    return true;
                }
                catch (Exception ex)
                {
                    if (!(ex is IOException) && !(ex is UnauthorizedAccessException)) return false;
                    if (attempt >= RetryBackoffsMs.Length) return false;
                    Thread.Sleep(RetryBackoffsMs[attempt]);
                }
            }
            return false;
        }

        private static void TryPruneEmptyParentDirs(string filePath, string rootFull, Func<string, bool> isReparsePoint)
        {
            string cur = Path.GetDirectoryName(filePath);
            string rootPrefix = rootFull + Path.DirectorySeparatorChar;
            for (int depth = 0; depth < 16; depth++)
            {
                if (string.IsNullOrEmpty(cur)) break;
                string normCur = Path.GetFullPath(cur).TrimEnd('\\', '/');
                if (string.Equals(normCur, rootFull, StringComparison.OrdinalIgnoreCase)) break;
                if (!normCur.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase)) break;
                if (isReparsePoint != null && isReparsePoint(normCur)) break;
                try
                {
                    if (Directory.GetFileSystemEntries(normCur).Length > 0) break;
                    Directory.Delete(normCur, false);
                    cur = Path.GetDirectoryName(normCur);
                }
                catch
                {
                    break;
                }
            }
        }

        public static void LoadArchiveManifests(ZipArchive archive, out InstallManifestInfo installInfo, out InstallManifestInfo pluginInfo)
        {
            installInfo = LoadFromZip(archive, "install-manifest.json");
            pluginInfo = LoadFromZip(archive, "native-plugin/install-manifest.json");
        }

        public static bool ShouldSkipProtectedExtract(
            string relPath,
            bool isNative,
            string destPath,
            InstallManifestInfo installInfo,
            InstallManifestInfo pluginInfo,
            ref bool preservedConfig)
        {
            if (!File.Exists(destPath)) return false;
            InstallManifestInfo active = isNative ? pluginInfo : installInfo;
            if (!IsProtectedUserPath(relPath, active != null ? active.ProtectedUserPaths : null)) return false;
            if (!isNative && string.Equals(Path.GetFileName(relPath), "config.json", StringComparison.OrdinalIgnoreCase))
            {
                preservedConfig = true;
            }
            return true;
        }

        public static void CleanupBothDirs(
            string installDir,
            string pluginDir,
            InstallManifestInfo installInfo,
            InstallManifestInfo pluginInfo,
            Func<string, bool> isReparsePoint,
            Action<string, string> assertNoReparseChain)
        {
            CleanupObsoletePaths(installDir, installInfo, isReparsePoint, assertNoReparseChain);
            CleanupObsoletePaths(pluginDir, pluginInfo, isReparsePoint, assertNoReparseChain);
        }

        public static void UninstallDirPreservingUserAssets(
            string dir,
            bool purgeData,
            Func<string, bool> isReparsePoint,
            Action<string> safeDeleteDir)
        {
            if (!purgeData && HasUserOwnedAssets(dir, isReparsePoint))
            {
                RemoveManagedFilesKeepingUserAssets(dir, isReparsePoint);
            }
            else if (safeDeleteDir != null)
            {
                safeDeleteDir(dir);
            }
        }

        public static bool HasUserOwnedAssets(string targetRoot, Func<string, bool> isReparsePoint)
        {
            if (string.IsNullOrEmpty(targetRoot) || !Directory.Exists(targetRoot)) return false;
            for (int i = 0; i < UserOwnedAssetPaths.Length; i++)
            {
                string clean = UserOwnedAssetPaths[i].TrimEnd('/');
                string full = Path.Combine(targetRoot, clean.Replace('/', '\\'));
                if (isReparsePoint != null && isReparsePoint(full)) continue;
                if (File.Exists(full)) return true;
                if (Directory.Exists(full))
                {
                    try
                    {
                        if (Directory.GetFileSystemEntries(full).Length > 0) return true;
                    }
                    catch { }
                }
            }
            return false;
        }

        public static void RemoveManagedFilesKeepingUserAssets(string targetRoot, Func<string, bool> isReparsePoint)
        {
            if (string.IsNullOrEmpty(targetRoot) || !Directory.Exists(targetRoot)) return;
            WalkRemoveKeepingAssets(targetRoot, "", isReparsePoint);
        }

        private static void WalkRemoveKeepingAssets(string curDir, string relPrefix, Func<string, bool> isReparsePoint)
        {
            if (isReparsePoint != null && isReparsePoint(curDir)) return;
            try
            {
                string[] files = Directory.GetFiles(curDir);
                for (int i = 0; i < files.Length; i++)
                {
                    string name = Path.GetFileName(files[i]);
                    string rel = string.IsNullOrEmpty(relPrefix) ? name : relPrefix + "/" + name;
                    if (MatchesAnyRule(rel.ToLowerInvariant(), UserOwnedAssetPaths)) continue;
                    if (isReparsePoint != null && isReparsePoint(files[i])) continue;
                    try
                    {
                        CdpHelper.ClearReadOnlyAndHiddenAttributes(files[i]);
                        File.Delete(files[i]);
                    }
                    catch { }
                }
                string[] dirs = Directory.GetDirectories(curDir);
                for (int i = 0; i < dirs.Length; i++)
                {
                    string name = Path.GetFileName(dirs[i]);
                    string rel = string.IsNullOrEmpty(relPrefix) ? name : relPrefix + "/" + name;
                    if (MatchesAnyRule(rel.ToLowerInvariant(), UserOwnedAssetPaths)) continue;
                    if (isReparsePoint != null && isReparsePoint(dirs[i])) continue;
                    WalkRemoveKeepingAssets(dirs[i], rel, isReparsePoint);
                    try
                    {
                        if (Directory.GetFileSystemEntries(dirs[i]).Length == 0)
                        {
                            Directory.Delete(dirs[i], false);
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }
    }
}
