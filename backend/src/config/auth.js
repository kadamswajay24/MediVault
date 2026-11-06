const knownDevelopmentSecret = 'medivault_super_secret_jwt_key_2026_dev_env';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32 || secret === knownDevelopmentSecret) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
  }
  return secret;
};
