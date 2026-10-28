import { getLoanStatus } from './record-filters.js';

const userRoleLabels = {
  estudiante: 'Estudiantes',
  docente: 'Docentes',
  bibliotecario: 'Bibliotecarios',
};

const loanStatusLabels = {
  activo: 'Activos',
  vencido: 'Vencidos',
  devuelto: 'Devueltos',
  otro: 'Otros',
};

export function calculateLibraryStatistics({
  books = [],
  users = [],
  loans = [],
  now = new Date(),
}) {
  const safeBooks = Array.isArray(books) ? books : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeLoans = Array.isArray(loans) ? loans : [];

  const categoryMap = new Map();
  for (const book of safeBooks) {
    const category = typeof book.categoria === 'string' ? book.categoria.trim() : '';
    if (!category) continue;
    const counts = categoryMap.get(category) || { category, titles: 0, copies: 0 };
    counts.titles += 1;
    counts.copies += Number.isFinite(book.stockTotal) ? Math.max(0, book.stockTotal) : 0;
    categoryMap.set(category, counts);
  }
  const categories = [...categoryMap.values()].sort((left, right) => (
    left.category.localeCompare(right.category, 'es-MX')
  ));

  const totalCopies = safeBooks.reduce((total, book) => (
    total + (Number.isFinite(book.stockTotal) ? Math.max(0, book.stockTotal) : 0)
  ), 0);
  const availableCopies = safeBooks.reduce((total, book) => (
    total + (Number.isFinite(book.stockDisponible) ? Math.max(0, book.stockDisponible) : 0)
  ), 0);
  const unAvailableCopies = Math.max(0, totalCopies - availableCopies);
  const bookIds = new Set(safeBooks.map((book) => book.id));
  const activeLoanCount = safeLoans.filter((loan) => (
    loan.estado === 'activo' && bookIds.has(loan.libroId)
  )).length;
  const borrowedCopies = Math.min(unAvailableCopies, activeLoanCount);
  const otherCopies = unAvailableCopies - borrowedCopies;

  const loanStatusCounts = new Map();
  for (const loan of safeLoans) {
    const status = getLoanStatus(loan, now);
    const key = Object.hasOwn(loanStatusLabels, status) ? status : 'otro';
    loanStatusCounts.set(key, (loanStatusCounts.get(key) || 0) + 1);
  }
  const loanStatuses = Object.entries(loanStatusLabels)
    .filter(([status]) => loanStatusCounts.has(status))
    .map(([status, label]) => ({
      status,
      label,
      count: loanStatusCounts.get(status),
    }));

  const roles = new Map(Object.entries(userRoleLabels).map(([role, label]) => [
    role,
    { role, label, count: 0 },
  ]));
  for (const user of safeUsers) {
    if (roles.has(user.rol)) {
      roles.get(user.rol).count += 1;
    } else {
      const other = roles.get('otro') || { role: 'otro', label: 'Otros', count: 0 };
      other.count += 1;
      roles.set('otro', other);
    }
  }

  return {
    categories,
    inventory: {
      totalCopies,
      availableCopies,
      borrowedCopies,
      otherCopies,
      activeLoanCount,
    },
    loanStatuses,
    roles: [...roles.values()].filter((role) => role.count > 0),
  };
}
