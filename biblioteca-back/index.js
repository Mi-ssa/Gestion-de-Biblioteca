const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { validateRequestOrigin } = require('./src/auth/auth.middleware');
const { configureSessionRevocation } = require('./src/auth/session-revocation');
const withOperationLock = require('./src/services/operation-lock');
const { recoverPendingUserCreation } = require('./src/services/user-creation-recovery');
const authRoutes = require('./src/auth/auth.routes');
const booksRoutes = require('./src/routes/books.routes');
const usersRoutes = require('./src/routes/users.routes');
const loansRoutes = require('./src/routes/loans.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const frontendUrl = new URL(allowedOrigin);
if (!['http:', 'https:'].includes(frontendUrl.protocol) || frontendUrl.origin !== allowedOrigin) {
  throw new Error('FRONTEND_ORIGIN debe ser un origen HTTP(S) exacto, sin ruta ni comodines.');
}
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
  throw new Error('Configura SESSION_SECRET con al menos 32 bytes aleatorios.');
}
const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error('SESSION_COOKIE_SAME_SITE debe ser lax, strict o none.');
}
const secureCookies = process.env.NODE_ENV === 'production';
if (secureCookies && frontendUrl.protocol !== 'https:') {
  throw new Error('En producción, FRONTEND_ORIGIN debe usar HTTPS.');
}
if (sameSite === 'none' && !secureCookies) {
  throw new Error('SameSite=None requiere NODE_ENV=production y HTTPS.');
}
const cookieName = secureCookies ? '__Host-biblioteca.sid' : 'biblioteca.sid';
const sessionMaxAge = 8 * 60 * 60 * 1000;
const privateDirectory = path.resolve(process.env.PRIVATE_DATA_DIR || path.join(__dirname, 'private'));
const sessionDirectory = path.join(privateDirectory, 'sessions');
fs.mkdirSync(sessionDirectory, { recursive: true, mode: 0o700 });
if (process.platform !== 'win32') {
  fs.chmodSync(privateDirectory, 0o700);
  fs.chmodSync(sessionDirectory, 0o700);
}

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

const sessionStore = new FileStore({
  path: sessionDirectory,
  ttl: Math.floor(sessionMaxAge / 1000),
  retries: 0,
  reapInterval: 60 * 60,
  secret: sessionSecret,
});
// Use an absolute eight-hour lifetime; touch would rewrite the file on every concurrent read.
sessionStore.touch = undefined;
configureSessionRevocation(sessionStore, sessionDirectory);

app.disable('x-powered-by');
const requestLoggingSetting = process.env.HTTP_REQUEST_LOGGING;
const requestLoggingEnabled = requestLoggingSetting === 'true'
  || (requestLoggingSetting !== 'false' && process.env.NODE_ENV !== 'production');
if (requestLoggingEnabled) {
  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.once('finish', () => {
      const routePath = req.route?.path;
      const route = typeof routePath === 'string'
        ? `${req.baseUrl}${routePath}` || '/'
        : '/unmatched';
      const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
      console.log(`${req.method} ${route} ${res.statusCode} - ${durationMs} ms`);
    });
    next();
  });
}
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: cookieName,
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  cookie: {
    httpOnly: true,
    secure: secureCookies,
    sameSite,
    maxAge: sessionMaxAge,
    path: '/',
  },
}));
app.use('/api', (req, res, next) => {
  withOperationLock(recoverPendingUserCreation).then(() => next(), next);
});
app.use('/api', validateRequestOrigin(allowedOrigin));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'biblioteca-api' });
});
app.use('/api/auth', authRoutes);
app.use('/api/libros', booksRoutes);
app.use('/api/usuarios', usersRoutes);
app.use('/api/prestamos', loansRoutes);
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor de biblioteca disponible en http://localhost:${PORT}`);
    console.log(`Datos JSON: ${path.join(__dirname, 'src/data')}`);
    console.log(`Sesiones y cuentas privadas: ${privateDirectory}`);
  });
}

module.exports = app;
