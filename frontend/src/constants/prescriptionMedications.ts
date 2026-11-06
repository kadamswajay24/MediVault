import specialtyMedicineCsv from '../../data/medivault_specialty_medicine_catalog.csv?raw';
import {
  getCatalogSearchMedicines,
  getSpecialtyMedicineOptions,
  parseSpecialtyMedicineCatalog,
} from './specialtyMedicineCatalog';

export const MEDICATION_CATALOG = [
  {
    name: 'Paracetamol (acetaminophen)',
    ingredient: 'Paracetamol / acetaminophen',
    use: 'Pain and fever relief',
    caution: 'Check for duplicate acetaminophen-containing products and liver disease.',
  },
  {
    name: 'Ibuprofen',
    ingredient: 'Ibuprofen',
    use: 'Pain, fever, and inflammation',
    caution: 'Review gastrointestinal, kidney, cardiovascular, and pregnancy risks.',
  },
  {
    name: 'Amoxicillin',
    ingredient: 'Amoxicillin',
    use: 'A penicillin antibiotic for selected bacterial infections',
    caution: 'Check penicillin allergy; antibiotics are not for viral infections.',
  },
  {
    name: 'Cetirizine',
    ingredient: 'Cetirizine',
    use: 'Allergy symptoms',
    caution: 'May cause drowsiness; consider kidney function and other sedatives.',
  },
  {
    name: 'Metformin',
    ingredient: 'Metformin',
    use: 'Blood glucose management in type 2 diabetes',
    caution: 'Review kidney function and relevant acute illness or contrast procedures.',
  },
  {
    name: 'Amlodipine',
    ingredient: 'Amlodipine',
    use: 'Hypertension or angina',
    caution: 'Monitor blood pressure; ankle swelling and dizziness can occur.',
  },
  {
    name: 'Omeprazole',
    ingredient: 'Omeprazole',
    use: 'Acid-related conditions',
    caution: 'Review duration, interactions, and ongoing need.',
  },
];

const SPECIALTY_MEDICINE_CATALOG = parseSpecialtyMedicineCatalog(specialtyMedicineCsv);
export const CATALOG_SEARCH_MEDICINES = getCatalogSearchMedicines(SPECIALTY_MEDICINE_CATALOG);

export function getSpecialtyMedications(specialization?: string) {
  const options = getSpecialtyMedicineOptions(specialization, SPECIALTY_MEDICINE_CATALOG);
  return {
    ...options,
    medicineReferences: Object.fromEntries(
      options.medicines.map((medicine) => [medicine.name, medicine])
    ),
    medicines: options.medicines.map((medicine) => medicine.name),
  };
}
