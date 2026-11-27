import Foundation
#if canImport(Darwin)
import Darwin
#endif
#if canImport(AppKit)
import AppKit
#endif

/// Double-layer loop circuit breaker for macOS cold-start bare-launch recovery:
/// - Layer 1: 20s cooldown after an unconfirmed relaunch (cleared immediately upon confirmed CDP launch).
/// - Layer 2: 60s sliding window capped at 5 relaunches to stop external restart storms.
struct BareLaunchRelaunchPolicy {
    enum Decision: Equatable {
        case allow
        case skipUnconfirmedCooldown(elapsed: TimeInterval)
        case skipBurstLimit(count: Int, windowSeconds: TimeInterval)
    }

    static let defaultUnconfirmedCooldownSeconds: TimeInterval = 20.0
    static let defaultBurstWindowSeconds: TimeInterval = 60.0
    static let defaultMaxRelaunchesPerWindow = 5
    static let defaultMaxColdStartUptimeMs: Int64 = 5000

    let unconfirmedCooldownSeconds: TimeInterval
    let burstWindowSeconds: TimeInterval
    let maxRelaunchesPerWindow: Int

    private var unconfirmedRelaunchAt: Date?
    private var recentRelaunches: [Date] = []

    init(
        unconfirmedCooldownSeconds: TimeInterval = BareLaunchRelaunchPolicy.defaultUnconfirmedCooldownSeconds,
        burstWindowSeconds: TimeInterval = BareLaunchRelaunchPolicy.defaultBurstWindowSeconds,
        maxRelaunchesPerWindow: Int = BareLaunchRelaunchPolicy.defaultMaxRelaunchesPerWindow
    ) {
        self.unconfirmedCooldownSeconds = unconfirmedCooldownSeconds
        self.burstWindowSeconds = burstWindowSeconds
        self.maxRelaunchesPerWindow = maxRelaunchesPerWindow
    }

    mutating func recordCdpConfirmed() -> Bool {
        guard unconfirmedRelaunchAt != nil else { return false }
        unconfirmedRelaunchAt = nil
        return true
    }

    mutating func evaluateBareLaunch(at now: Date) -> Decision {
        recentRelaunches = recentRelaunches.filter { now.timeIntervalSince($0) < burstWindowSeconds }
        if let lastUnconfirmed = unconfirmedRelaunchAt {
            let elapsed = now.timeIntervalSince(lastUnconfirmed)
            if elapsed < unconfirmedCooldownSeconds {
                return .skipUnconfirmedCooldown(elapsed: elapsed)
            }
            unconfirmedRelaunchAt = nil
        }
        if recentRelaunches.count >= maxRelaunchesPerWindow {
            return .skipBurstLimit(count: recentRelaunches.count, windowSeconds: burstWindowSeconds)
        }
        return .allow
    }

    mutating func recordRelaunchAttempt(at now: Date) {
        recentRelaunches = recentRelaunches.filter { now.timeIntervalSince($0) < burstWindowSeconds }
        recentRelaunches.append(now)
        unconfirmedRelaunchAt = now
    }
}

extension CdpHelper {
    static let antigravityBundleId = "com.google.antigravity"

