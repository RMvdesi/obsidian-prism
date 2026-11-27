/**
 * Obsidian Prism - Live Telemetry Invoked Model Reader & Scoped Observer for Orchestrator Badge
 *
 * Contract:
 *   globalThis.__agPeriodicOrchLiveBadge (Browser) / module.exports (Node)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.__agPeriodicOrchLiveBadge = api;
  }
  if (typeof globalThis === 'object' && globalThis) {
    globalThis.__agPeriodicOrchLiveBadge = api;
  }
  if (typeof window === 'object' && window) {
    window.__agPeriodicOrchLiveBadge = api;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this,
  function () {
    'use strict';

    var BAR_SELECTOR = '[data-ag-prism-pulse-bar], #ag-prism-pulse-bar, [data-ag-pulse-bar="true"], #ag-pulse-status-bar';
    var ORCH_LABEL_RE = /orchestrator|\u7f16\u6392|\u8c03\u5ea6\u5668/i;
    var ORCH_ONLY_RE = /^(?:orchestrator|\u7f16\u6392|\u8c03\u5ea6\u5668)$/i;

    function resolvePulseHostForTelemetry(doc, rt, opts) {
      var anchor = opts && opts.anchorBtn ? opts.anchorBtn : null;
      var tel = rt && rt.__agPrismTelemetry;
      try {
        if (anchor && tel && typeof tel.getBarForView === 'function') {
          var byView = tel.getBarForView(anchor);
          if (byView && byView.shadowRoot) return byView;
        }
      } catch (e0) {}
      try {
        if (anchor && typeof anchor.closest === 'function') {
          var inputPane = anchor.closest('[data-testid="agent-input-box"]');
          if (inputPane && typeof inputPane.querySelector === 'function') {
            var inputBar = inputPane.querySelector(BAR_SELECTOR);
            if (inputBar && inputBar.shadowRoot) return inputBar;
          }
          var convPane = anchor.closest('[data-testid="conversation-view"]');
          if (convPane && convPane !== inputPane && typeof convPane.querySelector === 'function') {
            var convBar = convPane.querySelector(BAR_SELECTOR);
            if (convBar && convBar.shadowRoot) return convBar;
          }
        }
      } catch (e1) {}
      try {
        if (tel && typeof tel.getActiveBar === 'function') {
          var actBar = tel.getActiveBar();
          if (actBar && actBar.shadowRoot) return actBar;
        }
      } catch (e2) {}
      try {
        if (!doc) return null;
        return (
          (typeof doc.getElementById === 'function' &&
            (doc.getElementById('ag-prism-pulse-bar') || doc.getElementById('ag-pulse-status-bar'))) ||
          (typeof doc.querySelector === 'function' && doc.querySelector(BAR_SELECTOR)) ||
          null
        );
      } catch (e3) {
        return null;
      }
    }

    function resolveLiveModelDomNode(doc, rt, opts) {
      var pulseHost = resolvePulseHostForTelemetry(doc, rt, opts);
      var sr = pulseHost && pulseHost.shadowRoot;
      if (!sr) return null;
      var node =
        (typeof sr.getElementById === 'function' && sr.getElementById('context-model')) ||
        (typeof sr.querySelector === 'function' && sr.querySelector('#context-model')) ||
        null;
      return node ? { pulseHost: pulseHost, node: node } : null;
    }

    function sanitizeLiveInvokedModelLabel(raw) {
      var s = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!s || s === '\u2014' || s === '-') return '';
      if (/^antigravity\s+model$/i.test(s)) return '';
      if (ORCH_ONLY_RE.test(s)) return '';
      return s;
    }

    function readHostLiveInvokedModel(doc, rt, opts) {
      var tel = rt && rt.__agPrismTelemetry;
      var anchor = opts && opts.anchorBtn ? opts.anchorBtn : null;
      try {
        var hit = resolveLiveModelDomNode(doc, rt, opts);
        if (hit && hit.node) {
          var domModel = sanitizeLiveInvokedModelLabel(hit.node.textContent);
          if (domModel) {
            var isFallbackBar =
              typeof hit.pulseHost.getAttribute === 'function' &&
              hit.pulseHost.getAttribute('data-ag-prism-fallback') === '1';
            var skipLocalEst = false;
            if (isFallbackBar && tel && typeof tel.getSnapshotForBar === 'function') {
              try {
                var hostSnap = tel.getSnapshotForBar(hit.pulseHost);
                if (hostSnap && hostSnap.connection === 'local-estimate') skipLocalEst = true;
              } catch (eSnap0) {}
            }
            if (!skipLocalEst) return domModel;
          }
        }
      } catch (eDom) {}
      try {
        if (tel && typeof tel.getSnapshotForBar === 'function') {
          var scopedBar =
            anchor && typeof tel.getBarForView === 'function'
              ? tel.getBarForView(anchor)
              : typeof tel.getActiveBar === 'function'
              ? tel.getActiveBar()
              : null;
          var snap = tel.getSnapshotForBar(scopedBar || anchor);
          if (snap && typeof snap === 'object' && snap.connection !== 'local-estimate' && snap.speed) {
            var snapModel = sanitizeLiveInvokedModelLabel(
              (snap.speed.context && snap.speed.context.model) || snap.speed.model || ''
            );
            if (snapModel) return snapModel;
          }
        }
      } catch (eSnap1) {}
      return '';
    }

    function resolveLiveOrchBadge(btn, ctx) {
      if (!btn || !ctx || !ctx.catalog || !ctx.hostBridge) return null;
      var liveModel = readHostLiveInvokedModel(ctx.doc, ctx.root, { anchorBtn: btn });
      if (!liveModel) return null;
      var elP = ctx.catalog.parseElementModelLabel(liveModel);
      if (elP) {
        var slot = ctx.slotByZ && typeof ctx.slotByZ.get === 'function' ? ctx.slotByZ.get(elP.slotZ) : null;
        return {
          shortLabel: ctx.hostBridge.formatOrchElementCompactBadge(elP.slotZ, slot),
          miniKey: elP.slotZ === 1 ? 1 : 'orchestrator',
          liveModel: liveModel,
          slotZ: elP.slotZ,
        };
      }
      if (/\b(?:opus|sonnet|haiku|claude|flash|gpt|codex)\b/i.test(liveModel)) {
        return {
          shortLabel: ctx.hostBridge.formatOrchAuxCompactBadge(liveModel, liveModel),
          miniKey: 'orchestrator',
          liveModel: liveModel,
          slotZ: null,
        };
      }
      return null;
    }

    function createLiveModelObserverManager(ctx) {
      var observers = new Map();
      var attachTimer = 0;
      var attachAttempts = 0;

      function clearAttachTimer() {
        if (attachTimer && ctx.clearTimer) {
          ctx.clearTimer(attachTimer);
          attachTimer = 0;
        }
      }

      function disconnect() {
        clearAttachTimer();
        attachAttempts = 0;
        observers.forEach(function (obs) {
          try { obs.disconnect(); } catch (e) {}
        });
        observers.clear();
      }

      function ensure(buttons) {
        if (!ctx || !ctx.doc || !ctx.hostBridge) return;
        observers.forEach(function (obs, node) {
          var connected = ctx.isNodeConnectedToDoc ? ctx.isNodeConnectedToDoc(ctx.doc, node) : node && node.isConnected !== false;
          if (!connected && node && node.isConnected === false) {
            try { obs.disconnect(); } catch (e) {}
            observers.delete(node);
          }
        });
        var hasOrchBtn = false;
        var missingNode = false;
        var ObsCtor =
          (ctx.root && ctx.root.MutationObserver) ||
          (typeof MutationObserver === 'function' ? MutationObserver : null);
        for (var i = 0; i < buttons.length; i += 1) {
          var btn = buttons[i];
          var lbl = ctx.hostBridge.readCleanButtonLabel(btn, false);
          if (!ORCH_LABEL_RE.test(lbl)) continue;
          hasOrchBtn = true;
          var hit = resolveLiveModelDomNode(ctx.doc, ctx.root, { anchorBtn: btn });
          if (hit && hit.node) {
            if (ObsCtor && !observers.has(hit.node)) {
              try {
                var mo = new ObsCtor(function () {
                  if (ctx.isActive && ctx.isActive()) ctx.scheduleBadgeSync(30);
                });
                mo.observe(hit.node, { childList: true, characterData: true, subtree: true });
                observers.set(hit.node, mo);
              } catch (eMo) {}
            }
          } else {
            missingNode = true;
          }
        }
        var rt = ctx.root;
        var hasTelemetryHost = Boolean(rt && (rt.agPulseHost || rt.__agPrismTelemetry || rt.__agCsPulseBridgeInst));
        if (!hasOrchBtn || !missingNode || !hasTelemetryHost) {
          clearAttachTimer();
          attachAttempts = 0;
          return;
        }
        if (!attachTimer && attachAttempts < 10 && ctx.setTimer) {
          attachTimer = ctx.setTimer(function () {
            attachTimer = 0;
            attachAttempts += 1;
            if (ctx.isActive && ctx.isActive()) ctx.scheduleBadgeSync(0);
          }, 600);
        }
      }

      return {
        ensure: ensure,
        disconnect: disconnect,
      };
    }

    return {
      resolvePulseHostForTelemetry: resolvePulseHostForTelemetry,
      resolveLiveModelDomNode: resolveLiveModelDomNode,
      sanitizeLiveInvokedModelLabel: sanitizeLiveInvokedModelLabel,
      readHostLiveInvokedModel: readHostLiveInvokedModel,
      resolveLiveOrchBadge: resolveLiveOrchBadge,
      createLiveModelObserverManager: createLiveModelObserverManager,
    };
  }
);
