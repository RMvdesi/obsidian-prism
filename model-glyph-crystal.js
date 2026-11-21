// Obsidian Prism — Official Brand Model Glyph & Orchestrator Cut Crystal Bar Module (model-glyph-crystal.js)
// Extracted from ui-runtime.js: manages model label parsing, brand SVG glyphs on triggers/panel rows,
// SVG <template> clone prototype cache, and Orchestrator cut-crystal prism bar loop.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const BRAND_PATHS = {
    gemini:
      'M24 12.024c-6.437.388-11.59 5.539-11.977 11.976h-.047C11.588 17.563 6.436 12.412 0 12.024v-.047C6.437 11.588 11.588 6.437 11.976 0h.047c.388 6.437 5.54 11.588 11.977 11.977z',
    claude:
      'm4.714 15.956l4.718-2.648l.079-.23l-.08-.128h-.23l-.79-.048l-2.695-.073l-2.337-.097l-2.265-.122l-.57-.121l-.535-.704l.055-.353l.48-.321l.685.06l1.518.104l2.277.157l1.651.098l2.447.255h.389l.054-.158l-.133-.097l-.103-.098l-2.356-1.596l-2.55-1.688l-1.336-.972l-.722-.491L2 6.223l-.158-1.008l.656-.722l.88.06l.224.061l.893.686l1.906 1.476l2.49 1.833l.364.304l.146-.104l.018-.072l-.164-.274l-1.354-2.446l-1.445-2.49l-.644-1.032l-.17-.619a3 3 0 0 1-.103-.729L6.287.133L6.7 0l.995.134l.42.364l.619 1.415L9.735 4.14l1.555 3.03l.455.898l.243.832l.09.255h.159V9.01l.127-1.706l.237-2.095l.23-2.695l.08-.76l.376-.91l.747-.492l.583.28l.48.685l-.067.444l-.286 1.851l-.558 2.903l-.365 1.942h.213l.243-.242l.983-1.306l1.652-2.064l.728-.82l.85-.904l.547-.431h1.032l.759 1.129l-.34 1.166l-1.063 1.347l-.88 1.142l-1.263 1.7l-.79 1.36l.074.11l.188-.02l2.853-.606l1.542-.28l1.84-.315l.832.388l.09.395l-.327.807l-1.967.486l-2.307.462l-3.436.813l-.043.03l.049.061l1.548.146l.662.036h1.62l3.018.225l.79.522l.473.638l-.08.485l-1.213.62l-1.64-.389l-3.825-.91l-1.31-.329h-.183v.11l1.093 1.068l2.003 1.81l2.508 2.33l.127.578l-.321.455l-.34-.049l-2.204-1.657l-.85-.747l-1.925-1.62h-.127v.17l.443.649l2.343 3.521l.122 1.08l-.17.353l-.607.213l-.668-.122l-1.372-1.924l-1.415-2.168l-1.141-1.943l-.14.08l-.674 7.254l-.316.37l-.728.28l-.607-.461l-.322-.747l.322-1.476l.388-1.924l.316-1.53l.285-1.9l.17-.632l-.012-.042l-.14.018l-1.432 1.967l-2.18 2.945l-1.724 1.845l-.413.164l-.716-.37l.066-.662l.401-.589l2.386-3.036l1.439-1.882l.929-1.086l-.006-.158h-.055L4.138 18.56l-1.13.146l-.485-.456l.06-.746l.231-.243l1.907-1.312Z',
    openai:
      'M20.562 10.188c.25-.688.313-1.376.25-2.063c-.062-.687-.312-1.375-.625-2c-.562-.937-1.375-1.687-2.312-2.125c-1-.437-2.063-.562-3.125-.312c-.5-.5-1.063-.938-1.688-1.25S11.687 2 11 2a5.17 5.17 0 0 0-3 .938c-.875.624-1.5 1.5-1.813 2.5c-.75.187-1.375.5-2 .875c-.562.437-1 1-1.375 1.562c-.562.938-.75 2-.625 3.063a5.44 5.44 0 0 0 1.25 2.874a4.7 4.7 0 0 0-.25 2.063c.063.688.313 1.375.625 2c.563.938 1.375 1.688 2.313 2.125c1 .438 2.062.563 3.125.313c.5.5 1.062.937 1.687 1.25S12.312 22 13 22a5.17 5.17 0 0 0 3-.937c.875-.625 1.5-1.5 1.812-2.5a4.54 4.54 0 0 0 1.938-.875c.562-.438 1.062-.938 1.375-1.563c.562-.937.75-2 .625-3.062c-.125-1.063-.5-2.063-1.188-2.876m-7.5 10.5c-1 0-1.75-.313-2.437-.875c0 0 .062-.063.125-.063l4-2.312a.5.5 0 0 0 .25-.25a.57.57 0 0 0 .062-.313V11.25l1.688 1v4.625a3.685 3.685 0 0 1-3.688 3.813M5 17.25c-.438-.75-.625-1.625-.438-2.5c0 0 .063.063.125.063l4 2.312a.56.56 0 0 0 .313.063c.125 0 .25 0 .312-.063l4.875-2.812v1.937l-4.062 2.375A3.7 3.7 0 0 1 7.312 19c-1-.25-1.812-.875-2.312-1.75M3.937 8.563a3.8 3.8 0 0 1 1.938-1.626v4.751c0 .124 0 .25.062.312a.5.5 0 0 0 .25.25l4.875 2.813l-1.687 1l-4-2.313a3.7 3.7 0 0 1-1.75-2.25c-.25-.937-.188-2.062.312-2.937M17.75 11.75l-4.875-2.812l1.687-1l4 2.312c.625.375 1.125.875 1.438 1.5s.5 1.313.437 2.063a3.7 3.7 0 0 1-.75 1.937c-.437.563-1 1-1.687 1.25v-4.75c0-.125 0-.25-.063-.312c0 0-.062-.126-.187-.188m1.687-2.5s-.062-.062-.125-.062l-4-2.313c-.125-.062-.187-.062-.312-.062s-.25 0-.313.062L9.812 9.688V7.75l4.063-2.375c.625-.375 1.312-.5 2.062-.5c.688 0 1.375.25 2 .688c.563.437 1.063 1 1.313 1.625s.312 1.375.187 2.062m-10.5 3.5l-1.687-1V7.063c0-.688.187-1.438.562-2C8.187 4.438 8.75 4 9.375 3.688a3.37 3.37 0 0 1 2.062-.313c.688.063 1.375.375 1.938.813c0 0-.063.062-.125.062l-4 2.313a.5.5 0 0 0-.25.25c-.063.125-.063.187-.063.312zm.875-2L12 9.5l2.187 1.25v2.5L12 14.5l-2.188-1.25z',
  };

  const PANEL_MODEL_ROW_RE = /orchestrator|编排|gemini|claude|sonnet|opus|haiku|gpt|openai|\bo[134]\b|deepseek/i;

  function readButtonLabelWithoutGlyph(el) {
    if (!el) return '';
    const parts = [];
    const collect = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        parts.push(node.nodeValue || '');
        return;
      }
      if (node.classList && node.classList.contains('ag-cs-model-glyph')) return;
      if (node.childNodes && node.childNodes.length > 0) {
        for (const cn of node.childNodes) collect(cn);
        return;
      }
      if (node.children && node.children.length > 0) {
        let nonGlyph = 0;
        for (const ch of node.children) {
          if (ch.classList && ch.classList.contains('ag-cs-model-glyph')) continue;
          nonGlyph++;
          collect(ch);
        }
        if (nonGlyph === 0 && typeof node._text === 'string' && node._text) {
          parts.push(node._text);
        }
        return;
      }
      parts.push(node.textContent || '');
    };
    collect(el);
    const aria = el.getAttribute?.('aria-label') || '';
    if (aria) parts.push(aria);
    return parts.join(' ').trim();
  }

  function parseModelLabelInfo(rawText) {
    const raw = String(rawText || '').toLowerCase();
    const isOrchestrator = /\borchestrator\b|编排/.test(raw);
    let brand = 'gemini';
    if (/\bclaude\b|\banthropic\b|\bsonnet\b|\bopus\b|\bhaiku\b/.test(raw)) {
      brand = 'claude';
    } else if (/\bgpt\b|\bopenai\b|\bo1\b|\bo3\b|\bo4\b|\bcodex\b|\bdeepseek\b/.test(raw)) {
      brand = 'openai';
    } else if (isOrchestrator) {
      brand = 'antigravity';
    } else if (/\bantigravity\b/.test(raw) && !/\bgemini\b|\bneon\b|\bargon\b|\bcarbon\b|\bhydrogen\b|\bflash\b/.test(raw)) {
      brand = 'antigravity';
    }

    let tier = 'medium';
    if (/\bgpt-oss\b|\bfixed\b|固定/.test(raw)) tier = 'fixed';
    else if (/\bxhigh\b|\bextra\b|超深|极高/.test(raw)) tier = 'xhigh';
    else if (/\bhigh\b|\bmax\b|\bthinking\b|高/.test(raw)) tier = 'high';
    else if (/\blow\b|\blite\b|\bminimal\b|低/.test(raw)) tier = 'low';
    else if (/\bmedium\b|\bmed\b|中/.test(raw)) tier = 'medium';
    else if (isOrchestrator) tier = 'auto';
    return { brand, tier, isOrchestrator, camp: brand === 'claude' ? 'claude' : 'gemini' };
  }

  function createModelGlyphCrystalController({
    animatedIcons,
    crystalPrismCore,
    isDestroyed,
    isComposerRestyleEnabled,
    isZh,
    isDarkTheme,
    motionReduced,
    getMinFrameGapMs,
    canMountRealCanvas,
    getLastPointerPos,
    setAttrIfChanged,
  }) {
    let crystalMount = {
      panel: null,
      bar: null,
      track: null,
      canvas: null,
      inst: null,
      rafId: 0,
      mountRafId: 0,
      lastStepMs: 0,
      wasOrch: false,
    };

    const svgElementProtoCache = new Map();

    function getRootHtml() {
      return typeof document !== 'undefined' ? document.documentElement : null;
    }

    function readRootAccentTone() {
      return getRootHtml()?.getAttribute?.('data-ag-cs-accent') || 'follow';
    }

    function resolveCrystalAccentMode(dark) {
      const html = getRootHtml();
      const tone = html?.getAttribute?.('data-ag-cs-accent') || 'follow';
      if (tone === 'mono' || tone === 'cobalt' || tone === 'iris' || tone === 'amber') {
        return tone;
      }
      const pal = html?.getAttribute?.('data-ag-cs-palette') || 'obsidian';
      if (pal === 'warm' || pal === 'claude') return 'warm';
      if (!dark && html?.getAttribute?.('data-ag-cs-light-preset') === 'alabaster') return 'warm';
      return 'default';
    }

    function readRootAmbientFloat() {
      const raw = getRootHtml()?.getAttribute?.('data-ag-cs-ambient');
      if (G.__agPrismRipple?.parseAmbientScale) return G.__agPrismRipple.parseAmbientScale(raw);
      if (raw === null || raw === undefined || raw === '') return 1;
      const n = Number(raw);
      return !Number.isFinite(n) ? 1 : n <= 0 ? 0 : n > 1 ? Math.min(1, n / 100) : n;
    }

    function cloneCachedSvgElement(cacheKey, htmlStr) {
      if (!htmlStr) return null;
      if (typeof HTMLTemplateElement !== 'undefined' && typeof document.createElement === 'function') {
        let proto = svgElementProtoCache.get(cacheKey);
        if (!proto) {
          const tpl = document.createElement('template');
          tpl.innerHTML = htmlStr;
          proto = tpl.content ? tpl.content.firstElementChild || tpl.content.firstChild : null;
          if (proto && typeof proto.cloneNode === 'function') {
            if (svgElementProtoCache.size > 64) svgElementProtoCache.clear();
            svgElementProtoCache.set(cacheKey, proto);
          }
        }
        if (proto && typeof proto.cloneNode === 'function') {
          return proto.cloneNode(true);
        }
      }
      const tmp = document.createElement('span');
      tmp.innerHTML = htmlStr;
      return tmp.firstElementChild || tmp.firstChild || null;
    }

    function parseModelTriggerInfo(btn) {
      const info = parseModelLabelInfo(readButtonLabelWithoutGlyph(btn));
      if (info.isOrchestrator && btn?.getAttribute?.('data-ces-orch-b') === 'claude') {
        info.brand = 'claude';
        info.camp = 'claude';
      }
      return info;
    }

    function renderSparkSvg(size = 16, tier = 'auto', monochrome = false, className = '') {
      if (animatedIcons && typeof animatedIcons.renderGoogleSparkOrbitSvg === 'function') {
        const svg = animatedIcons.renderGoogleSparkOrbitSvg({ size, tier, monochrome, className });
        if (svg) return svg;
      }
      const cls = className ? ` class="${className}"` : '';
      const fill = monochrome ? 'currentColor' : '#669DF6';
      return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 1.2c.25 0 .47.17.53.41c.21.79.48 1.56.8 2.31c1.23 2.86 3.39 5.02 6.25 6.25c.75.32 1.52.59 2.31.8c.24.06.41.28.41.53s-.17.47-.41.53a16 16 0 0 0-2.31.8c-2.86 1.23-5.02 3.39-6.25 6.25c-.32.75-.59 1.52-.8 2.31a.55.55 0 0 1-.53.41a.55.55 0 0 1-.53-.41a16 16 0 0 0-.8-2.31c-1.23-2.86-3.39-5.02-6.25-6.25a16 16 0 0 0-2.31-.8A.55.55 0 0 1 1.2 12c0-.25.17-.47.41-.53c.79-.21 1.56-.48 2.31-.8c2.86-1.23 5.02-3.39 6.25-6.25c.32-.75.59-1.52.8-2.31c.06-.24.28-.41.53-.41Z" fill="${fill}"/></svg>`;
    }

    function buildBrandMarkSvg(brand, size = 14, tier = 'auto', monochrome = false) {
      const useMono = Boolean(monochrome || readRootAccentTone() === 'mono');
      if (brand === 'antigravity') return renderSparkSvg(size, tier, useMono, '');
      const d = BRAND_PATHS[brand] || BRAND_PATHS.gemini;
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>`;
    }

    function buildModelGlyphInnerSvg(brand, tier, isMono = false) {
      if (brand === 'antigravity') {
        return renderSparkSvg(16, tier || 'auto', isMono, 'ag-cs-model-glyph-svg');
      }
      const d = BRAND_PATHS[brand] || BRAND_PATHS.gemini;
      const coreR = brand === 'gemini' ? '2.7' : '2.1';
      const fixedLock =
        tier === 'fixed'
          ? '<g class="ag-cs-glyph-lock"><rect x="15.2" y="16.2" width="8.6" height="6.8" rx="1.6"/><path d="M17.3 16.2v-1.7a2.2 2.2 0 1 1 4.4 0v1.7" fill="none" stroke-width="1.5"/></g>'
          : '';
      return (
        '<svg class="ag-cs-model-glyph-svg" width="16" height="16" viewBox="-4 -4 32 32" fill="none" aria-hidden="true">' +
        '<g class="ag-cs-glyph-orbit-group">' +
        '<ellipse class="ag-cs-glyph-orbit" cx="12" cy="12" rx="14.5" ry="6.2" transform="rotate(-24 12 12)"/>' +
        '<circle class="ag-cs-glyph-sat is-a" cx="25.2" cy="6.1" r="1.65"/>' +
        '<circle class="ag-cs-glyph-sat is-b" cx="-1.2" cy="17.9" r="1.25"/>' +
        '</g>' +
        `<path class="ag-cs-glyph-body" d="${d}" fill-rule="evenodd"/>` +
        `<circle class="ag-cs-glyph-core" cx="12" cy="12" r="${coreR}"/>` +
        fixedLock +
        '</svg>'
      );
    }

    function syncModelGlyphOnButton(modelBtn) {
      if (!modelBtn) return null;
      modelBtn.querySelectorAll('.ag-cs-effort-badge, [data-ag-cs-effort]').forEach((el) => {
        el.removeAttribute('data-ag-cs-effort');
        el.classList.remove('ag-cs-effort-badge');
      });

      const info = parseModelTriggerInfo(modelBtn);
      if (!isComposerRestyleEnabled()) {
        modelBtn.querySelectorAll('.ag-cs-model-glyph').forEach((n) => n.remove());
        return info;
      }

      let glyph = modelBtn.querySelector('.ag-cs-model-glyph');
      let created = false;
      if (!glyph) {
        glyph = document.createElement('span');
        glyph.className = 'ag-cs-model-glyph';
        glyph.setAttribute('data-icon', '1');
        glyph.setAttribute('aria-hidden', 'true');
        glyph.setAttribute('data-ag-no-i18n', '');
        created = true;
      }
      if (modelBtn.firstChild !== glyph) {
        modelBtn.insertBefore(glyph, modelBtn.firstChild);
      }
      const isMono = readRootAccentTone() === 'mono';
      const monoStr = isMono ? '1' : '0';
      const prevBrand = glyph.getAttribute('data-brand');
      const prevTier = glyph.getAttribute('data-tier');
      const prevMono = glyph.getAttribute('data-mono');
      if (created || prevBrand !== info.brand || prevTier !== info.tier || prevMono !== monoStr) {
        glyph.setAttribute('data-brand', info.brand);
        glyph.setAttribute('data-tier', info.tier);
        glyph.setAttribute('data-mono', monoStr);
        glyph.innerHTML = buildModelGlyphInnerSvg(info.brand, info.tier, isMono);
        if (!created && prevMono === monoStr && !motionReduced() && typeof requestAnimationFrame === 'function') {
          glyph.classList.remove('is-pulsing');
          requestAnimationFrame(() => {
            if (glyph.isConnected) glyph.classList.add('is-pulsing');
          });
        }
      }
      return info;
    }

    function buildPanelRowGlyphSvg(brand, tier, isSelected, isMono = false) {
      if (brand === 'antigravity') {
        return renderSparkSvg(15, isSelected ? tier || 'auto' : 'low', !isSelected || isMono, 'ag-cs-model-glyph-svg');
      }
      const d = BRAND_PATHS[brand] || BRAND_PATHS.gemini;
      const fillAttr = isSelected && !isMono
        ? 'style="fill:var(--glyph-color-hi);fill-opacity:1"'
        : isSelected
        ? 'fill="currentColor" fill-opacity="0.95"'
        : 'fill="currentColor" fill-opacity="0.72"';
      return `<svg class="ag-cs-model-glyph-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d}" ${fillAttr} fill-rule="evenodd"/></svg>`;
    }

    function clearPanelRowGlyphs(rootNode = document) {
      rootNode?.querySelectorAll?.('.ag-cs-panel-row-glyph').forEach((n) => n.remove());
    }

    function isPanelRowSelected(row) {
      if (!row) return false;
      if (
        row.getAttribute?.('data-selected') === 'true' ||
        row.getAttribute?.('aria-checked') === 'true' ||
        row.getAttribute?.('data-state') === 'checked'
      ) {
        return true;
      }
      if (row.hasAttribute?.('data-ces-model-selected')) {
        return row.getAttribute('data-ces-model-selected') === 'true';
      }
      return Boolean(
        row.classList?.contains?.('text-foreground') &&
          !row.classList?.contains?.('text-secondary-foreground')
      );
    }

    function syncPanelRowGlyphs(panel) {
      if (!panel) return;
      const rows = panel.querySelectorAll('[role="menuitem"], [role="option"], button');
      for (const row of rows) {
        if (row.closest?.('.ces-ag-section, [data-testid="orchestrator-effort-bar"]')) continue;
        if (row.parentElement?.closest?.('[role="menuitem"], [role="option"], button')) continue;
        const label = readButtonLabelWithoutGlyph(row);
        if (!PANEL_MODEL_ROW_RE.test(label)) {
          clearPanelRowGlyphs(row);
          continue;
        }
        const info = parseModelLabelInfo(label);
        const isSelected = isPanelRowSelected(row);

        let firstChildEl = null;
        if (row.children) {
          for (const ch of row.children) {
            if (ch.classList && ch.classList.contains('ag-cs-model-glyph')) continue;
            firstChildEl = ch;
            break;
          }
        }
        const targetParent =
          firstChildEl &&
          (firstChildEl.querySelector?.('[data-testid="model-selector-effort-group"]') ||
            /\bflex\b|\bitems-center\b/.test(String(firstChildEl.className || '')))
            ? firstChildEl
            : row;

        let glyph = row.querySelector('.ag-cs-panel-row-glyph');
        let created = false;
        if (!glyph) {
          glyph = document.createElement('span');
          glyph.className = 'ag-cs-model-glyph ag-cs-panel-row-glyph';
          glyph.setAttribute('data-ag-no-i18n', '');
          glyph.setAttribute('aria-hidden', 'true');
          created = true;
        }
        if (glyph.parentElement !== targetParent || targetParent.firstChild !== glyph) {
          targetParent.insertBefore(glyph, targetParent.firstChild);
        }

        const selStr = isSelected ? 'true' : 'false';
        const isMono = readRootAccentTone() === 'mono';
        const monoStr = isMono ? '1' : '0';
        if (
          created ||
          glyph.getAttribute('data-brand') !== info.brand ||
          glyph.getAttribute('data-tier') !== info.tier ||
          glyph.getAttribute('data-selected') !== selStr ||
          glyph.getAttribute('data-mono') !== monoStr
        ) {
          glyph.setAttribute('data-brand', info.brand);
          glyph.setAttribute('data-tier', info.tier);
          glyph.setAttribute('data-selected', selStr);
          glyph.setAttribute('data-mono', monoStr);
          glyph.innerHTML = buildPanelRowGlyphSvg(info.brand, info.tier, isSelected, isMono);
          if (isSelected) {
            glyph.style.setProperty('opacity', '1');
            if (info.brand === 'openai' || isMono) glyph.style.setProperty('filter', 'none');
            else glyph.style.setProperty('filter', 'drop-shadow(0 0 3px var(--glyph-glow))');
          } else {
            glyph.style.setProperty('filter', 'none');
            glyph.style.setProperty('opacity', '0.78');
          }
        }
      }
    }

    function detachSliderWake() {
      if (crystalMount.wakeTrk && crystalMount.wakeFn) {
        try { crystalMount.wakeTrk.removeEventListener('pointerdown', crystalMount.wakeFn); } catch {}
      }
      crystalMount.wakeTrk = null;
      crystalMount.wakeFn = null;
    }

    function clearSliderPrismOverlay(panel) {
      detachSliderWake();
      if (!panel) return;
      panel.querySelectorAll('.ces-ag-effort-row[data-ag-orch-p]').forEach((row) => {
        row.removeAttribute('data-ag-orch-p');
        const trk = row.querySelector('.ces-track');
        if (trk) {
          trk.classList.remove('ag-cs-orch-track');
          trk.querySelectorAll('canvas[data-orch-crystal-canvas="true"]').forEach((c) => c.remove());
          const knob = trk.querySelector('.ces-knob');
          if (knob) {
            knob.style.removeProperty('--knob-px');
            knob.style.removeProperty('--knob-py');
          }
        }
      });
    }

    function readTrackFillRatio(trk) {
      if (!trk) return 1;
      const w = trk.clientWidth || (typeof trk.getBoundingClientRect === 'function' ? trk.getBoundingClientRect().width : 0) || 220;
      const raw = trk.style && typeof trk.style.getPropertyValue === 'function'
        ? trk.style.getPropertyValue('--ces-fill').trim()
        : '';
      if (raw && w > 4) {
        const mCalc = raw.match(/calc\(\s*([0-9.]+)px\s*\+\s*\(100%\s*-\s*([0-9.]+)px\)\s*\*\s*([0-9.eE+-]+)\s*\)/);
        if (mCalc) {
          const r = parseFloat(mCalc[1]);
          const span = parseFloat(mCalc[2]);
          const p = parseFloat(mCalc[3]);
          if (Number.isFinite(r) && Number.isFinite(span) && Number.isFinite(p)) {
            return Math.max(0, Math.min(1, (r + (w - span) * p) / w));
          }
        }
        const px = parseFloat(raw);
        if (Number.isFinite(px)) return Math.max(0, Math.min(1, px / w));
      }
      const knob = typeof trk.querySelector === 'function' ? trk.querySelector('.ces-knob') : null;
      if (knob && typeof knob.offsetLeft === 'number' && knob.offsetLeft > 0 && w > 4) {
        return Math.max(0, Math.min(1, knob.offsetLeft / w));
      }
      if (typeof trk.getAttribute === 'function' && w > 4) {
        const maxV = parseFloat(trk.getAttribute('aria-valuemax'));
        const nowV = parseFloat(trk.getAttribute('aria-valuenow'));
        if (Number.isFinite(maxV) && maxV > 0 && Number.isFinite(nowV)) {
          return Math.max(0, Math.min(1, (14 + (w - 28) * (nowV / maxV)) / w));
        }
      }
      return 1;
    }

    let knobPrismHot = false;
    function syncKnobPrismPointer(clientX, clientY) {
      const trk = crystalMount.hideLock ? crystalMount.track : null;
      const knob = trk && trk.isConnected !== false ? trk.querySelector('.ces-knob') : null;
      if (!knob) {
        knobPrismHot = false;
        return;
      }
      const off = motionReduced() || readRootAmbientFloat() <= 0.001 || !(clientX > -1000 && clientY > -1000);
      if (off) {
        if (knobPrismHot) {
          knob.style.setProperty('--knob-px', '-9999px');
          knob.style.setProperty('--knob-py', '-9999px');
          knobPrismHot = false;
        }
        return;
      }
      const rect = typeof knob.getBoundingClientRect === 'function' ? knob.getBoundingClientRect() : null;
      if (!rect || rect.width < 4) return;
      const lx = clientX - rect.left;
      const ly = clientY - rect.top;
      const dist = Math.hypot(lx - rect.width * 0.5, ly - rect.height * 0.5);
      if (dist <= 56) {
        knob.style.setProperty('--knob-px', `${lx.toFixed(1)}px`);
        knob.style.setProperty('--knob-py', `${ly.toFixed(1)}px`);
        knobPrismHot = true;
      } else if (knobPrismHot) {
        knob.style.setProperty('--knob-px', '-9999px');
        knob.style.setProperty('--knob-py', '-9999px');
        knobPrismHot = false;
      }
    }

    const cancelMountRaf = () => {
      if (crystalMount.mountRafId) {
        cancelAnimationFrame(crystalMount.mountRafId);
        crystalMount.mountRafId = 0;
      }
    };
    const cancelStepRaf = () => {
      if (crystalMount.rafId) {
        cancelAnimationFrame(crystalMount.rafId);
        crystalMount.rafId = 0;
      }
    };

    function teardownCrystalMount() {
      detachSliderWake();
      cancelMountRaf();
      cancelStepRaf();
      if (crystalMount.inst && typeof crystalMount.inst.dispose === 'function') {
        try {
          crystalMount.inst.dispose();
        } catch {}
      }
      if (crystalMount.panel && crystalMount.panel.isConnected) {
        clearPanelRowGlyphs(crystalMount.panel);
        clearSliderPrismOverlay(crystalMount.panel);
        crystalMount.panel.removeAttribute('data-ag-cs-orch-active');
        crystalMount.panel
          .querySelectorAll('.ces-ag-effort-row:not([data-testid="orchestrator-effort-bar"])')
          .forEach((row) => {
            row.removeAttribute('data-row-hidden');
            row.removeAttribute('aria-hidden');
          });
      }
      clearPanelRowGlyphs();
      document?.documentElement?.removeAttribute?.('data-ag-cs-model-menu');
      if (crystalMount.bar && crystalMount.bar.parentElement) {
        crystalMount.bar.remove();
      }
      crystalMount = { panel: null, bar: null, track: null, canvas: null, inst: null, rafId: 0, mountRafId: 0, lastStepMs: 0, wasOrch: false, hideLock: false };
    }

    function detectPanelIsOrchestrator(panel, fallbackModelInfo) {
      if (fallbackModelInfo && typeof fallbackModelInfo.isOrchestrator === 'boolean') {
        return fallbackModelInfo.isOrchestrator;
      }
      if (panel) {
        let sel = panel.querySelector(
          '[data-selected="true"], [aria-checked="true"], [data-state="checked"], [data-ces-model-selected="true"]'
        );
        if (!sel) {
          for (const r of panel.querySelectorAll('[role="menuitem"], [role="option"], button')) {
            if (isPanelRowSelected(r)) {
              sel = r;
              break;
            }
          }
        }
        if (sel) {
          const txt = readButtonLabelWithoutGlyph(sel);
          return /\borchestrator\b|编排/i.test(txt);
        }
      }
      return false;
    }

    function stepCrystalLoop(now) {
      crystalMount.rafId = 0;
      if (isDestroyed() || !crystalMount.inst || !crystalMount.panel || !crystalMount.panel.isConnected || !crystalMount.wasOrch) {
        return;
      }
      const minGap = getMinFrameGapMs();
      if (minGap > 0 && crystalMount.lastStepMs > 0 && now - crystalMount.lastStepMs < minGap) {
        if (!motionReduced() && !document.hidden) {
          crystalMount.rafId = requestAnimationFrame(stepCrystalLoop);
        }
        return;
      }
      const dt = crystalMount.lastStepMs > 0 ? Math.min(0.05, Math.max(0.002, (now - crystalMount.lastStepMs) / 1000)) : 0.016;
      crystalMount.lastStepMs = now;
      const ptrNow = getLastPointerPos ? getLastPointerPos() : null;
      if (ptrNow) syncKnobPrismPointer(ptrNow.x, ptrNow.y);
      try {
        crystalMount.inst.step(dt);
      } catch {}
      const instIdle = typeof crystalMount.inst.isIdle === 'function' && Boolean(crystalMount.inst.isIdle());
      if (!instIdle && !document.hidden) {
        crystalMount.rafId = requestAnimationFrame(stepCrystalLoop);
      }
    }

    function syncModelSelectorPanel(primaryModelInfo) {
      const panel = document.querySelector('[data-testid="model-selector-panel"]'), r = document?.documentElement;
      if (panel) {
        r && setAttrIfChanged(r, 'data-ag-cs-model-menu', '1');
        const ov = panel.closest?.('.agy-overlay');
        ov && setAttrIfChanged(ov, 'data-ag-cs-model-overlay', '1');
      } else r?.removeAttribute?.('data-ag-cs-model-menu');
      if (!isComposerRestyleEnabled()) {
        clearPanelRowGlyphs();
        if (crystalMount.panel || crystalMount.bar) teardownCrystalMount();
        return;
      }
      if (!panel) {
        clearPanelRowGlyphs();
        if (crystalMount.panel || crystalMount.bar) teardownCrystalMount();
        return;
      }
      if (crystalMount.panel && crystalMount.panel !== panel) {
        teardownCrystalMount();
      }

      const isOrch = detectPanelIsOrchestrator(panel, primaryModelInfo);
      const isOrchTunable = isOrch && panel.getAttribute('data-ces-orch-tunable') === 'true';
      syncPanelRowGlyphs(panel);
      const cesSec = panel.querySelector('.ces-ag-section');
      if (cesSec) {
        if (cesSec.getAttribute('data-effort-slot') !== 'true') {
          cesSec.setAttribute('data-effort-slot', 'true');
        }
        if (cesSec.querySelector('[role="separator"]')) {
          setAttrIfChanged(cesSec, 'data-has-sep', '1');
        } else if (cesSec.hasAttribute('data-has-sep')) {
          cesSec.removeAttribute('data-has-sep');
        }
      }
      const slot = cesSec || panel;

      let bar = panel.querySelector('[data-testid="orchestrator-effort-bar"]');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'ces-ag-effort-row ag-cs-orch-row';
        bar.setAttribute('data-testid', 'orchestrator-effort-bar');
        bar.setAttribute('data-ag-no-i18n', '');

        const head = document.createElement('div');
        head.className = 'ces-ag-effort-head ag-cs-orch-head';
        const title = document.createElement('span');
        title.className = 'ces-ag-effort-title';
        title.textContent = isZh() ? '推理等级' : 'Reasoning Effort';
        const val = document.createElement('span');
        val.className = 'ces-ag-effort-value ag-cs-orch-value';
        val.textContent = 'Auto';
        head.appendChild(title);
        head.appendChild(val);

        const inline = document.createElement('div');
        inline.className = 'ces-inline';
        const track = document.createElement('div');
        track.className = 'ag-cs-orch-track';
        track.setAttribute('role', 'status');
        track.setAttribute('aria-label', 'Orchestrator Auto');
        const cv = document.createElement('canvas');
        cv.className = 'ag-cs-orch-canvas';
        cv.setAttribute('data-orch-crystal-canvas', 'true');
        cv.setAttribute('aria-hidden', 'true');
        track.appendChild(cv);
        inline.appendChild(track);

        bar.appendChild(head);
        bar.appendChild(inline);
        slot.appendChild(bar);
      } else if (bar.parentElement !== slot) {
        slot.appendChild(bar);
      }

      const sRow = panel.querySelector('.ces-ag-effort-row:not([data-testid="orchestrator-effort-bar"])');
      const sTrk = sRow && sRow.querySelector('.ces-track');
      const useSP = Boolean(isOrch && isOrchTunable && sRow && sTrk);
      const useAuto = Boolean(isOrch && !useSP);

      let tTrk = bar.querySelector('.ag-cs-orch-track');
      let tCv = bar.querySelector('canvas[data-orch-crystal-canvas="true"]');
      if (useSP) {
        setAttrIfChanged(sRow, 'data-ag-orch-p', '1');
        sTrk.classList.add('ag-cs-orch-track');
        let c = sTrk.querySelector('canvas[data-orch-crystal-canvas="true"]');
        if (!c) {
          c = document.createElement('canvas');
          c.className = 'ag-cs-orch-canvas';
          c.setAttribute('data-orch-crystal-canvas', 'true');
          c.setAttribute('aria-hidden', 'true');
          sTrk.insertBefore(c, sTrk.firstChild);
        }
        tTrk = sTrk;
        tCv = c;
        if (crystalMount.wakeTrk !== sTrk) {
          detachSliderWake();
          const onWake = (ev) => {
            if (ev && typeof ev.clientX === 'number') syncKnobPrismPointer(ev.clientX, ev.clientY);
            if (!crystalMount.rafId && crystalMount.inst && !document.hidden) {
              crystalMount.lastStepMs = performance.now();
              crystalMount.rafId = requestAnimationFrame(stepCrystalLoop);
            }
          };
          try { sTrk.addEventListener('pointerdown', onWake, { passive: true }); } catch {}
          crystalMount.wakeTrk = sTrk;
          crystalMount.wakeFn = onWake;
        }
      } else {
        clearSliderPrismOverlay(panel);
      }

      if (crystalMount.inst && crystalMount.canvas && crystalMount.canvas !== tCv) {
        cancelMountRaf();
        cancelStepRaf();
        try { crystalMount.inst.dispose?.(); } catch {}
        crystalMount.inst = null;
      }

      crystalMount.panel = panel;
      crystalMount.bar = bar;
      crystalMount.track = tTrk;
      crystalMount.canvas = tCv;
      crystalMount.hideLock = useSP;

      if (useAuto) setAttrIfChanged(panel, 'data-ag-cs-orch-active', '1');
      else panel.removeAttribute('data-ag-cs-orch-active');

      panel
        .querySelectorAll('.ces-ag-effort-row:not([data-testid="orchestrator-effort-bar"])')
        .forEach((row) => {
          setAttrIfChanged(row, 'data-row-hidden', String(useAuto));
          setAttrIfChanged(row, 'aria-hidden', String(useAuto));
        });

      const switchedIn = isOrch && !crystalMount.wasOrch;
      crystalMount.wasOrch = isOrch;
      setAttrIfChanged(bar, 'data-row-hidden', String(!useAuto));
      setAttrIfChanged(bar, 'aria-hidden', String(!useAuto));

      if (isOrch) {
        const kickCrystal = () => {
          if (isDestroyed() || !crystalMount.wasOrch || crystalMount.panel !== panel || !panel.isConnected || !crystalMount.canvas) return;
          const reducedNow = motionReduced();
          const ambientNow = readRootAmbientFloat();
          if (
            !crystalMount.inst &&
            crystalPrismCore &&
            typeof crystalPrismCore.mountCrystalPrismBar === 'function' &&
            canMountRealCanvas(crystalMount.canvas)
          ) {
            try {
              crystalMount.inst = crystalPrismCore.mountCrystalPrismBar(crystalMount.canvas, {
                reduceMotion: reducedNow,
                getState: () => {
                  const dark = isDarkTheme();
                  return {
                    isDark: dark,
                    prismStrength: 1,
                    ambientIntensity: readRootAmbientFloat(),
                    accentTone: resolveCrystalAccentMode(dark),
                    reduceMotion: motionReduced(),
                    hideLock: Boolean(crystalMount.hideLock),
                    fillRatio: crystalMount.hideLock ? readTrackFillRatio(crystalMount.track) : -1,
                  };
                },
              });
            } catch {
              crystalMount.inst = null;
            }
          }
          if (!crystalMount.inst) return;
          if (typeof crystalMount.inst.setReduceMotion === 'function') {
            crystalMount.inst.setReduceMotion(reducedNow);
          }
          const ptr = getLastPointerPos ? getLastPointerPos() : null;
          if (ptr && ptr.x > -1000) {
            crystalMount.inst.setPointerClient(ptr.x, ptr.y);
            syncKnobPrismPointer(ptr.x, ptr.y);
          } else {
            syncKnobPrismPointer(-9999, -9999);
          }
          if (switchedIn || !crystalMount.mountedAt) {
            crystalMount.mountedAt = performance.now();
            if (!reducedNow && ambientNow > 0.001 && typeof crystalMount.inst.wake === 'function') crystalMount.inst.wake();
          }
          try {
            crystalMount.inst.step(0.016);
          } catch {}
          const instIdle = typeof crystalMount.inst.isIdle === 'function' && Boolean(crystalMount.inst.isIdle());
          if (instIdle || document.hidden) {
            cancelStepRaf();
          } else if (!crystalMount.rafId) {
            crystalMount.lastStepMs = performance.now();
            crystalMount.rafId = requestAnimationFrame(stepCrystalLoop);
          }
        };
        if (crystalMount.inst) {
          kickCrystal();
        } else if (!crystalMount.mountRafId) {
          if (typeof requestAnimationFrame === 'function') {
            crystalMount.mountRafId = requestAnimationFrame(() => {
              crystalMount.mountRafId = 0;
              kickCrystal();
            });
          } else {
            kickCrystal();
          }
        }
      } else {
        cancelMountRaf();
        cancelStepRaf();
      }
    }

    return {
      readButtonLabelWithoutGlyph,
      parseModelLabelInfo,
      parseModelTriggerInfo,
      renderSparkSvg,
      buildBrandMarkSvg,
      cloneCachedSvgElement,
      syncModelGlyphOnButton,
      syncPanelRowGlyphs,
      clearPanelRowGlyphs,
      teardownCrystalMount,
      syncModelSelectorPanel,
      getActiveCrystalTrack: () =>
        crystalMount.track && crystalMount.wasOrch && crystalMount.track.isConnected !== false ? crystalMount.track : null,
      setCrystalPointerClient: (x, y) => {
        syncKnobPrismPointer(x, y);
        if (crystalMount.inst && typeof crystalMount.inst.setPointerClient === 'function') {
          crystalMount.inst.setPointerClient(x, y);
          if (
            !crystalMount.rafId &&
            crystalMount.wasOrch &&
            crystalMount.panel &&
            crystalMount.panel.isConnected !== false &&
            !motionReduced() &&
            !document.hidden
          ) {
            const stillIdle = typeof crystalMount.inst.isIdle === 'function' && Boolean(crystalMount.inst.isIdle());
            if (!stillIdle) {
              crystalMount.lastStepMs = performance.now();
              crystalMount.rafId = requestAnimationFrame(stepCrystalLoop);
            }
          }
        }
      },
    };
  }

  const api = {
    BRAND_PATHS,
    readButtonLabelWithoutGlyph,
    parseModelLabelInfo,
    createModelGlyphCrystalController,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismModelGlyphCrystal = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
