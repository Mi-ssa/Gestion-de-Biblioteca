import { useCallback, useEffect, useRef, useState } from 'react';
import BookForm from '../components/BookForm';
import ConfirmationDialog from '../components/ConfirmationDialog';
import InventoryTable from '../components/InventoryTable';
import LibraryStatistics from '../components/LibraryStatistics';
import LoanCard from '../components/LoanCard';
import SearchBar from '../components/SearchBar';
import ToastNotifications from '../components/ToastNotifications';
import UserManagement from '../components/UserManagement';
import { getWelcomeGreeting } from '../utils/welcome-greeting';
import { filterLoans } from '../utils/record-filters';
import { createReturnNotification } from '../utils/return-notification';
import { formatMxn } from '../utils/currency';

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

function LibrarianDashboard({ staffUser, books, users, loans, actions }) {
  const [section, setSection] = useState('overview');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [editingBook, setEditingBook] = useState(null);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loanUserId, setLoanUserId] = useState('');
  const [loanBookId, setLoanBookId] = useState('');
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [filters, setFilters] = useState({ titulo: '', autor: '', categoria: '', disponibilidad: '' });
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatus, setLoanStatus] = useState('');
  const [notifications, setNotifications] = useState([]);
  const nextNotificationId = useRef(0);
  const activeLoans = loans.filter((loan) => loan.estado === 'activo');
  const staffName = typeof staffUser?.nombre === 'string' ? staffUser.nombre.trim() : '';
  const initials = staffName
    ? staffName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : '';
  const categories = [...new Set(books.map((book) => book.categoria))].sort((a, b) => a.localeCompare(b));
  const filteredBooks = books.filter((book) => (
    book.titulo.toLowerCase().includes(filters.titulo.toLowerCase())
    && book.autor.toLowerCase().includes(filters.autor.toLowerCase())
    && book.categoria.toLowerCase().includes(filters.categoria.toLowerCase())
    && (filters.disponibilidad !== 'true' || book.stockDisponible > 0)
    && (filters.disponibilidad !== 'false' || book.stockDisponible === 0)
  ));
  const filteredLoans = filterLoans(loans, { query: loanSearch, status: loanStatus }, currentTime);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const notify = useCallback((notification) => {
    nextNotificationId.current += 1;
    setNotifications((current) => [
      ...current,
      { ...notification, id: nextNotificationId.current },
    ]);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const reportOperationError = useCallback((title, error) => {
    notify({
      type: 'error',
      title,
      message: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
    });
  }, [notify]);

  async function saveBook(book) {
    if (editingBook) {
      await actions.updateBook(editingBook.id, book);
      setEditingBook(null);
      notify({
        type: 'success',
        title: 'Libro actualizado',
        message: `“${book.titulo}” se actualizó correctamente.`,
      });
    } else {
      await actions.createBook(book);
      notify({
        type: 'success',
        title: 'Libro registrado',
        message: `“${book.titulo}” se agregó al inventario.`,
      });
    }
  }

  function requestBookDeletion(book) {
    setPendingDeletion({ type: 'book', item: book });
  }

  function requestUserDeletion(user) {
    setPendingDeletion({ type: 'user', item: user });
  }

  async function confirmDeletion() {
    if (!pendingDeletion || deleting) return;
    const { type, item } = pendingDeletion;
    setDeleting(true);
    try {
      if (type === 'book') {
        await actions.deleteBook(item.id);
        notify({
          type: 'success',
          title: 'Libro eliminado',
          message: `“${item.titulo}” se eliminó del inventario.`,
        });
      } else {
        await actions.deleteUser(item.id);
        notify({
          type: 'success',
          title: 'Usuario eliminado',
          message: `${item.nombre} se eliminó correctamente.`,
        });
      }
    } catch (error) {
      reportOperationError(
        type === 'book' ? 'No se pudo eliminar el libro' : 'No se pudo eliminar el usuario',
        error,
      );
    } finally {
      setPendingDeletion(null);
      setDeleting(false);
    }
  }

  async function createUser(user) {
    await actions.createUser(user);
    notify({
      type: 'success',
      title: 'Usuario registrado',
      message: `${user.nombre} se agregó correctamente.`,
    });
  }

  async function updateUser(id, user) {
    await actions.updateUser(id, user);
    notify({
      type: 'success',
      title: 'Usuario actualizado',
      message: `Los datos de ${user.nombre} se actualizaron correctamente.`,
    });
  }

  async function configureUserAccess(id, credentials) {
    await actions.configureUserAccess(id, credentials);
    const user = users.find((record) => record.id === id);
    notify({
      type: 'success',
      title: 'Acceso configurado',
      message: user ? `Se configuró el acceso de ${user.nombre}.` : 'El acceso administrativo se configuró correctamente.',
    });
  }

  async function registerFinePayment(id) {
    const payment = await actions.registerFinePayment(id);
    const user = users.find((record) => record.id === id);
    notify({
      type: 'success',
      title: 'Pago presencial registrado',
      message: `${user?.nombre || 'El usuario'}: ${formatMxn(payment.amount)} recibidos y registrados.`,
    });
    return payment;
  }

  async function createLoan(event) {
    event.preventDefault();
    setCreatingLoan(true);
    try {
      await actions.createLoan({ usuarioId: loanUserId, libroId: loanBookId });
      const borrower = users.find((user) => user.id === loanUserId);
      const book = books.find((record) => record.id === loanBookId);
      setLoanUserId('');
      setLoanBookId('');
      notify({
        type: 'success',
        title: 'Préstamo registrado',
        message: `${book ? `“${book.titulo}”` : 'El libro'} se prestó a ${borrower?.nombre || 'el usuario seleccionado'}.`,
      });
    } catch (error) {
      reportOperationError('No se pudo registrar el préstamo', error);
    } finally {
      setCreatingLoan(false);
    }
  }

  async function returnBook(loan) {
    setReturningId(loan.id);
    try {
      const result = await actions.returnLoan(loan.id);
      notify(createReturnNotification(result, { bookTitle: loan.libro?.titulo }));
    } catch (error) {
      reportOperationError('No se pudo registrar la devolución', error);
    } finally {
      setReturningId(null);
    }
  }

  return (
    <div className="admin-shell">
      <ToastNotifications notifications={notifications} onDismiss={dismissNotification} />
      {pendingDeletion && (
        <ConfirmationDialog
          title={pendingDeletion.type === 'book' ? '¿Eliminar este libro?' : '¿Eliminar este usuario?'}
          message={pendingDeletion.type === 'book'
            ? `Se eliminará “${pendingDeletion.item.titulo}” del inventario. Esta acción no se puede deshacer.`
            : `Se eliminará a ${pendingDeletion.item.nombre}. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          busyLabel="Eliminando…"
          busy={deleting}
          onConfirm={confirmDeletion}
          onCancel={() => {
            if (!deleting) setPendingDeletion(null);
          }}
        />
      )}
      <aside className="sidebar">
        <p className="sidebar-label">GESTIÓN</p>
        <nav aria-label="Navegación de gestión">
          {tabs.map((tab) => <button key={tab.id} type="button" className={`nav-item${section === tab.id ? ' nav-item--active' : ''}`} onClick={() => setSection(tab.id)}><span className="nav-icon">{tab.icon}</span>{tab.label}{tab.id === 'loans' && activeLoans.length > 0 && <span className="nav-count">{activeLoans.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom"><span className="avatar avatar--sidebar">{initials}</span><span><strong>{staffName || 'Bibliotecario/a'}</strong><small>Bibliotecario/a</small></span></div>
      </aside>
      <main className="admin-main">
        <header className="topbar"><div><span className="breadcrumb">Biblioteca</span><span className="breadcrumb-sep">/</span><strong>{tabs.find((tab) => tab.id === section)?.label}</strong></div><button className="button button--outline button--small" type="button" onClick={actions.refresh}>↻ <span>Actualizar</span></button></header>
        {section === 'overview' && (
          <section className="dashboard-content">
            <div className="welcome-row"><div><p className="eyebrow">{dateLabel}</p><h1>{getWelcomeGreeting(staffName, currentTime)} <span className="wave">✳</span></h1><p className="muted-copy">Aquí tienes el pulso de tu biblioteca hoy.</p></div><button className="button button--primary" type="button" onClick={() => setSection('loans')}>＋ Nuevo préstamo</button></div>
            <div className="stat-grid">
              <article className="stat-card stat-card--books"><span className="stat-icon">▤</span><p>Libros en catálogo</p><strong>{books.length}</strong><small>{books.reduce((sum, book) => sum + book.stockTotal, 0)} ejemplares totales</small></article>
              <article className="stat-card stat-card--available"><span className="stat-icon">✓</span><p>Disponibles ahora</p><strong>{books.reduce((sum, book) => sum + book.stockDisponible, 0)}</strong><small>Listos para préstamo</small></article>
              <article className="stat-card stat-card--loans"><span className="stat-icon">⇄</span><p>Préstamos activos</p><strong>{activeLoans.length}</strong><small>{loans.filter((loan) => loan.estado === 'activo' && new Date(loan.fechaVencimiento) < new Date()).length} vencidos</small></article>
              <article className="stat-card stat-card--users"><span className="stat-icon">♙</span><p>Usuarios registrados</p><strong>{users.length}</strong><small>Comunidad escolar</small></article>
            </div>
            <LibraryStatistics books={books} users={users} loans={loans} />
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
        {section === 'books' && <section className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">COLECCIÓN</p><h1>Inventario de libros</h1><p className="muted-copy">Administra títulos, ejemplares y disponibilidad.</p></div></div><div className="inventory-layout"><BookForm key={editingBook?.id || 'new-book'} book={editingBook} onSave={saveBook} onCancel={() => setEditingBook(null)} onOperationError={reportOperationError} /><section className="panel inventory-panel"><div className="panel-heading"><div><p className="eyebrow">CATÁLOGO COMPLETO</p><h2>Libros registrados</h2></div><span className="count-badge">{books.length}</span></div><SearchBar onSearch={setFilters} categories={categories} compact /><InventoryTable books={filteredBooks} onEdit={setEditingBook} onDelete={requestBookDeletion} /></section></div></section>}
        {section === 'loans' && <section className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">CIRCULACIÓN</p><h1>Préstamos y devoluciones</h1><p className="muted-copy">Controla préstamos activos, vencimientos y devoluciones.</p></div></div><div className="loans-layout"><form className="form-card loan-form" onSubmit={createLoan}><p className="eyebrow">NUEVA OPERACIÓN</p><h2>Registrar préstamo</h2><label>Usuario<select value={loanUserId} onChange={(event) => setLoanUserId(event.target.value)} required><option value="">Selecciona usuario</option>{users.filter((user) => user.rol !== 'bibliotecario').map((user) => <option key={user.id} value={user.id}>{user.nombre} · {user.rol}</option>)}</select></label><label>Libro<select value={loanBookId} onChange={(event) => setLoanBookId(event.target.value)} required><option value="">Selecciona libro disponible</option>{books.filter((book) => book.stockDisponible > 0).map((book) => <option key={book.id} value={book.id}>{book.titulo} · {book.stockDisponible} disponibles</option>)}</select></label><p className="form-hint">Duración del préstamo: 14 días. Límite: 3 libros por estudiante y 5 por docente.</p><button className="button button--primary" type="submit" disabled={creatingLoan}>{creatingLoan ? 'Registrando…' : 'Registrar préstamo'}</button></form><section className="panel loan-list-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORIAL</p><h2>Todos los préstamos</h2></div><span className="count-badge">{filteredLoans.length} / {loans.length}</span></div><div className="record-filters record-filters--loans"><label>Buscar préstamo<input type="search" value={loanSearch} onChange={(event) => setLoanSearch(event.target.value)} placeholder="Usuario o título del libro" /></label><label>Estado<select value={loanStatus} onChange={(event) => setLoanStatus(event.target.value)}><option value="">Todos los estados</option><option value="activo">Activo</option><option value="vencido">Vencido</option><option value="devuelto">Devuelto</option></select></label><button className="button button--quiet" type="button" onClick={() => { setLoanSearch(''); setLoanStatus(''); }}>Limpiar filtros</button></div><div className="loan-list">{filteredLoans.map((loan) => <LoanCard key={loan.id} loan={loan} onReturn={returnBook} returning={returningId === loan.id} />)}{!loans.length && <p className="muted-copy">No hay préstamos todavía.</p>}{loans.length > 0 && !filteredLoans.length && <p className="empty-state">No hay préstamos que coincidan con la búsqueda y los filtros.</p>}</div></section></div></section>}
        {section === 'users' && <section className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">COMUNIDAD ESCOLAR</p><h1>Gestión de usuarios</h1><p className="muted-copy">Registra estudiantes, docentes y personal bibliotecario.</p></div></div><UserManagement users={users} onCreate={createUser} onUpdate={updateUser} onDelete={requestUserDeletion} onConfigureAccess={configureUserAccess} onRegisterFinePayment={registerFinePayment} onOperationError={reportOperationError} /></section>}
      </main>
    </div>
  );
}

export default LibrarianDashboard;
