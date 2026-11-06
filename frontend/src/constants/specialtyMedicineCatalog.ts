export type MedicineRiskFlag =
  | 'standard'
  | 'antimicrobial_stewardship'
  | 'high_alert_specialist_only'
  | 'controlled_specialist_only';

export interface SpecialtyMedicineReference {
  name: string;
  therapeuticClass: string;
  dosageForms: string[];
  searchKeywords: string[];
  clinicalReviewFlags: string[];
  isSharedGeneral: boolean;
  riskFlag: MedicineRiskFlag;
}

export interface CatalogSearchMedicine {
  id: string;
  name: string;
  searchText: string;
  therapeuticClass: string;
  dosageForms: string[];
  clinicalReviewFlags: string[];
  riskFlag: MedicineRiskFlag;
}

export type SpecialtyMedicineCatalog = Record<string, SpecialtyMedicineReference[]>;

const requiredColumns = [
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

const parseCsv = (source: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('The specialty medicine CSV has an unclosed quoted field.');
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
};

const splitSearchValues = (value: string) =>
  value.split('|').map((item) => item.trim()).filter(Boolean);

const getMedicineRiskFlag = (
  antimicrobialCheck: string,
  controlledCheck: string,
  clinicalReviewFlag: string
): MedicineRiskFlag => {
  if (controlledCheck !== 'NOT_TYPICALLY_CONTROLLED') return 'controlled_specialist_only';
  if (antimicrobialCheck === 'TRUE') return 'antimicrobial_stewardship';
  if (clinicalReviewFlag.startsWith('HIGH_ALERT')) return 'high_alert_specialist_only';
  return 'standard';
};

const mergeMedicineReference = (
  medicines: SpecialtyMedicineReference[],
  incoming: SpecialtyMedicineReference
) => {
  const existing = medicines.find((medicine) => medicine.name === incoming.name);
  if (!existing) {
    medicines.push(incoming);
    return;
  }

  existing.dosageForms = [...new Set([...existing.dosageForms, ...incoming.dosageForms])];
  existing.searchKeywords = [...new Set([...existing.searchKeywords, ...incoming.searchKeywords])];
  existing.clinicalReviewFlags = [
    ...new Set([...existing.clinicalReviewFlags, ...incoming.clinicalReviewFlags]),
  ];
  existing.isSharedGeneral ||= incoming.isSharedGeneral;
  if (riskPriority.indexOf(incoming.riskFlag) > riskPriority.indexOf(existing.riskFlag)) {
    existing.riskFlag = incoming.riskFlag;
  }
};

export function parseSpecialtyMedicineCatalog(source: string): SpecialtyMedicineCatalog {
  const [headerRow, ...dataRows] = parseCsv(source);
  if (!headerRow) throw new Error('The specialty medicine CSV is empty.');

  const headers = headerRow.map((header) => header.trim().replace(/^\uFEFF/, ''));
  const columnIndexes = new Map(headers.map((header, index) => [header, index]));
  const missingColumns = requiredColumns.filter((column) => !columnIndexes.has(column));
  if (missingColumns.length) {
    throw new Error(`The specialty medicine CSV is missing columns: ${missingColumns.join(', ')}.`);
  }

  const catalog: SpecialtyMedicineCatalog = {};
  const read = (cells: string[], column: string) =>
    cells[columnIndexes.get(column)!]?.trim() || '';

  dataRows.forEach((cells, rowIndex) => {
    const lineNumber = rowIndex + 2;
    if (cells.length !== headers.length) {
      throw new Error(`The specialty medicine CSV has an invalid number of columns on line ${lineNumber}.`);
    }
    const status = read(cells, 'mapping_status');
    if (status !== 'ACTIVE_SEARCH_SEED') return;

    const name = read(cells, 'medicine_generic_name');
    if (
      read(cells, 'search_suggestion_allowed') !== 'TRUE' ||
      read(cells, 'auto_prescribe_allowed') !== 'FALSE' ||
      read(cells, 'prescriber_validation_required') !== 'TRUE'
    ) {
      throw new Error(`The specialty medicine CSV has an unsafe suggestion mode on line ${lineNumber}.`);
    }

    const mappingScope = read(cells, 'mapping_scope');
    const isSharedGeneral = mappingScope === 'GENERAL_FOR_ALL_PROFESSIONS';
    const label = read(cells, 'professional_dropdown_label');
    const targetSpecialties = isSharedGeneral
      ? splitSearchValues(read(cells, 'dropdown_profession_options'))
      : mappingScope === 'SPECIALTY_SEARCH_ONLY' && label !== 'ALL PROFESSIONS'
        ? [label]
        : [];
    if (!name || !targetSpecialties.length) {
      throw new Error(`The specialty medicine CSV has an invalid specialty or medicine on line ${lineNumber}.`);
    }

    const clinicalReviewFlag = read(cells, 'clinical_review_flag');
    const reference: Omit<SpecialtyMedicineReference, 'isSharedGeneral'> = {
      name,
      therapeuticClass: read(cells, 'therapeutic_class'),
      dosageForms: splitSearchValues(read(cells, 'dosage_form_search_hints')),
      searchKeywords: [
        ...splitSearchValues(read(cells, 'clinical_search_tags')),
        ...splitSearchValues(read(cells, 'search_synonyms')),
      ],
      clinicalReviewFlags: clinicalReviewFlag ? [clinicalReviewFlag] : [],
      riskFlag: getMedicineRiskFlag(
        read(cells, 'antimicrobial_stewardship_check'),
        read(cells, 'controlled_medicine_check'),
        clinicalReviewFlag
      ),
    };

    targetSpecialties.forEach((specialty) => {
      const entries = catalog[specialty] ?? (catalog[specialty] = []);
      mergeMedicineReference(entries, { ...reference, isSharedGeneral });
    });
  });

  return catalog;
}

const aliases: Record<string, string> = {
  cardiologist: 'Cardiology',
  pediatrician: 'Pediatrics',
  paediatrics: 'Pediatrics',
  paediatrician: 'Pediatrics',
  orthopaedics: 'Orthopedics',
  'internal medicine': 'General Medicine',
  'general physician': 'General Medicine',
  'obstetrics and gynecology': 'Gynecology & Obstetrics',
  'obstetrics & gynaecology': 'Gynecology & Obstetrics',
};

export function getSpecialtyMedicineOptions(
  specialization: string | undefined,
  catalog: SpecialtyMedicineCatalog
) {
  const requested = specialization?.trim().replace(/\s+/g, ' ') || '';
  const normalized = requested.toLowerCase();
  const exactMatch = Object.keys(catalog).find(
    (name) => name.toLowerCase() === normalized
  );
  const matchedSpecialty = exactMatch || aliases[normalized];
  const medicines = matchedSpecialty ? catalog[matchedSpecialty] || [] : [];
  const hasSuggestions = medicines.length > 0;
  const hasSharedGeneral = medicines.some((medicine) => medicine.isSharedGeneral);
  const hasSpecialtySpecific = medicines.some((medicine) => !medicine.isSharedGeneral);

  return {
    specialty: matchedSpecialty || requested || 'Specialization not set',
    hasSuggestions,
    listLabel: !hasSuggestions
      ? 'No default medicine list'
      : hasSpecialtySpecific && hasSharedGeneral
        ? `${matchedSpecialty} and shared general search references`
        : hasSpecialtySpecific
          ? `${matchedSpecialty} search reference`
          : 'Shared general search references',
    medicines,
  };
}

const riskPriority: MedicineRiskFlag[] = [
  'standard',
  'antimicrobial_stewardship',
  'high_alert_specialist_only',
  'controlled_specialist_only',
];

export function getCatalogSearchMedicines(
  catalog: SpecialtyMedicineCatalog
): CatalogSearchMedicine[] {
  const medicines = new Map<string, CatalogSearchMedicine>();

  for (const [specialty, entries] of Object.entries(catalog)) {
    for (const entry of entries) {
      const current = medicines.get(entry.name);
      if (!current) {
        medicines.set(entry.name, {
          id: entry.name,
          name: entry.name,
          searchText: [
            entry.name,
            entry.therapeuticClass,
            ...entry.dosageForms,
            ...entry.searchKeywords,
            ...entry.clinicalReviewFlags,
            specialty,
            medicineRiskLabels[entry.riskFlag] || '',
          ].join(' | '),
          therapeuticClass: entry.therapeuticClass,
          dosageForms: [...entry.dosageForms],
          clinicalReviewFlags: [...entry.clinicalReviewFlags],
          riskFlag: entry.riskFlag,
        });
        continue;
      }

      const fields = new Set(current.searchText.split(' | '));
      [
        specialty,
        entry.therapeuticClass,
        ...entry.dosageForms,
        ...entry.searchKeywords,
        ...entry.clinicalReviewFlags,
        medicineRiskLabels[entry.riskFlag] || '',
      ]
        .forEach((value) => fields.add(value));
      current.searchText = [...fields].join(' | ');
      current.dosageForms = [...new Set([...current.dosageForms, ...entry.dosageForms])];
      current.clinicalReviewFlags = [
        ...new Set([...current.clinicalReviewFlags, ...entry.clinicalReviewFlags]),
      ];
      if (riskPriority.indexOf(entry.riskFlag) > riskPriority.indexOf(current.riskFlag)) {
        current.riskFlag = entry.riskFlag;
      }
    }
  }

  return [...medicines.values()].sort((first, second) => first.name.localeCompare(second.name));
}

export function findCatalogTextMatches(
  medicines: CatalogSearchMedicine[],
  query: string,
  limit = 12
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const queryTerms = (normalizedQuery.match(/[a-z0-9]+/g) || []).filter((term) => term.length >= 3);
  if (!queryTerms.length) return [];

  return medicines
    .map((medicine) => {
      const haystackTerms = new Set(medicine.searchText.toLowerCase().match(/[a-z0-9]+/g) || []);
      const score = queryTerms.reduce(
        (total, term) => total + (haystackTerms.has(term) ? 1 : 0),
        0
      );
      return { medicine, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.medicine.name.localeCompare(second.medicine.name))
    .slice(0, limit)
    .map(({ medicine }) => medicine.id);
}

export const medicineRiskLabels: Partial<Record<MedicineRiskFlag, string>> = {
  antimicrobial_stewardship: 'Antimicrobial stewardship',
  high_alert_specialist_only: 'High-alert · specialist review',
  controlled_specialist_only: 'Controlled · specialist scope',
};
