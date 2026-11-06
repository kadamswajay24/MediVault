import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  findCatalogTextMatches,
  getCatalogSearchMedicines,
  getSpecialtyMedicineOptions,
  parseSpecialtyMedicineCatalog,
} from '../src/constants/specialtyMedicineCatalog.ts';

const source = readFileSync(
  new URL('../data/medivault_specialty_medicine_catalog.csv', import.meta.url),
  'utf8'
);
const catalog = parseSpecialtyMedicineCatalog(source);
const getSpecialtyMedications = (specialization) =>
  getSpecialtyMedicineOptions(specialization, catalog);
const fixtureHeaders = [
  'professional_dropdown_label',
  'dropdown_profession_options',
  'mapping_scope',
  'medicine_generic_name',
  'therapeutic_class',
  'dosage_form_search_hints',
  'clinical_search_tags',
  'search_synonyms',
  'clinical_review_flag',
  'antimicrobial_stewardship_check',
  'controlled_medicine_check',
  'search_suggestion_allowed',
  'auto_prescribe_allowed',
  'prescriber_validation_required',
  'mapping_status',
];
const catalogFixture = (overrides = {}) => {
  const values = {
    professional_dropdown_label: 'Cardiology',
    dropdown_profession_options: 'Cardiology',
    mapping_scope: 'SPECIALTY_SEARCH_ONLY',
    medicine_generic_name: 'Paracetamol',
    therapeutic_class: 'Analgesic',
    dosage_form_search_hints: 'tablet',
    clinical_search_tags: 'pain|fever',
    search_synonyms: 'acetaminophen',
    clinical_review_flag: 'ROUTINE_CLINICAL_REVIEW',
    antimicrobial_stewardship_check: 'FALSE',
    controlled_medicine_check: 'NOT_TYPICALLY_CONTROLLED',
    search_suggestion_allowed: 'TRUE',
    auto_prescribe_allowed: 'FALSE',
    prescriber_validation_required: 'TRUE',
    mapping_status: 'ACTIVE_SEARCH_SEED',
    ...overrides,
  };
  return [
    fixtureHeaders.join(','),
    fixtureHeaders.map((header) => {
      const value = values[header];
      return value.includes(',') ? `"${value}"` : value;
    }).join(','),
  ].join('\n');
};

test('doctor title aliases resolve to the same specialty list', () => {
  assert.equal(getSpecialtyMedications('  CARDIOLOGIST  ').specialty, 'Cardiologist');
  assert.equal(getSpecialtyMedications('Pediatrician').specialty, 'Pediatrician');
  assert.equal(getSpecialtyMedications('Cardiology').specialty, 'Cardiology');
  assert.deepEqual(getSpecialtyMedications('Paediatrics'), getSpecialtyMedications('Pediatrics'));
  assert.deepEqual(getSpecialtyMedications(' General   Medicine '), getSpecialtyMedications('General Medicine'));
});

test('all configured dropdown roles receive at least ten references and shared entries', () => {
  assert.ok(Object.values(catalog).every((medicines) => medicines.length >= 10));
  const cardio = getSpecialtyMedications('Cardiology').medicines;
  const skin = getSpecialtyMedications('Dermatology').medicines;
  assert.ok(cardio.some((medicine) => medicine.name === 'Amlodipine'));
  assert.ok(skin.some((medicine) => medicine.name === 'Clotrimazole'));
  assert.ok(skin.some((medicine) => medicine.name === 'Amlodipine' && medicine.isSharedGeneral));
  assert.ok(cardio.some((medicine) => !medicine.isSharedGeneral));
  assert.ok(skin.some((medicine) => !medicine.isSharedGeneral));
});

test('shared general entries are available to roles without specialty-specific mappings', () => {
  for (const value of ['Physiotherapy', 'Nursing']) {
    const result = getSpecialtyMedications(value);
    assert.equal(result.hasSuggestions, true);
    assert.equal(result.listLabel, 'Shared general search references');
    assert.ok(result.medicines.length >= 10);
    assert.ok(result.medicines.every((medicine) => medicine.isSharedGeneral));
  }
  assert.deepEqual(getSpecialtyMedications('New specialty').medicines, []);
});

test('CSV search names use generic names without inferred strengths', () => {
  const options = getSpecialtyMedications('Cardiology').medicines;
  assert.equal(options.some((medicine) => /\b\d+\s*mg\b/i.test(medicine.name)), false);
  assert.ok(options.some((medicine) => medicine.name === 'Amlodipine'));
});


test('configured specialties keep their dedicated list and label', () => {
  const result = getSpecialtyMedications('Cardiologist');
  assert.equal(result.hasSuggestions, true);
  assert.equal(result.listLabel, 'Cardiologist and shared general search references');
  const physio = getSpecialtyMedications('Physiotherapy');
  assert.equal(physio.specialty, 'Physiotherapy');
  assert.equal(physio.listLabel, 'Shared general search references');
});

test('CSV search suggestions include metadata and explicit risk flags', () => {
  const cardio = getSpecialtyMedications('Cardiology');
  assert.ok(cardio.medicines.some((medicine) => medicine.name === 'Amlodipine'));
  assert.ok(cardio.medicines.some((medicine) => medicine.riskFlag === 'high_alert_specialist_only'));
  assert.ok(
    getSpecialtyMedications('General Medicine').medicines.some(
      (medicine) => medicine.riskFlag === 'antimicrobial_stewardship'
    )
  );
});

test('cross-catalog search indexes only existing CSV entries and their search metadata', () => {
  const searchMedicines = getCatalogSearchMedicines(catalog);
  assert.equal(new Set(searchMedicines.map((medicine) => medicine.id)).size, searchMedicines.length);
  assert.ok(searchMedicines.some((medicine) => medicine.name === 'Paracetamol'));
  assert.ok(findCatalogTextMatches(searchMedicines, 'fever').includes('Paracetamol'));
  assert.ok(findCatalogTextMatches(searchMedicines, 'acetaminophen').includes('Paracetamol'));
  assert.ok(findCatalogTextMatches(searchMedicines, 'high alert').length > 0);
  assert.deepEqual(findCatalogTextMatches(searchMedicines, 'in'), []);
  assert.deepEqual(findCatalogTextMatches(searchMedicines, 'not in catalog'), []);
});

test('CSV parser rejects missing validation safeguards', () => {
  const unsafe = catalogFixture({ auto_prescribe_allowed: 'TRUE' });
  assert.throws(() => parseSpecialtyMedicineCatalog(unsafe), /unsafe suggestion mode/);
});

test('CSV parser preserves quoted commas and validates its header', () => {
  const quoted = catalogFixture({ therapeutic_class: 'Analgesic, antipyretic' });
  const parsed = parseSpecialtyMedicineCatalog(quoted);
  assert.equal(
    parsed.Cardiology.find((medicine) => medicine.name === 'Paracetamol').therapeuticClass,
    'Analgesic, antipyretic'
  );
  assert.throws(() => parseSpecialtyMedicineCatalog('specialization,medicine_generic_name\n'), /missing columns/);
});
