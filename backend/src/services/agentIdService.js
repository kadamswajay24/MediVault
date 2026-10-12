import { randomBytes } from 'crypto';

export const generateCompanyAgentId = (companyName) => {
  const companyCode = String(companyName || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase() || 'INSURE';

  return `${companyCode}-AGT-${randomBytes(5).toString('hex').toUpperCase()}`;
};
