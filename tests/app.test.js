const {
    calculateCycleTime,
    addTask,
    calculateMinimumStations,
    balanceLine,
    _setCycleTime,
    _getTasksRef,
    clearAllData
  } = require('../public/app');

  // Mocking DOM elements
  document.body.innerHTML = `
    <input id="daily-demand" />
    <input id="production-time" />
    <div id="cycle-time-result"></div>
    <input id="task-id" />
    <input id="task-description" />
    <input id="gross-time" />
    <input id="fatigue-factor" />
    <input id="predecessor-task" />
    <input id="task-tools" />
    <form id="production-params-form"></form>
    <form id="task-form"><button type="submit"></button></form>
    <div id="total-work-content"></div>
    <div id="min-stations-result"></div>
    <div id="balancing-results"></div>
    <table id="tasks-table"><tbody></tbody></table>
    <canvas id="precedence-diagram"></canvas>
  `;

  // Mock Chart.js
  global.Chart = jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  }));
  global.Chart.register = jest.fn();

  describe('Line Balancing App', () => {
    beforeEach(() => {
      // Clear all data before each test
      clearAllData();

      // Reset DOM element values
      document.getElementById('daily-demand').value = '';
      document.getElementById('production-time').value = '';
      document.getElementById('cycle-time-result').innerHTML = '';
      document.getElementById('min-stations-result').innerHTML = '';
    });

    test('should calculate cycle time correctly', () => {
      document.getElementById('daily-demand').value = '100';
      document.getElementById('production-time').value = '480';
      calculateCycleTime();
      expect(document.getElementById('cycle-time-result').textContent).toContain('288.00');
    });

    test('should add a task', () => {
      document.getElementById('task-id').value = 'A';
      document.getElementById('task-description').value = 'Task A';
      document.getElementById('gross-time').value = '10';
      document.getElementById('fatigue-factor').value = '10';

      const event = {
        preventDefault: jest.fn(),
        target: {
          reset: jest.fn(),
        },
      };
      addTask(event);

      const tasks = _getTasksRef();
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe('A');
    });

    test('should calculate minimum stations', () => {
      _setCycleTime(60);

      const tasks = _getTasksRef();
      tasks.push({ id: 'A', standardTime: 30 });
      tasks.push({ id: 'B', standardTime: 40 });

      calculateMinimumStations();
      expect(document.getElementById('min-stations-result').textContent).toContain('2');
    });

    test('should balance the line', () => {
      _setCycleTime(60);

      const tasks = _getTasksRef();
      tasks.push({ id: 'A', standardTime: 30, predecessor: '-', positionalWeight: 70 });
      tasks.push({ id: 'B', standardTime: 40, predecessor: 'A', positionalWeight: 40 });

      balanceLine();
      expect(document.getElementById('balancing-results').textContent).toContain('Estación 1');
    });
  });