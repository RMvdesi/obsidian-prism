# Custom CSS Authoring Guide & Preset Specification (`custom.css`)

> **Applies to**: Obsidian Prism Channel 18 (`customStyle`) · Local `custom.css` + 3-Tier Global Font Cascade
> **Reference sources**: [`style.css`](../../style.css) · [`src/compat/host-selectors.cjs`](../../src/compat/host-selectors.cjs) · [`vendor/custom-style/custom-style-client.js`](../../vendor/custom-style/custom-style-client.js) · [`src/channels/custom-css-loader.cjs`](../../src/channels/custom-css-loader.cjs) · [`AGENTS.md`](../../AGENTS.md) · [`ADR-006`](../adr/ADR-006-zero-innerhtml-and-cssom-hygiene.md)

This guide documents how to author safe, high-craft, 300Hz-friendly stylesheets for `<pluginRoot>/custom.css` and how to use or adapt the bundled publication-grade presets.

---

## 1. Quick Start & Lifecycle

| Property | Behavior |
| --- | --- |
| **File location** | `<pluginRoot>/custom.css` (inside the Obsidian Prism plugin directory, alongside `config.json`) |
| **Create / Open from UI** | Open Obsidian Prism Settings -> **Custom CSS (`custom.css`)** -> click the single action button: **Create Template** when missing (atomic `wx` create without overwriting, then opens in your default editor) or **Open** once the file exists |
| **Use a preset** | Copy any `.css` file from this folder to `<pluginRoot>/custom.css` and save |
| **Live hot-reload** | Save `custom.css` to auto hot-reload via the daemon's existing directory `fs.watch` (~120 ms debounce) -> rebuilds and syncs **only Channel 18** without rebuilding Channel 1 or restarting Antigravity |
| **Upgrade safety** | `custom.css` is a protected user asset in `install-manifest.cjs` and is preserved across plugin upgrades and reinstalls |
| **Disable cleanly** | Switch `customCss` to `"off"` in Settings (or `config.json`) -> 0 injection overhead while keeping your local file untouched on disk |

---

## 2. Four-Layer Cascade Order

Obsidian Prism resolves fonts and custom overrides in a strict, deterministic four-layer cascade:

```text
L1  Global UI Font   (<style id="ag-prism-ui-font-style"> · html[data-ag-cs-ui-font])
        |
        v  (Chat inherits UI font automatically when chatFont === "default")
L2  Chat / Prose     (<style id="ag-prism-custom-fonts-style"> · html[data-ag-cs-chat-font])
        |
        v  (Code/Diff/Terminal are strictly insulated from L1 & L2)
L3  Code / Monospace (--ag-cs-mono-stack / --font-mono / --editor-font-family)
        |
        v  (Always pinned as the absolute last element in <head>)
L4  custom.css       (<style id="ag-prism-user-custom-css"> · html[data-ag-prism-custom-css])
```

### Zero-`!important` Font Bridge Variables

Channel 18 exposes three top-level CSS custom properties that hook directly into L1, L2, and L3. Defining them in `custom.css` overrides the entire three-tier font stack cleanly—even when UI/Chat/Code settings are left on **Host Default**:

```css
:root {
  --ag-prism-ui-font: "Inter", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;
  --ag-prism-chat-font: "Charter", "Georgia", "Noto Serif SC", serif;
  --ag-prism-code-font: "JetBrains Mono", "Cascadia Code", ui-monospace, monospace;
}
```

- **Priority guarantee**: `custom-style-client.js` calls `ensureUserCssLast(doc)` after every Channel 18 sync and `font-customizer.js` calls it again whenever `#ag-prism-custom-fonts-style` updates, keeping `#ag-prism-user-custom-css` pinned last in `<head>`.
- **Status attribute**: `html[data-ag-prism-custom-css]` reflects live loader state (`active`, `missing`, `empty`, `off`, `rejected-too-large`, `rejected-symlink`, `rejected-non-file`, `error`).

---

## 3. Verified CSS Variables & Dual-Theme Overrides

### Writing Clean Dark + Light Overrides

