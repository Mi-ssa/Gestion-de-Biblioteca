const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export function formatMxn(amount) {
  return `${mxnFormatter.format(amount)} MXN`;
}
