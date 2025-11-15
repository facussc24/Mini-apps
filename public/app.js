document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Chart.js y registrar plugins
    Chart.register(ChartDataLabels);

    const taskForm = document.getElementById('task-form');
    taskForm.addEventListener('submit', addTask);

    // Renderizar el diagrama inicial (vacío)
    drawPrecedenceDiagram();
});

let tasks = [];
let cycleTime = 0;
let chartInstance = null;
let lastBalancingResult = { stations: [] }; // Almacenar el último resultado del balanceo

/**
 * Calcula el Tiempo de Ciclo (Takt Time) basado en la demanda y el tiempo disponible.
 */
function calculateCycleTime() {
    const dailyDemand = parseFloat(document.getElementById('daily-demand').value);
    const productionTime = parseFloat(document.getElementById('production-time').value);
    const resultDiv = document.getElementById('cycle-time-result');

    if (isNaN(dailyDemand) || isNaN(productionTime) || dailyDemand <= 0 || productionTime <= 0) {
        resultDiv.innerHTML = '<p class="error">Por favor, ingrese valores válidos para la demanda y el tiempo.</p>';
        return;
    }

    // Convertir tiempo de producción a segundos
    const productionTimeInSeconds = productionTime * 60;
    cycleTime = productionTimeInSeconds / dailyDemand;

    resultDiv.innerHTML = `
        <p>Tiempo de Ciclo (Takt Time): <strong>${cycleTime.toFixed(2)} segundos/unidad</strong></p>
    `;
}

/**
 * Agrega una nueva tarea a la lista, actualiza la tabla y el diagrama.
 * @param {Event} event - El evento de envío del formulario.
 */
function addTask(event) {
    event.preventDefault();

    // Obtener valores del formulario
    const id = document.getElementById('task-id').value.trim().toUpperCase();
    const description = document.getElementById('task-description').value.trim();
    const grossTimeInput = document.getElementById('gross-time').value.trim();
    const fatigueFactor = parseFloat(document.getElementById('fatigue-factor').value);
    const predecessor = document.getElementById('predecessor-task').value.trim().toUpperCase();
    const tools = document.getElementById('task-tools').value.trim();

    // Validar y procesar los tiempos brutos
    const grossTimes = grossTimeInput.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0);
    if (grossTimes.length === 0) {
        alert('Por favor, ingrese al menos un tiempo de ejecución bruto válido.');
        return;
    }
    const averageGrossTime = grossTimes.reduce((a, b) => a + b, 0) / grossTimes.length;


    // Validaciones
    if (!id || !description || isNaN(averageGrossTime) || isNaN(fatigueFactor)) {
        alert('Por favor, complete todos los campos requeridos con valores válidos.');
        return;
    }
    const standardTime = averageGrossTime * (1 + fatigueFactor / 100);
    const editingIndex = document.getElementById('task-form').getAttribute('data-editing-index');

    if (editingIndex !== null) {
        // Estamos editando una tarea existente
        const updatedTask = {
            ...tasks[editingIndex], // Mantener el ID original y otras propiedades
            description,
            grossTimes: grossTimes.join(', '),
            averageGrossTime,
            fatigueFactor,
            standardTime,
            predecessor: predecessor || '-',
            tools,
        };
        tasks[editingIndex] = updatedTask;

        // Limpiar el estado de edición
        document.getElementById('task-form').removeAttribute('data-editing-index');
        document.querySelector('#task-form button[type="submit"]').textContent = 'Agregar Tarea';
        document.getElementById('task-id').disabled = false;

    } else {
        // Estamos agregando una nueva tarea
        if (tasks.some(task => task.id === id)) {
            alert('El identificador de la tarea ya existe. Por favor, use uno diferente.');
            return;
        }
        const newTask = {
            id,
            description,
            grossTimes: grossTimes.join(', '),
            averageGrossTime,
            fatigueFactor,
            standardTime,
            predecessor: predecessor || '-',
            tools,
        };
        tasks.push(newTask);
    }

    updateTasksTable();
    updateTotalWorkContent();
    drawPrecedenceDiagram();
    event.target.reset(); // Limpiar el formulario
}

