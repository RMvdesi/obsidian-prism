// Modified by Yaniuan on 2026-11-28: add the downstream Prompt Enhancer module.
import { sanitizeSecretText } from '../../sidecars/daemon/redact.mjs';
import {
  PROMPT_ENHANCER_MAX_PAYLOAD_BYTES,
  PROMPT_ENHANCER_ALLOWED_ACTIONS,
} from './constants.mjs';
import { serializeJsonForEval } from './fs-atomic.mjs';

/**
 * Prompt Enhancer binding handler. Trust and evaluation helpers are injected
 * by the dispatcher so this channel stays isolated without importing the
 * monolithic RPC module back into itself.
 */
export async function handlePromptEnhancerBinding(
  rpc,
  entry,
  payload,
  executionContextId,
  { isTrustedHostContext, resolveTrustedBroadcastContextId, sendFireAndForgetEval },
) {
  const initialCtx = typeof executionContextId === 'number' ? entry.contextFrames?.get(executionContextId) : undefined;
  const expectedDocGen = typeof entry.sidebarDocument === 'number' ? entry.sidebarDocument : null;
  const services = rpc.channelOrchestrator.services;
  const checkCtx = () => isTrustedHostContext(entry, executionContextId, expectedDocGen, {
    stopped: Boolean(services._promptEnhancerStopped),
    expectedContext: initialCtx,
  });
  if (!checkCtx()) return;
  if (
    typeof payload !== 'string' ||
    payload.length > PROMPT_ENHANCER_MAX_PAYLOAD_BYTES ||
    Buffer.byteLength(payload, 'utf8') > PROMPT_ENHANCER_MAX_PAYLOAD_BYTES
  ) return;

  let parsed;
  try { parsed = JSON.parse(payload); } catch { return; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
  const reqId = Number.isSafeInteger(parsed.id) && parsed.id >= 0 ? parsed.id : null;
  if (reqId === null) return;
  const action = typeof parsed.action === 'string' ? parsed.action.trim() : '';
  const actionPayload = parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
    ? parsed.payload
    : {};
  let result;
  let svc = null;
  const configEnabled = (() => {
    try { return rpc.getCdp()?.readConfig?.()?.promptEnhancer === 'on'; } catch { return false; }
  })();

  if (!PROMPT_ENHANCER_ALLOWED_ACTIONS.has(action)) {
    result = { ok: false, error: 'unsupported_prompt_enhancer_action' };
  } else if (!configEnabled) {
    result = { ok: false, reason: 'disabled', error: 'prompt_enhancer_disabled' };
  } else {
    try {
      svc = await rpc.channelOrchestrator.ensurePromptEnhancerService();
      result = !svc || typeof svc.handleAction !== 'function'
        ? { ok: false, error: 'prompt_enhancer_service_unavailable' }
        : await svc.handleAction(action, actionPayload);
    } catch (error) {
      result = { ok: false, error: sanitizeSecretText(error?.message || error) };
    }
  }

  if (checkCtx()) {
    const safeId = Number(reqId) | 0;
    const safeJson = serializeJsonForEval(result);
    const payloadExpr = safeJson.length > 4096 ? `JSON.parse(${serializeJsonForEval(safeJson)})` : safeJson;
    const resolveExpr = `(() => { const r = ${payloadExpr}; if (typeof window.__agPrismPromptEnhancerResolve === 'function') window.__agPrismPromptEnhancerResolve(${safeId}, r); else if (window.__agPrismPromptEnhancerBridge && typeof window.__agPrismPromptEnhancerBridge.resolve === 'function') window.__agPrismPromptEnhancerBridge.resolve(${safeId}, r); })()`;
    await sendFireAndForgetEval(entry.session, resolveExpr, executionContextId);
  }

  if (action === 'save-config' && result?.ok) {
    const syncConfig = result.config && typeof result.config === 'object' ? result.config : null;
    if (syncConfig) {
      const syncExpr = `try { window.__agPrismPromptEnhancer?.applyConfig?.(${serializeJsonForEval(syncConfig)}); } catch {}`;
      const tasks = [];
      if (checkCtx()) tasks.push(sendFireAndForgetEval(entry.session, syncExpr, executionContextId, 2000));
      for (const other of rpc.sessionRegistry.sessions.values()) {
        if (!other || other === entry || other.promptEnhancerSkipped) continue;
        const target = resolveTrustedBroadcastContextId(other);
        if (target.ok) tasks.push(sendFireAndForgetEval(other.session, syncExpr, target.contextId, 2000));
      }
      if (tasks.length) await Promise.allSettled(tasks);
    }
  }
  return result;
}
