const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('./auth.controller');
const { requireAuthentication, requireCsrf } = require('./auth.middleware');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera antes de volver a intentarlo.' },
});

router.get('/session', controller.currentSession);
router.post('/login', loginLimiter, controller.login);
router.post('/logout', requireAuthentication, requireCsrf, controller.logout);

module.exports = router;
