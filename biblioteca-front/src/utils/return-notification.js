import { formatMxn } from './currency.js';

export function createReturnNotification(result, { bookTitle } = {}) {
  const bookLabel = typeof bookTitle === 'string' && bookTitle.trim()
    ? `“${bookTitle.trim()}”`
    : null;
  const message = result.diasRetraso === 0
    ? `${bookLabel ? `${bookLabel} se ha devuelto correctamente.` : 'El libro se ha devuelto correctamente.'} Multa definitiva: ${formatMxn(result.multa)}`
    : `${bookLabel ? `${bookLabel}. ` : ''}Retraso: ${result.diasRetraso} días. Multa definitiva: ${formatMxn(result.multa)}`;

  const blockedUntil = typeof result.usuarioBloqueadoHasta === 'string'
    ? new Date(result.usuarioBloqueadoHasta)
    : null;
  const validBlockDate = blockedUntil && !Number.isNaN(blockedUntil.getTime())
    ? blockedUntil
    : null;

  return {
    type: result.diasRetraso > 0 ? 'warning' : 'success',
    title: 'Devolución registrada',
    message: validBlockDate
      ? `${message}\nUsuario bloqueado hasta ${validBlockDate.toLocaleDateString('es-MX')}.`
      : message,
  };
}
