function InventoryTable({ books, onEdit, onDelete }) {
  if (!books.length) {
    return <div className="empty-state"><span className="empty-icon">▤</span><h3>No hay libros registrados</h3><p>Agrega un libro para comenzar a administrar el inventario.</p></div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Libro</th><th>ISBN</th><th>Categoría</th><th>Disponibles</th><th>Stock total</th><th aria-label="Acciones" /></tr></thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id}>
              <td><div className="table-book"><span className="book-cover">B</span><span><strong>{book.titulo}</strong><small>{book.autor}</small></span></div></td>
              <td className="muted-cell">{book.isbn}</td>
              <td><span className="category-chip">{book.categoria}</span></td>
              <td><span className={`stock-number${book.stockDisponible === 0 ? ' stock-number--empty' : ''}`}>{book.stockDisponible}</span></td>
              <td className="muted-cell">{book.stockTotal}</td>
              <td><div className="row-actions"><button className="text-button" type="button" onClick={() => onEdit(book)}>Editar</button><button className="text-button text-button--danger" type="button" onClick={() => onDelete(book)}>Eliminar</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default InventoryTable;
