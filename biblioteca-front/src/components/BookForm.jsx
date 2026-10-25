import { useState } from 'react';

const emptyBook = { isbn: '', titulo: '', autor: '', categoria: '', stockTotal: 1 };

function BookForm({ book, onSave, onCancel }) {
  const [form, setForm] = useState(book ? {
    isbn: book.isbn,
    titulo: book.titulo,
    autor: book.autor,
    categoria: book.categoria,
    stockTotal: book.stockTotal,
  } : emptyBook);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, stockTotal: Number(form.stockTotal) });
      setForm(emptyBook);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{book ? 'ACTUALIZAR REGISTRO' : 'NUEVO REGISTRO'}</p>
          <h2>{book ? 'Editar libro' : 'Agregar un libro'}</h2>
        </div>
        {book && <button type="button" className="icon-button" onClick={onCancel} aria-label="Cancelar edición">×</button>}
      </div>
      <div className="form-grid">
        <label>ISBN<input name="isbn" value={form.isbn} onChange={update} required /></label>
        <label>Título<input name="titulo" value={form.titulo} onChange={update} required /></label>
        <label>Autor<input name="autor" value={form.autor} onChange={update} required /></label>
        <label>Categoría<input name="categoria" value={form.categoria} onChange={update} required /></label>
        <label>Stock total<input name="stockTotal" type="number" min="0" step="1" value={form.stockTotal} onChange={update} required /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button--primary" type="submit" disabled={saving}>
        {saving ? 'Guardando…' : book ? 'Guardar cambios' : 'Crear libro'}
      </button>
    </form>
  );
}

export default BookForm;
