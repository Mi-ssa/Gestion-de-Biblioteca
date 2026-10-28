const { timingSafeEqual } = require('node:crypto');
const usersModel = require('../models/user.model');
const { removeCredential } = require('./staff-credentials');
const { revokeUserSessions } = require('./session-revocation');

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function validateRequestOrigin(allowedOrigin) {
  return (req, res, next) => {
    if (unsafeMethods.has(req.method) && req.get('origin') !== allowedOrigin) {
      return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
    }
    return next();
  };
}

async function requireAuthentication(req, res, next) {
  const userId = req.session?.staff?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Se requiere iniciar sesión para acceder a este recurso.' });
  }
  const users = await usersModel.findAll();
  const user = users.find((record) => record.id === userId && record.rol === 'bibliotecario');
  if (!user) {
    await Promise.all([
      new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve()))),
      removeCredential(userId),
      revokeUserSessions(userId),
    ]);
    return res.status(401).json({ error: 'Se requiere iniciar sesión para acceder a este recurso.' });
  }
  req.staffUser = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
  return next();
}

function requireCsrf(req, res, next) {
  if (!unsafeMethods.has(req.method)) return next();
  const suppliedToken = req.get('x-csrf-token');
  const expectedToken = req.session?.csrfToken;
  if (typeof suppliedToken !== 'string' || typeof expectedToken !== 'string') {
    return res.status(403).json({ error: 'Token CSRF ausente o inválido.' });
  }

  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(403).json({ error: 'Token CSRF ausente o inválido.' });
  }
  return next();
}

module.exports = { requireAuthentication, requireCsrf, validateRequestOrigin };
