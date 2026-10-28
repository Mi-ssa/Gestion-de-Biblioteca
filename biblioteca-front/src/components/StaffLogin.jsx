import { useState } from 'react';

function StaffLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onLogin({ email, password });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="staff-login-page">
      <form className="staff-login-card" onSubmit={submit}>
        <p className="eyebrow">ACCESO RESTRINGIDO</p>
        <h1>Gestión de biblioteca</h1>
        <p className="muted-copy">Inicia sesión con una cuenta autorizada del personal.</p>
        <label htmlFor="staff-email">Correo del personal</label>
        <input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="staff-password">Contraseña</label>
        <input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="staff-login-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? 'Verificando…' : 'Iniciar sesión'}
        </button>
      </form>
    </main>
  );
}

export default StaffLogin;
