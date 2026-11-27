// Modified by Yaniuan on 2026-11-28: add the downstream Prompt Enhancer module.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildNoThinkingParams,
  isKeylessAllowedEndpoint,
  redactSecrets,
} from '../thought-translator/translator-service.mjs';

export const PROMPT_ENHANCER_ACTIONS = new Set([
  'get-config',
  'save-config',
  'fetch-models',
  'test-connection',
  'enhance',
  'cancel',
]);

export const DEFAULT_PROMPT_ENHANCER_CONFIG = Object.freeze({
  version: 1,
  profileId: '',
  model: '',
});

const MAX_PROMPT_CHARS = 10000;
const MAX_CONTEXT_TURNS = 4;
const MAX_CONTEXT_TURN_CHARS = 1500;
const MAX_CONTEXT_TOTAL_CHARS = 4800;
const MAX_RESPONSE_BYTES = 256 * 1024;

const TASK_RULES = {
  bugFix: '现象、复现步骤、环境与排查范围、根因证据、修复方案、回归测试。根因未知时要求先调查，不得预设根因。',
  development: '目标、现有架构与技术栈、功能范围、约束、验收标准与必要测试。未知的项目事实要标为待确认。',
  deployment: '目标环境、依赖、部署前检查、执行步骤、配置与密钥边界、健康验收、失败回滚。不得虚构主机或凭据。',
  dataAnalysis: '分析问题、数据来源、指标定义、清洗与分析方法、验证方式、结果格式。未知数据源或指标使用明确占位项。',
  research: '研究问题、范围与时间边界、优先信息来源、证据标准、交叉验证方法、结论与不确定性。不得编造引用或事实。',
  general: '按任务需要组织目标、背景、执行步骤、约束、缺失信息占位项和可核验的完成标准；避免无关章节。',
};

export function classifyEnhancementTask(text = '') {
  const s = String(text || '').toLowerCase();
  if (/\b(bug|fix|debug|regression|exception|crash|error|stack trace)\b|故障|报错|异常|回归|修复|排查|复现/.test(s)) return 'bugFix';
  if (/\b(deploy|deployment|release|rollout|production|rollback)\b|部署|发布|上线|回滚|生产环境/.test(s)) return 'deployment';
  if (/\b(data analysis|analy[sz]e|metrics|dataset|statistics|sql query)\b|数据分析|指标|数据集|统计分析|数据来源/.test(s)) return 'dataAnalysis';
  if (/\b(research|investigate|survey|compare sources|literature review)\b|研究|调查|调研|文献|证据来源/.test(s)) return 'research';
  if (/\b(code|implement|refactor|software|feature|architecture|api|unit test)\b|开发|实现|重构|软件|功能|架构|接口|单元测试/.test(s)) return 'development';
  return 'general';
}

export function buildEnhancementSystemPrompt(taskType = 'general') {
  const structure = TASK_RULES[taskType] || TASK_RULES.general;
  return [
    'You turn a user\'s short request into a precise, ready-to-run instruction for an AI coding or general-purpose agent.',
    'Preserve the user\'s goal, constraints, requested scope, names, and important details. Do not change the requested outcome or add unsupported facts, files, tools, decisions, or claims.',
    'Use conversation context only to resolve references and relevant project details. Treat it as context, not permission to broaden the task.',
    'When an important detail is missing, keep the instruction actionable and add a concise explicit placeholder such as [待补充：目标运行环境] instead of guessing. Do not add placeholders for details that are not needed.',
    'Adapt the structure to the task. For this task type, consider: ' + structure,
    'Write in the same language as the original request. Return only the enhanced instruction, with clear headings or checklists when useful. Do not explain your rewrite.',
  ].join('\n');
}

export function sanitizeEnhancerTurns(rawTurns = []) {
  if (!Array.isArray(rawTurns)) return [];
  const collected = [];
  let total = 0;
  for (let i = rawTurns.length - 1; i >= 0 && collected.length < MAX_CONTEXT_TURNS; i--) {
    const turn = rawTurns[i];
    if (!turn || !['user', 'assistant'].includes(turn.role)) continue;
    let text = typeof turn.text === 'string' ? turn.text.trim() : '';
    if (!text) continue;
    text = text.slice(-MAX_CONTEXT_TURN_CHARS);
    const remaining = MAX_CONTEXT_TOTAL_CHARS - total;
    if (remaining <= 0) break;
    if (text.length > remaining) text = text.slice(-remaining);
    total += text.length;
    collected.push({ role: turn.role, text });
  }
  return collected.reverse();
}

