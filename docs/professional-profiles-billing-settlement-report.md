# MediVault Professional Profiles, Hospital Billing, and Claim Settlement

**Research and product design report**  
**Prepared:** 7 November 2026  
**Scope:** Professional account types and permissions, nursing workflows, pharmacy and laboratory workflows, hospital billing, claim allocation, and demo/real settlement display.

## Executive summary

MediVault can expand beyond its current patient, medical staff, insurance agent, and administrator accounts. The safest and most maintainable approach is to keep a shared staff account category for authentication while introducing a verified professional type and explicit capabilities for each type. A nurse, pharmacist, laboratory professional, and physician should not inherit the same clinical permissions just because they all work in healthcare.

Hospitals should be represented as organizations with staff memberships. An authorized hospital billing user should create or upload the source bill; a patient may upload an invoice for reimbursement; the insurer should record claim adjudication without editing the original invoice. Settlement should be tracked separately from claim approval.

For the proposed hospital flow, show four distinct figures: **final bill total**, **insurer-approved amount**, **amount actually paid**, and **patient balance due**. Cashless settlement pays an approved amount to an eligible hospital; the patient may owe the uncovered remainder. Reimbursement pays the eligible amount to the patient after they have paid the bill. An indemnity claim should not pay the same amount to both parties or send an invoice “surplus” to a patient.

The first useful expansion is a capability model and role-specific credential onboarding, followed by nurse workflows. A clearly labelled simulation can then exercise bills, claim decisions, and payout statuses without collecting real bank details or moving money. Real settlement requires insurer, provider, facility, and payment integrations, as well as operational and regulatory review.

## 1. Current MediVault baseline

Repository review found:

- The account role enum is `patient`, `medical_staff`, `insurance_agent`, and `admin`.
- Clinical registration already presents **Doctor** and **Nurse** choices, but both are assigned `medical_staff`.
- The user model stores generic medical staff fields such as license number, specialization, hospital affiliation, appointment schedule, and appointment managers. It does not represent a hospital organization or a professional registration authority/type.
- Existing clinical routes and workflows primarily authorize the broad `medical_staff` role. Adding pharmacists or lab staff to that role without further checks could give them physician-oriented access.
- The app has digital clinical notes and prescriptions, patient-specific clinical access grants, appointment workflows, health records, medication reminders, claims, and claim progress history.
- The README describes marketplace coverage/enrollments and payments as demonstrations. There is no actual hospital billing or insurer payout integration.

This means the main architectural gap is permission granularity and organization ownership, not simply adding more options to the signup dropdown.

## 2. Recommended account and permission design

### 2.1 Separate account role from professional type

Keep a shared account role such as `clinical_professional` (or retain `medical_staff` during migration) and add a verified `professionalType` field:

- `physician`
- `nurse`
- `pharmacist`
- `medical_lab_technologist`
- optionally, later: `lab_authorized_signatory`, `pathologist`, or other jurisdictionally reviewed categories

Do not use `specialization` alone as authorization. A string such as “Nursing” or “Laboratory” is profile information, not an access-control rule. Backend route and object-level checks should use a capability map, for example:

| Capability | Physician | Nurse | Pharmacist | Lab professional |
|---|---:|---:|---:|---:|
| Request patient-specific access | Yes | Yes, scoped purpose | Yes, scoped purpose | Yes, scoped to order/result |
| Create/modify physician prescription | Yes | No | No | No |
| Record nursing observation/care task | Optional | Yes | No | No |
| Record medication review/counseling | Optional | No | Yes | No |
| Record dispense status against a prescription | No | No | Yes | No |
| Enter lab result against an order | No | No | No | Yes, within role |
| Authorize/release final lab report | By facility-authorized signatory only | No | No | Only when specifically credentialed/authorized |
| Create official hospital invoice | No | No | No | No |

Every capability should still require an active account, verified credential, appropriate organization membership where applicable, and valid patient/order access. The table is a product proposal, not a statement that every profession has identical legal scope across all settings.

### 2.2 Professional onboarding and verification

Use separate profile fields for:

