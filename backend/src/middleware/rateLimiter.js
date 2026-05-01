const rateLimit = require('express-rate-limit');

// Limits how many requests one IP can make
// Protects against accidental or malicious flooding
const signalRateLimiter = rateLimit({

  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute window
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 1000,  // 1000 requests per minute

  // What to send back when the limit is hit
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many signals from this IP. Please slow down.',
    retryAfter: '60 seconds',
  },

  // Add headers so the caller knows their limit status
  standardHeaders: true,
  legacyHeaders:   false,

  // Log when someone hits the limit
  handler: (req, res, next, options) => {
    console.warn(`⚠️  Rate limit hit from IP: ${req.ip}`);
    res.status(429).json(options.message);
  },

});

module.exports = { signalRateLimiter };