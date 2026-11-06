// Keep local-provider tests isolated from any configured cloud credentials.
process.env.AI_PROVIDER = 'ollama';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import {
  extractDocumentText,
  extractPdfText,
  generateLocalSummary,
  inspectPatientIdentity,
  LocalAiSummaryError,
} from './src/services/localAiSummaryService.js';

const createPdfWithImage = (image) => {
  const content = Buffer.from('q\n600 0 0 125 0 600 cm\n/Im0 Do\nQ');
  const imageObject = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width 1200 /Height 250 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`
    ),
    image,
    Buffer.from('\nendstream'),
  ]);
  const contentObject = Buffer.concat([
    Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
    content,
    Buffer.from('\nendstream'),
  ]);
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 6 0 R >>'
    ),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    imageObject,
    contentObject,
  ];

  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let length = chunks[0].length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(length);
    const object = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      objects[index],
      Buffer.from('\nendobj\n'),
    ]);
    chunks.push(object);
    length += object.length;
  }

  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
};

const createPdf = (text) => {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

const summaryFixture = {
  summary: 'A fictional report lists a hemoglobin measurement.',
  keyFindings: ['Hemoglobin 12.4 g/dL'],
  medicationMentions: [],
  datesAndValues: ['2026-01-15', '12.4 g/dL'],
  questionsForDoctor: [],
};

test('extracts selectable text from a PDF', async () => {
  const text = await extractPdfText(
    createPdf('Hemoglobin 12.4 g/dL report date 2026-01-15')
  );
  assert.match(text, /Hemoglobin 12\.4 g\/dL/);
  assert.match(text, /2026-01-15/);
});

test('rejects scanned PDFs without selectable text', async () => {
  await assert.rejects(
    extractPdfText(createPdf('')),
    (error) =>
      error instanceof LocalAiSummaryError &&
      error.statusCode === 422 &&
      error.code === 'no_text_layer'
  );
});

test('uses local OCR to extract text from an uploaded image', async () => {
  const canvas = createCanvas(1200, 250);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black';
  context.font = '48px Arial';
  context.fillText('Patient Name: Rohan Verma', 30, 80);
  context.fillText('DOB: 1975-06-12', 30, 160);

  const result = await extractDocumentText(canvas.toBuffer('image/png'), 'image/png');
  assert.match(result.text, /Rohan Verma/);
  assert.ok(result.confidence >= 30);
  assert.equal(result.method, 'ocr');
});

test('renders scanned PDF pages for local OCR', async () => {
  const canvas = createCanvas(1200, 250);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black';
  context.font = '48px Arial';
  context.fillText('Patient Name: Rohan Verma', 30, 80);
  context.fillText('DOB: 1975-06-12', 30, 160);

  const result = await extractDocumentText(
    createPdfWithImage(canvas.toBuffer('image/jpeg')),
    'application/pdf'
  );
  assert.match(result.text, /Rohan Verma/);
  assert.equal(result.method, 'ocr');
});

test('flags identity mismatches and leaves unclear documents unverified', () => {
  const expected = {
    names: ['Rohan Verma'],
    dateOfBirth: '1975-06-12',
    mediVaultId: 'MV-0123456789ABCDEF',
    confidence: 95,
  };
  assert.equal(
    inspectPatientIdentity('Patient Name: Rohan Verma\nDOB: 1975-06-12', expected).status,
    'matched'
  );
  assert.equal(
    inspectPatientIdentity('Patient Name: Vikram Mehta\nDOB: 1980-03-22', expected).status,
    'needs_review'
  );
  assert.equal(
    inspectPatientIdentity('Patient Name: Vikram Mehta', expected).status,
    'needs_review'
  );
  assert.equal(
    inspectPatientIdentity('Report reviewed by Rohan Verma\nHemoglobin 12.4 g/dL', expected).status,
    'unverified'
  );
  assert.equal(
    inspectPatientIdentity('Blood test results: Hemoglobin 12.4 g/dL', expected).status,
    'unverified'
  );
});

test('rejects languages that have not passed accuracy validation', async () => {
  await assert.rejects(
    generateLocalSummary('Synthetic document text', 'hi'),
    (error) => error instanceof LocalAiSummaryError && error.statusCode === 400
  );
});

test('rejects non-local Ollama endpoints', async () => {
  const previousUrl = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'https://example.com';

  try {
    await assert.rejects(
      generateLocalSummary('Synthetic document text'),
      (error) => error instanceof LocalAiSummaryError && error.statusCode === 500
    );
  } finally {
    if (previousUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = previousUrl;
  }
});

test('sends text only to local Ollama and validates its response', async (context) => {
  let requestBody;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ response: JSON.stringify(summaryFixture) }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(
    () => new Promise((resolve, reject) => {
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
    const result = await generateLocalSummary(
      'Synthetic report: hemoglobin 12.4 g/dL.',
      'en',
      'clinician'
    );
    assert.deepEqual(result.summary, summaryFixture);
    assert.equal(result.model, 'qwen2.5:3b');
    assert.equal(requestBody.model, 'qwen2.5:3b');
    assert.equal(requestBody.stream, false);
    assert.match(requestBody.prompt, /Synthetic report/);
    assert.match(requestBody.system, /treating clinician/);
  } finally {
    if (previousUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = previousUrl;
    if (previousModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = previousModel;
  }
});
