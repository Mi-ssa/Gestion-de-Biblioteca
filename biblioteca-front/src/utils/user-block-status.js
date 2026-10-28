export function getActiveBlockUntil(value, now = new Date()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const blockedUntil = new Date(value);
  if (Number.isNaN(blockedUntil.getTime()) || blockedUntil <= now) return null;
  return blockedUntil;
}

export function formatBlockUntil(value) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export function getUserBlockDetails(user, now = new Date()) {
  const isBorrower = user.rol === 'estudiante' || user.rol === 'docente';
  const pendingDebt = Number.isFinite(user.deudaPendiente) && user.deudaPendiente > 0
    ? user.deudaPendiente
    : 0;
  return {
    isBorrower,
    blocked: isBorrower && user.bloqueado === true,
    blockedUntil: getActiveBlockUntil(user.bloqueadoHasta, now),
    pendingDebt,
    canRegisterFinePayment: isBorrower && pendingDebt > 0,
  };
}
