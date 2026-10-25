import { useCallback, useEffect, useState } from 'react';
import { api } from './services/api';
import LibrarianDashboard from './pages/LibrarianDashboard';
import PublicCatalog from './pages/PublicCatalog';
import './App.css';

function App() {
  const [view, setView] = useState('management');
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [filters, setFilters] = useState({ titulo: '', autor: '', categoria: '', disponibilidad: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextBooks, nextUsers, nextLoans] = await Promise.all([
        api.books.list(),
        api.users.list(),
        api.loans.list(),
      ]);
      setBooks(nextBooks);
      setUsers(nextUsers);
      setLoans(nextLoans);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.books.list(), api.users.list(), api.loans.list()])
      .then(([nextBooks, nextUsers, nextLoans]) => {
        if (cancelled) return;
        setBooks(nextBooks);
        setUsers(nextUsers);
        setLoans(nextLoans);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
    updateUser: (id, user) => refreshAfter(api.users.update(id, user)),
    deleteUser: (id) => refreshAfter(api.users.remove(id)),
    createLoan: (loan) => refreshAfter(api.loans.create(loan)),
    returnLoan: (id) => refreshAfter(api.loans.returnBook(id)),
  };

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
      <div className="view-switcher" role="navigation" aria-label="Cambiar vista">
        <button className={view === 'management' ? 'switch-button switch-button--active' : 'switch-button'} type="button" onClick={() => setView('management')}>Gestión</button>
        <button className={view === 'catalog' ? 'switch-button switch-button--active' : 'switch-button'} type="button" onClick={() => setView('catalog')}>Catálogo público</button>
      </div>
      {error && <div className="global-error" role="alert"><span>⚠</span><div><strong>No se pudo cargar la biblioteca</strong><p>{error}</p></div><button type="button" onClick={refresh}>Reintentar</button></div>}
      {view === 'management'
        ? <LibrarianDashboard books={books} users={users} loans={loans} actions={actions} />
        : <PublicCatalog books={catalogBooks} categories={[...new Set(books.map((book) => book.categoria))].sort((a, b) => a.localeCompare(b))} setFilters={setFilters} />}
    </div>
  );
}

export default App;
