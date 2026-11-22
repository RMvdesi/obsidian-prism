// Obsidian Prism — Read-only Host Renderer LS Wrapper RPC Adapter (Antigravity v2.34.0+)
// Used ONLY as a fallback when language_server no longer exposes --csrf_token on the command line.
// Strictly read-only allowlist; projects numeric/structural telemetry in-renderer and strips all prompts,
// message text, snippets, tool payloads, and token breakdown trees before crossing CDP.

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_METHODS = new Set([
  'Probe',
  'GetUserStatus',
  'RetrieveUserQuotaSummary',
  'GetAllCascadeTrajectories',
  'GetCascadeTrajectory',
]);

function serializeJsonForEval(val) {
  const raw = JSON.stringify(val === undefined ? null : val);
  return String(raw).replace(/[<>/\u2028\u2029]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

export function protoTimestampToIso(val) {
  if (!val) return undefined;
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
  }
  if (typeof val === 'object') {
    const sec = Number(val.seconds ?? 0);
    const nanos = Number(val.nanos ?? 0);
    if (!Number.isFinite(sec) || sec <= 0) return undefined;
    const ms = sec * 1000 + (Number.isFinite(nanos) && nanos >= 0 ? Math.floor(nanos / 1e6) : 0);
    if (!Number.isFinite(ms)) return undefined;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }
  return undefined;
}

export function protoDurationToObject(val) {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'number') return Number.isFinite(val) && val >= 0 ? val : undefined;
  if (typeof val === 'string') return /^\d+(?:\.\d+)?s$/.test(val) ? val : undefined;
  if (typeof val === 'object') {
    if (val.seconds === undefined && val.nanos === undefined) return undefined;
    const sec = Math.trunc(Number(val.seconds ?? 0));
    const nanos = Math.trunc(Number(val.nanos ?? 0));
    if (!Number.isSafeInteger(sec) || sec < 0 || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1e9) {
      return undefined;
    }
    return { seconds: sec, nanos };
  }
  return undefined;
}