In `style.css`, Obsidian Prism applies built-in palette and accent variables (`--background`, `--content`, `--sidebar`, `--card`, `--foreground`, `--primary`, `--link`, etc.) with `!important` on `html[data-ag-cs-style]` and—for several accent and surface tokens—also on `> body`. In Dark Mode, specificity reaches `(0, 3, 1)` on `html` (`(0, 3, 2)` on `body`); in Light Mode with explicit `accentTone` overrides (`style.css:156-160`), nested selectors expand to `(0, 5, 1)` on `html` and `(0, 5, 2)` on `> body`.

Because Channel 1 mounts `style.css` via `document.adoptedStyleSheets` (which wins equal-specificity ties over `<head><style>`), `custom.css` theme token blocks must strictly outrank `style.css`—using `(0, 4, 1)`/`(0, 4, 2)` in Dark Mode and `(0, 6, 1)`/`(0, 6, 2)` in Light Mode—to override every built-in palette (`obsidian`, `warm`, `alabaster`, `host`) and non-`follow` `accentTone` cleanly in both modes. Likewise, when overriding component rules that `style.css` also customizes in Light Mode (such as `blockquote`, `.markdown-alert`, `[data-testid="user-message-bubble"]`, or `[data-testid="conversation-row-sidebar"][data-selected="true"]`), prefix the selector with `html:root[data-ag-cs-style][data-ag-cs-style]` so your override cleanly wins in both Dark and Light themes:

```css
/* Dark theme (default when data-ag-cs-theme is absent or "dark") */
html:root[data-ag-cs-style][data-ag-cs-style]:not([data-ag-cs-theme="light"]),
html:root[data-ag-cs-style][data-ag-cs-style]:not([data-ag-cs-theme="light"]) > body {
  --font-sans: var(--ag-prism-ui-font) !important;
  --background: #0c0d10 !important;
  --content: #0c0d10 !important;
  --shell: #0c0d10 !important;
  --body-background: #0c0d10 !important;
  --sidebar: #090a0c !important;
  --card: #13151a !important;
  --foreground: #eceef2 !important;
  --primary: #94a3b8 !important;
  --link: #7aa2f7 !important;
  --ag-cs-accent: #94a3b8 !important;
}

/* Light theme (specificity (0,6,1) / (0,6,2) strictly beats adoptedStyleSheets (0,5,1) accentTone rules) */
html:root[data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-theme="light"],
html:root[data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-theme="light"] > body {
  --font-sans: var(--ag-prism-ui-font) !important;
  --background: #f9fafb !important;
  --content: #f9fafb !important;
  --shell: #f9fafb !important;
  --body-background: #f9fafb !important;
  --sidebar: #f2f4f7 !important;
  --card: #ffffff !important;
  --foreground: #111827 !important;
  --primary: #1f2937 !important;
  --link: #2563eb !important;
  --ag-cs-accent: #1f2937 !important;
}
```

> **Browser-hole safety**: Prefer driving shell, sidebar, and canvas backgrounds through CSS tokens (`--background`, `--content`, `--shell`, `--body-background`, `--sidebar`) rather than forcing opaque `background` on `body` or `.agy-shell`. That preserves `style.css`'s built-in `:not([data-has-browser-hole="true"])` transparency chain for embedded browser panes.

### Verified Variable Reference (`style.css` & Channel 18)

