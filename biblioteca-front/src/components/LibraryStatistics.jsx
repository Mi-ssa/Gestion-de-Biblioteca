import { calculateLibraryStatistics } from '../utils/library-statistics';

function EmptyChart({ children }) {
  return <p className="statistics-empty">{children}</p>;
}

function CategoryChart({ categories }) {
  if (!categories.length) return <EmptyChart>No hay libros con una categoría registrada.</EmptyChart>;
  const maxTitles = Math.max(...categories.map((item) => item.titles), 1);
  const maxCopies = Math.max(...categories.map((item) => item.copies), 1);

  return (
    <div
      className="statistics-bars"
      role="img"
      aria-label={`Libros y ejemplares por categoría: ${categories.map((item) => `${item.category}, ${item.titles} títulos y ${item.copies} ejemplares`).join('; ')}`}
    >
      {categories.map((item) => (
        <div className="statistics-category" key={item.category}>
          <strong className="statistics-category-name">{item.category}</strong>
          <div className="statistics-bar-row">
            <span>Títulos</span>
            <div className="statistics-bar-track"><span className="statistics-bar statistics-bar--titles" style={{ width: `${(item.titles / maxTitles) * 100}%` }} /></div>
            <strong>{item.titles}</strong>
          </div>
          <div className="statistics-bar-row">
            <span>Ejemplares</span>
            <div className="statistics-bar-track"><span className="statistics-bar statistics-bar--copies" style={{ width: `${(item.copies / maxCopies) * 100}%` }} /></div>
            <strong>{item.copies}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function AvailabilityChart({ inventory }) {
  if (!inventory.totalCopies) return <EmptyChart>No hay ejemplares registrados.</EmptyChart>;
  const items = [
    { label: 'Disponibles', value: inventory.availableCopies, style: 'available' },
    { label: 'Prestados', value: inventory.borrowedCopies, style: 'borrowed' },
    { label: 'Otros / sin asignar', value: inventory.otherCopies, style: 'other' },
  ];

  return (
    <div className="availability-chart">
      <div
        className="availability-stack"
        role="img"
        aria-label={items.map(({ label, value }) => `${label}: ${value}`).join(', ')}
      >
        {items.filter((item) => item.value > 0).map((item) => (
          <span
            key={item.style}
            className={`availability-segment availability-segment--${item.style}`}
            style={{ width: `${(item.value / inventory.totalCopies) * 100}%` }}
            title={`${item.label}: ${item.value}`}
          />
        ))}
      </div>
      <ul className="statistics-legend">
        {items.map((item) => (
          <li key={item.style}>
            <span className={`statistics-swatch statistics-swatch--${item.style}`} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
      <p className="statistics-footnote">
        {inventory.availableCopies} disponibles de {inventory.totalCopies} ejemplares físicos.
        {inventory.activeLoanCount > inventory.borrowedCopies
          ? ' Algunos préstamos activos no coinciden con las existencias registradas.'
          : ''}
      </p>
    </div>
  );
}

function RolesChart({ roles }) {
  if (!roles.length) return <EmptyChart>No hay usuarios registrados.</EmptyChart>;
  const maxCount = Math.max(...roles.map((item) => item.count), 1);

  return (
    <div
      className="statistics-bars"
      role="img"
      aria-label={`Usuarios por rol: ${roles.map((item) => `${item.label}, ${item.count}`).join('; ')}`}
    >
      {roles.map((item) => (
        <div className="statistics-bar-row statistics-role-row" key={item.role}>
          <span>{item.label}</span>
          <div className="statistics-bar-track"><span className="statistics-bar statistics-bar--roles" style={{ width: `${(item.count / maxCount) * 100}%` }} /></div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function LoansChart({ loanStatuses }) {
  if (!loanStatuses.length) return <EmptyChart>No hay préstamos registrados.</EmptyChart>;
  const maxCount = Math.max(...loanStatuses.map((item) => item.count), 1);

  return (
    <div
      className="statistics-bars"
      role="img"
      aria-label={`Préstamos por estado: ${loanStatuses.map((item) => `${item.label}, ${item.count}`).join('; ')}`}
    >
      {loanStatuses.map((item) => (
        <div className="statistics-bar-row statistics-loan-row" key={item.status}>
          <span>{item.label}</span>
          <div className="statistics-bar-track">
            <span
              className={`statistics-bar statistics-bar--loans statistics-bar--loans-${item.status}`}
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function StatisticsCard({ title, description, children, className = '' }) {
  return (
    <article className={`panel statistics-card ${className}`}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="statistics-description">{description}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function LibraryStatistics({ books, users, loans }) {
  const statistics = calculateLibraryStatistics({ books, users, loans });

  return (
    <section className="library-statistics" aria-labelledby="library-statistics-heading">
      <div className="statistics-heading">
        <p className="eyebrow">INDICADORES</p>
        <h2 id="library-statistics-heading">Estadísticas de la biblioteca</h2>
        <p>Resumen derivado del inventario y los registros actuales del sistema.</p>
      </div>
      <div className="statistics-grid">
        <StatisticsCard
          title="Inventario por categoría"
          description="Títulos registrados y ejemplares físicos por categoría."
        >
          <CategoryChart categories={statistics.categories} />
        </StatisticsCard>
        <StatisticsCard
          title="Disponibilidad de ejemplares"
          description="Distribución de las existencias físicas actuales."
        >
          <AvailabilityChart inventory={statistics.inventory} />
        </StatisticsCard>
        <StatisticsCard
          title="Usuarios por rol"
          description="Cantidad de cuentas por rol; no se muestran datos personales."
        >
          <RolesChart roles={statistics.roles} />
        </StatisticsCard>
        <StatisticsCard
          title="Préstamos"
          description="Distribución por estado actual; los vencidos son préstamos activos fuera de plazo."
        >
          <LoansChart loanStatuses={statistics.loanStatuses} />
        </StatisticsCard>
      </div>
    </section>
  );
}

export default LibraryStatistics;
