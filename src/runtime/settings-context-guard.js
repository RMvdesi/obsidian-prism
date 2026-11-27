// Channel 9 Settings Extension for Channel 17 (Context Auto-Compact & /clear)
(function (r, f) {
  const a = f(r);
  if (r) r.__agPrismSettingsContextGuard = a;
  if (typeof window !== 'undefined' && window && window !== r) window.__agPrismSettingsContextGuard = a;
  if (typeof module === 'object' && module.exports) module.exports = a;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';
  const THRESHOLDS = Object.freeze(['off', '75', '80', '85', '90']);
  const LM = { 'zh-cn': 0, 'zh-sg': 0, zh: 0, 'zh-tw': 1, 'zh-hk': 1, 'zh-mo': 1, 'zh-hant': 1, en: 2, ja: 3, ko: 4, es: 5, fr: 6, de: 7, tr: 8 };
  const TXT = Object.freeze({
    modTitle: ['自动压缩与 /clear', '自動壓縮與 /clear', 'Auto-Compact & /clear', '自動圧縮と /clear', '자동 압축 및 /clear', 'Autocompactar /clear', 'Auto-compaction', 'Auto-Kompakt', 'Oto Sikistir'],
    modDesc: [
      '按需开启（关时 0 B）：上下文卡片内嵌阈值与 /clear 轻量重开，空闲静默压缩且锁阅读位置。',
      '按需開啟（關時 0 B）：上下文卡片內嵌閾值與 /clear 輕量重開，空閒靜默壓縮且鎖閱讀位置。',
      'Opt-in (0 B off): context-card threshold presets, scroll-pinned /compact & /clear restart.',
      'オンデマンド（0 B）：カードに自動圧縮閾値と /clear 軽量再開を追加。',
      '온디맨드 (0 B): 카드에 자동 압축 임계치와 /clear 재시작 추가.',
      'Bajo demanda (0 B): umbrales /compact y reinicio /clear en la tarjeta.',
      'A la demande (0 B) : seuils /compact et reprise /clear dans la carte.',
      'On-Demand (0 B): /compact-Schwellen und /clear-Neustart in der Karte.',
      'Istege bagli (0 B): kartta /compact esikleri ve /clear temiz baslatma.',
    ],
    off: ['关闭', '關閉', 'Off', 'オフ', '끄기', 'Apagado', 'Desactive', 'Aus', 'Kapali'],
  });
  const sa = (e, k, v = '') => e?.setAttribute?.(k, String(v));
  const ra = (e, k) => e?.removeAttribute?.(k);
  const qs = (e, s) => e?.querySelector?.(s) || null;
  const mk = (d, t, c) => { const e = d.createElement(t); if (c) e.className = c; return e; };
  const BTN = 'ag-cs-seg-btn data-[pressed]:bg-secondary data-[pressed]:text-foreground';
  const liOf = (raw) => {
    const s = String(raw || 'en').trim().toLowerCase().replace(/_/g, '-');
    return s in LM ? LM[s] : /^zh-(tw|hk|mo|hant)/.test(s) ? 1 : /^zh|^yue/.test(s) ? 0 : (LM[s.split('-')[0]] ?? 2);
  };
  const rCfg = (ctx, k, fb) => {
    try { const v = ctx.effVal?.(k, ctx.lang); if (v != null) return v; } catch {}
    try { const c = (ctx.win || G).__agPrism?.getState?.()?.cfg; if (c && k in c) return c[k]; } catch {}
    return fb;
  };
  function sync(rootEl, ctx) {
    if (!rootEl || !ctx?.doc) return false;
    const d = ctx.doc, anc = qs(rootEl, '[data-ag-cs-row="telemetryQuotaMode"]') || qs(rootEl, '[data-ag-cs-row="telemetryModule"]');
    if (!anc?.parentElement) return false;
    const p = anc.parentElement, li = liOf(ctx.lang);
    const modOn = rCfg(ctx, 'contextGuard', 'off') === 'on';
    const rawTh = String(rCfg(ctx, 'compactThreshold', '80'));
    const curV = !modOn ? 'off' : (THRESHOLDS.includes(rawTh) ? rawTh : '80');
    let row = qs(rootEl, '[data-ag-cs-row="contextGuard"]');
    if (!row) {
      row = mk(d, 'div');
      const inn = mk(d, 'div', 'py-2'), col = mk(d, 'div', 'flex-1'), tl = mk(d, 'div', 'ag-cs-settings-title-line');
      const t = mk(d, 'span'), ds = mk(d, 'span', 'whitespace-pre-wrap'), wr = mk(d, 'div', 'shrink-0'), gp = mk(d, 'div', 'ag-cs-seg-group');
      sa(row, 'data-ag-cs-row', 'contextGuard'); sa(row, 'data-ag-cs-cg-ext', '1');
      sa(t, 'data-k', 't'); sa(ds, 'data-k', 'd'); sa(gp, 'role', 'group');
      for (const val of THRESHOLDS) {
        const b = mk(d, 'button', BTN);
        b.type = 'button'; sa(b, 'type', 'button'); sa(b, 'data-ag-cs-cg-val', val);
        b.addEventListener('click', (ev) => {
          ev?.stopPropagation?.();
          if (val === 'off') {
            ctx.saveSetting?.('contextGuard', 'off');
          } else {
            ctx.saveSetting?.('contextGuard', 'on');
            ctx.saveSetting?.('compactThreshold', val);
            try { (ctx.win?.__agPrismContextGuard || G.__agPrismContextGuard)?.sync?.({ enabled: true, compactThreshold: val }); } catch {}
          }
          sync(rootEl, ctx);
        });
        gp.appendChild(b);
      }
      tl.appendChild(t); col.appendChild(tl); col.appendChild(ds); wr.appendChild(gp); inn.appendChild(col); inn.appendChild(wr); row.appendChild(inn);
      if (anc.nextSibling) p.insertBefore(row, anc.nextSibling); else p.appendChild(row);
    }
    const t = qs(row, '[data-k="t"]'), ds = qs(row, '[data-k="d"]'), offL = ctx.ui?.offLabel || TXT.off[li];
    if (t) t.textContent = TXT.modTitle[li];
    if (ds) ds.textContent = TXT.modDesc[li];
    for (const b of row.querySelectorAll?.('button[data-ag-cs-cg-val]') || []) {
      const v = b.getAttribute('data-ag-cs-cg-val'), act = v === curV;
      b.textContent = v === 'off' ? offL : `${v}%`;
      sa(b, 'aria-pressed', act ? 'true' : 'false');
      if (act) sa(b, 'data-pressed'); else ra(b, 'data-pressed');
    }
    return true;
  }
  const dispose = (ov) => { try { (ov || (typeof document !== 'undefined' ? document : null))?.querySelectorAll?.('[data-ag-cs-cg-ext="1"]')?.forEach?.((n) => n.remove?.()); } catch {} };
  return { THRESHOLDS, TXT, sync, dispose };
});
