const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que el backend esté iniciado.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error HTTP ${response.status}.`);
  return payload.data;
}

function jsonBody(data) {
  return JSON.stringify(data);
}

export const api = {
  books: {
    list: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
      );
      return request(`/libros${query.size ? `?${query}` : ''}`);
    },
    create: (book) => request('/libros', { method: 'POST', body: jsonBody(book) }),
    update: (id, book) => request(`/libros/${encodeURIComponent(id)}`, { method: 'PUT', body: jsonBody(book) }),
    remove: (id) => request(`/libros/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request('/usuarios'),
    create: (user) => request('/usuarios', { method: 'POST', body: jsonBody(user) }),
    update: (id, user) => request(`/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: jsonBody(user) }),
    remove: (id) => request(`/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  loans: {
    list: () => request('/prestamos'),
    create: (loan) => request('/prestamos', { method: 'POST', body: jsonBody(loan) }),
    returnBook: (id) => request(`/prestamos/${encodeURIComponent(id)}/devolucion`, { method: 'POST' }),
  },
};
