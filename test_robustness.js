// Robustness Test Script for Line Balancing Application

// Mocking the DOM elements and functions that app.js depends on.
// This is necessary because we are not running in a browser environment.
const mockElements = {
    'daily-demand': { value: '0' },
    'production-time': { value: '0' },
    'task-id': { value: '' },
    'task-description': { value: '' },
    'gross-time': { value: '' },
    'fatigue-factor': { value: '0' },
    'predecessor-task': { value: '' },
    'task-tools': { value: '' },
    'cycle-time-result': { innerHTML: '' },
    'total-work-content': { innerHTML: '' },
    'min-stations-result': { innerHTML: '' },
    'balancing-results': { innerHTML: '', appendChild: () => {} },
    'precedence-diagram': { getContext: () => ({}) },
    'task-form': {
        getAttribute: () => null,
        removeAttribute: () => {},
        reset: () => {
            mockElements['task-id'].value = '';
            mockElements['task-description'].value = '';
            mockElements['gross-time'].value = '';
            mockElements['fatigue-factor'].value = '0';
            mockElements['predecessor-task'].value = '';
            mockElements['task-tools'].value = '';
        }
    },
    'production-params-form': {
        reset: () => {
            mockElements['daily-demand'].value = '0';
            mockElements['production-time'].value = '0';
        }
    }
};

global.document = {
    getElementById: (id) => mockElements[id] || null,
    addEventListener: () => {}, // Mock this function
    querySelector: (selector) => {
        if (selector === '#tasks-table tbody') {
            return { innerHTML: '', appendChild: () => {} }; // Mock appendChild
        }
        if (selector === '#task-form button[type="submit"]') {
            return { textContent: '' };
        }
        return null;
    },
    createElement: () => ({
        classList: { add: () => {} },
        setAttribute: () => {},
        addEventListener: () => {}
    })
};

global.window = {};
global.Chart = function() {
    return {
        destroy: () => {},
        getDatasetMeta: () => ({ data: [] })
    };
};
global.Chart.register = () => {};
global.alert = (message) => {
    // In a real test, we might want to capture these alerts.
    // For this script, we'll just log them as errors.
    console.error(`ALERT: ${message}`);
};

const assert = require('assert');
const app = require('./public/app.js');

// Destructure functions and state accessors from the imported module
const {
    calculateCycleTime,
    addTask,
    calculateMinimumStations,
    calculatePositionalWeight,
    balanceLine,
    clearAllData,
    getCycleTime,
    getTasks,
    getLastBalancingResult,
    _setCycleTime,
    _getTasksRef
} = app;

console.log("--- STARTING ROBUSTNESS TEST SUITE ---");

function setup() {
    // Reset state before each test
    clearAllData();
}

function test_calculateCycleTime_validInputs() {
    console.log("Running test: calculateCycleTime_validInputs");
    setup();
    document.getElementById('daily-demand').value = '480';
    document.getElementById('production-time').value = '480'; // minutes
    calculateCycleTime();
    assert.strictEqual(getCycleTime().toFixed(2), '60.00', 'Test Failed: Takt time should be 60.00 seconds.');
    console.log("  ...PASSED");
}

function test_calculateCycleTime_invalidInputs() {
    console.log("Running test: calculateCycleTime_invalidInputs");
    setup();
    document.getElementById('daily-demand').value = '0';
    document.getElementById('production-time').value = '480';
    calculateCycleTime();
    assert.strictEqual(getCycleTime(), 0, 'Test Failed: Cycle time should remain 0 for invalid demand.');
    console.log("  ...PASSED");
}

function test_addTask_and_TotalWorkContent() {
    console.log("Running test: addTask_and_TotalWorkContent");
    setup();
    const mockEvent = {
        preventDefault: () => {},
        target: document.getElementById('task-form')
    };

    // Task A
    document.getElementById('task-id').value = 'A';
    document.getElementById('task-description').value = 'Task A';
    document.getElementById('gross-time').value = '50';
    document.getElementById('fatigue-factor').value = '10'; // Standard time = 55
    addTask(mockEvent);

    // Task B
    document.getElementById('task-id').value = 'B';
    document.getElementById('task-description').value = 'Task B';
    document.getElementById('gross-time').value = '20, 25'; // Avg = 22.5
    document.getElementById('fatigue-factor').value = '20'; // Standard time = 27
    document.getElementById('predecessor-task').value = 'A';
    addTask(mockEvent);

    assert.strictEqual(getTasks().length, 2, 'Test Failed: Should have 2 tasks.');
    const totalWork = getTasks().reduce((sum, task) => sum + task.standardTime, 0);
    assert.strictEqual(totalWork.toFixed(2), '82.00', 'Test Failed: Total work content should be 82.00.');
    console.log("  ...PASSED");
}

