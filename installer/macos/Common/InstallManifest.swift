import Foundation

struct InstallManifestInfo {
    var protectedUserPaths: [String]
    var obsoletePaths: [String]
    var purgeDataFiles: [String]
}

enum InstallManifestHelper {
    static let defaultProtectedUserPaths: [String] = [
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
    ]

    static let userOwnedAssetPaths: [String] = [
        "custom.css",
        "wallpapers/",
        "backups/",
    ]

    private static let skippedNativeNames: Set<String> = [
        ".git", ".DS_Store", "__pycache__", ".daemon.pid", ".watch.pid", ".watch.lock",
        "node_modules", "installer", "scripts", "test", "tools",
        "Obsidian Prism.app", "Obsidian-Prism-macOS-universal.dmg", "installer.exe",
    ]

    static func shouldSkipNativeAsset(_ name: String, relPath: String) -> Bool {
        if skippedNativeNames.contains(name) || name.hasSuffix(".log") || name.hasSuffix(".tmp") {
            return true
        }
        let lower = relPath.replacingOccurrences(of: "\\", with: "/").lowercased()
        return lower == "assets/screenshots" || lower.hasPrefix("assets/screenshots/")
    }

    static func isSafeManagedRelPath(_ relPath: String, allowTrailingSlash: Bool = false) -> Bool {
        if relPath.isEmpty { return false }
        if relPath.trimmingCharacters(in: .whitespacesAndNewlines) != relPath { return false }
        if relPath.contains("\0") || relPath.contains("\r") || relPath.contains("\n") { return false }

        let unified = relPath.replacingOccurrences(of: "\\", with: "/")
        if unified.hasPrefix("/") || unified.contains(":") { return false }

        let hasTrailing = unified.hasSuffix("/")
        if hasTrailing && !allowTrailingSlash { return false }

        let core = hasTrailing ? String(unified.dropLast()) : unified
        if core.isEmpty || core.hasSuffix("/") { return false }

        let segments = core.split(separator: "/", omittingEmptySubsequences: false)
        for seg in segments {
            if seg.isEmpty || seg == "." || seg == ".." { return false }
        }
        return true
    }

