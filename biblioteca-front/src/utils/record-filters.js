function normalizeSearchText(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    : '';
}

export function filterUsers(users, { query = '', role = '' } = {}) {
  const search = normalizeSearchText(query.trim());
  return users.filter((user) => {
    const matchesSearch = !search || [user.nombre, user.email, user.id]
      .some((value) => normalizeSearchText(value).includes(search));
    return matchesSearch && (!role || user.rol === role);
  });
}

export function getLoanStatus(loan, now = new Date()) {
  if (loan.estado === 'devuelto') return 'devuelto';
  if (loan.estado === 'activo' && new Date(loan.fechaVencimiento) < now) return 'vencido';
  return loan.estado;
}

export function filterLoans(loans, { query = '', status = '' } = {}, now = new Date()) {
  const search = normalizeSearchText(query.trim());
  return loans.filter((loan) => {
    const matchesSearch = !search || [loan.usuario?.nombre, loan.libro?.titulo]
      .some((value) => normalizeSearchText(value).includes(search));
    return matchesSearch && (!status || getLoanStatus(loan, now) === status);
  });
}