export function camelToUpperSnake(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function normalizeApiProvider(provider, meta = {}) {
  if (typeof provider === 'string' && /GOOGLE_GEMINI|OPENAI|ANTHROPIC/i.test(provider)) {
    return provider;
  }
  const hint = `${meta.modelDisplayName || ''} ${meta.responseModel || ''} ${meta.responseModelFull || ''}`.toLowerCase();
  const custom = meta.customMetadata && typeof meta.customMetadata === 'object' ? meta.customMetadata : {};
  if (custom.used_claude === 'true' || /\bclaude\b|anthropic|\bsonnet\b|\bopus\b|\bhaiku\b/.test(hint)) {
    return 'API_PROVIDER_ANTHROPIC';
  }
  if (/\bgpt\b|openai|\bo[134]\b/.test(hint)) {
    return 'API_PROVIDER_OPENAI';
  }
  if (/\bgemini\b|neon|carbon|argon|hydrogen|orchestrator/.test(hint) || Number(provider) === 24) {
    return 'API_PROVIDER_GOOGLE_GEMINI';
  }
  return typeof provider === 'string' ? provider : '';
}

export function extractModelLabelMap(userStatusPayload) {
  const map = new Map();
  const configs = userStatusPayload?.userStatus?.cascadeModelConfigData?.clientModelConfigs;
  if (!Array.isArray(configs)) return map;
  for (const cfg of configs) {
    if (!cfg || typeof cfg !== 'object') continue;
    const label = typeof cfg.label === 'string' ? cfg.label.trim() : '';
    if (!label) continue;
    const modelVal = cfg.modelOrAlias?.choice?.value ?? cfg.modelOrAlias?.model;
    if (modelVal !== undefined && modelVal !== null) {
      map.set(String(modelVal), label);
    }
    if (typeof cfg.modelId === 'string' && cfg.modelId.trim()) {
      map.set(cfg.modelId.trim(), label);
    }
  }
  return map;
}

export function normalizeRendererUserStatus(raw) {
  const us = raw?.userStatus && typeof raw.userStatus === 'object' ? raw.userStatus : {};
  const configs = Array.isArray(us?.cascadeModelConfigData?.clientModelConfigs)
    ? us.cascadeModelConfigData.clientModelConfigs.map((cfg) => ({
        label: typeof cfg?.label === 'string' ? cfg.label : '',
        modelId: typeof cfg?.modelId === 'string' ? cfg.modelId : '',
        modelOrAlias: cfg?.modelOrAlias || undefined,
        quotaInfo: cfg?.quotaInfo
          ? {
              remainingFraction: cfg.quotaInfo.remainingFraction,
              resetTime: protoTimestampToIso(cfg.quotaInfo.resetTime),
            }
          : undefined,
      }))
    : [];
  return {
    userStatus: {
      email: typeof us.email === 'string' ? us.email : undefined,
      name: typeof us.name === 'string' ? us.name : undefined,
      cascadeModelConfigData: { clientModelConfigs: configs },
    },
  };
}

export function normalizeRendererQuotaSummary(raw) {
  const root = raw?.response && typeof raw.response === 'object' ? raw.response : raw && typeof raw === 'object' ? raw : {};
  const groups = Array.isArray(root.groups)
    ? root.groups
        .filter((g) => g && typeof g === 'object')
        .map((g) => ({
          displayName: typeof g.displayName === 'string' ? g.displayName : '',
          description: typeof g.description === 'string' ? g.description : '',
          buckets: Array.isArray(g.buckets)
            ? g.buckets
                .filter((b) => b && typeof b === 'object')
                .map((b) => {
                  const out = {
                    bucketId: typeof b.bucketId === 'string' ? b.bucketId : '',
                    displayName: typeof b.displayName === 'string' ? b.displayName : '',
                    description: typeof b.description === 'string' ? b.description : '',
                    disabled: b.disabled === true,
                  };
                  if (typeof b.window === 'string') out.window = b.window;
                  if (b.remaining && typeof b.remaining === 'object') {
                    if (b.remaining.case === 'remainingFraction' && b.remaining.value !== undefined) {
                      out.remainingFraction = b.remaining.value;
                    } else if (b.remaining.case === 'remainingAmount' && b.remaining.value !== undefined) {
                      out.remainingAmount = b.remaining.value;
                    } else {
                      if (b.remaining.remainingFraction !== undefined) out.remainingFraction = b.remaining.remainingFraction;
                      if (b.remaining.remainingAmount !== undefined) out.remainingAmount = b.remaining.remainingAmount;
                    }
                  }
                  if (b.remainingFraction !== undefined) out.remainingFraction = b.remainingFraction;
                  if (b.remainingAmount !== undefined) out.remainingAmount = b.remainingAmount;
                  const iso = protoTimestampToIso(b.resetTime);
                  if (iso) out.resetTime = iso;
                  return out;
                })
            : [],
        }))
    : [];
  return { response: { groups } };
}

export function normalizeRendererSummaries(raw) {
  const out = {};
  if (raw && typeof raw.trajectorySummaries === 'object' && !Array.isArray(raw.trajectorySummaries)) {
    for (const [id, sum] of Object.entries(raw.trajectorySummaries)) {
      if (!GUID_RE.test(id) || !sum || typeof sum !== 'object') continue;
      const key = id.toLowerCase();
      const modIso = protoTimestampToIso(sum.lastModifiedTime);
      const createdIso = protoTimestampToIso(sum.createdTime);
      const stepCount = Number(sum.stepCount ?? sum.numTotalSteps ?? 0);
      out[key] = {
        summary: typeof sum.summary === 'string' ? sum.summary : typeof sum.title === 'string' ? sum.title : '未命名会话',
        ...(Number.isSafeInteger(stepCount) && stepCount > 0 ? { stepCount } : {}),
        ...(modIso ? { lastModifiedTime: modIso } : {}),
        ...(createdIso ? { createdTime: createdIso } : {}),
        ...(typeof sum.status === 'string' ? { status: sum.status } : {}),
        ...(Array.isArray(sum.workspaces) ? { workspaces: sum.workspaces } : {}),
        ...(sum.trajectoryMetadata && typeof sum.trajectoryMetadata === 'object' ? { trajectoryMetadata: sum.trajectoryMetadata } : {}),
      };
    }
    return { trajectorySummaries: out };
  }
  const results = Array.isArray(raw?.results) ? raw.results : [];
  for (const item of results) {
    const id = typeof item?.cascadeId === 'string' ? item.cascadeId.trim() : '';
    if (!GUID_RE.test(id)) continue;
    const key = id.toLowerCase();
    const modIso = protoTimestampToIso(item.lastModifiedTime);
    const ws = typeof item.workspaceName === 'string' ? item.workspaceName.trim() : '';
    out[key] = {
      summary: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '未命名会话',
      ...(modIso ? { lastModifiedTime: modIso } : {}),
      ...(ws ? { workspaces: [{ workspaceFolderAbsoluteUri: ws }] } : {}),
    };
  }
  return { trajectorySummaries: out };
}

export function normalizeRendererTrajectory(raw, cascadeId, modelLabelMap = null) {
  const traj = raw?.trajectory && typeof raw.trajectory === 'object' ? raw.trajectory : {};
  const rawSteps = Array.isArray(traj.steps) ? traj.steps : [];
  const rawGms = Array.isArray(traj.generatorMetadata) ? traj.generatorMetadata : [];

  const steps = rawSteps.map((s) => {
    const stepCase = typeof s?.stepCase === 'string' ? s.stepCase : typeof s?.step?.case === 'string' ? s.step.case : '';
    let typeStr = typeof s?.type === 'string' && s.type ? s.type : '';
    if (!typeStr && stepCase) {
      typeStr = `CORTEX_STEP_TYPE_${camelToUpperSnake(stepCase)}`;
    }
    if (!typeStr && s?.type !== undefined) {
      typeStr = `CORTEX_STEP_TYPE_${String(s.type)}`;
    }
    const meta = s?.metadata && typeof s.metadata === 'object' ? s.metadata : {};
    const normMeta = {};
    const createdAt = protoTimestampToIso(meta.createdAt);
    const startedAt = protoTimestampToIso(meta.startedAt);
    const completedAt = protoTimestampToIso(meta.completedAt);
    if (createdAt) normMeta.createdAt = createdAt;
    if (startedAt) normMeta.startedAt = startedAt;
    if (completedAt) normMeta.completedAt = completedAt;
    if (meta.hasToolCall || meta.toolCall) normMeta.toolCall = { id: '1' };

    const stepOut = { type: typeStr, metadata: normMeta };
    if (stepCase === 'plannerResponse' || s?.hasToolCalls || s?.plannerResponse) {
      const hasCalls = Boolean(s?.hasToolCalls || s?.plannerResponse?.toolCalls?.length);
      const hasResp = Boolean(s?.hasResponseText || (typeof s?.plannerResponse?.response === 'string' && s.plannerResponse.response.trim()));
      if (hasCalls || hasResp) {
        stepOut.plannerResponse = {
          toolCalls: hasCalls ? [{}] : [],
          response: hasResp ? 'x' : '',
        };
      }
    }
    const inv = s?.invokeSubagent || (stepCase === 'invokeSubagent' ? s?.step?.value : null);
    if (inv && typeof inv === 'object') {
      const cid = typeof inv.conversationId === 'string' && GUID_RE.test(inv.conversationId) ? inv.conversationId.toLowerCase() : null;
      const resIds = Array.isArray(inv.results)
        ? inv.results
            .map((r) => (typeof r?.conversationId === 'string' && GUID_RE.test(r.conversationId) ? { conversationId: r.conversationId.toLowerCase() } : null))
            .filter(Boolean)
        : [];
      if (cid || resIds.length) {
        stepOut.invokeSubagent = { ...(cid ? { conversationId: cid } : {}), ...(resIds.length ? { results: resIds } : {}) };
      }
    }
    return stepOut;
  });

  const generatorMetadata = [];
  for (const g of rawGms) {
    if (!g || typeof g !== 'object') continue;
    const cm = g.chatModel || (g.metadata?.case === 'chatModel' ? g.metadata.value : null);
    if (!cm || typeof cm !== 'object') continue;
    const u = cm.usage && typeof cm.usage === 'object' ? cm.usage : null;
    if (!u) continue;
    const modelKey = cm.model !== undefined && cm.model !== null ? String(cm.model) : u.model !== undefined && u.model !== null ? String(u.model) : '';
    const displayName =
      (typeof cm.modelDisplayName === 'string' && cm.modelDisplayName.trim()) ||
      (modelLabelMap && modelKey && modelLabelMap.get(modelKey)) ||
      (modelLabelMap && typeof cm.responseModel === 'string' && modelLabelMap.get(cm.responseModel)) ||
      '';
    const provider = normalizeApiProvider(u.apiProvider, {
      modelDisplayName: displayName,
      responseModel: cm.responseModel,
      responseModelFull: cm.responseModelFull,
      customMetadata: cm.customMetadata,
    });
    const normUsage = {
      model: u.model,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      ...(u.thinkingOutputTokens !== undefined ? { thinkingOutputTokens: u.thinkingOutputTokens } : {}),
      ...(u.responseOutputTokens !== undefined ? { responseOutputTokens: u.responseOutputTokens } : {}),
      ...(u.cacheWriteTokens !== undefined ? { cacheWriteTokens: u.cacheWriteTokens } : {}),
      ...(u.cacheReadTokens !== undefined ? { cacheReadTokens: u.cacheReadTokens } : {}),
      apiProvider: provider,
      ...(typeof u.messageId === 'string' && u.messageId ? { messageId: u.messageId } : {}),
      ...(typeof u.responseId === 'string' && u.responseId ? { responseId: u.responseId } : {}),
    };
    const retryInfos = Array.isArray(cm.retryInfos)
      ? cm.retryInfos
          .filter((ri) => ri && ri.usage && typeof ri.usage === 'object')
          .map((ri) => ({
            usage: {
              outputTokens: ri.usage.outputTokens,
              ...(ri.usage.responseOutputTokens !== undefined ? { responseOutputTokens: ri.usage.responseOutputTokens } : {}),
              ...(ri.usage.thinkingOutputTokens !== undefined ? { thinkingOutputTokens: ri.usage.thinkingOutputTokens } : {}),
            },
          }))
      : [];
    const csm = cm.chatStartMetadata && typeof cm.chatStartMetadata === 'object' ? cm.chatStartMetadata : null;
    const cw = csm?.contextWindowMetadata && typeof csm.contextWindowMetadata === 'object' ? csm.contextWindowMetadata : null;
    const csmCreated = protoTimestampToIso(csm?.createdAt);
    const chatStartMetadata = csm
      ? {
          ...(csmCreated ? { createdAt: csmCreated } : {}),
          ...(csm.startStepIndex !== undefined ? { startStepIndex: Number(csm.startStepIndex) } : {}),
          ...(cw
            ? {
                contextWindowMetadata: {
                  estimatedTokensUsed: cw.estimatedTokensUsed ?? cw.tokenBreakdown?.totalTokens,
                  maxContextTokens: cw.maxContextTokens,
                },
              }
            : {}),
        }
      : undefined;
    const ttft = protoDurationToObject(cm.timeToFirstToken);
    const streamDur = protoDurationToObject(cm.streamingDuration);
    const stepIndices = Array.isArray(g.stepIndices)
      ? g.stepIndices.map((idx) => Number(idx)).filter((idx) => Number.isInteger(idx) && idx >= 0)
      : [];
    generatorMetadata.push({
      stepIndices,
      chatModel: {
        model: cm.model,
        ...(displayName ? { modelDisplayName: displayName } : {}),
        ...(typeof cm.responseModel === 'string' && cm.responseModel ? { responseModel: cm.responseModel } : {}),
        ...(typeof cm.responseModelFull === 'string' && cm.responseModelFull ? { responseModelFull: cm.responseModelFull } : {}),
        usage: normUsage,
        ...(retryInfos.length ? { retryInfos } : {}),
        ...(chatStartMetadata ? { chatStartMetadata } : {}),
        ...(ttft !== undefined ? { timeToFirstToken: ttft } : {}),
        ...(streamDur !== undefined ? { streamingDuration: streamDur } : {}),
      },
    });
  }

  const rawStatus = raw?.status;
  const status =
    typeof rawStatus === 'string' && rawStatus
      ? rawStatus
      : rawStatus !== undefined && rawStatus !== null
        ? `CASCADE_RUN_STATUS_${String(rawStatus)}`
        : null;

  const numSteps = Number(raw?.numTotalSteps);
  const numGm = Number(raw?.numTotalGeneratorMetadata);
  return {
    status,
    numTotalSteps: Number.isSafeInteger(numSteps) && numSteps >= 0 ? numSteps : steps.length,
    numTotalGeneratorMetadata: Number.isSafeInteger(numGm) && numGm >= 0 ? numGm : generatorMetadata.length,
    trajectory: {
      cascadeId: String(traj.cascadeId || cascadeId || '').toLowerCase(),
      steps,
      generatorMetadata,
    },
  };
}

export function buildRendererRpcExpression(method, body = {}) {
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Unsupported renderer RPC method: ${String(method)}`);
  }
  const safeParams = { method };
  if (method === 'GetCascadeTrajectory') {
    const cid = typeof body?.cascadeId === 'string' ? body.cascadeId.trim() : '';
    if (!GUID_RE.test(cid)) throw new Error('Invalid cascadeId for renderer RPC');
    safeParams.cascadeId = cid;
  } else if (method === 'RetrieveUserQuotaSummary') {
    safeParams.forceRefresh = Boolean(body?.forceRefresh);
  }
  const argLiteral = serializeJsonForEval(safeParams);
  return `(async (params) => {
    const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
    const isLs = (v) => Boolean(v && typeof v === 'object' && typeof v.getUserStatus === 'function' && typeof v.getCascadeTrajectory === 'function');
    const clearCachedLs = () => { try { if (g) delete g.__agPrismLsRef; } catch {} };
    const saveCachedLs = (v) => {
      if (!g || !v) return;
      const box = typeof WeakRef === 'function' ? new WeakRef(v) : v;
      try {
        Object.defineProperty(g, '__agPrismLsRef', { value: box, configurable: true, writable: true, enumerable: false });
      } catch {
        try { g.__agPrismLsRef = box; } catch {}
      }
    };
    let usedCache = false;
    const findLs = (forceRescan = false) => {
      if (!forceRescan) {
        try {
          const ref = g && g.__agPrismLsRef;
          const cached = ref && typeof ref.deref === 'function' ? ref.deref() : ref && ref.value ? ref.value : ref;
          if (isLs(cached)) {
            usedCache = true;
            return cached;
          }
          if (ref) clearCachedLs();
        } catch {}
      }
      usedCache = false;
      const root = document.getElementById('root') || document.body;
      if (!root) return null;
      const fk = Object.keys(root).find((k) => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$'));
      if (!fk || !root[fk]) return null;
      const q = [root[fk]];
      const seen = new Set();
      let visited = 0;
      while (q.length && visited < 4000) {
        const f = q.shift();
        if (!f || seen.has(f)) continue;
        seen.add(f);
        visited += 1;
        const v = f.memoizedProps && f.memoizedProps.value;
        if (isLs(v)) {
          saveCachedLs(v);
          return v;
        }
        if (f.child) q.push(f.child);
        if (f.sibling) q.push(f.sibling);
      }
      return null;
    };
    let ls = findLs(false);
    if (!ls) return { ok: false, error: 'renderer_ls_unavailable' };
    if (params.method === 'Probe') return { ok: true, data: { available: true } };
    const ts = (v) => {
      if (!v) return undefined;
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && (v.seconds !== undefined || v.nanos !== undefined)) {
        return { seconds: String(v.seconds ?? 0), nanos: Number(v.nanos ?? 0) };
      }
      return undefined;
    };
    const numStr = (v) => (v === undefined || v === null ? undefined : String(v));
    const numVal = (v) => {
      if (v === undefined || v === null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const choiceVal = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'string') {
        const n = Number(v);
        return /^\d+$/.test(v) && Number.isSafeInteger(n) ? n : v;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : String(v);
    };
    const tsSec = (v) => {
      if (!v) return 0;
      if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms / 1000 : 0; }
      if (typeof v === 'object' && v.seconds !== undefined) { const s = Number(v.seconds); return Number.isFinite(s) ? s : 0; }
      return 0;
    };
    const execWithLs = async (activeLs) => {
      if (params.method === 'GetUserStatus') {
        const r = await activeLs.getUserStatus({});
        const us = (r && r.userStatus) || {};
        const cfgs = (us.cascadeModelConfigData && us.cascadeModelConfigData.clientModelConfigs) || [];
        return {
          ok: true,
          data: {
            userStatus: {
              email: typeof us.email === 'string' ? us.email : undefined,
              name: typeof us.name === 'string' ? us.name : undefined,
              cascadeModelConfigData: {
                clientModelConfigs: cfgs.slice(0, 256).map((c) => ({
                  label: c && c.label,
                  modelId: c && c.modelId,
                  modelOrAlias: c && c.modelOrAlias && c.modelOrAlias.choice ? { choice: { case: c.modelOrAlias.choice.case, value: choiceVal(c.modelOrAlias.choice.value) } } : undefined,
                  quotaInfo: c && c.quotaInfo ? { remainingFraction: c.quotaInfo.remainingFraction, resetTime: ts(c.quotaInfo.resetTime) } : undefined,
                })),
              },
            },
          },
        };
      }
      if (params.method === 'RetrieveUserQuotaSummary') {
        const r = await activeLs.retrieveUserQuotaSummary(params.forceRefresh ? { forceRefresh: true } : {});
        const root = (r && r.response) || r || {};
        const groups = Array.isArray(root.groups) ? root.groups.map((g) => ({
          displayName: g && g.displayName,
          description: g && g.description,
          buckets: Array.isArray(g && g.buckets) ? g.buckets.map((b) => ({
            bucketId: b && b.bucketId,
            displayName: b && b.displayName,
            description: b && b.description,
            window: b && b.window,
            disabled: Boolean(b && b.disabled),
            remaining: b && b.remaining ? { case: b.remaining.case, value: b.remaining.value !== undefined ? numVal(b.remaining.value) : undefined } : undefined,
            remainingFraction: b && b.remainingFraction,
            remainingAmount: b && b.remainingAmount !== undefined ? numStr(b.remainingAmount) : undefined,
            resetTime: ts(b && b.resetTime),
          })) : [],
        })) : [];
        return { ok: true, data: { response: { groups } } };
      }
      if (params.method === 'GetAllCascadeTrajectories') {
        const readScopeHint = () => {
          try {
            const cleanSeg = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9._:@-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
            const docEl = typeof document !== 'undefined' && document && document.documentElement;
            const attr = docEl && typeof docEl.getAttribute === 'function' ? String(docEl.getAttribute('data-ag-prism-scope') || '').trim() : '';
            if (/^(?:local|ssh:[a-z0-9._:@-]+|remote:[a-z0-9._:@-]+)$/i.test(attr)) return attr.toLowerCase();
            const href = typeof location !== 'undefined' && location && typeof location.href === 'string' ? location.href : '';
            if (href) {
              let dec = href;
              try { dec = decodeURIComponent(href); } catch {}
              const sshM = dec.match(/ssh-remote\\+([^/&#?\\s]+)/i);
              if (sshM && sshM[1]) {
                const h = cleanSeg(sshM[1]);
                if (h) return 'ssh:' + h;
              }
              const remM = dec.match(/(?:vscode-remote:\\/\\/|remoteAuthority=)([a-z0-9_-]+)\\+([^/&#?\\s]+)/i);
              if (remM && remM[1] && remM[2]) {
                const id = cleanSeg(remM[1] + '-' + remM[2]);
                if (id) return 'remote:' + id;
              }
            }
            const title = typeof document !== 'undefined' && document && typeof document.title === 'string' ? document.title : '';
            if (title) {
              const tSsh = title.match(/\\[SSH:\\s*([^\\]]+)\\]/i);
              if (tSsh && tSsh[1]) {
                const h = cleanSeg(tSsh[1]);
                if (h) return 'ssh:' + h;
              }
              const tRem = title.match(/\\[(WSL|Dev Container|Codespaces|Tunnel|Remote):\\s*([^\\]]+)\\]/i);
              if (tRem && tRem[1] && tRem[2]) {
                const id = cleanSeg(tRem[1] + '-' + tRem[2]);
                if (id) return 'remote:' + id;
              }
            }
          } catch {}
          return '';
        };
        const scopeHint = readScopeHint();
        const projectSummariesMap = (sums) => {
          const out = {};
          const keys = Object.keys(sums)
            .sort((a, b) => tsSec(sums[b] && sums[b].lastModifiedTime) - tsSec(sums[a] && sums[a].lastModifiedTime))
            .slice(0, 1024);
          for (let i = 0; i < keys.length; i += 1) {
            const k = keys[i];
            const v = sums[k];
            if (!v || typeof v !== 'object') continue;
            out[k] = {
              summary: typeof v.summary === 'string' && v.summary ? v.summary : undefined,
              stepCount: numVal(v.stepCount !== undefined ? v.stepCount : v.numTotalSteps),
              lastModifiedTime: ts(v.lastModifiedTime),
              createdTime: ts(v.createdTime),
              status: v.status,
              workspaces: Array.isArray(v.workspaces) ? v.workspaces.slice(0, 4).map((w) => ({ workspaceFolderAbsoluteUri: w && w.workspaceFolderAbsoluteUri })) : undefined,
              trajectoryMetadata: v.trajectoryMetadata ? {
                parentConversationId: v.trajectoryMetadata.parentConversationId,
                rootConversationId: v.trajectoryMetadata.rootConversationId,
                nestingDepth: numVal(v.trajectoryMetadata.nestingDepth),
              } : undefined,
            };
          }
          return out;
        };
        if (typeof activeLs.getAllCascadeTrajectories === 'function') {
          const r = await activeLs.getAllCascadeTrajectories({ excludeSubtrajectories: false });
          const out = projectSummariesMap((r && r.trajectorySummaries) || {});
          return { ok: true, data: scopeHint ? { trajectorySummaries: out, scopeHint } : { trajectorySummaries: out } };
        }
        const findReduxSummaries = () => {
          try {
            const ref = g && g.__agPrismStoreRef;
            const cached = ref && typeof ref.deref === 'function' ? ref.deref() : ref;
            if (cached && typeof cached.getState === 'function') {
              const s = cached.getState();
              if (s && s.trajectorySummaries && s.trajectorySummaries.summaries) return s.trajectorySummaries.summaries;
            }
          } catch {}
          try {
            if (typeof document === 'undefined' || !document || typeof document.querySelectorAll !== 'function') return null;
            const anchors = document.querySelectorAll('[data-testid="new-conversation-button"], [data-testid="home-greeting"], [data-testid="agent-input-box"], [data-testid="conversation-view"], [data-testid="conversation-row-sidebar"]');
            for (let i = 0; i < anchors.length; i += 1) {
              const el = anchors[i];
              const fk = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
              for (let f = fk && el[fk], depth = 0; f && depth < 60; f = f.return, depth += 1) {
                const mp = f.memoizedProps;
                if (mp && mp.store && typeof mp.store.getState === 'function') {
                  try { if (g) g.__agPrismStoreRef = typeof WeakRef === 'function' ? new WeakRef(mp.store) : mp.store; } catch {}
                  const s = mp.store.getState();
                  return (s && s.trajectorySummaries && s.trajectorySummaries.summaries) || null;
                }
                for (let d = f.dependencies && f.dependencies.firstContext; d; d = d.next) {
                  const v = d.memoizedValue;
                  if (v && v.store && typeof v.store.getState === 'function') {
                    try { if (g) g.__agPrismStoreRef = typeof WeakRef === 'function' ? new WeakRef(v.store) : v.store; } catch {}
                    const s = v.store.getState();
                    return (s && s.trajectorySummaries && s.trajectorySummaries.summaries) || null;
                  }
                }
              }
            }
          } catch {}
          return null;
        };
        const reduxSums = findReduxSummaries();
        if (reduxSums && typeof reduxSums === 'object' && Object.keys(reduxSums).length > 0) {
          const out = projectSummariesMap(reduxSums);
          if (typeof activeLs.searchConversations === 'function') {
            try {
              const sr = await activeLs.searchConversations({ query: '' });
              const sList = Array.isArray(sr && sr.results) ? sr.results : [];
              for (let i = 0; i < sList.length; i += 1) {
                const it = sList[i];
                const cid = it && typeof it.cascadeId === 'string' ? it.cascadeId.trim() : '';
                if (!cid) continue;
                if (out[cid]) {
                  if (!out[cid].summary && typeof it.title === 'string' && it.title.trim()) out[cid].summary = it.title.trim();
                } else if (Object.keys(out).length < 1024) {
                  const ws = typeof it.workspaceName === 'string' ? it.workspaceName.trim() : '';
                  out[cid] = {
                    summary: typeof it.title === 'string' && it.title.trim() ? it.title.trim() : undefined,
                    lastModifiedTime: ts(it.lastModifiedTime),
                    ...(ws ? { workspaces: [{ workspaceFolderAbsoluteUri: ws }] } : {}),
                  };
                }
              }
            } catch {}
          }
          return { ok: true, data: scopeHint ? { trajectorySummaries: out, scopeHint } : { trajectorySummaries: out } };
        }
        if (typeof activeLs.searchConversations === 'function') {
          const r = await activeLs.searchConversations({ query: '' });
          const rawList = Array.isArray(r && r.results) ? r.results.slice() : [];
          rawList.sort((a, b) => tsSec(b && b.lastModifiedTime) - tsSec(a && a.lastModifiedTime));
          const list = rawList.slice(0, 1024);
          return {
            ok: true,
            data: {
              ...(scopeHint ? { scopeHint } : {}),
              results: list.map((it) => ({
                cascadeId: it && it.cascadeId,
                title: it && it.title,
                workspaceName: it && it.workspaceName,
                archived: Boolean(it && it.archived),
                lastModifiedTime: ts(it && it.lastModifiedTime),
              })),
            },
          };
        }
        return { ok: false, error: 'renderer_summaries_unavailable' };
      }
      if (params.method === 'GetCascadeTrajectory') {
        const t = await activeLs.getCascadeTrajectory({ cascadeId: params.cascadeId });
        const traj = (t && t.trajectory) || {};
        const rawSteps = Array.isArray(traj.steps) ? traj.steps : [];
        const rawGms = Array.isArray(traj.generatorMetadata) ? traj.generatorMetadata : [];
        const guidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const steps = rawSteps.map((s) => {
          const sc = (s && s.step && s.step.case) || '';
          const sv = (s && s.step && s.step.value) || null;
          const m = (s && s.metadata) || {};
          const item = {
            type: s && s.type,
            stepCase: sc,
            metadata: {
              createdAt: ts(m.createdAt),
              startedAt: ts(m.startedAt),
              completedAt: ts(m.completedAt),
              hasToolCall: Boolean(m.toolCall),
            },
          };
          if (sc === 'plannerResponse' && sv && typeof sv === 'object') {
            item.hasToolCalls = Array.isArray(sv.toolCalls) && sv.toolCalls.length > 0;
            item.hasResponseText = typeof sv.response === 'string' && sv.response.trim().length > 0;
          } else if (sc === 'invokeSubagent' && sv && typeof sv === 'object') {
            const cid = typeof sv.conversationId === 'string' && guidRe.test(sv.conversationId) ? sv.conversationId : undefined;
            const res = Array.isArray(sv.results)
              ? sv.results.map((x) => (x && typeof x.conversationId === 'string' && guidRe.test(x.conversationId) ? { conversationId: x.conversationId } : null)).filter(Boolean)
              : [];
            if (cid || res.length) item.invokeSubagent = { conversationId: cid, results: res };
          }
          return item;
        });
        const gms = [];
        for (let i = 0; i < rawGms.length; i += 1) {
          const g = rawGms[i];
          const cm = g && ((g.metadata && g.metadata.case === 'chatModel' && g.metadata.value) || g.chatModel);
          if (!cm || !cm.usage) continue;
          const u = cm.usage;
          const csm = cm.chatStartMetadata;
          const cw = csm && csm.contextWindowMetadata;
          const cmMeta = cm.customMetadata && typeof cm.customMetadata === 'object'
            ? { used_claude: cm.customMetadata.used_claude, used_non_gemini_model: cm.customMetadata.used_non_gemini_model }
            : undefined;
          gms.push({
            stepIndices: Array.isArray(g.stepIndices) ? g.stepIndices.map(Number) : [],
            chatModel: {
              model: numVal(cm.model),
              modelDisplayName: typeof cm.modelDisplayName === 'string' ? cm.modelDisplayName : undefined,
              responseModel: typeof cm.responseModel === 'string' ? cm.responseModel : undefined,
              responseModelFull: typeof cm.responseModelFull === 'string' ? cm.responseModelFull : undefined,
              customMetadata: cmMeta,
              timeToFirstToken: ts(cm.timeToFirstToken),
              streamingDuration: ts(cm.streamingDuration),
              usage: {
                model: numVal(u.model),
                inputTokens: numStr(u.inputTokens),
                outputTokens: numStr(u.outputTokens),
                thinkingOutputTokens: numStr(u.thinkingOutputTokens),
                responseOutputTokens: numStr(u.responseOutputTokens),
                cacheWriteTokens: numStr(u.cacheWriteTokens),
                cacheReadTokens: numStr(u.cacheReadTokens),
                apiProvider: u.apiProvider,
                messageId: typeof u.messageId === 'string' ? u.messageId : undefined,
                responseId: typeof u.responseId === 'string' ? u.responseId : undefined,
              },
              retryInfos: Array.isArray(cm.retryInfos)
                ? cm.retryInfos
                    .filter((ri) => ri && ri.usage)
                    .map((ri) => ({
                      usage: {
                        outputTokens: numStr(ri.usage.outputTokens),
                        responseOutputTokens: numStr(ri.usage.responseOutputTokens),
                        thinkingOutputTokens: numStr(ri.usage.thinkingOutputTokens),
                      },
                    }))
                : [],
              chatStartMetadata: csm
                ? {
                    createdAt: ts(csm.createdAt),
                    startStepIndex: numVal(csm.startStepIndex),
                    contextWindowMetadata: cw
                      ? {
                          estimatedTokensUsed: numVal(cw.estimatedTokensUsed ?? (cw.tokenBreakdown && cw.tokenBreakdown.totalTokens)),
                          maxContextTokens: numVal(cw.maxContextTokens),
                        }
                      : undefined,
                  }
                : undefined,
            },
          });
        }
        return {
          ok: true,
          data: {
            status: t && t.status,
            numTotalSteps: numVal(t && t.numTotalSteps),
            numTotalGeneratorMetadata: numVal(t && t.numTotalGeneratorMetadata),
            trajectory: {
              cascadeId: traj.cascadeId || params.cascadeId,
              steps,
              generatorMetadata: gms,
            },
          },
        };
      }
      return { ok: false, error: 'unsupported_method' };
    };
    try {
      const firstRes = await execWithLs(ls);
      if (firstRes && !firstRes.ok && usedCache && firstRes.error === 'renderer_summaries_unavailable') {
        clearCachedLs();
        const retryLs = findLs(true);
        if (retryLs && retryLs !== ls) return await execWithLs(retryLs);
      }
      return firstRes;
    } catch (err) {
      if (usedCache) {
        clearCachedLs();
        const retryLs = findLs(true);
        if (retryLs && retryLs !== ls) {
          try {
            return await execWithLs(retryLs);
          } catch (retryErr) {
            return { ok: false, error: String((retryErr && retryErr.message) || retryErr || 'renderer_rpc_failed') };
          }
        }
      }
      return { ok: false, error: String((err && err.message) || err || 'renderer_rpc_failed') };
    }
  })(${argLiteral})`;
}
