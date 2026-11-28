// Shared zero-dependency interactive DOM fixture for custom-style & font-picker tests
export function createInteractiveDom(initialHtmlAttrs = {}, { innerWidth = 1280, innerHeight = 800 } = {}) {
  let innerHtmlWrites = 0;
  let rectOverride = null;

  const matchOne = (n, s) => {
    if (!s || n.nodeType !== 1) return false;
    if (s.startsWith('#')) return n.id === s.slice(1);
    let rest = s;
    const tm = rest.match(/^[a-zA-Z0-9-]+/);
    if (tm) { if (n.tagName !== tm[0].toUpperCase()) return false; rest = rest.slice(tm[0].length); }
    for (const m of rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)) if (!n.classList.contains(m[1])) return false;
    for (const m of rest.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
      if (!n.hasAttribute(m[1])) return false;
      if (m[2] !== undefined && n.getAttribute(m[1]) !== m[2]) return false;
    }
    return true;
  };
  const matches = (n, selList) => String(selList || '').split(',').some((raw) => {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (!parts.length || !matchOne(n, parts[parts.length - 1])) return false;
    let cur = n.parentNode;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (cur && !matchOne(cur, parts[i])) cur = cur.parentNode;
      if (!cur) return false;
      cur = cur.parentNode;
    }
    return true;
  });

  const makeEl = (tag, doc) => {
    const attrs = new Map();
    const listeners = new Map();
    const kids = [];
    const el = {
      nodeType: 1, tagName: String(tag).toUpperCase(), id: '', className: '', textContent: '', value: '',
      hidden: false, disabled: false, tabIndex: 0, scrollTop: 0, clientHeight: 276, scrollHeight: 276,
      ownerDocument: doc, children: kids, parentNode: null, parentElement: null,
      style: { setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; } },
      classList: {
        add(c) { if (!el.className.split(/\s+/).includes(c)) el.className = `${el.className} ${c}`.trim(); },
        remove(c) { el.className = el.className.split(/\s+/).filter((x) => x !== c).join(' '); },
        contains(c) { return el.className.split(/\s+/).includes(c); },
      },
      get firstChild() { return kids[0] || null; },
      get lastElementChild() { return kids[kids.length - 1] || null; },
      get nextSibling() { const p = el.parentNode, i = p ? p.children.indexOf(el) : -1; return i >= 0 ? p.children[i + 1] || null : null; },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') el.id = String(v); if (k === 'hidden') el.hidden = true; },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); if (k === 'hidden') el.hidden = false; },
      appendChild(c) {
        if (c && c.nodeType === 11) {
          for (const ch of [...c.children]) el.appendChild(ch);
          c.children.length = 0;
          return c;
        }
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = c.parentElement = el; kids.push(c);
        if (el.tagName === 'SELECT' && c.tagName === 'OPTION' && !el.value) el.value = c.value;
        return c;
      },
      insertBefore(c, ref) {
        if (c.parentNode) c.parentNode.removeChild(c);
        const i = ref ? kids.indexOf(ref) : -1;
        c.parentNode = c.parentElement = el;
        if (i < 0) kids.push(c); else kids.splice(i, 0, c);
        return c;
      },
      removeChild(c) { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); c.parentNode = c.parentElement = null; return c; },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      contains(target) { let cur = target; while (cur) { if (cur === el) return true; cur = cur.parentNode; } return false; },
      focus() { doc.activeElement = el; },
      scrollIntoView() {},
      getBoundingClientRect() { return rectOverride || { left: 140, top: 90, right: 340, bottom: 120, width: 200, height: 30 }; },
      addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
      removeEventListener(t, fn) { listeners.get(t)?.delete(fn); },
      dispatchEvent(ev) {
        let stopped = false;
        const e = Object.assign({ target: el, preventDefault() {}, stopPropagation() { stopped = true; } }, ev);
        for (const fn of [...(listeners.get(e.type) || [])]) fn(e);
        if (!stopped && e.bubbles && el.parentNode) el.parentNode.dispatchEvent(e);
        return true;
      },
      click() { if (!el.disabled) el.dispatchEvent({ type: 'click' }); },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const ch of n.children || []) {
            if (matches(ch, sel)) out.push(ch);
            walk(ch);
          }
        };
        walk(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
    };
    Object.defineProperty(el, 'innerHTML', { configurable: true, get: () => '', set: () => { innerHtmlWrites += 1; } });
    return el;
  };

  const docListeners = new Map();
  const winListeners = new Map();
  const doc = {
    activeElement: null, defaultView: null, documentElement: null, head: null, body: null,
    createElement: (t) => makeEl(t, doc),
    createElementNS: (_ns, t) => makeEl(t, doc),
    createDocumentFragment: () => ({ nodeType: 11, children: [], appendChild(c) { this.children.push(c); return c; } }),
    getElementById: (id) => doc.documentElement.querySelector('#' + id),
    querySelector: (s) => doc.documentElement.querySelector(s),
    querySelectorAll: (s) => doc.documentElement.querySelectorAll(s),
    addEventListener(t, fn) { if (!docListeners.has(t)) docListeners.set(t, new Set()); docListeners.get(t).add(fn); },
    removeEventListener(t, fn) { docListeners.get(t)?.delete(fn); },
    dispatchEvent(ev) { for (const fn of [...(docListeners.get(ev.type) || [])]) fn(ev); return true; },
  };
  doc.documentElement = makeEl('html', doc);
  doc.head = makeEl('head', doc);
  doc.body = makeEl('body', doc);
  for (const [k, v] of Object.entries(initialHtmlAttrs)) doc.documentElement.setAttribute(k, v);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);

  let nextRafId = 1;
  const pendingRafs = new Map();
  const win = {
    document: doc, innerWidth, innerHeight,
    addEventListener(t, fn) { if (!winListeners.has(t)) winListeners.set(t, new Set()); winListeners.get(t).add(fn); },
    removeEventListener(t, fn) { winListeners.get(t)?.delete(fn); },
    requestAnimationFrame(fn) { const id = nextRafId++; pendingRafs.set(id, fn); return id; },
    cancelAnimationFrame(id) { pendingRafs.delete(id); },
  };
  doc.defaultView = win;

  const countMap = (m) => [...m.values()].reduce((acc, set) => acc + set.size, 0);
  const flushRafs = () => {
    for (const [id, fn] of [...pendingRafs.entries()]) { pendingRafs.delete(id); fn(); }
  };
  return {
    doc, html: doc.documentElement, head: doc.head, body: doc.body, win,
    getInnerHtmlWrites: () => innerHtmlWrites,
    getDocListenerCount: () => countMap(docListeners),
    getWinListenerCount: () => countMap(winListeners),
    getPendingRafCount: () => pendingRafs.size,
    flushRafs,
    setTriggerRect: (r) => { rectOverride = r; },
  };
}