    static func hasRemoteDebuggingPortFlag(_ cmdline: String) -> Bool {
        let lower = cmdline.lowercased()
        return lower.range(of: #"(?:^|\s)--remote-debugging-port(?:=|\s|$)"#, options: .regularExpression) != nil
    }

    static func commandLineForPid(_ pid: Int32) -> String? {
        guard pid > 0 else { return nil }
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/ps")
        proc.arguments = ["-p", String(pid), "-o", "args="]
        do {
            let data = try CdpHelper.readProcessOutput(proc)
            guard proc.terminationStatus == 0 else { return nil }
            let trimmed = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            return nil
        }
    }

    static func processElapsedMsForPid(_ pid: Int32) -> Int64? {
        guard pid > 0 else { return nil }
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/ps")
        proc.arguments = ["-p", String(pid), "-o", "etime="]
        do {
            let data = try CdpHelper.readProcessOutput(proc)
            guard proc.terminationStatus == 0,
                  let out = String(data: data, encoding: .utf8) else { return nil }
            let trimmed = out.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return max(0, parseBsdElapsedSeconds(trimmed) * 1000)
        } catch {
            return nil
        }
    }

    static func isHostPluginExplicitlyDisabled(pluginDir: String) -> Bool {
        guard let cfgDir = resolveHostGeminiConfigDir(pluginDir: pluginDir), !cfgDir.isEmpty else {
            return false
        }
        let cfgPath = (cfgDir as NSString).appendingPathComponent("config.json")
        guard FileManager.default.fileExists(atPath: cfgPath),
              !isSymbolicLinkOrUnsafePath(cfgPath),
              let raw = try? String(contentsOfFile: cfgPath, encoding: .utf8) else {
            return false
        }
        let trimmed = raw.replacingOccurrences(of: "\u{FEFF}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let rootObj = try? MiniJson.parseObject(trimmed),
              let pluginsObj = rootObj["plugins"]?.objectValue,
              let entryObj = pluginsObj["obsidian-prism"]?.objectValue,
              let enabledVal = entryObj["enabled"] else {
            return false
        }
        if let b = enabledVal.boolValue {
            return !b
        }
        if let s = enabledVal.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            return s == "false" || s == "off"
        }
        return false
    }

    static func requestNativeGracefulQuit(pid: Int32) -> Bool {
        guard pid > 0 else { return false }
        #if canImport(AppKit)
        if let runningApp = NSRunningApplication(processIdentifier: pid) {
            return runningApp.terminate()
        }
        #endif
        return false
    }

    static func stateFileMatchesHost(filePath: String, hostPid: Int32, startTimeMs: Int64) -> Bool {
        guard !filePath.isEmpty, hostPid > 0,
              let raw = try? String(contentsOfFile: filePath, encoding: .utf8) else { return false }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return false }
        guard let obj = try? MiniJson.parseObject(trimmed) else { return false }
        let expectedKey = "\(hostPid):\(startTimeMs)"
        let pidPrefix = "\(hostPid):"
        if let hk = obj["hostKey"]?.stringValue {
            if hk == expectedKey { return true }
            if startTimeMs <= 0 && hk.hasPrefix(pidPrefix) { return true }
        }
        if let k = obj["key"]?.stringValue {
            if k == expectedKey { return true }
            if startTimeMs <= 0 && k.hasPrefix(pidPrefix) { return true }
        }
        if let savedPid = obj["hostPid"]?.intValue, Int32(savedPid) == hostPid {
            let savedStart: Int64
            if case .int(let s1)? = obj["hostStartMs"] { savedStart = s1 }
            else if case .int(let s2)? = obj["startTimeMs"] { savedStart = s2 }
            else { savedStart = 0 }
            if savedStart <= 0 || startTimeMs <= 0 || abs(savedStart - startTimeMs) <= 15000 {
                return true
            }
        }
        return false
    }

    static func buildWatcherWatchArgs(
        installDir: String,
        pluginDir: String,
        cdpPort: Int?,
        noNativeDaemon: Bool = false,
        noRelaunchPrompt: Bool = false,
        noAutoRelaunch: Bool = false,
        lang: String? = nil
    ) -> [String] {
        var args = ["--watch", "--dir", installDir]
        if !pluginDir.isEmpty {
            args.append("--plugin-dir")
            args.append(pluginDir)
        }
        if let port = cdpPort, port > 0 {
            args.append("--cdp-port")
            args.append(String(port))
        }
        if noNativeDaemon {
            args.append("--no-native-daemon")
        }
        if noRelaunchPrompt {
            args.append("--no-relaunch-prompt")
        }
        if noAutoRelaunch {
            args.append("--no-auto-relaunch")
        }
        if let explicitLang = InstallerI18n.normalizeLangCode(lang) {
            args.append("--lang")
            args.append(explicitLang)
        }
        return args
    }
}

