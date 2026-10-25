const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/prueba', (req, res) => {
    res.json({ mensaje: "¡Backend de la Biblioteca conectado con éxito!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
