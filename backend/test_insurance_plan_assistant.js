// Keep local-provider tests isolated from any configured cloud credentials.
process.env.AI_PROVIDER = 'ollama';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  generateInsurancePlanAssistantResponse,
  LocalAiSummaryError,
} from './src/services/localAiSummaryService.js';

test('validates insurer plan assistant input and local model output', async (context) => {
  const validOutput = {
    reply: 'What example coverage amount would you like?',
    plan: {
      name: 'Family Care',
        description: null,
        coverageAmount: 500000,
      monthlyPremium: null,
        highlights: ['Family coverage for 6 members'],
    },
  };
  let responseBody = validOutput;
  let requestBody;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ response: JSON.stringify(responseBody) }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );

  const previousUrl = process.env.OLLAMA_BASE_URL;
  const previousModel = process.env.OLLAMA_MODEL;
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.OLLAMA_MODEL = 'qwen2.5:3b';

  try {
    await assert.rejects(
      generateInsurancePlanAssistantResponse([{ role: 'user', content: '   ' }]),
      (error) => error instanceof LocalAiSummaryError && error.statusCode === 400
    );

    const messages = [
      { role: 'user', content: 'Create a family plan with ₹1800 per month and cover up to 6 members.' },
    ];
    const result = await generateInsurancePlanAssistantResponse(messages);
    assert.deepEqual(result, {
      reply: validOutput.reply,
      plan: {
        ...validOutput.plan,
        description:
          'Illustrative draft based on the provided details: Example cover: ₹5,00,000; Family coverage for 6 members.',
        monthlyPremium: 1800,
      },
      model: 'qwen2.5:3b',
    });
    assert.equal(requestBody.model, 'qwen2.5:3b');
    assert.equal(requestBody.stream, false);
    assert.match(requestBody.system, /Never invent prices/);
    assert.match(requestBody.prompt, /Create a family plan/);

    responseBody = {
      ...validOutput,
      plan: { ...validOutput.plan, coverageAmount: -100 },
    };
    await assert.rejects(
      generateInsurancePlanAssistantResponse([
        { role: 'user', content: 'Create a family plan.' },
      ]),
      (error) => error instanceof LocalAiSummaryError && error.statusCode === 502
    );

    process.env.OLLAMA_BASE_URL = 'https://example.com';
    await assert.rejects(
      generateInsurancePlanAssistantResponse([
        { role: 'user', content: 'Create a family plan.' },
      ]),
      (error) => error instanceof LocalAiSummaryError && error.statusCode === 500
    );
  } finally {
    if (previousUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = previousUrl;
    if (previousModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = previousModel;
  }
});
