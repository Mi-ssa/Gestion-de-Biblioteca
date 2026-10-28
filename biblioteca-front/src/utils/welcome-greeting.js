export function getWelcomeGreeting(name, date = new Date()) {
  const hour = date.getHours();
  const greeting = hour >= 5 && hour < 12
    ? 'Buenos días'
    : hour >= 12 && hour < 19
      ? 'Buenas tardes'
      : 'Buenas noches';
  const displayName = typeof name === 'string' ? name.trim() : '';

  return displayName ? `${greeting}, ${displayName}` : 'Bienvenido/a a Entrelíneas';
}
