import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { CarlPage } from '../pages/CarlPage.js';
import users from '../fixtures/test-users.json' with { type: 'json' };

test.describe('Flujo C.A.R.L. – QA Automation', () => {
  test.setTimeout(90_000);

  const user = users[0];

  test('debe responder correctamente a una pregunta de networking @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);

    await test.step('Login en STG', async () => {
      await loginPage.goto();
      await loginPage.fillCredentials(user.email, user.password);
      await loginPage.submitLogin();
      // Evidencia rápida (screenshot)
      await page.screenshot({ path: 'test-results/login-success.png' });
    });

    await test.step('Ir a C.A.R.L. y realizar pregunta', async () => {
      await carlPage.goto();
      await carlPage.askQuestion('What networking events are available this week?');
      await page.screenshot({ path: 'test-results/carl-question.png' });
    });

    await test.step('Esperar y validar respuesta', async () => {
      const respuesta = await carlPage.waitForResponse();
      await carlPage.validateResponseContent(respuesta);
      // Guardar texto como archivo plano
      await page.context().tracing.stop({ path: 'test-results/carl-trace.zip' });
    });
  });
});
