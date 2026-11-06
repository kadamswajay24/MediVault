// Keep local-provider tests isolated from any configured cloud credentials.
process.env.AI_PROVIDER = 'ollama';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LocalAiSummaryError,
  searchMedicineCatalogLocally,
  validateCatalogSearchMatches,
} from './src/services/localAiSummaryService.js';

const candidates = [
  { id: 'Paracetamol', name: 'Paracetamol', searchText: 'Paracetamol | analgesic | fever' },
  { id: 'Cetirizine', name: 'Cetirizine', searchText: 'Cetirizine | antihistamine | allergy' },
];

test('AI catalog results must be IDs from the supplied catalog', () => {
  assert.deepEqual(validateCatalogSearchMatches(['Cetirizine'], ['Cetirizine', 'Paracetamol']), ['Cetirizine']);
  assert.throws(
    () => validateCatalogSearchMatches(['Invented drug'], ['Cetirizine', 'Paracetamol']),
    (error) => error instanceof LocalAiSummaryError && error.statusCode === 502
  );
});

test('AI catalog results reject duplicates and oversized match lists', () => {
  assert.throws(() => validateCatalogSearchMatches(['Paracetamol', 'Paracetamol'], ['Paracetamol']));
  assert.throws(() => validateCatalogSearchMatches(Array(13).fill('Paracetamol'), ['Paracetamol']));
});

test('catalog search validates query and candidate payload before requesting local AI', async () => {
  await assert.rejects(
    searchMedicineCatalogLocally('x', candidates),
    (error) => error instanceof LocalAiSummaryError && error.statusCode === 400
  );
  await assert.rejects(
    searchMedicineCatalogLocally('fever', []),
    (error) => error instanceof LocalAiSummaryError && error.statusCode === 400
  );
  await assert.rejects(
    searchMedicineCatalogLocally('fever', [candidates[0], candidates[0]]),
    (error) => error instanceof LocalAiSummaryError && error.statusCode === 400
  );
});
