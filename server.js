const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const fs = require('fs');
const path = 'data';

app.get('/api/files', (req, res) => {
  fs.readdir(path, (err, files) => {
    if (err) {
      return res.status(500).send('Error al leer los archivos');
    }
    res.json(files);
  });
});

app.post('/api/files', (req, res) => {
  const { filename, content } = req.body;

  if (!filename || !content) {
    return res.status(400).send('El nombre y el contenido del archivo son obligatorios');
  }

  fs.writeFile(`${path}/${filename}`, content, (err) => {
    if (err) {
      return res.status(500).send('Error al guardar el archivo');
    }
    res.status(201).send('Archivo creado con éxito');
  });
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