- Professional type and scope/specialty.
- Registration authority, registration number, registering state, and expiry/renewal information where applicable.
- Qualification and credential documents.
- Hospital, clinic, pharmacy, or laboratory affiliation and role in that organization.
- Credential verification state, verifier, date, expiry, and review notes.

For India, the Pharmacy Council of India says State Pharmacy Councils maintain pharmacist registration. The Indian Nursing Council provides a Nurses Registration & Tracking System. Medical Laboratory Sciences professionals are listed under the NCAHP Act; in October 2026, the Ministry of Health and Family Welfare announced NCAHP registration regulations that provide for digital registration, unique IDs, QR-coded certificates, and public verification via State and Central Registers. Build verification as a configurable process and verify the current registry workflow before connecting to it; do not assume a public API exists.

## 3. Professional features and boundaries

### 3.1 Nurses: care coordination workspace

The most practical first nurse-specific workflow is a patient-care activity area that complements, rather than duplicates, physician notes:

1. **Observations and vitals:** timestamped vitals, measurement units, source, and optional context. Preserve history rather than silently overwriting earlier values.
2. **Nursing notes:** structured observation, care delivered, patient response, escalation, and follow-up, attributed to the nurse and encounter.
3. **Care tasks and handover:** assigned tasks, due times, completion status, and a concise shift handover summary.
4. **Medication administration record (MAR):** record administered, refused, held, or missed doses against an existing clinician-approved medication order, with time and reason. The workflow must not create or alter the underlying prescription.
5. **Discharge follow-up:** assigned education or follow-up tasks and whether the patient acknowledged the instructions.

For the first release, make this a documented-care workflow, not an autonomous triage or treatment recommendation tool. Any escalation indicator should be based on facility-approved rules and should route to a responsible clinician; it must not present a software-generated diagnosis.

The Indian Nursing Council describes nursing and midwifery as collaborative, patient-centered practice across promotive, preventive, curative, and rehabilitative care. MediVault should support attributed documentation, care coordination, and communication while leaving clinical orders and decisions to the appropriate authorized professional.

### 3.2 Pharmacists: medication review and dispensing record

MediVault already stores ongoing patient medications and digital prescriptions, which provides a base for pharmacy workflows:

- Patient-authorized review of a current prescription and relevant medication/allergy history.
- A structured medication review: possible duplication, drug/drug or drug/allergy concern, dosage/duration question, adherence/counseling need, and free-text note.
- A clear **refer to prescriber** action for a concern. The pharmacist’s note must not mutate the physician’s prescription.
- Counseling record: topic, date, pharmacist, and whether the patient/caregiver accepted counseling.
- Dispense tracking against the prescription: dispensed, partial, unavailable, or not dispensed, with quantity and date where appropriate.
- Refill reminder or medication reconciliation proposal, kept distinct from a new prescription.

The Pharmacy Council of India says registered pharmacists dispense medicines against a registered medical practitioner’s prescription and may counsel the patient or caregiver. Its clarification explicitly says the Pharmacy Practice Regulations do not empower pharmacists to diagnose or prescribe. The product should therefore let a pharmacist document a concern and communicate it to the prescriber, not independently change treatment or substitute the prescription.

### 3.3 Laboratory professionals: order-to-result workflow

Lab features depend on a verified laboratory organization and a result authorization process:

1. An authorized clinician creates a lab order for a patient and records the clinical context needed by the lab.
2. An authorized lab user accepts or queries the order and assigns an accession/sample identifier.
3. Lab staff record specimen collection, receipt, rejection/recollection, and processing states.
4. An authorized user enters results against the ordered tests, with units, reference ranges, flags, method, and timestamps from the laboratory information system or an approved manual workflow.
5. A separately authorized reviewer/signatory releases the final report. The patient and authorized care team can then view/download it.

NABL accredits medical testing laboratories against ISO 15189, its requirements for medical-laboratory quality and competence. MediVault should record which laboratory and authorized user produced/released a report, and preserve report versions and corrections. A technician’s result entry should not automatically become a final signed report or a diagnosis.

For a small first release, support an order attachment and final report upload with accession number, status, source laboratory, author, reviewer/signatory, and timestamps. Defer instrument-level integration, automated reference-range interpretation, and direct diagnostic conclusions.

