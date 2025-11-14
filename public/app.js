document.addEventListener('DOMContentLoaded', () => {
  const fileManager = document.getElementById('file-manager');

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (!response.ok) {
        throw new Error('Error al obtener los archivos');
      }
      const files = await response.json();
      renderFiles(files);
    } catch (error) {
      console.error(error);
      fileManager.innerHTML = '<p>Error al cargar los archivos.</p>';
    }
  };

  const renderFiles = (files) => {
    if (files.length === 0) {
      fileManager.innerHTML = '<p>No hay archivos.</p>';
      return;
    }

    const fileList = document.createElement('ul');
    files.forEach(file => {
      const listItem = document.createElement('li');
      listItem.textContent = file;
      fileList.appendChild(listItem);
    });

    fileManager.innerHTML = ''; // Limpiar contenido anterior
    fileManager.appendChild(fileList);
  };

  const createFileForm = document.getElementById('create-file-form');
  createFileForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const filenameInput = document.getElementById('filename');
    const fileContentInput = document.getElementById('file-content');

    const filename = filenameInput.value;
    const content = fileContentInput.value;

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, content }),
      });

      if (!response.ok) {
        throw new Error('Error al crear el archivo');
      }

      filenameInput.value = '';
      fileContentInput.value = '';
      fetchFiles();
    } catch (error) {
      console.error(error);
      alert('Error al crear el archivo.');
    }
  });

  fetchFiles();
});
