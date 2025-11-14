import {
  showMessages,
  createEmptyRow,
  refreshRowIndices,
  updateTableOutputs,
  updateSummaryLabels,
  updateCharts,
  clearAllUI,
  attachRowDeleteHandlers,
} from './ui.js';

import {
  safeNumber,
  validatePrecedences,
  computeStandardTimes,
  buildSuccessors,
  computePW,
  assignStationsPW,
  computeKPIs,
} from './calculations.js';

import {
  setupStorageHandlers,
  populateScenarioDropdown
} from './storage.js';

function readTasksFromTable(globalFatiga, globalFreq) {
  const rows = document.querySelectorAll('#tasksBody tr');
  const tasks = [];
  rows.forEach(tr => {
    const code = tr.querySelector('.op-code').value.trim();
    const desc = tr.querySelector('.op-desc').value.trim();
    const tObs = safeNumber(tr.querySelector('.op-tiempo-obs').value, 0);
    const multi = safeNumber(tr.querySelector('.op-multi').value, 1) || 1;
    const fat = tr.querySelector('.op-fatiga').value.trim();
    const freq = tr.querySelector('.op-frecuencia').value.trim();
    const predStr = tr.querySelector('.op-predecesoras').value.trim();

    if (!code || tObs <= 0) return;

    const fatiga = fat === '' ? globalFatiga : safeNumber(fat, 0);
    const frecuencia = freq === '' ? globalFreq : safeNumber(freq, 100);
    const preds = predStr
      ? predStr.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const tarea = {
      code,
      desc,
      tObs,
      multi,
      fatiga,
      frecuencia,
      predecesoras: preds,
      sucesoras: [],
      tStd: 0,
      pw: 0,
      estacion: null
    };
    tasks.push(tarea);
  });
  return tasks;
}

function recalculateAll() {
  const messages = [];

  try {
    const tiempoDisponibleMin = safeNumber(document.getElementById('tiempoDisponibleMin').value, 0);
    const demandaDiaria = safeNumber(document.getElementById('demandaDiaria').value, 0);
    const fatigaGlobal = safeNumber(document.getElementById('fatigaGlobal').value, 0);
    const frecuenciaGlobal = safeNumber(document.getElementById('frecuenciaGlobal').value, 100);

    if (tiempoDisponibleMin <= 0) {
      messages.push('El tiempo disponible por día debe ser mayor a 0.');
    }
    if (demandaDiaria <= 0) {
      messages.push('La demanda diaria debe ser mayor a 0.');
    }

    const tasks = readTasksFromTable(fatigaGlobal, frecuenciaGlobal);
    if (tasks.length === 0) {
      messages.push('No hay operaciones con código y tiempo observado > 0. Cargá al menos una.');
    }

    if (messages.length > 0) {
      showMessages(messages, true);
      return;
    }

    const tiempoDisponibleSeg = tiempoDisponibleMin * 60;
    const takt = tiempoDisponibleSeg / demandaDiaria;

    const contenidoTotal = computeStandardTimes(tasks);

    buildSuccessors(tasks);
    const precMsgs = validatePrecedences(tasks);
    if (precMsgs.length > 0) {
      messages.push(...precMsgs);
      updateTableOutputs(tasks, takt);
      updateSummaryLabels(
        {
          contenidoTotal,
          nEstReales: 0,
          eficiencia: 0,
          tiempoOcioso: 0,
          capacidadHora: 0,
          capacidadDia: 0,
          cuelloSeg: 0,
          maxOpTime: 0,
          maxStationTime: 0
        },
        takt,
        contenidoTotal,
        0
      );
      updateCharts([], [], takt);
      showMessages(messages, true);
      return;
    }

    computePW(tasks);
    const estaciones = assignStationsPW(tasks, takt);

    const nMinEst = takt > 0 ? Math.ceil(contenidoTotal / takt) : 0;
    const kpis = computeKPIs(tasks, estaciones, takt, tiempoDisponibleSeg);

    updateTableOutputs(tasks, takt);
    updateSummaryLabels(kpis, takt, contenidoTotal, nMinEst);
    updateCharts(tasks, estaciones, takt);

    if (kpis.maxOpTime > takt && takt > 0) {
      messages.push(
        'Advertencia: hay operaciones con tiempo estándar mayor al Takt. La línea no puede cumplir la demanda.'
      );
    }
    if (estaciones.length < nMinEst && estaciones.length > 0) {
      messages.push(
        `Advertencia: el número de estaciones PW (${estaciones.length}) es menor al mínimo teórico (${nMinEst}). Revisá las entradas.`
      );
    }

    if (messages.length > 0) {
      showMessages(messages, false);
    } else {
      showMessages([]);
    }
  } catch (e) {
    console.error(e);
    showMessages(
      ['Ocurrió un error inesperado en los cálculos: ' + e.message],
      true
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('tasksBody');
  tbody.appendChild(createEmptyRow(0));
  attachRowDeleteHandlers();
  refreshRowIndices();

  document.getElementById('btnAddRow').addEventListener('click', () => {
    const idx = document.querySelectorAll('#tasksBody tr').length;
    const tr = createEmptyRow(idx);
    document.getElementById('tasksBody').appendChild(tr);
    attachRowDeleteHandlers();
    refreshRowIndices();
  });

  document.getElementById('btnRecalcular').addEventListener('click', recalculateAll);

  document.getElementById('btnClear').addEventListener('click', () => {
    if (confirm('¿Seguro que querés limpiar todos los datos de la pantalla?')) {
      clearAllUI();
    }
  });

  setupStorageHandlers();
  populateScenarioDropdown();

  recalculateAll();
});
