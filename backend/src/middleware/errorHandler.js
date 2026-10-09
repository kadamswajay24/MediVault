export const notFound = (req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  console.error(`[API Error] [${req.method} ${req.url}]:`, err.message);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