| Category | Verified CSS Custom Properties |
| --- | --- |
| **3-Tier Font Bridge** | `--ag-prism-ui-font`, `--ag-prism-chat-font`, `--ag-prism-code-font`, `--font-sans`, `--font-mono`, `--editor-font-family`, `--ag-cs-mono-stack` |
| **Core Surfaces** | `--background`, `--content`, `--shell`, `--body-background`, `--sidebar`, `--sidebar-muted`, `--sidebar-secondary`, `--card`, `--secondary`, `--muted` |
| **Tonal Ramp** | `--ag-cs-tonal-0`, `--ag-cs-tonal-1`, `--ag-cs-tonal-2`, `--ag-cs-tonal-3`, `--ag-cs-tonal-4` |
| **Borders & Hairlines** | `--border`, `--card-border`, `--ag-cs-border-1`, `--ag-cs-border-2`, `--sash-line` |
| **Ink & Text** | `--foreground`, `--secondary-foreground`, `--muted-foreground`, `--placeholder` |
| **Accent & Semantic** | `--primary`, `--primary-foreground`, `--link`, `--ag-cs-accent`, `--error`, `--warning`, `--success`, `--scrim`, `--bg-selection` |
| **Panels & Chrome** | `--ag-cs-panel-bg`, `--ag-cs-popover-bg`, `--ag-cs-pill-bg`, `--ag-cs-menu-bg`, `--ag-cs-menu-bg-l`, `--ag-cs-menu-bd`, `--ag-cs-bubble`, `--ag-cs-hover-wash`, `--ag-cs-thought-rule`, `--ag-cs-specular` |
| **Radii & Measure** | `--ag-cs-r-sm`, `--ag-cs-r-md`, `--ag-cs-r-lg`, `--ag-cs-r-pill`, `--max-conversation-width` |
| **Ambient & Motion** | `--ag-ambient-mul`, `--ag-accent-prism-mul`, `--ag-prism-strength` |
| **Diff Highlights** | `--editor-diff-inserted-line-background`, `--editor-diff-inserted-text-background`, `--editor-diff-removed-line-background`, `--editor-diff-removed-text-background` |

> **Variable naming hygiene**: If you introduce custom helper tokens inside `custom.css` or a preset, use a descriptive `--ag-prism-*` prefix (e.g., `--ag-prism-ed-rule`). Never use `--_*` or short `<= 4`-char names.
> **Chromium CSSOM pitfall ([ADR-006](../adr/ADR-006-zero-innerhtml-and-cssom-hygiene.md))**: Avoid declaring a shorthand containing `var(...)` (such as `border: 1px solid var(--border)`) and then overriding a longhand of the same family (such as `border-left-width`) in the same rule; write explicit longhands when mixing `var()` with per-side overrides.

---

## 4. Verified Host & Prism DOM Selectors

All selectors below are verified against [`src/compat/host-selectors.cjs`](../../src/compat/host-selectors.cjs), [`style.css`](../../style.css), and [`vendor/custom-style/custom-style-client.js`](../../vendor/custom-style/custom-style-client.js). Never guess opaque Tailwind utility hashes.

| Surface | Verified Selectors |
| --- | --- |
| **Shell & Panes** | `.agy-shell`, `[data-testid="main-content-body"]`, `[data-testid="sidebar-split"]`, `[data-testid="overview-panel-host"]`, `[data-testid="aux-pane-split"]`, `[data-testid="pane-titlebar-toolbar"]` |
| **Sidebar** | `[data-testid="conversation-row-sidebar"]`, `.agy-sidebar-row`, `[data-testid="project-header"]`, `[data-testid="section-header"]`, `[data-testid="pinned-section-header"]`, `[data-testid="new-conversation-button"]`, `[data-testid="automations-button"]` |
| **Conversation & Prose** | `[data-testid="conversation-view"]`, `[data-testid="autoscroll-viewport"]`, `[data-testid="planner-response-text"]`, `[data-testid="agent-response"]`, `[data-testid="user-message"]`, `[data-testid="message-content"]`, `[data-testid="artifact-view"]`, `[data-testid="side-question-panel"]`, `[data-testid="subagent-tab-conversation"]` |
| **User Bubbles & Cards** | `[data-testid="user-message-bubble"]`, `.agy-user-bubble`, `.agy-user-bubble-header`, `[data-testid="artifact-card"]`, `[data-testid="bubble-artifact-card"]`, `[data-testid="artifact-card-header"]`, `[data-testid="step-plan"]` |
| **Markdown Blocks** | Inside prose roots: `h1`–`h6`, `p`, `ul`, `ol`, `li`, `blockquote`, `.markdown-alert`, `.markdown-alert-title`, `.md-divider-spacing hr`, `.agy-md-table.md-table-frame`, `.md-table-host > .md-table-scroll`, `table.md-table-el`, `table:not(.md-table-el)`, `[data-testid="entity-pill"]`, `.inline-pill` |
| **Thinking / Collapsibles** | `[data-testid="thinking-collapsible-trigger"]`, `[data-testid="worked-for-collapsible"]`, `[data-testid="tool-group-collapsible"]`, `.ag-prism-thought-overlay`, `.ag-prism-thought-body` |
| **Composer** | `[data-testid="agent-input-box"]`, `.surface-composer-card`, `[data-lexical-editor="true"]`, `.agy-composer-footer`, `[data-testid="model-selector-trigger"]`, `[data-testid="permissions-selector-trigger"]`, `[data-testid="send-button"]` |
| **Code / Diff / Terminal** | `pre`, `code`, `.code-block`, `.code-line`, `kbd`, `pre > div:is(.border, .bg-muted)`, `pre > div > :is([data-ag-cs-code-sticky="1"], div.border-b:first-child)`, `.monaco-editor .view-lines`, `.monaco-diff-editor`, `.ag-cs-inline-diff-box`, `[data-testid="changed-files-card"]`, `[data-testid="bottom-terminal-panel"]`, `.xterm`, `.xterm-rows`, `[data-testid="background-task-command"]` |

