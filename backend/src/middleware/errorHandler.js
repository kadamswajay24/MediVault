export const notFound = (req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
  const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413
    : err.name === 'MulterError' ? 400
    : err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  console.error(`[API Error] [${req.method} ${req.url}]:`, err.message);

  res.status(statusCode).json({
    success: false,
    message: err.code === 'LIMIT_FILE_SIZE' ? 'Files must be 4 MB or smaller.' : err.message || 'An unexpected internal server error occurred',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
