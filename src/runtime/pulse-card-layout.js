// Pulse Context Card 3-Tier Layout, Direct Long-Press Drag Reorder & Slim Visibility Strip (Channel 13)
(function (R, F) {
  const A = F(R);
  if (R) R.__agCsPulseCardLayout = A;
  if (typeof module === 'object' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (G) {
  'use strict';
  const SK = 'agCs.pulseCardLayout.v1', SA = 'data-ag-cs-pulse-layout-style', NS = 'http://www.w3.org/2000/svg';
  const HM = 280, CPX = 6, KP = ['speed', 'ttft', 'cache'];
  const BI = Object.freeze(['ctx', 'perf', 'quota']), II = Object.freeze(['model', 'comp', 'speed', 'ttft', 'cache', 'subagents']);
  const PL = [['b', 'ctx'], ['b', 'quota'], ['i', 'model'], ['i', 'comp'], ['i', 'speed'], ['i', 'ttft'], ['i', 'cache'], ['i', 'subagents']];
  const L = Object.fromEntries('editTip:显示与排序设置|顯示與排序設定|Customize Card|表示設定|카드 설정|Personalizar|Personnaliser|Anpassen|Özelleştir~editTitle:显示项|顯示項目|Visible Metrics|表示項目|표시 항목|Elementos|Éléments|Anzeige|Görünenler~dragHint:长按任意板块可拖拽排序|長按任意區塊可拖曳排序|Long-press section to reorder|セクション長押しで並び替え|섹션 길게 눌러 순서 변경|Mantén pulsado para ordenar|Appui long pour réorganiser|Lange drücken zum Sortieren|Sıralamak için uzun basın~reset:恢复默认|恢復預設|Reset|リセット|초기화|Restablecer|Réinit.|Zurück|Sıfırla~ctx:上下文|上下文|Context|コンテキスト|컨텍스트|Contexto|Contexte|Kontext|Bağlam~quota:配额|額度|Quota|枠|할당량|Cuota|Quota|Kontingent|Kota~model:模型|模型|Model|モデル|모델|Modelo|Modèle|Modell|Model~comp:构成条|構成條|Breakdown|内訳|구성|Desglose|Détail|Anteile|Dağılım~speed:速率|速率|Speed|速度|속도|Velocidad|Débit|Tempo|Hız~ttft:首字|首字|TTFT|初回|첫토큰|TTFT|||~cache:缓存|快取|Cache|キャッシュ|캐시|Caché|Cache||Önbellek~subagents:子代理|子代理|Subagents|サブ|서브|Subag.|Sous-ag.|Sub-Ag.|Alt~used:已用|已用|used|使用|사용|usado|utilisé|belegt|dolu~free:剩余|剩餘|free|残り|여유|libre||frei|boş~sys:系统|系統|System|システム|시스템|Sist.|Syst.|System|Sistem~msg:消息|訊息|Messages|会話|메시지|Mensajes|Messages|Nachr.|Mesaj~tool:工具|工具|Tools|ツール|도구|Herram.|Outils|Tools|Araç'.split('~').map((x) => { const i = x.indexOf(':'); let p = ''; return [x.slice(0, i), x.slice(i + 1).split('|').map((c) => (p = c || p))]; }));
  const lIdx = (r, w) => { let s = String(r || '').trim(); if (!s || s === 'auto') s = String((w || G)?.navigator?.language || ''); return /^zh[-_](tw|hant|hk|mo)/i.test(s) ? 1 : /^zh|^yue/i.test(s) ? 0 : ({ ja: 3, ko: 4, es: 5, fr: 6, de: 7, tr: 8 })[s.slice(0, 2).toLowerCase()] ?? 2; };
  const tr = (k, i) => L[k]?.[i] || L[k]?.[2] || k;
  const mkM = (ks, o) => Object.fromEntries(ks.map((k) => [k, typeof o?.[k] === 'boolean' ? o[k] : true]));
  const dP = () => ({ order: [...BI], blocks: mkM(BI), items: mkM(II) });
  const nP = (r) => {
    if (!r || typeof r !== 'object') return dP();
    const o = [];
    if (Array.isArray(r.order)) for (const id of r.order) if (BI.includes(id) && !o.includes(id)) o.push(id);
    for (const id of BI) if (!o.includes(id)) o.push(id);
    const b = mkM(BI, r.blocks), it = mkM(II, r.items);
    b.perf = KP.some((k) => it[k]) ? b.perf : false;
    if (!b.ctx && !b.quota && !(b.perf && KP.some((k) => it[k]))) b.ctx = true;
    return { order: o, blocks: b, items: it };
  };
  const loadP = (st) => { try { const s = st?.getItem?.(SK); return s ? nP(JSON.parse(s)) : dP(); } catch { return dP(); } };
  const saveP = (st, p) => { try { st?.setItem?.(SK, JSON.stringify(p)); } catch {} };

  const CSS = (() => {
    const T = [
      '#context-card[data-pvl="1"]', 'color-mix(in srgb,', 'display:flex;flex-direction:column', 'display:inline-flex;align-items:center',
      'font-variant-numeric:tabular-nums', 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'border-radius:', 'background:',
      'var(--', 'cursor:pointer', 'transparent', '[aria-pressed="true"]', 'justify-content:space-between', 'align-items:center',
      'white-space:nowrap', '!important', 'font-size:', 'font-weight:', 'border', 'color:', 'padding:', 'min-width:0', '.pvl-',
      '1px solid ', 'display:flex;', 'height:', 'width:', 'margin', 'opacity:', 'gap:', 'transition:.14s', '999px', 'px ', 'px;', 'px}',
      'user-select:none;-webkit-user-select:none', 'var(--ac)', 'var(--b)', 'var(--mu)', 'var(--f)', 'var(--ct)', '1px solid var(--b)',
      'color-mix(in srgb,var(--ac) ', 'flex:none', 'line-height:1.2', 'flex-wrap:wrap', 'align-items:baseline', 'position:relative',
      'data-pvl-drag="1"', 'box-shadow:0 12px 2', ':host([data-pv-light="1"]) ', 'var(--ez,cubic-bezier(.22,1,.36,1))', 'var(--ls,cubic-bezier(.22,1.22,.36,1))', ':host([data-pv-motion="',
    ];
    let s = '$0[data-ag-pulse-vial-mode="vial"]{$qmin(436px,calc(100vw - 24px))$f;$k13$w15$w14$w128px$f;min-$p242px$f}$0[data-ag-pulse-vial-mode="bar"]{$qmin(324px,calc(100vw - 24px))$f;$k13$w15$w14px$f}$0>#context-summary,$0>#context-tokens,$0>dl:not(.stats-grid),$0 .pv-bw .pv-tl{display:none$f}$0 .pv-bw{$r:0$f}$0 .pv-qt{$r-top:0$f;$k0$f;$i-top:0$f}$0 .pv-rail{$q104px$f;top:12px$f;bottom:12px$f;left:12px$f}$mcfg-btn{$3;justify-content:center;$q22$x$p22$x$k0;$6$v;$i:$F;$7$E;$j$C;$9;$u;$H}$mcfg-btn:hover,$mcfg-btn[aria-expanded="true"]{$j$D;$i-color:$G52%,$B);$7$G14%,$E)}:is($mcfg-btn,$mchip,$mrst):focus-visible{outline:2px solid $A;outline-offset:1px}$medit{display:grid$f;grid-template-rows:1fr;$r:2$w0 10$xvisibility:visible;pointer-events:auto;transition:grid-template-rows .24s $P,$r .24s $P,visibility 0s}$medit[hidden]{grid-template-rows:0fr;$r:0;visibility:hidden;pointer-events:none;transition:grid-template-rows .16s ease-in,$r .16s ease-in,visibility 0s linear .16s}$medit-in{min-$p0;overflow:hidden;$s1;transform:translateY(0) scale(1);filter:blur(0);transform-origin:top right;transition:opacity .2s $P,transform .24s $Q,filter .2s $P}$medit[hidden]>$medit-in{$s0;transform:translateY(-4px) scale(.965);filter:blur(4px);transition:opacity .14s ease-in,transform .14s ease-in,filter .14s ease-in}$medit-box{$2;$t6$x$k8$w10$x$69$x$i:$F;$7$1$D 3.5%,$a)}:is($mblk,$mmodel,$mcomp,$mleg-tip,$mleg-dots,$mkpi)[hidden]{display:none$f}$meh{$o$d;$c;$t8$y$met{$g10.5$x$h600;$j$8lb)}$mrst{$i:0;$7$a;$k2$w5$x$65$xfont:500 10.5px/1 $8ui);$j$C;$9}$mrst:hover{$j$D;$7$8hv)}$mchips{$o$J;$t5$y$mchip{$3;$t4.5$x$p21$x$k0 8$x$6$v;$i:$F;$7$E;$j$C;font:500 10.5px/1 $8ui);$9;$u}$mchip::before{content:"";$q4.5$x$p4.5$x$6$v;$7currentColor;$s.28}$mchip:hover{$j$D;$i-color:$G35%,$B)}$mchip$b{$7$G15%,$E);$i-color:$G48%,$B);$j$D;$h600}$mchip$b::before{$7$A;$s1}$mhint{$g10$x$j$C;$s.76;$I5}$mdeck{$2;$t11$x$r-top:2$x$L}$mblk{$2;$t7$x$l;$L;$69$xtouch-action:pan-y;transition:transform .16s,opacity .16s}$mblk[data-sep="1"]{$k10$w0 0;$i-top:$n$8d);$60}$mblk[data-pvl-arm="1"]{transform:scale(.992);$s.94;$z}$mdeck[data-pvl-dragging="1"] $mblk:not([$M]){$s.74}$mblk[$M]{z-index:6;cursor:grabbing;$z;transform:translate3d(0,var(--pvl-dy,0px),0) scale(1.018);$610$x$k8$w10$x$r:-8$w-10$x$i:$n$G54%,$B);$7$G9%,$8bg,#141722));$N8px -8px rgba(0,0,0,.55),0 0 0 1px $G24%,$a);transition:box-shadow .16s,$i-color .16s}$mctx-top{$o$K;$c;$t8$x$l}$mctx-l{display:inline-flex;$K;$t6$x$l;$J}$mpct{$g20$x$h600;line-height:1.05;letter-spacing:-.03em;$4;$j$D}$mpct[data-warn="1"]{$j$8wn)}$mpct[data-warn="2"]{$j$8er)}$msub{$g11$x$j$C;$4;$e}$mtok{font:500 11px/1.2 $8mo);$j$8lb);$4;$e;$H}$mmodel{$o$d;$t6$x$l;$g11.5$x$h500;$j$8ch);line-height:1.3}$mmdot{$q5$x$p5$x$6$v;$7$A;$s.85;$H}$mmtxt{$5;$l}$mcomp{$2;$t5$x$l}$mleg{$o$d;$c;$t8$xmin-$p15$x$g10.5$x$j$C;$4}$mleg-dots{$3;$t10$x$J}$mld{$3;$t4$x$e}$mld i{display:inline-block;$q6$x$p6$x$6$v;$7$8ldc,$A)}$mleg-tip{$j$8ch);$h500;$5}$mkpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));$68$x$i:$F;$7$1$D 3%,$a);overflow:hidden}$mkpi{$2;$t2$x$k7$w9$x$l}$mkpi:not([hidden])~$mkpi:not([hidden]){$i-left:$n$8d)}$mkl{$g10$x$h500;$j$C;$I;$e}$mkv{display:inline-flex;$K;$t2.5$x$g13$x$h600;$I;$j$D;$4;$5}$mkv small{$g10$x$h400;$j$C}$O:is($mkpis,$medit-box){$7rgba(15,23,42,.025)}$O$mblk[$M]{$7$G7%,#fff);$N6px -8px rgba(15,23,42,.22),0 0 0 1px $G28%,$a)}$Rsubtle"]) $medit{transition:grid-template-rows .14s ease-out,$r .14s ease-out,visibility 0s}$Rsubtle"]) $medit[hidden]{transition:grid-template-rows .12s ease-in,$r .12s ease-in,visibility 0s linear .12s}$Rsubtle"]) $medit-in{transform:none;filter:none;transition:opacity .12s ease-out}$Rsubtle"]) $medit[hidden]>$medit-in{transform:none;filter:none}$Roff"]) :is($medit,$medit-in,$mblk){transition-duration:0ms$f;filter:none$f}';
    const K = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = T.length; i--;) s = s.split('$' + K[i]).join(T[i]);
    return s;
  })();

  const DP = 'data-pvl-', BT = 'button', SP = 'span', DV = 'div';
  const EXCL = 'button,a,input,select,.pv-seg,.pv-qsw,.pv-qbtn,.pv-btn,[role="button"]';
  const tx = (e, v) => { e.textContent = '' + v; }, sa = (e, k, v) => e?.setAttribute?.(k, '' + v), ra = (e, k) => e?.removeAttribute?.(k);
  const gr = (e) => e?.getBoundingClientRect?.();
  const mk = (d, t, c, v) => { const e = d.createElement(t); if (c) e.className = c; if (v != null) tx(e, v); return e; };
  const ap = (p, ...cs) => { for (const c of cs) if (c) p.appendChild(c); return p; };
  const onC = (el, fn) => el.addEventListener('click', (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); fn(e); });
  const mkSl = (d) => {
    const s = (t, a) => { const n = d.createElementNS ? d.createElementNS(NS, t) : d.createElement(t); for (const k in a) sa(n, k, a[k]); return n; };
    return ap(s('svg', { viewBox: '0 0 12 12', width: 12, height: 12, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'aria-hidden': 'true' }),
      s('line', { x1: 2, y1: 4, x2: 10, y2: 4 }), s('line', { x1: 2, y1: 8, x2: 10, y2: 8 }),
      s('circle', { cx: 4.5, cy: 4, r: 1.2, fill: 'currentColor' }), s('circle', { cx: 7.5, cy: 8, r: 1.2, fill: 'currentColor' }));
  };
  const isExt = (sr) => !!(sr?.querySelector?.('dl.stats-grid,.quota-details,.quota-bar-head,[data-quota-section="1"]') || sr?.getElementById?.('five-quota-section') || sr?.getElementById?.('week-quota-section'));
  const stM = new WeakMap();

  function detach(sr) {
    if (!sr) return;
    const h = stM.get(sr);
    if (h) { try { h.edr?.(); for (const n of [h.bw, h.qE]) if (n && h.cd && n.parentNode !== h.cd) h.cd.appendChild(n); ra(h.cd, 'data-pvl'); } catch {} stM.delete(sr); }
    try { for (const n of sr.querySelectorAll?.(`[${SA}="1"],.pvl-cfg-btn,.pvl-edit,.pvl-deck`) || []) n.remove?.(); } catch {}
  }

  function applyO(h, vis) {
    const O = h.p.order; let pv = '';
    for (let k = 0; k < O.length; k++) {
      const id = O[k], el = h.bm[id]; if (!el) continue;
      const sh = vis ? !!vis[id] : !el.hidden;
      if (vis) el.hidden = !sh;
      if (el.style) el.style.order = '' + k;
      if (sh && pv && (id === 'quota' || pv === 'quota')) sa(el, 'data-sep', 1); else ra(el, 'data-sep');
      if (sh) pv = id;
    }
  }

  function bindD(h, id, el) {
    if (!el?.addEventListener) return;
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0 && ev.pointerType !== 'touch') return;
      if (ev.target?.closest?.(EXCL)) return;
      h.edr?.();
      const w = h.lc?.win || h.lc?.w || G, tg = w?.addEventListener ? w : h.d, sx = ev.clientX || 0, sy = ev.clientY || 0, pid = ev.pointerId;
      let ly = sy, bY = sy, act = 0, tm = 0, dy = 0;
      const sY = (v) => el.style?.setProperty?.('--pvl-dy', v), cl = (v) => Math.max(-220, Math.min(220, v));
      const setL = (a) => { const m = a ? 'addEventListener' : 'removeEventListener'; tg?.[m]?.('pointermove', onM); tg?.[m]?.('pointerup', onU); tg?.[m]?.('pointercancel', stp); };
      const done = (ok) => {
        if (tm) { clearTimeout(tm); tm = 0; }
        ra(el, DP + 'arm'); setL(0);
        if (h.edr === stp) h.edr = null;
        if (!act) return;
        act = 0;
        try { if (pid != null) el.releasePointerCapture?.(pid); } catch {}
        ra(el, DP + 'drag'); ra(h.dk, DP + 'dragging'); el.style?.removeProperty?.('--pvl-dy');
        h.sw = Date.now() + 260;
        if (ok) { saveP(h.sg, h.p); apply(h, h.lc); (h.lc?.onRelayout || h.lc?.onR)?.(); }
      };
      const stp = () => done(0), onU = () => done(1);
      const onM = (e) => {
        const cx = e.clientX || 0, cy = e.clientY || 0; ly = cy;
        if (!act) { if (Math.hypot(cx - sx, cy - sy) > CPX) done(0); return; }
        e.preventDefault?.();
        dy = cl(cy - bY); sY(dy.toFixed(1) + 'px');
        const vo = h.p.order.filter((k) => h.bm[k] && !h.bm[k].hidden), ci = vo.indexOf(id), er = gr(el);
        if (ci < 0 || !er) return;
        const dm = er.top + er.height / 2, chk = (k, u) => { const r = gr(h.bm[k]); return r && (u ? dm < r.top + r.height / 2 : dm > r.top + r.height / 2) ? k : ''; };
        const sw = (ci > 0 && chk(vo[ci - 1], 1)) || (ci < vo.length - 1 && chk(vo[ci + 1], 0));
        if (!sw) return;
        const nb = h.bm[sw], oE = er.top - dy, oN = gr(nb).top, o = h.p.order.slice(), ia = o.indexOf(id), ib = o.indexOf(sw);
        [o[ia], o[ib]] = [o[ib], o[ia]]; h.p.order = o; applyO(h, null);
        const nE = gr(el).top - dy, sh = oN - gr(nb).top, ns = nb.style;
        bY += nE - oE; dy = cl(cy - bY); sY(dy.toFixed(1) + 'px');
        if (ns && Math.abs(sh) > .5) { ns.transition = 'none'; ns.transform = `translate3d(0,${sh.toFixed(1)}px,0)`; nb.offsetHeight; ns.transition = 'transform .2s cubic-bezier(.22,1,.36,1)'; ns.transform = ''; setTimeout(() => { if (!nb.getAttribute?.(DP + 'drag')) ns.transition = ''; }, 220); }
      };
      sa(el, DP + 'arm', 1); h.edr = stp; setL(1);
      tm = setTimeout(() => { tm = 0; act = 1; bY = ly; dy = 0; ra(el, DP + 'arm'); sa(el, DP + 'drag', 1); sa(h.dk, DP + 'dragging', 1); sY('0px'); try { if (pid != null) el.setPointerCapture?.(pid); } catch {} }, HM);
    });
  }

  function attach(c) {
    const { sr, cd, hd, bw, qE } = c || {}, d = c?.doc || c?.d, sg = c?.storage || c?.sg;
    if (!sr || !cd || !d || isExt(sr)) return null;
    if (stM.has(sr)) return stM.get(sr);
    const p = loadP(sg), stE = mk(d, 'style', '', CSS), M = (t, k, x) => mk(d, t, k ? 'pvl-' + k : '', x), B = (k, x) => { const b = M(BT, k, x); b.type = BT; sa(b, 'type', BT); return b; };
    sa(stE, SA, 1); sr.appendChild(stE); sa(cd, 'data-pvl', 1);
    const ac = hd?.querySelector?.('.pv-acts'), cb = ap(B('cfg-btn'), mkSl(d));
    sa(cb, DP + 'cfg', 1); sa(cb, 'aria-expanded', 'false');
    if (ac) { const mb = ac.querySelector?.('.pv-btn'); mb && ac.insertBefore ? ac.insertBefore(cb, mb) : ac.appendChild(cb); }
    const eT = M(SP, 'et', ''), rst = B('rst', ''), cR = M(DV, 'chips'), ht = M(DV, 'hint', ''); sa(rst, DP + 'reset', 1); sa(ht, DP + 'hint', 1);
    const eb = ap(M(DV, 'edit'), ap(M(DV, 'edit-in'), ap(M(DV, 'edit-box'), ap(M(DV, 'eh'), eT, rst), cR, ht))); sa(eb, DP + 'edit', 1); sa(eb, 'aria-hidden', 'true'); eb.hidden = true; eb.inert = true;
    const pE = M('strong', 'pct', '0%'), sE = M(SP, 'sub', ''), tE = M(SP, 'tok', '');
    const mT = M(SP, 'mtxt', ''), mR = ap(M(DV, 'model'), M(SP, 'mdot'), mT); sa(mR, DP + 'item', 'model');
    const ld = M(SP, 'leg-dots'), lt = M(SP, 'leg-tip', ''); lt.hidden = true;
    const li = [0, 1, 2].map(() => { const dot = mk(d, 'i'), lbl = mk(d, SP, '', ''); ap(ld, ap(M(SP, 'ld'), dot, lbl)); return { dot, lbl }; });
    const cB = ap(M(DV, 'comp'), bw, ap(M(DV, 'leg'), ld, lt)); sa(cB, DP + 'item', 'comp');
    const cK = ap(M('section', 'blk'), ap(M(DV, 'ctx-top'), ap(M(SP, 'ctx-l'), pE, sE), tE), mR, cB); sa(cK, DP + 'blk', 'ctx');
    const ty = M(DV, 'kpis'), mkK = (id) => { const kl = M(SP, 'kl', ''), v = mk(d, SP, '', '—'), u = mk(d, 'small', '', ''), ce = ap(M(DV, 'kpi'), kl, ap(M(SP, 'kv'), v, u)); sa(ce, DP + 'kpi', id); ty.appendChild(ce); return { ce, kl, v, u }; };
    const kp = { speed: mkK('speed'), ttft: mkK('ttft'), cache: mkK('cache') };
    const pK = ap(M('section', 'blk'), ty); sa(pK, DP + 'blk', 'perf');
    const qK = ap(M('section', 'blk'), qE); sa(qK, DP + 'blk', 'quota');
    const dk = ap(M(DV, 'deck'), cK, pK, qK); sa(dk, DP + 'deck', 1);
    const rf = hd && hd.parentNode === cd ? hd.nextSibling : null;
    rf && cd.insertBefore ? (cd.insertBefore(eb, rf), cd.insertBefore(dk, rf)) : ap(cd, eb, dk);
    const h = { sr, cd, dk, bw, qE, d, sg, p, ed: false, lc: c, cb, eb, eT, rst, ht, bm: { ctx: cK, perf: pK, quota: qK }, pE, sE, tE, mR, mT, cB, ld, li, lt, kp, pl: {}, sw: 0, edr: null };
    h.sv = () => { saveP(sg, h.p); rCtrl(h); apply(h, h.lc); (h.lc?.onRelayout || h.lc?.onR)?.(); };
    cd.addEventListener?.('click', (e) => { if (Date.now() < h.sw) { e?.preventDefault?.(); e?.stopPropagation?.(); } }, true);
    onC(cb, () => { h.ed = !h.ed; eb.hidden = !h.ed; eb.inert = !h.ed; sa(eb, 'aria-hidden', !h.ed); sa(cb, 'aria-expanded', h.ed); if (h.ed) rCtrl(h); (h.lc?.onRelayout || h.lc?.onR)?.(); });
    onC(rst, () => { h.p = dP(); h.sv(); });
    const cV = (b, it) => (b.ctx ? 1 : 0) + (b.perf && KP.some((k) => it[k]) ? 1 : 0) + (b.quota ? 1 : 0);
    for (const [k, id] of PL) {
      const b = B('chip', ''); sa(b, DP + (k === 'b' ? 'toggle-blk' : 'toggle-item'), id);
      onC(b, () => {
        if (k === 'b') { if (h.p.blocks[id] && cV({ ...h.p.blocks, [id]: false }, h.p.items) < 1) return; h.p.blocks[id] = !h.p.blocks[id]; }
        else { const ni = { ...h.p.items, [id]: !h.p.items[id] }, np = KP.some((x) => ni[x]); if (KP.includes(id) && !np && cV({ ...h.p.blocks, perf: false }, ni) < 1) return; h.p.items[id] = ni[id]; if (KP.includes(id)) h.p.blocks.perf = np; }
        h.sv();
      });
      cR.appendChild(b); h.pl[k + ':' + id] = b;
    }
    for (const id of BI) bindD(h, id, h.bm[id]);
    stM.set(sr, h); rCtrl(h); apply(h, c);
    return h;
  }

  function rCtrl(h) {
    const p = h.p, i = lIdx(h.lc?.lang ?? h.lc?.l, h.lc?.win ?? h.lc?.w), tp = tr('editTip', i);
    sa(h.cb, 'title', tp); sa(h.cb, 'aria-label', tp); tx(h.eT, tr('editTitle', i)); tx(h.rst, tr('reset', i)); tx(h.ht, tr('dragHint', i));
    for (const [k, id] of PL) { const b = h.pl[k + ':' + id]; if (b) { tx(b, tr(id, i)); sa(b, 'aria-pressed', k === 'b' ? !!p.blocks[id] : !!p.items[id]); } }
  }

  function apply(h, c) {
    if (!h || !c) return;
    h.lc = c;
    const { st, rE, qK, kS, fS, T } = c, cs = c.cs || st?.cs, i = lIdx(c.lang ?? c.l, c.win ?? c.w), { blocks: B, items: I } = h.p;
    const pct = Math.round(Math.max(0, Math.min(9.99, Number(st?.f) || 0)) * 100), mx = st?.mx || 512000;
    tx(h.pE, pct + '%');
    if (st?.cr) sa(h.pE, 'data-warn', 2); else if (st?.wn) sa(h.pE, 'data-warn', 1); else ra(h.pE, 'data-warn');
    tx(h.sE, `${tr('used', i)} · ${Math.max(0, 100 - pct)}% ${tr('free', i)}`);
    tx(h.tE, `${st?.u != null ? kS(st.u) : pct + '%'} / ${kS(mx)}`);
    const m = String(st?.m || '').trim();
    h.mR.hidden = !(I.model && m); if (m) tx(h.mT, m);
    h.cB.hidden = !I.comp;
    const hs = typeof st?.hs === 'number' ? st.hs : -1, sK = ['sys', 'msg', 'tool'];
    for (let k = 0; k < 3; k++) { if (cs?.[k]) h.li[k].dot?.style?.setProperty?.('--ldc', cs[k]); tx(h.li[k].lbl, tr(sK[k], i)); }
    if (hs >= 0 && hs <= 2) {
      const r = st?.rt?.[hs] || 0;
      tx(h.lt, `${typeof T === 'function' ? T(2 + hs) : tr(sK[hs], i)} · ~${kS(Math.round(r * mx))} (${(r * 100).toFixed(1)}%)`);
      h.ld.hidden = true; h.lt.hidden = false;
    } else { h.ld.hidden = false; h.lt.hidden = true; }
    const rt = st?.l != null ? st.l : st?.t, okS = typeof rt === 'number' && Number.isFinite(rt) && rt > 1e-6, okT = typeof st?.tf === 'number' && Number.isFinite(st.tf) && st.tf >= 0;
    const cr = String(h.sr?.getElementById?.('cache-rate')?.textContent || '').trim(), okC = cr && cr !== '—' && /\d/.test(cr);
    const setK = (k, on, val, u) => { const x = h.kp[k]; tx(x.kl, tr(k, i)); tx(x.v, val); tx(x.u, u); x.ce.hidden = !on; };
    setK('speed', I.speed, okS ? rt.toFixed(1) : '—', okS ? 'tok/s' : '');
    setK('ttft', I.ttft, okT ? fS(st.tf).replace(/s$/, '') : '—', okT ? 's' : '');
    setK('cache', I.cache, okC ? cr : '—', '');
    const pOn = B.perf && (I.speed || I.ttft || I.cache);
    if (rE) rE.hidden = !(pOn && I.speed);
    if (qK) qK.hidden = !(Number(st?.tu?.subagents || 0) > 0 && I.subagents);
    applyO(h, { ctx: B.ctx, perf: pOn, quota: B.quota && !!(h.qE && !h.qE.hidden) });
    sa(h.cb, 'title', tr('editTip', i));
    if (h.ed) rCtrl(h);
  }

  return {
    STORAGE_KEY: SK, HOLD_MS: HM, BLOCK_IDS: BI, ITEM_IDS: II, LOCALES_TABLE: L, defaultPrefs: dP, normPrefs: nP, attach, detach,
    sync: (c) => { if (!c?.sr) return null; const h = stM.get(c.sr) || attach(c); if (h) apply(h, c); return h; },
    getCardWidth: (sr, m) => (!sr || !stM.has(sr) ? (m === 'vial' ? 396 : 304) : (m === 'vial' ? 436 : 324)),
  };
});
