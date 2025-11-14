    let chartStations = null;
    let chartOps = null;

    function safeNumber(v, fallback = 0) {
      const n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    }

    function showMessages(messages, isError = true) {
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

    function createEmptyRow(index) {
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

    function refreshRowIndices() {
      const rows = document.querySelectorAll('#tasksBody tr');
      rows.forEach((tr, idx) => {
        tr.cells[0].textContent = idx + 1;
      });
    }

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

    function validatePrecedences(tasks) {
      const msgs = [];
      const map = new Map();
      const codes = new Set();
      tasks.forEach(t => {
        if (codes.has(t.code)) {
            msgs.push(`El código de operación "${t.code}" está duplicado. Cada operación debe tener un código único.`);
        }
        codes.add(t.code);
        map.set(t.code, t)
    });

      tasks.forEach(t => {
        t.predecesoras.forEach(p => {
          if (!map.has(p)) {
            msgs.push(`La operación ${t.code} tiene como predecesora ${p}, que no existe en la tabla.`);
          }
        });
      });

      const visiting = new Set();
      const visited = new Set();

      function dfs(code) {
        if (visiting.has(code)) {
          msgs.push(`Se detectó un ciclo en las precedencias que involucra la operación ${code}.`);
          return;
        }
        if (visited.has(code)) return;
        visiting.add(code);
        const t = map.get(code);
        if (t) {
          t.predecesoras.forEach(p => {
            if (map.has(p)) dfs(p);
          });
        }
        visiting.delete(code);
        visited.add(code);
      }

      tasks.forEach(t => dfs(t.code));

      return msgs;
    }

    function computeStandardTimes(tasks) {
      let contenidoTotal = 0;
      tasks.forEach(t => {
        const freqFactor = t.frecuencia <= 0 ? 1 : t.frecuencia / 100.0;
        const fatFactor = 1 + (t.fatiga / 100.0);
        const tStd = (t.tObs * fatFactor * freqFactor) / (t.multi || 1);
        t.tStd = tStd;
        contenidoTotal += tStd;
      });
      return contenidoTotal;
    }

    function buildSuccessors(tasks) {
      const map = new Map();
      tasks.forEach(t => {
        t.sucesoras = [];
        map.set(t.code, t);
      });
      tasks.forEach(t => {
        t.predecesoras.forEach(p => {
          const predTask = map.get(p);
          if (predTask) {
            predTask.sucesoras.push(t.code);
          }
        });
      });
    }

    function computePW(tasks) {
      const map = new Map();
      tasks.forEach(t => {
        t.pw = 0;
        map.set(t.code, t);
      });

      const memo = new Map();

      function pw(code) {
        if (memo.has(code)) return memo.get(code);
        const t = map.get(code);
        if (!t) return 0;
        let sum = t.tStd;
        t.sucesoras.forEach(succCode => {
          sum += pw(succCode);
        });
        memo.set(code, sum);
        return sum;
      }

      tasks.forEach(t => {
        t.pw = pw(t.code);
      });
    }

    function assignStationsPW(tasks, takt) {
      const estaciones = [];
      if (tasks.length === 0 || takt <= 0) return estaciones;

      const map = new Map();
      tasks.forEach(t => map.set(t.code, t));

      const unassigned = new Set(tasks.map(t => t.code));
      let stationId = 1;

      const byPW = tasks.slice().sort((a, b) => b.pw - a.pw);

      function predecessorsAssigned(task) {
        return task.predecesoras.every(p => !unassigned.has(p));
      }

      while (unassigned.size > 0) {
        let stationTime = 0;
        const stationTasks = [];

        while (true) {
          const candidates = byPW.filter(t =>
            unassigned.has(t.code) && predecessorsAssigned(t)
          );
          if (candidates.length === 0) break;

          const remaining = takt - stationTime;
          let chosen = null;
          for (const cand of candidates) {
            if (cand.tStd <= remaining) {
              chosen = cand;
              break;
            }
          }

          if (!chosen) {
            if (stationTasks.length === 0) {
              chosen = candidates[0];
            } else {
              break;
            }
          }

          stationTasks.push(chosen.code);
          stationTime += chosen.tStd;
          chosen.estacion = stationId;
          unassigned.delete(chosen.code);

          if (stationTime >= takt) break;
        }

        estaciones.push({
          id: stationId,
          tasks: stationTasks,
          time: stationTime
        });
        stationId++;
      }

      return estaciones;
    }

    function computeKPIs(tasks, estaciones, takt, tiempoDisponibleSeg) {
      const contenidoTotal = tasks.reduce((s, t) => s + t.tStd, 0);
      const nEstReales = estaciones.length || 0;

      let eficiencia = 0;
      let tiempoOcioso = 0;
      if (takt > 0 && nEstReales > 0) {
        eficiencia = (contenidoTotal / (nEstReales * takt)) * 100;
        tiempoOcioso = (nEstReales * takt) - contenidoTotal;
      }

      let maxOpTime = 0;
      tasks.forEach(t => {
        if (t.tStd > maxOpTime) maxOpTime = t.tStd;
      });

      let maxStationTime = 0;
      estaciones.forEach(e => {
        if (e.time > maxStationTime) maxStationTime = e.time;
      });

      const cuelloSeg = maxOpTime > takt ? maxOpTime : maxStationTime;

      let capacidadHora = 0;
      let capacidadDia = 0;
      if (cuelloSeg > 0) {
        capacidadHora = 3600 / cuelloSeg;
        capacidadDia = tiempoDisponibleSeg / cuelloSeg;
      }

      return {
        contenidoTotal,
        nEstReales,
        eficiencia,
        tiempoOcioso,
        capacidadHora,
        capacidadDia,
        cuelloSeg,
        maxOpTime,
        maxStationTime
      };
    }

    function updateTableOutputs(tasks, takt) {
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

    function updateSummaryLabels(kpis, takt, contenidoTotal, nMinEst) {
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

    function updateCharts(tasks, estaciones, takt) {
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

    function getStateFromUI() {
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

    function applyStateToUI(state) {
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

    function attachRowDeleteHandlers() {
      document.querySelectorAll('.btn-delete-row').forEach(btn => {
        btn.onclick = () => {
          const tr = btn.closest('tr');
          tr.remove();
          refreshRowIndices();
        };
      });
    }

    function clearAll() {
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
          if (chartStations) chartStations.destroy();
          if (chartOps) chartOps.destroy();
          chartStations = null;
          chartOps = null;
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
          clearAll();
        }
      });

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
        } catch (e) {
          showMessages(
            ['No se pudo guardar el escenario (revisá permisos de almacenamiento del navegador).'],
            true
          );
        }
      });

      document.getElementById('btnLoad').addEventListener('click', () => {
        const name = document.getElementById('scenarioName').value.trim();
        if (!name) {
          showMessages(['Escribí el nombre del escenario que querés cargar.'], true);
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
          showMessages([`Escenario "${name}" cargado. Recordá presionar "Recalcular".`], false);
        } catch (e) {
          showMessages(['No se pudo leer el escenario guardado (JSON inválido).'], true);
        }
      });

      recalculateAll();
    });
