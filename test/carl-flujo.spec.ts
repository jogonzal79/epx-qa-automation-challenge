import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { CarlPage } from '../pages/CarlPage.js';
import users from '../fixtures/test-users.json' with { type: 'json' };

test.describe('Flujo C.A.R.L. – QA Automation', () => {
  test.setTimeout(90_000);

  const user = users[0];

  test('debe responder correctamente a una pregunta de networking', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);

    await loginPage.goto();
    await loginPage.fillCredentials(user.email, user.password);
    await loginPage.submitLogin();

    await carlPage.goto();
    await carlPage.askQuestion('What networking events are available this week?');
    const respuesta = await carlPage.waitForResponse();
    await carlPage.validateResponseContent(respuesta);
  });
});
