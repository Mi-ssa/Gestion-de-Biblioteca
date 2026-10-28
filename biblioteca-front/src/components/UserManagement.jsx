import { useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog';
import { filterUsers } from '../utils/record-filters';
import { formatMxn } from '../utils/currency';
import { formatBlockUntil, getUserBlockDetails } from '../utils/user-block-status';

const blank = { nombre: '', email: '', rol: 'estudiante' };
const roleLabel = { estudiante: 'Estudiante', docente: 'Docente', bibliotecario: 'Bibliotecario' };

function UserManagement({
  users,
  onCreate,
  onUpdate,
  onDelete,
  onConfigureAccess,
  onRegisterFinePayment,
  onOperationError,
}) {
  const [form, setForm] = useState(blank);
  const [createAccess, setCreateAccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [accessUserId, setAccessUserId] = useState(null);
  const [accessPassword, setAccessPassword] = useState('');
  const [accessPasswordConfirmation, setAccessPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [paymentUser, setPaymentUser] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const filteredUsers = filterUsers(users, { query: searchQuery, role: roleFilter });

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await onUpdate(editingUser.id, form);
      } else {
        await onCreate({
          ...form,
          ...(createAccess ? { crearAcceso: true, password, confirmPassword } : {}),
        });
      }
      setForm(blank);
      setEditingUser(null);
      setCreateAccess(false);
      setPassword('');
      setConfirmPassword('');
    } catch (saveError) {
      onOperationError(
        editingUser ? 'No se pudo actualizar el usuario' : 'No se pudo registrar el usuario',
        saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function configureAccess(event, userId) {
    event.preventDefault();
    setSavingAccess(true);
    try {
      await onConfigureAccess(userId, {
        password: accessPassword,
        confirmPassword: accessPasswordConfirmation,
      });
      setAccessUserId(null);
      setAccessPassword('');
      setAccessPasswordConfirmation('');
    } catch (configureError) {
      onOperationError('No se pudo configurar el acceso', configureError);
    } finally {
      setSavingAccess(false);
    }
  }

  async function confirmFinePayment() {
    if (!paymentUser || recordingPayment) return;
    setRecordingPayment(true);
    try {
      await onRegisterFinePayment(paymentUser.id);
      setPaymentUser(null);
    } catch (paymentError) {
      onOperationError('No se pudo registrar el pago presencial', paymentError);
    } finally {
      setRecordingPayment(false);
    }
  }

  return (
    <div className="user-layout">
      {paymentUser && (
        <ConfirmationDialog
          title="Confirmar pago presencial"
          message={`Confirma que recibiste presencialmente ${formatMxn(paymentUser.deudaPendiente)} de ${paymentUser.nombre} para liquidar sus multas pendientes.`}
          confirmLabel="Confirmar pago recibido"
          busyLabel="Registrando pago…"
          busy={recordingPayment}
          onConfirm={confirmFinePayment}
          onCancel={() => {
            if (!recordingPayment) setPaymentUser(null);
          }}
        />
      )}
      <form className="form-card user-form" onSubmit={submit}>
        <p className="eyebrow">DIRECTORIO</p>
        <h2>{editingUser ? 'Editar usuario' : 'Registrar usuario'}</h2>
        <label>Nombre completo<input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} required /></label>
        <label>Correo electrónico<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label>Rol<select value={form.rol} onChange={(event) => {
          const rol = event.target.value;
          setForm({ ...form, rol });
          if (rol !== 'bibliotecario') {
            setCreateAccess(false);
            setPassword('');
            setConfirmPassword('');
          }
        }}><option value="estudiante">Estudiante</option><option value="docente">Docente</option><option value="bibliotecario">Bibliotecario</option></select></label>
        {!editingUser && form.rol === 'bibliotecario' && (
          <>
            <label className="user-access-toggle">
              <input
                type="checkbox"
                checked={createAccess}
                onChange={(event) => {
                  setCreateAccess(event.target.checked);
                  setPassword('');
                  setConfirmPassword('');
                }}
              />
              Crear acceso al panel administrativo
            </label>
            {createAccess && (
              <>
                <label>Contraseña inicial<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
              </>
            )}
          </>
        )}
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Agregar usuario'}</button>
        {editingUser && <button className="button button--outline" type="button" onClick={() => { setEditingUser(null); setForm(blank); }}>Cancelar edición</button>}
      </form>
      <section className="panel users-panel">
        <div className="panel-heading"><div><p className="eyebrow">COMUNIDAD</p><h2>Usuarios registrados</h2></div><span className="count-badge">{users.length}</span></div>
        <div className="record-filters">
          <label>Buscar usuario<input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nombre, correo o ID" /></label>
          <label>Rol<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">Todos los roles</option><option value="estudiante">Estudiante</option><option value="docente">Docente</option><option value="bibliotecario">Bibliotecario</option></select></label>
          <button className="button button--quiet" type="button" onClick={() => { setSearchQuery(''); setRoleFilter(''); }}>Limpiar filtros</button>
        </div>
        <div className="user-list">
          {filteredUsers.map((user) => {
            const blockDetails = getUserBlockDetails(user);
            return (
              <article className="user-row" key={user.id}>
                <div className="user-row-main">
                  <span className="avatar">{user.nombre.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <div className="user-data"><strong>{user.nombre}</strong><small>{user.email}</small></div>
                  <span className={`role-badge role-badge--${user.rol}`}>{roleLabel[user.rol]}</span>
                  <div className="row-actions">
                    <button className="text-button" type="button" onClick={() => { setEditingUser(user); setCreateAccess(false); setPassword(''); setConfirmPassword(''); setForm({ nombre: user.nombre, email: user.email, rol: user.rol }); }}>Editar</button>
                    {user.rol === 'bibliotecario' && !user.hasAdminAccess && (
                      <button className="text-button" type="button" onClick={() => { setAccessUserId(accessUserId === user.id ? null : user.id); setAccessPassword(''); setAccessPasswordConfirmation(''); }}>Configurar acceso</button>
                    )}
                      <button className="icon-button icon-button--danger" type="button" onClick={() => onDelete(user)} aria-label={`Eliminar a ${user.nombre}`}>×</button>
                  </div>
                </div>
                {blockDetails.isBorrower && (blockDetails.blocked || blockDetails.pendingDebt > 0) && (
                  <div className="user-block-info" role="status">
                    <span className="user-block-badge">Bloqueado</span>
                    {blockDetails.blockedUntil && (
                      <span>Fin del bloqueo temporal: <time dateTime={blockDetails.blockedUntil.toISOString()}>{formatBlockUntil(blockDetails.blockedUntil)}</time></span>
                    )}
                    {blockDetails.pendingDebt > 0 && (
                      <>
                        <span>Deuda pendiente: <strong>{formatMxn(blockDetails.pendingDebt)}</strong></span>
                        {blockDetails.canRegisterFinePayment && (
                          <button
                            className="button button--outline button--small"
                            type="button"
                            onClick={() => setPaymentUser(user)}
                          >
                            Registrar pago presencial
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                {accessUserId === user.id && (
                  <form className="user-access-form" onSubmit={(event) => configureAccess(event, user.id)}>
                    <strong>Configurar acceso administrativo</strong>
                    <label>Contraseña inicial<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} required /></label>
                    <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={accessPasswordConfirmation} onChange={(event) => setAccessPasswordConfirmation(event.target.value)} required /></label>
                    <button className="button button--primary button--small" type="submit" disabled={savingAccess}>{savingAccess ? 'Guardando…' : 'Guardar acceso'}</button>
                  </form>
                )}
              </article>
            );
          })}
          {!users.length && <p className="muted-copy">Todavía no hay usuarios.</p>}
          {users.length > 0 && !filteredUsers.length && <p className="empty-state">No hay usuarios que coincidan con la búsqueda y los filtros.</p>}
        </div>
      </section>
    </div>
  );
}

export default UserManagement;
