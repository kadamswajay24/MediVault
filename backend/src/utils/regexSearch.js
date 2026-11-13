// Escapes user-supplied text so it is matched literally inside a MongoDB $regex.
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