export function mountSettingsScaffold(doc, body) {
  const sec = doc.createElement('div');
  sec.id = 'ag-cs-settings-sec';
  sec.setAttribute('data-body-built', '1');
  sec.setAttribute('data-ag-cs-lang', 'en');
  const groupBody = doc.createElement('div');

  const mkRow = (key, buildCtrl) => {
    const row = doc.createElement('div');
    row.setAttribute('data-ag-cs-row', key);
    const inner = doc.createElement('div');
    inner.className = 'py-2';
    const ctrl = doc.createElement('div');
    ctrl.className = 'shrink-0';
    buildCtrl(row, ctrl);
    inner.appendChild(ctrl);
    row.appendChild(inner);
    groupBody.appendChild(row);
    return row;
  };

  const chatRow = mkRow('chatFont', (row, ctrl) => {
    const sel = doc.createElement('select');
    sel.setAttribute('data-ag-cs-ext-select', 'chatFont');
    ctrl.appendChild(sel);
    const box = doc.createElement('div');
    box.className = 'ag-cs-font-custom-box';
    const inp = doc.createElement('input');
    box.appendChild(inp);
    row.appendChild(box);
    row.__extSelect = sel;
    row.__extCustomUi = { box, inp };
  });

  const codeRow = mkRow('codeFont', (row, ctrl) => {
    const grp = doc.createElement('div');
    grp.className = 'ag-cs-seg-group';
    for (const v of ['default', 'jetbrains', 'cascadia', 'sfmono', 'custom']) {
      const b = doc.createElement('button');
      b.setAttribute('data-ag-cs-key', 'codeFont');
      b.setAttribute('data-ag-cs-val', JSON.stringify(v));
      grp.appendChild(b);
    }
    ctrl.appendChild(grp);
    const box = doc.createElement('div');
    box.className = 'ag-cs-font-custom-box';
    const inp = doc.createElement('input');
    box.appendChild(inp);
    row.appendChild(box);
    row.__extCustomUi = { box, inp };
  });

  const ligRow = mkRow('codeLigatures', (_row, ctrl) => {
    const grp = doc.createElement('div');
    grp.className = 'ag-cs-seg-group';
    const onBtn = doc.createElement('button');
    onBtn.setAttribute('data-ag-cs-key', 'codeLigatures');
    grp.appendChild(onBtn);
    ctrl.appendChild(grp);
  });

  sec.appendChild(groupBody);
  body.appendChild(sec);
  return { sec, groupBody, chatRow, codeRow, ligRow };
}
