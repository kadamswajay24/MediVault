// Parses a JSON string sent as a multipart form field. Malformed input is a client
// error (400), not a server error, so it is tagged with statusCode for errorHandler.
export const parseJsonField = (value, fieldName) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(`The ${fieldName} field must be valid JSON.`);
    error.statusCode = 400;
    throw error;
  }
};
