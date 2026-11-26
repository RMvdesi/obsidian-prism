// Obsidian Prism - Prompt Enhancer settings card (Channel 13).
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const STYLE_ID = 'ag-prism-prompt-enhancer-settings-css';
  const CSS = '.ag-prism-pe-card{margin-top:10px;padding:12px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.28));border-radius:8px;background:var(--ag-cs-card-bg,rgba(128,128,145,.06));}.ag-prism-pe-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600;font-size:13px;}.ag-prism-pe-desc{margin:5px 0 10px;color:var(--muted-foreground,rgba(128,128,145,.9));font-size:12px;line-height:1.45;}.ag-prism-pe-row{display:flex;align-items:center;gap:8px;margin:7px 0;}.ag-prism-pe-row label{min-width:92px;font-size:12px;}.ag-prism-pe-row select,.ag-prism-pe-row input{min-width:0;flex:1;padding:6px 7px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:6px;background:var(--background,rgba(0,0,0,.08));color:inherit;font:inherit;font-size:12px;}.ag-prism-pe-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}.ag-prism-pe-btn{padding:6px 9px;border:1px solid var(--ag-cs-border-1,rgba(128,128,145,.3));border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;}.ag-prism-pe-btn[data-primary="1"]{background:var(--primary,rgba(59,130,246,.85));color:var(--primary-foreground,#fff);border-color:transparent;}.ag-prism-pe-status{min-height:17px;margin-top:8px;color:var(--muted-foreground,rgba(128,128,145,.9));font-size:11px;}';
  const TEXT = {
    'zh-CN': ['Prompt Enhancer', '整理为可直接交给 AI Agent 执行的结构化指令。API Key 和 Base URL 复用现有 Profile；仅在主动点击时发送原文与最近 4 条相关对话，不单独保存密钥。', '启用提示词增强', 'API Profile', '增强模型 ID', '获取模型列表', '连接测试', '保存设置', '正在加载…', '已保存', '连接正常', '失败：', '选择共享 Profile'],
    'zh-TW': ['Prompt Enhancer', '整理為可直接交給 AI Agent 執行的結構化指令。API Key 和 Base URL 會重用現有 Profile；僅在主動點擊時傳送原文與最近 4 條相關對話，不另存密鑰。', '啟用提示詞增強', 'API Profile', '增強模型 ID', '取得模型清單', '連線測試', '儲存設定', '正在載入…', '已儲存', '連線正常', '失敗：', '選擇共用 Profile'],
    en: ['Prompt Enhancer', 'Turns a request into a structured instruction for an AI agent. API keys and base URLs reuse an existing profile; only the original text and up to 4 relevant recent turns are sent after you click Enhance. No key is stored separately.', 'Enable Prompt Enhancer', 'API profile', 'Enhancement model ID', 'Fetch models', 'Test connection', 'Save settings', 'Loading…', 'Saved', 'Connected', 'Failed: ', 'Select shared profile'],
    ja: ['Prompt Enhancer', '依頼を AI エージェント向けの構造化指示にします。API キーと Base URL は既存 Profile を使用し、クリック時に原文と関連する直近 4 件までを送信します。キーは別途保存しません。', 'プロンプト強化を有効化', 'API Profile', '強化モデル ID', 'モデル一覧を取得', '接続テスト', '設定を保存', '読み込み中…', '保存しました', '接続しました', '失敗: ', '共有 Profile を選択'],
    ko: ['Prompt Enhancer', '요청을 AI 에이전트가 실행할 수 있는 구조화된 지시로 바꿉니다. API 키와 Base URL은 기존 프로필을 재사용하며, 클릭할 때만 원문과 관련된 최근 대화 최대 4개를 전송합니다. 키를 별도로 저장하지 않습니다.', '프롬프트 강화 사용', 'API 프로필', '강화 모델 ID', '모델 목록 가져오기', '연결 테스트', '설정 저장', '불러오는 중…', '저장됨', '연결됨', '실패: ', '공유 프로필 선택'],
    es: ['Prompt Enhancer', 'Convierte una solicitud en instrucciones estructuradas para un agente. Reutiliza el perfil API existente; solo al hacer clic envía el texto original y hasta 4 turnos recientes relevantes. No guarda otra clave.', 'Activar mejorador', 'Perfil API', 'ID del modelo', 'Obtener modelos', 'Probar conexión', 'Guardar ajustes', 'Cargando…', 'Guardado', 'Conectado', 'Error: ', 'Selecciona un perfil compartido'],
    fr: ['Prompt Enhancer', 'Transforme une demande en instructions structurées pour un agent. Réutilise le profil API existant ; au clic, envoie uniquement le texte original et jusqu’à 4 échanges récents pertinents. Aucune clé séparée.', 'Activer l’améliorateur', 'Profil API', 'ID du modèle', 'Charger les modèles', 'Tester la connexion', 'Enregistrer', 'Chargement…', 'Enregistré', 'Connecté', 'Échec : ', 'Choisir un profil partagé'],
    de: ['Prompt Enhancer', 'Erstellt strukturierte Anweisungen für einen KI-Agenten. Verwendet das vorhandene API-Profil; erst nach dem Klick werden Originaltext und bis zu 4 relevante aktuelle Gesprächsbeiträge gesendet. Es wird kein weiterer Schlüssel gespeichert.', 'Prompt-Verbesserer aktivieren', 'API-Profil', 'Modell-ID', 'Modelle laden', 'Verbindung testen', 'Einstellungen speichern', 'Lädt…', 'Gespeichert', 'Verbunden', 'Fehler: ', 'Gemeinsames Profil wählen'],
  };
  function strings(lang) {
    const key = String(lang || '').toLowerCase();
    if (key.startsWith('zh-tw') || key.startsWith('zh-hk')) return TEXT['zh-TW'];
    if (key.startsWith('zh')) return TEXT['zh-CN'];
    return TEXT[key.slice(0, 2)] || TEXT.en;
  }
  function createSettingsUi(slot, opts = {}) {
    if (!slot || !slot.ownerDocument) return null;
    const doc = slot.ownerDocument;
    const bridge = G.__agPrismPromptEnhancerBridge || G.__agPrismSuggesterBridge;
    if (!bridge || typeof bridge.call !== 'function') return null;
    doc.getElementById?.(STYLE_ID)?.remove?.();
    const style = doc.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; doc.head?.appendChild(style);
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    const t = strings(opts.lang || doc.documentElement?.lang || 'en');
    const card = doc.createElement('div'); card.className = 'ag-prism-pe-card'; card.setAttribute('data-testid', 'prism-prompt-enhancer-card');
    const head = doc.createElement('div'); head.className = 'ag-prism-pe-head';
    const title = doc.createElement('span'); title.textContent = t[0];
    const enabled = doc.createElement('input'); enabled.type = 'checkbox'; enabled.setAttribute('data-testid', 'prism-pe-enabled');
    const enabledLabel = doc.createElement('label'); enabledLabel.append(enabled, doc.createTextNode(` ${t[2]}`));
    head.append(title, enabledLabel);
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
    card.append(head, desc, profileRow, modelRow, actions, status); slot.appendChild(card); slot.hidden = false;
    let state = { config: { enabled: false, profileId: '', model: '' }, profiles: [] };
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
    const reload = async () => {
      setStatus(t[8]);
      const result = await bridge.call('enhancer-get-config', {}, 8000);
      if (result?.ok) {
        state = result;
        enabled.checked = Boolean(result.config?.enabled);
        renderProfiles();
        renderModels();
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
      const result = await bridge.call('enhancer-fetch-models', { profileId }, 14000);
      load.disabled = false;
      if (result?.ok && Array.isArray(result.models)) {
        loadedModels = result.models;
        renderModels();
        setStatus(`${result.models.length} models`);
      } else setStatus(`${t[11]}${result?.error || 'model list unavailable'}`);
    });
    test.addEventListener('click', async () => {
      test.disabled = true;
      const result = await bridge.call('enhancer-test-connection', { profileId: selectedProfileId(), model: model.value }, 18000);
      test.disabled = false;
      setStatus(result?.ok ? t[10] : `${t[11]}${result?.error || 'connection failed'}`);
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      const result = await bridge.call('enhancer-save-config', { enabled: enabled.checked, profileId: selectedProfileId(), model: model.value }, 8000);
      save.disabled = false;
      if (result?.ok) {
        state = result;
        renderProfiles();
        renderModels();
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
