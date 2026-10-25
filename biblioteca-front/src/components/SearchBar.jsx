import { useState } from 'react';

const initialFilters = { titulo: '', autor: '', categoria: '', disponibilidad: '' };

function SearchBar({ onSearch, categories, compact = false }) {
  const [filters, setFilters] = useState(initialFilters);

  function handleChange(event) {
    const { name, value } = event.target;
    const nextFilters = { ...filters, [name]: value };
    setFilters(nextFilters);
    onSearch(nextFilters);
  }

  function clearFilters() {
    setFilters({ ...initialFilters });
    onSearch({ ...initialFilters });
  }

  return (
    <form className={`search-bar${compact ? ' search-bar--compact' : ''}`} onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>Título</span>
        <input name="titulo" value={filters.titulo} onChange={handleChange} placeholder="Buscar título" />
      </label>
      <label>
        <span>Autor</span>
        <input name="autor" value={filters.autor} onChange={handleChange} placeholder="Buscar autor" />
      </label>
      <label>
        <span>Categoría</span>
        <select name="categoria" value={filters.categoria} onChange={handleChange}>
          <option value="">Todas las categorías</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label>
        <span>Disponibilidad</span>
        <select name="disponibilidad" value={filters.disponibilidad} onChange={handleChange}>
          <option value="">Cualquier estado</option>
          <option value="true">Disponibles</option>
          <option value="false">Agotados</option>
        </select>
      </label>
      <button className="button button--quiet" type="button" onClick={clearFilters}>
        Limpiar filtros
      </button>
    </form>
  );
}

export default SearchBar;
