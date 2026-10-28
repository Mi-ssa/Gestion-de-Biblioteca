import { useCallback, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './services/api';
import LibrarianDashboard from './pages/LibrarianDashboard';
import PublicCatalog from './pages/PublicCatalog';
import StaffLogin from './components/StaffLogin';
import './App.css';

function App() {
  const [view, setView] = useState('management');
  const [dashboardKey, setDashboardKey] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [staffUser, setStaffUser] = useState(null);
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [filters, setFilters] = useState({ titulo: '', autor: '', categoria: '', disponibilidad: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadManagement = useCallback(async () => {
    const [nextBooks, nextUsers, nextLoans] = await Promise.all([
      api.books.list(),
      api.users.list(),
      api.loans.list(),
    ]);
    setBooks(nextBooks);
    setUsers(nextUsers);
    setLoans(nextLoans);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthenticated(false);
      setStaffUser(null);
      setUsers([]);
      setLoans([]);
      setView('catalog');
      setError('La sesión expiró. Inicia sesión de nuevo para continuar con la gestión.');
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    try {
      if (authenticated) {
        await loadManagement();
      } else {
        setBooks(await api.books.list());
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [authenticated, loadManagement]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const session = await api.auth.current();
        if (cancelled) return;
        setAuthenticated(session.authenticated);
        setStaffUser(session.user || null);
        if (session.authenticated) {
          setView('management');
          await loadManagement();
        } else {
          setView('catalog');
          setBooks(await api.books.list());
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initialize();
    return () => { cancelled = true; };
  }, [loadManagement]);

  const refreshAfter = useCallback(async (operation) => {
    const result = await operation;
    await refresh();
    return result;
  }, [refresh]);

  const actions = {
    refresh,
    createBook: (book) => refreshAfter(api.books.create(book)),
    updateBook: (id, book) => refreshAfter(api.books.update(id, book)),
    deleteBook: (id) => refreshAfter(api.books.remove(id)),
    createUser: (user) => refreshAfter(api.users.create(user)),
    configureUserAccess: (id, credentials) => refreshAfter(api.users.configureAccess(id, credentials)),
    registerFinePayment: (id) => refreshAfter(api.users.registerFinePayment(id)),
    updateUser: (id, user) => refreshAfter(api.users.update(id, user)),
    deleteUser: (id) => refreshAfter(api.users.remove(id)),
    createLoan: (loan) => refreshAfter(api.loans.create(loan)),
    returnLoan: (id) => refreshAfter(api.loans.returnBook(id)),
  };

  const goManagement = () => {
    setView('management');
    setDashboardKey((key) => key + 1);
  };

  async function login(credentials) {
    const session = await api.auth.login(credentials);
    setAuthenticated(true);
    setStaffUser(session.user);
    setView('management');
    setDashboardKey((key) => key + 1);
    setError('');
    try {
      await loadManagement();
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function logout() {
    setError('');
    try {
      await api.auth.logout();
      setAuthenticated(false);
      setStaffUser(null);
      setUsers([]);
      setLoans([]);
      setView('catalog');
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  const catalogBooks = books.filter((book) => (
    book.titulo.toLocaleLowerCase().includes(filters.titulo.toLocaleLowerCase())
    && book.autor.toLocaleLowerCase().includes(filters.autor.toLocaleLowerCase())
    && book.categoria.toLocaleLowerCase().includes(filters.categoria.toLocaleLowerCase())
    && (filters.disponibilidad !== 'true' || book.stockDisponible > 0)
    && (filters.disponibilidad !== 'false' || book.stockDisponible === 0)
  ));

  if (loading) return <div className="app-loading"><span className="loader" /><p>Preparando la biblioteca…</p></div>;

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand app-brand" type="button" onClick={() => (authenticated ? goManagement() : setView('catalog'))} aria-label="Ir al inicio de la biblioteca">
          <span className="brand-mark">◈</span>
          <span>entre<span className="brand-accent">líneas</span><small>BIBLIOTECA ESCOLAR</small></span>
        </button>
        <nav className="app-navigation" aria-label="Secciones principales">
          <button className={view === 'management' ? 'switch-button switch-button--active' : 'switch-button'} type="button" aria-current={view === 'management' ? 'page' : undefined} onClick={goManagement}>Gestión</button>
          <button className={view === 'catalog' ? 'switch-button switch-button--active' : 'switch-button'} type="button" aria-current={view === 'catalog' ? 'page' : undefined} onClick={() => setView('catalog')}>Catálogo público</button>
        </nav>
        {authenticated && <button className="button button--outline button--small" type="button" onClick={logout}><span className="logout-label">Cerrar sesión</span><span className="logout-label-short">Salir</span></button>}
      </header>
      {error && <div className="global-error" role="alert"><span>⚠</span><div><strong>No se pudo cargar la biblioteca</strong><p>{error}</p></div><button type="button" onClick={refresh}>Reintentar</button></div>}
      {view === 'management'
        ? authenticated
          ? <LibrarianDashboard key={dashboardKey} staffUser={staffUser} books={books} users={users} loans={loans} actions={actions} />
          : <StaffLogin onLogin={login} />
        : <PublicCatalog books={catalogBooks} categories={[...new Set(books.map((book) => book.categoria))].sort((a, b) => a.localeCompare(b))} setFilters={setFilters} />}
    </div>
  );
}

export default App;