## 4. Hospital organizations and bill creation

### 4.1 Who creates what

| Actor | Responsibility |
|---|---|
| Hospital billing staff | Create an estimate and/or official itemized invoice for services the hospital delivered; attach or issue the source document. |
| Clinicians and nurses | Document clinical encounters and services delivered; they do not set or edit the official invoice total. |
| Patient | Upload the hospital’s invoice/receipt for a reimbursement claim if the hospital does not send it directly. An upload is evidence, not an invoice authored by the patient. |
| Insurance claims reviewer | Record assessed/admissible expenses, deductions, decision, reason, and approved amount without changing the original hospital invoice. |
| Insurer finance or payout integration | Initiate and report settlement to the correct payee after authorization. Keep payment initiation separate from medical claim review. |
| MediVault demo simulator | Generate synthetic bills and simulated status changes only; label them as demo and never represent them as actual coverage or money movement. |

### 4.2 Organization model

Add an organization/facility model rather than relying on a free-text `hospitalAffiliation` field alone:

- Organization: legal/display name, facility type, address, network/participation status, operational contact, and verification state.
- Membership: user, organization, facility, job function, status, granted capabilities, and start/end dates.
- Facility roles: clinician, nurse, pharmacist, lab user, billing user, facility administrator, and report signatory, with narrowly defined permissions.
- Every bill and result references the responsible organization and facility, plus the individual actor who created/reviewed it.

Do not let an individual staff account create an official bill without an authorized organization membership. For a demo, seed fictional facilities and mark every bill and organization as synthetic.

### 4.3 Bill and claim data

An itemized bill should keep the source invoice separate from insurer adjudication. Suggested fields:

- Bill owner/patient and encounter/admission reference.
- Facility/organization and invoice number.
- Draft/final/void state, issue date, service dates, currency, and invoice version.
- Line items: description/code if available, quantity, unit price, total, and category.
- Subtotal, taxes/adjustments if applicable, and final bill total.
- Source document and upload metadata.
- Creator, finalizer, correction reason, and immutable audit history.

The claim assessment should then reference the bill and record:

- Claimed amount and eligible/admissible amount.
- Deductible, co-pay, sub-limit, non-covered items, and other adjustment details where supplied by the insurer.
- Approved amount, recipient route (hospital cashless or member reimbursement), decision maker, reason, and decision timestamp.
- Payment instruction and status in a separate settlement entity.

Never overwrite the bill total with the approved amount. Keep source amount, insurer assessment, and settlement amounts as distinct facts.

## 5. Cashless, reimbursement, and “balance due” behavior

The application should distinguish these two claim types.

### Cashless/network-hospital example

For a final hospital bill of **₹1,00,000** and a final insurer amount payable to the hospital of **₹72,000**:

- Final bill total: ₹1,00,000
- Insurer amount payable to hospital: ₹72,000
- Patient responsibility, subject to insurer's final assessment and patient payments: ₹28,000
- Patient reimbursement: ₹0, unless a separate benefit under the policy applies

Cashless authorization is not itself proof that the hospital was paid. The 2024 IRDAI Health Insurance Master Circular distinguishes the initial cashless authorization from final discharge authorization and describes insurer timelines for those decisions. The actual final amount remains subject to the policy and claim assessment.

### Reimbursement example

If the patient paid the ₹1,00,000 hospital invoice and the insurer later approves ₹72,000:

- Hospital balance due: ₹0 (the patient paid the hospital)
- Member reimbursement payable: ₹72,000
- Patient's net out-of-pocket amount: ₹28,000

An indemnity reimbursement should not also pay that same ₹72,000 to the hospital. If approved amount exceeds eligible expenses, do not automatically pay the surplus to the patient. Any fixed-benefit or hospital-cash benefit should be modeled separately and must follow that product's terms.

### Balance formulas and labels

Avoid a single ambiguous “balance” number. Display:

- **Patient amount due to hospital** = final invoice total − insurer amount actually settled to hospital − patient amount already paid to hospital (subject to verified adjustments/refunds).
- **Reimbursement pending** = approved member-payable amount − member payout amount completed (net of any confirmed reversal).
- **Completed reimbursements** = sum of completed payouts to the member, net of reversed payouts.
- **Insurer payment to hospital** = approved/authorized hospital payable and its separate settlement status.