---

## 5. Local-Only Security Rules

`src/channels/custom-css-loader.cjs` enforces strict fail-closed local sandboxing:

1. **Size cap (`<= 256 KB`)**: Files over `262,144` bytes are rejected (`rejected-too-large`) before injection. Repository presets must also stay within the repo module limit (`<= 800` lines and `<= 40,960` bytes).
2. **No symlinks or path traversal**: `lstatSync` + `realpathSync` require `<pluginRoot>/custom.css` to be a regular file strictly inside `<pluginRoot>` (`rejected-symlink` / `rejected-non-file` otherwise).
3. **`@import` is automatically stripped**: Every active `@import` rule—including CSS hex/non-hex backslash-escaped obfuscations and multiline `url(...)` directives—is replaced with `/* [obsidian-prism] blocked @import */` and counted in Settings status. Block comments (`/* ... */`) and CSS string literals do **not** trigger `@import` blocking, and comment-only files report `empty` with 0 injection overhead.
4. **Zero remote assets**: Never reference `http://` or `https://` URLs (remote webfonts, remote backgrounds, tracking pixels) inside CSS rules. Use locally installed system/user fonts only.
5. **Zero embedded base64 images**: Do not embed `data:image/` payloads in presets (bloat, CSP/memory overhead).
6. **Zero `:has()`**: Forbidden across all Obsidian Prism CSS for both layout-performance and hygiene reasons.
7. **Repo preset encoding hygiene**: Presets checked into this repository must be UTF-8 (no BOM), LF line endings (`\n`), balanced `{}` braces, and 100% pure ASCII (use official English/ASCII font family names for CJK fonts, e.g., `"Noto Serif CJK SC"`, `"Source Han Serif SC"`, `"Songti SC"`, `"PingFang SC"`, `"Microsoft YaHei"`).

---

## 6. Icon Immunity & 300Hz GPU Performance Rules

### Icon Immunity (Never Break Glyph Fonts)

Antigravity and VS Code components rely on icon font glyphs:

- `.codicon`
- `[class*="codicon-"]`
- `.octicon`
- `[data-icon-font]`

Channel 18 explicitly locks `.codicon` / `[class*="codicon-"]` to `codicon !important` and `.octicon` to `octicons !important`. **Never** write blanket universal rules like `* { font-family: ... !important; }` or `span { font-family: ... !important; }` that could overwrite icon fonts into tofu boxes.

### 300Hz Performance Redlines ([`AGENTS.md`](../../AGENTS.md))

