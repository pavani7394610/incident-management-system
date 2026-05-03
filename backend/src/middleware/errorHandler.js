// Global Error Handler + 404 Handler

const errorHandler = (err, req, res, next) => {
  console.error(`❌ Unhandled error [${req.method} ${req.path}]:`, err.message);

  const isDev = process.env.NODE_ENV !== 'production';

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
    });
  }

  // Invalid ID (Mongo)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
    });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate entry — already exists',
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referenced record does not exist',
    });
  }

  // Generic fallback
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  });
};

module.exports = { errorHandler, notFoundHandler };