Use labels such as **Patient responsibility due**, **Awaiting insurer payment**, **Reimbursement processing**, and **Paid to hospital**. A claim marked approved must not automatically increment a completed payment total.

## 6. Demo transactions and display of amounts

MediVault can provide a realistic end-to-end trial without representing the app as holding money:

1. A demo facility billing user creates a synthetic itemized bill.
2. A demo insurer reviewer approves, partially approves, requests information, or declines it.
3. For cashless, the demo creates a simulated hospital settlement; for reimbursement, it creates a simulated member payout.
4. A demo finance control moves the transaction through queued/pending, processing, completed, failed, or reversed.
5. The patient sees the amount, recipient type, claim reference, timestamp, and demo status in the claim timeline and reimbursement summary.

Display **Demo reimbursements completed** as the sum of completed simulated payouts, and show pending and failed amounts separately. This gives the user the visible “amount added” experience without calling it a spendable wallet balance. Do not collect a real account number for the internal simulator; use a fixed synthetic masked destination such as “Demo account •••• 1234”.

For a later payment-provider sandbox, keep test and live credentials/data strictly separate. Provider test payouts do not establish that real money was sent. For example, Stripe documents that test-mode payouts do not actually send money, even though the test balance must cover the payout. Real integrations should rely on authenticated server-to-server status updates and reconciliation, not a browser success screen. Duplicate, delayed, and out-of-order updates must not count a payment twice.

Do not call this a “MediVault wallet” or show a spendable balance. RBI defines prepaid payment instruments in terms of stored value used for purchases or financial services/remittance; a stored-value or spendable wallet feature is a materially different product and requires separate legal/compliance review. A non-spendable reimbursement history is a clearer product concept.

## 7. Privacy, authorization, and audit requirements

- Require explicit patient-specific consent/grants for every professional access path, with an appropriate purpose, expiry, and immediate revocation.
- Scope lab staff access to the ordered test/result and necessary patient identity/context; do not grant access to the full vault by default.
- Scope pharmacists to prescriptions, medication/allergy context relevant to review, and the patient’s consented medication service.
- Scope nurses to the care episode, tasks, observations, and orders relevant to their assigned care.
- Make record uploads/downloads, order access, note creation, medication review, report release, bill creation/correction, claim adjudication, and payment status changes auditable with actor, organization, timestamp, resource, and reason.
- Keep a final report/invoice version immutable. Corrections create a new version with a reason and preserve the prior version.
- Do not log bank account numbers, full credentials, sensitive clinical text, or raw provider webhook bodies in application logs.
- Keep insurer access restricted to documents attached to that claim, as the existing product intends.

## 8. Phased implementation plan

### Phase 0 — Product and permission design

- Approve the professional-type/capability matrix.
- Decide which account registrations require a state/national registry and who verifies them.
- Decide whether the initial bill/payments experience is strictly synthetic.
- Map patient access grants to the new professional types and objects.

### Phase 1 — Professional profile foundation

- Add `professionalType`, registration authority/number/state, qualification, credential expiry, organization membership, and role-specific verification fields.
- Update administrator review tools to verify the correct credential category.
- Add backend capability checks and prevent non-physicians from using prescription-authoring routes.
- Preserve existing accounts through a migration that maps current nurse profiles to `nurse` and other current medical staff to `physician` only when justified by verified profile data. Unknown records should require admin review, not be guessed.

### Phase 2 — Nurse care coordination

- Add encounter-linked vitals, nursing notes, care tasks/handover, and a medication administration record against existing orders.
- Add routes and audit event types with nurse-only capabilities.
- Keep prescribing/editing orders restricted to authorized prescribers.

### Phase 3 — Hospital billing and demo settlement

- Add facility organizations and memberships, a bill model, invoice versioning, claim allocations, settlement records, and a demo provider.
- Add a biller view and a patient claim view with the balance components above.
- Add demo statuses and a ledger summary. Make demo labeling persistent in the UI and API response.
- Test arithmetic, duplicate payout prevention, split-payee behavior, failure/reversal handling, and cross-patient/facility authorization.

