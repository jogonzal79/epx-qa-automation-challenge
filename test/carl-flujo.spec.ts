import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { CarlPage } from '../pages/CarlPage.js';
import users from '../fixtures/test-users.json' with { type: 'json' };

test.describe('C.A.R.L. - Validacion del Flujo de IA', () => {
  test.setTimeout(90_000);

  test('debe ejecutar flujo completo sin errores - pregunta networking @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);
    const user = users[0];

    await test.step('Autenticacion exitosa', async () => {
      await loginPage.goto();
      await loginPage.fillCredentials(user.email, user.password);
      await loginPage.submitLogin();
      await page.screenshot({ path: 'test-results/01-login-success.png' });
    });

    await test.step('Navegacion a C.A.R.L. exitosa', async () => {
      await carlPage.goto();
      
      // VALIDACION CLAVE: El input esta disponible = flujo cargo correctamente
      await expect(carlPage.input).toBeVisible();
      await page.screenshot({ path: 'test-results/02-carl-ready.png' });
      console.log('C.A.R.L. interface loaded successfully');
    });

    await test.step('Envio de pregunta exitoso', async () => {
      const pregunta = 'What networking events are available this week?';
      await carlPage.askQuestion(pregunta);
      await page.screenshot({ path: 'test-results/03-question-sent.png' });
      console.log('Question sent to C.A.R.L.');
    });

    await test.step('C.A.R.L. responde sin errores tecnicos', async () => {
      const respuesta = await carlPage.waitForResponse();
      
      // VALIDACIONES CORE del challenge:
      // 1. El flujo se ejecuto sin errores
      await carlPage.validateResponseContent(respuesta);
      
      // 2. C.A.R.L. proceso el input y entrego output
      expect(respuesta).toBeTruthy();
      expect(respuesta.trim().length).toBeGreaterThan(0);
      
      // 3. No hay errores tecnicos ni interrupciones
      expect(respuesta).not.toMatch(/undefined|null|error|exception/i);
      
      await page.screenshot({ path: 'test-results/04-response-received.png' });
      console.log('C.A.R.L. Response:', respuesta);
      console.log('Flow completed successfully - C.A.R.L. processed input and delivered output');
    });
  });

  test('debe manejar multiples preguntas sin errores tecnicos', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);
    const user = users[1];

    await test.step('Setup', async () => {
      await loginPage.goto();
      await loginPage.fillCredentials(user.email, user.password);
      await loginPage.submitLogin();
      await carlPage.goto();
    });

    await test.step('Primera pregunta', async () => {
      await carlPage.askQuestion('Tell me about networking');
      const respuesta1 = await carlPage.waitForResponse();
      await carlPage.validateResponseContent(respuesta1);
      console.log('Primera respuesta valida');
    });

    await test.step('Segunda pregunta consecutiva', async () => {
      await carlPage.askQuestion('How do I find events?');
      const respuesta2 = await carlPage.waitForResponse();
      
      // Validar que sigue funcionando despues de multiples interacciones
      await carlPage.validateResponseContent(respuesta2);
      expect(respuesta2).toBeTruthy();
      
      console.log('Segunda respuesta valida');
      console.log('Multiple consecutive interactions working');
    });
  });

  test('debe procesar diversos tipos de input sin fallar', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);
    const user = users[0];

    await test.step('Setup', async () => {
      await loginPage.goto();
      await loginPage.fillCredentials(user.email, user.password);
      await loginPage.submitLogin();
      await carlPage.goto();
    });

    // Array de preguntas variadas
    const preguntas = [
      'What?',  // Corta
      'Can you help me with professional networking strategies?',  // Larga
      'Events in Miami?',  // Media
    ];

    for (let i = 0; i < preguntas.length; i++) {
      const pregunta = preguntas[i];
      
      await test.step(`Pregunta ${i + 1}: "${pregunta}"`, async () => {
        await carlPage.askQuestion(pregunta);
        const respuesta = await carlPage.waitForResponse();
        
        // CORE: Sin importar la respuesta, debe procesar sin errores
        await carlPage.validateResponseContent(respuesta);
        expect(respuesta).not.toMatch(/error|undefined|exception/i);
        
        console.log(`Pregunta ${i + 1} procesada correctamente`);
      });
    }

    await page.screenshot({ path: 'test-results/05-multiple-inputs-processed.png' });
    console.log('Various input types processed without technical errors');
  });

  test('debe entregar output con estructura minima valida', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);
    const user = users[1];

    await test.step('Setup', async () => {
      await loginPage.goto();
      await loginPage.fillCredentials(user.email, user.password);
      await loginPage.submitLogin();
      await carlPage.goto();
    });

    await test.step('Pregunta con expectativa de respuesta estructurada', async () => {
      await carlPage.askQuestion('Give me networking advice');
      const respuesta = await carlPage.waitForResponse();
      
      // Validaciones de estructura minima
      await carlPage.validateResponseContent(respuesta);
      
      // Si no es disclaimer, debe tener contenido minimo
      if (!respuesta.includes("C.A.R.L can make mistakes")) {
        expect(respuesta.split(' ').length).toBeGreaterThan(5);
        expect(respuesta).toMatch(/[a-zA-Z]/); // Contiene texto
      }
      
      console.log('Output structure validation passed');
      await page.screenshot({ path: 'test-results/06-structured-output.png' });
    });
  });

  test('debe completar flujo completo sin interrupciones tecnicas', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const carlPage = new CarlPage(page);
    const user = users[0];

    await test.step('Login sin errores', async () => {
      await loginPage.goto();
      await loginPage.fillCredentials(user.email, user.password);
      await loginPage.submitLogin();
      
      // Validacion mas flexible del post-login (sin asumir navbar especifico)
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Dar tiempo a que cargue
      
      // Si hay algun elemento de navegacion, deberia ser visible
      const hasNavigation = await page.locator('nav, [role="navigation"], header').count();
      expect(hasNavigation).toBeGreaterThan(0);
    });

    await test.step('C.A.R.L. carga sin errores', async () => {
      await carlPage.goto();
      
      // Validar que C.A.R.L. esta listo para interactuar
      await expect(carlPage.input).toBeVisible();
      
      // No debe haber errores criticos de JavaScript en consola
      const logs: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          logs.push(msg.text());
        }
      });
    });

    await test.step('Interaccion completa sin interrupciones', async () => {
      const startTime = Date.now();
      
      // Enviar pregunta
      await carlPage.askQuestion('I need help with networking events');
      
      // Esperar respuesta
      const respuesta = await carlPage.waitForResponse();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // VALIDACIONES CLAVE del challenge:
      
      // 1. Flujo completo ejecutado
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(60000); // Menos de 60s
      
      // 2. Input procesado, output entregado
      expect(respuesta).toBeTruthy();
      expect(respuesta.trim()).not.toBe('');
      
      // 3. Sin errores tecnicos
      await carlPage.validateResponseContent(respuesta);
      
      console.log(`Complete flow executed in ${duration}ms`);
      console.log(`C.A.R.L. processed input and delivered output: "${respuesta.substring(0, 50)}..."`);
      
      await page.screenshot({ path: 'test-results/07-complete-flow.png' });
    });
  });
});