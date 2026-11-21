"use strict";
/**
* Antigravity Codex 风格推理等级滑条 (antigravity-codex-effort-slider)
*
* 设计目标与核心约束：
* 1. 深度适配 Google Antigravity 原生架构（基于 @exa/agent-ui-toolkit 与 React Fiber 状态树），
*    而非盲目照搬 DeepSeek Harness 的 DOM 假设。
* 2. 在原生模型菜单 ([data-testid="model-selector-panel"]) 底部（模型列表与 View Usage 之间）
*    挂载专属「推理等级」滑条行；屏蔽模型行冗余的右侧悬停档位子菜单，保留模型行右侧档位文字并随档位着色。
* 3. 在菜单内点击上方模型行切换模型时不自动关闭菜单，下方滑条即时联动该模型的可用档位
*    （单档位模型如 GPT-OSS 120B 自动置灰锁定）。
* 4. 拖动滑条过程中，圆钮连续跟随指针；一旦滑过档位边界（无需等松手），立即通过 React Fiber
*    调用官方 setModelConfigByLabelForConversation 切换真实档位，菜单保持常开。
* 5. 针对 Antigravity 的三档模型 (Low / Medium / High) 采用 0 -> 0.5 -> 1.0 满配能量映射：
*    - Low (0%)    : 纯蓝 (#4d93f8) 轨道 + 0 能量 + 0 星尘 + 蓝色文字
*    - Medium (50%): 蓝紫过渡 (#9333ea) + 0.5 能量 + 11 颗星尘 (1x 闪烁速度) + 蓝紫文字
*    - High (100%) : 深紫星云 (#4c1d95) + 流光扫掠 + 22 颗星尘全开 (2x 速度) + 紫色边框光晕 + 亮紫文字
*/
(function (root, factory) {
try {
var exportsObj = factory(root);
if (typeof module === "object" && module && typeof module.exports === "object") {
module.exports = exportsObj;
}
if (root && typeof root === "object") {
root.AntigravityCodexEffortSlider = exportsObj;
}
} catch (err) {
// Factory error handled silently
}
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function (globalRoot) {
// ── 常量与默认几何参数 ──────────────────────────────────────────────────────
var STYLE_ELEMENT_ID = "ag-codex-effort-slider-styles";
var TRACK_HEIGHT = 28;
var KNOB_SIZE = 28;
var KNOB_RADIUS = KNOB_SIZE / 2;
var BASE_SPEEDUP = 4;
// Antigravity 默认三档模型 (Low / Medium / High) 无 Off 档，因此能量起点为 0、中点为 0.5；
// 若遇到首档为 Off 的四档模型 (Off / Low / High / Max)，energyStopsFor 会自动返回 { start: 1/3, end: 2/3 }。
var ENERGY_START = 0;
var ENERGY_END = 0.5;
var MIN_HEIGHT_SLOTS = 2;
// Antigravity 官方推理档位枚举与展示名映射（对应 main.js 中的 DXb / EXb / GXb）
var AG_EFFORT_ORDER = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var AG_EFFORT_LABELS = {
off: "Off",
minimal: "Minimal",
low: "Low",
medium: "Medium",
high: "High",
xhigh: "Extra",
max: "Max"
};
var AG_MODEL_LABEL_RE = /^(.*?)\s*\((off|minimal|low|medium|high|xhigh|extra|max)(?:\s+thinking)?\)\s*$/i;
// Claude 专属主题常量（6×60 点阵、1.6s 从右至左扫掠、Capsule 胶囊滑块）
var CLAUDE_CELL = 28 / 6; // ≈ 4.67px
var CLAUDE_ROWS = 6;
var CLAUDE_SWEEP_MS = 1600;
var CLAUDE_KNOB_W = 24;
var CLAUDE_KNOB_H = 30;
var CLAUDE_KNOB_R = 7;
function isClaudeModel(name) {
if (!name || typeof name !== "string") return false;
return /claude/i.test(name);
}
// ── 连续物理运动参数 ────────────────────────────────────────────────────────
// full: 完整星云阻尼变速动画；fast: 快速 ~70ms 跟手吸附（默认）；quick: 0 动画直接跳格
var _F = Object.freeze;
var MOTION = _F({ maxSpeed: 3.2, accel: 28, decel: 18, snapEps: 0.0015, velEps: 0.01 });
var MOTION_REDUCED = _F({ maxSpeed: 1e6, accel: 1e9, decel: 1e9, snapEps: 1e-4, velEps: 1e6 });
var MOTION_FAST = _F({ maxSpeed: 18, accel: 260, decel: 180, snapEps: 0.002, velEps: 0.04 });
var _REL_PRJ = 0.09, _PS_EMA = 0.45, _PS_STL = 0.05, _PS_TAU = 0.035;
var SETTINGS_KEY = "ag.codexEffortSlider.settings.v1";
var LEGACY_SETTINGS_KEY = "dsh.codexEffortSlider.settings.v1";
var SETTINGS_EVENT = "ag:codex-effort-slider:settings";
var SETTINGS_VERSION = 1;
var SETTINGS_SCHEMA = _F([
_F({ key: "motion", label: "动画效果", defaultValue: "fast", options: _F([
_F({ value: "fast", label: "快速动画", hint: "拨过 1/3 即切档 · ~70ms 快速吸附" }),
_F({ value: "quick", label: "简洁动画", hint: "无过渡 · 直接跳档" }),
_F({ value: "full", label: "完整动画", hint: "匀变速追赶 + 星尘渐亮" })
]) }),
_F({ key: "ticks", label: "已到达档位的刻度点", defaultValue: "highlight", options: _F([
_F({ value: "highlight", label: "亮白显示", hint: "默认 · 已滑过档位高亮" }),
_F({ value: "dim", label: "与未到达同色", hint: "所有刻度点保持柔和半透明" }),
_F({ value: "hidden", label: "隐藏", hint: "不显示任何刻度点" })
]) })
]);
function schemaDefaults() {
var out = { v: SETTINGS_VERSION };
for (var i = 0; i < SETTINGS_SCHEMA.length; i += 1) {
var item = SETTINGS_SCHEMA[i];
out[item.key] = item.defaultValue;
}
return out;
}
function normalizeSettings(raw) {
var base = schemaDefaults();
if (!raw || typeof raw !== "object") return base;
for (var i = 0; i < SETTINGS_SCHEMA.length; i += 1) {
var item = SETTINGS_SCHEMA[i];
var candidate = raw[item.key];
var matched = false;
for (var j = 0; j < item.options.length; j += 1) {
if (item.options[j].value === candidate) {
matched = true;
break;
}
}
if (matched) base[item.key] = candidate;
}
if (!raw.motion && raw.reducedMotion === true) {
base.motion = "quick";
}
return base;
}
function _win(w) { return w || (typeof window !== "undefined" ? window : globalRoot); }
function resolveStorage(win) {
try { var w = _win(win); return w && w.localStorage || null; } catch (e) { return null; }
}
var _cfgCache = null, _cfgStorage = null;
function _invCfg() { _cfgCache = null; _cfgStorage = null; }
function readSettings(win) {
var s = resolveStorage(win);
if (!s) return schemaDefaults();
if (_cfgCache && _cfgStorage === s) return _cfgCache;
try {
var t = s.getItem(SETTINGS_KEY) || s.getItem(LEGACY_SETTINGS_KEY);
_cfgCache = t ? normalizeSettings(JSON.parse(t)) : schemaDefaults();
_cfgStorage = s;
return _cfgCache;
} catch (e) { return schemaDefaults(); }
}
function writeSettings(patch, win) {
var w = _win(win), next = normalizeSettings(Object.assign({}, readSettings(w), patch || {}));
var s = resolveStorage(w);
if (s) { try { s.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) {} }
_cfgCache = s ? next : null;
_cfgStorage = s;
try { if (w && w.dispatchEvent && w.CustomEvent) w.dispatchEvent(new w.CustomEvent(SETTINGS_EVENT, { detail: next })); } catch (e) {}
return next;
}
function resetSettings(win) { return writeSettings(schemaDefaults(), win); }
function onSettingsChange(fn, win) {
var w = _win(win);
if (!w || typeof w.addEventListener !== "function") return function () {};
var hC = function (ev) { _invCfg(); fn(ev && ev.detail ? normalizeSettings(ev.detail) : readSettings(w)); };
var hS = function (ev) { if (ev && (ev.key === SETTINGS_KEY || ev.key === LEGACY_SETTINGS_KEY)) { _invCfg(); fn(readSettings(w)); } };
w.addEventListener(SETTINGS_EVENT, hC); w.addEventListener("storage", hS);
return function () { w.removeEventListener(SETTINGS_EVENT, hC); w.removeEventListener("storage", hS); };
}
function prefersReducedMotion(win) {
var w = _win(win);
try { return Boolean(w && w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
}
function getPrismRootAttr(doc, win, attr) {
try {
var d = doc || (win && win.document) || (typeof document !== "undefined" ? document : null);
if (d && d.documentElement && typeof d.documentElement.getAttribute === "function") {
return d.documentElement.getAttribute(attr) || "";
}
} catch (err) {}
return "";
}
function isPrismMotionOff(doc, win) {
return getPrismRootAttr(doc, win, "data-ag-cs-motion") === "off" || prefersReducedMotion(win);
}
function resolvePrismAccentTone(doc, win) {
var ac = getPrismRootAttr(doc, win, "data-ag-cs-accent");
return ac === "mono" || ac === "amber" || ac === "iris" || ac === "cobalt" ? ac : "follow";
}
function motionMode(win, explicitSettings, doc) {
if (isPrismMotionOff(doc, win)) return "quick";
var s = explicitSettings ? normalizeSettings(explicitSettings) : readSettings(win);
return s.motion || "fast";
}
function motionParamsForMode(mode) {
if (mode === "quick") return MOTION_REDUCED;
if (mode === "full") return MOTION;
return MOTION_FAST;
}
// ── 诊断环形缓冲区 ──────────────────────────────────────────────────────────
var _tr = [];
function tracePush(type, detail) {
var e = Object.assign({ t: Date.now(), type: String(type || "event") }, detail && typeof detail === "object" ? detail : null);
_tr.push(e);
if (_tr.length > 200) _tr.splice(0, _tr.length - 200);
}
function dumpTrace(win) {
var w = _win(win);
return { plugin: "antigravity-codex-effort-slider@1.2.1", time: new Date().toISOString(), ua: w && w.navigator ? w.navigator.userAgent : "node", settings: readSettings(w), events: _tr.slice() };
}
function clamp01(v) { var n = Number(v); return !Number.isFinite(n) || n <= 0 ? 0 : n >= 1 ? 1 : n; }
function clampAbs(v, l) { var m = Math.max(0, Number(l) || 0), n = Number(v) || 0; return n > m ? m : n < -m ? -m : n; }
function pctFromIndex(i, c) { var n = Number(c) || 0; return n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(Number(i) || 0))) / (n - 1); }
function indexFromPct(p, c) { var n = Number(c) || 0; return n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(clamp01(p) * (n - 1)))); }
/**
* 迟滞棘轮分档器（Hysteresis Detent）：
* - 向新档位方向推进过 1/3 格宽即刻触发跳档，保证「拖过边界立即切档」的轻快手感；
* - 往回退则需要退过 2/3 格宽（留出 [1/3, 2/3] 迟滞带），防止手指停在边界附近时左右抖动。
*/
function detentTargetIndex(currentIndex, ptrPct, count) {
var n = Number(count) || 0;
if (n <= 1) return 0;
var p = clamp01(ptrPct);
if (typeof currentIndex !== "number" || currentIndex < 0 || currentIndex >= n) {
return indexFromPct(p, n);
}
var step = 1 / (n - 1);
var forwardThreshold = 1 / 3;
var idx = currentIndex;
var curCenter = idx * step;
if (p >= curCenter) {
while (idx < n - 1 && p >= (idx + forwardThreshold) * step - 1e-9) {
idx += 1;
}
} else {
while (idx > 0 && p <= (idx - forwardThreshold) * step + 1e-9) {
idx -= 1;
}
}
return idx;
}
function knobOffsetOf(pct, radiusPx) {
var p = clamp01(pct);
var r = typeof radiusPx === "number" && Number.isFinite(radiusPx) ? radiusPx : KNOB_RADIUS;
return "calc(" + r + "px + (100% - " + (r * 2) + "px) * " + p + ")";
}
function motionSettled(state, params) {
if (!state) return true;
var cfg = params || MOTION;
var dist = Math.abs((Number(state.target) || 0) - (Number(state.x) || 0));
var vel = Math.abs(Number(state.v) || 0);
return dist <= cfg.snapEps && vel <= cfg.velEps;
}
/**
* 连续物理步进器：基于刹车距离 v^2 / (2 * decel) 平滑追赶 target，无过冲回弹
*/
function motionStep(state, dtSeconds, params) {
if (!state) return;
var cfg = params || MOTION;
var dt = Number(dtSeconds);
if (!Number.isFinite(dt) || dt <= 0) return;
if (dt > 0.05) dt = 0.05;
var target = clamp01(state.target);
var x = clamp01(state.x);
var v = Number(state.v) || 0;
var diff = target - x;
var dist = Math.abs(diff);
if (dist <= cfg.snapEps && Math.abs(v) <= cfg.velEps) {
state.x = target;
state.v = 0;
state.a = 0;
return;
}
var dir = diff >= 0 ? 1 : -1;
var movingTowards = v * dir >= 0;
var stopDist = (v * v) / (2 * cfg.decel);
var a = 0;
if (!movingTowards) {
a = dir * cfg.accel;
} else if (stopDist >= dist) {
a = -dir * cfg.decel;
} else {
a = dir * cfg.accel;
}
var nextV = clampAbs(v + a * dt, cfg.maxSpeed);
var nextX = x + nextV * dt;
// 防止单步跨越目标造成振荡
if ((target - x) * (target - nextX) <= 0 && Math.abs(nextV) <= cfg.maxSpeed) {
state.x = target;
state.v = 0;
state.a = 0;
return;
}
if (nextX <= 0) {
state.x = 0;
state.v = Math.max(0, nextV);
state.a = a;
return;
}
if (nextX >= 1) {
state.x = 1;
state.v = Math.min(0, nextV);
state.a = a;
return;
}
state.x = nextX;
state.v = nextV;
state.a = a;
}
function decayPointerSpeed(rawSpeed, idleSeconds) {
var v = Number(rawSpeed) || 0;
var idle = Number(idleSeconds) || 0;
if (idle <= _PS_STL) return v;
var decay = Math.exp(-(idle - _PS_STL) / _PS_TAU);
var out = v * decay;
return Math.abs(out) < 1e-4 ? 0 : out;
}
function releaseIndexFor(ptrPct, rawSpeed, idleSeconds, count) {
var v = decayPointerSpeed(rawSpeed, idleSeconds);
var projected = clamp01((Number(ptrPct) || 0) + v * _REL_PRJ);
return indexFromPct(projected, count);
}
// ── 22 颗黄金分割确定性星尘与色彩引擎（对齐 dsh-codex-effort-slider 右向左横穿星空） ──
var PARTICLE_COUNT = 22;
var _SF_MEAN = 1.5;
var _SF_SPR = 0.08;
var STARFIELD_MIN = 0.5;
var GOLDEN_RATIO = 0.6180339887498949;
var MAX_SPEED_FACTOR = 2;
var _RM_SLOW = 2.6;
/** 确定性伪随机 [0,1)：不用 Math.random，每次渲染完全一致且可离线断言 */
function starHash01(index, salt) {
var value = ((index + 1) * (salt || 1) * 2654435761) % 4294967296;
return ((value >>> 8) % 1000) / 1000;
}
/**
* 22 颗星尘粒子（形态 = 3px 圆点；运动 = 从右向左连续横穿已填充轨道，不消失、不上下飘动）：
* - 相位：黄金比低差异序列（任意前缀均匀铺开）
* - 高度：与相位排名解耦的确定性哈希排列，且相位相邻两星高度至少差 MIN_HEIGHT_SLOTS 槽
*/
var PARTICLES = (function () {
var count = PARTICLE_COUNT, out = [], byPhase = [], i;
for (i = 0; i < count; i += 1) {
var b = STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(i, 61);
out.push({ id: i, y: 0, phase: ((i + 1) * GOLDEN_RATIO) % 1, threshold: i / count, brightness: Math.round(b * 1000) / 1000 });
byPhase.push(i);
}
byPhase.sort(function (a, b) { return out[a].phase - out[b].phase; });
var slots = [10, 21, 1, 8, 19, 6, 17, 4, 15, 2, 13, 20, 0, 11, 18, 9, 16, 7, 14, 5, 12, 3];
for (var r = 0; r < count; r += 1) out[byPhase[r]].y = Math.round((8 + (slots[r] / (count - 1)) * 84) * 100) / 100;
for (i = 0; i < count; i += 1) _F(out[i]);
return _F(out);
})();
function isOffLevel(text) {
if (text === null || text === undefined) return false;
if (typeof text === "object") return isOffLevel(text.id || text.name || text.effort || text.label || "");
return /^(?:off|none|disabled|0|关闭|关|不推理|无)$/.test(String(text).trim().toLowerCase());
}
/* ── Claude Ultracode 像素点阵抖动引擎 ──────────────────────────────── */
function hash01(a, b, c) {
var h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 1274126177;
h = (h ^ (h >>> 13)) * 1274126177;
h = h ^ (h >>> 16);
return ((h >>> 0) % 100000) / 100000;
}
function ditherAlphaAt(x, w, col, row) {
var t = clamp01(x / Math.max(1, w));
var ramp = 0.92 + 0.08 * t;
var jitter = 0.25 + 0.75 * hash01(col, row, 7);
return clamp01(ramp * jitter);
}
function fillRoundRect(ctx, x, y, w, h, r) {
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.lineTo(x + w - r, y);
ctx.quadraticCurveTo(x + w, y, x + w, y + r);
ctx.lineTo(x + w, y + h - r);
ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
ctx.lineTo(x + r, y + h);
ctx.quadraticCurveTo(x, y + h, x, y + h - r);
ctx.lineTo(x, y + r);
ctx.quadraticCurveTo(x, y, x + r, y);
ctx.closePath();
ctx.fill();
}
function valueNoise(col, row, timeSec, speed, seed) {
var tt = timeSec * speed + hash01(col, row, seed) * 17;
var step = Math.floor(tt);
var f = tt - step;
var e = f * f * (3 - 2 * f);
var a = hash01(col, row, (step % 997) + seed * 11);
var b = hash01(col, row, ((step + 1) % 997) + seed * 11);
return a + (b - a) * e;
}
var mergeCache = null;
var mergeCacheKey = "";
function getMergeMap(cols, rows) {
var key = cols + "x" + rows;
if (mergeCache && mergeCacheKey === key) return mergeCache;
var map = new Uint8Array(cols * rows);
for (var r = 0; r < rows; r += 1) {
for (var c = 0; c < cols; c += 1) {
var i = r * cols + c;
if (map[i]) continue;
var h = hash01(c, r, 91);
if (h < 0.02 && c + 1 < cols && r + 1 < rows && !map[i + 1] && !map[i + cols] && !map[i + cols + 1]) {
map[i] = 1; map[i + 1] = 2; map[i + cols] = 2; map[i + cols + 1] = 2;
} else if (h < 0.06 && c + 1 < cols && !map[i + 1]) {
map[i] = 3; map[i + 1] = 2;
} else if (h < 0.08 && r + 1 < rows && !map[i + cols]) {
map[i] = 4; map[i + cols] = 2;
}
}
}
mergeCache = map;
mergeCacheKey = key;
return map;
}
function surfaceIsDark(win, doc) {
try {
var d = doc || (typeof document !== "undefined" ? document : null);
var w = win || (typeof window !== "undefined" ? window : globalRoot);
if (!d || !d.body || !w) return true;
var pt = d.documentElement && d.documentElement.getAttribute ? d.documentElement.getAttribute("data-ag-cs-theme") : "";
if (pt === "dark") return true;
if (pt === "light") return false;
if (d.documentElement && d.documentElement.classList.contains("dark")) return true;
if (d.body && d.body.classList.contains("dark")) return true;
var bg = (w.getComputedStyle && w.getComputedStyle(d.body).backgroundColor) || "";
var parts = bg.match(/[\d.]+/g);
if (!parts || parts.length < 3) return true;
if (parts.length > 3 && Number(parts[3]) < 0.5) return true;
var luminance = (0.2126 * Number(parts[0]) + 0.7152 * Number(parts[1]) + 0.0722 * Number(parts[2])) / 255;
return luminance < 0.5;
} catch (err) {
return true;
}
}
/**
* Claude 点阵绘制。intensity ∈ [0,1] 连续控制特效强度（中档约 0.35，最高档 1）：
* - 底晕 wash 透明度按 intensity 缩放；
* - 像素密度：按每格固定哈希做确定性稀疏剔除，intensity 越低保留越少（不会随帧闪烁）；
* - 像素亮度：整体 alpha 乘以 (0.45 + 0.55 * intensity)。
* intensity = 1 时三项系数均为 1，输出与旧版完全一致。
*/
function paintDither(ctx, w, h, dark, progress, timeSec, intensity) {
if (!ctx) return;
var _mx = Math.max, _mn = Math.min, _rd = Math.round, _fl = Math.floor, _pw = Math.pow, _PI2 = Math.PI * 2;
var strength = typeof intensity === "number" ? clamp01(intensity) : 1;
ctx.clearRect(0, 0, w, h);
if (strength <= 0 || w <= 0) return;
var keepRatio = strength >= 1 ? 1 : 0.25 + 0.75 * strength, alphaMul = 0.45 + 0.55 * strength;
var k = 1 - progress, s1 = _mx(0, _mn(1, k - 0.08)), s2 = _mx(s1, _mn(1, k + 0.18));
var wash = ctx.createLinearGradient(0, 0, w, 0);
var stops = dark
? [[0, "rgba(112,78,162,0)"], [s1, "rgba(112,78,162,0)"], [s2, "rgba(118,84,169,0.3)"], [1, "rgba(116,84,170,0.75)"]]
: [[0, "rgba(142,118,192,0)"], [s1, "rgba(142,118,192,0)"], [s2, "rgba(142,118,192,0.45)"], [1, "rgba(142,118,192,1)"]];
for (var si = 0; si < 4; si += 1) wash.addColorStop(stops[si][0], stops[si][1]);
ctx.globalAlpha = strength;
ctx.fillStyle = wash;
ctx.fillRect(0, 0, w, h);
var purple = dark ? "rgb(208,192,246)" : "rgb(150,130,205)";
var cell = h / 6 > 0 ? h / 6 : CLAUDE_CELL, cols = Math.ceil(w / cell), rows = 6;
for (var col = 0; col < cols; col += 1) {
var x = col * cell, t = clamp01(x / _mx(1, w)), fade = clamp01((t - 0.02) / 0.48);
for (var row = 0; row < rows; row += 1) {
if (keepRatio < 1 && hash01(col, row, 101) > keepRatio) continue;
var base = ditherAlphaAt(x, w, col, row) * alphaMul;
if (base < 0.05) continue;
var front = 1 - progress, edgeJit = (hash01(col, row, 31) - 0.5) * 0.05;
if (t < front + edgeJit) continue;
var appear = (0.35 + 0.65 * clamp01((t - front - edgeJit) / 0.04)) * (dark ? 1 : alphaMul);
var rowWaves = 3 + _fl(hash01(0, row, 47) * 5), rowSpeed = 5 + 10 * hash01(0, row, 43), rowPhase = hash01(0, row, 53) * _PI2;
var rowWaves2 = 2 + _fl(hash01(0, row, 61) * 4), rowSpeed2 = rowSpeed * (rowWaves2 / rowWaves), rowPhase2 = hash01(0, row, 71) * _PI2;
var u1 = ((t * rowWaves * _PI2 + timeSec * rowSpeed + rowPhase) / _PI2) % 1;
if (u1 < 0) u1 += 1;
var u2 = ((t * rowWaves2 * _PI2 + timeSec * rowSpeed2 + rowPhase2) / _PI2) % 1;
if (u2 < 0) u2 += 1;
var p1 = _pw(1 - u1, 2.6 + 3.4 * hash01(col, row, 17)), p2 = _pw(1 - u2, 3.4);
var pulse = _mx(p1, p2 * (0.55 + 0.45 * hash01(col, row, 19))) * 0.85;
var wAmt = clamp01(pulse * (0.35 + 0.65 * t)) * (0.55 + 0.45 * hash01(col, row, 71));
if (progress < 0.999) wAmt = _mx(wAmt, clamp01(1 - (t - front) / 0.16) * (0.55 + 0.45 * hash01(col, row, 73)));
if (!dark) {
var lt = clamp01((t - 0.05) / 0.2);
if (lt <= 0) continue;
var lmap = getMergeMap(cols, rows), mv = lmap[row * cols + col];
if (mv === 2 || hash01(col, row, 95) < 0.03) continue;
var y2 = row * cell, off = (hash01(col, row, 93) - 0.42) * (22 + 66 * t);
if (off > 0) off *= 1.1;
var lr = _mx(124, _mn(240, _rd(187 - 32 * t + off + 12 * pulse)));
var lg = _mx(100, _mn(232, _rd(184 - 46 * t + (off < 0 ? off : off * 1.05) + 12 * pulse)));
var lb = _mx(180, _mn(252, _rd(206 + 4 * t + (off < 0 ? off : off * 0.65) + 8 * pulse)));
var lw = cell * (mv === 3 || mv === 1 ? 2 : 1) * 0.88, lh = cell * (mv === 4 || mv === 1 ? 2 : 1) * 0.88;
var flicker = valueNoise(col, row, timeSec, 0.9, 83), density = clamp01((t - 0.12) / 0.35);
var presence = density > 0.9 ? 1 : clamp01((0.2 + 0.8 * density - flicker) / 0.2);
if (presence <= 0.01) continue;
var lAlpha = clamp01(lt * appear * presence * (0.7 + 0.3 * (1 - flicker)) * (0.85 + 0.15 * hash01(col, row, 29)));
ctx.globalAlpha = lAlpha;
ctx.fillStyle = "rgb(" + lr + "," + lg + "," + lb + ")";
fillRoundRect(ctx, x + 0.5, y2 + 0.5, lw, lh, 1);
if (wAmt > 0.03) {
ctx.globalAlpha = _mn(1, (lAlpha / alphaMul) * (0.12 + 0.88 * wAmt));
ctx.fillStyle = "rgb(247,243,255)";
var ins = lw * 0.14;
fillRoundRect(ctx, x + 0.5 + ins, y2 + 0.5 + ins, lw - ins * 2, lh - ins * 2, 0.7);
}
continue;
}
var flick = valueNoise(col, row, timeSec, 1.5, 5), gap = 0.6 + 0.4 * clamp01((flick - (1 - fade) * 0.5) / 0.3);
var vis = clamp01((t - 0.2) / 0.18), baseAlpha = 0.04 + 0.96 * vis + 0.06 * clamp01((flick - 0.5) / 0.5) * (1 - vis);
var gridAlpha = clamp01(base * baseAlpha * gap * appear * 1.15 * (0.9 + 0.1 * hash01(col, row, 29)));
if (gridAlpha < 0.008) continue;
var y = row * cell, size = cell * 0.72;
ctx.globalAlpha = _mn(1, gridAlpha * 0.55);
ctx.fillStyle = purple;
fillRoundRect(ctx, x + 0.5, y + 0.5, size, size, 1.1);
if (wAmt > 0.03) {
ctx.globalAlpha = _mn(1, (gridAlpha / alphaMul) * (0.1 + 0.72 * wAmt));
ctx.fillStyle = "rgb(220, 204, 255)";
fillRoundRect(ctx, x + 0.5, y + 0.5, size, size, 0.7);
}
}
}
ctx.globalAlpha = 1;
}
/**
* 根据档位列表自动推导能量起点与中点：
* - 若首档为 Off（如 4 档 Off / Low / High / Max），则第 1 档 (Low) 为纯蓝无星尘起点：
*   start = 1 / (count - 1), end = (start + 1) / 2
* - 若首档不是 Off（如 Antigravity 的 3 档 Low / Medium / High），则第 0 档 (Low) 为纯蓝起点：
*   start = 0, end = 0.5
*/
function energyStopsFor(levels) {
var list = Array.isArray(levels) ? levels : [];
var n = list.length;
if (n <= 1) return { start: 0, end: 0.5, hasOffFirst: false };
var first = list[0];
var firstLabel = first && typeof first === "object" ? (first.effort || first.label || first.id || "") : String(first || "");
var hasOffFirst = isOffLevel(firstLabel);
var start = hasOffFirst ? 1 / (n - 1) : 0;
var end = (start + 1) / 2;
return { start: start, end: end, hasOffFirst: hasOffFirst };
}
function energyForPct(pct, startOverride) {
var p = clamp01(pct);
var start = typeof startOverride === "number" && Number.isFinite(startOverride) ? clamp01(startOverride) : ENERGY_START;
if (p <= start || start >= 1) return 0;
return clamp01((p - start) / (1 - start));
}
/**
* 位置 → 粒子横穿速率倍数：
* Medium (energy=0.5) 对应 1×（约 3.0s 横穿），High/Max (energy=1.0) 对应 2×（约 1.5s 横穿），左端下限 0.35×
*/
function speedFor(pct, startOverride) {
var e = energyForPct(pct, startOverride);
return Math.min(MAX_SPEED_FACTOR, Math.max(0.35, 2 * e));
}
/**
* Claude 点阵特效强度（随位置连续变化，与 Codex 能量曲线同源）：
* energy=0 (Low) → 0 无特效；energy=0.5 (Medium) → ≈0.35 少量点阵；energy=1 (High) → 1 全量。
* 采用 e^1.5 曲线：低端起势柔和，靠近 High 时加速饱和。
*/
function claudeIntensityFor(pct, startOverride) {
var e = energyForPct(pct, startOverride);
if (e <= 0) return 0;
return Math.round(Math.pow(e, 1.5) * 1000) / 1000;
}
/**
* Claude 点阵流动速度倍率（以 High = 1 为基准）：Medium = 0.5（慢一倍），下限 0.175。
* 直接复用 Codex 的 speedFor（Medium 1× / High 2×）再除以 2 归一化。
*/
function claudeSpeedFor(pct, startOverride) {
return speedFor(pct, startOverride) / MAX_SPEED_FACTOR;
}
/** 位置 → 可见粒子数量（随能量从 0 渐增至 22 颗） */
function particleCountFor(pct, startOverride) {
return Math.round(energyForPct(pct, startOverride) * PARTICLES.length);
}
function starCountFor(pct, startOverride) {
return particleCountFor(pct, startOverride);
}
/**
* 第 index 颗粒子的亮度/大小系数（落在 [STARFIELD_MIN, 1]，越亮越大）：
* - 单参数调用 starBrightnessFor(indexOrStar)：返回该星固有亮度 [0.5, 1]
* - 双参数调用 starBrightnessFor(starOrIndex, energy)：当 energy 尚未达到该星出现序号时返回 0，已出现则返回固有亮度
*/
function starBrightnessFor(starOrIndex, energy) {
var idx = typeof starOrIndex === "number"
? starOrIndex
: (starOrIndex && typeof starOrIndex.id === "number" ? starOrIndex.id : 0);
var baseB = STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(idx, 61);
if (energy === undefined) {
return Math.round(baseB * 1000) / 1000;
}
var e = clamp01(energy);
var visibleCount = Math.round(e * PARTICLES.length);
if (e <= 0 || idx >= visibleCount) return 0;
return Math.round(baseB * 1000) / 1000;
}
/**
* 第 index 颗粒子从右向左横穿轨道的时长（秒）：
* 最高档约 1.5s、中档约 3.0s、低端约 8.6s，各星之间仅差 ±8% 防止追尾成团
*/
function starDurationFor(starOrIndex, speedFactor) {
var idx = typeof starOrIndex === "number"
? starOrIndex
: (starOrIndex && typeof starOrIndex.id === "number" ? starOrIndex.id : 0);
var speed = Math.min(
MAX_SPEED_FACTOR,
Math.max(0.35, typeof speedFactor === "number" && Number.isFinite(speedFactor) ? speedFactor : MAX_SPEED_FACTOR)
);
var spread = 1 - _SF_SPR + 2 * _SF_SPR * starHash01(idx, 29);
return (_SF_MEAN * MAX_SPEED_FACTOR) / speed * spread;
}
/**
* 第 index 颗粒子的负相位延迟（秒）：
* 按黄金比低差异序列铺开，只与粒子序号与当前周期有关，与当前可见颗数无关
*/
function starDelayFor(starOrIndex, duration) {
var idx = typeof starOrIndex === "number"
? starOrIndex
: (starOrIndex && typeof starOrIndex.id === "number" ? starOrIndex.id : 0);
var particle = PARTICLES[idx];
var phase = particle && typeof particle.phase === "number" ? particle.phase : 0;
var dur = typeof duration === "number" && duration > 0 ? duration : starDurationFor(idx, MAX_SPEED_FACTOR);
var jitter = starHash01(idx, 53) * 0.03;
return -((phase + jitter) % 1) * dur;
}
/**
* 星星层总不透明度：独立于星云层，保证中档 (energy=0.5) 也有 0.8 的清晰度，最高档为 1.0
*/
function starLayerOpacityFor(energyOrPct, startOverride) {
var e = typeof startOverride === "number" ? energyForPct(energyOrPct, startOverride) : clamp01(energyOrPct);
if (e <= 0) return 0;
return Math.round((0.6 + 0.4 * e) * 1000) / 1000;
}
function parseHexRgb(hex) {
var clean = String(hex || "").replace(/^#/, "");
var num = parseInt(clean, 16);
return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function mixHex(hexA, hexB, t) {
var ratio = clamp01(t);
var a = parseHexRgb(hexA);
var b = parseHexRgb(hexB);
var r = Math.round(a[0] + (b[0] - a[0]) * ratio);
var g = Math.round(a[1] + (b[1] - a[1]) * ratio);
var bl = Math.round(a[2] + (b[2] - a[2]) * ratio);
return (
"#" +
((1 << 24) | (r << 16) | (g << 8) | bl)
.toString(16)
.slice(1)
);
}
/**
* 填充区末端主色：
* - pct <= start          : #4d93f8 (Codex 纯蓝)
* - start < pct <= end    : #4d93f8 -> #9333ea (蓝紫过渡)
* - end < pct <= 1        : #9333ea -> #4c1d95 (深紫星云)
*/
var TONE_PAL = {
mono: ["#71717a", "#a1a1aa", "#d4d4d8", ""],
amber: ["#b45309", "#d97706", "#f59e0b", "#f59e0b"],
iris: ["#6d28d9", "#8b5cf6", "#a855f7", "#a78bfa"],
cobalt: ["#1d4ed8", "#2563eb", "#0284c7", "#38bdf8"]
};
function fillColorFor(pct, startOverride, endOverride, isClaude, accentOverride) {
var p = clamp01(pct);
var start = typeof startOverride === "number" && Number.isFinite(startOverride) ? startOverride : ENERGY_START;
var end = typeof endOverride === "number" && Number.isFinite(endOverride) ? endOverride : ENERGY_END;
var tone = accentOverride || resolvePrismAccentTone(null, null);
var tp = tone === "mono" || (!isClaude && TONE_PAL[tone]) ? TONE_PAL[tone] : isClaude ? ["#71717a", "#a78bfa", "#704ea2"] : ["#4d93f8", "#9333ea", "#4c1d95"];
if (p <= start + 1e-6) return tp[0];
if (p <= end + 1e-6) return mixHex(tp[0], tp[1], (p - start) / Math.max(1e-6, end - start));
return mixHex(tp[1], tp[2], (p - end) / Math.max(1e-6, 1 - end));
}
/**
* 填充区线性渐变背景：
* 让轨道左侧始终保留蓝色起点，随滑块向右推进依次展开蓝紫过渡与深紫星云
*/
function fillBackgroundFor(pct, startOverride, endOverride, isClaude, accentOverride) {
var p = clamp01(pct);
var start = typeof startOverride === "number" && Number.isFinite(startOverride) ? startOverride : ENERGY_START;
var end = typeof endOverride === "number" && Number.isFinite(endOverride) ? endOverride : ENERGY_END;
var tone = accentOverride || resolvePrismAccentTone(null, null);
if (tone === "mono") {
return p <= 0.05
? "rgba(161, 161, 170, 0.22)"
: "linear-gradient(90deg, rgba(113, 113, 122, 0.45) 0%, " + fillColorFor(p, start, end, false, "mono") + " 100%)";
}
if (isClaude) {
if (p <= 0.05) return "rgba(142, 118, 192, 0.15)";
return "linear-gradient(90deg, rgba(142, 118, 192, 0.25) 0%, " + fillColorFor(p, start, end, true, "follow") + " 100%)";
}
if (TONE_PAL[tone]) {
return "linear-gradient(90deg, " + TONE_PAL[tone][0] + " 0%, " + fillColorFor(p, start, end, false, tone) + " 100%)";
}
if (p <= start + 1e-6) return "#4d93f8";
var endColor = fillColorFor(p, start, end, false, "follow");
if (p <= end + 1e-6) {
var stopBlue = start > 0 ? Math.round((start / p) * 100) : 0;
if (stopBlue <= 0) {
return "linear-gradient(90deg, #4d93f8 0%, " + endColor + " 100%)";
}
return "linear-gradient(90deg, #4d93f8 0%, #4d93f8 " + stopBlue + "%, " + endColor + " 100%)";
}
var stopStart = start > 0 ? Math.round((start / p) * 100) : 0;
var stopMid = Math.round((end / p) * 100);
if (stopStart <= 0) {
return "linear-gradient(90deg, #4d93f8 0%, #9333ea " + stopMid + "%, " + endColor + " 100%)";
}
return (
"linear-gradient(90deg, #4d93f8 0%, #4d93f8 " +
stopStart +
"%, #9333ea " +
stopMid +
"%, " +
endColor +
" 100%)"
);
}
/**
* 档位文字着色：
* - 单档位锁定模型或 Off 档位保持官方默认灰（返回 ""）
* - Codex 风格：首档蓝 #4d93f8、中档蓝紫 #6c78f7、高档亮紫 #8b5cf6
* - Claude 风格：首档暖灰/柔紫 #94a3b8、中档紫罗兰 #a78bfa、高档亮淡紫 #c4b5fd
*/
function valueColorFor(label, index, count, isMax, hasOffFirst, isClaude, accentOverride) {
if (isOffLevel(label)) return "";
var n = Number(count) || 0;
if (n <= 1) return "";
var tone = accentOverride || resolvePrismAccentTone(null, null);
if (tone === "mono") return "";
var tp = !isClaude && TONE_PAL[tone];
var lo = isClaude ? "#94a3b8" : tp ? tp[1] : "#4d93f8";
var hi = isClaude ? "#c4b5fd" : tp ? tp[3] : "#8b5cf6";
if (isMax || index === n - 1) return hi;
var idx = typeof index === "number" && index >= 0 ? index : 0;
var first = hasOffFirst ? 1 : 0;
if (!tp && idx <= first) return lo;
if (isClaude && n === 3 && idx === 1) return "#a78bfa";
return mixHex(lo, hi, clamp01((idx - first) / Math.max(1, n - 1 - first)));
}
var FILL_RADIUS_CSS = KNOB_RADIUS + "px 0 0 " + KNOB_RADIUS + "px";
// ── 样式表注入（对齐 dsh-codex-effort-slider 右向左星尘横穿 + 星云扫光 + Antigravity 面板适配） ──
var SLIDER_CSS = "@keyframes ces-sweep{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}@keyframes ces-star-sweep{0%{transform:translate3d(0,0,0);opacity:0}6%{opacity:1}94%{opacity:1}100%{transform:translate3d(-100%,0,0);opacity:0}}.ces-inline{width:100%;box-sizing:border-box;padding-top:6px;user-select:none!important;-webkit-user-select:none!important}.ces-root,.ces-root:focus,.ces-root:focus-visible,.ces-root:focus-within{position:relative;width:100%;box-sizing:border-box;outline:none!important;outline-width:0!important;box-shadow:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-tap-highlight-color:transparent!important}.ces-track{position:relative;width:100%;height:28px;border-radius:999px;background:rgba(128,128,145,.18);box-shadow:inset 0 1px 2px rgba(0,0,0,.24),inset 0 0 0 1px rgba(255,255,255,.06);cursor:pointer;touch-action:none;box-sizing:border-box;transition:opacity .15s ease,box-shadow .2s ease}.ces-inline[data-energy='1'] .ces-track,.ces-root[data-energy='1'] .ces-track{box-shadow:0 0 calc(var(--ces-energy,0) * 16px) rgba(168,85,247,.5),inset 0 1px 2px rgba(0,0,0,.24)}.ces-inline[data-energy='0'] .ces-star,.ces-inline[data-energy='0'] .ces-energy__sweep,.ces-root[data-energy='0'] .ces-star,.ces-root[data-energy='0'] .ces-energy__sweep{animation-play-state:paused}.ces-track.is-locked{opacity:.45;cursor:not-allowed;filter:saturate(.25)}.ces-fill{position:absolute;top:0;left:0;bottom:0;width:var(--ces-fill,14px);border-radius:14px 0 0 14px;background:var(--ces-fill-bg,#4d93f8);pointer-events:none;will-change:width,background}.ces-energy{position:absolute;top:0;left:0;bottom:0;width:var(--ces-fill,14px);border-radius:14px 0 0 14px;overflow:hidden;pointer-events:none;opacity:var(--ces-energy,0);transition:opacity .2s ease;background:linear-gradient(90deg,#3b1178 0%,#6d28d9 30%,#9333ea 62%,#c084fc 100%)}.ces-energy__sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 18%,rgba(255,255,255,.3) 50%,transparent 82%);transform:translateX(100%);animation:ces-sweep 2.4s linear infinite;pointer-events:none}.ces-stars{position:absolute;top:0;left:0;bottom:0;width:var(--ces-fill,14px);border-radius:14px 0 0 14px;opacity:var(--ces-star-opacity,0);transition:opacity .2s ease;pointer-events:none;overflow:hidden}.ces-star{position:absolute;left:0;right:0;height:3px;margin-top:-1.5px;pointer-events:none;animation-name:ces-star-sweep;animation-timing-function:linear;animation-iteration-count:infinite}.ces-star__dot{position:absolute;left:100%;top:0;width:3px;height:3px;margin-left:-1.5px;border-radius:50%;background:#f5f3ff;box-shadow:0 0 5px rgba(216,180,254,.95);opacity:var(--ces-b,1);transform:scale(var(--ces-b,1))}.ces-ticks{position:absolute;inset:0;pointer-events:none}.ces-tick{position:absolute;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:rgba(255,255,255,.28);pointer-events:none;transition:background-color .12s ease}.ces-tick.is-on{background:rgba(255,255,255,.65)}.ces-tick.is-dim{background:rgba(255,255,255,.28)}.ces-knob{position:absolute;top:50%;left:var(--ces-fill,14px);width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.34),0 0 0 .5px rgba(0,0,0,.06);pointer-events:none;will-change:left}.ces-root[data-theme='claude'] .ces-stars,.ces-root[data-theme='claude'] .ces-energy,.ces-inline[data-theme='claude'] .ces-stars,.ces-inline[data-theme='claude'] .ces-energy{display:none!important}.ces-root[data-theme='claude'] .ces-track,.ces-inline[data-theme='claude'] .ces-track{height:28px;border-radius:999px;background:rgba(128,128,145,.16);box-shadow:inset 0 1px 2px rgba(0,0,0,.22),inset 0 0 0 1px rgba(255,255,255,.08)}.ces-root[data-theme='claude'][data-energy='1'] .ces-track,.ces-inline[data-theme='claude'][data-energy='1'] .ces-track{box-shadow:0 0 16px rgba(167,139,250,.45),inset 0 1px 2px rgba(0,0,0,.22)}.ces-root[data-theme='claude'] .ces-knob,.ces-inline[data-theme='claude'] .ces-knob{width:24px;height:30px;margin:-15px 0 0 -12px;border-radius:7px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 .5px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center}.ces-knob-notch{display:none;width:2px;height:10px;border-radius:999px;background:rgba(0,0,0,.28)}.ces-root[data-theme='claude'] .ces-knob-notch,.ces-inline[data-theme='claude'] .ces-knob-notch{display:block}.ces-claude-canvas{position:absolute;left:0;top:0;width:var(--ces-fill,0px);height:100%;border-radius:999px;display:none;pointer-events:none}.ces-root[data-theme='claude'][data-energy='1'] .ces-claude-canvas,.ces-inline[data-theme='claude'][data-energy='1'] .ces-claude-canvas{display:block}@keyframes ces-claude-rise{0%{transform:translateY(85%) scale(.96);opacity:0}55%{opacity:1}80%{transform:translateY(-6%) scale(1.01)}100%{transform:translateY(0) scale(1);opacity:1}}.ces-ag-effort-value.is-claude-changing,.ces-ag-effort-value.ces-text-rise{animation:ces-claude-rise .3s cubic-bezier(.2,.85,.25,1)}.ces-ag-effort-value.is-claude-changing.is-glowing,.ces-ag-effort-value.ces-text-rise.is-glowing{animation:ces-claude-rise .3s cubic-bezier(.2,.85,.25,1),ces-text-bloom .4s cubic-bezier(.16,1,.3,1) forwards}[data-testid='model-selector-panel'].ces-ag-panel-enhanced{max-height:26rem!important}.ces-ag-section,.ces-ag-section:focus,.ces-ag-section:focus-visible,.ces-ag-section *{outline:none!important;outline-width:0!important;user-select:none!important;-webkit-user-select:none!important;-webkit-tap-highlight-color:transparent!important}.ces-ag-section{display:flex;flex-direction:column;flex-shrink:0;width:100%;box-sizing:border-box}.ces-ag-effort-row{display:flex;flex-direction:column;width:100%;box-sizing:border-box;padding:6px 8px 8px;border-radius:6px;transition:box-shadow .2s ease,background-color .2s ease}.ces-ag-effort-row:hover{background-color:rgba(128,128,145,.08)}.ces-ag-effort-row[data-ces-max='true'],[data-ces-effort-row='true'][data-ces-max='true']{box-shadow:inset 0 0 0 1px rgba(139,92,246,.42),0 0 14px -4px rgba(139,92,246,.45)!important;background-color:rgba(139,92,246,.06)}.ces-ag-effort-head{display:flex;align-items:center;justify-content:space-between;width:100%;font-size:12px;line-height:16px}.ces-ag-effort-title{display:inline-flex;align-items:center;gap:6px;color:inherit;font-weight:500;opacity:.9}.ces-ag-effort-value{position:relative;z-index:1;display:inline-block;font-size:12px;font-weight:600;transition:color .15s ease}.ces-ag-effort-value::after{content:'';position:absolute;top:50%;left:50%;width:52px;height:26px;border-radius:999px;transform:translate(-50%,-50%) scale(.6);background:radial-gradient(ellipse at center,var(--ces-glow-color,rgba(168,85,247,.85)) 0%,var(--ces-glow-color,rgba(168,85,247,.45)) 45%,rgba(168,85,247,0) 75%);filter:blur(8px);pointer-events:none;opacity:0;z-index:-1}@keyframes ces-glow-flash{0%{opacity:.95;transform:translate(-50%,-50%) scale(.65);filter:blur(6px)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.15);filter:blur(8px)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5);filter:blur(14px)}}@keyframes ces-text-bloom{0%{text-shadow:0 0 8px var(--ces-glow-color,#c084fc)}30%{text-shadow:0 0 14px var(--ces-glow-color,#c084fc),0 0 3px #fff}100%{text-shadow:none}}.ces-ag-effort-value.is-glowing{animation:ces-text-bloom .4s cubic-bezier(.16,1,.3,1) forwards}.ces-ag-effort-value.is-glowing::after{animation:ces-glow-flash .4s cubic-bezier(.16,1,.3,1) forwards}@media (prefers-reduced-motion:reduce){.ces-panel-shaking,.ces-ag-effort-value.is-glowing,.ces-ag-effort-value.is-glowing::after,.ces-ag-effort-value.ces-text-rise,.ces-ag-effort-value.is-claude-changing{animation:none!important}}html[data-ces-slider-ready='1'] [role='menu']:has([data-testid='model-selector-effort-option']):not(:has([data-testid='model-selector-panel'])),html[data-ces-slider-ready='1'] div[role='presentation']:has(>[role='menu'] [data-testid='model-selector-effort-option']):not(:has([data-testid='model-selector-panel'])){display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}html[data-ces-slider-ready='1'] [role='menuitem']:has([data-testid='model-selector-effort-group'])>span.shrink-0:last-child{display:none!important}html[data-ces-slider-ready='1'] [role='menuitem']:has([data-testid='model-selector-effort-group'])>.group-hover\\:hidden{display:flex!important}[role='menuitem'][data-ces-model-selected='true']{background-color:rgba(128,128,145,.14)}.ces-set{position:fixed;z-index:2147483646;width:268px;padding:12px;border-radius:10px;background:rgba(24,24,28,.96);color:#f4f4f6;border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 32px rgba(0,0,0,.55);backdrop-filter:blur(12px);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;box-sizing:border-box;user-select:none}.ces-set-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08);font-weight:600;font-size:12.5px}.ces-set-ver{font-size:11px;font-weight:400;opacity:.55}.ces-set-group{margin-bottom:10px}.ces-set-label{margin-bottom:5px;font-size:11px;opacity:.72}.ces-set-opts{display:flex;gap:4px}.ces-set-opt{flex:1;padding:5px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#d4d4d8;font-size:11.5px;cursor:pointer;text-align:center;transition:all .12s ease}.ces-set-opt:hover{background:rgba(255,255,255,.1);color:#fff}.ces-set-opt.is-on{background:rgba(139,92,246,.28);border-color:rgba(139,92,246,.75);color:#fff;font-weight:600}.ces-set-actions{display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}.ces-set-btn{flex:1;padding:5px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e4e4e7;font-size:11px;cursor:pointer}.ces-set-btn:hover{background:rgba(255,255,255,.14)}[data-testid='model-selector-panel'] .ces-ag-section[data-effort-slot='true']{grid-template-rows:auto auto}[data-testid='model-selector-panel'] .ces-ag-section[data-effort-slot='true']>[role='separator']{grid-row:1;grid-column:1}[data-testid='model-selector-panel'] .ces-ag-section[data-effort-slot='true']>:is(.ces-ag-effort-row,[data-testid='orchestrator-effort-bar']){grid-row:2!important;grid-column:1!important}";
function installStyles(doc) {
var d = doc || (typeof document !== "undefined" ? document : null);
if (!d || !d.head) return null;
var existing = d.getElementById(STYLE_ELEMENT_ID);
if (existing) {
if (existing.textContent !== SLIDER_CSS) {
existing.textContent = SLIDER_CSS;
}
return existing;
}
var style = d.createElement("style");
style.id = STYLE_ELEMENT_ID;
style.textContent = SLIDER_CSS;
d.head.appendChild(style);
return style;
}
// ── 右键设置面板 ────────────────────────────────────────────────────────────
var SET_TITLE_I18N = { "zh-CN": "推理等级滑条设置", "zh-TW": "推理等級滑桿設定", yue: "推理等級滑桿設定", en: "Effort Slider", ja: "推論スライダー設定" };
function openSettingsPanel(options) {
var opts = options || {};
var doc = opts.document || (typeof document !== "undefined" ? document : null);
var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
if (!doc || !doc.body) return function () {};
installStyles(doc);
var langKey = getPrismRootAttr(doc, win, "data-ag-cs-lang") || "zh-CN";
var prev = doc.querySelector(".ces-set");
if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
var panel = doc.createElement("div");
panel.className = "ces-set";
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-label", SET_TITLE_I18N[langKey] || SET_TITLE_I18N["zh-CN"]);
var x = typeof opts.x === "number" ? opts.x : 120;
var y = typeof opts.y === "number" ? opts.y : 120;
var vw = (win && win.innerWidth) || 800;
var vh = (win && win.innerHeight) || 600;
var clampedLeft = Math.max(8, Math.min(vw - 276, x));
var clampedTop = Math.max(8, Math.min(vh - 230, y));
panel.style.left = clampedLeft + "px";
panel.style.top = clampedTop + "px";
var head = doc.createElement("div");
head.className = "ces-set-head";
var titleSpan = doc.createElement("span");
titleSpan.textContent = "推理等级滑条";
var verSpan = doc.createElement("span");
verSpan.className = "ces-set-ver";
verSpan.textContent = "v1.2.1";
head.appendChild(titleSpan);
head.appendChild(verSpan);
panel.appendChild(head);
var optButtons = [];
function refreshActiveButtons() {
var cur = readSettings(win);
for (var i = 0; i < optButtons.length; i += 1) {
var item = optButtons[i];
var isOn = cur[item.key] === item.value;
if (item.btn.classList) {
if (isOn) item.btn.classList.add("is-on");
else item.btn.classList.remove("is-on");
} else {
item.btn.className = isOn ? "ces-set-opt is-on" : "ces-set-opt";
}
item.btn.setAttribute("aria-pressed", isOn ? "true" : "false");
}
}
for (var sIdx = 0; sIdx < SETTINGS_SCHEMA.length; sIdx += 1) {
(function (schemaItem) {
var group = doc.createElement("div");
group.className = "ces-set-group";
var label = doc.createElement("div");
label.className = "ces-set-label";
label.textContent = schemaItem.label;
group.appendChild(label);
var row = doc.createElement("div");
row.className = "ces-set-opts";
for (var oIdx = 0; oIdx < schemaItem.options.length; oIdx += 1) {
(function (optionItem) {
var btn = doc.createElement("button");
btn.type = "button";
btn.className = "ces-set-opt";
btn.textContent = optionItem.label;
if (optionItem.hint) btn.title = optionItem.hint;
btn.addEventListener("click", function (ev) {
ev.stopPropagation();
var patch = {};
patch[schemaItem.key] = optionItem.value;
writeSettings(patch, win);
refreshActiveButtons();
});
optButtons.push({ key: schemaItem.key, value: optionItem.value, btn: btn });
row.appendChild(btn);
})(schemaItem.options[oIdx]);
}
group.appendChild(row);
panel.appendChild(group);
})(SETTINGS_SCHEMA[sIdx]);
}
var actions = doc.createElement("div");
actions.className = "ces-set-actions";
function _mkBtn(txt, fn) {
var b = doc.createElement("button");
b.type = "button"; b.className = "ces-set-btn"; b.textContent = txt;
b.addEventListener("click", function (ev) { ev.stopPropagation(); fn(b); });
actions.appendChild(b);
return b;
}
_mkBtn("复制诊断", function (b) {
try { win && win.navigator && win.navigator.clipboard && win.navigator.clipboard.writeText && win.navigator.clipboard.writeText(JSON.stringify(dumpTrace(win), null, 2)); } catch (e) {}
b.textContent = "已复制";
});
_mkBtn("恢复默认", function () { resetSettings(win); refreshActiveButtons(); });
var closeBtn = _mkBtn("关闭", function () { closePanel(); });
panel.appendChild(actions);
refreshActiveButtons();
var offSettings = onSettingsChange(function () { refreshActiveButtons(); }, win);
function closePanel() {
offSettings();
doc.removeEventListener("pointerdown", onDocPointerDown, true);
doc.removeEventListener("keydown", onDocKeyDown, true);
if (panel.parentNode) panel.parentNode.removeChild(panel);
}
function onDocPointerDown(ev) {
if (!panel.contains(ev.target)) {
closePanel();
}
}
function onDocKeyDown(ev) {
if (ev && ev.key === "Escape") {
ev.stopPropagation();
closePanel();
}
}
doc.addEventListener("pointerdown", onDocPointerDown, true);
doc.addEventListener("keydown", onDocKeyDown, true);
doc.body.appendChild(panel);
return closePanel;
}
function installSettingsUi(options) {
var opts = options || {};
var doc = opts.document || (typeof document !== "undefined" ? document : null);
var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
if (!doc) return { stop: function () {} };
var activeClose = null;
var longPressTimer = null;
var pressStartPos = null;
function isInsideSlider(target) {
if (!target || typeof target.closest !== "function") return null;
return target.closest(".ces-inline, .ces-root, .ces-ag-effort-row");
}
function clearLongPress() {
if (longPressTimer !== null) {
clearTimeout(longPressTimer);
longPressTimer = null;
}
pressStartPos = null;
}
function _open(x, y) {
if (activeClose) activeClose();
activeClose = openSettingsPanel({ document: doc, window: win, x: x || 120, y: y || 120 });
}
function onContextMenu(ev) {
if (!isInsideSlider(ev.target)) return;
ev.preventDefault(); ev.stopPropagation();
_open(ev.clientX, ev.clientY);
}
function onKeyDown(ev) {
var host = isInsideSlider(ev.target);
if (!host) return;
if (ev.key === "ContextMenu" || (ev.key === "F10" && ev.shiftKey)) {
ev.preventDefault(); ev.stopPropagation();
var rect = host.getBoundingClientRect ? host.getBoundingClientRect() : { left: 120, bottom: 120 };
_open(rect.left, rect.bottom + 4);
}
}
function onPointerDown(ev) {
if (!isInsideSlider(ev.target) || ev.button === 2) return;
clearLongPress();
pressStartPos = { x: ev.clientX || 0, y: ev.clientY || 0 };
longPressTimer = setTimeout(function () { longPressTimer = null; _open(pressStartPos && pressStartPos.x, pressStartPos && pressStartPos.y); }, 500);
}
function onPointerMove(ev) {
if (!pressStartPos || longPressTimer === null) return;
var dx = (ev.clientX || 0) - pressStartPos.x, dy = (ev.clientY || 0) - pressStartPos.y;
if (dx * dx + dy * dy > 36) clearLongPress();
}
var evs = [["contextmenu", onContextMenu], ["keydown", onKeyDown], ["pointerdown", onPointerDown], ["pointermove", onPointerMove], ["pointerup", clearLongPress], ["pointercancel", clearLongPress]];
evs.forEach(function (e) { doc.addEventListener(e[0], e[1], true); });
return {
stop: function () {
clearLongPress();
if (activeClose) { activeClose(); activeClose = null; }
evs.forEach(function (e) { doc.removeEventListener(e[0], e[1], true); });
}
};
}
// ── DOM 与 Antigravity React Fiber 解析辅助函数 ─────────────────────────────
var INFERENCE_LABELS = ["推理等级", "Reasoning effort", "Reasoning Effort", "Thinking effort", "推理强度"];
function parseModelLabel(label) {
if (!label || typeof label !== "string") return null;
var match = AG_MODEL_LABEL_RE.exec(label.trim());
if (!match) return null;
var base = match[1].trim();
var effort = match[2].toLowerCase();
// 兼容展示名 "(Extra)" 与内部枚举 "(xhigh)"，统一归并到 xhigh 槽位进行排序与着色
if (effort === "extra") effort = "xhigh";
return {
base: base,
effort: effort,
effortLabel: AG_EFFORT_LABELS[effort] || match[2]
};
}
function _isSubTrigger(el) {
return el && typeof el.closest === "function" && Boolean(el.closest('[data-testid="subagent-tab-conversation"]'));
}
function findAntigravityTrigger(doc) {
var d = doc || (typeof document !== "undefined" ? document : null);
if (!d) return null;
if (typeof d.querySelectorAll === "function") {
var list = d.querySelectorAll('[data-testid="model-selector-trigger"],button[aria-label^="Select model"]'), fb = null;
for (var i = 0; i < list.length; i += 1) {
var el = list[i];
if (!el || _isSubTrigger(el)) continue;
if (typeof el.checkVisibility === "function") {
try { if (!el.checkVisibility()) { if (!fb) fb = el; continue; } } catch (e) {}
}
return el;
}
if (fb) return fb;
}
if (typeof d.querySelector === "function") {
var q = d.querySelector('[data-testid="model-selector-trigger"]') || d.querySelector('button[aria-label^="Select model"]');
if (q && !_isSubTrigger(q)) return q;
}
return null;
}
function findAntigravityPanel(doc) {
var d = doc || (typeof document !== "undefined" ? document : null);
if (!d || typeof d.querySelector !== "function") return null;
return d.querySelector('[data-testid="model-selector-panel"]');
}
function findInferenceRow(doc) {
var d = doc || (typeof document !== "undefined" ? document : null);
if (!d || typeof d.querySelectorAll !== "function") return null;
var explicit = d.querySelector('[data-ces-effort-row="true"]');
if (explicit) return explicit;
var menus = d.querySelectorAll('[role="menu"], .surface-menu, [data-testid="model-selector-panel"]');
for (var mIdx = 0; mIdx < menus.length; mIdx += 1) {
var menu = menus[mIdx];
var items = menu.querySelectorAll('[role="menuitem"], .ces-ag-effort-row, div, button');
for (var i = 0; i < items.length; i += 1) {
var el = items[i];
var txt = (el.textContent || "").trim();
for (var k = 0; k < INFERENCE_LABELS.length; k += 1) {
var kw = INFERENCE_LABELS[k];
if (txt === kw || txt.indexOf(kw) === 0) {
return el.closest('[role="menuitem"]') || el;
}
}
}
}
return null;
}
function findValueElement(row) {
if (!row || typeof row.querySelector !== "function") return null;
var ex = row.querySelector('[data-ces-part="value"], .ces-ag-effort-value');
if (ex) return ex;
var ch = row.querySelectorAll("span, div"), cand = null;
for (var i = 0; i < ch.length; i += 1) {
var c = ch[i], t = (c.textContent || "").trim();
if (!t || (c.closest && c.closest(".ces-inline")) || (c.children && c.children.length)) continue;
if (INFERENCE_LABELS.indexOf(t) < 0) cand = c;
}
return cand;
}
function findEffortTrigger(doc) {
var d = doc || (typeof document !== "undefined" ? document : null);
if (!d || typeof d.querySelectorAll !== "function") return null;
var ag = findAntigravityTrigger(d);
if (ag) return ag.querySelector("span.opacity-70, [data-ces-part='trigger-effort']") || ag;
var cs = d.querySelectorAll(".surface-composer, .surface-composer-card, form, body");
for (var i = 0; i < cs.length; i += 1) {
var bs = cs[i].querySelectorAll('button[aria-haspopup="menu"]');
for (var j = 0; j < bs.length; j += 1) if ((bs[j].textContent || "").indexOf(" · ") >= 0) return bs[j];
}
return null;
}
function syncTriggerColor(doc, label, index, count, isMax, hasOffFirst, isClaude) {
var d = doc || (typeof document !== "undefined" ? document : null);
if (!d) return;
var ag = findAntigravityTrigger(d);
var cf = typeof isClaude === "boolean" ? isClaude : isClaudeModel(ag ? ag.textContent : "");
var col = valueColorFor(label, index, count, isMax, hasOffFirst, cf, resolvePrismAccentTone(d, null));
if (ag) {
var sp = ag.querySelector("span.opacity-70, [data-ces-part='trigger-effort']");
if (sp) {
sp.setAttribute("data-ces-part", "trigger-effort");
sp.style.color = col || "";
sp.style.opacity = col ? "1" : "";
sp.style.fontWeight = col ? "600" : "";
}
return;
}
var tr = findEffortTrigger(d);
if (!tr) return;
var sps = tr.querySelectorAll("span");
(sps.length ? sps[sps.length - 1] : tr).style.color = col || "";
}
function findSeatEffort(win) {
var map = (win || (typeof window !== "undefined" ? window : globalRoot));
map = map && map.__dshSeats;
if (!map || typeof map.forEach !== "function") return null;
var found = null;
map.forEach(function (s) { if (!found && s && Array.isArray(s.effortLevels)) found = s; });
return found;
}
function getReactFiber(el) {
if (!el || typeof el !== "object") return null;
var raw = null, ks = Object.keys(el);
for (var i = 0; i < ks.length; i += 1) if (ks[i].indexOf("__reactFiber$") === 0 || ks[i].indexOf("__reactInternalInstance$") === 0) { raw = el[ks[i]]; break; }
if (!raw) return null;
if (raw.alternate) {
var root = raw, g = 0;
while (root.return && g < 80) { root = root.return; g += 1; }
if (root && root.stateNode && root.stateNode.current && root.stateNode.current !== root) return raw.alternate;
}
return raw;
}
function _slug(s) {
return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function _isOrch(m) {
if (!m) return false;
if (typeof m === "string") return /\borchestrator\b|编排/i.test(m);
return /\borchestrator\b|编排/i.test(String(m.label || "")) || /orchestrator/i.test(String(m.modelId || ""));
}
function buildEffortIndexFromOptions(list) {
var out = new Map();
if (!Array.isArray(list)) return out;
for (var i = 0; i < list.length; i += 1) {
var o = list[i];
if (!o || o.isCustom || typeof o.label !== "string" || _isOrch(o)) continue;
var p = parseModelLabel(o.label);
if (!p) continue;
var m = out.get(p.base);
if (!m) { m = new Map(); out.set(p.base, m); }
if (!m.has(p.effort)) m.set(p.effort, o);
}
return out;
}
function normalizeEffortIndex(raw, opts) {
var out = buildEffortIndexFromOptions(opts);
if (!(raw instanceof Map)) return out;
raw.forEach(function (inn, rk) {
if (!(inn instanceof Map) || !inn.size) return;
var db = "";
inn.forEach(function (o) {
if (db || !o || typeof o.label !== "string") return;
var p = parseModelLabel(o.label);
if (p && p.base) db = p.base;
});
var k = db || String(rk || "");
if (!k) return;
var mg = out.get(k) || new Map();
inn.forEach(function (o, ek) {
var nk = String(ek || "").toLowerCase();
if (nk === "extra") nk = "xhigh";
if (nk && o && !mg.has(nk)) mg.set(nk, o);
});
if (mg.size) out.set(k, mg);
});
return out;
}
function _luEff(idx, base) {
if (!base || !(idx instanceof Map)) return null;
var d = idx.get(base);
if (d instanceof Map && d.size) return d;
var w = _slug(base), hit = w ? idx.get(w) : null;
if (!(hit instanceof Map && hit.size) && w) { hit = null; idx.forEach(function (v, k) { if (!hit && v instanceof Map && v.size && _slug(k) === w) hit = v; }); }
return hit;
}
function _resOrch(ctx, ovr) {
var pk = ctx && (ctx.orchPick || ctx.orchestratorPick), ps = ctx && (ctx.orchPlanners || ctx.orchestratorPlanners);
if (!pk || typeof pk.select !== "function" || !Array.isArray(ps) || !ps.length) return null;
var f = function (r) {
if (!r) return null;
if (typeof r === "object" && typeof r.label === "string") return r;
for (var i = 0; i < ps.length; i += 1) if (ps[i] && (ps[i].value === r || ps[i].modelId === r || ps[i].label === r)) return ps[i];
return null;
};
var def = f(ctx.orchDef || ctx.orchestratorDefaultPlanner) || ps[0] || null;
var act = f(ovr) || f(pk.model) || def;
var oi = ctx.orchIdx || ctx.orchestratorPlannerIndex;
return act ? { opt: act, def: def, idx: oi instanceof Map && oi.size ? oi : ctx.effortIndex } : null;
}
/**
* 从 Antigravity 的 DOM 节点向上遍历 React Fiber 树，提取：
* - OXb.Provider: effortIndex, modelOptions, selectedModel, groups
* - $Xb         : 未包装 setIsOpen(false) 的 setSelectedModel, open, setIsOpen
* - cYb         : conversationId
* - eKa.Provider: setModelConfigByLabelForConversation（直接切档不关菜单、不抢焦点）
*/
function _rdAgFiber(el) {
var startFiber = getReactFiber(el);
if (!startFiber) return null;
var selectorCtx = null;
var innerPopoverProps = null;
var outerPopoverProps = null;
var conversationId = undefined;
var hasConversationSelector = false;
var globalModelCtx = null;
var cur = startFiber;
for (var step = 0; cur && step < 500; step += 1, cur = cur.return) {
var props = cur.memoizedProps;
if (!props || typeof props !== "object") continue;
// 1. OXb.Provider / WJc.Provider (ModelSelectorProvider)
if (!selectorCtx && props.value && typeof props.value === "object") {
var val = props.value;
if (val.effortIndex instanceof Map && Array.isArray(val.modelOptions)) {
selectorCtx = val;
}
}
// 2. $Xb / hKc / XJc (ModelSelectorPopover 及其各层包装)
if (
typeof props.setIsOpen === "function" &&
typeof props.setSelectedModel === "function" &&
Array.isArray(props.modelOptions)
) {
if (!innerPopoverProps) innerPopoverProps = props;
outerPopoverProps = props;
}
// 3. cYb / kKc (ConversationModelSelector)
if (!hasConversationSelector && ("conversationId" in props) && ("placement" in props)) {
hasConversationSelector = true;
conversationId = props.conversationId;
}
// 4. eKa.Provider (Global Model Context，在 Antigravity Web 中通常位于 ~170 层 Fiber 高度)
if (
!globalModelCtx &&
props.value &&
typeof props.value === "object" &&
typeof props.value.setModelConfigByLabelForConversation === "function"
) {
globalModelCtx = props.value;
}
if (selectorCtx && outerPopoverProps && hasConversationSelector && globalModelCtx) {
break;
}
}
if (!selectorCtx && !innerPopoverProps && !outerPopoverProps && !globalModelCtx) return null;
var modelOptions =
(outerPopoverProps && outerPopoverProps.modelOptions) ||
(innerPopoverProps && innerPopoverProps.modelOptions) ||
(selectorCtx && selectorCtx.modelOptions) ||
(globalModelCtx && globalModelCtx.visibleModelConfigs) ||
[];
var selectedModel =
(outerPopoverProps && outerPopoverProps.selectedModel) ||
(innerPopoverProps && innerPopoverProps.selectedModel) ||
(selectorCtx && selectorCtx.selectedModel) ||
(globalModelCtx &&
(hasConversationSelector && typeof globalModelCtx.getModelConfigForConversation === "function"
? globalModelCtx.getModelConfigForConversation(conversationId)
: globalModelCtx.currentModelConfig)) ||
null;
var _fn = function (o, k) { return o && typeof o[k] === "function" ? o[k] : null; };
var sc = selectorCtx, op = outerPopoverProps, ip = innerPopoverProps, gm = globalModelCtx;
var orchPlanners = sc && Array.isArray(sc.orchestratorPlanners) ? sc.orchestratorPlanners : [];
return {
effortIndex: normalizeEffortIndex(sc && sc.effortIndex, modelOptions),
modelOptions: modelOptions,
selectedModel: selectedModel,
orchPlanners: orchPlanners,
orchIdx: normalizeEffortIndex(sc && sc.orchestratorPlannerIndex, orchPlanners),
orchDef: (sc && sc.orchestratorDefaultPlanner) || null,
orchPick: sc && sc.orchestratorPick && typeof sc.orchestratorPick === "object" ? sc.orchestratorPick : null,
groups: (sc && sc.groups) || [],
conversationId: conversationId,
hasConversationSelector: hasConversationSelector,
setModelConfigByLabelForConversation: _fn(gm, "setModelConfigByLabelForConversation"),
setCurrentModelConfigByLabel: _fn(gm, "setCurrentModelConfigByLabel"),
unwrappedSetSelectedModel: _fn(op, "setSelectedModel") || _fn(ip, "setSelectedModel") || _fn(sc, "setSelectedModel"),
setIsOpen: _fn(op, "setIsOpen") || _fn(ip, "setIsOpen") || _fn(sc, "setIsOpen"),
isOpen: Boolean((op && op.open) || (ip && ip.open))
};
}
function resolveModelEffortProfile(ctx, targetModelOrBase, _effMap, planOvr) {
if (!ctx) return null;
var selected = ctx.selectedModel, modelObj = null, baseName = "", activeEffort = "";
if (typeof targetModelOrBase === "string" && targetModelOrBase) baseName = targetModelOrBase;
else if (targetModelOrBase && typeof targetModelOrBase === "object") modelObj = targetModelOrBase;
else modelObj = selected;
var isOrch = _isOrch(modelObj || baseName), idx = ctx.effortIndex, orchTune = false;
if (isOrch) {
var pi = _resOrch(ctx, planOvr);
if (pi && pi.opt) { modelObj = pi.opt; idx = pi.idx || ctx.effortIndex; orchTune = true; }
}
if (modelObj && typeof modelObj.label === "string") {
var parsed = parseModelLabel(modelObj.label);
if (parsed) { baseName = parsed.base; activeEffort = parsed.effort; }
else baseName = modelObj.label;
}
var byEffort = _luEff(idx, baseName);
if (byEffort && byEffort.size >= 2) {
var sortedKeys = [];
for (var i = 0; i < AG_EFFORT_ORDER.length; i += 1) {
var key = AG_EFFORT_ORDER[i];
if (byEffort.has(key)) sortedKeys.push(key);
}
if (!activeEffort) {
if (_effMap && _effMap.has(baseName)) {
var remembered = _effMap.get(baseName);
if (byEffort.has(remembered)) activeEffort = remembered;
}
if (!activeEffort) {
var selParsed = selected && parseModelLabel(selected.label);
if (selParsed && selParsed.base === baseName && byEffort.has(selParsed.effort)) activeEffort = selParsed.effort;
else if (byEffort.has("medium")) activeEffort = "medium";
else activeEffort = sortedKeys[0] || "";
}
}
var levels = sortedKeys.map(function (k) { return { effort: k, label: AG_EFFORT_LABELS[k] || k, modelOption: byEffort.get(k) }; });
var currentIndex = Math.max(0, sortedKeys.indexOf(activeEffort));
var isClaude = isClaudeModel(baseName);
return {
baseName: baseName, isOrchestrator: isOrch, orchestratorTunable: orchTune,
isClaude: isClaude, theme: isClaude ? "claude" : "codex", locked: false, levels: levels,
currentIndex: currentIndex, currentEffort: sortedKeys[currentIndex] || activeEffort,
currentLabel: AG_EFFORT_LABELS[sortedKeys[currentIndex]] || activeEffort,
modelOption: byEffort.get(sortedKeys[currentIndex]) || modelObj
};
}
var sP = modelObj && parseModelLabel(modelObj.label), sE = sP ? sP.effort : "medium";
var sL = sP ? sP.effortLabel : (getPrismRootAttr(null, null, "data-ag-cs-lang") === "en" ? "Fixed" : "固定");
var sC = isClaudeModel(baseName || (modelObj && modelObj.label));
return {
baseName: baseName || (modelObj && modelObj.label) || "", isOrchestrator: isOrch, orchestratorTunable: false,
isClaude: sC, theme: sC ? "claude" : "codex", locked: true,
levels: [{ effort: sE, label: sL, modelOption: modelObj }],
currentIndex: 0, currentEffort: sE, currentLabel: sL, modelOption: modelObj
};
}
function _commitAgOpt(ctx, targetOption, isOrchPlan) {
if (!ctx || !targetOption || !targetOption.label) return false;
try {
var pk = ctx.orchPick || ctx.orchestratorPick;
if (isOrchPlan && pk && typeof pk.select === "function") {
var def = ctx.orchDef || ctx.orchestratorDefaultPlanner;
pk.select(def && def.value === targetOption.value ? 0 : targetOption.value);
if (typeof ctx.setIsOpen === "function") { try { ctx.setIsOpen(true); } catch (e) {} }
return true;
}
// 优先调用 eKa.Provider 的 setModelConfigByLabelForConversation：
// 直接更新当前会话与全局默认模型，不触发 $Xb 的 setIsOpen(false) 关菜单，也不触发编辑器抢焦点
if (typeof ctx.setModelConfigByLabelForConversation === "function") {
ctx.setModelConfigByLabelForConversation(targetOption.label, ctx.conversationId, true);
return true;
}
if (typeof ctx.unwrappedSetSelectedModel === "function") {
var d = typeof document !== "undefined" ? document : null, ed = d && d.querySelector ? d.querySelector('[contenteditable="true"]') : null;
var prevFocus = d && d.activeElement, onFocus = function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ed && typeof ed.blur === "function") { try { ed.blur(); } catch (e) {} } };
if (ed && typeof ed.addEventListener === "function") ed.addEventListener("focus", onFocus, true);
try {
ctx.unwrappedSetSelectedModel(targetOption);
if (ed && d && d.activeElement === ed && typeof ed.blur === "function") {
try { ed.blur(); } catch (e) {}
if (prevFocus && prevFocus !== ed && typeof prevFocus.focus === "function") { try { prevFocus.focus(); } catch (e) {} }
}
} finally {
if (ed && typeof ed.removeEventListener === "function") ed.removeEventListener("focus", onFocus, true);
}
if (typeof ctx.setIsOpen === "function") { try { ctx.setIsOpen(true); } catch (e) {} }
return true;
}
if (typeof ctx.setCurrentModelConfigByLabel === "function") {
ctx.setCurrentModelConfigByLabel(targetOption.label);
return true;
}
} catch (err) {
tracePush("ag-commit-error", { message: String(err && err.message ? err.message : err) });
}
return false;
}
// ── 核心滑条挂载器（零外部框架依赖，纯 DOM + 连续物理帧循环） ─────────────────
function extractEffortKey(item) {
if (item === null || item === undefined) return "";
if (typeof item === "string") return item;
if (typeof item === "object") {
return String(item.effort || item.id || item.value || item.key || item.label || "");
}
return String(item);
}
function _extEffLbl(item, effortKey, seat) {
if (item && typeof item === "object" && typeof item.label === "string" && item.label) {
return item.label;
}
if (seat && typeof seat.formatEffortLabel === "function") {
try {
var formatted = seat.formatEffortLabel(effortKey);
if (formatted) return String(formatted);
} catch (err) {
// 忽略格式化异常
}
}
var lower = String(effortKey || "").toLowerCase();
if (AG_EFFORT_LABELS[lower]) return AG_EFFORT_LABELS[lower];
return String(effortKey || "");
}
var EFFORT_TITLE_I18N = {
"zh-CN": "推理等级",
"zh-TW": "推理等級",
"yue": "推理等級",
"en": "Reasoning Effort",
"ja": "推論レベル"
};
function resolveEffortTitle(doc, win) {
var lang = getPrismRootAttr(doc, win, "data-ag-cs-lang") || "zh-CN";
try {
var loc = (win && win.__agCsLocales) || (globalRoot && globalRoot.__agCsLocales);
var ui = loc && typeof loc.getUiStrings === "function" ? loc.getUiStrings(lang) : null;
if (ui && ui.effortTitle) return String(ui.effortTitle);
} catch (e) {}
return EFFORT_TITLE_I18N[lang] || EFFORT_TITLE_I18N["zh-CN"];
}
function _clrAgDom(doc) {
if (!doc || typeof doc.querySelectorAll !== "function") return;
var spans = doc.querySelectorAll('[data-ces-part="trigger-effort"], [data-testid="model-selector-trigger"] span[style]');
for (var i = 0; i < spans.length; i += 1) {
var sp = spans[i];
if (sp.style) { sp.style.color = ""; sp.style.opacity = ""; sp.style.fontWeight = ""; }
if (typeof sp.removeAttribute === "function") sp.removeAttribute("data-ces-part");
}
var panels = doc.querySelectorAll(".ces-ag-panel-enhanced");
for (var p = 0; p < panels.length; p += 1) {
if (panels[p].classList) panels[p].classList.remove("ces-ag-panel-enhanced");
}
var items = doc.querySelectorAll("[data-ces-model-selected]");
for (var m = 0; m < items.length; m += 1) items[m].removeAttribute("data-ces-model-selected");
}
function mountCodexEffortSlider(options) {
var opts = options || {};
var container = opts.container;
var seat = opts.seat;
var doc = opts.document || (container && container.ownerDocument) || (typeof document !== "undefined" ? document : null);
var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
if (!container || !doc) {
return { unmount: function () {}, refresh: function () {} };
}
installStyles(doc);
// 清空宿主容器并构建 DOM 树（对齐 dsh-codex-effort-slider 四层结构：fill / energy+sweep / stars+dot / knob）
container.innerHTML = "";
function _ce(tag, cls, part, parent) {
var el = doc.createElement(tag);
if (cls) el.className = cls;
if (part) el.setAttribute("data-ces-part", part);
if (parent) parent.appendChild(el);
return el;
}
var rootEl = _ce("div", "ces-root");
rootEl.setAttribute("role", "slider");
rootEl.setAttribute("aria-label", resolveEffortTitle(doc, win));
var trackEl = _ce("div", "ces-track", "track", rootEl);
var fillEl = _ce("div", "ces-fill", "fill", trackEl);
var energyEl = _ce("div", "ces-energy", "energy", trackEl);
_ce("div", "ces-energy__sweep", "sweep", energyEl);
var starsEl = _ce("div", "ces-stars", "stars", trackEl);
var starNodes = [];
for (var sIdx = 0; sIdx < PARTICLES.length; sIdx += 1) {
var p = PARTICLES[sIdx];
var starEl = _ce("span", "ces-star", "star", starsEl);
starEl.style.top = p.y + "%";
starEl.style.display = "none";
var dotEl = _ce("span", "ces-star__dot", "particle", starEl);
var bStr = p.brightness.toFixed(3);
dotEl.setAttribute("data-brightness", bStr);
dotEl.style.setProperty("--ces-b", bStr);
starNodes.push({ el: starEl, dot: dotEl, meta: p });
}
var ticksEl = _ce("div", "ces-ticks", "ticks", trackEl);
var claudeCanvasEl = _ce("canvas", "ces-claude-canvas", "claude-canvas", trackEl);
claudeCanvasEl.width = 280;
claudeCanvasEl.height = 28;
var knobEl = _ce("div", "ces-knob", "knob", trackEl);
_ce("div", "ces-knob-notch", null, knobEl);
container.appendChild(rootEl);
// ── 内部状态机 ──────────────────────────────────────────────────────────
var destroyed = false;
var rafId = null;
var lastFrameMs = 0;
var claudeRafId = null;
var claudeAnimStart = 0;
// 点阵流动相位（秒）：按「帧间隔 × 当前速度倍率」累加，而不是 elapsed × 倍率，
// 这样拖动中速度连续变化时波纹不会因倍率突变而跳帧/倒退
var claudeFlowTime = 0;
var claudeLastTs = 0;
// 当前位置对应的强度与速度（由 applyVisualPct 每次刷新，RAF 循环读取）
var claudeIntensity = 0;
var claudeSpeed = 0;
var dragging = false;
var buttonDown = false;
var draftPct = null;
var draftIndex = null;
var snapIndex = null;
var detentIndex = -1;
var _lastCmtIdx = -1;
var lastPtrPct = null;
var lastPtrMs = 0;
var ptrSpeed = 0;
var motionState = null;
var tickNodes = [];
var _lastTicks = -1;
var _lastEng = -1;
var _lastSlow = -1;
function nowMs() {
if (win && win.performance && typeof win.performance.now === "function") {
return win.performance.now();
}
return Date.now();
}
function readSeatSnapshot() {
var rawLevels = (seat && Array.isArray(seat.effortLevels) ? seat.effortLevels : []).slice();
var levels = rawLevels.map(function (item) {
var key = extractEffortKey(item);
return {
raw: item,
effort: key,
label: _extEffLbl(item, key, seat)
};
});
var count = levels.length;
var curEffort = extractEffortKey(seat && seat.currentEffort);
var officialIndex = 0;
for (var i = 0; i < count; i += 1) {
if (String(levels[i].effort).toLowerCase() === String(curEffort).toLowerCase()) {
officialIndex = i;
break;
}
}
var locked = Boolean((seat && seat.locked) || count <= 1);
var stops = energyStopsFor(levels);
var baseName = (seat && seat.baseName) || (seat && seat.modelName) || "";
var isClaude = Boolean((seat && seat.isClaude) || isClaudeModel(baseName));
var theme = (seat && seat.theme) || (isClaude ? "claude" : "codex");
return {
baseName: baseName,
isClaude: isClaude,
theme: theme,
levels: levels,
count: count,
officialIndex: officialIndex,
locked: locked,
energyStart: stops.start,
energyEnd: stops.end,
hasOffFirst: stops.hasOffFirst
};
}
function currentShownIndex(snap) {
if (dragging && draftIndex !== null) return draftIndex;
if (snapIndex !== null) return snapIndex;
return snap.officialIndex;
}
function ensureMotion(snap) {
if (!motionState) {
var initPct = pctFromIndex(currentShownIndex(snap), snap.count);
motionState = {
x: initPct,
v: 0,
a: 0,
target: initPct
};
}
return motionState;
}
function _sa(el, k, v) { if (el && typeof el.setAttribute === "function" && el.getAttribute(k) !== v) el.setAttribute(k, v); }
function _rowEl() {
return opts.row || (container.closest && container.closest('.ces-ag-effort-row,[data-ces-effort-row="true"],[role="menuitem"]'));
}
function _syncHeadTrig(snap, showIdx) {
var count = snap.count;
var safeIdx = Math.max(0, Math.min(Math.max(0, count - 1), showIdx));
var levelItem = snap.levels[safeIdx];
var label = levelItem ? levelItem.label : "";
var isMax = !snap.locked && count > 1 && safeIdx === count - 1 && !isOffLevel(label);
var rowEl = _rowEl();
if (rowEl) {
_sa(rowEl, "data-ces-effort-row", "true");
if (isMax) _sa(rowEl, "data-ces-max", "true");
else if (rowEl.hasAttribute("data-ces-max")) rowEl.removeAttribute("data-ces-max");
}
var valEl = opts.valueElement || (rowEl && findValueElement(rowEl));
if (valEl) {
// Track the last logical effort label rendered instead of comparing live
// valEl.textContent, so external i18n scripts (e.g. "Medium" -> "中")
// won't cause an overwrite <-> re-translate loop and repeated rise animations.
var hadLastLabel = typeof valEl.__cesLastLabel === "string";
var logicalChanged = Boolean(label) && valEl.__cesLastLabel !== label;
if (logicalChanged) {
valEl.__cesLastLabel = label;
if (valEl.textContent !== label) {
valEl.textContent = label;
}
// 无论是 Claude 还是 Codex (Argon / Flash)，文字切换时统一触发顺滑向上翻转动效
if (hadLastLabel && !prefersReducedMotion(win)) {
if (valEl.__cesRiseTimer) {
clearTimeout(valEl.__cesRiseTimer);
valEl.__cesRiseTimer = null;
}
valEl.classList.remove("ces-text-rise");
valEl.classList.remove("is-claude-changing");
void valEl.offsetWidth;
valEl.classList.add("ces-text-rise");
valEl.classList.add("is-claude-changing");
valEl.__cesRiseTimer = setTimeout(function () {
if (valEl && valEl.classList) {
valEl.classList.remove("ces-text-rise");
valEl.classList.remove("is-claude-changing");
}
valEl.__cesRiseTimer = null;
}, 320);
}
}
var vColor = snap.locked ? "" : valueColorFor(label, safeIdx, count, isMax, snap.hasOffFirst, snap.isClaude, resolvePrismAccentTone(doc, win)) || "";
if (valEl.style && valEl.style.color !== vColor) {
valEl.style.color = vColor;
}
}
syncTriggerColor(doc, label, safeIdx, count, isMax, snap.hasOffFirst, snap.isClaude);
if (typeof opts.onVisualChange === "function") {
try {
opts.onVisualChange({
index: safeIdx,
count: count,
label: label,
effort: levelItem ? levelItem.effort : "",
isMax: isMax,
locked: snap.locked
});
} catch (err) {
// 忽略外部视觉回调错误
}
}
}
function renderTicks(snap, effectivePct) {
var settings = readSettings(win);
var tickMode = settings.ticks || "highlight";
var count = snap.count;
if (tickMode === "hidden" || count <= 1) {
if (ticksEl.style.display !== "none") {
ticksEl.style.display = "none";
}
return;
}
if (ticksEl.style.display !== "") {
ticksEl.style.display = "";
}
if (_lastTicks !== count) {
ticksEl.innerHTML = "";
tickNodes = [];
for (var i = 0; i < count; i += 1) {
var tick = doc.createElement("span");
tick.className = "ces-tick";
tick.setAttribute("data-ces-part", "tick");
var tickPct = pctFromIndex(i, count);
tick.style.left = knobOffsetOf(tickPct, KNOB_RADIUS);
ticksEl.appendChild(tick);
tickNodes.push({ el: tick, pct: tickPct });
}
_lastTicks = count;
}
for (var j = 0; j < tickNodes.length; j += 1) {
var node = tickNodes[j];
var reached = effectivePct + 1e-4 >= node.pct;
var nextTickClass = tickMode === "dim" ? "ces-tick is-dim" : reached ? "ces-tick is-on" : "ces-tick";
if (node.el.className !== nextTickClass) {
node.el.className = nextTickClass;
}
}
}
var cachedTrackRect = null;
var cachedTrackRectAt = 0;
var cachedSurfaceDark = true;
var cachedSurfaceDarkAt = 0;
var lastClaudePaintAt = 0;
function _stopClRaf() {
if (claudeRafId !== null && win && typeof win.cancelAnimationFrame === "function") {
win.cancelAnimationFrame(claudeRafId);
}
claudeRafId = null;
cachedTrackRect = null;
cachedTrackRectAt = 0;
lastClaudePaintAt = 0;
}
function stepClaudeCanvas(nowTs) {
claudeRafId = null;
if (destroyed) return;
if (doc && doc.hidden) {
_stopClRaf();
return;
}
var snap = readSeatSnapshot();
// 强度归零（回到 Low / 切走 Claude / 锁定）即停止循环，零冗余开销
if (!snap.isClaude || snap.locked || claudeIntensity <= 0) {
_stopClRaf();
return;
}
var now = typeof nowTs === "number" && nowTs > 0 ? nowTs : nowMs();
// 高刷屏限频至 ~60fps（15.5ms），避免 180Hz/300Hz 下重复逐像素重绘 Canvas，60Hz 丝滑度 100% 一致
if (lastClaudePaintAt > 0 && now - lastClaudePaintAt < 15.5) {
if (win && typeof win.requestAnimationFrame === "function") {
claudeRafId = win.requestAnimationFrame(stepClaudeCanvas);
}
return;
}
lastClaudePaintAt = now;
var elapsed = Math.max(0, now - claudeAnimStart);
var progress = Math.min(1, elapsed / CLAUDE_SWEEP_MS);
// 相位按帧累加：dt 上限 50ms，防止切后台回来后一次性跳很远
var frameDt = claudeLastTs > 0 ? Math.min(0.05, Math.max(0, (now - claudeLastTs) / 1000)) : 0;
claudeLastTs = now;
claudeFlowTime += frameDt * claudeSpeed;
if (now - cachedSurfaceDarkAt > 300 || cachedSurfaceDarkAt === 0) {
cachedSurfaceDark = surfaceIsDark(win, doc);
cachedSurfaceDarkAt = now;
}
var isDark = cachedSurfaceDark;
if (!cachedTrackRect || now - cachedTrackRectAt > 250) {
cachedTrackRect = trackEl.getBoundingClientRect ? trackEl.getBoundingClientRect() : null;
cachedTrackRectAt = now;
}
var rect = cachedTrackRect;
var trackW = rect && rect.width > 0 ? rect.width : 280;
var th = rect && rect.height > 0 ? Math.round(rect.height) : (claudeCanvasEl.height || 28);
// 画布像素宽度 = 已填充宽度（圆钮中心），与 CSS width: var(--ces-fill) 对齐
var curPct = motionState ? clamp01(motionState.x) : 0;
var tw = Math.max(1, Math.round(KNOB_RADIUS + (trackW - KNOB_RADIUS * 2) * curPct));
if (claudeCanvasEl.width !== tw) claudeCanvasEl.width = tw;
if (claudeCanvasEl.height !== th) claudeCanvasEl.height = th;
var cctx = claudeCanvasEl.getContext && claudeCanvasEl.getContext("2d");
if (cctx) {
paintDither(cctx, tw, th, isDark, progress, claudeFlowTime, claudeIntensity);
}
if (win && typeof win.requestAnimationFrame === "function") {
claudeRafId = win.requestAnimationFrame(stepClaudeCanvas);
}
}
function _startClRaf() {
if (destroyed || claudeRafId !== null) return;
if (win && typeof win.requestAnimationFrame === "function") {
claudeRafId = win.requestAnimationFrame(stepClaudeCanvas);
} else {
stepClaudeCanvas(nowMs());
}
}
function applyVisualPct(snap, effectivePct, showIdx) {
var p = clamp01(effectivePct);
var count = snap.count;
var safeIdx = Math.max(0, Math.min(Math.max(0, count - 1), showIdx));
var levelItem = snap.levels[safeIdx];
var label = levelItem ? levelItem.label : "";
var theme = snap.theme || "codex";
_sa(rootEl, "data-theme", theme);
_sa(trackEl, "data-theme", theme);
_sa(container, "data-theme", theme);
// 设为 -1，防止 Radix/Base UI FocusScope 在重新打开菜单时将焦点自动抢到推理条上导致框选
_sa(rootEl, "tabindex", "-1");
_sa(rootEl, "aria-valuemin", "0");
_sa(rootEl, "aria-valuemax", String(Math.max(0, count - 1)));
_sa(rootEl, "aria-valuenow", String(safeIdx));
_sa(rootEl, "aria-valuetext", label);
_sa(rootEl, "aria-disabled", snap.locked ? "true" : "false");
if (snap.locked) {
if (!trackEl.classList.contains("is-locked")) trackEl.classList.add("is-locked");
} else if (trackEl.classList.contains("is-locked")) {
trackEl.classList.remove("is-locked");
}
var curTone = resolvePrismAccentTone(doc, win);
var motOff = isPrismMotionOff(doc, win);
var offsetCss = knobOffsetOf(p, KNOB_RADIUS);
var fillBg = fillBackgroundFor(p, snap.energyStart, snap.energyEnd, snap.isClaude, curTone);
trackEl.style.setProperty("--ces-fill", offsetCss);
trackEl.style.setProperty("--ces-fill-bg", fillBg);
fillEl.style.width = offsetCss;
fillEl.style.background = fillBg;
energyEl.style.width = offsetCss;
starsEl.style.width = offsetCss;
knobEl.style.left = offsetCss;
claudeIntensity = !motOff && curTone !== "mono" && snap.isClaude && !snap.locked && count > 1 ? claudeIntensityFor(p, snap.energyStart) : 0;
claudeSpeed = claudeSpeedFor(p, snap.energyStart);
if (claudeIntensity > 0) {
if (claudeCanvasEl.style.display !== "block") {
// 仅「无特效 → 有特效」时重置入场扫掠；之后拖动只调强度/速度，不重播
claudeCanvasEl.style.display = "block";
claudeAnimStart = nowMs();
claudeLastTs = 0;
}
_startClRaf();
} else {
if (claudeCanvasEl.style.display !== "none") {
claudeCanvasEl.style.display = "none";
}
_stopClRaf();
}
var energy = snap.locked || motOff ? 0 : energyForPct(p, snap.energyStart);
var slowdown = motionMode(win, null, doc) === "quick" ? _RM_SLOW : 1;
if (Math.abs(energy - _lastEng) > 1e-5 || slowdown !== _lastSlow) {
_lastEng = energy;
_lastSlow = slowdown;
var energyOn = energy > 0 ? "1" : "0";
var energyStr = String(Math.round(energy * 1000) / 1000);
_sa(rootEl, "data-energy", energyOn);
rootEl.style.setProperty("--ces-energy", energyStr);
_sa(container, "data-energy", energyOn);
if (container && container.style) container.style.setProperty("--ces-energy", energyStr);
var starLayerOpacity = starLayerOpacityFor(energy);
trackEl.style.setProperty("--ces-star-opacity", String(starLayerOpacity));
starsEl.style.opacity = String(starLayerOpacity);
var visibleCount = Math.round(energy * PARTICLES.length);
var speedFactor = speedFor(p, snap.energyStart);
starsEl.setAttribute("data-count", String(visibleCount));
for (var i = 0; i < starNodes.length; i += 1) {
var sNode = starNodes[i];
var dur = starDurationFor(i, speedFactor) * slowdown;
var delay = starDelayFor(i, dur);
sNode.el.style.display = i < visibleCount ? "" : "none";
sNode.el.style.animationDuration = dur.toFixed(3) + "s";
sNode.el.style.animationDelay = delay.toFixed(3) + "s";
}
}
renderTicks(snap, p);
_syncHeadTrig(snap, safeIdx);
}
function stopFrames() {
if (rafId !== null && win && typeof win.cancelAnimationFrame === "function") {
win.cancelAnimationFrame(rafId);
}
rafId = null;
lastFrameMs = 0;
}
function stepFrame(ts) {
rafId = null;
if (destroyed) return;
var snap = readSeatSnapshot();
var m = ensureMotion(snap);
var mode = motionMode(win, null, doc);
var params = motionParamsForMode(mode);
var now = typeof ts === "number" && ts > 0 ? ts : nowMs();
var dt = lastFrameMs > 0 ? (now - lastFrameMs) / 1000 : 1 / 60;
lastFrameMs = now;
motionStep(m, dt, params);
var showIdx = currentShownIndex(snap);
applyVisualPct(snap, m.x, showIdx);
if (!motionSettled(m, params)) {
startFrames();
} else {
m.x = clamp01(m.target);
m.v = 0;
m.a = 0;
if (!dragging) {
snapIndex = null;
}
applyVisualPct(snap, m.x, currentShownIndex(snap));
}
}
function startFrames() {
if (destroyed || rafId !== null) return;
if (win && typeof win.requestAnimationFrame === "function") {
rafId = win.requestAnimationFrame(stepFrame);
} else {
stepFrame(nowMs());
}
}
function clearMaxEffects() {
var valEl = opts.valueElement || findValueElement(_rowEl());
if (valEl && valEl.classList && valEl.classList.contains("is-glowing")) {
valEl.classList.remove("is-glowing");
if (valEl.__cesGlowTimer) {
clearTimeout(valEl.__cesGlowTimer);
valEl.__cesGlowTimer = null;
}
}
}
function triggerMaxEffects(isClaude) {
if (prefersReducedMotion(win)) return;
// "High" 文字到达最高档时的模糊光斑爆散 (约 0.4s 淡淡消失)
var valEl = opts.valueElement || findValueElement(_rowEl());
if (valEl && valEl.classList) {
var glowColor = isClaude ? "rgba(196, 181, 253, 0.9)" : "rgba(168, 85, 247, 0.9)";
if (valEl.style && typeof valEl.style.setProperty === "function") {
valEl.style.setProperty("--ces-glow-color", glowColor);
}
valEl.classList.remove("is-glowing");
void valEl.offsetWidth;
valEl.classList.add("is-glowing");
if (valEl.__cesGlowTimer) {
clearTimeout(valEl.__cesGlowTimer);
}
valEl.__cesGlowTimer = setTimeout(function () {
if (valEl && valEl.classList) valEl.classList.remove("is-glowing");
valEl.__cesGlowTimer = null;
}, 450);
}
}
/**
* 立即把目标档位写回宿主（Antigravity React Fiber 或 Seat）：
* 拖过档位边界时同步触发，无需等待 pointerup 松手。
*/
function commitAtIndex(targetIndex, reason) {
var snap = readSeatSnapshot();
if (snap.locked || snap.count <= 1) return;
var clampedIdx = Math.max(0, Math.min(snap.count - 1, targetIndex));
var item = snap.levels[clampedIdx];
if (!item) return;
var isNowMax = clampedIdx === snap.count - 1 && !isOffLevel(item.label);
var wasMax = _lastCmtIdx === snap.count - 1;
_lastCmtIdx = clampedIdx;
tracePush("commit", {
reason: reason || "drag",
index: clampedIdx,
effort: item.effort,
label: item.label
});
if (isNowMax && !wasMax) {
triggerMaxEffects(snap.isClaude);
} else if (!isNowMax && wasMax) {
clearMaxEffects();
}
if (seat && typeof seat.selectEffort === "function") {
try {
seat.selectEffort(item.raw !== undefined ? item.raw : item.effort, clampedIdx);
} catch (err) {
tracePush("commit-error", { message: String(err && err.message ? err.message : err) });
}
}
if (typeof opts.onCommit === "function") {
try {
opts.onCommit(item, clampedIdx, reason || "drag");
} catch (err) {
// 忽略外部回调异常
}
}
}
function pctAtClientX(clientX) {
var rect = trackEl.getBoundingClientRect ? trackEl.getBoundingClientRect() : null;
if (!rect || !(rect.width > 0)) return null;
var usable = Math.max(1, rect.width - KNOB_RADIUS * 2);
var raw = (clientX - rect.left - KNOB_RADIUS) / usable;
return clamp01(raw);
}
function moveToClientX(clientX, isInitialDown) {
var snap = readSeatSnapshot();
if (snap.locked || snap.count <= 0) return;
var ptrPct = pctAtClientX(clientX);
if (ptrPct === null) ptrPct = pctFromIndex(snap.officialIndex, snap.count);
var now = nowMs();
if (lastPtrPct !== null && lastPtrMs > 0) {
var dt = (now - lastPtrMs) / 1000;
if (dt > 1e-4 && dt < 0.25) {
var instSpeed = (ptrPct - lastPtrPct) / dt;
ptrSpeed = ptrSpeed * (1 - _PS_EMA) + instSpeed * _PS_EMA;
}
} else {
ptrSpeed = 0;
}
lastPtrPct = ptrPct;
lastPtrMs = now;
var mode = motionMode(win);
var nowIndex;
var targetPct;
if (mode === "fast") {
if (isInitialDown || detentIndex < 0 || detentIndex >= snap.count) {
// 按下时若点击位置跨格，直接按最近格响应；随后的拖动按 1/3 边界迟滞棘轮触发
nowIndex = isInitialDown
? indexFromPct(ptrPct, snap.count)
: detentTargetIndex(snap.officialIndex, ptrPct, snap.count);
} else {
nowIndex = detentTargetIndex(detentIndex, ptrPct, snap.count);
}
// 仅当指针已进入 nowIndex 自身的稳定死区时才把棘轮锚点推进到 nowIndex，
// 否则保持在过渡区来源侧相邻格，防止在 [1/3, 2/3] 区间连续微移或松手时来回翻转
if (detentTargetIndex(nowIndex, ptrPct, snap.count) === nowIndex) {
detentIndex = nowIndex;
} else if (ptrPct < pctFromIndex(nowIndex, snap.count)) {
detentIndex = Math.max(0, nowIndex - 1);
} else {
detentIndex = Math.min(snap.count - 1, nowIndex + 1);
}
targetPct = ptrPct;
} else {
nowIndex = indexFromPct(ptrPct, snap.count);
targetPct = ptrPct;
}
draftPct = ptrPct;
draftIndex = nowIndex;
var m = ensureMotion(snap);
m.target = targetPct;
// ★ R1：拖动过程中仅做视觉即时跟手与档位文字/能量预览，不在途中连续触发宿主 MODEL_CHANGED 脉冲 ★
m.x = targetPct;
m.v = 0;
m.a = 0;
stopFrames();
applyVisualPct(snap, m.x, nowIndex);
}
function endDrag(clientX) {
if (!dragging) return;
var snap = readSeatSnapshot();
var ptrPct = draftPct !== null ? draftPct : pctFromIndex(snap.officialIndex, snap.count);
if (typeof clientX === "number") {
var p = pctAtClientX(clientX);
if (p !== null) ptrPct = p;
}
var mode = motionMode(win);
var finalIndex;
if (mode === "fast") {
var baseDetent = detentIndex >= 0 && detentIndex < snap.count ? detentIndex : snap.officialIndex;
finalIndex = detentTargetIndex(baseDetent, ptrPct, snap.count);
} else if (mode === "quick") {
finalIndex = indexFromPct(ptrPct, snap.count);
} else {
var idleS = lastPtrMs > 0 ? Math.max(0, (nowMs() - lastPtrMs) / 1000) : 1;
finalIndex = releaseIndexFor(ptrPct, ptrSpeed, idleS, snap.count);
}
dragging = false;
buttonDown = false;
draftPct = null;
draftIndex = null;
detentIndex = -1;
lastPtrPct = null;
ptrSpeed = 0;
snapIndex = finalIndex;
// 仅在松手或单次点击且最终档位相对 officialIndex 真正改变时提交 1 次
if (finalIndex !== snap.officialIndex) {
commitAtIndex(finalIndex, "release");
}
var m = ensureMotion(snap);
m.target = pctFromIndex(finalIndex, snap.count);
if (mode === "quick") {
m.x = m.target;
m.v = 0;
m.a = 0;
snapIndex = null;
stopFrames();
applyVisualPct(readSeatSnapshot(), m.x, finalIndex);
} else {
m.x = ptrPct;
m.v = 0;
m.a = 0;
applyVisualPct(readSeatSnapshot(), m.x, finalIndex);
startFrames();
}
}
function swallowEvent(ev) {
if (!ev) return;
if (typeof ev.stopPropagation === "function") ev.stopPropagation();
}
function onPointerDown(ev) {
if (ev && typeof ev.button === "number" && ev.button !== 0) return;
var snap = readSeatSnapshot();
if (snap.locked || snap.count <= 1) return;
swallowEvent(ev);
if (typeof ev.preventDefault === "function") ev.preventDefault();
dragging = true;
buttonDown = true;
// 起手时对齐当前官方档位，若起手点就在当前档位则不重复触发无意义的写入；若点在其他档位则立即切过去
_lastCmtIdx = snap.officialIndex;
detentIndex = snap.officialIndex;
snapIndex = null;
lastPtrPct = null;
try {
if (trackEl.setPointerCapture && ev.pointerId !== undefined) {
trackEl.setPointerCapture(ev.pointerId);
}
} catch (err) {
// 忽略不支持 pointerCapture 的环境
}
moveToClientX(ev.clientX, true);
}
function onPointerMove(ev) {
if (!dragging) return;
if (ev && ev.buttons === 0 && !buttonDown) return;
swallowEvent(ev);
moveToClientX(ev.clientX, false);
}
function onPointerUp(ev) {
if (!dragging) return;
swallowEvent(ev);
buttonDown = false;
try {
if (trackEl.releasePointerCapture && ev && ev.pointerId !== undefined) {
trackEl.releasePointerCapture(ev.pointerId);
}
} catch (err) {
// 忽略释放失败
}
endDrag(ev && typeof ev.clientX === "number" ? ev.clientX : undefined);
}
function onPointerCancel(ev) {
if (!dragging) return;
swallowEvent(ev);
buttonDown = false;
endDrag(undefined);
}
function onKeyDown(ev) {
var snap = readSeatSnapshot();
if (snap.locked || snap.count <= 1) return;
var key = ev && ev.key;
var curIdx = currentShownIndex(snap);
var nextIdx = null;
if (key === "ArrowLeft" || key === "ArrowDown") {
nextIdx = Math.max(0, curIdx - 1);
} else if (key === "ArrowRight" || key === "ArrowUp") {
nextIdx = Math.min(snap.count - 1, curIdx + 1);
} else if (key === "Home") {
nextIdx = 0;
} else if (key === "End") {
nextIdx = snap.count - 1;
} else {
return;
}
swallowEvent(ev);
if (typeof ev.preventDefault === "function") ev.preventDefault();
snapIndex = nextIdx;
commitAtIndex(nextIdx, "key");
var m = ensureMotion(snap);
m.target = pctFromIndex(nextIdx, snap.count);
if (motionMode(win) === "quick") {
m.x = m.target;
m.v = 0;
m.a = 0;
snapIndex = null;
stopFrames();
applyVisualPct(readSeatSnapshot(), m.x, nextIdx);
} else {
applyVisualPct(readSeatSnapshot(), m.x, nextIdx);
startFrames();
}
}
// 阻断 click / mouseup 冒泡到外层 MenuItem，防止拖动松手时意外关闭官方菜单
function onBlockMenuClose(ev) {
swallowEvent(ev);
}
var _trkEvs = [["pointerdown", onPointerDown], ["pointermove", onPointerMove], ["pointerup", onPointerUp], ["pointercancel", onPointerCancel], ["lostpointercapture", onPointerCancel], ["click", onBlockMenuClose], ["mouseup", onBlockMenuClose]];
for (var _ei = 0; _ei < _trkEvs.length; _ei += 1) trackEl.addEventListener(_trkEvs[_ei][0], _trkEvs[_ei][1]);
rootEl.addEventListener("keydown", onKeyDown);
function syncFromExternal() {
if (destroyed || dragging) return;
var snap = readSeatSnapshot();
var m = ensureMotion(snap);
var targetIdx = snap.officialIndex;
var targetPct = pctFromIndex(targetIdx, snap.count);
m.target = targetPct;
if (
snap.locked ||
motionMode(win) === "quick" ||
motionSettled(m, motionParamsForMode(motionMode(win)))
) {
m.x = targetPct;
m.v = 0;
m.a = 0;
snapIndex = null;
stopFrames();
applyVisualPct(snap, m.x, targetIdx);
} else {
applyVisualPct(snap, m.x, targetIdx);
startFrames();
}
}
var offSeat =
seat && typeof seat.subscribe === "function"
? seat.subscribe(function () {
syncFromExternal();
})
: function () {};
var offSettings = onSettingsChange(function () {
var snap = readSeatSnapshot();
var m = ensureMotion(snap);
applyVisualPct(snap, m.x, currentShownIndex(snap));
}, win);
// 首次同步渲染
var initSnap = readSeatSnapshot();
var initMotion = ensureMotion(initSnap);
initMotion.x = pctFromIndex(initSnap.officialIndex, initSnap.count);
initMotion.target = initMotion.x;
applyVisualPct(initSnap, initMotion.x, initSnap.officialIndex);
return {
unmount: function () {
destroyed = true;
stopFrames();
_stopClRaf();
clearMaxEffects();
var valEl = opts.valueElement || findValueElement(_rowEl());
if (valEl && valEl.__cesRiseTimer) {
clearTimeout(valEl.__cesRiseTimer);
valEl.__cesRiseTimer = null;
}
if (typeof offSeat === "function") offSeat();
if (typeof offSettings === "function") offSettings();
for (var _ri = 0; _ri < _trkEvs.length; _ri += 1) trackEl.removeEventListener(_trkEvs[_ri][0], _trkEvs[_ri][1]);
rootEl.removeEventListener("keydown", onKeyDown);
if (rootEl.parentNode === container) {
container.removeChild(rootEl);
}
},
refresh: function () {
syncFromExternal();
}
};
}
// ── 通用菜单观察器（兼容预置「推理等级」行的 DOM 结构与独立预览页） ────────────
function installMenuObserver(options) {
var opts = options || {};
var doc = opts.document || (typeof document !== "undefined" ? document : null);
var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
var onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
if (!doc || !doc.body) {
return { stop: function () {}, rescan: function () {}, getCurrent: function () { return null; } };
}
var current = null;
var observer = null;
function detach() {
if (!current) return;
var prev = current;
current = null;
try {
if (prev.container && prev.container.parentNode) {
prev.container.parentNode.removeChild(prev.container);
}
if (prev.row && prev.previousStyle) {
prev.row.style.height = prev.previousStyle.height;
prev.row.style.flexWrap = prev.previousStyle.flexWrap;
prev.row.style.paddingTop = prev.previousStyle.paddingTop;
prev.row.style.paddingBottom = prev.previousStyle.paddingBottom;
}
} catch (err) {
// 忽略清理异常
}
onChange(null);
}
function scan() {
// 若页面存在 Antigravity 原生模型面板，交由 installAntigravityObserver 接管
if (findAntigravityPanel(doc) || findAntigravityTrigger(doc)) return;
var row = findInferenceRow(doc);
if (!row) {
if (current) detach();
return;
}
if (current && current.row === row && current.container && row.contains(current.container)) {
return;
}
if (current) detach();
var previousStyle = {
height: row.style.height || "",
flexWrap: row.style.flexWrap || "",
paddingTop: row.style.paddingTop || "",
paddingBottom: row.style.paddingBottom || ""
};
row.setAttribute("data-ces-effort-row", "true");
row.style.height = "auto";
row.style.flexWrap = "wrap";
row.style.paddingTop = "8px";
row.style.paddingBottom = "8px";
var valEl = findValueElement(row);
var host = doc.createElement("div");
host.className = "ces-inline";
host.setAttribute("data-ces-part", "host");
row.appendChild(host);
current = {
row: row,
container: host,
value: valEl ? (valEl.textContent || "").trim() : "",
previousStyle: previousStyle
};
onChange(current);
}
scan();
var MO = opts.MutationObserver || (win && win.MutationObserver) || (typeof MutationObserver === "function" ? MutationObserver : null);
if (typeof MO === "function") {
observer = new MO(function () {
scan();
});
observer.observe(doc.body, { childList: true, subtree: true });
}
return {
stop: function () {
if (observer) {
observer.disconnect();
observer = null;
}
detach();
},
rescan: scan,
getCurrent: function () {
return current;
}
};
}
// ── Antigravity 原生模型选择器深度桥接器 ───────────────────────────────────
function installAntigravityObserver(options) {
var opts = options || {};
var doc = opts.document || (typeof document !== "undefined" ? document : null);
var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
if (!doc || !doc.body) {
return { stop: function () {}, rescan: function () {} };
}
installStyles(doc);
// 记录每个基础模型在当前会话最后选定的推理档位（默认跟随 selectedModel 或 medium）
var _effMap = new Map();
var activeMount = null;
var activePanel = null;
var activeSection = null;
var activeRow = null;
var activeValueEl = null;
var activeHostEl = null;
var _seatLs = new Set();
var activeBaseOverride = null;
var _actOptOvr = null;
var _orchPlanOvr = null;
var _lastHostLbl = "";
var observer = null;
var _intMut = false;
function _setTxt(el, s) {
if (!el || el.textContent === s) return;
var f = el.firstChild;
if (f && f.nodeType === 3 && (!el.childNodes || el.childNodes.length === 1)) f.nodeValue = s;
else el.textContent = s;
}
function notifySeatListeners() {
_seatLs.forEach(function (fn) {
try {
fn();
} catch (err) {
// 忽略订阅者异常
}
});
}
function _withMut(fn) {
_intMut = true;
try { return fn(); }
finally {
if (observer && typeof observer.takeRecords === "function") { try { observer.takeRecords(); } catch (e) {} }
_intMut = false;
}
}
function _hasValidCtx(c) {
return Boolean(c && ((c.effortIndex && c.effortIndex.size > 0) || (c.orchPlanners && c.orchPlanners.length > 0)));
}
function _setReady(on) {
var r = doc && doc.documentElement;
if (!r) return;
if (on) { if (typeof r.setAttribute === "function" && r.getAttribute("data-ces-slider-ready") !== "1") r.setAttribute("data-ces-slider-ready", "1"); }
else if (typeof r.removeAttribute === "function" && (!r.hasAttribute || r.hasAttribute("data-ces-slider-ready"))) r.removeAttribute("data-ces-slider-ready");
}
function getLiveContext() {
var panel = findAntigravityPanel(doc);
var trigger = findAntigravityTrigger(doc);
return (panel && _rdAgFiber(panel)) || (trigger && _rdAgFiber(trigger)) || null;
}
function getActiveProfile(ctx) {
if (!ctx) return null;
var target = _actOptOvr || activeBaseOverride || ctx.selectedModel;
return resolveModelEffortProfile(ctx, target, _effMap, _orchPlanOvr);
}
/**
* 立即同步更新：
* 1. 底部 Composer 折叠触发按钮的模型名与档位颜色
* 2. 展开菜单中每一行模型右侧的档位文字与颜色、以及选中态高亮
*/
function _syncAgDom(ctx, activeProfile) {
if (!ctx) return;
var profile = activeProfile || getActiveProfile(ctx);
if (!profile) return;
if (!profile.locked && !profile.isOrchestrator && profile.baseName && profile.currentEffort) {
_effMap.set(profile.baseName, profile.currentEffort);
}
var count = profile.levels.length;
var idx = profile.currentIndex;
var isMax = !profile.locked && count > 1 && idx === count - 1 && !isOffLevel(profile.currentLabel);
// 1. 同步底部折叠按钮 (button[data-testid="model-selector-trigger"])
var triggerBtn = findAntigravityTrigger(doc);
if (triggerBtn) {
if (profile.isOrchestrator && profile.orchestratorTunable) {
var pb = profile.isClaude ? "claude" : "gemini";
if (triggerBtn.getAttribute("data-ces-orch-b") !== pb) triggerBtn.setAttribute("data-ces-orch-b", pb);
} else triggerBtn.removeAttribute("data-ces-orch-b");
}
if (triggerBtn && !profile.isOrchestrator) {
var outerSpan = triggerBtn.querySelector("span.min-w-0");
if (outerSpan) {
var allSpans = outerSpan.querySelectorAll("span");
for (var sIdx = 1; sIdx < allSpans.length; sIdx += 1) {
if (allSpans[sIdx].parentNode === outerSpan) {
outerSpan.removeChild(allSpans[sIdx]);
}
}
var effortSpan = outerSpan.querySelector("span.opacity-70, [data-ces-part='trigger-effort']");
var firstNode = outerSpan.firstChild;
if (!profile.locked && profile.baseName) {
if (firstNode && firstNode.nodeType === 3 && firstNode.nodeValue !== profile.baseName) {
firstNode.nodeValue = profile.baseName;
}
if (effortSpan) {
var nextTrigText = " " + profile.currentLabel;
if (effortSpan.__cesLastText !== nextTrigText) {
effortSpan.__cesLastText = nextTrigText;
_setTxt(effortSpan, nextTrigText);
}
}
} else if (profile.locked) {
var lp = profile.modelOption && parseModelLabel(profile.modelOption.label);
var lBase = lp ? lp.base : (profile.modelOption && profile.modelOption.label) || profile.baseName;
if (lBase && firstNode && firstNode.nodeType === 3 && firstNode.nodeValue !== lBase) {
firstNode.nodeValue = lBase;
}
if (effortSpan) {
var nextLockedText = lp ? " " + lp.effortLabel : "";
if (effortSpan.__cesLastText !== nextLockedText) {
effortSpan.__cesLastText = nextLockedText;
_setTxt(effortSpan, nextLockedText);
}
}
}
}
}
var trigLbl = profile.locked ? (profile.modelOption && parseModelLabel(profile.modelOption.label) ? profile.currentLabel : "") : profile.currentLabel;
syncTriggerColor(doc, trigLbl, idx, count, isMax, false, Boolean(profile.isClaude));
// 2. 同步展开菜单中的各模型行
var panel = findAntigravityPanel(doc);
if (!panel) return;
var _sa = function (el, k, v) { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
var _mkSel = function (el, on) {
if (!el) return;
_sa(el, "data-ces-model-selected", on ? "true" : "false");
el.classList.toggle("text-foreground", on);
el.classList.toggle("text-secondary-foreground", !on);
};
if (profile.isOrchestrator && profile.orchestratorTunable && !profile.locked) {
_sa(panel, "data-ces-orch-tunable", "true");
panel.removeAttribute("data-ag-cs-orch-active");
_sa(activeRow, "data-row-hidden", "false");
_sa(activeRow, "aria-hidden", "false");
var ob = panel.querySelector('[data-testid="orchestrator-effort-bar"]');
_sa(ob, "data-row-hidden", "true");
_sa(ob, "aria-hidden", "true");
} else panel.removeAttribute("data-ces-orch-tunable");
var orchRows = panel.querySelectorAll('[data-testid="model-selector-orchestrator"]');
for (var oi = 0; oi < orchRows.length; oi += 1) _sa(orchRows[oi], "data-ces-model-selected", profile.isOrchestrator ? "true" : "false");
var groupSpans = panel.querySelectorAll('[data-testid="model-selector-effort-group"]');
for (var i = 0; i < groupSpans.length; i += 1) {
var gSpan = groupSpans[i], base = gSpan.getAttribute("data-model-base") || (gSpan.textContent || "").trim();
var rowProf = resolveModelEffortProfile(ctx, base, _effMap);
if (!rowProf) continue;
var sel = !profile.isOrchestrator && profile.baseName === base;
_mkSel(gSpan.closest('[role="menuitem"]'), sel);
var sib = gSpan.nextElementSibling;
if (sib && sib.tagName === "SPAN") {
var dE = sel ? profile.currentLabel : rowProf.currentLabel, dI = sel ? profile.currentIndex : rowProf.currentIndex, dC = rowProf.levels.length;
_setTxt(sib, dE);
var rc = valueColorFor(dE, dI, dC, dC > 1 && dI === dC - 1, false) || "";
if (sib.style.color !== rc) sib.style.color = rc;
if (sib.style.opacity !== (rc ? "1" : "")) sib.style.opacity = rc ? "1" : "";
if (sib.style.fontWeight !== (rc ? "600" : "")) sib.style.fontWeight = rc ? "600" : "";
}
}
var singleItems = panel.querySelectorAll('[data-testid="model-selector-item"]');
for (var j = 0; j < singleItems.length; j += 1) {
var sItem = singleItems[j];
var sLabel = sItem.getAttribute("data-model-label") || (sItem.textContent || "").trim();
_mkSel(sItem, !profile.isOrchestrator && ((profile.modelOption && profile.modelOption.label === sLabel) || profile.baseName === sLabel));
}
}
function _curProf() { return getActiveProfile(getLiveContext()); }
var agSeatAdapter = {
get effortLevels() { var p = _curProf(); return p ? p.levels : []; },
get currentEffort() { var p = _curProf(); return p ? p.currentEffort : ""; },
get locked() { var p = _curProf(); return p ? p.locked : true; },
get baseName() { var p = _curProf(); return p ? p.baseName : ""; },
get isClaude() { var p = _curProf(); return p ? Boolean(p.isClaude) : false; },
get theme() { var p = _curProf(); return p ? (p.theme || "codex") : "codex"; },
selectEffort: function (levelItem) {
var ctx = getLiveContext();
if (!ctx || !levelItem) return;
var targetOpt = levelItem.modelOption || (levelItem.raw && levelItem.raw.modelOption);
if (!targetOpt) return;
var curProf = getActiveProfile(ctx);
if (curProf && curProf.isOrchestrator && curProf.orchestratorTunable) {
_orchPlanOvr = targetOpt;
_commitAgOpt(ctx, targetOpt, true);
_withMut(function () { _syncAgDom(ctx, resolveModelEffortProfile(ctx, _actOptOvr || ctx.selectedModel, _effMap, targetOpt)); notifySeatListeners(); });
return;
}
var parsed = parseModelLabel(targetOpt.label);
if (parsed) {
_effMap.set(parsed.base, parsed.effort);
activeBaseOverride = parsed.base;
}
_actOptOvr = targetOpt;
_lastHostLbl = (ctx.selectedModel && ctx.selectedModel.label) || "";
_orchPlanOvr = null;
_commitAgOpt(ctx, targetOpt);
_withMut(function () {
_syncAgDom(ctx, resolveModelEffortProfile(ctx, targetOpt, _effMap));
});
},
subscribe: function (fn) {
_seatLs.add(fn);
return function () {
_seatLs.delete(fn);
};
}
};
function _bindPnl(panel) {
if (!panel || panel.__cesAgBound) return;
panel.__cesAgBound = true;
function resolveKeepOpenAction(target) {
if (!target || typeof target.closest !== "function") return null;
if (target.closest('.ces-ag-section,.ces-set,button[aria-label="Edit Model"],[data-testid="model-selector-orchestrator"],[data-testid="model-selector-item"],[aria-disabled="true"],[disabled]')) return null;
var dd = target.closest('[data-disabled]');
if (dd && dd.getAttribute("data-disabled") !== "false") return null;
var menuItem = target.closest('[role="menuitem"]');
if (menuItem && menuItem.disabled) return null;
var gs = menuItem && panel.contains(menuItem) && menuItem.querySelector('[data-testid="model-selector-effort-group"]');
if (!gs) return null;
var base = (gs.getAttribute("data-model-base") || gs.textContent || "").trim();
var bp = parseModelLabel(base);
if (bp && bp.base) base = bp.base;
if (!base || _isOrch(base)) return null;
var ctx = getLiveContext();
if (!ctx || (typeof ctx.setModelConfigByLabelForConversation !== "function" && typeof ctx.unwrappedSetSelectedModel !== "function" && typeof ctx.setCurrentModelConfigByLabel !== "function")) return null;
var prof = resolveModelEffortProfile(ctx, base, _effMap);
if (!prof || prof.locked || !prof.levels || prof.levels.length < 2) return null;
var opt = prof.modelOption;
if (!opt || opt.isCustom || opt.disabled || !opt.label) return null;
if (Array.isArray(ctx.modelOptions) && ctx.modelOptions.length) {
var found = false;
for (var i = 0; i < ctx.modelOptions.length; i += 1) {
var o = ctx.modelOptions[i];
if (o && !o.isCustom && !o.disabled && (o === opt || o.label === opt.label)) { found = true; break; }
}
if (!found) return null;
}
var cur = getActiveProfile(ctx);
if (cur && !cur.isOrchestrator && cur.baseName === prof.baseName) return null;
return { ctx: ctx, base: prof.baseName || base, targetOption: opt };
}
// 严格 Fail-Open：仅确认切到新的可调多档位模型时才拦 pointerup/mouseup/click 保持菜单常开
function onPointerOrMouseUpCapture(ev) {
if (!resolveKeepOpenAction(ev.target)) return;
_stp(ev);
}
function onClickCapture(ev) {
var act = resolveKeepOpenAction(ev.target);
if (!act) return;
if (!_commitAgOpt(act.ctx, act.targetOption)) return;
ev.preventDefault();
_stp(ev);
activeBaseOverride = act.base;
_actOptOvr = act.targetOption;
_lastHostLbl = (act.ctx.selectedModel && act.ctx.selectedModel.label) || "";
_orchPlanOvr = null;
tracePush("ag-select-model-in-menu", { label: act.targetOption.label });
_withMut(function () {
_syncAgDom(act.ctx, resolveModelEffortProfile(act.ctx, act.targetOption, _effMap));
notifySeatListeners();
});
}
// 拦截 View Usage 触发项的划过展开，增加 0.3s (300ms) 停留防误触展开延迟
var usageHoverTimer = null;
var usageTriggerEl = null;
var usageHoverAllowed = false;
var isDispatchingSynthetic = false;
function findViewUsageTrigger(target) {
if (!target || typeof target.closest !== "function") return null;
var item = target.closest('[role="menuitem"], .agy-overlay-item, button');
if (!item) {
var div = target.closest('div');
if (div && div !== panel && panel.contains(div)) {
var text = (div.textContent || "").trim();
if ((text.startsWith("View Usage") || text === "Usage" || text.startsWith("查看用量")) && !text.includes("Claude") && !text.includes("Gemini") && !text.includes("GPT")) {
item = div;
}
}
}
if (!item || !panel.contains(item) || item === panel) return null;
var itemText = (item.textContent || "").trim();
if (itemText.includes("View Usage") || itemText.includes("Usage") || itemText.includes("查看用量")) {
return item;
}
return null;
}
function resetUsageHover() {
if (usageHoverTimer) {
clearTimeout(usageHoverTimer);
usageHoverTimer = null;
}
usageHoverAllowed = false;
usageTriggerEl = null;
}
function _stp(ev) { ev.stopPropagation(); if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation(); }
function onPointerEnterCapture(ev) {
if (isDispatchingSynthetic) return;
var trigger = findViewUsageTrigger(ev.target);
if (!trigger) { resetUsageHover(); return; }
if (usageHoverAllowed && usageTriggerEl === trigger) return;
_stp(ev);
resetUsageHover();
usageTriggerEl = trigger;
try {
trigger.addEventListener("pointerleave", resetUsageHover, { once: true });
trigger.addEventListener("mouseleave", resetUsageHover, { once: true });
} catch (e) {}
var cx = ev.clientX, cy = ev.clientY, pid = ev.pointerId || 1, pt = ev.pointerType || "mouse";
usageHoverTimer = setTimeout(function () {
usageHoverTimer = null;
if (trigger && panel.contains(trigger)) {
usageHoverAllowed = true;
isDispatchingSynthetic = true;
try {
var PE = (win && win.PointerEvent) || (typeof PointerEvent !== "undefined" ? PointerEvent : null);
var ME = (win && win.MouseEvent) || (typeof MouseEvent !== "undefined" ? MouseEvent : null);
var EV = (win && win.Event) || (typeof Event !== "undefined" ? Event : null);
if (typeof PE === "function") {
[["pointerenter", false], ["pointerover", true], ["pointermove", true]].forEach(function (it) {
trigger.dispatchEvent(new PE(it[0], { bubbles: it[1], cancelable: true, pointerId: pid, pointerType: pt, clientX: cx, clientY: cy }));
});
} else if (typeof ME === "function") trigger.dispatchEvent(new ME("mouseenter", { bubbles: false, cancelable: true, clientX: cx, clientY: cy }));
else if (typeof EV === "function") trigger.dispatchEvent(new EV("pointerenter", { bubbles: false, cancelable: true }));
} catch (err) {} finally { isDispatchingSynthetic = false; }
}
}, 300);
}
function onPointerOverCapture(ev) {
if (isDispatchingSynthetic) return;
var trigger = findViewUsageTrigger(ev.target);
if (!trigger) { if (usageHoverAllowed || usageHoverTimer) resetUsageHover(); return; }
if (!usageHoverAllowed) _stp(ev);
}
function onPointerOutCapture(ev) {
if (isDispatchingSynthetic) return;
var trigger = findViewUsageTrigger(ev.target);
if (trigger && (!ev.relatedTarget || !trigger.contains(ev.relatedTarget))) resetUsageHover();
}
function onPointerMoveCapture(ev) {
if (isDispatchingSynthetic) return;
if (findViewUsageTrigger(ev.target) && !usageHoverAllowed) _stp(ev);
}
function onPointerLeaveCapture(ev) {
if (!ev.relatedTarget || !panel.contains(ev.relatedTarget)) resetUsageHover();
}
var evPairs = [
["pointerenter", onPointerEnterCapture],
["pointerover", onPointerOverCapture],
["pointerout", onPointerOutCapture],
["pointerleave", onPointerLeaveCapture],
["pointermove", onPointerMoveCapture],
["pointerup", onPointerOrMouseUpCapture],
["mouseup", onPointerOrMouseUpCapture],
["click", onClickCapture]
];
for (var ei = 0; ei < evPairs.length; ei++) panel.addEventListener(evPairs[ei][0], evPairs[ei][1], true);
panel.__cesAgResetUsageHover = resetUsageHover;
panel.__cesAgUnbindPanel = function () {
for (var ui = 0; ui < evPairs.length; ui++) panel.removeEventListener(evPairs[ui][0], evPairs[ui][1], true);
delete panel.__cesAgResetUsageHover;
delete panel.__cesAgUnbindPanel;
delete panel.__cesAgBound;
};
}
function _unmntSec() {
_setReady(false);
if (activePanel) {
try { if (typeof activePanel.__cesAgResetUsageHover === "function") activePanel.__cesAgResetUsageHover(); } catch (e) {}
try { if (typeof activePanel.__cesAgUnbindPanel === "function") activePanel.__cesAgUnbindPanel(); } catch (e) {}
}
if (doc && doc.activeElement && activeSection && activeSection.contains(doc.activeElement)) {
try { doc.activeElement.blur(); } catch (e) {}
}
if (activeMount) { activeMount.unmount(); activeMount = null; }
if (activeSection && activeSection.parentNode) activeSection.parentNode.removeChild(activeSection);
activeSection = activeRow = activeValueEl = activeHostEl = activePanel = activeBaseOverride = _actOptOvr = _orchPlanOvr = null;
}
function _mntSec(panel, ctx) {
panel.classList.add("ces-ag-panel-enhanced");
_bindPnl(panel);
var section = doc.createElement("div");
section.className = "ces-ag-section";
section.setAttribute("data-ces-part", "ag-section");
var _stopProp = function (ev) { if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation(); };
["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (evName) { section.addEventListener(evName, _stopProp); });
var sep = doc.createElement("div");
sep.setAttribute("role", "separator");
sep.setAttribute("aria-orientation", "horizontal");
sep.className = "h-px bg-border my-1 -mx-1";
section.appendChild(sep);
var row = doc.createElement("div");
row.className = "ces-ag-effort-row text-foreground";
row.setAttribute("data-ces-effort-row", "true");
var head = doc.createElement("div");
head.className = "ces-ag-effort-head";
var title = doc.createElement("span");
title.className = "ces-ag-effort-title";
title.textContent = resolveEffortTitle(doc, win);
var valueEl = doc.createElement("span");
valueEl.className = "ces-ag-effort-value";
valueEl.setAttribute("data-ces-part", "value");
var initProf = getActiveProfile(ctx);
if (initProf && initProf.currentLabel) {
valueEl.textContent = initProf.currentLabel;
valueEl.__cesLastLabel = initProf.currentLabel;
}
head.appendChild(title);
head.appendChild(valueEl);
row.appendChild(head);
var hostEl = doc.createElement("div");
hostEl.className = "ces-inline";
hostEl.setAttribute("data-ces-part", "host");
row.appendChild(hostEl);
section.appendChild(row);
// 挂载位置：模型列表容器 (panel.firstElementChild) 之后、View Usage 分隔线之前
var modelListWrapper = panel.firstElementChild;
if (modelListWrapper && modelListWrapper.nextSibling) {
panel.insertBefore(section, modelListWrapper.nextSibling);
} else {
panel.appendChild(section);
}
activePanel = panel;
activeSection = section;
activeRow = row;
activeValueEl = valueEl;
activeHostEl = hostEl;
activeMount = mountCodexEffortSlider({
container: hostEl,
panel: panel,
row: row,
valueElement: valueEl,
seat: agSeatAdapter,
document: doc,
window: win,
onVisualChange: function (vState) {
_withMut(function () {
var liveCtx = getLiveContext();
if (liveCtx) _syncAgDom(liveCtx, getActiveProfile(liveCtx));
else syncTriggerColor(doc, vState.label, vState.index, vState.count, vState.isMax, false);
});
}
});
try {
if (win && typeof win.dispatchEvent === "function" && typeof win.Event === "function") {
win.dispatchEvent(new win.Event("resize"));
}
} catch (err) {}
}
function scan() {
if (_intMut) return;
_withMut(function () {
var ctx = getLiveContext();
var curLbl = (ctx && ctx.selectedModel && ctx.selectedModel.label) || "";
if (_actOptOvr || activeBaseOverride) {
if (!curLbl || (_actOptOvr && curLbl === _actOptOvr.label) || curLbl !== _lastHostLbl) {
_actOptOvr = null;
activeBaseOverride = null;
}
}
_lastHostLbl = curLbl;
if (_orchPlanOvr) {
var lp = ctx && _isOrch(ctx.selectedModel) ? _resOrch(ctx) : null;
if (!lp || (lp.opt && lp.opt.value === _orchPlanOvr.value)) _orchPlanOvr = null;
}
var panel = findAntigravityPanel(doc);
if (!panel) {
if (activeSection || activePanel) _unmntSec();
else _setReady(false);
if (ctx) _syncAgDom(ctx, getActiveProfile(ctx));
return;
}
if (!_hasValidCtx(ctx)) {
if (activeSection || activePanel) _unmntSec();
else _setReady(false);
return;
}
if (activePanel !== panel || !activeSection || !panel.contains(activeSection)) {
_unmntSec();
_mntSec(panel, ctx);
} else if (activeSection) {
var nextTitle = resolveEffortTitle(doc, win);
var tSpan = activeSection.querySelector(".ces-ag-effort-title");
_setTxt(tSpan, nextTitle);
if (activeMount && typeof activeMount.refresh === "function") activeMount.refresh();
}
_setReady(Boolean(activeMount && activeSection));
_syncAgDom(ctx, getActiveProfile(ctx));
notifySeatListeners();
});
}
scan();
var MO = opts.MutationObserver || (win && win.MutationObserver) || (typeof MutationObserver === "function" ? MutationObserver : null);
if (typeof MO === "function") {
observer = new MO(function (recs) {
if (_intMut) return;
if (Array.isArray(recs) && recs.length) {
if (activeSection && activePanel && activePanel.contains(activeSection)) {
var allInsideSlider = true;
for (var si = 0; si < recs.length; si += 1) {
var sr = recs[si], st = sr && sr.target, sel = st && (st.nodeType === 1 ? st : st.parentElement);
if (!sel || !activeSection.contains(sel)) { allInsideSlider = false; break; }
}
if (allInsideSlider) return;
}
if (!activePanel) {
var rel = false;
var ctrlSel = '[data-testid="model-selector-trigger"],button[aria-label^="Select model"],[data-testid="model-selector-panel"],[role="menu"]';
var noiseSel = '[data-testid="autoscroll-viewport"],.toast-viewport,[data-testid="sidebar-split"]>div:first-child';
for (var ri = 0; ri < recs.length; ri += 1) {
var r = recs[ri], t = r && r.target, el = t && (t.nodeType === 1 ? t : t.parentElement);
if (!el || typeof el.closest !== "function") { rel = true; break; }
if (r.type === "characterData" || r.type === "attributes") {
if (el.closest(ctrlSel)) { rel = true; break; }
} else if (el.closest(ctrlSel) || !el.closest(noiseSel)) { rel = true; break; }
}
if (!rel) return;
}
}
scan();
});
observer.observe(doc.body, {
childList: true,
subtree: true,
characterData: true,
attributes: true,
attributeFilter: ["aria-expanded", "data-state", "hidden", "data-selected"]
});
}
return {
stop: function () {
if (observer) {
observer.disconnect();
observer = null;
}
_unmntSec();
_clrAgDom(doc);
},
rescan: scan,
_bindPnl: _bindPnl
};
}
// ── 一键安装到当前窗口（同时兼容 Antigravity 原生环境与 Seat 预览环境） ────────
function installCodexEffortSlider(options) {
var opts = options || {};
var doc = opts.document || (typeof document !== "undefined" ? document : null);
var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
if (!doc || !doc.body) return null;
if (win && win.__agCodexEffortSliderInstance && typeof win.__agCodexEffortSliderInstance.stop === "function") {
try {
win.__agCodexEffortSliderInstance.stop();
} catch (err) {
// 忽略旧实例卸载错误
}
}
installStyles(doc);
var _onStoInv = function (ev) { if (!ev || ev.key === SETTINGS_KEY || ev.key === LEGACY_SETTINGS_KEY) _invCfg(); };
if (win && typeof win.addEventListener === "function") { win.addEventListener("storage", _onStoInv); win.addEventListener(SETTINGS_EVENT, _invCfg); }
var settingsUi = opts.disableContextMenuSettings ? { stop: function () {} } : installSettingsUi({ document: doc, window: win });
var agObs = installAntigravityObserver({ document: doc, window: win, MutationObserver: opts.MutationObserver });
var _actGenMnt = null;
var menuObs = opts.skipGenericMenuObserver ? { stop: function () {}, rescan: function () {} } : installMenuObserver({
document: doc,
window: win,
MutationObserver: opts.MutationObserver,
onChange: function (current) {
if (_actGenMnt) {
_actGenMnt.unmount();
_actGenMnt = null;
}
if (!current || !current.container) return;
var seat = opts.seat || findSeatEffort(win);
if (!seat) return;
_actGenMnt = mountCodexEffortSlider({
container: current.container,
row: current.row,
seat: seat,
document: doc,
window: win
});
}
});
var instance = {
stop: function () {
if (_actGenMnt) {
_actGenMnt.unmount();
_actGenMnt = null;
}
menuObs.stop();
agObs.stop();
settingsUi.stop();
if (win && typeof win.removeEventListener === "function") { win.removeEventListener("storage", _onStoInv); win.removeEventListener(SETTINGS_EVENT, _invCfg); }
_invCfg();
if (win && win.__agCodexEffortSliderInstance === instance) {
delete win.__agCodexEffortSliderInstance;
}
},
rescan: function () {
agObs.rescan();
menuObs.rescan();
}
};
if (win) {
win.__agCodexEffortSliderInstance = instance;
}
return instance;
}
// 在浏览器主世界（非 Node 测试环境且非禁用自动启动）下自动挂载
if (
typeof window !== "undefined" &&
typeof document !== "undefined" &&
!window.__agCodexEffortSliderDisableAutoBoot && !(globalRoot && globalRoot.__agCodexEffortSliderDisableAutoBoot)
) {
var boot = function () {
if (document.body) installCodexEffortSlider({ document: document, window: window });
};
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
boot();
}
}
return {mountCodexEffortSlider,installMenuObserver,installAntigravityObserver,installCodexEffortSlider,findAntigravityTrigger,findAntigravityPanel,resolveModelEffortProfile,normalizeEffortIndex,motionMode,openSettingsPanel,fillColorFor,fillBackgroundFor,valueColorFor,paintDither,surfaceIsDark};
});
