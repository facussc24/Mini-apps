export function safeNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

export function validatePrecedences(tasks) {
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

export function computeStandardTimes(tasks) {
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

export function buildSuccessors(tasks) {
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

export function computePW(tasks) {
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

export function assignStationsPW(tasks, takt) {
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

export function computeKPIs(tasks, estaciones, takt, tiempoDisponibleSeg) {
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
