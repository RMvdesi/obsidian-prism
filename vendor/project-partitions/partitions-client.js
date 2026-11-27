// Obsidian Prism - Project Partitions Channel (vendor/project-partitions/partitions-client.js)
// Opt-in 3-level project partitioning in Antigravity sidebar (Partition -> Project -> Conversations).
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const UI =
    G.__agPrismProjectPartitionsUi ||
    (typeof window !== 'undefined' && window.__agPrismProjectPartitionsUi) ||
    (typeof require === 'function' ? require('./partitions-ui.js') : null);
  const HOST =
    G.__agPrismProjectPartitionsHost ||
    (typeof window !== 'undefined' && window.__agPrismProjectPartitionsHost) ||
    (typeof require === 'function' ? require('./partitions-host.js') : null);
  if (!UI || !HOST) return;

  const {
    STORAGE_KEY, STYLE_ID, HIDE_STYLE_ID, ROOT_ATTR, MAX_VISIBLE_CONVS,
    PARTITIONS_CSS, I18N, safe, fmt, cssEsc, resolveLang, markOwned, el,
    makeIcon, formatRelativeTime, buildRunningDots, positionPopup, buildPopupMenu, openNameDialog,
  } = UI;
  const { normalizeUriKey, parseTsMs, createHostBridge } = HOST;
  const makeId = () => 'part-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  function createProjectPartitionsController(opts = {}) {
    const win = opts.root || opts.win || G.window || G;
    const doc = opts.doc || win?.document || G.document || null;
    const ls = opts.storage || safe(() => win?.localStorage || G.localStorage) || null;
    let cfgLang = opts.config?.language && opts.config.language !== 'auto' ? opts.config.language : '';
    const getLangFn = typeof opts.getLang === 'function'
      ? opts.getLang
      : () => cfgLang || doc?.documentElement?.getAttribute?.('data-ag-cs-lang') || safe(() => win?.__agPrism?.getState?.()?.cfg?.language) || doc?.documentElement?.lang || 'en';

    let enabled = opts.enabled !== false && opts.mode !== 'off' && opts.config?.projectPartitions !== 'off';
    let destroyed = false;
    let state = { version: 1, partitions: [], projectToPartition: {}, expandedProjects: {} };
    const showAllConvsFor = new Set();
    const host = createHostBridge({ win, doc, hostStore: opts.hostStore || null, hostServices: opts.hostServices || null, hostRouter: opts.hostRouter || null, onHostChange: () => scheduleRender() });

    let bodyMo = null, observedListEl = null, renderRaf = 0, pollTimer = 0, toastEl = null, toastTimer = 0;
    let lastProjMenuTrigger = null, activeNativeMenu = null, activeSubmenu = null, activeFloatingMenu = null, activeDialog = null, submenuCloseTimer = 0;
    let diskLoadTimer = 0, diskLoadAttempts = 0, diskHydrated = false;
    const cleanups = [];
    const PERSIST_BINDING = opts.persistBinding || '__agPrismPartitionsCall';
    const L = () => I18N[resolveLang(getLangFn())] || I18N.en;

    function ensureStyleSheet() {
      if (!doc || destroyed || !enabled) return;
      const head = doc.head || doc.documentElement;
      if (!head) return;
      if (!doc.getElementById?.(STYLE_ID)) {
        const s = markOwned(el(doc, 'style', null, PARTITIONS_CSS));
        s.id = STYLE_ID;
        head.appendChild(s);
      }
      if (doc.documentElement?.getAttribute?.(ROOT_ATTR) !== '1') {
        doc.documentElement?.setAttribute?.(ROOT_ATTR, '1');
      }
    }

    function syncHideStyleSheet() {
      if (!doc) return;
      const head = doc.head || doc.documentElement;
      if (!head) return;
      const assignedIds = enabled ? Object.keys(state.projectToPartition).filter(Boolean) : [];
      let styleEl = doc.getElementById?.(HIDE_STYLE_ID);
      if (assignedIds.length === 0) {
        if (styleEl) safe(() => styleEl.remove());
        return;
      }
      const selectors = [];
      for (let i = 0; i < assignedIds.length; i++) {
        const esc = cssEsc(assignedIds[i]);
        selectors.push(`[data-testid="conversation-list-sidebar"] [data-sidebar-section-drop-id="${esc}"]`);
        selectors.push(`[data-testid="conversation-list-sidebar"] [data-sidebar-section-id="${esc}"]`);
      }
      const cssText = selectors.join(',') +
        '{height:0!important;min-height:0!important;max-height:0!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important;}';
      if (!styleEl) {
        styleEl = markOwned(el(doc, 'style'));
        styleEl.id = HIDE_STYLE_ID;
        head.appendChild(styleEl);
      }
      if (styleEl.textContent !== cssText) styleEl.textContent = cssText;
    }

    function normalizeState(parsed) {
      const def = { version: 1, partitions: [], projectToPartition: {}, expandedProjects: {} };
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return def;
      const partitions = [];
      const validIds = new Set();
      if (Array.isArray(parsed.partitions)) {
        for (const p of parsed.partitions) {
          if (partitions.length >= 100) break;
          if (!p || typeof p !== 'object') continue;
          const id = typeof p.id === 'string' ? p.id.trim().slice(0, 80) : '';
          const name = typeof p.name === 'string' ? p.name.trim().slice(0, 60) : '';
          if (!id || !name || validIds.has(id)) continue;
          validIds.add(id);
          partitions.push({ id, name, collapsed: Boolean(p.collapsed) });
        }
      }
      const p2p = {};
      if (parsed.projectToPartition && typeof parsed.projectToPartition === 'object' && !Array.isArray(parsed.projectToPartition)) {
        for (const [k, v] of Object.entries(parsed.projectToPartition)) if (k && validIds.has(v)) p2p[k] = v;
      }
      const exp = {};
      if (parsed.expandedProjects && typeof parsed.expandedProjects === 'object' && !Array.isArray(parsed.expandedProjects)) {
        for (const [k, v] of Object.entries(parsed.expandedProjects)) if (k && v) exp[k] = true;
      }
      return { version: 1, partitions, projectToPartition: p2p, expandedProjects: exp };
    }

    function loadState() {
      const parsed = ls ? safe(() => JSON.parse(ls.getItem(STORAGE_KEY) || '')) : null;
      return normalizeState(parsed);
    }

    function callPersistBinding(payloadObj) {
      const fn = win?.[PERSIST_BINDING] || G?.[PERSIST_BINDING];
      if (typeof fn !== 'function') return false;
      safe(() => fn(JSON.stringify(payloadObj)));
      return true;
    }

    const persistToDisk = () => callPersistBinding({ action: 'save', data: state });

    function requestDiskLoad() {
      if (destroyed) return;
      if (callPersistBinding({ action: 'load' })) {
        if (diskLoadTimer) { clearTimeout(diskLoadTimer); diskLoadTimer = 0; }
        return;
      }
      if (!diskHydrated && diskLoadAttempts < 8) {
        diskLoadAttempts += 1;
        if (diskLoadTimer) clearTimeout(diskLoadTimer);
        diskLoadTimer = setTimeout(() => {
          diskLoadTimer = 0;
          if (!destroyed && !diskHydrated) requestDiskLoad();
        }, 450);
        if (diskLoadTimer && typeof diskLoadTimer.unref === 'function') diskLoadTimer.unref();
      }
    }

    function applyPersistedState(rawData, exists = true) {
      if (destroyed) return;
      diskHydrated = true;
      if (diskLoadTimer) { clearTimeout(diskLoadTimer); diskLoadTimer = 0; }
      if (exists) {
        const next = normalizeState(rawData);
        const same = JSON.stringify(next) === JSON.stringify(state);
        state = next;
        if (ls) safe(() => ls.setItem(STORAGE_KEY, JSON.stringify(state)));
        if (!same || !doc?.querySelector?.('.ag-prism-partitions-root')) scheduleRender(true);
      } else if (state.partitions.length > 0) {
        persistToDisk();
      }
    }

    const saveState = () => {
      if (ls) safe(() => ls.setItem(STORAGE_KEY, JSON.stringify(state)));
      persistToDisk();
    };

    function showToast(msg) {
      if (destroyed || !doc?.body || !msg) return;
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = 0; }
      safe(() => toastEl?.remove());
      const node = markOwned(el(doc, 'div', 'ag-cs-ctx-toast ag-prism-part-toast', msg, { role: 'status' }));
      doc.body.appendChild(node);
      toastEl = node;
      toastTimer = setTimeout(() => {
        toastTimer = 0;
        if (toastEl === node) { safe(() => node.remove()); toastEl = null; }
      }, 2200);
    }

    function copyProjectName(project) {
      const name = String(project?.name || '').trim();
      if (!name) return;
      const cbs = host.getNativeProjectCallbacks(project.id);
      if (cbs?.onCopyClick) { safe(() => cbs.onCopyClick()); return; }
      if (win?.navigator?.clipboard?.writeText) win.navigator.clipboard.writeText(name).catch(() => {});
      showToast(L().copied);
    }

    const commitState = (immediate = true, toast = '') => {
      saveState();
      scheduleRender(immediate);
      if (toast) showToast(toast);
    };

    function createPartition(rawName, assignProjectId = null) {
      const name = String(rawName || '').trim().slice(0, 60);
      if (!name) return { ok: false, error: L().emptyName };
      if (state.partitions.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: L().duplicateName };
      const part = { id: makeId(), name, collapsed: false };
      state.partitions.push(part);
      if (assignProjectId) state.projectToPartition[assignProjectId] = part.id;
      commitState(true, assignProjectId ? fmt(L().movedTo, name) : fmt(L().createdToast, name));
      return { ok: true, partition: part };
    }

    function renamePartition(partId, rawName) {
      const name = String(rawName || '').trim().slice(0, 60);
      if (!name) return { ok: false, error: L().emptyName };
      const part = state.partitions.find((p) => p.id === partId);
      if (!part) return { ok: false, error: 'not-found' };
      if (state.partitions.some((p) => p.id !== partId && p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: L().duplicateName };
      part.name = name;
      commitState(true, fmt(L().renamedToast, name));
      return { ok: true };
    }

    function deletePartition(partId) {
      const idx = state.partitions.findIndex((p) => p.id === partId);
      if (idx < 0) return;
      state.partitions.splice(idx, 1);
      for (const [projId, pid] of Object.entries(state.projectToPartition)) {
        if (pid === partId) delete state.projectToPartition[projId];
      }
      commitState(true, L().deletedToast);
    }

    function movePartition(partId, delta) {
      const idx = state.partitions.findIndex((p) => p.id === partId);
      const next = idx + delta;
      if (idx < 0 || next < 0 || next >= state.partitions.length) return;
      const [item] = state.partitions.splice(idx, 1);
      state.partitions.splice(next, 0, item);
      commitState(true);
    }

    function assignProjectToPartition(projectId, partId) {
      if (!projectId) return;
      if (!partId) {
        if (state.projectToPartition[projectId]) {
          delete state.projectToPartition[projectId];
          commitState(true, L().removedToast);
        }
        return;
      }
      const part = state.partitions.find((p) => p.id === partId);
      if (!part) return;
      const nativeHdr = doc?.querySelector?.(`[data-sidebar-section-drop-id="${cssEsc(projectId)}"] [data-testid="project-header"]`);
      if (nativeHdr?.getAttribute?.('aria-expanded') === 'true') state.expandedProjects[projectId] = true;
      state.projectToPartition[projectId] = partId;
      part.collapsed = false;
      commitState(true, fmt(L().movedTo, part.name));
    }

    function togglePartitionCollapsed(partId) {
      const part = state.partitions.find((p) => p.id === partId);
      if (!part) return;
      part.collapsed = !part.collapsed;
      commitState(false);
    }

    function toggleProjectExpanded(projectId, force) {
      if (!projectId) return;
      const next = typeof force === 'boolean' ? force : !state.expandedProjects[projectId];
      if (next) state.expandedProjects[projectId] = true;
      else delete state.expandedProjects[projectId];
      commitState(false);
    }

    const cancelCloseSubmenu = () => { if (submenuCloseTimer) { clearTimeout(submenuCloseTimer); submenuCloseTimer = 0; } };
    function closeSubmenu() {
      cancelCloseSubmenu();
      if (activeSubmenu) { safe(() => activeSubmenu.remove()); activeSubmenu = null; }
      activeNativeMenu?.querySelector?.('.ag-prism-part-menu-item[data-highlighted="1"]')?.removeAttribute?.('data-highlighted');
    }
    const scheduleCloseSubmenu = () => { cancelCloseSubmenu(); submenuCloseTimer = setTimeout(() => { submenuCloseTimer = 0; closeSubmenu(); }, 170); };
    const closeFloatingMenu = () => { closeSubmenu(); if (activeFloatingMenu) { safe(() => activeFloatingMenu.remove()); activeFloatingMenu = null; } };
    const closeDialog = () => { if (activeDialog) { safe(() => activeDialog.remove()); activeDialog = null; } };
    function dismissNativeMenu() {
      closeSubmenu();
      if (!activeNativeMenu) return;
      const ref = activeNativeMenu;
      activeNativeMenu = null;
      safe(() => {
        const Ev = win?.KeyboardEvent || G.KeyboardEvent;
        if (!Ev) return;
        const ev = new Ev('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true });
        ref.dispatchEvent?.(ev);
        doc.dispatchEvent?.(ev);
      });
    }
    const closeAllPopups = () => { closeFloatingMenu(); dismissNativeMenu(); };

    function openPartitionNameDialog({ title, initialValue = '', onSubmit }) {
      closeDialog();
      closeAllPopups();
      if (!doc?.body) return;
      activeDialog = openNameDialog(doc, { title, initialValue, labels: L(), onSubmit, onClose: closeDialog });
    }

    function openPartitionSubmenu(projectId, anchorEl) {
      if (!doc?.body || !anchorEl || !projectId) return;
      cancelCloseSubmenu();
      closeSubmenu();
      const curPartId = state.projectToPartition[projectId] || '';
      const items = state.partitions.length === 0
        ? [{ empty: L().noPartitions }]
        : state.partitions.map((p) => ({
            icon: 'partition',
            label: p.name,
            checked: p.id === curPartId,
            stopPointerDown: true,
            onClick: () => { assignProjectToPartition(projectId, p.id === curPartId ? null : p.id); closeAllPopups(); },
          }));
      if (curPartId) {
        items.push({ sep: true }, { icon: 'undo', label: L().removeFromPartition, stopPointerDown: true, onClick: () => { assignProjectToPartition(projectId, null); closeAllPopups(); } });
      }
      items.push({ sep: true }, {
        icon: 'plus',
        label: L().newPartition,
        stopPointerDown: true,
        onClick: () => { closeAllPopups(); openPartitionNameDialog({ title: L().newPartition, onSubmit: (val) => createPartition(val, projectId) }); },
      });
      const sub = buildPopupMenu(doc, {
        className: 'ag-prism-part-submenu ag-prism-part-popup',
        attrs: { 'data-ag-part-submenu': '1' },
        items,
        onPointerEnter: cancelCloseSubmenu,
        onPointerLeave: scheduleCloseSubmenu,
      });
      doc.body.appendChild(sub);
      activeSubmenu = sub;
      anchorEl.setAttribute('data-highlighted', '1');
      positionPopup(win, sub, anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : { left: 100, right: 260, top: 100, bottom: 130 }, 'beside');
    }

    function createPartitionMenuTriggerRow(projectId, nativeStyle) {
      const curPartId = state.projectToPartition[projectId] || '';
      const curPart = curPartId ? state.partitions.find((p) => p.id === curPartId) : null;
      const item = markOwned(el(
        doc,
        'button',
        nativeStyle ? 'ag-prism-part-menu-item agy-overlay-item' : 'ag-prism-part-popup-item ag-prism-part-menu-item',
        null,
        { role: 'menuitem', 'aria-haspopup': 'menu' }
      ));
      const ic = el(doc, 'span', 'ag-prism-part-popup-icon');
      ic.appendChild(makeIcon(doc, 'partition', 15));
      item.appendChild(ic);
      item.appendChild(el(doc, 'span', 'ag-prism-part-popup-label', L().partition));
      if (curPart) item.appendChild(el(doc, 'span', 'ag-prism-part-menu-badge', curPart.name));
      const chev = el(doc, 'span', 'ag-prism-part-menu-chev');
      chev.appendChild(makeIcon(doc, 'chevronRight', 13));
      item.appendChild(chev);
      const openSub = () => openPartitionSubmenu(projectId, item);
      item.addEventListener('pointerenter', openSub);
      item.addEventListener('pointerleave', scheduleCloseSubmenu);
      item.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
      item.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openSub(); });
      return item;
    }

    function isProjectOptionsMenuEl(menuEl) {
      if (!menuEl || menuEl.getAttribute?.('data-ag-part-submenu') === '1' || menuEl.getAttribute?.('data-ag-owned') === '1') return false;
      if (lastProjMenuTrigger && Date.now() - lastProjMenuTrigger.ts < 1200 && lastProjMenuTrigger.triggerId) {
        const lid = menuEl.getAttribute?.('aria-labelledby') || menuEl.querySelector?.('[role="menu"]')?.getAttribute?.('aria-labelledby') || '';
        if (lid && lid === lastProjMenuTrigger.triggerId) return true;
      }
      const hasOps = /(?:Copy Project Name|Project Settings|Delete Project|Show in File Explorer|Reveal in Finder|复制项目名称|项目配置|删除项目|在文件资源管理器中显示)/i.test(String(menuEl.textContent || ''));
      return hasOps && Boolean(lastProjMenuTrigger && Date.now() - lastProjMenuTrigger.ts < 2000);
    }

    function tryInjectIntoNativeMenu(rootNode) {
      if (!enabled || destroyed || !lastProjMenuTrigger) return false;
      const candidates = [];
      if (rootNode?.matches?.('[role="menu"], .agy-overlay')) candidates.push(rootNode);
      if (rootNode?.querySelectorAll) candidates.push(...rootNode.querySelectorAll('[role="menu"], .agy-overlay'));
      for (const cand of candidates) {
        if (!isProjectOptionsMenuEl(cand)) continue;
        const container = cand.matches?.('[role="menu"]') ? cand : cand.querySelector?.('[role="menu"]') || cand;
        const projectId = lastProjMenuTrigger.projectId;
        if (!container || !projectId || container.querySelector?.('.ag-prism-part-menu-item')) continue;
        const sep = markOwned(el(doc, 'div', 'ag-prism-part-menu-sep', null, { role: 'separator' }));
        const triggerRow = createPartitionMenuTriggerRow(projectId, true);
        const items = Array.from(container.children || []).filter((ch) => ch.getAttribute?.('role') === 'menuitem' || ch.matches?.('.agy-overlay-item, button'));
        const delItem = items.find((n) => /(?:Delete Project|Remove Project|删除项目|刪除專案)/i.test(n.textContent || ''));
        if (delItem && delItem.parentElement === container) {
          container.insertBefore(triggerRow, delItem);
          container.insertBefore(sep, delItem);
        } else {
          container.appendChild(sep);
          container.appendChild(triggerRow);
        }
        for (const sib of items) {
          if (sib._agPartHoverBound) continue;
          sib._agPartHoverBound = true;
          sib.addEventListener?.('pointerenter', closeSubmenu);
        }
        activeNativeMenu = cand;
        return true;
      }
      return false;
    }

    function openFloatingPopup(anchorBtn, className, items) {
      if (!doc?.body || !anchorBtn) return;
      closeAllPopups();
      const menu = buildPopupMenu(doc, { className, items });
      doc.body.appendChild(menu);
      activeFloatingMenu = menu;
      positionPopup(win, menu, anchorBtn.getBoundingClientRect ? anchorBtn.getBoundingClientRect() : { left: 100, right: 120, top: 100, bottom: 120 }, 'below');
    }

    function openProjectOptionsMenu(project, anchorBtn) {
      if (!project) return;
      const cbs = host.getNativeProjectCallbacks(project.id);
      const wrapAct = (fn) => () => { closeAllPopups(); fn(); };
      const items = [{ icon: 'copy', iconSize: 15, label: L().copyProjectName, onPointerEnter: closeSubmenu, onClick: wrapAct(() => copyProjectName(project)) }];
      if (cbs?.onSettingsClick) items.push({ icon: 'settings', iconSize: 15, label: L().projectSettings, onPointerEnter: closeSubmenu, onClick: wrapAct(() => safe(() => cbs.onSettingsClick())) });
      if (cbs?.onRevealClick) items.push({ icon: 'external', iconSize: 15, label: L().revealInExplorer, onPointerEnter: closeSubmenu, onClick: wrapAct(() => safe(() => cbs.onRevealClick())) });
      items.push({ sep: true }, { node: createPartitionMenuTriggerRow(project.id, false) });
      if (cbs?.onDeleteClick) {
        items.push({ sep: true }, { icon: 'trash', iconSize: 15, label: L().deleteProject, danger: true, onPointerEnter: closeSubmenu, onClick: wrapAct(() => safe(() => cbs.onDeleteClick())) });
      }
      openFloatingPopup(anchorBtn, 'ag-prism-part-popup ag-prism-part-project-menu', items);
    }

    function openPartitionOptionsMenu(partition, partIndex, anchorBtn) {
      if (!partition) return;
      const wrapAct = (fn) => () => { closeAllPopups(); fn(); };
      openFloatingPopup(anchorBtn, 'ag-prism-part-popup', [
        { icon: 'edit', label: L().renamePartition, onClick: wrapAct(() => openPartitionNameDialog({ title: L().renamePartition, initialValue: partition.name, onSubmit: (val) => renamePartition(partition.id, val) })) },
        { icon: 'arrowUp', label: L().moveUp, disabled: partIndex <= 0, onClick: wrapAct(() => movePartition(partition.id, -1)) },
        { icon: 'arrowDown', label: L().moveDown, disabled: partIndex >= state.partitions.length - 1, onClick: wrapAct(() => movePartition(partition.id, 1)) },
        { sep: true },
        { icon: 'plus', label: L().newPartition, onClick: wrapAct(() => openPartitionNameDialog({ title: L().newPartition, onSubmit: (val) => createPartition(val) })) },
        { sep: true },
        { icon: 'trash', label: L().deletePartition, danger: true, onClick: wrapAct(() => deletePartition(partition.id)) },
      ]);
    }

    const makeIconBtn = (icon, size, label, onClick, cls = 'ag-prism-part-icon-btn') => {
      const b = el(doc, 'button', cls, null, { 'aria-label': label, title: label });
      b.appendChild(makeIcon(doc, icon, size));
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(b); });
      return b;
    };

    function ensureProjectsHeaderAddPartitionBtn(listEl) {
      const sh = listEl?.querySelector?.('[data-testid="section-header"][data-title="Projects"]');
      const addProjBtn = sh?.querySelector?.('[data-testid="sidebar-add-project-button"]');
      const btnBar = addProjBtn?.parentElement;
      if (!btnBar) return;
      let btn = btnBar.querySelector?.('.ag-prism-part-add-btn');
      if (!enabled) { safe(() => btn?.remove()); return; }
      if (!btn) {
        btn = markOwned(makeIconBtn('partitionAdd', 15, L().newPartition, () => openPartitionNameDialog({ title: L().newPartition, onSubmit: (val) => createPartition(val) }), 'ag-prism-part-add-btn agy-button agy-button-icon-sm'));
        btnBar.insertBefore(btn, addProjBtn);
      } else {
        btn.setAttribute('aria-label', L().newPartition);
        btn.title = L().newPartition;
      }
    }

    function buildProjectBranch(proj, convs, expanded, activeCid) {
      const wrap = el(doc, 'div', 'ag-prism-part-project', null, { 'data-project-id': proj.id, 'data-expanded': expanded ? '1' : '0' });
      const row = el(doc, 'div', 'ag-prism-part-proj-row');
      const btn = el(doc, 'button', 'ag-prism-part-proj-btn', null, { 'aria-expanded': expanded ? 'true' : 'false' });
      const ic = el(doc, 'span', 'ag-prism-part-proj-icon');
      ic.appendChild(makeIcon(doc, expanded ? 'folderOpen' : 'folder', 15));
      btn.appendChild(ic);
      btn.appendChild(el(doc, 'span', 'ag-prism-part-proj-name', proj.name));
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleProjectExpanded(proj.id); });

      const acts = el(doc, 'div', 'ag-prism-part-proj-actions');
      acts.appendChild(makeIconBtn('moreVert', 14, L().projectOptions, (b) => openProjectOptionsMenu(proj, b)));
      acts.appendChild(makeIconBtn('plus', 14, L().newConvInProject, () => host.navigateToNewConversation(proj.id)));
      row.appendChild(btn);
      row.appendChild(acts);
      wrap.appendChild(row);

      const convGrid = el(doc, 'div', 'ag-prism-part-grid', null, { 'data-collapsed': expanded ? '0' : '1' });
      const convInner = el(doc, 'div', 'ag-prism-part-grid-inner ag-prism-part-conv-list');
      if (expanded) {
        if (convs.length === 0) {
          convInner.appendChild(el(doc, 'div', 'ag-prism-part-empty ag-prism-part-empty-conv', L().emptyConvs));
        } else {
          const showAll = showAllConvsFor.has(proj.id);
          const limit = showAll ? convs.length : Math.min(convs.length, MAX_VISIBLE_CONVS);
          for (let i = 0; i < limit; i++) {
            const c = convs[i];
            const cBtn = el(doc, 'button', 'ag-prism-part-conv-row agy-sidebar-row', null, {
              'data-cascade-id': c.cascadeId,
              'data-selected': activeCid && c.cascadeId === activeCid ? 'true' : null,
              'data-ag-cs-row-running': c.running ? '1' : null,
            });
            cBtn.appendChild(el(doc, 'span', 'ag-prism-part-conv-title truncate', c.title, { title: c.title }));
            const meta = el(doc, 'span', 'ag-prism-part-conv-meta');
            if (c.running) {
              meta.appendChild(buildRunningDots(doc));
            } else {
              if (c.pinned) {
                const pin = el(doc, 'span', 'ag-prism-part-pin');
                pin.appendChild(makeIcon(doc, 'pin', 11));
                meta.appendChild(pin);
              }
              const timeStr = formatRelativeTime(c.updatedAt, L().now);
              if (timeStr) meta.appendChild(el(doc, 'span', 'ag-prism-part-conv-time', timeStr));
            }
            cBtn.appendChild(meta);
            cBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              host.navigateToConversation(c.cascadeId);
              setTimeout(() => scheduleRender(false), 60);
            });
            convInner.appendChild(cBtn);
          }
          if (convs.length > MAX_VISIBLE_CONVS) {
            const moreBtn = el(doc, 'button', 'ag-prism-part-more-convs', showAll ? L().showLess : `${L().showMore} (${convs.length - MAX_VISIBLE_CONVS})`);
            moreBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (showAll) showAllConvsFor.delete(proj.id);
              else showAllConvsFor.add(proj.id);
              scheduleRender(false);
            });
            convInner.appendChild(moreBtn);
          }
        }
      }
      convGrid.appendChild(convInner);
      wrap.appendChild(convGrid);
      return wrap;
    }

    function renderPartitions() {
      if (destroyed || !doc) return;
      ensureStyleSheet();
      const listEl = doc.querySelector?.('[data-testid="conversation-list-sidebar"]');
      if (!listEl) { syncHideStyleSheet(); return; }
      observedListEl = listEl;
      host.captureAllNativeProjectCallbacks();
      ensureProjectsHeaderAddPartitionBtn(listEl);

      const existingRoot = listEl.querySelector?.('.ag-prism-partitions-root');
      if (!enabled || state.partitions.length === 0) {
        if (existingRoot) safe(() => existingRoot.remove());
        syncHideStyleSheet();
        return;
      }

      const { projects, seenIds, fromHostCatalog } = host.readProjects();
      if (fromHostCatalog && projects.length > 0) {
        let pruned = false;
        for (const mapObj of [state.projectToPartition, state.expandedProjects]) {
          for (const pid of Object.keys(mapObj)) if (!seenIds.has(pid)) { delete mapObj[pid]; pruned = true; }
        }
        if (pruned) saveState();
      }
      const convsByProject = host.readConversationsByProject(projects, L().untitled);
      const activeCid = host.getActiveCascadeId();
      const projectsByPart = new Map(state.partitions.map((p) => [p.id, []]));
      for (const p of projects) {
        const partId = state.projectToPartition[p.id];
        if (partId && projectsByPart.has(partId)) projectsByPart.get(partId).push(p);
      }

      const rootEl = existingRoot || markOwned(el(doc, 'div', 'ag-prism-partitions-root', null, { 'data-ag-prism-partitions': '1' }));
      const items = state.partitions.map((part, pi) => {
        const partProjects = projectsByPart.get(part.id) || [];
        const collapsed = Boolean(part.collapsed);
        const sec = el(doc, 'div', 'ag-prism-part-section', null, { 'data-part-id': part.id, 'data-collapsed': collapsed ? 'true' : 'false' });
        const headRow = el(doc, 'div', 'ag-prism-part-sec-head', null, { 'data-ag-part-header': '1' });
        const toggleBtn = el(doc, 'button', 'ag-prism-part-sec-toggle', null, { 'aria-expanded': collapsed ? 'false' : 'true' });
        toggleBtn.appendChild(el(doc, 'span', 'ag-prism-part-sec-title', part.name));
        const chev = el(doc, 'span', 'ag-prism-part-sec-chev');
        chev.appendChild(makeIcon(doc, 'chevronRight', 13));
        toggleBtn.appendChild(chev);
        toggleBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); togglePartitionCollapsed(part.id); });

        const secActs = el(doc, 'div', 'ag-prism-part-sec-actions');
        secActs.appendChild(makeIconBtn('moreVert', 14, L().partitionOptions, (b) => openPartitionOptionsMenu(part, pi, b)));
        headRow.appendChild(toggleBtn);
        headRow.appendChild(secActs);
        sec.appendChild(headRow);

        const bodyGrid = el(doc, 'div', 'ag-prism-part-grid', null, { 'data-collapsed': collapsed ? '1' : '0' });
        const bodyInner = el(doc, 'div', 'ag-prism-part-grid-inner');
        if (partProjects.length === 0) {
          bodyInner.appendChild(el(doc, 'div', 'ag-prism-part-empty', L().emptyProjects));
        } else {
          for (const proj of partProjects) {
            bodyInner.appendChild(buildProjectBranch(proj, convsByProject.get(proj.id) || [], Boolean(state.expandedProjects[proj.id]), activeCid));
          }
        }
        bodyGrid.appendChild(bodyInner);
        sec.appendChild(bodyGrid);
        return sec;
      });

      if (typeof rootEl.replaceChildren === 'function') rootEl.replaceChildren(...items);
      else {
        while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild);
        for (const it of items) rootEl.appendChild(it);
      }
      if (!existingRoot) {
        if (listEl.firstChild && typeof listEl.insertBefore === 'function') listEl.insertBefore(rootEl, listEl.firstChild);
        else listEl.appendChild(rootEl);
      }
      syncHideStyleSheet();
    }

    function scheduleRender(immediate = false) {
      if (destroyed) return;
      if (immediate) {
        if (renderRaf && typeof cancelAnimationFrame === 'function') { safe(() => cancelAnimationFrame(renderRaf)); renderRaf = 0; }
        safe(renderPartitions);
        return;
      }
      if (renderRaf) return;
      const raf = win?.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
      renderRaf = raf(() => { renderRaf = 0; if (!destroyed) safe(renderPartitions); });
    }

    function recordProjectTriggerFromEvent(target) {
      const btn = target?.closest?.('button[aria-haspopup="menu"]');
      const dropRow = btn?.closest?.('[data-sidebar-section-drop-id]');
      const projectId = dropRow?.getAttribute?.('data-sidebar-section-drop-id') || '';
      if (!projectId || projectId === 'main-section-header' || projectId === 'standalone') return;
      const ph = dropRow.querySelector?.('[data-testid="project-header"]');
      if (!ph) return;
      host.captureCallbacksFromRow(projectId, dropRow);
      lastProjMenuTrigger = { projectId, projectName: ph.getAttribute('data-project-label') || ph.textContent?.trim() || '', triggerId: btn.id || '', ts: Date.now() };
    }

    function init() {
      if (!doc || !win) return;
      if (opts.hasPersistedState && opts.initialState && typeof opts.initialState === 'object') {
        state = normalizeState(opts.initialState);
        if (ls) safe(() => ls.setItem(STORAGE_KEY, JSON.stringify(state)));
      } else {
        state = loadState();
      }
      if (!enabled) return;

      const onPointerDown = (e) => {
        if (destroyed || !enabled) return;
        const target = e.target;
        recordProjectTriggerFromEvent(target);
        if (activeFloatingMenu && !activeFloatingMenu.contains?.(target) && (!activeSubmenu || !activeSubmenu.contains?.(target))) closeFloatingMenu();
        if (activeSubmenu && !activeSubmenu.contains?.(target) && !target?.closest?.('.ag-prism-part-menu-item')) closeSubmenu();
      };
      const onKeyDown = (e) => {
        if (destroyed || e.key !== 'Escape') return;
        if (activeDialog) closeDialog();
        else if (activeSubmenu) closeSubmenu();
        else if (activeFloatingMenu) closeFloatingMenu();
      };
      const onStorage = (e) => { if (!destroyed && e && e.key === STORAGE_KEY) { state = loadState(); scheduleRender(true); } };
      const onPopState = () => { if (!destroyed && enabled) scheduleRender(false); };

      doc.addEventListener?.('pointerdown', onPointerDown, true);
      doc.addEventListener?.('keydown', onKeyDown, true);
      win.addEventListener?.('storage', onStorage);
      win.addEventListener?.('popstate', onPopState);
      cleanups.push(
        () => doc.removeEventListener?.('pointerdown', onPointerDown, true),
        () => doc.removeEventListener?.('keydown', onKeyDown, true),
        () => win.removeEventListener?.('storage', onStorage),
        () => win.removeEventListener?.('popstate', onPopState)
      );

      const MO = win.MutationObserver || G.MutationObserver;
      if (typeof MO === 'function' && doc.body) {
        bodyMo = new MO((mutations) => {
          if (destroyed || !enabled) return;
          if (activeNativeMenu && activeNativeMenu.isConnected === false) { activeNativeMenu = null; closeSubmenu(); }
          let needSidebarCheck = false;
          for (const m of mutations) {
            if (m.type !== 'childList') continue;
            for (const n of m.addedNodes || []) {
              if (!n || n.nodeType !== 1 || n.getAttribute?.('data-ag-owned') === '1') continue;
              if (lastProjMenuTrigger && Date.now() - lastProjMenuTrigger.ts < 2000 && (n.matches?.('[role="menu"], .agy-overlay') || n.querySelector?.('[role="menu"], .agy-overlay'))) {
                tryInjectIntoNativeMenu(n);
              }
              if (n.matches?.('[data-testid="conversation-list-sidebar"]') || n.querySelector?.('[data-testid="conversation-list-sidebar"]')) needSidebarCheck = true;
            }
          }
          if (needSidebarCheck) scheduleRender(false);
        });
        bodyMo.observe(doc.body, { childList: true, subtree: true });
      }

      pollTimer = setInterval(() => {
        if (destroyed || !enabled) return;
        const listEl = doc.querySelector?.('[data-testid="conversation-list-sidebar"]');
        if (listEl && (observedListEl !== listEl || (state.partitions.length > 0 && !listEl.querySelector?.('.ag-prism-partitions-root')))) {
          scheduleRender(false);
        }
      }, 1500);
      if (pollTimer && typeof pollTimer.unref === 'function') pollTimer.unref();

      scheduleRender(true);
      requestDiskLoad();
    }

    function sync(nextCfg) {
      if (destroyed) return;
      const cfgObj = nextCfg && typeof nextCfg === 'object' ? nextCfg : {};
      if (typeof cfgObj.language === 'string') cfgLang = cfgObj.language !== 'auto' ? cfgObj.language : '';
      enabled = cfgObj.projectPartitions === 'on' || cfgObj.projectPartitions === true;
      if (!enabled) { destroy(); return; }
      scheduleRender(true);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      enabled = false;
      if (renderRaf && typeof cancelAnimationFrame === 'function') { safe(() => cancelAnimationFrame(renderRaf)); renderRaf = 0; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = 0; }
      if (diskLoadTimer) { clearTimeout(diskLoadTimer); diskLoadTimer = 0; }
      cancelCloseSubmenu();
      closeAllPopups();
      closeDialog();
      safe(() => toastEl?.remove());
      if (bodyMo) { safe(() => bodyMo.disconnect()); bodyMo = null; }
      host.dispose();
      while (cleanups.length) safe(cleanups.pop());
      safe(() => doc?.documentElement?.removeAttribute?.(ROOT_ATTR));
      safe(() => doc?.getElementById?.(STYLE_ID)?.remove());
      safe(() => doc?.getElementById?.(HIDE_STYLE_ID)?.remove());
      doc?.querySelectorAll?.('.ag-prism-partitions-root, .ag-prism-part-add-btn, .ag-prism-part-menu-item, .ag-prism-part-menu-sep, .ag-prism-part-popup, .ag-prism-part-dialog-backdrop').forEach((n) => safe(() => n.remove()));
    }

    init();

    return {
      sync,
      destroy,
      createPartition,
      renamePartition,
      deletePartition,
      movePartition,
      assignProjectToPartition,
      togglePartitionCollapsed,
      toggleProjectExpanded,
      tryInjectIntoNativeMenu,
      recordProjectTriggerFromEvent,
      renderPartitions,
      applyPersistedState,
      requestDiskLoad,
      getState: () => JSON.parse(JSON.stringify(state)),
      getStatus: () => ({
        status: destroyed ? 'destroyed' : enabled ? 'active' : 'off',
        mode: enabled ? 'on' : 'off',
        partitionCount: state.partitions.length,
        assignedCount: Object.keys(state.projectToPartition).length,
      }),
    };
  }

  function mountProjectPartitions(opts = {}) {
    const win = opts.root || G.window || G;
    if (win.__agPrismProjectPartitions && typeof win.__agPrismProjectPartitions.destroy === 'function') {
      safe(() => win.__agPrismProjectPartitions.destroy());
    }
    const inst = createProjectPartitionsController(opts);
    win.__agPrismProjectPartitions = inst;
    return inst;
  }

  const factoryApi = {
    PARTITIONS_CSS,
    I18N,
    resolveLang,
    STORAGE_KEY,
    STYLE_ID,
    HIDE_STYLE_ID,
    ROOT_ATTR,
    normalizeUriKey,
    parseTsMs,
    createProjectPartitionsController,
    mountProjectPartitions,
  };
  G.__agPrismProjectPartitionsFactory = factoryApi;
  if (typeof window !== 'undefined') window.__agPrismProjectPartitionsFactory = factoryApi;
  if (typeof module === 'object' && module.exports) module.exports = factoryApi;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