export function sanitizePromptEnhancerConfig(raw = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    version: 1,
    profileId: typeof src.profileId === 'string' ? src.profileId.trim().slice(0, 80) : '',
    model: typeof src.model === 'string' ? src.model.trim().slice(0, 140) : '',
  };
}

function assertRegularOrMissing(filePath, label) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || (label === 'config file' && !stat.isFile()) || (label === 'config directory' && !stat.isDirectory())) {
      throw new Error(`Refusing unsafe ${label}`);
    }
    return stat;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function atomicWriteJsonSync(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  assertRegularOrMissing(dir, 'config directory');
  assertRegularOrMissing(filePath, 'config file');
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, filePath);
    try { fs.chmodSync(filePath, 0o600); } catch {}
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function redactWithKeys(text, keys = []) {
  let output = redactSecrets(text);
  for (const key of keys) output = redactSecrets(output, key);
  return output;
}

function extractAssistantText(body) {
  const content = body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text ?? '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : String(part?.text || '')).join('');
  }
  return '';
}

export function stripPromptAsterisks(text = '') {
  const protectedParts = [];
  let output = String(text ?? '')
    // Keep glob patterns such as src/**/*.ts intact.
    .replace(/\*{1,2}\/[^\s]+/g, (match) => {
      protectedParts.push(match);
      return `\u0000${protectedParts.length - 1}\u0000`;
    })
    // Keep inline and fenced code intact.
    .replace(/```[\s\S]*?```|`[^`\n]*`/g, (match) => {
      protectedParts.push(match);
      return `\u0000${protectedParts.length - 1}\u0000`;
    });
  output = output
    .replace(/(^|[^\w*])\*\*(\S(?:[^*\n]*?\S)?)\*\*(?=$|[^\w*])/g, '$1$2')
    .replace(/(^|[^\w*])\*(\S(?:[^*\n]*?\S)?)\*(?=$|[^\w*])/g, '$1$2');
  return output.replace(/\u0000(\d+)\u0000/g, (_, index) => protectedParts[Number(index)] || '');
}

export class PromptEnhancerService {
  constructor(options = {}) {
    const configDir = options.configDir || path.join(os.homedir(), '.gemini', 'config');
    this.configFile = options.configFile || path.join(configDir, 'obsidian-prism-prompt-enhancer.json');
    this._getTranslatorService = typeof options.getTranslatorService === 'function' ? options.getTranslatorService : null;
    this._getEnabled = typeof options.getEnabled === 'function' ? options.getEnabled : null;
    this._translatorService = options.translatorService || null;
    this.requestTimeoutMs = Math.max(100, Number(options.requestTimeoutMs) || 25000);
    this._config = null;
    this._inflight = new Map();
  }

  loadConfig() {
    if (this._config) return { ...this._config };
    try {
      assertRegularOrMissing(path.dirname(this.configFile), 'config directory');
      const stat = assertRegularOrMissing(this.configFile, 'config file');
      if (stat) this._config = sanitizePromptEnhancerConfig(JSON.parse(fs.readFileSync(this.configFile, 'utf8')));
    } catch {
      this._config = null;
    }
    if (!this._config) this._config = sanitizePromptEnhancerConfig(DEFAULT_PROMPT_ENHANCER_CONFIG);
    return { ...this._config };
  }

  saveConfig(patch = {}) {
    const current = this.loadConfig();
    const next = sanitizePromptEnhancerConfig({ ...current, ...patch });
    try {
      atomicWriteJsonSync(this.configFile, next);
      this._config = next;
      return { ok: true, config: { ...next } };
    } catch (error) {
      return { ok: false, error: redactSecrets(error?.message || 'Could not save Prompt Enhancer settings') };
    }
  }

  async _getTranslator() {
    if (this._translatorService) return this._translatorService;
    if (!this._getTranslatorService) return null;
    try {
      this._translatorService = await this._getTranslatorService();
      return this._translatorService;
    } catch {
      return null;
    }
  }

  async getPublicState() {
    const config = this.loadConfig();
    if (this._getEnabled) {
      try { config.enabled = Boolean(this._getEnabled()); } catch { config.enabled = false; }
    }
    const translator = await this._getTranslator();
    let store = {};
    let publicConfig = {};
    try {
      store = translator?.loadStore?.() || {};
      publicConfig = translator?.getSanitizedConfig?.() || {};
    } catch {}
    const profiles = (Array.isArray(publicConfig.profiles) ? publicConfig.profiles : []).map((profile) => ({
      id: String(profile?.id || '').slice(0, 80),
      name: String(profile?.name || profile?.id || 'Profile').slice(0, 48),
      baseUrl: String(profile?.baseUrl || '').slice(0, 240),
      model: String(profile?.model || '').slice(0, 140),
      hasApiKey: Boolean(profile?.hasApiKey),
      keylessAllowed: Boolean(profile?.keylessAllowed),
    }));
    const profileId = profiles.some((profile) => profile.id === config.profileId)
      ? config.profileId
      : profiles.some((profile) => profile.id === store.activeProfileId)
        ? String(store.activeProfileId)
        : profiles[0]?.id || '';
    return {
      ok: true,
      config: { ...config, profileId },
      profiles,
      backend: {
        ready: Boolean(translator && profiles.length),
        profileId,
        model: config.model || profiles.find((profile) => profile.id === profileId)?.model || '',
      },
    };
  }

  async _resolveBackend(payload = {}) {
    const translator = await this._getTranslator();
    if (!translator || typeof translator._resolveEffectiveCredentials !== 'function') {
      return { ok: false, error: 'provider_profiles_unavailable' };
    }
    const store = translator.loadStore?.() || {};
    const config = this.loadConfig();
    const requestedProfileId = String(payload.profileId || config.profileId || store.activeProfileId || '').trim();
    const profile = (Array.isArray(store.profiles) ? store.profiles : []).find((item) => item?.id === requestedProfileId)
      || (Array.isArray(store.profiles) ? store.profiles[0] : null);
    if (!profile) return { ok: false, error: 'provider_profile_not_found' };
    const model = String(payload.model || config.model || profile.model || '').trim().slice(0, 140);
    if (!model) return { ok: false, error: 'model_id_required' };
    let credentials;
    try {
      credentials = translator._resolveEffectiveCredentials({ profileId: profile.id, model });
    } catch {
      return { ok: false, error: 'provider_credentials_unavailable' };
    }
    if (credentials.baseUrlError || !credentials.baseUrl) {
      return { ok: false, error: redactSecrets(credentials.baseUrlError || 'invalid_base_url') };
    }
    const keys = (Array.isArray(store.profiles) ? store.profiles : [])
      .map((item) => String(item?.apiKey || '').trim())
      .filter(Boolean);
    if (!credentials.apiKey && !isKeylessAllowedEndpoint(credentials.baseUrl)) {
      return { ok: false, error: 'api_key_required' };
    }
    return {
      ok: true,
      translator,
      profileId: profile.id,
      profileName: String(profile.name || profile.id || ''),
      model,
      baseUrl: credentials.baseUrl,
      apiKey: credentials.apiKey || '',
      keys,
    };
  }

  async fetchModels(payload = {}) {
    const translator = await this._getTranslator();
    if (!translator || typeof translator.fetchModels !== 'function') return { ok: false, error: 'provider_profiles_unavailable' };
    const profileId = String(payload.profileId || this.loadConfig().profileId || '').trim();
    const result = await translator.fetchModels({ profileId });
    if (!result?.ok || !Array.isArray(result.models)) {
      const backend = await this._resolveBackend({ profileId, model: payload.model });
      return { ...result, error: redactWithKeys(result?.error || 'model_list_failed', backend.keys || []) };
    }
    const models = Array.from(new Set(result.models.map((id) => String(id || '').trim().slice(0, 140)).filter(Boolean))).slice(0, 1000);
    return { ok: true, models, count: models.length, latencyMs: Number(result.latencyMs) || 0 };
  }

  async testConnection(payload = {}) {
    const backend = await this._resolveBackend(payload);
    if (!backend.ok) return backend;
    try {
      const result = await backend.translator.testConnection({ profileId: backend.profileId, model: backend.model });
      return {
        ...result,
        error: result?.error ? redactWithKeys(result.error, backend.keys) : undefined,
        model: backend.model,
        profileName: backend.profileName,
      };
    } catch (error) {
      return { ok: false, model: backend.model, error: redactWithKeys(error?.message || 'connection_test_failed', backend.keys) };
    }
  }

  cancelRequest(requestId = '') {
    const id = String(requestId || '').trim();
    const controller = this._inflight.get(id);
    if (!controller) return { ok: true, cancelled: false };
    this._inflight.delete(id);
    try { controller.abort(new Error('Request cancelled by user')); } catch {}
    return { ok: true, cancelled: true };
  }

  async enhance(payload = {}) {
    const config = this.loadConfig();
    let enabled = config.enabled;
    if (this._getEnabled) {
      try { enabled = Boolean(this._getEnabled()); } catch { enabled = false; }
    }
    if (!enabled) return { ok: false, reason: 'disabled', error: 'prompt_enhancer_disabled' };
    const original = typeof payload.original === 'string' ? payload.original.trim() : '';
    if (!original) return { ok: false, reason: 'empty-input', error: 'prompt_required' };
    if (original.length > MAX_PROMPT_CHARS) return { ok: false, reason: 'input-too-long', error: 'prompt_too_long' };

    const backend = await this._resolveBackend(payload);
    if (!backend.ok) return backend;
    const requestId = String(payload.requestId || `enh_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`).slice(0, 100);
    this.cancelRequest(requestId);
    const controller = new AbortController();
    this._inflight.set(requestId, controller);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      try { controller.abort(new Error('Prompt enhancement timed out')); } catch {}
    }, this.requestTimeoutMs);
    timeout.unref?.();

    const redact = (text) => redactWithKeys(text, backend.keys);
    const safeOriginal = redact(original);
    const turns = sanitizeEnhancerTurns(payload.context).map((turn) => ({ ...turn, text: redact(turn.text) }));
    const taskType = classifyEnhancementTask(safeOriginal);
    const body = {
      model: backend.model,
      stream: false,
      temperature: 0.25,
      max_tokens: 2400,
      messages: [
        { role: 'system', content: buildEnhancementSystemPrompt(taskType) },
        {
          role: 'user',
          content: JSON.stringify({ taskType, originalRequest: safeOriginal, recentConversation: turns }),
        },
      ],
    };
    const noThinking = buildNoThinkingParams(backend.model, backend.baseUrl);
    if (noThinking) Object.assign(body, noThinking);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (backend.apiKey) headers.Authorization = `Bearer ${backend.apiKey}`;

    try {
      const response = await backend.translator._request(`${backend.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        redirect: 'error',
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseText = typeof backend.translator._readResponseTextBounded === 'function'
        ? await backend.translator._readResponseTextBounded(response, MAX_RESPONSE_BYTES)
        : await response.text();
      if (!response.ok) {
        const snippet = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);
        return { ok: false, reason: 'upstream-error', error: redact(`HTTP ${response.status}: ${snippet.slice(0, 220)}`) };
      }
      const parsed = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
      const enhanced = stripPromptAsterisks(extractAssistantText(parsed)).trim();
      if (!enhanced) return { ok: false, reason: 'empty-response', error: 'model_returned_empty_prompt' };
      return {
        ok: true,
        enhanced: enhanced.slice(0, 16000),
        taskType,
        model: backend.model,
        profileName: backend.profileName,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        return timedOut
          ? { ok: false, reason: 'timeout', error: 'prompt_enhancement_timed_out' }
          : { ok: false, cancelled: true, reason: 'cancelled' };
      }
      return { ok: false, reason: 'upstream-error', error: redact(error?.message || 'prompt_enhancement_failed').slice(0, 220) };
    } finally {
      clearTimeout(timeout);
      if (this._inflight.get(requestId) === controller) this._inflight.delete(requestId);
    }
  }

  async handleAction(action, payload = {}) {
    if (!PROMPT_ENHANCER_ACTIONS.has(action)) return { ok: false, error: 'unsupported_prompt_enhancer_action' };
    if (action === 'get-config') return this.getPublicState();
    if (action === 'save-config') {
      const patch = {};
      if (!this._getEnabled && payload.enabled !== undefined) patch.enabled = Boolean(payload.enabled);
      if (typeof payload.profileId === 'string') patch.profileId = payload.profileId;
      if (typeof payload.model === 'string') patch.model = payload.model;
      const saved = this.saveConfig(patch);
      return saved.ok ? this.getPublicState() : saved;
    }
    if (action === 'fetch-models') return this.fetchModels(payload);
    if (action === 'test-connection') return this.testConnection(payload);
    if (action === 'enhance') return this.enhance(payload);
    if (action === 'cancel') return this.cancelRequest(payload.requestId);
    return { ok: false, error: 'unhandled_prompt_enhancer_action' };
  }

  dispose() {
    this.cancelAllRequests();
  }

  cancelAllRequests() {
    for (const id of this._inflight.keys()) this.cancelRequest(id);
  }
}

export function createPromptEnhancerService(options = {}) {
  return new PromptEnhancerService(options);
}

export default createPromptEnhancerService;
