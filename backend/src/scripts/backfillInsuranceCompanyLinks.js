import mongoose from 'mongoose';
import dotenv from 'dotenv';
import InsuranceCompany from '../models/InsuranceCompany.js';
import PolicyPlan from '../models/PolicyPlan.js';
import PolicyEnrollment from '../models/PolicyEnrollment.js';
import InsuranceClaim from '../models/InsuranceClaim.js';

// Links legacy plans, enrollments and claims to an InsuranceCompany by matching their stored company/provider name.
// Dry run by default. Pass --apply to write. Records whose name matches zero or several companies are reported and left unchanged.
//   node src/scripts/backfillInsuranceCompanyLinks.js            (preview)
//   node src/scripts/backfillInsuranceCompanyLinks.js --apply    (write)

dotenv.config();

const apply = process.argv.includes('--apply');
const allowRemote = process.argv.includes('--allow-remote');
const normalize = (value) => String(value || '').trim().toLowerCase();

const run = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medivault';
  const target = new URL(uri);
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  if (!localHosts.includes(target.hostname) && !allowRemote) {
    console.error(`Refusing to write to remote MongoDB host "${target.hostname}" without --allow-remote.`);
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  try {
    const companies = await InsuranceCompany.find({}).select('name').lean();
    const byName = new Map();
    for (const company of companies) {
      const key = normalize(company.name);
      byName.set(key, [...(byName.get(key) || []), company._id]);
    }

    const resolve = (name) => {
      const matches = byName.get(normalize(name)) || [];
      return matches.length === 1 ? matches[0] : null;
    };

    const missing = { $or: [{ insuranceCompany: null }, { insuranceCompany: { $exists: false } }] };
    const missingClaimLink = { $or: [{ insuranceCompanyId: null }, { insuranceCompanyId: { $exists: false } }] };
    const summary = [];

    const plans = await PolicyPlan.find(missing).select('provider name').lean();
    const enrollments = await PolicyEnrollment.find(missing).select('provider planName').lean();
    const claims = await InsuranceClaim.find(missingClaimLink).select('insuranceCompany').lean();

    const sets = [
      ['PolicyPlan', plans, (doc) => doc.provider, PolicyPlan, 'insuranceCompany'],
      ['PolicyEnrollment', enrollments, (doc) => doc.provider, PolicyEnrollment, 'insuranceCompany'],
      ['InsuranceClaim', claims, (doc) => doc.insuranceCompany, InsuranceClaim, 'insuranceCompanyId'],
    ];

    for (const [label, docs, nameOf, Model, field] of sets) {
      let linked = 0;
      const unresolved = [];
      for (const doc of docs) {
        const companyId = resolve(nameOf(doc));
        if (!companyId) { unresolved.push(`${doc._id} (name: "${nameOf(doc) || ''}")`); continue; }
        if (apply) {
          await Model.updateOne({ _id: doc._id }, { $set: { [field]: companyId } });
        }
        linked += 1;
      }
      summary.push(`${label}: ${linked} ${apply ? 'linked' : 'would be linked'}, ${unresolved.length} unresolved`);
      unresolved.forEach((line) => console.warn(`  unresolved ${label}: ${line}`));
    }

    console.info(summary.join('\n'));
    if (!apply) console.info('Dry run only. Re-run with --apply to write these links.');
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('[Insurance Company Backfill] Failed:', error.message);
  process.exitCode = 1;
});
