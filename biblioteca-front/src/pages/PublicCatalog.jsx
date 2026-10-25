import SearchBar from '../components/SearchBar';

function PublicCatalog({ books, categories, setFilters }) {
  return (
    <main className="public-page">
      <section className="catalog-hero">
        <div className="hero-orbit hero-orbit--one" /><div className="hero-orbit hero-orbit--two" />
        <p className="eyebrow eyebrow--light">BIBLIOTECA ESCOLAR · CATÁLOGO ABIERTO</p>
        <h1>Un buen libro<br />abre <em>nuevos mundos.</em></h1>
        <p className="hero-copy">Explora nuestra colección y encuentra tu próxima lectura favorita.</p>
        <div className="hero-stats"><span><strong>{books.length}</strong> títulos en catálogo</span><span><strong>{books.filter((book) => book.stockDisponible > 0).length}</strong> disponibles hoy</span></div>
        <span className="hero-book hero-book--a">A</span><span className="hero-book hero-book--b">B</span><span className="hero-book hero-book--c">C</span>
      </section>
      <section className="catalog-content">
        <div className="catalog-title"><div><p className="eyebrow">ENCUENTRA TU PRÓXIMA LECTURA</p><h2>Explora el catálogo</h2></div><span className="results-count">{books.length} resultados</span></div>
        <SearchBar onSearch={setFilters} categories={categories} />
        {books.length ? (
          <div className="catalog-grid">
            {books.map((book, index) => (
              <article className="catalog-card" key={book.id}>
                <div className={`catalog-cover catalog-cover--${index % 4}`}><span className="cover-mark">BIBLIOTECA<br />ESCOLAR</span><span className="cover-initial">{book.titulo.slice(0, 1)}</span><span className="cover-spine" /></div>
                <div className="catalog-card-body"><span className="category-chip">{book.categoria}</span><h3>{book.titulo}</h3><p className="book-author">{book.autor}</p><div className="availability"><span className={book.stockDisponible ? 'availability-dot' : 'availability-dot availability-dot--off'} />{book.stockDisponible ? `${book.stockDisponible} ejemplares disponibles` : 'No disponible por ahora'}</div></div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><span className="empty-icon">⌕</span><h3>No encontramos libros</h3><p>Prueba con otro título, autor o filtro.</p></div>}
      </section>
      <footer className="site-footer"><span>◈ Biblioteca escolar</span><span>Un espacio para aprender, imaginar y crecer.</span></footer>
    </main>
  );
}

export default PublicCatalog;
