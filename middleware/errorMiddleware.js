import multer from 'multer';

const validationErrors = (error) =>
  Object.values(error.errors).map((item) => ({
    field: item.path,
    message: item.message,
  }));

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  let statusCode = error.statusCode || 500;
  let message = statusCode >= 500 ? 'Internal server error' : error.message || 'Request failed';
  let errors = error.errors || [];

  if (error instanceof multer.MulterError) {
    statusCode = 400;
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Image must not exceed 5 MB'
        : 'Image upload failed';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = validationErrors(error);
  } else if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    message = field ? `A record with that ${field} already exists` : 'Duplicate record';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${error.path}`;
  } else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Request body contains invalid JSON';
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(statusCode).json({ success: false, message, errors });
};
