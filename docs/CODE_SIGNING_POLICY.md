# Code Signing Policy / 代码签名策略

> **Free Code Signing Notice / 免费开源代码签名声明**
>
> Free code signing for official Windows release binaries of **Obsidian Prism** is provided by [SignPath.io](https://signpath.io/), using a certificate issued by the [SignPath Foundation](https://signpath.org/) (when enabled on official public release tags).
>
> **Obsidian Prism** 官方 Windows 发版产物的免费开源代码签名计划由 [SignPath.io](https://signpath.io/) 提供，签名证书由 [SignPath Foundation](https://signpath.org/) 颁发（在官方公开标签发布流水线启用签名后生效）。

---

## 1. Open Source License & Scope / 开源协议与适用范围

- **Project**: `RMvdesi/obsidian-prism` (**Obsidian Prism / 黑曜棱镜**)
- **License**: **GNU General Public License v3.0 only (`GPL-3.0-only`)** — see [`LICENSE`](../LICENSE).
- **100% Open Source & Zero Runtime npm Dependencies**: All source code (JavaScript/ESM, C# Windows installer/watcher, Swift macOS installer/watcher, and Linux portable scripts) is publicly auditable in this repository with zero closed-source blobs and zero external runtime `node_modules` dependencies.
- **Signed Artifacts Scope**:
  1. `obsidian-prism-watcher.exe` — Background optical bridge watcher (embedded inside the Windows installer payload);
  2. `obsidian-prism-installer.exe` — Standalone Windows installer & uninstaller.

---

## 2. Reproducible Public CI & Two-Step Signing Pipeline / 公开 CI 可复现构建与双步签名

All signed release binaries **MUST** be built exclusively on public GitHub-hosted runners via [`.github/workflows/release.yml`](../.github/workflows/release.yml) from signed/protected `v*` Git tags. Developer workstations never submit ad-hoc local builds for signing.

为确保每一份已签名安装包可公开溯源并复现，所有签名请求仅允许由公开仓库的 GitHub Actions CI（[`.github/workflows/release.yml`](../.github/workflows/release.yml)）在 `v*` 发版标签触发时自动提交，严禁个人开发机手工上传本地编译产物进行签名。

### Two-Step Signing Order / 严格双步签名顺序

Because `obsidian-prism-installer.exe` embeds `obsidian-prism-watcher.exe` inside its `AGY_PAYLOAD.zip` resource together with a SHA-256 `install-manifest.json`, Windows signing strictly follows a two-step order:

1. **Step 1 — Build & Sign Watcher**:
   `node scripts/build-installer.mjs --watcher-only --out dist/unsigned/obsidian-prism-watcher.exe`
   Submit `obsidian-prism-watcher.exe` to SignPath Foundation and retrieve `dist/signed/obsidian-prism-watcher.exe`.
2. **Step 2 — Embed Signed Watcher, Build & Sign Installer**:
   `node scripts/build-installer.mjs --prebuilt-watcher dist/signed/obsidian-prism-watcher.exe --out dist/unsigned/obsidian-prism-installer.exe`
   Compute exact SHA-256 digests into `install-manifest.json`, embed the signed `watcher.exe` into `AGY_PAYLOAD.zip`, compile `installer.exe` with synchronized PE version metadata derived from `package.json#version`, then submit `obsidian-prism-installer.exe` to SignPath Foundation.

---

## 3. Team Roles & Governance / 团队角色与审签治理

In accordance with SignPath Foundation requirements, repository access and signing approval responsibilities are explicitly defined:

- **Committers & Maintainers**: Project maintainer [`RMvdesi`](https://github.com/RMvdesi) and authorized collaborators listed in [`docs/CONTRIBUTORS.md`](./CONTRIBUTORS.md).
- **Reviewers & Approvers**: Release commits must pass all automated architectural, bundle-budget, version-SSOT, and security red-team gates (`npm run test:gates`, `npm run version:check`, and full regression suite) before a release tag is created and approved for signing.
- **No Unreviewed Third-Party Code**: Community Pull Requests undergo code review and CI gate verification before merge; external contributors cannot trigger production signing secrets from forks.

---

## 4. Privacy & Host Safety Commitment / 隐私与宿主安全承诺

As documented in [`.github/SECURITY.md`](../.github/SECURITY.md):

- **Zero Telemetry / Zero Data Exfiltration**: Obsidian Prism does not transmit user prompts, file paths, API keys, or analytics to any external server.
- **Zero Host Binary Modification**: The installer and runtime never patch Antigravity's `app.asar`, never modify host executables, and never open host SQLite databases (`state.vscdb` or live `conversations/*.db`).
- **Loopback-Only Local Services**: Local companion services strictly bind to `127.0.0.1` with `Host` and `Origin` / `Sec-Fetch-Site` enforcement.

---

## 5. Verifying Release Integrity (`SHA256SUMS.txt`) / 发版产物验真指南

Every GitHub Release publishes a `SHA256SUMS.txt` file generated directly from the CI build artifacts. Users can verify both the SHA-256 digest and (when SignPath signing is active) the Authenticode digital signature before running any binary.

每次 GitHub Release 均附带由 CI 自动生成的 `SHA256SUMS.txt` 校验清单，用户可在运行前通过以下命令核验文件哈希与数字签名：

### Windows (PowerShell)

```powershell
# 1. Verify SHA-256 against SHA256SUMS.txt from the GitHub Release page
Get-FileHash .\obsidian-prism-installer.exe -Algorithm SHA256

# 2. Verify Authenticode signature (for SignPath-signed releases)
Get-AuthenticodeSignature .\obsidian-prism-installer.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
```

### macOS (Terminal)

```bash
shasum -a 256 Obsidian-Prism-macOS-universal.dmg
# Compare the digest with the corresponding line in SHA256SUMS.txt
```

### Linux (Terminal)

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

---

## 6. Vulnerability Disclosure & Revocation / 漏洞披露与证书撤销

If you discover a security vulnerability, compromised artifact, or unexpected signature mismatch, please report it privately via **GitHub Security Advisories** as described in [`.github/SECURITY.md`](../.github/SECURITY.md). Verified security incidents involving signed artifacts will trigger immediate release withdrawal and SignPath certificate/artifact revocation notification.
