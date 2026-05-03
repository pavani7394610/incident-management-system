// Logs every incoming request with method, path, status, and duration
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Run after response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status   = res.statusCode;

    // Colour-code by status
    const colour =
      status >= 500 ? '\x1b[31m' :  // red
      status >= 400 ? '\x1b[33m' :  // yellow
      status >= 200 ? '\x1b[32m' :  // green
      '\x1b[0m';

    const reset = '\x1b[0m';

    console.log(
      `${colour}${req.method}${reset} ` +
      `${req.path} → ${colour}${status}${reset} ` +
      `(${duration}ms)`
    );
  });

  next();
};

module.exports = { requestLogger };