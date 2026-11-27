using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace AgyClaudeStyle
{
    /// <summary>
    /// Precompiled static Ch13-Ch16 runtime channel fallback loader for native Windows Watcher.
    /// Reads precompiled expressions from runtime-channels/&lt;id&gt;.js gated by config.json without concatenating JS.
    /// </summary>
    public static class RuntimeChannelFallback
    {
        public static readonly string[] ChannelIds = new string[]
        {
            "telemetry",
            "effortSlider",
            "workbenchEnhancer",
            "contextMenu"
        };

        private static bool IsOffValue(object val)
        {
            if (val is bool) return !((bool)val);
            string s = val as string;
            if (s != null)
            {
                string trimmed = s.Trim();
                return string.Equals(trimmed, "off", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(trimmed, "false", StringComparison.OrdinalIgnoreCase);
            }
            return false;
        }

        private static string GetLowerString(Dictionary<string, object> cfg, string key)
        {
            object val;
            if (cfg != null && cfg.TryGetValue(key, out val) && val is string)
            {
                return ((string)val).Trim().ToLowerInvariant();
            }
            return "";
        }

        public static bool ShouldEnable(string channelId, Dictionary<string, object> cfg)
        {
            if (string.IsNullOrEmpty(channelId)) return false;
            Dictionary<string, object> reconciled = CdpHelper.ReconcileConfigAliases(cfg);
            object val;
            if (string.Equals(channelId, "telemetry", StringComparison.Ordinal))
            {
                if (reconciled.TryGetValue("telemetryModule", out val)) return !IsOffValue(val);
                return true;
            }
            if (string.Equals(channelId, "effortSlider", StringComparison.Ordinal))
            {
                if (reconciled.TryGetValue("effortSliderModule", out val)) return !IsOffValue(val);
                if (reconciled.TryGetValue("effortSlider", out val)) return !IsOffValue(val);
                return true;
            }
            if (string.Equals(channelId, "workbenchEnhancer", StringComparison.Ordinal))
            {
                if (reconciled.TryGetValue("workbenchEnhancer", out val) && IsOffValue(val)) return false;
                bool restyleOff = reconciled.TryGetValue("sidebarRestyle", out val) && IsOffValue(val);
                bool navFoldOff = reconciled.TryGetValue("sidebarNavFold", out val) && IsOffValue(val);
                string scrollMode = GetLowerString(reconciled, "scrollBottomMotion");
                string motionMode = GetLowerString(reconciled, "motionLevel");
                bool scrollOff = scrollMode == "instant" || scrollMode == "off";
                bool motionOff = motionMode == "off" || motionMode == "minimal";
                if (restyleOff && navFoldOff && scrollOff && motionOff) return false;
                return true;
            }
            if (string.Equals(channelId, "contextMenu", StringComparison.Ordinal))
            {
                if (reconciled.TryGetValue("contextMenu", out val)) return !IsOffValue(val);
                return true;
            }
            return false;
        }

        public static string ReadPrecompiledExpression(string baseDir, string channelId)
        {
            if (string.IsNullOrEmpty(baseDir) || string.IsNullOrEmpty(channelId)) return "";
            string relPath = "runtime-channels/" + channelId + ".js";
            string safePath = CdpHelper.ResolveSafePluginFile(baseDir, relPath);
            if (string.IsNullOrEmpty(safePath)) return "";
            try
            {
                return File.ReadAllText(safePath, Encoding.UTF8) ?? "";
            }
            catch
            {
                return "";
            }
        }

        public static Dictionary<string, string> LoadEnabledExpressions(string baseDir, Dictionary<string, object> cfg)
        {
            Dictionary<string, string> result = new Dictionary<string, string>(StringComparer.Ordinal);
            for (int i = 0; i < ChannelIds.Length; i++)
            {
                string id = ChannelIds[i];
                if (!ShouldEnable(id, cfg)) continue;
                string expr = ReadPrecompiledExpression(baseDir, id);
                if (!string.IsNullOrEmpty(expr))
                {
                    result[id] = expr;
                }
            }
            return result;
        }

        public static bool IsRuntimeChannelFile(string normRelPath)
        {
            if (string.IsNullOrEmpty(normRelPath)) return false;
            return normRelPath.StartsWith("runtime-channels/", StringComparison.OrdinalIgnoreCase) &&
                   normRelPath.EndsWith(".js", StringComparison.OrdinalIgnoreCase);
        }

        public static async Task RemoveNewDocScriptAsync(CdpSession session, string scriptId)
        {
            if (session == null || string.IsNullOrEmpty(scriptId)) return;
            try
            {
                Dictionary<string, object> rm = new Dictionary<string, object>(StringComparer.Ordinal);
                rm["identifier"] = scriptId;
                await session.SendAsync("Page.removeScriptToEvaluateOnNewDocument", rm, 5000).ConfigureAwait(false);
            }
            catch { }
        }

        public static async Task<string> AddNewDocScriptAsync(CdpSession session, string source)
        {
            if (session == null || string.IsNullOrEmpty(source)) return null;
            Dictionary<string, object> add = new Dictionary<string, object>(StringComparer.Ordinal);
            add["source"] = source;
            Dictionary<string, object> res = await session.SendAsync("Page.addScriptToEvaluateOnNewDocument", add, 15000).ConfigureAwait(false);
            object idVal;
            if (res != null && res.TryGetValue("identifier", out idVal)) return idVal as string;
            return null;
        }

        public static async Task EvaluateOnceAsync(CdpSession session, Dictionary<string, string> enabledExprs)
        {
            if (session == null || enabledExprs == null) return;
            for (int i = 0; i < ChannelIds.Length; i++)
            {
                string expr;
                if (enabledExprs.TryGetValue(ChannelIds[i], out expr) && !string.IsNullOrEmpty(expr))
                {
                    try { await session.EvaluateAsync(expr, false).ConfigureAwait(false); } catch { }
                }
            }
        }

        public static async Task RemoveAllScriptsAsync(CdpSession session, Dictionary<string, string> scriptIds)
        {
            if (session == null || scriptIds == null) return;
            for (int i = 0; i < ChannelIds.Length; i++)
            {
                string id = ChannelIds[i];
                string existingId;
                if (scriptIds.TryGetValue(id, out existingId) && !string.IsNullOrEmpty(existingId))
                {
                    await RemoveNewDocScriptAsync(session, existingId).ConfigureAwait(false);
                    scriptIds.Remove(id);
                }
            }
        }

        public static async Task SyncNewDocScriptsAsync(
            CdpSession session,
            Dictionary<string, string> scriptIds,
            Dictionary<string, string> enabledExprs,
            HashSet<string> previouslyMountedOut)
        {
            if (session == null || scriptIds == null) return;
            for (int i = 0; i < ChannelIds.Length; i++)
            {
                string id = ChannelIds[i];
                string oldId;
                bool hadScript = scriptIds.TryGetValue(id, out oldId) && !string.IsNullOrEmpty(oldId);
                if (hadScript)
                {
                    if (previouslyMountedOut != null) previouslyMountedOut.Add(id);
                    await RemoveNewDocScriptAsync(session, oldId).ConfigureAwait(false);
                    scriptIds.Remove(id);
                }
                string nextExpr;
                if (enabledExprs != null && enabledExprs.TryGetValue(id, out nextExpr) && !string.IsNullOrEmpty(nextExpr))
                {
                    try
                    {
                        string newId = await AddNewDocScriptAsync(session, nextExpr).ConfigureAwait(false);
                        if (!string.IsNullOrEmpty(newId)) scriptIds[id] = newId;
                    }
                    catch { }
                }
            }
        }

        public static async Task EvaluateSyncedAsync(
            CdpSession session,
            string baseDir,
            Dictionary<string, string> enabledExprs,
            HashSet<string> previouslyMounted)
        {
            if (session == null) return;
            for (int i = 0; i < ChannelIds.Length; i++)
            {
                string id = ChannelIds[i];
                string expr;
                if (enabledExprs != null && enabledExprs.TryGetValue(id, out expr) && !string.IsNullOrEmpty(expr))
                {
                    try { await session.EvaluateAsync(expr, false).ConfigureAwait(false); } catch { }
                }
                else if (previouslyMounted != null && previouslyMounted.Contains(id))
                {
                    // Precompiled channel script inspects liveCfg and invokes its built-in cleanup when disabled
                    string disableExpr = ReadPrecompiledExpression(baseDir, id);
                    if (!string.IsNullOrEmpty(disableExpr))
                    {
                        try { await session.EvaluateAsync(disableExpr, false).ConfigureAwait(false); } catch { }
                    }
                }
            }
        }
    }
}
