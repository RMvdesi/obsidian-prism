import Foundation

/// Precompiled static Ch13-Ch16 runtime channel fallback loader for native macOS Watcher.
/// Reads precompiled expressions from runtime-channels/<id>.js gated by config.json without concatenating JS.
enum RuntimeChannelFallback {
    static let channelIds: [String] = [
        "telemetry",
        "effortSlider",
        "workbenchEnhancer",
        "contextMenu",
    ]

    static let watchedRelPaths: [String] = channelIds.map { "runtime-channels/\($0).js" }

    private static func isOffValue(_ val: JsonValue?) -> Bool {
        guard let v = val else { return false }
        if let b = v.boolValue { return !b }
        if let s = v.stringValue {
            let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return trimmed == "off" || trimmed == "false"
        }
        return false
    }

    private static func lowerString(_ cfg: [String: JsonValue], _ key: String) -> String {
        return cfg[key]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    }

    static func shouldEnable(_ channelId: String, cfg: [String: JsonValue]?) -> Bool {
        guard !channelId.isEmpty else { return false }
        let reconciled = CdpHelper.reconcileConfigAliases(cfg ?? [:])
        switch channelId {
        case "telemetry":
            if let v = reconciled["telemetryModule"] { return !isOffValue(v) }
            return true
        case "effortSlider":
            if let v = reconciled["effortSliderModule"] { return !isOffValue(v) }
            if let v = reconciled["effortSlider"] { return !isOffValue(v) }
            return true
        case "workbenchEnhancer":
            if isOffValue(reconciled["workbenchEnhancer"]) { return false }
            let restyleOff = isOffValue(reconciled["sidebarRestyle"])
            let navFoldOff = isOffValue(reconciled["sidebarNavFold"])
            let scrollMode = lowerString(reconciled, "scrollBottomMotion")
            let motionMode = lowerString(reconciled, "motionLevel")
            let scrollOff = (scrollMode == "instant" || scrollMode == "off")
            let motionOff = (motionMode == "off" || motionMode == "minimal")
            if restyleOff && navFoldOff && scrollOff && motionOff { return false }
            return true
        case "contextMenu":
            if let v = reconciled["contextMenu"] { return !isOffValue(v) }
            return true
        default:
            return false
        }
    }

    static func readPrecompiledExpression(baseDir: String, channelId: String) -> String {
        guard !baseDir.isEmpty, !channelId.isEmpty else { return "" }
        let rel = "runtime-channels/\(channelId).js"
        guard let safePath = CdpHelper.resolveSafePluginFile(baseDir: baseDir, relPath: rel),
              let content = try? String(contentsOfFile: safePath, encoding: .utf8),
              !content.isEmpty else {
            return ""
        }
        return content
    }

    static func loadEnabledExpressions(baseDir: String, cfg: [String: JsonValue]?) -> [String: String] {
        var result: [String: String] = [:]
        for id in channelIds {
            if !shouldEnable(id, cfg: cfg) { continue }
            let expr = readPrecompiledExpression(baseDir: baseDir, channelId: id)
            if !expr.isEmpty {
                result[id] = expr
            }
        }
        return result
    }

    static func removeNewDocScript(_ session: CdpSession, scriptId: String?) {
        guard let id = scriptId, !id.isEmpty else { return }
        _ = try? session.send(
            "Page.removeScriptToEvaluateOnNewDocument",
            params: ["identifier": .string(id)],
            timeoutMs: 5000
        )
    }

    static func addNewDocScript(_ session: CdpSession, source: String) -> String? {
        guard !source.isEmpty else { return nil }
        if let res = try? session.send(
            "Page.addScriptToEvaluateOnNewDocument",
            params: ["source": .string(source)],
            timeoutMs: 15000
        ) {
            return res["identifier"]?.stringValue
        }
        return nil
    }

    static func evaluateOnce(_ session: CdpSession, enabledExprs: [String: String]) {
        for id in channelIds {
            if let expr = enabledExprs[id], !expr.isEmpty {
                _ = try? session.evaluate(expr, awaitPromise: false)
            }
        }
    }

    static func removeAllScripts(_ session: CdpSession, scriptIds: inout [String: String]) {
        for id in channelIds {
            if let oldId = scriptIds[id], !oldId.isEmpty {
                removeNewDocScript(session, scriptId: oldId)
                scriptIds.removeValue(forKey: id)
            }
        }
    }

    static func syncNewDocScripts(
        _ session: CdpSession,
        scriptIds: inout [String: String],
        enabledExprs: [String: String]
    ) -> Set<String> {
        var previouslyMounted: Set<String> = []
        for id in channelIds {
            if let oldId = scriptIds[id], !oldId.isEmpty {
                previouslyMounted.insert(id)
                removeNewDocScript(session, scriptId: oldId)
                scriptIds.removeValue(forKey: id)
            }
            if let nextExpr = enabledExprs[id], !nextExpr.isEmpty,
               let newId = addNewDocScript(session, source: nextExpr), !newId.isEmpty {
                scriptIds[id] = newId
            }
        }
        return previouslyMounted
    }

    static func evaluateSynced(
        _ session: CdpSession,
        baseDir: String,
        enabledExprs: [String: String],
        previouslyMounted: Set<String>
    ) {
        for id in channelIds {
            if let expr = enabledExprs[id], !expr.isEmpty {
                _ = try? session.evaluate(expr, awaitPromise: false)
            } else if previouslyMounted.contains(id) {
                let disableExpr = readPrecompiledExpression(baseDir: baseDir, channelId: id)
                if !disableExpr.isEmpty {
                    _ = try? session.evaluate(disableExpr, awaitPromise: false)
                }
            }
        }
    }
}
