import { useState } from 'react';

const blank = { nombre: '', email: '', rol: 'estudiante' };
const roleLabel = { estudiante: 'Estudiante', docente: 'Docente', bibliotecario: 'Bibliotecario' };

function UserManagement({ users, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(blank);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        await onUpdate(editingUser.id, form);
      } else {
        await onCreate(form);
      }
      setForm(blank);
      setEditingUser(null);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="user-layout">
      <form className="form-card user-form" onSubmit={submit}>
        <p className="eyebrow">DIRECTORIO</p>
        <h2>{editingUser ? 'Editar usuario' : 'Registrar usuario'}</h2>
        <label>Nombre completo<input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} required /></label>
        <label>Correo electrónico<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label>Rol<select value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value })}><option value="estudiante">Estudiante</option><option value="docente">Docente</option><option value="bibliotecario">Bibliotecario</option></select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Agregar usuario'}</button>
        {editingUser && <button className="button button--outline" type="button" onClick={() => { setEditingUser(null); setForm(blank); }}>Cancelar edición</button>}
      </form>
      <section className="panel users-panel">
        <div className="panel-heading"><div><p className="eyebrow">COMUNIDAD</p><h2>Usuarios registrados</h2></div><span className="count-badge">{users.length}</span></div>
        <div className="user-list">
          {users.map((user) => (
            <article className="user-row" key={user.id}>
              <span className="avatar">{user.nombre.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div className="user-data"><strong>{user.nombre}</strong><small>{user.email}</small></div>
              <span className={`role-badge role-badge--${user.rol}`}>{roleLabel[user.rol]}</span>
              <div className="row-actions">
                <button className="text-button" type="button" onClick={() => { setEditingUser(user); setForm({ nombre: user.nombre, email: user.email, rol: user.rol }); }}>Editar</button>
                <button className="icon-button icon-button--danger" type="button" onClick={async () => { try { await onDelete(user.id); } catch (deleteError) { window.alert(deleteError.message); } }} aria-label={`Eliminar a ${user.nombre}`}>×</button>
              </div>
            </article>
          ))}
          {!users.length && <p className="muted-copy">Todavía no hay usuarios.</p>}
        </div>
      </section>
    </div>
  );
}

export default UserManagement;
