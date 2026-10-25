const express = require('express');
const cors = require('cors');
const path = require('node:path');
const booksRoutes = require('./src/routes/books.routes');
const usersRoutes = require('./src/routes/users.routes');
const loansRoutes = require('./src/routes/loans.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'biblioteca-api' });
});
app.use('/api/libros', booksRoutes);
app.use('/api/usuarios', usersRoutes);
app.use('/api/prestamos', loansRoutes);
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor de biblioteca disponible en http://localhost:${PORT}`);
    console.log(`Datos JSON: ${path.join(__dirname, 'src/data')}`);
  });
}

module.exports = app;
