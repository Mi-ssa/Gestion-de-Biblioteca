const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
let csrfToken = null;
let unauthorizedHandler = () => {};
let pendingSessionRequest = null;

async function request(path, options = {}) {
  const { requiresAuth = false, skipCsrf = false, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(requiresAuth && !skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfToken
          ? { 'X-CSRF-Token': csrfToken }
          : {}),
        ...fetchOptions.headers,
      },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que el backend esté iniciado.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Error HTTP ${response.status}.`);
    error.status = response.status;
    if (requiresAuth && response.status === 401) unauthorizedHandler();
    throw error;
  }
  return payload.data;
}

function jsonBody(data) {
  return JSON.stringify(data);
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export const api = {
  auth: {
    current: () => {
      if (!pendingSessionRequest) {
        pendingSessionRequest = request('/auth/session')
          .then((session) => {
            csrfToken = session.authenticated ? session.csrfToken : null;
            return session;
          })
          .finally(() => { pendingSessionRequest = null; });
      }
      return pendingSessionRequest;
    },
    login: async (credentials) => {
      const session = await request('/auth/login', {
        method: 'POST',
        body: jsonBody(credentials),
        skipCsrf: true,
      });
      csrfToken = session.csrfToken;
      return session;
    },
    logout: async () => {
      const result = await request('/auth/logout', { method: 'POST', requiresAuth: true });
      csrfToken = null;
      return result;
    },
  },
  books: {
    list: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
      );
      return request(`/libros${query.size ? `?${query}` : ''}`);
    },
    create: (book) => request('/libros', { method: 'POST', body: jsonBody(book), requiresAuth: true }),
    update: (id, book) => request(`/libros/${encodeURIComponent(id)}`, { method: 'PUT', body: jsonBody(book), requiresAuth: true }),
    remove: (id) => request(`/libros/${encodeURIComponent(id)}`, { method: 'DELETE', requiresAuth: true }),
  },
  users: {
    list: () => request('/usuarios', { requiresAuth: true }),
    create: (user) => request('/usuarios', { method: 'POST', body: jsonBody(user), requiresAuth: true }),
    configureAccess: (id, credentials) => request(`/usuarios/${encodeURIComponent(id)}/acceso`, {
      method: 'POST',
      body: jsonBody(credentials),
      requiresAuth: true,
    }),
    registerFinePayment: (id) => request(`/usuarios/${encodeURIComponent(id)}/pago`, {
      method: 'POST',
      requiresAuth: true,
    }),
    update: (id, user) => request(`/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: jsonBody(user), requiresAuth: true }),
    remove: (id) => request(`/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE', requiresAuth: true }),
  },
  loans: {
    list: () => request('/prestamos', { requiresAuth: true }),
    create: (loan) => request('/prestamos', { method: 'POST', body: jsonBody(loan), requiresAuth: true }),
    returnBook: (id) => request(`/prestamos/${encodeURIComponent(id)}/devolucion`, { method: 'POST', requiresAuth: true }),
  },
};