enum LaunchGuard {
    static func isTempSandboxDir(_ dir: String) -> Bool {
        let std = URL(fileURLWithPath: dir).standardizedFileURL.path
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory()).standardizedFileURL.path
        if std == "/tmp" || std.hasPrefix("/tmp/") || std == "/private/tmp" || std.hasPrefix("/private/tmp/") {
            return true
        }
        if !tmp.isEmpty {
            let cleanTmp = tmp.hasSuffix("/") ? String(tmp.dropLast()) : tmp
            if std == cleanTmp || std.hasPrefix(cleanTmp + "/") {
                return true
            }
        }
        return false
    }

    static func shouldAttachWorkspaceObserver(
        overridePort: Int?,
        noRelaunchPrompt: Bool,
        noAutoRelaunch: Bool,
        baseDir: String,
        isDefaultDir: Bool,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        let isTestEnv = (environment["NODE_ENV"] ?? "").caseInsensitiveCompare("test") == .orderedSame ||
            !(environment["NODE_TEST_CONTEXT"] ?? "").isEmpty
        return overridePort == nil &&
            !noRelaunchPrompt &&
            !noAutoRelaunch &&
            environment["PRISM_NO_RELAUNCH_PROMPT"] != "1" &&
            environment["AG_PRISM_NO_RELAUNCH_PROMPT"] != "1" &&
            environment["AG_PRISM_NO_AUTO_RELAUNCH"] != "1" &&
            environment["AG_PRISM_NO_WORKSPACE_OBSERVER"] != "1" &&
            (environment["SSH_CONNECTION"] ?? "").isEmpty &&
            (environment["SSH_TTY"] ?? "").isEmpty &&
            !isTestEnv &&
            (isDefaultDir || !isTempSandboxDir(baseDir))
    }

    static func isAutoRelaunchOnBareLaunchEnabled(
        baseDir: String,
        pluginDir: String,
        noRelaunchPrompt: Bool,
        noAutoRelaunch: Bool,
        isDefaultDir: Bool,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        if noRelaunchPrompt ||
            noAutoRelaunch ||
            environment["PRISM_NO_RELAUNCH_PROMPT"] == "1" ||
            environment["AG_PRISM_NO_RELAUNCH_PROMPT"] == "1" ||
            environment["AG_PRISM_NO_AUTO_RELAUNCH"] == "1" ||
            (environment["NODE_ENV"] ?? "").caseInsensitiveCompare("test") == .orderedSame ||
            !(environment["NODE_TEST_CONTEXT"] ?? "").isEmpty {
            return false
        }
        if !isDefaultDir && isTempSandboxDir(baseDir) {
            return false
        }
        let fm = FileManager.default
        var dirs: [String] = []
        if !pluginDir.isEmpty { dirs.append(pluginDir) }
        if !baseDir.isEmpty && baseDir != pluginDir { dirs.append(baseDir) }
        var promptExplicitlyDisabled = false
        for dir in dirs {
            let cfgPath = (dir as NSString).appendingPathComponent("config.json")
            guard fm.fileExists(atPath: cfgPath),
                  !CdpHelper.isSymbolicLinkOrUnsafePath(cfgPath),
                  let raw = try? String(contentsOfFile: cfgPath, encoding: .utf8) else {
                continue
            }
            let trimmed = raw.replacingOccurrences(of: "\u{FEFF}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, let obj = try? MiniJson.parseObject(trimmed) else { continue }
            if let val = obj["autoRelaunchOnBareLaunch"] {
                if let b = val.boolValue { return b }
                if let s = val.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
                    return s == "true" || s == "on"
                }
                return false
            }
            if let promptVal = obj["autoPromptCdpRelaunch"] {
                if promptVal.boolValue == false {
                    promptExplicitlyDisabled = true
                } else if let ps = promptVal.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                          (ps == "false" || ps == "off") {
                    promptExplicitlyDisabled = true
                }
            }
        }
        if promptExplicitlyDisabled {
            return false
        }
        // Enabled by default for fresh cold launches (gated by <=5s cold-start window); opt out via config.json or --no-auto-relaunch
        return true
    }

    static func runWatchWithOptionalObserver(
        baseDir: String,
        pluginDir: String,
        overridePort: Int?,
        noRelaunchPrompt: Bool,
        noAutoRelaunch: Bool,
        isDefaultDir: Bool,
        isExiting: @escaping () -> Bool,
        setAutoRelaunchInFlight: @escaping (Bool) -> Void,
        log: @escaping (String) -> Void,
        runMainWatchLoop: @escaping () -> Void
    ) {
        let shouldAttach = shouldAttachWorkspaceObserver(
            overridePort: overridePort,
            noRelaunchPrompt: noRelaunchPrompt,
            noAutoRelaunch: noAutoRelaunch,
            baseDir: baseDir,
            isDefaultDir: isDefaultDir
        )
        #if canImport(AppKit)
        if shouldAttach {
            let launchGuardQueue = DispatchQueue(label: "io.github.rmvdesi.obsidian-prism.launch-guard")
            var launchGuardPolicy = BareLaunchRelaunchPolicy()
            let nsApp = NSApplication.shared
            nsApp.setActivationPolicy(.prohibited)

            let workspaceObserver = NSWorkspace.shared.notificationCenter.addObserver(
                forName: NSWorkspace.didLaunchApplicationNotification,
                object: nil,
                queue: nil
            ) { notification in
                guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                      app.bundleIdentifier == CdpHelper.antigravityBundleId else {
                    return
                }
                let pid = app.processIdentifier
                let bundlePath = app.bundleURL?.path ?? "/Applications/Antigravity.app"

                launchGuardQueue.async {
                    guard !isExiting() else { return }
                    guard let cmd = CdpHelper.commandLineForPid(pid) else { return }

                    if CdpHelper.hasRemoteDebuggingPortFlag(cmd) {
                        if launchGuardPolicy.recordCdpConfirmed() {
                            log(InstallerI18n.tr(
                                "[✓] 检测到带调试端口的 Antigravity (PID \(pid))，已复位自动重开冷却",
                                "[✓] Detected CDP-enabled Antigravity (PID \(pid)); cleared auto-relaunch cooldown"
                            ))
                        }
                        return
                    }

                    guard isAutoRelaunchOnBareLaunchEnabled(
                        baseDir: baseDir,
                        pluginDir: pluginDir,
                        noRelaunchPrompt: noRelaunchPrompt,
                        noAutoRelaunch: noAutoRelaunch,
                        isDefaultDir: isDefaultDir
                    ) else {
                        return
                    }
                    if CdpHelper.isHostPluginExplicitlyDisabled(pluginDir: pluginDir) {
                        log(InstallerI18n.tr(
                            "[~] 宿主配置已禁用 obsidian-prism，跳过裸启自动重开 (PID \(pid))",
                            "[~] obsidian-prism is disabled in host config; skipping bare-launch auto-relaunch (PID \(pid))"
                        ))
                        return
                    }

                    if let existingCdpPid = CdpHelper.findRunningAntigravityWithCdp(appPath: bundlePath),
                       existingCdpPid != pid {
                        log(InstallerI18n.tr(
                            "[~] 检测到已有健康带调试端口的 Antigravity 实例 (PID \(existingCdpPid))，跳过对辅助裸启进程 (PID \(pid)) 的自动重开",
                            "[~] Healthy CDP-enabled Antigravity instance (PID \(existingCdpPid)) is already running; skipping bare-launch auto-relaunch for PID \(pid)"
                        ))
                        return
                    }

                    let uptimeMs = CdpHelper.processElapsedMsForPid(pid) ?? 0
                    if uptimeMs > BareLaunchRelaunchPolicy.defaultMaxColdStartUptimeMs {
                        log(InstallerI18n.tr(
                            "[~] Antigravity (PID \(pid)) 运行时长已超出冷启动窗口，跳过静默重开",
                            "[~] Antigravity (PID \(pid)) exceeded cold-start window; skipping silent auto-relaunch"
                        ))
                        return
                    }

                    let now = Date()
                    switch launchGuardPolicy.evaluateBareLaunch(at: now) {
                    case .allow:
                        break
                    case .skipUnconfirmedCooldown(let elapsed):
                        let elapsedStr = String(format: "%.1f", elapsed)
                        log(InstallerI18n.tr(
                            "[~] 距上次未确认重开仅 \(elapsedStr)s，跳过裸启自动重开以防死循环 (PID \(pid))",
                            "[~] Bare Antigravity (PID \(pid)) detected \(elapsedStr)s after unconfirmed relaunch; skipping to prevent loop"
                        ))
                        return
                    case .skipBurstLimit(let count, let windowSeconds):
                        log(InstallerI18n.tr(
                            "[~] \(Int(windowSeconds))s 内已连续重开 \(count) 次，触发限流保护跳过自动重开 (PID \(pid))",
                            "[~] Hit auto-relaunch burst limit (\(count) within \(Int(windowSeconds))s); skipping (PID \(pid))"
                        ))
                        return
                    }

                    launchGuardPolicy.recordRelaunchAttempt(at: now)
                    setAutoRelaunchInFlight(true)
                    defer { setAutoRelaunchInFlight(false) }

                    log(InstallerI18n.tr(
                        "[↻] 检测到 Antigravity 无参冷启动 (PID \(pid))，正在自动以 --remote-debugging-port=0 温和重开",
                        "[↻] Detected bare Antigravity cold launch (PID \(pid)); gracefully relaunching with --remote-debugging-port=0"
                    ))
                    let nowMs = Int64(Date().timeIntervalSince1970 * 1000.0)
                    let bareHost = BareHostAppInfo(
                        pid: pid,
                        appPath: CdpHelper.normalizeAntigravityAppPath(bundlePath),
                        startTimeMs: nowMs - uptimeMs,
                        uptimeMs: uptimeMs
                    )
                    _ = CdpHelper.relaunchAntigravityWithCdp(host: bareHost, waitExitMs: 8000, abortIfStillAlive: true) { m in
                        log("[+] \(m)")
                    }
                }
            }

            let watchLoopQueue = DispatchQueue(label: "io.github.rmvdesi.obsidian-prism.watchloop", qos: .utility)
            watchLoopQueue.async {
                runMainWatchLoop()
                DispatchQueue.main.async {
                    NSWorkspace.shared.notificationCenter.removeObserver(workspaceObserver)
                    nsApp.stop(nil)
                    if let wakeEvent = NSEvent.otherEvent(
                        with: .applicationDefined,
                        location: .zero,
                        modifierFlags: [],
                        timestamp: 0,
                        windowNumber: 0,
                        context: nil,
                        subtype: 0,
                        data1: 0,
                        data2: 0
                    ) {
                        nsApp.postEvent(wakeEvent, atStart: true)
                    }
                }
            }
            nsApp.run()
            return
        }
        #endif
        runMainWatchLoop()
    }

    static func runSelfTest() -> Int32 {
        func verify(_ condition: Bool, _ label: String) -> Bool {
            if !condition {
                fputs("FAIL: \(label)\n", stderr)
                return false
            }
            return true
        }

        let t0 = Date(timeIntervalSince1970: 1_700_000_000)

        // 1. Confirmed CDP launch clears unconfirmed cooldown (allows quick manual reopen e.g. 17.3s later)
        var p1 = BareLaunchRelaunchPolicy(unconfirmedCooldownSeconds: 20.0, burstWindowSeconds: 60.0, maxRelaunchesPerWindow: 5)
        guard verify(p1.evaluateBareLaunch(at: t0) == .allow, "initial bare launch allowed") else { return 1 }
        p1.recordRelaunchAttempt(at: t0)
        guard verify(p1.recordCdpConfirmed() == true, "CDP confirmation clears pending cooldown") else { return 1 }
        guard verify(p1.recordCdpConfirmed() == false, "duplicate CDP confirmation is a no-op") else { return 1 }
        guard verify(p1.evaluateBareLaunch(at: t0.addingTimeInterval(17.3)) == .allow, "reopen after 17.3s allowed after CDP confirmation") else { return 1 }

        // 2. Unconfirmed relaunch keeps 20s loop-prevention cooldown armed
        var p2 = BareLaunchRelaunchPolicy(unconfirmedCooldownSeconds: 20.0, burstWindowSeconds: 60.0, maxRelaunchesPerWindow: 5)
        guard verify(p2.evaluateBareLaunch(at: t0) == .allow, "unconfirmed case initial launch allowed") else { return 1 }
        p2.recordRelaunchAttempt(at: t0)
        if case .skipUnconfirmedCooldown(let elapsed) = p2.evaluateBareLaunch(at: t0.addingTimeInterval(2.5)) {
            guard verify(abs(elapsed - 2.5) < 0.001, "cooldown elapsed matches 2.5s") else { return 1 }
        } else {
            fputs("FAIL: rapid bare launch after unconfirmed relaunch must be blocked\n", stderr)
            return 1
        }
        guard verify(p2.evaluateBareLaunch(at: t0.addingTimeInterval(20.1)) == .allow, "unconfirmed cooldown expires after 20s") else { return 1 }

        // 3. Secondary burst limit trips after 5 relaunches in 60s and recovers once window slides
        var p3 = BareLaunchRelaunchPolicy(unconfirmedCooldownSeconds: 20.0, burstWindowSeconds: 60.0, maxRelaunchesPerWindow: 5)
        for idx in 0..<5 {
            let ts = t0.addingTimeInterval(Double(idx * 5))
            guard verify(p3.evaluateBareLaunch(at: ts) == .allow, "burst attempt \(idx + 1) allowed") else { return 1 }
            p3.recordRelaunchAttempt(at: ts)
            _ = p3.recordCdpConfirmed()
        }
        if case .skipBurstLimit(let count, _) = p3.evaluateBareLaunch(at: t0.addingTimeInterval(30.0)) {
            guard verify(count == 5, "burst limit reports count 5") else { return 1 }
        } else {
            fputs("FAIL: 6th relaunch within 60s must trip burst circuit breaker\n", stderr)
            return 1
        }
        guard verify(p3.evaluateBareLaunch(at: t0.addingTimeInterval(61.0)) == .allow, "burst limit recovers once oldest attempt ages out") else { return 1 }

        // 4. CDP command-line flag matching boundary checks
        guard verify(CdpHelper.hasRemoteDebuggingPortFlag("/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port=0"), "detects =0") else { return 1 }
        guard verify(CdpHelper.hasRemoteDebuggingPortFlag("/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port 9222"), "detects space arg") else { return 1 }
        guard verify(!CdpHelper.hasRemoteDebuggingPortFlag("/Applications/Antigravity.app/Contents/MacOS/Antigravity"), "rejects bare command") else { return 1 }
        guard verify(!CdpHelper.hasRemoteDebuggingPortFlag("/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port-fake=1"), "rejects partial-prefix flag") else { return 1 }

        print("LAUNCH_GUARD_SELF_TEST_OK")
        return 0
    }
}