### Phase 4 — Pharmacist workflow

- Add medication review, counseling, dispense status, and prescriber escalation notes.
- Prevent pharmacist edits to the source prescription and prevent diagnosis/prescription authoring through pharmacist routes.
- Ensure counseling/dispense records do not silently rewrite the patient’s self-reported ongoing medication list.

### Phase 5 — Lab order and result workflow

- Add clinician-created lab orders, accession/specimen tracking, result entry, lab organization attribution, and signatory release.
- Start with final report upload and metadata; defer direct LIS, instrument, NHCX, and result-interpretation integrations until partner workflows and standards are selected.
- Support corrected/reissued reports with a complete version and notification history.

### Phase 6 — Real integration readiness

- Select insurer/TPA, hospital, and payout partners for a defined cashless or reimbursement use case.
- Review contractual, regulatory, privacy, security, retention, and operational requirements with qualified counsel and partners.
- Implement environment-separated credentials, provider webhook signature verification, idempotency, durable event intake, reconciliation, and operational exception queues.
- Do not enable live movement of funds based on demo logic or a frontend action.

## 9. Acceptance criteria for an initial release

- A nurse can record an observation and an administration event only against an authorized patient and existing order; no prescription can be created or edited through nurse permissions.
- A pharmacist can record review/counseling/dispense data and refer concerns to a prescriber; they cannot author or substitute a prescription.
- Lab result entry is tied to an authorized order and organization; only an authorized signatory can release a final result.
- An official hospital bill can be created only by a verified billing user belonging to that facility. Patients can upload bills for claims without those uploads being represented as hospital-issued invoices.
- Insurer claim assessment does not overwrite the source bill.
- Claim approval and settlement are separate statuses. Pending/processing transactions are not counted as completed payments.
- Cashless and reimbursement flows cannot pay the same approved amount twice.
- Patient balance, insurer-to-hospital settlement, and member reimbursement are shown as separate values.
- Demo transactions are clearly labelled, use synthetic facilities and destinations, and cannot be mistaken for coverage or real money.
- Every professional action is patient-scoped, capability-checked, and audit logged.

## 10. Research sources

The role recommendations use the following primary or government/sector sources. They are product-design references, not a substitute for legal, clinical, insurer, or facility review before live use.

1. Pharmacy Council of India, [Pharmacy Practice Regulations](https://pci.nic.in/Circulars/Pharmacy%20Practice%20Regulations.pdf) and [clarification on diagnosis/prescribing](https://www.pci.nic.in/pdf/38.pdf).
2. Indian Nursing Council, [2024 Gazette notification describing nursing scope and collaborative practice](https://www.indiannursingcouncil.org/uploads/pdf/17320137691715709711673c6ec999354.pdf).
3. Government of India, [National Commission for Allied and Healthcare Professions Act, 2021](https://www.indiacode.nic.in/bitstream/123456789/16824/1/a2021-14.pdf).
4. Ministry of Health and Family Welfare / Press Information Bureau, [NCAHP registration regulations and digital verification announcement, 7 October 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2320314&lang=1&reg=3).
5. NABL, [Medical testing laboratories and ISO 15189 accreditation](https://nabl-india.org/medical-testing-laboratories-iso-15189/).
6. IRDAI, [Master Circular on Health Insurance Business, 29 May 2024](https://actuariesindia.org/sites/default/files/inline-files/5.%20Master%20Circular%20on%20Health%20Insurance%20Business%202024.pdf).
7. Reserve Bank of India, [Master Directions on Prepaid Payment Instruments, updated 30 September 2026](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12156&Mode=0&fn=9).
8. Stripe, [Create a payout API reference](https://docs.stripe.com/api/payouts/create?lang=dotnet), documenting test mode behavior.
9. Razorpay, [Payout API status fields](https://razorpay.com/docs/api/x/payout-wallet/create/payout-composite/?preferred-country=IN) and [webhook/idempotency guidance](https://razorpay.com/blog/payment-gateway-webhooks-india/).