/**
 * Rellena el formulario de tareas con los datos de una tarea existente para su edición.
 * @param {number} taskIndex - El índice de la tarea en el array `tasks`.
 */
function populateFormForEdit(taskIndex) {
    const task = tasks[taskIndex];
    if (!task) return;

    document.getElementById('task-id').value = task.id;
    document.getElementById('task-id').disabled = true; // No se puede editar el ID
    document.getElementById('task-description').value = task.description;
    document.getElementById('gross-time').value = task.grossTimes;
    document.getElementById('fatigue-factor').value = task.fatigueFactor;
    document.getElementById('predecessor-task').value = task.predecessor === '-' ? '' : task.predecessor;
    document.getElementById('task-tools').value = task.tools || '';

    // Guardar el índice de la tarea que se está editando
    document.getElementById('task-form').setAttribute('data-editing-index', taskIndex);

    // Cambiar el texto del botón para indicar que se está editando
    document.querySelector('#task-form button[type="submit"]').textContent = 'Actualizar Tarea';
}

/**
 * Actualiza la tabla de tareas en la interfaz de usuario.
 */
function updateTasksTable() {
    const tableBody = document.querySelector('#tasks-table tbody');
    tableBody.innerHTML = ''; // Limpiar la tabla

    tasks.forEach((task, index) => {
        const row = document.createElement('tr');
        row.classList.add('task-row');
        row.setAttribute('data-task-index', index);
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.description}</td>
            <td>${task.grossTimes}</td>
            <td>${task.fatigueFactor.toFixed(2)}%</td>
            <td>${task.standardTime.toFixed(2)}</td>
            <td>${task.predecessor}</td>
            <td>${task.tools || ''}</td>
        `;

        row.addEventListener('click', () => populateFormForEdit(index));
        tableBody.appendChild(row);
    });
}

/**
 * Calcula y muestra el Contenido Total de Trabajo.
 */
function updateTotalWorkContent() {
    const totalWorkContentDiv = document.getElementById('total-work-content');
    const total = tasks.reduce((sum, task) => sum + task.standardTime, 0);
    totalWorkContentDiv.innerHTML = `
        <p>Contenido Total de Trabajo: <strong>${total.toFixed(2)} segundos</strong></p>
    `;
}

/**
 * Calcula el número mínimo teórico de estaciones de trabajo.
 */
function calculateMinimumStations() {
    const resultDiv = document.getElementById('min-stations-result');

    if (cycleTime <= 0) {
        resultDiv.innerHTML = '<p class="error">Calcule primero el Tiempo de Ciclo.</p>';
        return;
    }
    if (tasks.length === 0) {
        resultDiv.innerHTML = '<p class="error">Agregue al menos una tarea.</p>';
        return;
    }

    const totalWorkContent = tasks.reduce((sum, task) => sum + task.standardTime, 0);
    const minStations = Math.ceil(totalWorkContent / cycleTime);

    resultDiv.innerHTML = `
        <p>Suma de Tiempos: ${totalWorkContent.toFixed(2)}s</p>
        <p>Tiempo de Ciclo: ${cycleTime.toFixed(2)}s</p>
        <p>Número Mínimo de Estaciones (M): <strong>${minStations}</strong></p>
    `;
}

/**
 * Dibuja el diagrama de precedencias utilizando Chart.js.
 */
function drawPrecedenceDiagram() {
    const ctx = document.getElementById('precedence-diagram').getContext('2d');

    // Destruir instancia anterior del gráfico para evitar solapamientos
    if (chartInstance) {
        chartInstance.destroy();
    }

    const { nodes, positions } = getNodePositions();

    const stationColors = [
        'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)', 'rgba(255, 99, 255, 0.7)'
    ];

    const backgroundColors = tasks.map(task => {
        const station = lastBalancingResult.stations.find(s => s.tasks.some(t => t.id === task.id));
        if (station) {
            return stationColors[(station.id - 1) % stationColors.length];
        }
        return 'rgba(201, 203, 207, 0.7)'; // Color por defecto si no está asignada
    });

    const data = {
        datasets: [{
            label: 'Tareas',
            data: positions,
            backgroundColor: backgroundColors,
            borderColor: 'rgba(0, 0, 0, 0.5)',
            pointRadius: 25,
            pointHoverRadius: 30,
        }]
    };

    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: data,
        options: {
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const task = nodes[context.dataIndex];
                            return `${task.id}: ${task.description} (${task.standardTime.toFixed(2)}s)`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'center',
                    align: 'center',
                    color: 'white',
                    font: {
                        weight: 'bold'
                    },
                    formatter: (value, context) => {
                        const task = nodes[context.dataset.data[context.dataIndex].taskIndex];
                        return `${task.id}\n${task.standardTime.toFixed(2)}s`;
                    }
                }
            },
            scales: {
                x: {
                    display: false,
                    min: -0.5,
                    max: Math.max(5, ...positions.map(p => p.x)) + 1
                },
                y: {
                    display: false
                }
            },
            animation: {
                onComplete: () => {
                    drawArrows(ctx, chartInstance, nodes);
                }
            }
        }
    });
}

/**
 * Calcula las posiciones de los nodos (tareas) para el diagrama.
 * @returns {{nodes: Array, positions: Array}} - Nodos y sus posiciones.
 */
function getNodePositions() {
    if (tasks.length === 0) return { nodes: [], positions: [] };

    let levels = {};
    let placedTasks = new Set();

    // Función para obtener el nivel de una tarea
    function getLevel(taskId) {
        if (placedTasks.has(taskId)) {
            // Busca el nivel ya asignado
            for (const level in levels) {
                if (levels[level].some(t => t.id === taskId)) return parseInt(level);
            }
        }

        const task = tasks.find(t => t.id === taskId);
        if (!task || task.predecessor === '-') return 0;

        const predecessors = task.predecessor.split(',').map(p => p.trim());
        const maxPredLevel = Math.max(...predecessors.map(pId => getLevel(pId)));

        return maxPredLevel + 1;
    }

    tasks.forEach(task => {
        const level = getLevel(task.id);
        if (!levels[level]) {
            levels[level] = [];
        }
        levels[level].push(task);
        placedTasks.add(task.id);
    });

    let positions = [];
    let nodes = [];
    Object.keys(levels).forEach(level => {
        levels[level].forEach((task, index) => {
            positions.push({
                x: parseInt(level) + 1,
                y: index + 1,
                taskIndex: tasks.indexOf(task)
            });
            nodes.push(task);
        });
    });

    return { nodes: tasks, positions };
}


/**
 * Dibuja las flechas de precedencia en el canvas.
 * @param {CanvasRenderingContext2D} ctx - El contexto del canvas.
 * @param {Chart} chart - La instancia del gráfico de Chart.js.
 * @param {Array} nodes - La lista de nodos (tareas).
 */
 function drawArrows(ctx, chart, nodes) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';

    const meta = chart.getDatasetMeta(0);
    const points = meta.data;

    nodes.forEach((task, index) => {
        if (task.predecessor !== '-') {
            const predecessors = task.predecessor.split(',').map(p => p.trim());
            predecessors.forEach(predId => {
                const predIndex = nodes.findIndex(t => t.id === predId);
                if (predIndex !== -1) {
                    const fromPoint = points[predIndex];
                    const toPoint = points[index];

                    if (fromPoint && toPoint) {
                        drawArrow(ctx, fromPoint.x, fromPoint.y, toPoint.x, toPoint.y, 20);
                    }
                }
            });
        }
    });

    ctx.restore();
}

/**
 * Dibuja una flecha individual entre dos puntos.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {number} radius - El radio del nodo para calcular el punto de inicio/fin de la línea.
 */
function drawArrow(ctx, fromX, fromY, toX, toY, radius) {
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Ajustar el punto final para que no se superponga con el nodo
    const adjustedToX = toX - radius * Math.cos(angle);
    const adjustedToY = toY - radius * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(adjustedToX, adjustedToY);
    ctx.stroke();

    // Dibujar la cabeza de la flecha
    ctx.beginPath();
    ctx.moveTo(adjustedToX, adjustedToY);
    ctx.lineTo(adjustedToX - 10 * Math.cos(angle - Math.PI / 6), adjustedToY - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(adjustedToX - 10 * Math.cos(angle + Math.PI / 6), adjustedToY - 10 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

/**
 * Realiza el balanceo de la línea utilizando el algoritmo de Peso Posicional.
 */
function balanceLine() {
    if (cycleTime <= 0) {
        alert('Por favor, calcule primero el Tiempo de Ciclo.');
        return;
    }
    if (tasks.length === 0) {
        alert('Por favor, agregue al menos una tarea antes de balancear.');
        return;
    }

    // 1. Calcular el Peso Posicional de cada tarea
    const tasksWithPW = tasks.map(task => ({
        ...task,
        positionalWeight: calculatePositionalWeight(task.id),
        successors: getSuccessors(task.id)
    }));

    // 2. Ordenar las tareas por Peso Posicional (de mayor a menor)
    tasksWithPW.sort((a, b) => {
        if (b.positionalWeight !== a.positionalWeight) {
            return b.positionalWeight - a.positionalWeight;
        }
        // Si hay empate, priorizar por tiempo de ejecución más largo
        return b.standardTime - a.standardTime;
    });

    // 3. Asignar tareas a las estaciones
    const { stations, totalIdleTime, totalWorkContent } = assignTasksToStations(tasksWithPW);

    // 4. Calcular métricas de eficiencia
    const lineEfficiency = (totalWorkContent / (stations.length * cycleTime)) * 100;

    // 5. Guardar y mostrar los resultados
    lastBalancingResult = { stations };
    displayBalancingResults(stations, totalIdleTime, lineEfficiency);
    drawPrecedenceDiagram(); // Volver a dibujar con los colores de las estaciones
}

/**
 * Calcula el Peso Posicional de una tarea.
 * @param {string} taskId - El ID de la tarea.
 * @returns {number} - El Peso Posicional.
 */
function calculatePositionalWeight(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;

    let weight = task.standardTime;
    const successors = getSuccessors(taskId);

    successors.forEach(successorId => {
        const successorTask = tasks.find(t => t.id === successorId);
        if (successorTask) {
            weight += successorTask.standardTime;
        }
    });

    return weight;
}

/**
 * Obtiene todos los sucesores de una tarea.
 * @param {string} taskId - El ID de la tarea.
 * @returns {Set<string>} - Un conjunto de IDs de tareas sucesoras.
 */
function getSuccessors(taskId) {
    let successors = new Set();
    let queue = [taskId];

    while(queue.length > 0) {
        const currentTaskId = queue.shift();
        tasks.forEach(task => {
            const predecessors = task.predecessor.split(',').map(p => p.trim());
            if (predecessors.includes(currentTaskId)) {
                if (!successors.has(task.id)) {
                    successors.add(task.id);
                    queue.push(task.id);
                }
            }
        });
    }

    return successors;
}

/**
 * Asigna las tareas a las estaciones de trabajo.
 * @param {Array} sortedTasks - La lista de tareas ordenada por Peso Posicional.
 * @returns {object} - Las estaciones, el tiempo inactivo total y el contenido total de trabajo.
 */
function assignTasksToStations(sortedTasks) {
    let stations = [];
    let assignedTasks = new Set();
    let totalWorkContent = sortedTasks.reduce((sum, task) => sum + task.standardTime, 0);

    let stationIndex = 0;
    while (assignedTasks.size < sortedTasks.length) {
        stations.push({
            id: stationIndex + 1,
            tasks: [],
            currentTime: 0
        });

        const currentStation = stations[stationIndex];

        sortedTasks.forEach(task => {
            if (!assignedTasks.has(task.id)) {
                // Verificar si las predecesoras han sido asignadas
                const predecessors = task.predecessor.split(',').map(p => p.trim()).filter(p => p !== '-');
                const predecessorsAssigned = predecessors.every(p => assignedTasks.has(p));

                if (predecessorsAssigned) {
                    // Verificar si la tarea cabe en la estación actual
                    if (currentStation.currentTime + task.standardTime <= cycleTime) {
                        currentStation.tasks.push(task);
                        currentStation.currentTime += task.standardTime;
                        assignedTasks.add(task.id);
                    }
                }
            }
        });
        stationIndex++;
    }

    // Calcular tiempo inactivo total
    let totalIdleTime = 0;
    stations.forEach(station => {
        station.idleTime = cycleTime - station.currentTime;
        totalIdleTime += station.idleTime;
    });

    return { stations, totalIdleTime, totalWorkContent };
}

/**
 * Muestra los resultados del balanceo en la interfaz.
 * @param {Array} stations - Las estaciones de trabajo con sus tareas asignadas.
 * @param {number} totalIdleTime - El tiempo inactivo total.
 * @param {number} lineEfficiency - La eficiencia de la línea.
 */
function displayBalancingResults(stations, totalIdleTime, lineEfficiency) {
    const resultsDiv = document.getElementById('balancing-results');
    resultsDiv.innerHTML = '<h3>Resultados del Balanceo</h3>';

    // Identificar el cuello de botella
    const maxStationTime = Math.max(...stations.map(s => s.currentTime));

    stations.forEach(station => {
        const stationDiv = document.createElement('div');
        stationDiv.classList.add('station');
        if (station.currentTime === maxStationTime) {
            stationDiv.classList.add('bottleneck');
        }

        const occupancy = (station.currentTime / cycleTime) * 100;
        let tasksHtml = station.tasks.map(t => `<li>${t.id} (${t.standardTime.toFixed(2)}s)</li>`).join('');

        stationDiv.innerHTML = `
            <h4>Estación ${station.id} ${station.currentTime === maxStationTime ? '(Cuello de Botella)' : ''}</h4>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${occupancy.toFixed(2)}%;"></div>
            </div>
            <p><strong>Ocupación: ${occupancy.toFixed(2)}%</strong></p>
            <p>Tiempo Acumulado: ${station.currentTime.toFixed(2)}s</p>
            <p>Tiempo Inactivo: ${station.idleTime.toFixed(2)}s</p>
            <ul>${tasksHtml}</ul>
        `;
        resultsDiv.appendChild(stationDiv);
    });

    const totalWorkContent = stations.flatMap(s => s.tasks).reduce((sum, task) => sum + task.standardTime, 0);
    const minStations = Math.ceil(totalWorkContent / cycleTime);

    const metricsDiv = document.createElement('div');
    metricsDiv.classList.add('metrics');
    metricsDiv.innerHTML = `
        <h3>Métricas de Eficiencia</h3>
        <p>Número Mínimo Teórico de Estaciones: <strong>${minStations}</strong></p>
        <p>Número Real de Estaciones: <strong>${stations.length}</strong></p>
        <p>Tiempo Inactivo Total: <strong>${totalIdleTime.toFixed(2)}s</strong></p>
        <p>Eficiencia de la Línea: <strong>${lineEfficiency.toFixed(2)}%</strong></p>
    `;
    resultsDiv.appendChild(metricsDiv);
}

/**
 * Genera un reporte imprimible del trabajo estandarizado por estación.
 */
function generateReport() {
    if (lastBalancingResult.stations.length === 0) {
        alert('Por favor, realice el balanceo de línea antes de generar un reporte.');
        return;
    }

    const reportWindow = window.open('', '', 'width=800,height=600');
    reportWindow.document.write('<html><head><title>Hoja de Trabajo Estandarizado</title>');
    reportWindow.document.write('<link rel="stylesheet" href="style.css">');
    reportWindow.document.write(`
        <style>
            body { font-family: sans-serif; margin: 20px; background-color: #fff; }
            .report-container { width: 100%; }
            .station-report { border: 2px solid #333; padding: 15px; margin-bottom: 20px; page-break-inside: avoid; border-radius: 8px;}
            .station-report h2 { color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 5px;}
            .station-report table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .station-report th, .station-report td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .station-report th { background-color: #f2f2f2; }
            .metrics-summary { margin-top: 30px; border-top: 2px solid #3498db; padding-top: 15px; }
            @media print {
                #printBtn { display: none; }
            }
        </style>
    `);
    reportWindow.document.write('</head><body>');
    reportWindow.document.write('<div class="report-container">');
    reportWindow.document.write('<h1>Hoja de Trabajo Estandarizado</h1>');

    lastBalancingResult.stations.forEach(station => {
        let tasksHtml = '';
        station.tasks.forEach(task => {
            tasksHtml += `
                <tr>
                    <td>${task.id}</td>
                    <td>${task.description}</td>
                    <td>${task.standardTime.toFixed(2)}s</td>
                    <td>${task.tools || 'N/A'}</td>
                </tr>
            `;
        });

        reportWindow.document.write(`
            <div class="station-report">
                <h2>Estación de Trabajo #${station.id}</h2>
                <p><strong>Tiempo Acumulado:</strong> ${station.currentTime.toFixed(2)}s</p>
                <p><strong>Tiempo Inactivo:</strong> ${station.idleTime.toFixed(2)}s</p>
                <table>
                    <thead>
                        <tr>
                            <th>ID Tarea</th>
                            <th>Descripción</th>
                            <th>Tiempo Estándar</th>
                            <th>Herramientas y Materiales</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasksHtml}
                    </tbody>
                </table>
            </div>
        `);
    });

    // Añadir resumen de métricas
    const totalWorkContent = lastBalancingResult.stations.flatMap(s => s.tasks).reduce((sum, task) => sum + task.standardTime, 0);
    const lineEfficiency = (totalWorkContent / (lastBalancingResult.stations.length * cycleTime)) * 100;
    const totalIdleTime = lastBalancingResult.stations.reduce((sum, s) => sum + s.idleTime, 0);

    reportWindow.document.write(`
        <div class="metrics-summary">
            <h2>Métricas Globales de la Línea</h2>
            <p><strong>Eficiencia de la Línea:</strong> ${lineEfficiency.toFixed(2)}%</p>
            <p><strong>Tiempo Inactivo Total:</strong> ${totalIdleTime.toFixed(2)}s</p>
            <p><strong>Contenido Total de Trabajo:</strong> ${totalWorkContent.toFixed(2)}s</p>
        </div>
    `);

    reportWindow.document.write('</div>');
    reportWindow.document.write('<button id="printBtn" onclick="window.print()">Imprimir Reporte</button>');
    reportWindow.document.write('</body></html>');
    reportWindow.document.close();
}

/**
 * Limpia todos los datos de entrada y los resultados para iniciar una nueva simulación.
 */
function clearAllData() {
    // Limpiar arrays y variables
    tasks = [];
    cycleTime = 0;
    lastBalancingResult = { stations: [] };

    // Limpiar campos de formulario
    document.getElementById('production-params-form').reset();
    document.getElementById('task-form').reset();

    // Limpiar divs de resultados
    document.getElementById('cycle-time-result').innerHTML = '';
    document.getElementById('total-work-content').innerHTML = '';
    document.getElementById('min-stations-result').innerHTML = '';
    document.getElementById('balancing-results').innerHTML = '';

    // Actualizar la tabla y el diagrama
    updateTasksTable();
    drawPrecedenceDiagram();

    // Resetear el estado de edición del formulario
    document.getElementById('task-form').removeAttribute('data-editing-index');
    document.querySelector('#task-form button[type="submit"]').textContent = 'Agregar Tarea';
    document.getElementById('task-id').disabled = false;
}
