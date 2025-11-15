const { test, expect } = require('@playwright/test');

test.describe('Line Balancing App E2E Tests', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should load the page and display the main heading', async () => {
    await expect(page.locator('h1')).toHaveText('Módulo de Balanceo de Líneas');
  });

  test('should perform a full line balancing calculation', async () => {
    // Fill in production parameters
    await page.fill('#daily-demand', '100');
    await page.fill('#production-time', '480');
    await page.click('button:has-text("Calcular Tiempo de Ciclo")');
    await expect(page.locator('#cycle-time-result')).toContainText('288.00');

    // Add a task
    await page.fill('#task-id', 'A');
    await page.fill('#task-description', 'Task A');
    await page.fill('#gross-time', '30');
    await page.fill('#fatigue-factor', '10');
    await page.click('button:has-text("Agregar Tarea")');
    await expect(page.locator('#tasks-table tbody tr')).toHaveCount(1);

    // Calculate minimum stations
    await page.click('button:has-text("Calcular Estaciones Mínimas")');
    await expect(page.locator('#min-stations-result')).toContainText('1');

    // Balance the line
    await page.click('button:has-text("Realizar Balanceo")');
    await expect(page.locator('#balancing-results')).toContainText('Estación 1');
  });
});