let chartStations = null;
let chartOps = null;

export function showMessages(messages, isError = true) {
  const panel = document.getElementById('errorPanel');
  if (!messages || messages.length === 0) {
    panel.textContent = 'Sin errores por el momento.';
    panel.className = 'error-panel text-xs p-2 bg-slate-50 border border-slate-200 rounded-b-md text-slate-800';
    return;
  }
  panel.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'list-disc pl-4 space-y-1';
  messages.forEach(msg => {
    const li = document.createElement('li');
    li.textContent = msg;
    ul.appendChild(li);
  });
  panel.appendChild(ul);
  panel.classList.remove('text-slate-800', 'bg-slate-50', 'border-slate-200');
  if (isError) {
    panel.classList.add('text-red-700', 'bg-red-50', 'border-red-200');
  } else {
    panel.classList.add('text-amber-700', 'bg-amber-50', 'border-amber-200');
  }
}

export function createEmptyRow(index) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${index + 1}</td>
    <td class="input-cell"><input type="text" class="op-code" placeholder="OP10"></td>
    <td class="input-cell"><input type="text" class="op-desc" placeholder="Corte, costura, etc."></td>
    <td class="input-cell"><input type="number" min="0" step="0.01" class="op-tiempo-obs"></td>
    <td class="input-cell"><input type="number" min="1" step="1" class="op-multi" value="1"></td>
    <td class="input-cell"><input type="number" min="0" step="0.1" class="op-fatiga"></td>
    <td class="input-cell"><input type="number" min="1" max="100" step="1" class="op-frecuencia"></td>
    <td class="input-cell"><input type="text" class="op-predecesoras" placeholder="OP10,OP20"></td>
    <td class="output-cell op-std-time">–</td>
    <td class="output-cell op-pw">–</td>
    <td class="output-cell op-station">–</td>
    <td class="input-cell">
      <button class="btn btn-delete-row">X</button>
    </td>
  `;
  return tr;
}

export function refreshRowIndices() {
  const rows = document.querySelectorAll('#tasksBody tr');
  rows.forEach((tr, idx) => {
    tr.cells[0].textContent = idx + 1;
  });
}

export function updateTableOutputs(tasks, takt) {
  const rows = document.querySelectorAll('#tasksBody tr');
  const map = new Map();
  tasks.forEach(t => map.set(t.code, t));

  rows.forEach(tr => {
    const code = tr.querySelector('.op-code').value.trim();
    const tStdCell = tr.querySelector('.op-std-time');
    const pwCell = tr.querySelector('.op-pw');
    const stCell = tr.querySelector('.op-station');

    tr.classList.remove('op-over-takt');
    if (!code || !map.has(code)) {
      tStdCell.textContent = '–';
      pwCell.textContent = '–';
      stCell.textContent = '–';
      return;
    }

    const t = map.get(code);
    tStdCell.textContent = t.tStd.toFixed(2);
    pwCell.textContent = t.pw.toFixed(2);
    stCell.textContent = t.estacion ? `E${t.estacion}` : '–';

    if (t.tStd > takt && takt > 0) {
      tr.classList.add('op-over-takt');
    }
  });
}

export function updateSummaryLabels(kpis, takt, contenidoTotal, nMinEst) {
  document.getElementById('taktLabel').textContent =
    takt > 0 ? takt.toFixed(2) : '–';

  document.getElementById('contenidoTotalLabel').textContent =
    contenidoTotal > 0 ? contenidoTotal.toFixed(2) : '–';

  document.getElementById('nMinEstLabel').textContent =
    nMinEst > 0 ? nMinEst.toString() : '–';

  document.getElementById('nEstRealesLabel').textContent =
    kpis.nEstReales > 0 ? kpis.nEstReales.toString() : '–';

  document.getElementById('eficienciaLabel').textContent =
    kpis.eficiencia > 0 ? kpis.eficiencia.toFixed(1) + ' %' : '–';

  document.getElementById('tiempoOciosoLabel').textContent =
    kpis.nEstReales > 0 ? kpis.tiempoOcioso.toFixed(2) + ' seg/pza' : '–';

  document.getElementById('capacidadHoraLabel').textContent =
    kpis.capacidadHora > 0 ? kpis.capacidadHora.toFixed(1) : '–';

  document.getElementById('capacidadDiaLabel').textContent =
    kpis.capacidadDia > 0 ? kpis.capacidadDia.toFixed(0) : '–';

  const diag = [];
  if (takt <= 0) {
    diag.push('No se pudo calcular Takt (revisá tiempo disponible y demanda).');
  } else {
    diag.push(`Takt: ${takt.toFixed(2)} seg/pza.`);
  }
  if (kpis.maxOpTime > takt && takt > 0) {
    diag.push(
      `Hay al menos una operación con tiempo estándar (${kpis.maxOpTime.toFixed(
        2
      )} seg/pza) mayor al Takt. La línea NO puede cumplir la demanda actual.`
    );
  }
  if (kpis.nEstReales > 0) {
    diag.push(
      `La capacidad real aproximada es ${kpis.capacidadDia.toFixed(
        0
      )} pzs/día con el cuello de botella actual.`
    );
  }

  document.getElementById('diagnosticoLabel').textContent =
    diag.length > 0 ? diag.join(' ') : 'Cargá datos y presioná "Recalcular".';
}

export function updateCharts(tasks, estaciones, takt) {
  const ctxStations = document.getElementById('chartStations').getContext('2d');
  const ctxOps = document.getElementById('chartOps').getContext('2d');

  const stationLabels = estaciones.map(e => 'E' + e.id);
  const stationTimes = estaciones.map(e => e.time);
  const stationColors = estaciones.map(e => {
    if (takt <= 0) return 'rgba(148,163,184,0.8)';
    const ratio = e.time / takt;
    if (ratio > 1) return 'rgba(248,113,113,0.9)';
    if (ratio >= 0.8) return 'rgba(52,211,153,0.9)';
    return 'rgba(203,213,225,0.9)';
  });

  const taktStations = estaciones.map(() => takt);

  const opLabels = tasks.map(t => t.code);
  const opTimes = tasks.map(t => t.tStd);
  const opColors = tasks.map(t => {
    if (takt <= 0) return 'rgba(148,163,184,0.8)';
    const ratio = t.tStd / takt;
    if (ratio > 1) return 'rgba(248,113,113,0.9)';
    if (ratio >= 0.8) return 'rgba(52,211,153,0.9)';
    return 'rgba(203,213,225,0.9)';
  });
  const taktOps = tasks.map(() => takt);

  if (chartStations) chartStations.destroy();
  chartStations = new Chart(ctxStations, {
    type: 'bar',
    data: {
      labels: stationLabels,
      datasets: [
        {
          label: 'Carga de estación (seg/pza)',
          data: stationTimes,
          backgroundColor: stationColors
        },
        {
          label: 'Takt time',
          type: 'line',
          data: taktStations,
          borderColor: 'rgba(59,130,246,1)',
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  if (chartOps) chartOps.destroy();
  chartOps = new Chart(ctxOps, {
    type: 'bar',
    data: {
      labels: opLabels,
      datasets: [
        {
          label: 'Tiempo estándar op. (seg/pza)',
          data: opTimes,
          backgroundColor: opColors
        },
        {
          label: 'Takt time',
          type: 'line',
          data: taktOps,
          borderColor: 'rgba(59,130,246,1)',
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

export function clearAllUI() {
  document.getElementById('tiempoDisponibleMin').value = 480;
  document.getElementById('demandaDiaria').value = 500;
  document.getElementById('fatigaGlobal').value = 15;
  document.getElementById('frecuenciaGlobal').value = 100;
  document.getElementById('scenarioName').value = '';
  document.getElementById('scenarioNote').value = '';

  const tbody = document.getElementById('tasksBody');
  tbody.innerHTML = '';
  tbody.appendChild(createEmptyRow(0));
  attachRowDeleteHandlers();
  refreshRowIndices();

  if (chartStations) chartStations.destroy();
  if (chartOps) chartOps.destroy();
  chartStations = null;
  chartOps = null;

  document.getElementById('taktLabel').textContent = '–';
  document.getElementById('contenidoTotalLabel').textContent = '–';
  document.getElementById('nMinEstLabel').textContent = '–';
  document.getElementById('nEstRealesLabel').textContent = '–';
  document.getElementById('eficienciaLabel').textContent = '–';
  document.getElementById('tiempoOciosoLabel').textContent = '–';
  document.getElementById('capacidadHoraLabel').textContent = '–';
  document.getElementById('capacidadDiaLabel').textContent = '–';
  document.getElementById('diagnosticoLabel').textContent =
    'Cargá datos y presioná "Recalcular".';

  showMessages([]);
}

export function attachRowDeleteHandlers() {
  document.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.onclick = () => {
      const tr = btn.closest('tr');
      tr.remove();
      refreshRowIndices();
    };
  });
}