    private static func matchesAnyRule(_ lowerRel: String, rules: [String]) -> Bool {
        for raw in rules {
            var norm = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "\\", with: "/")
            while norm.hasPrefix("./") {
                norm = String(norm.dropFirst(2))
            }
            while norm.hasSuffix("/") {
                norm = String(norm.dropLast())
            }
            guard isSafeManagedRelPath(norm, allowTrailingSlash: false) else { continue }
            let lowerRule = norm.lowercased()
            if lowerRel == lowerRule || lowerRel.hasPrefix(lowerRule + "/") {
                return true
            }
        }
        return false
    }

    static func isProtectedUserPath(_ relPath: String, manifestProtectedPaths: [String]) -> Bool {
        var unified = relPath.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\", with: "/")
        while unified.hasPrefix("./") {
            unified = String(unified.dropFirst(2))
        }
        while unified.hasSuffix("/") {
            unified = String(unified.dropLast())
        }
        guard !unified.isEmpty else { return false }
        let lowerRel = unified.lowercased()
        if matchesAnyRule(lowerRel, rules: defaultProtectedUserPaths) { return true }
        if !manifestProtectedPaths.isEmpty && matchesAnyRule(lowerRel, rules: manifestProtectedPaths) {
            return true
        }
        return false
    }

    static func loadFromDir(_ dirPath: String) -> InstallManifestInfo {
        var info = InstallManifestInfo(
            protectedUserPaths: defaultProtectedUserPaths,
            obsoletePaths: [],
            purgeDataFiles: []
        )
        guard !dirPath.isEmpty else { return info }
        let manifestPath = (dirPath as NSString).appendingPathComponent("install-manifest.json")
        guard let raw = try? String(contentsOfFile: manifestPath, encoding: .utf8) else {
            return info
        }
        let clean = raw.replacingOccurrences(of: "\u{FEFF}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard let obj = try? MiniJson.parseObject(clean) else {
            return info
        }
        if let arr = obj["protectedUserPaths"]?.arrayValue {
            for val in arr {
                if let s = val.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                   isSafeManagedRelPath(s, allowTrailingSlash: true),
                   !info.protectedUserPaths.contains(where: { $0.caseInsensitiveCompare(s) == .orderedSame }) {
                    info.protectedUserPaths.append(s)
                }
            }
        }
        if let arr = obj["obsoletePaths"]?.arrayValue {
            for val in arr {
                if let s = val.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                   isSafeManagedRelPath(s, allowTrailingSlash: false),
                   !isProtectedUserPath(s, manifestProtectedPaths: info.protectedUserPaths),
                   !info.obsoletePaths.contains(where: { $0.caseInsensitiveCompare(s) == .orderedSame }) {
                    info.obsoletePaths.append(s)
                }
            }
        }
        if let arr = obj["purgeDataFiles"]?.arrayValue {
            for val in arr {
                if let s = val.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                   isSafeManagedRelPath(s, allowTrailingSlash: false) {
                    info.purgeDataFiles.append(s)
                }
            }
        }
        return info
    }

    @discardableResult
    static func cleanupObsoletePaths(
        in targetRoot: String,
        manifest: InstallManifestInfo,
        isSymbolicLink: (String) -> Bool,
        hasSymbolicLinkInChain: (String, String) -> Bool
    ) -> Int {
        guard !targetRoot.isEmpty, !manifest.obsoletePaths.isEmpty else { return 0 }
        let fm = FileManager.default
        let normRoot = URL(fileURLWithPath: targetRoot).standardizedFileURL.path
        let rootPrefix = normRoot.hasSuffix("/") ? normRoot : normRoot + "/"
        var removed = 0

        for rel in manifest.obsoletePaths {
            guard isSafeManagedRelPath(rel, allowTrailingSlash: false) else { continue }
            guard !isProtectedUserPath(rel, manifestProtectedPaths: manifest.protectedUserPaths) else { continue }
            let candidate = URL(fileURLWithPath: (normRoot as NSString).appendingPathComponent(rel)).standardizedFileURL.path
            guard candidate.hasPrefix(rootPrefix) else { continue }
            guard fm.fileExists(atPath: candidate) else { continue }
            let parentDir = (candidate as NSString).deletingLastPathComponent
            if hasSymbolicLinkInChain(parentDir, normRoot) || isSymbolicLink(candidate) {
                continue
            }
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: candidate, isDirectory: &isDir), !isDir.boolValue else { continue }
            if (try? fm.removeItem(atPath: candidate)) != nil {
                removed += 1
                pruneEmptyParents(of: candidate, stopRoot: normRoot, isSymbolicLink: isSymbolicLink)
            }
        }
        return removed
    }

    private static func pruneEmptyParents(of filePath: String, stopRoot: String, isSymbolicLink: (String) -> Bool) {
        let fm = FileManager.default
        let rootPrefix = stopRoot.hasSuffix("/") ? stopRoot : stopRoot + "/"
        var cur = (filePath as NSString).deletingLastPathComponent
        for _ in 0..<16 {
            guard cur != stopRoot, cur.hasPrefix(rootPrefix), !isSymbolicLink(cur) else { break }
            guard let items = try? fm.contentsOfDirectory(atPath: cur), items.isEmpty else { break }
            guard (try? fm.removeItem(atPath: cur)) != nil else { break }
            cur = (cur as NSString).deletingLastPathComponent
        }
    }

    static func shouldSkipProtectedPayloadItem(
        _ name: String,
        dest: String,
        isDir: Bool,
        manifest: InstallManifestInfo,
        preservedConfig: inout Bool
    ) -> Bool {
        guard FileManager.default.fileExists(atPath: dest),
              isProtectedUserPath(name, manifestProtectedPaths: manifest.protectedUserPaths) else {
            return false
        }
        if !isDir && name.caseInsensitiveCompare("config.json") == .orderedSame {
            preservedConfig = true
        }
        return true
    }

    static func uninstallDirPreservingUserAssets(_ dir: String, purgeData: Bool, isSymbolicLink: (String) -> Bool) {
        if !purgeData && hasUserOwnedAssets(in: dir, isSymbolicLink: isSymbolicLink) {
            removeManagedFilesKeepingUserAssets(in: dir, isSymbolicLink: isSymbolicLink)
        } else {
            try? FileManager.default.removeItem(atPath: dir)
        }
    }

    static func hasUserOwnedAssets(in targetRoot: String, isSymbolicLink: (String) -> Bool) -> Bool {
        guard !targetRoot.isEmpty else { return false }
        let fm = FileManager.default
        for raw in userOwnedAssetPaths {
            let clean = raw.hasSuffix("/") ? String(raw.dropLast()) : raw
            let full = (targetRoot as NSString).appendingPathComponent(clean)
            if isSymbolicLink(full) { continue }
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: full, isDirectory: &isDir) else { continue }
            if !isDir.boolValue { return true }
            if let items = try? fm.contentsOfDirectory(atPath: full), !items.isEmpty {
                return true
            }
        }
        return false
    }

    static func removeManagedFilesKeepingUserAssets(in targetRoot: String, isSymbolicLink: (String) -> Bool) {
        guard !targetRoot.isEmpty else { return }
        walkRemoveKeepingAssets(curDir: targetRoot, relPrefix: "", isSymbolicLink: isSymbolicLink)
    }

    private static func walkRemoveKeepingAssets(curDir: String, relPrefix: String, isSymbolicLink: (String) -> Bool) {
        if isSymbolicLink(curDir) { return }
        let fm = FileManager.default
        guard let names = try? fm.contentsOfDirectory(atPath: curDir) else { return }
        for name in names {
            let rel = relPrefix.isEmpty ? name : "\(relPrefix)/\(name)"
            if matchesAnyRule(rel.lowercased(), rules: userOwnedAssetPaths) { continue }
            let full = (curDir as NSString).appendingPathComponent(name)
            if isSymbolicLink(full) { continue }
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: full, isDirectory: &isDir) else { continue }
            if isDir.boolValue {
                walkRemoveKeepingAssets(curDir: full, relPrefix: rel, isSymbolicLink: isSymbolicLink)
                if let left = try? fm.contentsOfDirectory(atPath: full), left.isEmpty {
                    try? fm.removeItem(atPath: full)
                }
            } else {
                try? fm.removeItem(atPath: full)
            }
        }
    }
}
