import { useState } from 'react';
import BookForm from '../components/BookForm';
import InventoryTable from '../components/InventoryTable';
import LoanCard from '../components/LoanCard';
import SearchBar from '../components/SearchBar';
import UserManagement from '../components/UserManagement';

const dateLabel = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date()).toLocaleUpperCase('es-MX');

const tabs = [
  { id: 'overview', label: 'Resumen', icon: '▦' },
  { id: 'books', label: 'Inventario', icon: '▤' },
  { id: 'loans', label: 'Préstamos', icon: '⇄' },
  { id: 'users', label: 'Usuarios', icon: '♙' },
];

function LibrarianDashboard({ books, users, loans, actions }) {
  const [section, setSection] = useState('overview');
  const [editingBook, setEditingBook] = useState(null);
  const [loanUserId, setLoanUserId] = useState('');
  const [loanBookId, setLoanBookId] = useState('');
  const [loanError, setLoanError] = useState('');
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [filters, setFilters] = useState({ titulo: '', autor: '', categoria: '', disponibilidad: '' });
  const activeLoans = loans.filter((loan) => loan.estado === 'activo');
  const categories = [...new Set(books.map((book) => book.categoria))].sort((a, b) => a.localeCompare(b));
  const filteredBooks = books.filter((book) => (
    book.titulo.toLowerCase().includes(filters.titulo.toLowerCase())
    && book.autor.toLowerCase().includes(filters.autor.toLowerCase())
    && book.categoria.toLowerCase().includes(filters.categoria.toLowerCase())
    && (filters.disponibilidad !== 'true' || book.stockDisponible > 0)
    && (filters.disponibilidad !== 'false' || book.stockDisponible === 0)
  ));

  async function saveBook(book) {
    if (editingBook) {
      await actions.updateBook(editingBook.id, book);
      setEditingBook(null);
    } else {
      await actions.createBook(book);
    }
  }

  async function deleteBook(book) {
    if (window.confirm(`¿Eliminar “${book.titulo}” del inventario?`)) {
      try {
        await actions.deleteBook(book.id);
      } catch (error) {
        window.alert(error.message);
      }
    }
  }

  async function createLoan(event) {
    event.preventDefault();
    setCreatingLoan(true);
    setLoanError('');
    try {
      await actions.createLoan({ usuarioId: loanUserId, libroId: loanBookId });
      setLoanUserId('');
      setLoanBookId('');
    } catch (error) {
      setLoanError(error.message);
    } finally {
      setCreatingLoan(false);
    }
  }

  async function returnBook(loan) {
    setReturningId(loan.id);
    try {
      const result = await actions.returnLoan(loan.id);
      const info = result.multa > 0
        ? `Devolución registrada. Retraso: ${result.diasRetraso} días. Multa: $${result.multa.toFixed(2)}.${result.usuarioBloqueadoHasta ? ` Usuario bloqueado hasta ${new Date(result.usuarioBloqueadoHasta).toLocaleDateString('es-MX')}.` : ''}`
        : 'Devolución registrada sin multa.';
      window.alert(info);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setReturningId(null);
    }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <p className="sidebar-label">GESTIÓN</p>
        <nav aria-label="Navegación de gestión">
          {tabs.map((tab) => <button key={tab.id} type="button" className={`nav-item${section === tab.id ? ' nav-item--active' : ''}`} onClick={() => setSection(tab.id)}><span className="nav-icon">{tab.icon}</span>{tab.label}{tab.id === 'loans' && activeLoans.length > 0 && <span className="nav-count">{activeLoans.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom"><span className="avatar avatar--sidebar">LF</span><span><strong>Lucía Fernández</strong><small>Bibliotecaria</small></span></div>
      </aside>
      <main className="admin-main">
        <header className="topbar"><div><span className="breadcrumb">Biblioteca</span><span className="breadcrumb-sep">/</span><strong>{tabs.find((tab) => tab.id === section)?.label}</strong></div><button className="button button--outline button--small" type="button" onClick={actions.refresh}>↻ <span>Actualizar</span></button></header>
        {section === 'overview' && (
          <section className="dashboard-content">
            <div className="welcome-row"><div><p className="eyebrow">{dateLabel}</p><h1>Buenos días, Lucía <span className="wave">✳</span></h1><p className="muted-copy">Aquí tienes el pulso de tu biblioteca hoy.</p></div><button className="button button--primary" type="button" onClick={() => setSection('loans')}>＋ Nuevo préstamo</button></div>
            <div className="stat-grid">
              <article className="stat-card stat-card--books"><span className="stat-icon">▤</span><p>Libros en catálogo</p><strong>{books.length}</strong><small>{books.reduce((sum, book) => sum + book.stockTotal, 0)} ejemplares totales</small></article>
              <article className="stat-card stat-card--available"><span className="stat-icon">✓</span><p>Disponibles ahora</p><strong>{books.reduce((sum, book) => sum + book.stockDisponible, 0)}</strong><small>Listos para préstamo</small></article>
              <article className="stat-card stat-card--loans"><span className="stat-icon">⇄</span><p>Préstamos activos</p><strong>{activeLoans.length}</strong><small>{loans.filter((loan) => loan.estado === 'activo' && new Date(loan.fechaVencimiento) < new Date()).length} vencidos</small></article>
              <article className="stat-card stat-card--users"><span className="stat-icon">♙</span><p>Usuarios registrados</p><strong>{users.length}</strong><small>Comunidad escolar</small></article>
            </div>
            <div className="overview-grid">
              <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">MOVIMIENTO</p><h2>Préstamos recientes</h2></div><button className="text-button" type="button" onClick={() => setSection('loans')}>Ver todos →</button></div>
                {loans.slice(0, 4).map((loan) => <LoanCard key={loan.id} loan={loan} onReturn={returnBook} returning={returningId === loan.id} />)}
                {!loans.length && <p className="muted-copy">Aún no hay préstamos registrados.</p>}
              </section>
              <section className="panel popular-panel"><div className="panel-heading"><div><p className="eyebrow">COLECCIÓN</p><h2>Disponibilidad</h2></div><span className="panel-icon">◈</span></div>
                {books.slice(0, 5).map((book) => <div className="availability-row" key={book.id}><div><strong>{book.titulo}</strong><small>{book.autor}</small></div><span className={book.stockDisponible ? 'mini-stock' : 'mini-stock mini-stock--zero'}>{book.stockDisponible}/{book.stockTotal}</span></div>)}
              </section>
            </div>
          </section>
        )}
        {section === 'books' && <section className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">COLECCIÓN</p><h1>Inventario de libros</h1><p className="muted-copy">Administra títulos, ejemplares y disponibilidad.</p></div></div><div className="inventory-layout"><BookForm key={editingBook?.id || 'new-book'} book={editingBook} onSave={saveBook} onCancel={() => setEditingBook(null)} /><section className="panel inventory-panel"><div className="panel-heading"><div><p className="eyebrow">CATÁLOGO COMPLETO</p><h2>Libros registrados</h2></div><span className="count-badge">{books.length}</span></div><SearchBar onSearch={setFilters} categories={categories} compact /><InventoryTable books={filteredBooks} onEdit={setEditingBook} onDelete={deleteBook} /></section></div></section>}
        {section === 'loans' && <section className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">CIRCULACIÓN</p><h1>Préstamos y devoluciones</h1><p className="muted-copy">Controla préstamos activos, vencimientos y devoluciones.</p></div></div><div className="loans-layout"><form className="form-card loan-form" onSubmit={createLoan}><p className="eyebrow">NUEVA OPERACIÓN</p><h2>Registrar préstamo</h2><label>Usuario<select value={loanUserId} onChange={(event) => setLoanUserId(event.target.value)} required><option value="">Selecciona usuario</option>{users.filter((user) => user.rol !== 'bibliotecario').map((user) => <option key={user.id} value={user.id}>{user.nombre} · {user.rol}</option>)}</select></label><label>Libro<select value={loanBookId} onChange={(event) => setLoanBookId(event.target.value)} required><option value="">Selecciona libro disponible</option>{books.filter((book) => book.stockDisponible > 0).map((book) => <option key={book.id} value={book.id}>{book.titulo} · {book.stockDisponible} disponibles</option>)}</select></label>{loanError && <p className="form-error" role="alert">{loanError}</p>}<p className="form-hint">Duración del préstamo: 14 días. Límite: 3 libros por estudiante y 5 por docente.</p><button className="button button--primary" type="submit" disabled={creatingLoan}>{creatingLoan ? 'Registrando…' : 'Registrar préstamo'}</button></form><section className="panel loan-list-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORIAL</p><h2>Todos los préstamos</h2></div><span className="count-badge">{loans.length}</span></div><div className="loan-list">{loans.map((loan) => <LoanCard key={loan.id} loan={loan} onReturn={returnBook} returning={returningId === loan.id} />)}{!loans.length && <p className="muted-copy">No hay préstamos todavía.</p>}</div></section></div></section>}
        {section === 'users' && <section className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">COMUNIDAD ESCOLAR</p><h1>Gestión de usuarios</h1><p className="muted-copy">Registra estudiantes, docentes y personal bibliotecario.</p></div></div><UserManagement users={users} onCreate={actions.createUser} onUpdate={actions.updateUser} onDelete={actions.deleteUser} /></section>}
      </main>
    </div>
  );
}

export default LibrarianDashboard;
