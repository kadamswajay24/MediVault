import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiConfig, requestStructuredAi } from './src/services/aiProviderService.js';
import { generateLocalSummary, searchMedicineCatalogLocally, generateInsurancePlanAssistantResponse } from './src/services/localAiSummaryService.js';
import { withAiUsage } from './src/services/aiUsageService.js';
import AuthRateLimit from './src/models/AuthRateLimit.js';

const setup = (t) => {
  const names = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_PROVIDER'];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  process.env.GEMINI_API_KEY = 'synthetic-key-not-a-real-credential';
  t.after(() => {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  });
};
const summary = { summary: 'Synthetic result.', keyFindings: [], medicationMentions: [], datesAndValues: [], questionsForDoctor: [] };
const response = (value) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const request = { system: 'test', prompt: 'Synthetic text', format: { type: 'object' }, options: { temperature: 0, num_predict: 100 } };

test('saved key selects Gemini; explicit Ollama and model overrides remain available without exposing secrets', (t) => {
  setup(t);
  assert.deepEqual(getAiConfig(), { provider: 'gemini', model: 'gemini-2.5-flash-lite', externalProcessing: true });
  process.env.GEMINI_MODEL = 'gemini-test';
  assert.equal(getAiConfig().model, 'gemini-test');
  process.env.AI_PROVIDER = 'ollama';
  assert.equal(getAiConfig().externalProcessing, false);
  delete process.env.AI_PROVIDER; delete process.env.GEMINI_API_KEY;
  assert.equal(getAiConfig().provider, 'ollama');
});

test('Gemini summary sends structured text to the fixed endpoint with key only in the header', async (t) => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], process.env.GEMINI_API_KEY);
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseJsonSchema.required.includes('summary'));
    assert.match(body.systemInstruction.parts[0].text, /treating clinician/);
    assert.match(body.contents[0].parts[0].text, /Synthetic report/);
    assert.ok(!options.body.includes(process.env.GEMINI_API_KEY));
    return response(summary);
  });
  assert.deepEqual((await generateLocalSummary('Synthetic report', 'en', 'clinician')).summary, summary);
});

test('Gemini catalog strips extra fields and still rejects invented medicines', async (t) => {
  setup(t);
  let value = { matches: ['known'] };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(!options.body.includes('private-extra-field'));
    return response(value);
  });
  const candidates = [{ id: 'known', name: 'Reference', searchText: 'reference', unrelated: 'private-extra-field' }];
  assert.deepEqual((await searchMedicineCatalogLocally('reference', candidates)).matches, ['known']);
  value = { matches: ['invented'] };
  await assert.rejects(searchMedicineCatalogLocally('reference', candidates), /outside the supplied catalog/);
});

test('Gemini insurer assistant validates plan fields and preserves missing amounts', async (t) => {
  setup(t);
  let value = { reply: 'What cover amount?', plan: { name: null, description: null, coverageAmount: null, monthlyPremium: null, highlights: [] } };
  t.mock.method(globalThis, 'fetch', async () => response(value));
  const messages = [{ role: 'user', content: 'Help draft an example plan.' }];
  assert.equal((await generateInsurancePlanAssistantResponse(messages)).plan.monthlyPremium, null);
  value.plan.coverageAmount = -1;
  await assert.rejects(generateInsurancePlanAssistantResponse(messages), /invalid plan draft/);
});

test('quota and configuration errors do not leak upstream bodies or retry another model', async (t) => {
  setup(t);
  for (const status of [400, 401, 403, 404, 429, 500]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response('PRIVATE PROVIDER ERROR BODY', { status });
    });
    await assert.rejects(requestStructuredAi(request), (error) => {
      assert.equal(error.statusCode, status === 429 ? 429 : 503);
      assert.ok(!error.message.includes('PRIVATE'));
      return true;
    });
    assert.equal(calls, 1);
    mock.mock.restore();
  }
});

test('blocked, truncated, malformed, or invalid summaries are rejected', async (t) => {
  setup(t);
  const fixtures = [
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] },
  ];
  for (const fixture of fixtures) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture));
    await assert.rejects(generateLocalSummary('Synthetic report'), (error) => error.statusCode === 502);
    mock.mock.restore();
  }
});

test('Gemini errors identify the failure without disclosing upstream secrets or patient content', async (t) => {
  setup(t);
  const cases = [
    [400, 'API_KEY_INVALID', 'INVALID_ARGUMENT', 'gemini_key_invalid'],
    [403, 'API_KEY_HTTP_REFERRER_BLOCKED', 'PERMISSION_DENIED', 'gemini_key_restricted'],
    [403, 'SERVICE_DISABLED', 'PERMISSION_DENIED', 'gemini_api_disabled'],
    [404, '', 'NOT_FOUND', 'gemini_model_unavailable'],
    [400, '', 'FAILED_PRECONDITION', 'gemini_project_prerequisite'],
    [403, '', 'PERMISSION_DENIED', 'gemini_access_denied'],
    [400, '', 'INVALID_ARGUMENT', 'gemini_request_invalid'],
  ];
  for (const [httpStatus, reason, status, code] of cases) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({
      error: { status, message: 'PRIVATE patient text and secret key', details: [{ reason, metadata: { key: 'PRIVATE' } }] },
    }, { status: httpStatus }));
    await assert.rejects(requestStructuredAi(request), (error) => {
      assert.equal(error.code, code);
      assert.ok(error.message.includes(`HTTP ${httpStatus}`));
      assert.ok(!error.message.includes('PRIVATE'));
      return true;
    });
    mock.mock.restore();
  }
});

test('missing key, invalid model and oversized input fail before making a request', async (t) => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Unexpected outbound request'));
  await assert.rejects(generateLocalSummary('x'.repeat(12001)), /12000/);
  process.env.GEMINI_MODEL = '../another-service';
  await assert.rejects(requestStructuredAi(request), /model configuration/);
  delete process.env.GEMINI_API_KEY;
  process.env.AI_PROVIDER = 'gemini';
  await assert.rejects(requestStructuredAi(request), /not configured/);
});

test('AI requests abort on timeout without exposing fetch errors', async (t) => {
  setup(t);
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('secret network detail')), { once: true });
  }));
  await assert.rejects(requestStructuredAi({ ...request, timeoutMs: 5 }), (error) => error.statusCode === 504 && !error.message.includes('secret'));
});

test('usage tracking failure prevents provider execution', async (t) => {
  t.mock.method(AuthRateLimit, 'findOneAndUpdate', async () => { throw new Error('database offline'); });
  await assert.rejects(withAiUsage('test-user', () => assert.fail('Provider must not run')), (error) => error.statusCode === 503);
});
