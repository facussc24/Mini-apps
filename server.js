const express = require('express');
const app = express();
const port = 3000;

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  console.log('Ahora puede abrir la aplicación en su navegador.');
});
