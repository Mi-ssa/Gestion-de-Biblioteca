import { getLoanStatus } from '../utils/record-filters';
import { formatBlockUntil, getActiveBlockUntil } from '../utils/user-block-status';
import { formatMxn } from '../utils/currency';

function formatDate(value) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function LoanCard({ loan, onReturn, returning }) {
  const overdue = getLoanStatus(loan) === 'vencido';
  const blockedUntil = getActiveBlockUntil(loan.usuario?.bloqueadoHasta);
  const borrowerName = loan.usuario?.nombre || 'Usuario eliminado';
  const bookTitle = loan.libro?.titulo || 'Libro eliminado';

  return (
    <article className="loan-card">
      <div className="loan-cover">▤</div>
      <div className="loan-info">
        <div className="loan-title-line">
          <h3>{bookTitle}</h3>
          <span className={`status-pill ${loan.estado === 'activo' ? (overdue ? 'status-pill--late' : 'status-pill--active') : 'status-pill--returned'}`}>
            {loan.estado === 'activo' ? (overdue ? 'Vencido' : 'Activo') : 'Devuelto'}
          </span>
        </div>
        <p>{borrowerName} <span>·</span> {loan.usuario?.rol || 'sin rol'}</p>
        <div className="loan-meta">
          <span>Préstamo <strong>{formatDate(loan.fechaPrestamo)}</strong></span>
          <span>Vence <strong>{formatDate(loan.fechaVencimiento)}</strong></span>
          {overdue && typeof loan.diasRetrasoEstimados === 'number' && (
            <span className="fine-label fine-label--estimate">
              Retraso <strong>{loan.diasRetrasoEstimados} días</strong>
              <span>Multa estimada <strong>{formatMxn(loan.multaEstimada)}</strong></span>
            </span>
          )}
          {loan.estado === 'devuelto' && loan.fechaDevolucion && <span>Devolución <strong>{formatDate(loan.fechaDevolucion)}</strong></span>}
          {loan.estado === 'devuelto' && typeof loan.diasRetraso === 'number' && <span>Retraso <strong>{loan.diasRetraso} días</strong></span>}
          {loan.estado === 'devuelto' && typeof loan.multa === 'number' && <span className="fine-label">Multa definitiva <strong>{formatMxn(loan.multa)}</strong></span>}
        </div>
        {blockedUntil && (
          <div className="loan-user-block-info" role="status">
            <span className="user-block-badge">Usuario bloqueado</span>
            <span>Desbloqueo: <time dateTime={blockedUntil.toISOString()}>{formatBlockUntil(blockedUntil)}</time></span>
          </div>
        )}
      </div>
      {loan.estado === 'activo' && <button className="button button--outline button--small" type="button" disabled={returning} onClick={() => onReturn(loan)}>{returning ? 'Procesando…' : 'Registrar devolución'}</button>}
    </article>
  );
}

export default LoanCard;