1. **Avoid heavy universal descendant `:is()` chains (Issue #151)**: High-frequency token streaming mutates DOM subtrees dozens of times per second. Keep selectors shallow and anchored to specific prose containers (`[data-testid="planner-response-text"]`, `[data-testid="agent-response"]`, `[data-testid="artifact-view"]`) rather than matching `*` or broad document-wide descendant lists.
2. **Never use `:has()`**: Parent-matching structural selectors force broad style recalculation during streaming and scrolling.
3. **Preserve smooth GPU-composited animations**: Never downgrade loading spinners, thinking sparks, or hover/open transitions into choppy low-fps `steps()` animations.
4. **Never toggle `backdrop-filter` on scroll or streaming**: Leave core floating overlays (Overview, Drawer, Toast, SideQuestion, Fastpick, SlashMenu, PeekSurface) undisturbed during scrolling so they never flash.
5. **Protect sticky code headers and scroll stability**: Never apply `content-visibility: auto` to conversation messages or code blocks, and never set `overflow: hidden` on `pre` or `pre > div:is(.border, .bg-muted)`—doing so breaks `position: sticky` on code block toolbars (`[data-ag-cs-code-sticky="1"]`, `div.border-b:first-child`) and causes scroll-height jumps.

---

## 7. Editorial-to-IDE Adaptation Principles

Great coding tools and flagship publications solve the same core problem—sustaining clarity across long, dense sessions—but an AI IDE imposes structural constraints that a web article does not:

1. **Tri-Zone Typography Separation**:
   - **UI Chrome** (sidebar, titlebar, menus, buttons, composer footer) needs compact, neutral sans-serif legibility so narrow controls and dense labels never clip or wrap awkwardly.
   - **Prose & Artifacts** (agent responses, plans, markdown docs) benefit from intentional reading typography—generous line-height, restrained line measure, clear heading hierarchy, refined blockquotes, and quiet hairline dividers.
   - **Code, Diff & Terminal Sanctuary** (`pre`, `code`, Monaco, inline diff, xterm) must remain strict monospace with normal letter-spacing, crisp tabular alignment, and high contrast. Never let serif faces or CJK prose tracking bleed into code.
2. **True Dual-Theme Parity**:
   - Dark and Light themes must be tuned independently for surface luminance, border alpha, ink warmth, and link contrast—not generated by naive inversion.
3. **Structural Signal Over Decorative Noise**:
   - Favor typographic hierarchy, calibrated whitespace, subtle tonal elevation, and 1 px hairlines over heavy drop shadows, saturated borders, or competing glows.
4. **Script-Aware Micro-Typography**:
   - Latin editorial prose reads best around `line-height: 1.62–1.74` with slight negative display tracking on headings; dense CJK prose benefits from `line-height: 1.78–1.84`, gentle `0.015em` character breathing room, and slightly scaled inline-code chips (`~0.89em`) so Latin symbols sit optically level inside Hanzi sentences.

---

## 8. Bundled Presets

Copy any file below to `<pluginRoot>/custom.css` and save—changes apply immediately via hot-reload.

| Preset | Inspired By | Typography | Visual Character (Dark & Light) |
| --- | --- | --- | --- |
| [`01-coding-minimal.css`](./01-coding-minimal.css) | Codex & Claude Code | Clean neo-grotesque sans + crisp JetBrains/SF/Cascadia Mono | Calm monochrome/slate surfaces, tight radii, low chrome noise, razor-sharp code/diff/terminal contrast |
| [`02-editorial-longform.css`](./02-editorial-longform.css) | Financial Times, The New Yorker & Works in Progress | Crisp sans UI + literary serif prose (`Charter` / `Iowan Old Style` / `Georgia` / `Cambria`) + insulated monospace | Warm rag-paper light & espresso-charcoal dark, comfortable reading measure, booktabs tables, print-inspired blockquotes |
| [`03-modern-briefing.css`](./03-modern-briefing.css) | Axios, Semafor & Bloomberg Businessweek | Authoritative neo-grotesque sans + `IBM Plex Mono` / `JetBrains Mono` | High-velocity executive hierarchy, bold lead-ins, sharp accent bars on quotes/alerts, crisp tabular-num data tables |
| [`04-chinese-editorial.css`](./04-chinese-editorial.css) | Initium Media (端传媒) | Clean CJK sans UI (`PingFang SC` / `Noto Sans CJK SC`) + Song/Ming serif CJK prose (`Noto Serif CJK SC` / `Source Han Serif SC` / `Songti SC`) + insulated monospace | Xuan paper light & carbon-ink dark, vermilion editorial accents, `1.82` CJK line-height, refined Chinese list & blockquote rhythm |
