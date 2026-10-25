function sendError(res, error) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
}

module.exports = { sendError };
