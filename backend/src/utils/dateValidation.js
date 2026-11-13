export const parseExpiryDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return new Date(Number.NaN);
  const input = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    const dateOnly = new Date(Date.UTC(year, month - 1, day));
    if (dateOnly.toISOString().slice(0, 10) !== input) return new Date(Number.NaN);
    // Date-only form values expire at the end of that date in India Standard Time.
    return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
  }

  return new Date(input);
};
