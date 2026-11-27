// Modified by Yaniuan on 2026-11-28: add the downstream Prompt Enhancer module.
// Obsidian Prism - Prompt Enhancer settings card (Channel 17).
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const STYLE_ID = 'ag-prism-prompt-enhancer-settings-css';
  const CSS = '.ag-prism-pe-card{margin-top:10px;padding:12px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.28));border-radius:8px;background:var(--ag-cs-card-bg,rgba(128,128,145,.06));}.ag-prism-pe-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600;font-size:13px;}.ag-prism-pe-desc{margin:5px 0 10px;color:var(--muted-foreground,rgba(128,128,145,.9));font-size:12px;line-height:1.45;}.ag-prism-pe-row{display:flex;align-items:center;gap:8px;margin:7px 0;}.ag-prism-pe-row label{min-width:92px;font-size:12px;}.ag-prism-pe-row select,.ag-prism-pe-row input{min-width:0;flex:1;padding:6px 7px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:6px;background:var(--background,rgba(0,0,0,.08));color:inherit;font:inherit;font-size:12px;}.ag-prism-pe-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}.ag-prism-pe-btn{padding:6px 9px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;}.ag-prism-pe-btn[data-primary="1"]{background:var(--primary,rgba(59,130,246,.85));color:var(--primary-foreground,#fff);border-color:transparent;}.ag-prism-pe-status{min-height:17px;margin-top:8px;color:var(--muted-foreground,rgba(128,128,145,.9));font-size:11px;}';
  const TEXT = {
    'zh-CN': ['提示词增强器', '整理为清晰、可执行、保留原意与原语言的提示词。API Key 和 Base URL 复用现有 Profile；默认只发送当前草稿，可选附带最近 1–4 轮完整问答，不单独保存密钥。', '启用提示词增强', 'API Profile', '增强模型 ID', '获取模型列表', '连接测试', '保存设置', '正在加载…', '已保存', '连接正常', '失败：', '选择共享 Profile', '附带对话上下文', '携带轮数', '条'],
    'zh-TW': ['提示詞增強器', '整理為清晰、可執行、保留原意與原語言的提示詞。API Key 和 Base URL 會重用現有 Profile；預設僅傳送目前草稿，可選附帶最近 1–4 輪完整問答，不另存密鑰。', '啟用提示詞增強', 'API Profile', '增強模型 ID', '取得模型清單', '連線測試', '儲存設定', '正在載入…', '已儲存', '連線正常', '失敗：', '選擇共用 Profile', '附帶對話上下文', '攜帶輪數', '輪'],
    en: ['Prompt Enhancer', 'Rewrites your draft into a clearer, ready-to-run prompt while preserving intent and language. Reuses an existing API profile; sends only your draft by default, or optionally 1–4 recent Q&A rounds. No key is stored separately.', 'Enable Prompt Enhancer', 'API profile', 'Enhancement model ID', 'Fetch models', 'Test connection', 'Save settings', 'Loading…', 'Saved', 'Connected', 'Failed: ', 'Select shared profile', 'Include conversation context', 'Context rounds', 'rounds'],
    ja: ['プロンプト強化', '元の意図と言語を保ったまま、明確で実行しやすいプロンプトに整えます。既存 Profile を再利用し、既定では下書きのみ、任意で直近 1–4 往復の会話を送信します。キーは別途保存しません。', 'プロンプト強化を有効化', 'API Profile', '強化モデル ID', 'モデル一覧を取得', '接続テスト', '設定を保存', '読み込み中…', '保存しました', '接続しました', '失敗: ', '共有 Profile を選択', '会話コンテキストを含める', '送信する往復数', '件'],
    ko: ['프롬프트 강화', '원래 의도와 언어를 유지한 채 더 명확하고 실행 가능한 프롬프트로 다듬습니다. 기존 프로필을 재사용하며 기본적으로 초안만 전송하고, 선택 시 최근 1–4회의 문답을 함께 보냅니다. 키를 별도로 저장하지 않습니다.', '프롬프트 강화 사용', 'API 프로필', '강화 모델 ID', '모델 목록 가져오기', '연결 테스트', '설정 저장', '불러오는 중…', '저장됨', '연결됨', '실패: ', '공유 프로필 선택', '대화 맥락 포함', '포함할 대화 수', '회'],
    es: ['Mejorador de prompts', 'Reescribe tu borrador en un prompt más claro y listo para ejecutar preservando intención e idioma. Reutiliza el perfil API existente; envía solo el borrador por defecto o 1–4 turnos Q&A opcionales. No guarda otra clave.', 'Activar mejorador', 'Perfil API', 'ID del modelo', 'Obtener modelos', 'Probar conexión', 'Guardar ajustes', 'Cargando…', 'Guardado', 'Conectado', 'Error: ', 'Selecciona un perfil compartido', 'Incluir contexto reciente', 'Turnos de contexto', 'turnos'],
    fr: ['Améliorateur de prompt', 'Reformule votre brouillon en un prompt plus clair et prêt à l’emploi tout en préservant l’intention et la langue. Réutilise le profil API existant ; n’envoie que le brouillon par défaut, ou 1–4 échanges Q/R en option. Aucune clé séparée.', 'Activer l’améliorateur', 'Profil API', 'ID du modèle', 'Charger les modèles', 'Tester la connexion', 'Enregistrer', 'Chargement…', 'Enregistré', 'Connecté', 'Échec : ', 'Choisir un profil partagé', 'Inclure le contexte récent', 'Nombre d’échanges', 'échanges'],
    de: ['Prompt-Verbesserer', 'Formuliert deinen Entwurf klarer und ausführbar um und bewahrt Absicht sowie Sprache. Nutzt das vorhandene API-Profil; sendet standardmäßig nur den Entwurf oder optional 1–4 aktuelle Q&A-Runden. Kein separater Schlüssel gespeichert.', 'Prompt-Verbesserer aktivieren', 'API-Profil', 'Modell-ID', 'Modelle laden', 'Verbindung testen', 'Einstellungen speichern', 'Lädt…', 'Gespeichert', 'Verbunden', 'Fehler: ', 'Gemeinsames Profil wählen', 'Gesprächskontext einbeziehen', 'Kontextrunden', 'Runden'],
    tr: ['İstem Geliştirici', 'Taslağınızı niyeti ve dili koruyarak daha net, çalıştırılabilir bir isteme dönüştürür. Mevcut API profilini yeniden kullanır; varsayılan olarak yalnızca taslağı, isteğe bağlı olarak son 1–4 soru-yanıt turunu gönderir. Ayrı anahtar saklanmaz.', 'İstem Geliştiriciyi etkinleştir', 'API profili', 'Geliştirme model kimliği', 'Modelleri getir', 'Bağlantıyı test et', 'Ayarları kaydet', 'Yükleniyor…', 'Kaydedildi', 'Bağlandı', 'Hata: ', 'Paylaşılan profili seçin', 'Sohbet bağlamını ekle', 'Bağlam turu', 'tur'],
  };
  function strings(lang) {
    const i18n = G.__agPrismPromptEnhancerI18n;
    const raw = String(lang || 'en').toLowerCase().replace(/_/g, '-');
    const locale = typeof i18n?.resolveLocale === 'function'
      ? i18n.resolveLocale(raw)
      : raw.startsWith('zh-tw') || raw.startsWith('zh-hk') || raw.startsWith('zh-mo') ? 'zh-TW' : raw.startsWith('zh') ? 'zh-CN' : raw.slice(0, 2);
    return TEXT[locale] || TEXT.en;
  }
  function createSettingsUi(slot, opts = {}) {
    if (!slot || !slot.ownerDocument) return null;
    const doc = slot.ownerDocument;
    const bridge = G.__agPrismPromptEnhancerBridge;
    if (!bridge || typeof bridge.call !== 'function') return null;
    doc.getElementById?.(STYLE_ID)?.remove?.();
    const style = doc.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; doc.head?.appendChild(style);
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    const t = strings(opts.lang || doc.documentElement?.getAttribute?.('data-ag-cs-lang') || doc.documentElement?.lang || 'en');
    const card = doc.createElement('div'); card.className = 'ag-prism-pe-card'; card.setAttribute('data-testid', 'prism-prompt-enhancer-card');
    const head = doc.createElement('div'); head.className = 'ag-prism-pe-head';
    const title = doc.createElement('span'); title.textContent = t[0];
    head.append(title);
    const desc = doc.createElement('div'); desc.className = 'ag-prism-pe-desc'; desc.textContent = t[1];
    const profileRow = doc.createElement('div'); profileRow.className = 'ag-prism-pe-row';
    const profileLabel = doc.createElement('label'); profileLabel.textContent = t[3];
    const profile = doc.createElement('select'); profile.setAttribute('data-testid', 'prism-pe-profile');
    const modelRow = doc.createElement('div'); modelRow.className = 'ag-prism-pe-row';
    const modelLabel = doc.createElement('label'); modelLabel.textContent = t[4];
    const model = doc.createElement('input'); model.type = 'text'; model.setAttribute('data-testid', 'prism-pe-model');
    model.autocomplete = 'off';
    const modelList = doc.createElement('datalist');
    modelList.id = `prism-pe-models-${Math.random().toString(36).slice(2, 9)}`;
    model.setAttribute('list', modelList.id);
    profileRow.append(profileLabel, profile);
    modelRow.append(modelLabel, model, modelList);
    const contextRow = doc.createElement('div'); contextRow.className = 'ag-prism-pe-row';
    const contextLabel = doc.createElement('label'); contextLabel.textContent = t[13];
    const contextToggle = doc.createElement('input'); contextToggle.type = 'checkbox';
    contextToggle.setAttribute('data-testid', 'prism-pe-context-toggle');
    contextToggle.style.flex = '0 0 auto';
    contextToggle.style.width = 'auto';
    contextRow.append(contextLabel, contextToggle);
    const countRow = doc.createElement('div'); countRow.className = 'ag-prism-pe-row';
    const countLabel = doc.createElement('label'); countLabel.textContent = t[14];
    const contextCount = doc.createElement('select'); contextCount.setAttribute('data-testid', 'prism-pe-context-count');
    for (const n of [1, 2, 3, 4]) {
      const opt = doc.createElement('option'); opt.value = String(n); opt.textContent = `${n} ${t[15]}`;
      contextCount.appendChild(opt);
    }
    countRow.append(countLabel, contextCount);
    const actions = doc.createElement('div'); actions.className = 'ag-prism-pe-actions';
    const makeButton = (label, primary = false) => {
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'ag-prism-pe-btn'; button.textContent = label;
      if (primary) button.setAttribute('data-primary', '1');
      return button;
    };
    const load = makeButton(t[5]);
    const test = makeButton(t[6]);
    const save = makeButton(t[7], true);
    actions.append(load, test, save);
    const status = doc.createElement('div'); status.className = 'ag-prism-pe-status';
    card.append(head, desc, profileRow, modelRow, contextRow, countRow, actions, status); slot.appendChild(card); slot.hidden = false;
    let state = { config: { profileId: '', model: '', includeRecentContext: false, recentContextCount: 1 }, profiles: [] };
    let loadedModels = [];
    const setStatus = (value) => { status.textContent = String(value || ''); };
    const selectedProfileId = () => String(profile.value || state.config.profileId || '');
    const renderProfiles = () => {
      while (profile.firstChild) profile.removeChild(profile.firstChild);
      const choose = doc.createElement('option'); choose.value = ''; choose.textContent = t[12]; profile.appendChild(choose);
      for (const item of state.profiles) {
        const option = doc.createElement('option'); option.value = item.id;
        option.textContent = `${item.name || item.id}${item.hasApiKey ? ' · API Key' : item.keylessAllowed ? ' · keyless' : ''}`;
        profile.appendChild(option);
      }
      profile.value = state.config.profileId || state.backend?.profileId || '';
    };
    const renderModels = () => {
      const currentValue = String(model.value || '');
      while (modelList.firstChild) modelList.removeChild(modelList.firstChild);
      for (const id of loadedModels) {
        const option = doc.createElement('option'); option.value = id; modelList.appendChild(option);
      }
      model.value = currentValue || state.config.model || state.profiles.find((item) => item.id === selectedProfileId())?.model || state.backend?.model || '';
    };
    const renderContext = () => {
      const enabled = Boolean(state.config?.includeRecentContext);
      const count = [1, 2, 3, 4].includes(Number(state.config?.recentContextCount)) ? Number(state.config.recentContextCount) : 1;
      contextToggle.checked = enabled;
      contextCount.value = String(count);
      contextCount.disabled = !enabled;
    };
    contextToggle.addEventListener('change', () => {
      contextCount.disabled = !contextToggle.checked;
    });
    const reload = async () => {
      setStatus(t[8]);
      const result = await bridge.call('get-config', {}, 8000);
      if (result?.ok) {
        state = result;
        renderProfiles();
        renderModels();
        renderContext();
        setStatus('');
      } else setStatus(`${t[11]}${result?.error || result?.reason || 'offline'}`);
      return result;
    };
    profile.addEventListener('change', () => {
      const selected = state.profiles.find((item) => item.id === selectedProfileId());
      state.config = { ...state.config, profileId: selected?.id || '', model: selected?.model || '' };
      model.value = selected?.model || '';
      loadedModels = [];
      renderModels();
    });
    load.addEventListener('click', async () => {
      const profileId = selectedProfileId();
      if (!profileId) { setStatus(`${t[11]}${t[12]}`); return; }
      load.disabled = true;
      const result = await bridge.call('fetch-models', { profileId }, 14000);
      load.disabled = false;
      if (result?.ok && Array.isArray(result.models)) {
        loadedModels = result.models;
        renderModels();
        setStatus(`${result.models.length} models`);
      } else setStatus(`${t[11]}${result?.error || 'model list unavailable'}`);
    });
    test.addEventListener('click', async () => {
      test.disabled = true;
      const result = await bridge.call('test-connection', { profileId: selectedProfileId(), model: model.value }, 18000);
      test.disabled = false;
      setStatus(result?.ok ? t[10] : `${t[11]}${result?.error || 'connection failed'}`);
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      const result = await bridge.call('save-config', {
        profileId: selectedProfileId(),
        model: model.value,
        includeRecentContext: Boolean(contextToggle.checked),
        recentContextCount: Number(contextCount.value) || 1,
      }, 8000);
      save.disabled = false;
      if (result?.ok) {
        state = result;
        renderProfiles();
        renderModels();
        renderContext();
        try { G.__agPrismPromptEnhancer?.applyConfig?.(result.config); } catch {}
        setStatus(t[9]);
      }
      else setStatus(`${t[11]}${result?.error || 'save failed'}`);
    });
    void reload();
    const handle = { root: card, reloadProfiles: reload, destroy: () => { style.remove(); card.remove(); } };
    G.__agPrismPromptEnhancerSettingsUi = handle;
    return handle;
  }
  G.__prismMountPromptEnhancerUi = createSettingsUi;
  if (typeof window !== 'undefined' && window) window.__prismMountPromptEnhancerUi = createSettingsUi;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
