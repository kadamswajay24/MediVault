import test from 'node:test';
import assert from 'node:assert/strict';
import { indiaDateInput, indiaTimeInput, indiaDateTimeInput, indiaInputToISO, formatIndianNumber } from '../src/utils/indiaFormat.ts';
test('India date defaults roll over at IST midnight rather than UTC midnight', () => {
  assert.equal(indiaDateInput('2026-11-05T18:29:00Z'), '2026-11-05');
  assert.equal(indiaDateInput('2026-11-05T18:30:00Z'), '2026-11-06');
  assert.equal(indiaTimeInput('2026-11-05T18:30:00Z'), '00:00');
});
test('access-expiry input preserves the exact instant across IST conversions', () => {
  const instant = '2026-12-31T20:45:00.000Z';
  assert.equal(indiaDateTimeInput(instant), '2027-01-01T02:15');
  assert.equal(indiaInputToISO(indiaDateTimeInput(instant)), instant);
});
test('large numbers use lakh and crore grouping', () => {
  assert.equal(formatIndianNumber(12345678), '1,23,45,678');
});
