import { safeNumber } from './calculations.js';
import { createEmptyRow, attachRowDeleteHandlers, refreshRowIndices, showMessages } from './ui.js';

export function getStateFromUI() {
  const tiempoDisponibleMin = safeNumber(document.getElementById('tiempoDisponibleMin').value, 0);
  const demandaDiaria = safeNumber(document.getElementById('demandaDiaria').value, 0);
  const fatigaGlobal = safeNumber(document.getElementById('fatigaGlobal').value, 0);
  const frecuenciaGlobal = safeNumber(document.getElementById('frecuenciaGlobal').value, 100);

  const rows = document.querySelectorAll('#tasksBody tr');
  const tasks = [];
  rows.forEach(tr => {
    tasks.push({
      code: tr.querySelector('.op-code').value,
      desc: tr.querySelector('.op-desc').value,
      tObs: tr.querySelector('.op-tiempo-obs').value,
      multi: tr.querySelector('.op-multi').value,
      fatiga: tr.querySelector('.op-fatiga').value,
      frecuencia: tr.querySelector('.op-frecuencia').value,
      predecesoras: tr.querySelector('.op-predecesoras').value
    });
  });

  return {
    meta: {
      note: document.getElementById('scenarioNote').value,
      savedAt: new Date().toISOString()
    },
    params: {
      tiempoDisponibleMin,
      demandaDiaria,
      fatigaGlobal,
      frecuenciaGlobal
    },
    tasks
  };
}

export function applyStateToUI(state) {
  if (!state) return;
  document.getElementById('tiempoDisponibleMin').value = state.params.tiempoDisponibleMin ?? 0;
  document.getElementById('demandaDiaria').value = state.params.demandaDiaria ?? 0;
  document.getElementById('fatigaGlobal').value = state.params.fatigaGlobal ?? 0;
  document.getElementById('frecuenciaGlobal').value = state.params.frecuenciaGlobal ?? 100;
  document.getElementById('scenarioNote').value = state.meta && state.meta.note ? state.meta.note : '';

  const tbody = document.getElementById('tasksBody');
  tbody.innerHTML = '';
  (state.tasks || []).forEach((t, idx) => {
    const tr = createEmptyRow(idx);
    tr.querySelector('.op-code').value = t.code ?? '';
    tr.querySelector('.op-desc').value = t.desc ?? '';
    tr.querySelector('.op-tiempo-obs').value = t.tObs ?? '';
    tr.querySelector('.op-multi').value = t.multi ?? 1;
    tr.querySelector('.op-fatiga').value = t.fatiga ?? '';
    tr.querySelector('.op-frecuencia').value = t.frecuencia ?? '';
    tr.querySelector('.op-predecesoras').value = t.predecesoras ?? '';
    tbody.appendChild(tr);
  });
  if (tbody.children.length === 0) {
    tbody.appendChild(createEmptyRow(0));
  }
  attachRowDeleteHandlers();
  refreshRowIndices();
}

export function populateScenarioDropdown() {
  const select = document.getElementById('scenarioLoadSelect');
  select.innerHTML = '<option value="">Seleccionar...</option>';

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('lb_scenario_')) {
      const scenarioName = key.substring('lb_scenario_'.length);
      const option = document.createElement('option');
      option.value = scenarioName;
      option.textContent = scenarioName;
      select.appendChild(option);
    }
  }
}

export function setupStorageHandlers() {
  document.getElementById('btnSave').addEventListener('click', () => {
    const name = document.getElementById('scenarioName').value.trim();
    if (!name) {
      showMessages(['Escribí un nombre de escenario antes de guardar.'], true);
      return;
    }
    const state = getStateFromUI();
    try {
      localStorage.setItem('lb_scenario_' + name, JSON.stringify(state));
      showMessages([`Escenario "${name}" guardado correctamente en este navegador.`], false);
      populateScenarioDropdown(); // Actualizar el dropdown
    } catch (e) {
      showMessages(
        ['No se pudo guardar el escenario (revisá permisos de almacenamiento del navegador).'],
        true
      );
    }
  });

  document.getElementById('btnLoad').addEventListener('click', () => {
    const name = document.getElementById('scenarioLoadSelect').value;
    if (!name) {
      showMessages(['Seleccioná un escenario de la lista para cargar.'], true);
      return;
    }
    const raw = localStorage.getItem('lb_scenario_' + name);
    if (!raw) {
      showMessages([`No se encontró el escenario "${name}" en este navegador.`], true);
      return;
    }
    try {
      const state = JSON.parse(raw);
      applyStateToUI(state);
      document.getElementById('scenarioName').value = name; // Poner el nombre en el campo de guardar
      showMessages([`Escenario "${name}" cargado. Recordá presionar "Recalcular".`], false);
    } catch (e) {
      showMessages(['No se pudo leer el escenario guardado (JSON inválido).'], true);
    }
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    const state = getStateFromUI();
    const scenarioName = document.getElementById('scenarioName').value.trim() || 'escenario';
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenarioName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessages(['Escenario exportado correctamente.'], false);
  });

  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnImport').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        if (state && state.params && state.tasks) {
          applyStateToUI(state);
          const fileName = file.name.endsWith('.json') ? file.name.slice(0, -5) : file.name;
          document.getElementById('scenarioName').value = fileName;
          showMessages([`Escenario "${file.name}" importado. Presioná "Recalcular".`], false);
        } else {
          showMessages(['El archivo JSON no tiene el formato esperado.'], true);
        }
      } catch (error) {
        showMessages([`Error al leer el archivo: ${error.message}`], true);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });
}
