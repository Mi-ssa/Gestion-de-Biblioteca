function formatDate(value) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function LoanCard({ loan, onReturn, returning }) {
  const overdue = loan.estado === 'activo' && new Date(loan.fechaVencimiento) < new Date();
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
          {loan.estado === 'devuelto' && loan.multa > 0 && <span className="fine-label">Multa <strong>${loan.multa.toFixed(2)}</strong></span>}
        </div>
      </div>
      {loan.estado === 'activo' && <button className="button button--outline button--small" type="button" disabled={returning} onClick={() => onReturn(loan)}>{returning ? 'Procesando…' : 'Registrar devolución'}</button>}
    </article>
  );
}

export default LoanCard;
