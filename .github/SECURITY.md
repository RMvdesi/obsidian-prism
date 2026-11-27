# Security Policy / 安全策略

## 12-Channel Defense-in-Depth Security Architecture / 12 通道纵深安全边界

**Obsidian Prism** is engineered with strict local-first, zero-host-tampering, and fail-closed security boundaries across all 12 on-demand channels and native installers:

1. **Read-Only CDP Domain Permanent Allowlist (只读 CDP 永久白名单)**:
   - All DevTools Protocol traffic is permanently restricted to `Page.*`, `Runtime.*`, `Target.*`, and `Browser.close`.
   - High-risk / invasive CDP domains (`Network.*`, `Fetch.*`, `Debugger.*`, `Input.*`, `Emulation.*`, `DOM.*`, `Storage.*`, etc.) are strictly forbidden and enforced by automated red-team gates (`test/gates/security-redteam.test.mjs`).
2. **Physical Isolation from Host Binaries & Databases (宿主二进制与数据库物理绝缘)**:
   - **Never touches `app.asar` or host executables**: Obsidian Prism operates purely via opt-in local optical bridge (`--remote-debugging-port=0`) without binary patching.
   - **Never opens host SQLite databases**: Strictly prohibited from opening Antigravity's `state.vscdb` or live `conversations/*.db` files via SQLite handles.
   - **Zero Host Process Tampering**: Never invokes `EmptyWorkingSet`, non-read-only `OpenProcess`, `taskkill`, `Stop-Process`, or `SIGKILL` against `Antigravity` or `language_server`.
3. **Loopback-Only Local HTTP, CSRF & DNS Rebinding Defense (本地回环与 CSRF/DNS 重绑定防护)**:
   - Every local HTTP server (`workbench/server.cjs`, `omni-server.mjs`, `wallpaper-service.mjs`, etc.) explicitly binds to `127.0.0.1` (never `0.0.0.0` or `::`).
   - Incoming requests enforce strict `Host` allowlisting, `Origin` / `Sec-Fetch-Site` validation against cross-site request forgery and DNS rebinding, and strict request payload size limits.
4. **Outbound Network SSRF & HTTPS Protection (出网 SSRF 与 HTTPS 保护)**:
   - Optional AI translation and update services validate destination URLs and resolved DNS addresses via `src/security/net-guard.mjs`, blocking private/loopback/link-local/reserved IP ranges against SSRF.
   - Refuses to send API keys or credentials over plaintext `http://` to non-local remote hosts.
5. **Zero Secret Persistence, `0o600` Minimum Permissions & `<USER_HOME>` Redaction (凭据隔离、最小权限与隐私脱敏)**:
   - Optional OpenAI-compatible Thought Translator API keys and custom prompts are stored exclusively at `~/.gemini/config/obsidian-prism-thought.json` with `0o600` file permissions, masked in UI responses (`sk-••••xxxx`), and never written to project directories or `config.json`.
   - Daemon logs, runtime caches, and state files use `0o600` permissions on POSIX; error logs redact user home paths (`<USER_HOME>`), tokens, and sensitive query parameters. Zero user prompts, telemetry, or credentials are ever uploaded.
6. **Zero Runtime `innerHTML` & Trusted Types Safety (运行期零 `innerHTML` 与 XSS 防御)**:
   - All runtime UI, Markdown rendering, and reasoning blocks are built strictly via DOM `createElement` / `createElementNS` / `textContent` / `replaceChildren`, permanently enforcing 0 runtime `innerHTML` / `outerHTML` / `insertAdjacentHTML` writes.
7. **Atomic Upgrades, Path-Traversal Defense & User-Data Isolation (原子升级与用户数据绝对隔离)**:
   - Upgrades are driven by SHA-256-verified `install-manifest.json` (`schemaVersion: 2`) with 4-stage same-volume `.staging` / `.rollback` atomic transactions, strict relative-path and symlink/reparse-point refusal, and absolute protection for user files (`config.json`, `custom.css`, `wallpapers/`, `backups/`, and redline archive directories `conversations_archive`, `prism-knowledge-space`, `Antigravity-Spark`).
8. **Zero AV-Trigger Patterns & Reproducible Supply Chain (零杀软红线与可复现供应链)**:
   - All subprocesses use parameterized `execFile` / native OS APIs with zero hidden PowerShell, zero encoded commands, zero WMI queries, zero `Add-Type`, zero `WScript.Shell`, and zero inline `node -e` self-delete payloads.
   - Official releases publish `SHA256SUMS.txt` and adhere to our transparent code signing policy: see [`docs/CODE_SIGNING_POLICY.md`](../docs/CODE_SIGNING_POLICY.md).

## Reporting a Vulnerability / 漏洞披露渠道

Please report security issues **privately** via **GitHub Security Advisories** (`Security` tab -> `Report a vulnerability`) on the `RMvdesi/obsidian-prism` repository rather than opening a public issue.

请通过仓库的 **GitHub Security Advisories** 私密提交安全漏洞，请勿在公开 Issue 中披露未修复的漏洞细节。提交时请尽可能附上：

- Affected Obsidian Prism version, OS, and Node.js / Antigravity version;
- Minimal reproduction steps or proof-of-concept;
- Potential security impact assessment.

We aim to acknowledge private vulnerability reports within **72 hours** and coordinate remediation and disclosure responsibly.
