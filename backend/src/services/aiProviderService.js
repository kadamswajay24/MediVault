export class AiServiceError extends Error {
  constructor(message, statusCode = 500, code = '') {
    super(message);
    this.name = 'AiServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const getAiConfig = () => {
  const provider = process.env.AI_PROVIDER?.trim() || (process.env.GEMINI_API_KEY?.trim() ? 'gemini' : 'ollama');
  if (!['gemini', 'ollama'].includes(provider)) throw new AiServiceError('AI provider configuration is invalid.', 503);
  return {
    provider,
    model: provider === 'gemini'
      ? process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'
      : process.env.OLLAMA_MODEL?.trim() || 'qwen2.5:3b',
    externalProcessing: provider === 'gemini',
  };
};

const getOllamaUrl = () => {
  let url;
  try { url = new URL(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'); }
  catch { throw new AiServiceError('Ollama URL is invalid.', 500); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash) {
    throw new AiServiceError('Ollama must be configured on this server using a localhost URL.', 500);
  }
  return url.toString().replace(/\/+$/, '');
};

// Inspect upstream errors only to select fixed, safe messages. Never expose the
// raw body: Google errors can echo credentials, project IDs, or request content.
const geminiRequestError = (httpStatus, body, model) => {
  const details = Array.isArray(body?.error?.details) ? body.error.details : [];
  const reasons = new Set(details.map((detail) => detail?.reason));
  const message = typeof body?.error?.message === 'string' ? body.error.message : '';
  const fail = (text, code) => new AiServiceError(`${text} (Gemini HTTP ${httpStatus}.)`, 503, code);
  if (reasons.has('API_KEY_INVALID') || /API key not valid|API_KEY_INVALID|API key expired/i.test(message) || httpStatus === 401) {
    return fail('Google rejected the API key. Replace GEMINI_API_KEY in Vercel with the full key copied from AI Studio, then redeploy', 'gemini_key_invalid');
  }
  if (/reported as leaked|key.*(?:blocked|suspended)/i.test(message)) {
    return fail('Google has blocked this API key. Create a replacement in AI Studio, update the Vercel secret, and redeploy', 'gemini_key_blocked');
  }
  if (reasons.has('SERVICE_DISABLED')) {
    return fail('The Gemini API is disabled for the key’s Google project. Check the project’s API access in Google Cloud', 'gemini_api_disabled');
  }
  if (['API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED'].some((reason) => reasons.has(reason))) {
    return fail('The API key restrictions reject requests from this backend. Check its API and application restrictions for server-side Gemini use', 'gemini_key_restricted');
  }
  if (httpStatus === 404) {
    return fail(`Google could not find or serve model ${model} for this request. Set GEMINI_MODEL to an available model with free quota in AI Studio, then redeploy`, 'gemini_model_unavailable');
  }
  if (body?.error?.status === 'FAILED_PRECONDITION') {
    return fail('Google reports that a project prerequisite is unmet. Check free-tier and location eligibility in AI Studio; changing the PDF will not resolve this', 'gemini_project_prerequisite');
  }
  if (httpStatus === 403) {
    return fail('Google denied this project or key access to Gemini. Check API enablement, key restrictions, and project permissions in AI Studio and Google Cloud', 'gemini_access_denied');
  }
  return fail('Google rejected the request format or model configuration. The administrator needs to inspect the Gemini integration; this is not a PDF-reading error', 'gemini_request_invalid');
};

// Never log prompts, responses, credentials, or provider error bodies.
export const requestStructuredAi = async ({ system, prompt, format, options, timeoutMs = 45000 }) => {
  if (typeof prompt !== 'string' || prompt.length > 60000) throw new AiServiceError('AI input is too large. Use a shorter document or search.', 400);
  const { provider, model } = getAiConfig();
  const isGemini = provider === 'gemini';
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (isGemini && !apiKey) throw new AiServiceError('Gemini is not configured. Ask the administrator to check the API key.', 503);
  if (isGemini && !/^gemini-[a-zA-Z0-9._-]+$/.test(model)) throw new AiServiceError('Gemini model configuration is invalid.', 503);
  const url = isGemini
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    : `${getOllamaUrl()}/api/generate`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 45000));
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(isGemini ? { 'x-goog-api-key': apiKey } : {}) },
      body: JSON.stringify(isGemini ? {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: Math.min(options.num_predict * 2, 2400),
          responseMimeType: 'application/json', responseJsonSchema: format,
        },
      } : { model, stream: false, system, prompt, format, options }),
    });
    if (!response.ok) {
      if (isGemini && [400, 401, 403, 404].includes(response.status)) {
        const body = await response.json().catch(() => null);
        throw geminiRequestError(response.status, body, model);
      }
      await response.body?.cancel();
      if (response.status === 429) {
        throw Object.assign(new AiServiceError('AI quota is temporarily exhausted. Try again later; your records remain available.', 429, 'ai_quota'), { retryAfter: 60 });
      }
      throw new AiServiceError('The AI service is temporarily unavailable. Please try again later.', 503);
    }
    const result = await response.json();
    let text;
    if (isGemini) {
      const candidate = result.candidates?.[0];
      if (result.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') {
        throw new AiServiceError('The AI service could not complete this response. Review the original information or try a shorter request.', 502, 'ai_incomplete');
      }
      text = candidate.content?.parts?.filter((part) => typeof part.text === 'string' && !part.thought).map((part) => part.text).join('');
    } else text = result.response;
    if (typeof text !== 'string' || !text.trim() || text.length > 40000) throw new AiServiceError('The AI service returned an invalid response.', 502);
    let value;
    try { value = JSON.parse(text); }
    catch { throw new AiServiceError('The AI service returned unreadable JSON. Please try again.', 502); }
    return { value, model };
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (controller.signal.aborted) throw new AiServiceError('The AI request timed out. Please try again later.', 504);
    throw new AiServiceError('Could not reach the AI service. Please try again later.', 503);
  } finally { clearTimeout(timeout); }
};