function test_calculateMinimumStations() {
    console.log("Running test: calculateMinimumStations");
    setup();

    _setCycleTime(60);

    const tasks = _getTasksRef();
    tasks.push({ id: 'A', standardTime: 55, predecessor: '-' });
    tasks.push({ id: 'B', standardTime: 27, predecessor: 'A' });

    calculateMinimumStations();

    // M = ceil(82 / 60) = ceil(1.36) = 2
    const resultHTML = document.getElementById('min-stations-result').innerHTML;
    assert.ok(resultHTML.includes('<strong>2</strong>'), 'Test Failed: Minimum stations should be 2.');
    console.log("  ...PASSED");
}

function test_balanceLine_positionalWeight() {
    console.log("Running test: balanceLine_positionalWeight");
    setup();
    _setCycleTime(60);

    const tasks = _getTasksRef();
    tasks.push({ id: 'A', description: 'Task A', standardTime: 30, predecessor: '-' });
    tasks.push({ id: 'B', description: 'Task B', standardTime: 25, predecessor: 'A' });
    tasks.push({ id: 'C', description: 'Task C', standardTime: 20, predecessor: 'A' });
    tasks.push({ id: 'D', description: 'Task D', standardTime: 15, predecessor: 'B,C' });

    // PW(D) = 15
    // PW(C) = 20 + PW(D) = 35
    // PW(B) = 25 + PW(D) = 40
    // PW(A) = 30 + PW(B) + PW(C) + PW(D) -> This is wrong. PW = self + all direct and indirect successors
    // Correct PW:
    // PW(D) = 15
    // PW(C) = 20 + 15 = 35
    // PW(B) = 25 + 15 = 40
    // PW(A) = 30 + 25 + 20 + 15 = 90

    assert.strictEqual(calculatePositionalWeight('D'), 15, 'Test Failed: PW for D should be 15');
    assert.strictEqual(calculatePositionalWeight('C'), 35, 'Test Failed: PW for C should be 35');
    assert.strictEqual(calculatePositionalWeight('B'), 40, 'Test Failed: PW for B should be 40');
    assert.strictEqual(calculatePositionalWeight('A'), 90, 'Test Failed: PW for A should be 90');

    balanceLine();

    // Expected Balancing:
    // PW Order: A (90), B (40), C (35), D (15)
    // Station 1: A (30s). Can't add B (30+25 > 60). Can't add C (30+20 < 60). Yes, add C. Total = 50s.
    //      Correction in logic: must add highest PW first.
    // Station 1: A (30s). Add next highest PW eligible: B (25s). Total = 55s.
    // Station 2: C (20s). Add next highest PW eligible: D (15s). Total = 35s.

    const balancingResult = getLastBalancingResult();
    assert.strictEqual(balancingResult.stations.length, 2, 'Test Failed: Should be 2 stations.');
    assert.strictEqual(balancingResult.stations[0].tasks.map(t => t.id).join(','), 'A,B', 'Test Failed: Station 1 should have A,B.');
    assert.strictEqual(balancingResult.stations[1].tasks.map(t => t.id).join(','), 'C,D', 'Test Failed: Station 2 should have C,D.');
    console.log("  ...PASSED");
}


// --- Execute Tests ---
try {
    test_calculateCycleTime_validInputs();
    test_calculateCycleTime_invalidInputs();
    test_addTask_and_TotalWorkContent();
    test_calculateMinimumStations();
    test_balanceLine_positionalWeight();
    console.log("\n--- ALL TESTS PASSED SUCCESSFULLY! ---");
} catch (error) {
    console.error("\n--- A TEST FAILED ---");
    console.error(error);
}
