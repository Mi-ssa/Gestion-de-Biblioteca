const { randomBytes } = require('node:crypto');
const { verifyCredentials } = require('./staff-credentials');
const usersModel = require('../models/user.model');
const { revokeUserSessions } = require('./session-revocation');
const { removeCredential } = require('./staff-credentials');

const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;

async function login(req, res) {
  const { email, password } = req.body || {};
  if (
    typeof email !== 'string'
    || !emailPattern.test(email)
    || email.length > 254
    || typeof password !== 'string'
    || password.length < 1
    || Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({ error: 'Introduce un usuario y una contraseña válidos.' });
  }

  let account;
  try {
    account = await verifyCredentials(email.trim().toLocaleLowerCase(), password);
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ error: 'El acceso administrativo no está configurado.' });
    console.error(error);
    return res.status(500).json({ error: 'No se pudo verificar el acceso.' });
  }
  if (!account) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

  return req.session.regenerate((error) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'No se pudo iniciar la sesión.' });
    }
    req.session.staff = { userId: account.userId };
    req.session.csrfToken = randomBytes(32).toString('base64url');
    return req.session.save((saveError) => {
      if (saveError) {
        console.error(saveError);
        return res.status(500).json({ error: 'No se pudo iniciar la sesión.' });
      }
      return res.json({
        data: {
          authenticated: true,
          user: {
            id: account.userId,
            nombre: account.nombre,
            email: account.email,
            rol: account.rol,
          },
          csrfToken: req.session.csrfToken,
        },
      });
    });
  });
}

async function currentSession(req, res) {
  if (!req.session?.staff) return res.json({ data: { authenticated: false } });
  const users = await usersModel.findAll();
  const user = users.find((record) => record.id === req.session.staff.userId && record.rol === 'bibliotecario');
  if (!user) {
    await Promise.all([
      new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve()))),
      removeCredential(req.session.staff.userId),
      revokeUserSessions(req.session.staff.userId),
    ]);
    return res.json({ data: { authenticated: false } });
  }
  return res.json({
    data: {
      authenticated: true,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      csrfToken: req.session.csrfToken,
    },
  });
}

function logout(req, res) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieName = secure ? '__Host-biblioteca.sid' : 'biblioteca.sid';
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  return req.session.destroy((error) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    }
    res.clearCookie(cookieName, { path: '/', httpOnly: true, secure, sameSite });
    return res.json({ data: { authenticated: false } });
  });
}

module.exports = { currentSession, login, logout };
