using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Management;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace AgyClaudeStyle.Installer
{
    internal class InstallerOptions
    {
        public bool Uninstall;
        public bool Silent;
        public bool Popup;
        public bool StatusOnly;
        public bool NoAutostart;
        public bool NoKillLegacy;
        public bool NoNativeDaemon;
        public bool NoRelaunchPrompt;
        public bool PurgeData;
        public string InstallDir;
        public string PluginDir;
        public int? CdpPort;
        public string OutFile;
    }

    internal class AntigravityDetectResult
    {
        public string ExePath;
        public string Version;
        public bool IsRunning;
    }

    internal class OperationResult
    {
        public bool Ok;
        public string Mode;
        public string Headline;
        public string Detail;
        public string InstallDir;
        public string PluginDir;
        public bool NativePluginDeployed;
        public bool NativeDaemonStarted;
        public string AntigravityExe;
        public string AntigravityVersion;
        public int? CdpPort;
        public List<string> InjectedPages = new List<string>();
        public bool PreservedExistingConfig;
        public bool SelfDeleteScheduled;
        public int PatchedShortcuts;
        public int RestoredShortcuts;
        public bool BareHostDetected;
        public string ConfigSummary;
    }

    internal static class InstallerCore
    {
        private const string UninstallRegSubKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ObsidianPrism";
        private const string StartupLnkName = "Obsidian-Prism.lnk";
        private const string WatcherExeName = "obsidian-prism-watcher.exe";
        private const string SelfInstalledExeName = "obsidian-prism-installer.exe";

        public static string GetDefaultInstallDir()
        {
            string localAppData = Environment.GetEnvironmentVariable("LOCALAPPDATA");
            if (string.IsNullOrEmpty(localAppData))
            {
                localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            }
            return Path.Combine(localAppData, "obsidian-prism");
        }

        /// <summary>
        /// 规范化目录路径，保留盘符根路径末尾斜杠（例如 C:\ 不会被截断为 C:）。
        /// </summary>
        public static string NormalizeDirPath(string path)
        {
            if (string.IsNullOrEmpty(path)) return path;
            string full = Path.GetFullPath(path);
            string root = Path.GetPathRoot(full);
            if (!string.IsNullOrEmpty(root) &&
                string.Equals(full.TrimEnd('\\', '/'), root.TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase))
            {
                return root;
            }
            return full.TrimEnd('\\', '/');
        }

        private static bool IsReparsePoint(string path)
        {
            if (string.IsNullOrEmpty(path)) return false;
            try
            {
                if (!File.Exists(path) && !Directory.Exists(path)) return false;
                return (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;
            }
            catch
            {
                return false;
            }
        }

        private static void AssertNoReparsePointChain(string dirPath, string stopAtRoot)
        {
            if (string.IsNullOrEmpty(dirPath)) return;
            string cur = NormalizeDirPath(dirPath);
            string rootNorm = !string.IsNullOrEmpty(stopAtRoot) ? NormalizeDirPath(stopAtRoot) : null;
            string rootPrefix = !string.IsNullOrEmpty(rootNorm)
                ? rootNorm.TrimEnd('\\', '/') + Path.DirectorySeparatorChar
                : null;

            while (!string.IsNullOrEmpty(cur))
            {
                if (IsReparsePoint(cur))
                {
                    throw new InvalidOperationException("检测到符号链接或重解析点目录，已拒绝操作: " + cur);
                }
                if (!string.IsNullOrEmpty(rootNorm))
                {
                    if (string.Equals(cur, rootNorm, StringComparison.OrdinalIgnoreCase))
                    {
                        break;
                    }
                    if (!string.IsNullOrEmpty(rootPrefix) &&
                        !cur.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
                    {
                        break;
                    }
                }
                string parent = Path.GetDirectoryName(cur);
                if (string.IsNullOrEmpty(parent) || string.Equals(parent, cur, StringComparison.OrdinalIgnoreCase))
                {
                    break;
                }
                cur = NormalizeDirPath(parent);
            }
        }

        private static string ResolveSafeZipEntryDestPath(string targetRoot, string relPath)
        {
            if (string.IsNullOrEmpty(targetRoot) || string.IsNullOrEmpty(relPath))
            {
                throw new InvalidOperationException("非法的 ZIP 解压目标路径");
            }
            string normalizedRel = relPath.Replace('/', '\\');
            if (normalizedRel.StartsWith("\\", StringComparison.Ordinal) || Path.IsPathRooted(normalizedRel))
            {
                throw new InvalidOperationException("检测到非法绝对路径 ZIP 条目: " + relPath);
            }
            string rootFull = NormalizeDirPath(targetRoot);
            string rootPrefix = rootFull.TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
            string destFull = Path.GetFullPath(Path.Combine(rootFull, normalizedRel));
            if (!destFull.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("检测到 ZIP Slip 越界路径: " + relPath);
            }
            string parent = Path.GetDirectoryName(destFull);
            if (!string.IsNullOrEmpty(parent))
            {
                AssertNoReparsePointChain(parent, rootFull);
            }
            if (IsReparsePoint(destFull))
            {
                throw new InvalidOperationException("检测到目标文件为符号链接或重解析点，已拒绝覆盖: " + destFull);
            }
            return destFull;
        }

        /// <summary>
        /// 判断路径是否为驱动器根目录、用户主目录或系统关键目录等危险根路径。
        /// </summary>
        public static bool IsDangerousRootPath(string dirPath)
        {
            if (string.IsNullOrEmpty(dirPath) || string.IsNullOrEmpty(dirPath.Trim())) return true;
            string norm;
            string root;
            try
            {
                norm = NormalizeDirPath(dirPath);
                root = Path.GetPathRoot(norm);
            }
            catch
            {
                return true;
            }
            if (string.IsNullOrEmpty(norm) || string.IsNullOrEmpty(root)) return true;
            if (string.Equals(norm.TrimEnd('\\', '/'), root.TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            string normSlash = norm.TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
            List<string> protectedRoots = new List<string>();
            Action<string> addProtected = (p) =>
            {
                if (string.IsNullOrEmpty(p)) return;
                try { protectedRoots.Add(NormalizeDirPath(p)); } catch { }
            };

            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
            addProtected(Environment.GetEnvironmentVariable("USERPROFILE"));
            string homeDrive = Environment.GetEnvironmentVariable("HOMEDRIVE");
            string homePath = Environment.GetEnvironmentVariable("HOMEPATH");
            if (!string.IsNullOrEmpty(homeDrive) && !string.IsNullOrEmpty(homePath))
            {
                addProtected(homeDrive + homePath);
            }
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.Windows));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.System));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            addProtected(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
            addProtected(Path.GetTempPath());

            string userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (string.IsNullOrEmpty(userHome)) userHome = Environment.GetEnvironmentVariable("USERPROFILE");
            List<string> redlineDirs = new List<string>();
            Action<string> addRedline = (p) =>
            {
                if (string.IsNullOrEmpty(p)) return;
                try { redlineDirs.Add(NormalizeDirPath(p)); } catch { }
            };
            if (!string.IsNullOrEmpty(userHome))
            {
                string geminiDir = Path.Combine(userHome, ".gemini");
                addProtected(geminiDir);
                addProtected(Path.Combine(geminiDir, "config"));
                addProtected(Path.Combine(geminiDir, "config", "plugins"));
                addProtected(Path.Combine(geminiDir, "antigravity"));
                addRedline(Path.Combine(geminiDir, "antigravity", "conversations_archive"));
                addRedline(Path.Combine(geminiDir, "antigravity", "prism-knowledge-space"));
                addRedline(Path.Combine(userHome, "Documents", "Antigravity-Spark"));
            }
            string myDocs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (!string.IsNullOrEmpty(myDocs))
            {
                addRedline(Path.Combine(myDocs, "Antigravity-Spark"));
            }

            for (int i = 0; i < protectedRoots.Count; i++)
            {
                string p = protectedRoots[i];
                if (string.IsNullOrEmpty(p)) continue;
                if (string.Equals(norm, p, StringComparison.OrdinalIgnoreCase)) return true;
                if (p.StartsWith(normSlash, StringComparison.OrdinalIgnoreCase)) return true;
            }
            for (int i = 0; i < redlineDirs.Count; i++)
            {
                string p = redlineDirs[i];
                if (string.IsNullOrEmpty(p)) continue;
                string pSlash = p.TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
                if (string.Equals(norm, p, StringComparison.OrdinalIgnoreCase)) return true;
                if (norm.StartsWith(pSlash, StringComparison.OrdinalIgnoreCase)) return true;
                if (p.StartsWith(normSlash, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static bool IsAllowedTelemetryOverrideDir(string candidate, string geminiRoot)
        {
            if (string.IsNullOrEmpty(candidate) || string.IsNullOrEmpty(candidate.Trim())) return false;
            string norm;
            try { norm = NormalizeDirPath(candidate.Trim()); }
            catch { return false; }
            if (IsDangerousRootPath(norm)) return false;

            List<string> allowedRoots = new List<string>();
            Action<string> addBase = (b) =>
            {
                if (string.IsNullOrEmpty(b)) return;
                try { allowedRoots.Add(NormalizeDirPath(b).TrimEnd('\\', '/') + Path.DirectorySeparatorChar); } catch { }
            };
            if (!string.IsNullOrEmpty(geminiRoot)) addBase(geminiRoot);
            string userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (string.IsNullOrEmpty(userHome)) userHome = Environment.GetEnvironmentVariable("USERPROFILE");
            if (!string.IsNullOrEmpty(userHome)) addBase(Path.Combine(userHome, ".gemini"));
            addBase(Path.GetTempPath());

            bool underAllowed = false;
            for (int i = 0; i < allowedRoots.Count; i++)
            {
                if (norm.StartsWith(allowedRoots[i], StringComparison.OrdinalIgnoreCase))
                {
                    underAllowed = true;
                    break;
                }
            }
            if (!underAllowed) return false;

            string[] segs = norm.Split(new char[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < segs.Length; i++)
            {
                if (string.Equals(segs[i], "telemetry", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(segs[i], "obsidian-prism", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static void SafeDeleteDirectory(string dir)
        {
            if (string.IsNullOrEmpty(dir)) return;
            if (IsDangerousRootPath(dir))
            {
                throw new InvalidOperationException("已拒绝删除受保护的系统或用户根目录: " + dir);
            }
            if (!Directory.Exists(dir)) return;
            if (IsReparsePoint(dir))
            {
                Directory.Delete(dir, false);
                return;
            }
            Directory.Delete(dir, true);
        }

        private static void CleanInstallDirKeepingSelfExe(string dir, string selfExeFullPath)
        {
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir) || IsReparsePoint(dir)) return;
            try
            {
                string[] files = Directory.GetFiles(dir);
                for (int i = 0; i < files.Length; i++)
                {
                    string fp = files[i];
                    if (string.Equals(Path.GetFullPath(fp), selfExeFullPath, StringComparison.OrdinalIgnoreCase)) continue;
                    if (IsReparsePoint(fp)) continue;
                    try { File.Delete(fp); } catch { }
                }
            }
            catch { }

            try
            {
                string[] subDirs = Directory.GetDirectories(dir);
                for (int i = 0; i < subDirs.Length; i++)
                {
                    string subDir = subDirs[i];
                    if (IsReparsePoint(subDir))
                    {
                        try { Directory.Delete(subDir, false); } catch { }
                        continue;
                    }
                    CleanInstallDirKeepingSelfExe(subDir, selfExeFullPath);
                    try
                    {
                        if (Directory.GetFileSystemEntries(subDir).Length == 0)
                        {
                            Directory.Delete(subDir, false);
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        private static bool IsValidConfigJsonFile(string path)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path) || IsReparsePoint(path)) return false;
            try
            {
                string raw = File.ReadAllText(path, Encoding.UTF8).TrimStart('\uFEFF').Trim();
                if (raw.Length == 0) return false;
                return MiniJson.ParseObject(raw) != null;
            }
            catch
            {
                return false;
            }
        }

        private static void BackupUserConfigBeforeUninstall(string installDir, string pluginDir)
        {
            string hostCfgDir = CdpHelper.ResolveHostGeminiConfigDir(pluginDir);
            if (string.IsNullOrEmpty(hostCfgDir) || IsReparsePoint(hostCfgDir)) return;

            string installCfg = !string.IsNullOrEmpty(installDir) ? Path.Combine(installDir, "config.json") : null;
            string pluginCfg = !string.IsNullOrEmpty(pluginDir) ? Path.Combine(pluginDir, "config.json") : null;
            string chosen = null;
            bool installValid = IsValidConfigJsonFile(installCfg);
            bool pluginValid = IsValidConfigJsonFile(pluginCfg);
            if (installValid && pluginValid)
            {
                chosen = File.GetLastWriteTimeUtc(pluginCfg) > File.GetLastWriteTimeUtc(installCfg) ? pluginCfg : installCfg;
            }
            else if (pluginValid)
            {
                chosen = pluginCfg;
            }
            else if (installValid)
            {
                chosen = installCfg;
            }
            if (string.IsNullOrEmpty(chosen)) return;

            try
            {
                Directory.CreateDirectory(hostCfgDir);
                if (IsReparsePoint(hostCfgDir)) return;
                string backupPath = Path.Combine(hostCfgDir, "obsidian-prism-config.backup.json");
                if (IsReparsePoint(backupPath)) return;
                string tmpPath = backupPath + ".tmp." + Process.GetCurrentProcess().Id;
                File.Copy(chosen, tmpPath, true);
                if (File.Exists(backupPath)) File.Delete(backupPath);
                File.Move(tmpPath, backupPath);
            }
            catch { }
        }

        private static bool RestoreUserConfigBackupIfNeeded(string installDir, string pluginDir)
        {
            string installCfg = !string.IsNullOrEmpty(installDir) ? Path.Combine(installDir, "config.json") : null;
            string pluginCfg = !string.IsNullOrEmpty(pluginDir) ? Path.Combine(pluginDir, "config.json") : null;
            if ((!string.IsNullOrEmpty(installCfg) && File.Exists(installCfg)) ||
                (!string.IsNullOrEmpty(pluginCfg) && File.Exists(pluginCfg)))
            {
                return false;
            }
            string hostCfgDir = CdpHelper.ResolveHostGeminiConfigDir(pluginDir);
            if (string.IsNullOrEmpty(hostCfgDir) || IsReparsePoint(hostCfgDir)) return false;
            string backupPath = Path.Combine(hostCfgDir, "obsidian-prism-config.backup.json");
            if (!IsValidConfigJsonFile(backupPath) || string.IsNullOrEmpty(installCfg)) return false;
            try
            {
                if (IsReparsePoint(installCfg)) return false;
                File.Copy(backupPath, installCfg, false);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static void SafeDeleteFileNoReparsePoint(string filePath)
        {
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath) || IsReparsePoint(filePath)) return;
            try { File.Delete(filePath); } catch { }
        }

        private static void PurgeUserPluginData(string pluginDir)
        {
            // 绝对红线：严禁触碰 conversations_archive、Antigravity-Spark、prism-knowledge-space
            string hostCfgDir = CdpHelper.ResolveHostGeminiConfigDir(pluginDir);
            if (!string.IsNullOrEmpty(hostCfgDir) && Directory.Exists(hostCfgDir) && !IsReparsePoint(hostCfgDir))
            {
                string[] exactFiles = new string[]
                {
                    "obsidian-prism-config.backup.json",
                    "obsidian-prism-thought.json",
                    "obsidian-prism-thought-cache.json",
                    "obsidian-prism-sidebar.json",
                    "obsidian-prism-sidebar.json.lock",
                };
                for (int i = 0; i < exactFiles.Length; i++)
                {
                    SafeDeleteFileNoReparsePoint(Path.Combine(hostCfgDir, exactFiles[i]));
                }
                try
                {
                    string[] bakFiles = Directory.GetFiles(hostCfgDir, "obsidian-prism-sidebar.json.v1*.bak");
                    for (int i = 0; i < bakFiles.Length; i++)
                    {
                        SafeDeleteFileNoReparsePoint(bakFiles[i]);
                    }
                }
                catch { }

                string envTel = Environment.GetEnvironmentVariable("AG_PRISM_TELEMETRY_DIR");
                string geminiRoot = Path.GetDirectoryName(hostCfgDir);
                string telemetryDir = null;
                if (!string.IsNullOrEmpty(envTel) && !string.IsNullOrEmpty(envTel.Trim()))
                {
                    if (IsAllowedTelemetryOverrideDir(envTel, geminiRoot))
                    {
                        telemetryDir = NormalizeDirPath(envTel.Trim());
                    }
                }
                else if (!string.IsNullOrEmpty(geminiRoot))
                {
                    telemetryDir = Path.Combine(geminiRoot, "antigravity", "sidecar_data", "obsidian-prism", "telemetry");
                }
                if (!string.IsNullOrEmpty(telemetryDir) && Directory.Exists(telemetryDir) && !IsDangerousRootPath(telemetryDir))
                {
                    try
                    {
                        string stopRoot = Path.GetDirectoryName(hostCfgDir);
                        AssertNoReparsePointChain(telemetryDir, stopRoot);
                        SafeDeleteDirectory(telemetryDir);
                    }
                    catch { }
                }
            }
        }

        public static string ResolveNativePluginDir(InstallerOptions opts, string resolvedInstallDir)
        {
            if (opts != null && !string.IsNullOrEmpty(opts.PluginDir))
            {
                return NormalizeDirPath(opts.PluginDir);
            }
            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("AG_PRISM_PLUGIN_DIR")))
            {
                return NormalizeDirPath(CdpHelper.GetDefaultNativePluginDir());
            }
            if (opts == null || string.IsNullOrEmpty(opts.InstallDir))
            {
                return NormalizeDirPath(CdpHelper.GetDefaultNativePluginDir());
            }
            string normInstall = NormalizeDirPath(resolvedInstallDir);
            string parentDir = Path.GetDirectoryName(normInstall);
            string baseName = Path.GetFileName(normInstall);
            return Path.Combine(string.IsNullOrEmpty(parentDir) ? normInstall : parentDir, (string.IsNullOrEmpty(baseName) ? "obsidian-prism" : baseName) + "-native-plugin");
        }

        public static void StopNativeDaemonInDir(string pluginDir, Action<string> log)
        {
            if (string.IsNullOrEmpty(pluginDir) || !Directory.Exists(pluginDir)) return;
            int? pid = CdpHelper.ReadNativeDaemonPid(pluginDir);
            if (pid.HasValue && pid.Value > 0 && pid.Value != Process.GetCurrentProcess().Id)
            {
                try
                {
                    using (Process p = Process.GetProcessById(pid.Value))
                    {
                        if (!p.HasExited && CdpHelper.IsExpectedPrismDaemonProcess(p, pluginDir))
                        {
                            p.Kill();
                            p.WaitForExit(2000);
                            if (log != null) log("已停止原生 Sidecar Daemon (PID " + pid.Value + ")");
                        }
                    }
                }
                catch { }
            }
            string pidFile = Path.Combine(pluginDir, ".daemon.pid");
            try { if (File.Exists(pidFile)) File.Delete(pidFile); } catch { }
        }

        public static string GetDirHash(string dir)
        {
            return CdpHelper.ComputeHash(NormalizeDirPath(dir).ToLowerInvariant());
        }

        public static string GetStartupShortcutPath()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), StartupLnkName);
        }

        public static AntigravityDetectResult DetectAntigravityDesktop()
        {
            AntigravityDetectResult res = new AntigravityDetectResult();
            try
            {
                Process[] procs = Process.GetProcessesByName("Antigravity");
                if (procs != null && procs.Length > 0)
                {
                    res.IsRunning = true;
                    for (int i = 0; i < procs.Length; i++)
                    {
                        try
                        {
                            string p = procs[i].MainModule.FileName;
                            if (!string.IsNullOrEmpty(p) && File.Exists(p))
                            {
                                res.ExePath = p;
                                break;
                            }
                        }
                        catch { }
                        finally
                        {
                            try { procs[i].Dispose(); } catch { }
                        }
                    }
                }
            }
            catch { }

            if (string.IsNullOrEmpty(res.ExePath))
            {
                List<string> candidates = new List<string>();
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                string progFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
                if (!string.IsNullOrEmpty(localAppData))
                    candidates.Add(Path.Combine(localAppData, "Programs", "antigravity", "Antigravity.exe"));
                if (!string.IsNullOrEmpty(progFiles))
                    candidates.Add(Path.Combine(progFiles, "Antigravity", "Antigravity.exe"));
                if (!string.IsNullOrEmpty(progFilesX86))
                    candidates.Add(Path.Combine(progFilesX86, "Antigravity", "Antigravity.exe"));

                for (int i = 0; i < candidates.Count; i++)
                {
                    if (File.Exists(candidates[i]))
                    {
                        res.ExePath = candidates[i];
                        break;
                    }
                }
            }

            if (string.IsNullOrEmpty(res.ExePath))
            {
                res.ExePath = FindAntigravityFromUninstallRegistry();
            }

            if (!string.IsNullOrEmpty(res.ExePath))
            {
                try
                {
                    FileVersionInfo fvi = FileVersionInfo.GetVersionInfo(res.ExePath);
                    res.Version = !string.IsNullOrEmpty(fvi.FileVersion) ? fvi.FileVersion : fvi.ProductVersion;
                }
                catch { }
                if (string.IsNullOrEmpty(res.Version))
                {
                    string dir = Path.GetDirectoryName(res.ExePath);
                    string versionFile = Path.Combine(dir, "version");
                    if (File.Exists(versionFile))
                    {
                        try { res.Version = File.ReadAllText(versionFile, Encoding.UTF8).Trim(); } catch { }
                    }
                }
            }

            return res;
        }

        private static string FindAntigravityFromUninstallRegistry()
        {
            RegistryKey[] roots = new RegistryKey[] { Registry.CurrentUser, Registry.LocalMachine };
            string[] subPaths = new string[]
            {
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                @"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };
            for (int r = 0; r < roots.Length; r++)
            {
                for (int sp = 0; sp < subPaths.Length; sp++)
                {
                    try
                    {
                        using (RegistryKey parent = roots[r].OpenSubKey(subPaths[sp]))
                        {
                            if (parent == null) continue;
                            string[] names = parent.GetSubKeyNames();
                            for (int i = 0; i < names.Length; i++)
                            {
                                try
                                {
                                    using (RegistryKey item = parent.OpenSubKey(names[i]))
                                    {
                                        if (item == null) continue;
                                        string disp = item.GetValue("DisplayName") as string;
                                        if (string.IsNullOrEmpty(disp)) continue;
                                        if (!disp.StartsWith("Antigravity", StringComparison.OrdinalIgnoreCase)) continue;
                                        if (disp.IndexOf("IDE", StringComparison.OrdinalIgnoreCase) >= 0) continue;

                                        string loc = item.GetValue("InstallLocation") as string;
                                        string exe = TryProbeAntigravityDir(loc);
                                        if (exe != null) return exe;

                                        string uninst = item.GetValue("UninstallString") as string;
                                        exe = TryProbeAntigravityFromCmd(uninst);
                                        if (exe != null) return exe;

                                        string icon = item.GetValue("DisplayIcon") as string;
                                        exe = TryProbeAntigravityFromCmd(icon);
                                        if (exe != null) return exe;
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                    catch { }
                }
            }
            return null;
        }

        private static string TryProbeAntigravityDir(string dir)
        {
            if (string.IsNullOrEmpty(dir)) return null;
            string cleaned = dir.Trim().Trim('"');
            if (string.IsNullOrEmpty(cleaned)) return null;
            string exe = Path.Combine(cleaned, "Antigravity.exe");
            return File.Exists(exe) ? exe : null;
        }

        private static string TryProbeAntigravityFromCmd(string cmd)
        {
            if (string.IsNullOrEmpty(cmd)) return null;
            string s = cmd.Trim();
            string pathPart = null;
            if (s.StartsWith("\"", StringComparison.Ordinal))
            {
                int end = s.IndexOf('"', 1);
                if (end > 1) pathPart = s.Substring(1, end - 1);
            }
            else
            {
                int exeIdx = s.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
                if (exeIdx > 0) pathPart = s.Substring(0, exeIdx + 4);
            }
            if (string.IsNullOrEmpty(pathPart)) return null;
            int comma = pathPart.IndexOf(',');
            if (comma > 0) pathPart = pathPart.Substring(0, comma);
            try
            {
                return TryProbeAntigravityDir(Path.GetDirectoryName(pathPart));
            }
            catch
            {
                return null;
            }
        }

        public static void StopWatcherInDir(string dir, Action<string> log)
        {
            if (!Directory.Exists(dir)) return;
            string hash = GetDirHash(dir);
            try
            {
                using (EventWaitHandle stopEvt = EventWaitHandle.OpenExisting("Local\\ObsidianPrismStop_" + hash))
                {
                    stopEvt.Set();
                }
            }
            catch { }

            string pidFile = Path.Combine(dir, ".watch.pid");
            if (File.Exists(pidFile))
            {
                try
                {
                    int pid;
                    if (int.TryParse(File.ReadAllText(pidFile, Encoding.UTF8).Trim(), out pid) &&
                        pid > 0 &&
                        pid != Process.GetCurrentProcess().Id)
                    {
                        try
                        {
                            using (Process p = Process.GetProcessById(pid))
                            {
                                if (!p.HasExited && CdpHelper.IsExpectedPrismDaemonProcess(p, dir))
                                {
                                    if (!p.WaitForExit(2000))
                                    {
                                        p.Kill();
                                        p.WaitForExit(2000);
                                    }
                                    if (log != null) log("已停止运行中的守护进程 (PID " + pid + ")");
                                }
                            }
                        }
                        catch { }
                    }
                }
                catch { }
                try { File.Delete(pidFile); } catch { }
            }

            string normalizedDirPrefix = NormalizeDirPath(dir).TrimEnd('\\', '/').ToLowerInvariant() + "\\";
            try
            {
                Process[] procs = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(WatcherExeName));
                for (int i = 0; i < procs.Length; i++)
                {
                    try
                    {
                        string path = procs[i].MainModule.FileName;
                        if (!string.IsNullOrEmpty(path) &&
                            Path.GetFullPath(path).ToLowerInvariant().StartsWith(normalizedDirPrefix, StringComparison.Ordinal))
                        {
                            if (!procs[i].WaitForExit(1500))
                            {
                                procs[i].Kill();
                                procs[i].WaitForExit(1500);
                            }
                        }
                    }
                    catch { }
                    finally
                    {
                        try { procs[i].Dispose(); } catch { }
                    }
                }
            }
            catch { }
        }

        public static void StopLegacyNodeWatchers(Action<string> log)
        {
            try
            {
                string lnkPath = GetStartupShortcutPath();
                if (File.Exists(lnkPath))
                {
                    string workDir = ReadShortcutWorkingDir(lnkPath);
                    if (!string.IsNullOrEmpty(workDir) && Directory.Exists(workDir))
                    {
                        string legacyPidFile = Path.Combine(workDir, ".watch.pid");
                        if (File.Exists(legacyPidFile))
                        {
                            int pid;
                            if (int.TryParse(File.ReadAllText(legacyPidFile, Encoding.UTF8).Trim(), out pid) &&
                                pid > 0 &&
                                pid != Process.GetCurrentProcess().Id)
                            {
                                try
                                {
                                    using (Process p = Process.GetProcessById(pid))
                                    {
                                        if (!p.HasExited && string.Equals(p.ProcessName, "node", StringComparison.OrdinalIgnoreCase))
                                        {
                                            p.Kill();
                                            p.WaitForExit(1500);
                                            if (log != null) log("已停止旧版脚本守护进程 (PID " + pid + ")");
                                        }
                                    }
                                }
                                catch { }
                            }
                            try { File.Delete(legacyPidFile); } catch { }
                        }
                    }
                }
            }
            catch { }

            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'node.exe'"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        try
                        {
                            string cmd = obj["CommandLine"] as string;
                            if (string.IsNullOrEmpty(cmd)) continue;
                            if (cmd.IndexOf("agy-claude-style", StringComparison.OrdinalIgnoreCase) >= 0 &&
                                cmd.IndexOf("inject.js", StringComparison.OrdinalIgnoreCase) >= 0 &&
                                cmd.IndexOf("--watch", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                int pid = Convert.ToInt32(obj["ProcessId"]);
                                if (pid > 0 && pid != Process.GetCurrentProcess().Id)
                                {
                                    try
                                    {
                                        using (Process p = Process.GetProcessById(pid))
                                        {
                                            if (!p.HasExited && string.Equals(p.ProcessName, "node", StringComparison.OrdinalIgnoreCase))
                                            {
                                                p.Kill();
                                                p.WaitForExit(1500);
                                                if (log != null) log("已替换旧版 Node 守护进程 (PID " + pid + ")");
                                            }
                                        }
                                    }
                                    catch { }
                                }
                            }
                        }
                        finally
                        {
                            obj.Dispose();
                        }
                    }
                }
            }
            catch { }
        }

        private static string ReadShortcutWorkingDir(string lnkPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                object shell = Activator.CreateInstance(shellType);
                object lnk = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnkPath });
                return lnk.GetType().InvokeMember("WorkingDirectory", BindingFlags.GetProperty, null, lnk, null) as string;
            }
            catch
            {
                return null;
            }
        }

        public static void CreateStartupShortcut(string installDir, string pluginDir)
        {
            string lnkPath = GetStartupShortcutPath();
            string targetExe = Path.Combine(installDir, WatcherExeName);
            string shortcutArgs = "--watch";
            if (!string.IsNullOrEmpty(pluginDir))
            {
                shortcutArgs += " --plugin-dir \"" + pluginDir + "\"";
            }
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object lnk = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnkPath });
            Type lnkType = lnk.GetType();
            lnkType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, lnk, new object[] { targetExe });
            lnkType.InvokeMember("Arguments", BindingFlags.SetProperty, null, lnk, new object[] { shortcutArgs });
            lnkType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, lnk, new object[] { NormalizeDirPath(installDir) });
            lnkType.InvokeMember("Description", BindingFlags.SetProperty, null, lnk, new object[] { "Obsidian Prism (obsidian-prism) watcher" });
            lnkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, lnk, null);
        }

        public static void RegisterUninstallEntry(string installDir, string version)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallRegSubKey))
            {
                if (key == null) return;
                string exePath = Path.Combine(installDir, SelfInstalledExeName);
                key.SetValue("DisplayName", "Obsidian Prism · 黑曜棱镜 (Optical UI & Motion Suite for Antigravity)", RegistryValueKind.String);
                key.SetValue("DisplayVersion", version ?? "1.0.7-beta.1", RegistryValueKind.String);
                key.SetValue("Publisher", "Obsidian Prism Contributors", RegistryValueKind.String);
                key.SetValue("InstallLocation", installDir, RegistryValueKind.String);
                key.SetValue("DisplayIcon", exePath + ",0", RegistryValueKind.String);
                key.SetValue("UninstallString", "\"" + exePath + "\" --uninstall", RegistryValueKind.String);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }

        public static OperationResult RunInstall(InstallerOptions opts, Action<int, string> progress)
        {
            OperationResult result = new OperationResult();
            result.Mode = "install";
            string installDir = NormalizeDirPath(string.IsNullOrEmpty(opts.InstallDir) ? GetDefaultInstallDir() : opts.InstallDir);
            string pluginDir = ResolveNativePluginDir(opts, installDir);
            if (IsDangerousRootPath(installDir))
            {
                throw new InvalidOperationException("已拒绝将受保护的系统或用户根目录作为安装目录: " + installDir);
            }
            if (!string.IsNullOrEmpty(pluginDir) && IsDangerousRootPath(pluginDir))
            {
                throw new InvalidOperationException("已拒绝将受保护的系统或用户根目录作为插件目录: " + pluginDir);
            }
            result.InstallDir = installDir;
            result.PluginDir = pluginDir;

            Action<int, string> report = (pct, msg) =>
            {
                if (progress != null) progress(pct, msg);
            };

            report(10, "正在检测本机 Antigravity Desktop 环境...");
            AntigravityDetectResult ag = DetectAntigravityDesktop();
            result.AntigravityExe = ag.ExePath;
            result.AntigravityVersion = ag.Version;
            if (!string.IsNullOrEmpty(ag.ExePath))
            {
                report(18, "已发现 Antigravity Desktop" + (string.IsNullOrEmpty(ag.Version) ? "" : " (" + ag.Version + ")") + ": " + ag.ExePath);
            }
            else
            {
                report(18, "未在默认目录检测到 Antigravity.exe，仍将安装并启用 CDP 自动监听");
            }

            report(28, "正在停止旧版守护进程（如存在）...");
            StopWatcherInDir(installDir, (m) => report(32, m));
            StopNativeDaemonInDir(pluginDir, (m) => report(34, m));
            if (!opts.NoKillLegacy)
            {
                StopLegacyNodeWatchers((m) => report(35, m));
            }

            report(45, "正在部署原生 Sidecar 插件与独立守护资源...");
            AssertNoReparsePointChain(installDir, installDir);
            Directory.CreateDirectory(installDir);
            if (!string.IsNullOrEmpty(pluginDir))
            {
                AssertNoReparsePointChain(pluginDir, pluginDir);
                Directory.CreateDirectory(pluginDir);
            }

            RestoreUserConfigBackupIfNeeded(installDir, pluginDir);

            string installCfgPath = Path.Combine(installDir, "config.json");
            string pluginCfgPath = !string.IsNullOrEmpty(pluginDir) ? Path.Combine(pluginDir, "config.json") : null;
            bool hadInstallCfg = File.Exists(installCfgPath);
            bool hadPluginCfg = !string.IsNullOrEmpty(pluginCfgPath) && File.Exists(pluginCfgPath);
            if (!hadInstallCfg && hadPluginCfg)
            {
                try { File.Copy(pluginCfgPath, installCfgPath, false); hadInstallCfg = true; } catch { }
            }
            else if (hadInstallCfg && hadPluginCfg)
            {
                try
                {
                    if (File.GetLastWriteTimeUtc(pluginCfgPath) > File.GetLastWriteTimeUtc(installCfgPath))
                    {
                        File.Copy(pluginCfgPath, installCfgPath, true);
                    }
                }
                catch { }
            }

            bool preservedConfig = false;
            const string nativePrefix = "native-plugin/";
            using (Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("AGY_PAYLOAD.zip"))
            {
                if (resStream == null) throw new InvalidOperationException("安装包内嵌资源 AGY_PAYLOAD.zip 缺失");
                using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.Name)) continue;
                        string normFull = entry.FullName.Replace('\\', '/');
                        bool isNativeEntry = normFull.StartsWith(nativePrefix, StringComparison.OrdinalIgnoreCase);
                        string relPath = isNativeEntry ? normFull.Substring(nativePrefix.Length) : normFull;
                        if (string.IsNullOrEmpty(relPath)) continue;

                        string targetRoot = isNativeEntry ? pluginDir : installDir;
                        if (string.IsNullOrEmpty(targetRoot)) continue;

                        string destPath = ResolveSafeZipEntryDestPath(targetRoot, relPath);
                        string parent = Path.GetDirectoryName(destPath);
                        if (!string.IsNullOrEmpty(parent))
                        {
                            Directory.CreateDirectory(parent);
                            AssertNoReparsePointChain(parent, targetRoot);
                        }
                        if (IsReparsePoint(destPath))
                        {
                            throw new InvalidOperationException("检测到目标文件为符号链接或重解析点，已拒绝覆盖: " + destPath);
                        }

                        if (string.Equals(entry.Name, "config.json", StringComparison.OrdinalIgnoreCase) && File.Exists(destPath))
                        {
                            if (!isNativeEntry) preservedConfig = true;
                            continue;
                        }
                        using (Stream inStream = entry.Open())
                        using (FileStream outStream = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                        {
                            inStream.CopyTo(outStream);
                        }
                    }
                }
            }
            if (hadInstallCfg && !string.IsNullOrEmpty(pluginCfgPath) && File.Exists(installCfgPath))
            {
                try { File.Copy(installCfgPath, pluginCfgPath, true); } catch { }
            }
            result.PreservedExistingConfig = preservedConfig;
            result.NativePluginDeployed = !string.IsNullOrEmpty(pluginDir) && File.Exists(Path.Combine(pluginDir, "plugin.json"));
            if (!string.IsNullOrEmpty(pluginDir))
            {
                CdpHelper.SyncHostPluginRegistry(pluginDir, true);
            }
            report(62, preservedConfig ? "已保留本机现有 config.json 用户配置并同步部署原生 Sidecar 插件" : "已部署原生 Sidecar 插件并写入默认配置 config.json");

            try
            {
                string selfSrc = Assembly.GetExecutingAssembly().Location;
                string selfDest = Path.Combine(installDir, SelfInstalledExeName);
                if (!string.IsNullOrEmpty(selfSrc) && File.Exists(selfSrc) &&
                    !string.Equals(Path.GetFullPath(selfSrc), Path.GetFullPath(selfDest), StringComparison.OrdinalIgnoreCase))
                {
                    File.Copy(selfSrc, selfDest, true);
                }
            }
            catch { }

            PluginManifest manifest = PluginManifest.Load(installDir);
            Dictionary<string, object> activeCfg = CdpHelper.ReadConfig(installDir, manifest);
            result.ConfigSummary = string.Format(
                "语言={0} | 配色={1} | 动效={2} | Omni={3}",
                activeCfg.ContainsKey("language") ? activeCfg["language"] : "zh-CN",
                activeCfg.ContainsKey("palette") ? activeCfg["palette"] : "obsidian",
                activeCfg.ContainsKey("motionLevel") ? activeCfg["motionLevel"] : "standard",
                activeCfg.ContainsKey("omniModule") ? activeCfg["omniModule"] : "on"
            );

            string shortcutStateDir = !string.IsNullOrEmpty(pluginDir) ? pluginDir : installDir;
            result.PatchedShortcuts = CdpHelper.EnsureAntigravityShortcutsOptIn(
                installDir,
                GetDefaultInstallDir(),
                shortcutStateDir,
                (m) => report(68, m)
            );

            if (!opts.NoAutostart)
            {
                report(72, "正在配置 Windows 开机自动修补与卸载入口...");
                CreateStartupShortcut(installDir, pluginDir);
                RegisterUninstallEntry(installDir, manifest.Version);
            }
            else
            {
                report(72, "已按参数跳过开机自启注册");
            }

            if (!opts.NoNativeDaemon && result.NativePluginDeployed)
            {
                report(78, "正在激活原生五通道 Sidecar Daemon...");
                result.NativeDaemonStarted = CdpHelper.EnsureNativeDaemonRunning(pluginDir, opts.CdpPort, ag.ExePath, (m) => report(80, m));
            }

            report(82, "正在启动后台静默守护进程...");
            string watcherExe = Path.Combine(installDir, WatcherExeName);
            string watcherArgs = "--watch --dir \"" + installDir + "\"";
            if (!string.IsNullOrEmpty(pluginDir))
            {
                watcherArgs += " --plugin-dir \"" + pluginDir + "\"";
            }
            if (opts.NoNativeDaemon)
            {
                watcherArgs += " --no-native-daemon";
            }
            if (opts.NoRelaunchPrompt)
            {
                watcherArgs += " --no-relaunch-prompt";
            }
            if (opts.CdpPort.HasValue && opts.CdpPort.Value > 0)
            {
                watcherArgs += " --cdp-port " + opts.CdpPort.Value;
            }
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = watcherExe;
            psi.Arguments = watcherArgs;
            psi.WorkingDirectory = installDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(psi);

            report(90, "正在检查 Antigravity Desktop 实时注入状态...");
            int? port = CdpHelper.ReadPort(opts.CdpPort);
            bool cdpReachable = false;
            string watchLogPath = Path.Combine(installDir, "watch.log");
            if (port.HasValue)
            {
                List<CdpPageInfo> pages = null;
                for (int attempt = 0; attempt < 15; attempt++)
                {
                    try
                    {
                        pages = CdpHelper.ListPagesAsync(port.Value).GetAwaiter().GetResult();
                        cdpReachable = true;
                        string logContent = "";
                        if (File.Exists(watchLogPath))
                        {
                            using (FileStream fs = new FileStream(watchLogPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                            using (StreamReader sr = new StreamReader(fs, Encoding.UTF8))
                            {
                                logContent = sr.ReadToEnd();
                            }
                        }
                        bool watcherInjected = logContent.IndexOf("[✓] 已注入 obsidian-prism:", StringComparison.Ordinal) >= 0 ||
                                               (!string.IsNullOrEmpty(pluginDir) && CdpHelper.IsNativeDaemonAlive(pluginDir));
                        if (pages != null && pages.Count > 0 && watcherInjected)
                        {
                            bool allReady = true;
                            List<string> titles = new List<string>();
                            for (int p = 0; p < pages.Count; p++)
                            {
                                titles.Add(CdpHelper.ShortTitle(pages[p]));
                                using (CdpSession s = CdpSession.ConnectAsync(pages[p].WebSocketDebuggerUrl, 2000).GetAwaiter().GetResult())
                                {
                                    object okVal = s.EvaluateAsync("Boolean(window.__agPrism || window.__agClaudeStyle)", false).GetAwaiter().GetResult();
                                    if (!(okVal is bool) || !((bool)okVal))
                                    {
                                        allReady = false;
                                    }
                                }
                            }
                            if (allReady)
                            {
                                result.InjectedPages = titles;
                                break;
                            }
                        }
                    }
                    catch
                    {
                        pages = null;
                        if (!ag.IsRunning && !opts.CdpPort.HasValue && attempt >= 1)
                        {
                            break;
                        }
                    }
                    Thread.Sleep(350);
                }
            }
            result.CdpPort = cdpReachable ? port : null;

            result.Ok = true;
            if (result.InjectedPages.Count > 0)
            {
                result.Headline = string.Format("修补成功！已实时注入 {0} 个 Antigravity 窗口", result.InjectedPages.Count);
                result.Detail = "已部署原生五通道 Sidecar 插件与后台热备守护，并配置开机自启。后续打开新窗口或更新 Antigravity 后也会自动生效。";
                for (int i = 0; i < result.InjectedPages.Count; i++)
                {
                    report(98, "已注入窗口: " + result.InjectedPages[i]);
                }
            }
            else if (cdpReachable && port.HasValue)
            {
                result.Headline = "已安装原生插件并启动守护！等待 Antigravity 窗口就绪";
                result.Detail = "已部署原生 Sidecar 插件并启动后台守护。检测到调试端口 " + port.Value + "，窗口就绪后将自动完成注入。";
            }
            else
            {
                BareHostProcessInfo bareHost = !opts.CdpPort.HasValue ? CdpHelper.FindBareAntigravityMainProcess() : null;
                if (bareHost != null)
                {
                    result.BareHostDetected = true;
                    result.Headline = "安装完成！重新打开一次 Antigravity 即可激活界面";
                    result.Detail = "检测到当前 Antigravity (v2.33.0+) 未开启本地光学桥接端口；桌面与开始菜单快捷方式已自动补齐 --remote-debugging-port=0，重新打开后将自动永久生效。";
                }
                else
                {
                    result.Headline = "安装成功！原生 Sidecar 插件与自动修补已就绪";
                    result.Detail = "当前未检测到运行中的 Antigravity Desktop；快捷方式与守护进程已就绪，打开 Antigravity Desktop 后会自动立即生效。";
                }
            }
            report(100, result.Headline);
            return result;
        }

        public static OperationResult RunUninstall(InstallerOptions opts, Action<int, string> progress)
        {
            OperationResult result = new OperationResult();
            result.Mode = "uninstall";
            string installDir = NormalizeDirPath(string.IsNullOrEmpty(opts.InstallDir) ? GetDefaultInstallDir() : opts.InstallDir);
            string pluginDir = ResolveNativePluginDir(opts, installDir);
            if (IsDangerousRootPath(installDir))
            {
                throw new InvalidOperationException("已拒绝在受保护的系统或用户根目录执行卸载: " + installDir);
            }
            if (!string.IsNullOrEmpty(pluginDir) && IsDangerousRootPath(pluginDir))
            {
                throw new InvalidOperationException("已拒绝在受保护的系统或用户根目录执行插件目录卸载: " + pluginDir);
            }
            result.InstallDir = installDir;
            result.PluginDir = pluginDir;

            Action<int, string> report = (pct, msg) =>
            {
                if (progress != null) progress(pct, msg);
            };

            report(15, "正在停止后台守护进程...");
            StopWatcherInDir(installDir, (m) => report(25, m));
            StopNativeDaemonInDir(pluginDir, (m) => report(30, m));

            report(40, "正在通过 CDP 清理运行中的 Antigravity Desktop 界面...");
            int? port = CdpHelper.ReadPort(opts.CdpPort);
            result.CdpPort = port;
            string removeExpr = null;
            if (File.Exists(Path.Combine(installDir, "manifest.json")))
            {
                try { removeExpr = PluginManifest.Load(installDir).RemoveExpression; } catch { }
            }
            if (string.IsNullOrEmpty(removeExpr))
            {
                try
                {
                    using (Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("AGY_PAYLOAD.zip"))
                    using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                    {
                        ZipArchiveEntry entry = archive.GetEntry("manifest.json");
                        if (entry != null)
                        {
                            using (StreamReader sr = new StreamReader(entry.Open(), Encoding.UTF8))
                            {
                                Dictionary<string, object> raw = MiniJson.ParseObject(sr.ReadToEnd());
                                if (raw.ContainsKey("removeExpression")) removeExpr = raw["removeExpression"] as string;
                            }
                        }
                    }
                }
                catch { }
            }

            if (port.HasValue && !string.IsNullOrEmpty(removeExpr))
            {
                try
                {
                    List<CdpPageInfo> pages = CdpHelper.ListPagesAsync(port.Value).GetAwaiter().GetResult();
                    for (int i = 0; i < pages.Count; i++)
                    {
                        try
                        {
                            using (CdpSession s = CdpSession.ConnectAsync(pages[i].WebSocketDebuggerUrl, 3000).GetAwaiter().GetResult())
                            {
                                s.EvaluateAsync(removeExpr, false).GetAwaiter().GetResult();
                                string title = CdpHelper.ShortTitle(pages[i]);
                                result.InjectedPages.Add(title);
                                report(55, "已恢复原生界面: " + title);
                            }
                        }
                        catch { }
                    }
                }
                catch { }
            }

            report(70, "正在还原快捷方式并移除开机自启与卸载注册表项...");
            result.RestoredShortcuts = CdpHelper.RestoreAntigravityShortcutsOptIn(
                installDir,
                GetDefaultInstallDir(),
                !string.IsNullOrEmpty(pluginDir) ? pluginDir : installDir,
                (m) => report(72, m)
            );
            bool isDefaultInstall = string.Equals(
                NormalizeDirPath(installDir),
                NormalizeDirPath(GetDefaultInstallDir()),
                StringComparison.OrdinalIgnoreCase
            );
            try
            {
                string lnk = GetStartupShortcutPath();
                if (File.Exists(lnk))
                {
                    string lnkWork = ReadShortcutWorkingDir(lnk);
                    if (isDefaultInstall || (!string.IsNullOrEmpty(lnkWork) &&
                        string.Equals(NormalizeDirPath(lnkWork), NormalizeDirPath(installDir), StringComparison.OrdinalIgnoreCase)))
                    {
                        File.Delete(lnk);
                    }
                }
            }
            catch { }
            try
            {
                using (RegistryKey regKey = Registry.CurrentUser.OpenSubKey(UninstallRegSubKey))
                {
                    if (regKey != null)
                    {
                        string regLoc = regKey.GetValue("InstallLocation") as string;
                        if (isDefaultInstall || (!string.IsNullOrEmpty(regLoc) &&
                            string.Equals(NormalizeDirPath(regLoc), NormalizeDirPath(installDir), StringComparison.OrdinalIgnoreCase)))
                        {
                            regKey.Close();
                            Registry.CurrentUser.DeleteSubKeyTree(UninstallRegSubKey, false);
                        }
                    }
                }
            }
            catch { }

            if (!opts.PurgeData)
            {
                BackupUserConfigBeforeUninstall(installDir, pluginDir);
            }

            if (!string.IsNullOrEmpty(pluginDir))
            {
                CdpHelper.SyncHostPluginRegistry(pluginDir, false);
            }

            if (!string.IsNullOrEmpty(pluginDir) && Directory.Exists(pluginDir))
            {
                report(80, "正在清理原生 Sidecar 插件目录: " + pluginDir);
                try { SafeDeleteDirectory(pluginDir); } catch { }
            }

            report(85, "正在清理安装目录: " + installDir);
            string selfExe = Assembly.GetExecutingAssembly().Location;
            string installDirPrefix = NormalizeDirPath(installDir).TrimEnd('\\', '/').ToLowerInvariant() + "\\";
            bool runningInsideInstallDir = !string.IsNullOrEmpty(selfExe) &&
                Path.GetFullPath(selfExe).ToLowerInvariant().StartsWith(installDirPrefix, StringComparison.Ordinal);

            if (Directory.Exists(installDir))
            {
                if (!runningInsideInstallDir)
                {
                    try { SafeDeleteDirectory(installDir); } catch { }
                }
                else
                {
                    if (IsDangerousRootPath(installDir))
                    {
                        throw new InvalidOperationException("已拒绝清理受保护的系统或用户根目录: " + installDir);
                    }
                    CleanInstallDirKeepingSelfExe(installDir, Path.GetFullPath(selfExe));
                    result.SelfDeleteScheduled = true;
                }
            }

            if (opts.PurgeData)
            {
                report(92, "正在清除插件配置与遥测缓存...");
                PurgeUserPluginData(pluginDir);
            }

            result.Ok = true;
            result.Headline = "已卸载并恢复 Antigravity Desktop 原生界面";
            result.Detail = result.InjectedPages.Count > 0
                ? string.Format("已停止守护、移除自启，并立即还原了 {0} 个打开的窗口。", result.InjectedPages.Count)
                : "已停止守护、移除开机自启并清理安装文件。";
            report(100, result.Headline);
            return result;
        }

        public static void ScheduleSelfDeleteIfNeeded(string installDir)
        {
            string selfExe = Assembly.GetExecutingAssembly().Location;
            if (string.IsNullOrEmpty(selfExe)) return;
            string safeInstallDir = (!string.IsNullOrEmpty(installDir) && !IsDangerousRootPath(installDir))
                ? NormalizeDirPath(installDir)
                : string.Empty;

            // 通过环境变量 + -LiteralPath 传递路径，彻底消除命令拼接与元字符注入风险（不使用 cmd.exe /c）
            string ps =
                "$exe = $env:OBSIDIAN_PRISM_SELF_DELETE_EXE; " +
                "$dir = $env:OBSIDIAN_PRISM_SELF_DELETE_DIR; " +
                "for ($i = 0; $i -lt 10; $i++) { " +
                "Start-Sleep -Milliseconds 900; " +
                "if ($exe) { Remove-Item -LiteralPath $exe -Force -ErrorAction SilentlyContinue }; " +
                "if ($dir) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }; " +
                "if ((-not $dir) -or (-not (Test-Path -LiteralPath $dir))) { break } " +
                "}";
            string encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(ps));
            string[] psCandidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"),
                "powershell.exe",
                "pwsh.exe"
            };

            for (int i = 0; i < psCandidates.Length; i++)
            {
                string candidate = psCandidates[i];
                if (string.IsNullOrEmpty(candidate)) continue;
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo(
                        candidate,
                        "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand " + encoded
                    );
                    psi.WorkingDirectory = Path.GetTempPath();
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.EnvironmentVariables["OBSIDIAN_PRISM_SELF_DELETE_EXE"] = selfExe;
                    psi.EnvironmentVariables["OBSIDIAN_PRISM_SELF_DELETE_DIR"] = safeInstallDir;
                    if (Process.Start(psi) != null)
                    {
                        return;
                    }
                }
                catch { }
            }
        }
    }

    internal class InstallerForm : Form
    {
        private readonly InstallerOptions _opts;
        private readonly Label _titleLabel;
        private readonly Label _subtitleLabel;
        private readonly Label _statusHeadline;
        private readonly Label _statusDetail;
        private readonly Label _metaLabel;
        private readonly ProgressBar _progressBar;
        private readonly TextBox _logBox;
        private readonly Button _uninstallBtn;
        private readonly Button _openDirBtn;
        private readonly Button _installBtn;
        private readonly Button _launchAgBtn;
        private readonly Button _closeBtn;

        private string _activeInstallDir;
        private string _activePluginDir;
        private string _antigravityExe;
        private bool _selfDeleteOnClose;
        private bool _busy;

        public InstallerForm(InstallerOptions opts)
        {
            _opts = opts;
            _activeInstallDir = InstallerCore.NormalizeDirPath(string.IsNullOrEmpty(opts.InstallDir) ? InstallerCore.GetDefaultInstallDir() : opts.InstallDir);
            _activePluginDir = InstallerCore.ResolveNativePluginDir(opts, _activeInstallDir);

            SuspendLayout();

            Text = "Obsidian Prism · 黑曜棱镜 安装与修补工具";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Regular);
            ClientSize = new Size(588, 464);
            BackColor = Color.FromArgb(244, 247, 251);
            try { Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location); } catch { }

            Panel header = new Panel();
            header.Dock = DockStyle.Top;
            header.Height = 80;
            header.BackColor = Color.FromArgb(14, 17, 25);
            header.Padding = new Padding(20, 14, 20, 12);

            _titleLabel = new Label();
            _titleLabel.Text = "Obsidian Prism · 黑曜棱镜安装器";
            _titleLabel.ForeColor = Color.FromArgb(248, 250, 252);
            _titleLabel.Font = new Font("Microsoft YaHei UI", 13.5f, FontStyle.Bold);
            _titleLabel.AutoSize = true;
            _titleLabel.Location = new Point(20, 14);

            _subtitleLabel = new Label();
            _subtitleLabel.Text = "Antigravity 主题外观、动效调节、上下文监控与思考翻译套件";
            _subtitleLabel.ForeColor = Color.FromArgb(96, 165, 250);
            _subtitleLabel.Font = new Font("Microsoft YaHei UI", 9f, FontStyle.Regular);
            _subtitleLabel.AutoSize = true;
            _subtitleLabel.Location = new Point(21, 46);

            header.Controls.Add(_titleLabel);
            header.Controls.Add(_subtitleLabel);
            Controls.Add(header);

            Panel card = new Panel();
            card.Location = new Point(20, 96);
            card.Size = new Size(548, 118);
            card.BackColor = Color.White;
            card.BorderStyle = BorderStyle.FixedSingle;

            _statusHeadline = new Label();
            _statusHeadline.Text = opts.Uninstall ? "准备卸载并恢复原版界面..." : "正在检测本地 Antigravity 环境...";
            _statusHeadline.ForeColor = Color.FromArgb(28, 25, 23);
            _statusHeadline.Font = new Font("Microsoft YaHei UI", 11f, FontStyle.Bold);
            _statusHeadline.Location = new Point(14, 12);
            _statusHeadline.Size = new Size(520, 26);

            _statusDetail = new Label();
            _statusDetail.Text = opts.Uninstall
                ? "请确认是否卸载 Obsidian Prism、停止后台守护并恢复原生界面。"
                : "正在只读检测 Antigravity Desktop 与安装状态，等待你确认后再开始安装...";
            _statusDetail.ForeColor = Color.FromArgb(87, 83, 78);
            _statusDetail.Location = new Point(14, 42);
            _statusDetail.Size = new Size(520, 40);

            _metaLabel = new Label();
            _metaLabel.Text = "插件目录: " + _activePluginDir;
            _metaLabel.ForeColor = Color.FromArgb(120, 113, 108);
            _metaLabel.Font = new Font("Microsoft YaHei UI", 8.2f, FontStyle.Regular);
            _metaLabel.Location = new Point(14, 88);
            _metaLabel.Size = new Size(520, 20);
            _metaLabel.AutoEllipsis = true;

            card.Controls.Add(_statusHeadline);
            card.Controls.Add(_statusDetail);
            card.Controls.Add(_metaLabel);
            Controls.Add(card);

            _progressBar = new ProgressBar();
            _progressBar.Location = new Point(20, 224);
            _progressBar.Size = new Size(548, 14);
            _progressBar.Minimum = 0;
            _progressBar.Maximum = 100;
            _progressBar.Value = 0;
            Controls.Add(_progressBar);

            _logBox = new TextBox();
            _logBox.Location = new Point(20, 248);
            _logBox.Size = new Size(548, 148);
            _logBox.Multiline = true;
            _logBox.ReadOnly = true;
            _logBox.ScrollBars = ScrollBars.Vertical;
            _logBox.BackColor = Color.FromArgb(252, 251, 249);
            _logBox.ForeColor = Color.FromArgb(41, 37, 36);
            _logBox.Font = new Font("Consolas", 8.8f, FontStyle.Regular);
            Controls.Add(_logBox);

            _uninstallBtn = new Button();
            _uninstallBtn.Text = "卸载并恢复原版";
            _uninstallBtn.Location = new Point(20, 412);
            _uninstallBtn.Size = new Size(130, 34);
            _uninstallBtn.Enabled = false;
            _uninstallBtn.FlatStyle = FlatStyle.System;
            _uninstallBtn.Click += async (s, e) => await HandleUninstallClickAsync();

            _openDirBtn = new Button();
            _openDirBtn.Text = "打开配置目录";
            _openDirBtn.Location = new Point(158, 412);
            _openDirBtn.Size = new Size(108, 34);
            _openDirBtn.Enabled = false;
            _openDirBtn.FlatStyle = FlatStyle.System;
            _openDirBtn.Click += (s, e) =>
            {
                try
                {
                    string targetDir = (!string.IsNullOrEmpty(_activePluginDir) && Directory.Exists(_activePluginDir))
                        ? _activePluginDir
                        : _activeInstallDir;
                    if (!string.IsNullOrEmpty(targetDir) && Directory.Exists(targetDir)) Process.Start("explorer.exe", targetDir);
                }
                catch { }
            };

            _installBtn = new Button();
            _installBtn.Text = "立即安装";
            _installBtn.Location = new Point(318, 412);
            _installBtn.Size = new Size(134, 34);
            _installBtn.Visible = !opts.Uninstall;
            _installBtn.Enabled = false;
            _installBtn.FlatStyle = FlatStyle.Flat;
            _installBtn.FlatAppearance.BorderSize = 0;
            _installBtn.Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Bold);
            _installBtn.Cursor = Cursors.Hand;
            _installBtn.Click += async (s, e) => await ExecuteInstallAsync();

            _launchAgBtn = new Button();
            _launchAgBtn.Text = "启动 Antigravity";
            _launchAgBtn.Location = new Point(318, 412);
            _launchAgBtn.Size = new Size(134, 34);
            _launchAgBtn.Visible = false;
            _launchAgBtn.FlatStyle = FlatStyle.System;
            _launchAgBtn.Click += (s, e) =>
            {
                try
                {
                    if (!string.IsNullOrEmpty(_antigravityExe) && File.Exists(_antigravityExe))
                    {
                        ProcessStartInfo lpsi = new ProcessStartInfo(_antigravityExe, CdpHelper.CdpOptInFlag);
                        lpsi.UseShellExecute = false;
                        Process.Start(lpsi);
                    }
                }
                catch { }
            };

            _closeBtn = new Button();
            _closeBtn.Text = "取消";
            _closeBtn.Location = new Point(460, 412);
            _closeBtn.Size = new Size(108, 34);
            _closeBtn.Enabled = true;
            _closeBtn.FlatStyle = FlatStyle.System;
            _closeBtn.Click += (s, e) => Close();

            Controls.Add(_uninstallBtn);
            Controls.Add(_openDirBtn);
            Controls.Add(_installBtn);
            Controls.Add(_launchAgBtn);
            Controls.Add(_closeBtn);
            CancelButton = _closeBtn;
            UpdateInstallButtonStyle();

            // Coordinates above are designed at 96 DPI; set AutoScaleDimensions + Dpi mode
            // so PerMonitorV2 scales the form and child controls proportionally on high-DPI displays.
            AutoScaleDimensions = new SizeF(96F, 96F);
            AutoScaleMode = AutoScaleMode.Dpi;
            ResumeLayout(false);
            PerformLayout();

            Shown += async (s, e) => await StartInitialActionAsync();
            FormClosing += (s, e) =>
            {
                if (_busy)
                {
                    e.Cancel = true;
                    return;
                }
                if (_selfDeleteOnClose)
                {
                    InstallerCore.ScheduleSelfDeleteIfNeeded(_activeInstallDir);
                }
            };
        }

        private void UpdateInstallButtonStyle()
        {
            if (_installBtn.Enabled)
            {
                _installBtn.BackColor = Color.FromArgb(37, 99, 235);
                _installBtn.ForeColor = Color.White;
            }
            else
            {
                _installBtn.BackColor = Color.FromArgb(203, 213, 225);
                _installBtn.ForeColor = Color.FromArgb(100, 116, 139);
            }
        }

        private void AppendLog(string msg)
        {
            if (IsDisposed || Disposing) return;
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action<string>(AppendLog), msg); } catch { }
                return;
            }
            _logBox.AppendText(string.Format("[{0}] {1}\r\n", DateTime.Now.ToString("HH:mm:ss"), msg));
        }

        private void UpdateProgress(int pct, string msg)
        {
            if (IsDisposed || Disposing) return;
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action<int, string>(UpdateProgress), pct, msg); } catch { }
                return;
            }
            _progressBar.Value = Math.Max(0, Math.Min(100, pct));
            AppendLog(msg);
        }

        private async Task StartInitialActionAsync()
        {
            if (_opts.Uninstall)
            {
                DialogResult dr = MessageBox.Show(
                    this,
                    "确认要卸载 Obsidian Prism 并恢复 Antigravity Desktop 原生界面吗？",
                    "卸载确认",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );
                if (dr != DialogResult.Yes)
                {
                    Close();
                    return;
                }
                await ExecuteUninstallAsync();
            }
            else
            {
                await PrepareInstallChoiceAsync();
            }
        }

        private async Task PrepareInstallChoiceAsync()
        {
            SetButtonsEnabled(false);
            _closeBtn.Enabled = true;
            try
            {
                string installDir = _activeInstallDir;
                string pluginDir = _activePluginDir;
                AntigravityDetectResult ag = null;
                bool alreadyInstalled = false;
                bool hasDir = false;
                int? port = null;

                await Task.Run(() =>
                {
                    ag = InstallerCore.DetectAntigravityDesktop();
                    bool hasNative = !string.IsNullOrEmpty(pluginDir) && File.Exists(Path.Combine(pluginDir, "plugin.json"));
                    bool hasWatcher = Directory.Exists(installDir) && File.Exists(Path.Combine(installDir, "obsidian-prism-watcher.exe"));
                    alreadyInstalled = hasNative || hasWatcher;
                    hasDir = (!string.IsNullOrEmpty(pluginDir) && Directory.Exists(pluginDir)) || Directory.Exists(installDir);
                    port = CdpHelper.ReadPort(_opts.CdpPort);
                });

                if (IsDisposed || Disposing) return;

                _antigravityExe = ag != null ? ag.ExePath : null;
                if (alreadyInstalled)
                {
                    _statusHeadline.Text = "已检测到本地 Obsidian Prism · 请选择操作";
                    _statusHeadline.ForeColor = Color.FromArgb(28, 25, 23);
                    _statusDetail.Text = "点击「重新安装 / 升级」可覆盖更新插件并保留现有配置；点击「卸载并恢复原版」可彻底卸载并还原原生界面。";
                    _installBtn.Text = "重新安装 / 升级";
                }
                else
                {
                    _statusHeadline.Text = "是否安装 Obsidian Prism · 黑曜棱镜？";
                    _statusHeadline.ForeColor = Color.FromArgb(28, 25, 23);
                    _statusDetail.Text = "将部署原生 Sidecar 插件、后台热备守护与开机自启（不修改 Antigravity 核心程序文件）。请点击「立即安装」开始，或点击「取消」退出。";
                    _installBtn.Text = "立即安装";
                }

                string agSummary;
                if (ag != null && !string.IsNullOrEmpty(ag.ExePath))
                {
                    string ver = !string.IsNullOrEmpty(ag.Version) ? "v" + ag.Version : "已检测到";
                    string runState = ag.IsRunning
                        ? (port.HasValue ? "运行中 · 端口 " + port.Value : "运行中")
                        : "未运行";
                    agSummary = "Antigravity: " + ver + " (" + runState + ")";
                }
                else
                {
                    agSummary = "未检测到运行中的 Antigravity（支持预先安装）";
                }
                _metaLabel.Text = agSummary + " | " + pluginDir;

                AppendLog("环境只读预检完成，当前未对本机做任何修改，等待你确认操作。");
                AppendLog("原生插件目录: " + pluginDir);
                AppendLog("后台守护目录: " + installDir);
                if (ag != null && !string.IsNullOrEmpty(ag.ExePath))
                {
                    AppendLog("检测到 Antigravity Desktop: " + ag.ExePath);
                }

                _progressBar.Value = 0;
                _launchAgBtn.Visible = false;
                _installBtn.Visible = true;
                _installBtn.Enabled = true;
                _uninstallBtn.Enabled = alreadyInstalled;
                _openDirBtn.Enabled = hasDir;
                _closeBtn.Text = "取消";
                _closeBtn.Enabled = true;
                AcceptButton = _installBtn;
                UpdateInstallButtonStyle();
            }
            catch (Exception ex)
            {
                if (IsDisposed || Disposing) return;
                _statusHeadline.Text = "准备安装 Obsidian Prism";
                _statusDetail.Text = "环境预检遇到提示：" + ex.Message + "。你仍可点击「立即安装」继续或点击「取消」退出。";
                AppendLog("[!] 预检提示: " + ex.Message);
                _installBtn.Visible = true;
                _installBtn.Text = "立即安装";
                _installBtn.Enabled = true;
                _closeBtn.Text = "取消";
                _closeBtn.Enabled = true;
                AcceptButton = _installBtn;
                UpdateInstallButtonStyle();
            }
        }

        private async Task ExecuteInstallAsync()
        {
            if (_busy) return;
            _busy = true;
            _statusHeadline.Text = "正在安装并修补本机 Antigravity Desktop...";
            _statusHeadline.ForeColor = Color.FromArgb(28, 25, 23);
            _statusDetail.Text = "正在部署原生 Sidecar 插件与后台热备守护，请稍候...";
            _progressBar.Value = 5;
            SetButtonsEnabled(false);
            try
            {
                OperationResult res = await Task.Run(() => InstallerCore.RunInstall(_opts, UpdateProgress));
                _activeInstallDir = res.InstallDir;
                if (!string.IsNullOrEmpty(res.PluginDir)) _activePluginDir = res.PluginDir;
                _antigravityExe = res.AntigravityExe;
                _statusHeadline.Text = res.Headline;
                _statusHeadline.ForeColor = Color.FromArgb(21, 128, 61);
                _statusDetail.Text = res.Detail;
                _metaLabel.Text = "配置: " + res.ConfigSummary;
                _openDirBtn.Enabled = (!string.IsNullOrEmpty(_activePluginDir) && Directory.Exists(_activePluginDir)) || Directory.Exists(_activeInstallDir);
                _uninstallBtn.Enabled = true;
                bool showLaunch = (!string.IsNullOrEmpty(_antigravityExe) && res.InjectedPages.Count == 0 && !res.BareHostDetected);
                _launchAgBtn.Visible = showLaunch;
                _launchAgBtn.Enabled = showLaunch;
                _installBtn.Visible = !showLaunch;
                if (!showLaunch)
                {
                    _installBtn.Text = "重新安装";
                    _installBtn.Enabled = true;
                }
                _closeBtn.Text = "完成并关闭";
                AcceptButton = _closeBtn;

                if (res.BareHostDetected &&
                    !_opts.Silent &&
                    !_opts.NoRelaunchPrompt &&
                    Environment.GetEnvironmentVariable("PRISM_NO_RELAUNCH_PROMPT") != "1" &&
                    Environment.GetEnvironmentVariable("AG_PRISM_NO_RELAUNCH_PROMPT") != "1")
                {
                    BareHostProcessInfo bareHost = CdpHelper.FindBareAntigravityMainProcess();
                    if (bareHost != null)
                    {
                        DialogResult relaunchDr = MessageBox.Show(
                            this,
                            "检测到正在运行的 Antigravity 未开启本地光学桥接端口（v2.33.0+ 默认关闭）。\r\n" +
                            "桌面与开始菜单快捷方式已自动补齐 --remote-debugging-port=0。\r\n\r\n" +
                            "是否立即重新打开 Antigravity 使黑曜棱镜（Obsidian Prism）界面当场生效？",
                            "立即激活 Obsidian Prism",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        CdpHelper.RecordPromptedForHost(
                            bareHost.Pid,
                            bareHost.StartTimeMs,
                            relaunchDr == DialogResult.Yes ? "yes" : "no",
                            res.InstallDir,
                            res.PluginDir
                        );
                        if (relaunchDr == DialogResult.Yes)
                        {
                            _statusHeadline.Text = "正在带参重新打开 Antigravity 并激活界面...";
                            AppendLog("正在等待旧实例释放锁并带 --remote-debugging-port=0 重新打开 Antigravity...");
                            bool relaunched = await Task.Run(() =>
                            {
                                bool ok = CdpHelper.RelaunchAntigravityWithCdp(bareHost, 15000, AppendLog);
                                if (!ok) return false;
                                for (int w = 0; w < 24; w++)
                                {
                                    int? newPort = CdpHelper.ReadPort(null);
                                    if (newPort.HasValue)
                                    {
                                        if (!_opts.NoNativeDaemon && res.NativePluginDeployed)
                                        {
                                            CdpHelper.EnsureNativeDaemonRunning(res.PluginDir, newPort, res.AntigravityExe, AppendLog);
                                        }
                                        return true;
                                    }
                                    Thread.Sleep(350);
                                }
                                return true;
                            });
                            if (relaunched)
                            {
                                _statusHeadline.Text = "修补成功！已带参重开并激活 Antigravity 界面";
                                _statusDetail.Text = "已自动为快捷方式补齐 --remote-debugging-port=0 并激活五通道原生 Sidecar 守护，后续日常启动将自动生效。";
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _statusHeadline.Text = "修补失败";
                _statusHeadline.ForeColor = Color.FromArgb(185, 28, 28);
                _statusDetail.Text = ex.Message;
                AppendLog("[✗] 错误: " + ex);
                _launchAgBtn.Visible = false;
                _installBtn.Visible = true;
                _installBtn.Text = "重试安装";
                _installBtn.Enabled = true;
                _closeBtn.Text = "关闭";
                AcceptButton = _installBtn;
            }
            finally
            {
                _busy = false;
                _closeBtn.Enabled = true;
                UpdateInstallButtonStyle();
            }
        }

        private async Task HandleUninstallClickAsync()
        {
            DialogResult dr = MessageBox.Show(
                this,
                "确认卸载 Obsidian Prism、停止后台守护并立即恢复 Antigravity 原生界面？",
                "卸载并恢复原版",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );
            if (dr != DialogResult.Yes) return;
            await ExecuteUninstallAsync();
        }

        private async Task ExecuteUninstallAsync()
        {
            if (_busy) return;
            _busy = true;
            _statusHeadline.Text = "正在卸载 Obsidian Prism 并恢复原版界面...";
            _statusHeadline.ForeColor = Color.FromArgb(28, 25, 23);
            _statusDetail.Text = "正在停止后台守护、还原快捷方式并清理插件文件，请稍候...";
            _progressBar.Value = 5;
            SetButtonsEnabled(false);
            try
            {
                OperationResult res = await Task.Run(() => InstallerCore.RunUninstall(_opts, UpdateProgress));
                _selfDeleteOnClose = res.SelfDeleteScheduled;
                _statusHeadline.Text = res.Headline;
                _statusHeadline.ForeColor = Color.FromArgb(3, 105, 161);
                _statusDetail.Text = res.Detail;
                _metaLabel.Text = "已清理目录: " + res.InstallDir;
                _openDirBtn.Enabled = false;
                _uninstallBtn.Enabled = false;
                _launchAgBtn.Visible = false;
                if (!_selfDeleteOnClose)
                {
                    _installBtn.Visible = true;
                    _installBtn.Text = "重新安装";
                    _installBtn.Enabled = true;
                }
                else
                {
                    _installBtn.Visible = false;
                    _installBtn.Enabled = false;
                }
                _closeBtn.Text = "完成并关闭";
                AcceptButton = _closeBtn;
            }
            catch (Exception ex)
            {
                _statusHeadline.Text = "卸载失败";
                _statusHeadline.ForeColor = Color.FromArgb(185, 28, 28);
                _statusDetail.Text = ex.Message;
                AppendLog("[✗] 错误: " + ex);
                _closeBtn.Text = "关闭";
            }
            finally
            {
                _busy = false;
                _closeBtn.Enabled = true;
                UpdateInstallButtonStyle();
            }
        }

        private void SetButtonsEnabled(bool enabled)
        {
            _uninstallBtn.Enabled = enabled;
            _openDirBtn.Enabled = enabled;
            _installBtn.Enabled = enabled;
            _launchAgBtn.Enabled = enabled;
            _closeBtn.Enabled = enabled;
            UpdateInstallButtonStyle();
        }
    }

    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [STAThread]
        private static int Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }

            InstallerOptions opts = ParseArgs(args);

            if (opts.StatusOnly)
            {
                string dir = InstallerCore.NormalizeDirPath(string.IsNullOrEmpty(opts.InstallDir) ? InstallerCore.GetDefaultInstallDir() : opts.InstallDir);
                string pluginDir = InstallerCore.ResolveNativePluginDir(opts, dir);
                AntigravityDetectResult ag = InstallerCore.DetectAntigravityDesktop();
                int? port = CdpHelper.ReadPort(opts.CdpPort);
                Dictionary<string, object> st = new Dictionary<string, object>(StringComparer.Ordinal);
                st["installed"] = Directory.Exists(dir) && File.Exists(Path.Combine(dir, "obsidian-prism-watcher.exe"));
                st["installDir"] = dir;
                st["pluginDir"] = pluginDir;
                st["nativePluginInstalled"] = !string.IsNullOrEmpty(pluginDir) && File.Exists(Path.Combine(pluginDir, "plugin.json"));
                st["nativeDaemonAlive"] = !string.IsNullOrEmpty(pluginDir) && CdpHelper.IsNativeDaemonAlive(pluginDir);
                st["startupShortcut"] = File.Exists(InstallerCore.GetStartupShortcutPath());
                st["antigravityExe"] = ag.ExePath;
                st["antigravityVersion"] = ag.Version;
                st["antigravityRunning"] = ag.IsRunning;
                st["cdpPort"] = port.HasValue ? (object)port.Value : null;
                string json = MiniJson.Stringify(st, true);
                if (!string.IsNullOrEmpty(opts.OutFile)) File.WriteAllText(opts.OutFile, json, new UTF8Encoding(false));
                else Console.WriteLine(json);
                return 0;
            }

            if (opts.Silent)
            {
                try
                {
                    OperationResult res = opts.Uninstall
                        ? InstallerCore.RunUninstall(opts, null)
                        : InstallerCore.RunInstall(opts, null);
                    WriteOutFile(opts.OutFile, res);
                    if (opts.Popup)
                    {
                        MessageBox.Show(res.Detail, res.Headline, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    if (res.SelfDeleteScheduled)
                    {
                        InstallerCore.ScheduleSelfDeleteIfNeeded(res.InstallDir);
                    }
                    return res.Ok ? 0 : 1;
                }
                catch (Exception ex)
                {
                    if (!string.IsNullOrEmpty(opts.OutFile))
                    {
                        Dictionary<string, object> err = new Dictionary<string, object>(StringComparer.Ordinal);
                        err["ok"] = false;
                        err["error"] = ex.Message;
                        File.WriteAllText(opts.OutFile, MiniJson.Stringify(err, true), new UTF8Encoding(false));
                    }
                    if (opts.Popup)
                    {
                        MessageBox.Show(ex.Message, "Obsidian Prism 操作失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                    return 1;
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm(opts));
            return 0;
        }

        private static InstallerOptions ParseArgs(string[] args)
        {
            InstallerOptions opts = new InstallerOptions();
            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i];
                if (a == "--uninstall") opts.Uninstall = true;
                else if (a == "--silent" || a == "/S" || a == "-s") opts.Silent = true;
                else if (a == "--popup") opts.Popup = true;
                else if (a == "--status") opts.StatusOnly = true;
                else if (a == "--no-autostart") opts.NoAutostart = true;
                else if (a == "--no-kill-legacy") opts.NoKillLegacy = true;
                else if (a == "--no-native-daemon") opts.NoNativeDaemon = true;
                else if (a == "--no-relaunch-prompt") opts.NoRelaunchPrompt = true;
                else if (a == "--purge-data") opts.PurgeData = true;
                else if (a == "--install-dir" && i + 1 < args.Length) opts.InstallDir = args[++i];
                else if (a == "--plugin-dir" && i + 1 < args.Length) opts.PluginDir = args[++i];
                else if (a == "--cdp-port" && i + 1 < args.Length)
                {
                    int p;
                    if (int.TryParse(args[++i], out p) && p > 0) opts.CdpPort = p;
                }
                else if (a == "--out" && i + 1 < args.Length) opts.OutFile = args[++i];
            }
            return opts;
        }

        private static void WriteOutFile(string outFile, OperationResult res)
        {
            if (string.IsNullOrEmpty(outFile)) return;
            Dictionary<string, object> d = new Dictionary<string, object>(StringComparer.Ordinal);
            d["ok"] = res.Ok;
            d["mode"] = res.Mode;
            d["headline"] = res.Headline;
            d["detail"] = res.Detail;
            d["installDir"] = res.InstallDir;
            d["pluginDir"] = res.PluginDir;
            d["nativePluginDeployed"] = res.NativePluginDeployed;
            d["nativeDaemonStarted"] = res.NativeDaemonStarted;
            d["antigravityExe"] = res.AntigravityExe;
            d["antigravityVersion"] = res.AntigravityVersion;
            d["cdpPort"] = res.CdpPort.HasValue ? (object)res.CdpPort.Value : null;
            d["injectedPages"] = res.InjectedPages;
            d["preservedExistingConfig"] = res.PreservedExistingConfig;
            d["selfDeleteScheduled"] = res.SelfDeleteScheduled;
            d["patchedShortcuts"] = res.PatchedShortcuts;
            d["restoredShortcuts"] = res.RestoredShortcuts;
            d["bareHostDetected"] = res.BareHostDetected;
            File.WriteAllText(outFile, MiniJson.Stringify(d, true), new UTF8Encoding(false));
        }
    }
}
