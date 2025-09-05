// test/carl-debug.spec.ts
import { test } from '@playwright/test';
import { CarlPage } from '../pages/CarlPage.js';

// Usar el storage state guardado
test.use({ 
  storageState: 'storageState.json' 
});

test.describe('DEBUG - C.A.R.L.', () => {
  test('debug - inspeccionar estructura del DOM y verificar envío', async ({ page }) => {
    test.setTimeout(60_000);
    
    const carl = new CarlPage(page);
    await carl.goto();
    
    // Esperar un poco para que todo se cargue
    await page.waitForTimeout(2000);
    
    // Debugging: Ver el estado inicial del chat
    console.log('\n🔍 === ESTADO INICIAL DEL CHAT ===\n');
    const initialText = await page.locator('.chat-wrapper, .carl-messages-height').first().innerText().catch(() => '');
    console.log(`Texto inicial: "${initialText.slice(0, 200)}..."`);
    
    // Verificar que el input esté funcionando
    console.log('\n🔍 === VERIFICANDO INPUT ===\n');
    
    // Buscar todos los posibles inputs
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
      '[role="textbox"]'
    ];
    
    for (const selector of inputSelectors) {
      const elements = await page.locator(selector).all();
      console.log(`Selector "${selector}": ${elements.length} elementos encontrados`);
      
      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const el = elements[i];
        const isVisible = await el.isVisible().catch(() => false);
        const placeholder = await el.getAttribute('placeholder').catch(() => '');
        const value = await el.inputValue().catch(() => '');
        
        console.log(`  [${i}] Visible: ${isVisible}, Placeholder: "${placeholder}", Value: "${value}"`);
      }
    }
    
    // Hacer una pregunta simple
    console.log('\n📝 === ENVIANDO PREGUNTA ===\n');
    await carl.askQuestion('Hello, can you help me?');
    
    // Esperar un poco para que aparezca la respuesta
    console.log('⏳ Esperando respuesta...');
    await page.waitForTimeout(10000);
    
    // Ver el estado del chat después de enviar
    console.log('\n🔍 === ESTADO DESPUÉS DE ENVIAR ===\n');
    const afterText = await page.locator('.chat-wrapper, .carl-messages-height').first().innerText().catch(() => '');
    console.log(`Longitud del texto antes: ${initialText.length}`);
    console.log(`Longitud del texto después: ${afterText.length}`);
    console.log(`Diferencia: ${afterText.length - initialText.length} caracteres`);
    
    if (afterText.length > initialText.length) {
      const newContent = afterText.substring(initialText.length);
      console.log(`\n📄 CONTENIDO NUEVO:\n"${newContent}"`);
    } else {
      console.log('⚠️ No se detectó contenido nuevo en el chat');
    }
    
    // Buscar todos los divs dentro del chat wrapper
    console.log('\n🔍 === ANALIZANDO ESTRUCTURA DE MENSAJES ===\n');
    const chatWrapper = page.locator('.chat-wrapper, .overflow-y-scroll').first();
    const childDivs = await chatWrapper.locator('> div').all();
    
    console.log(`Total de divs hijos: ${childDivs.length}`);
    
    for (let i = 0; i < childDivs.length; i++) {
      const div = childDivs[i];
      const text = await div.innerText().catch(() => '');
      const className = await div.getAttribute('class').catch(() => '');
      
      console.log(`\nDiv [${i}]:`);
      console.log(`  Clases: ${className || 'N/A'}`);
      console.log(`  Texto: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
      
      // Verificar si es un mensaje del usuario o del asistente
      if (text.includes('Hello, can you help me?')) {
        console.log(`  ✓ Este es el mensaje del USUARIO`);
      } else if (text.includes('Hello, Carla')) {
        console.log(`  ℹ️ Este es el mensaje inicial de C.A.R.L.`);
      } else if (text.length > 20 && !text.includes('Chat with C.A.R.L')) {
        console.log(`  🤖 Posible respuesta del asistente`);
      }
    }
    
    // Buscar botones de envío
    console.log('\n🔍 === BOTONES DE ENVÍO ===\n');
    const buttonSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("Ask")',
      'button:has(svg)'
    ];
    
    for (const selector of buttonSelectors) {
      const buttons = await page.locator(selector).all();
      console.log(`Selector "${selector}": ${buttons.length} botones encontrados`);
      
      for (let i = 0; i < Math.min(buttons.length, 3); i++) {
        const btn = buttons[i];
        const isVisible = await btn.isVisible().catch(() => false);
        const isDisabled = await btn.isDisabled().catch(() => false);
        const text = await btn.innerText().catch(() => '');
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
        
        console.log(`  [${i}] Visible: ${isVisible}, Disabled: ${isDisabled}, Text: "${text}", Aria: "${ariaLabel}"`);
      }
    }
    
    // Tomar screenshot
    await page.screenshot({ 
      path: 'test-results/debug-carl-dom.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot guardado: test-results/debug-carl-dom.png');
    
    // Guardar HTML completo
    const htmlContent = await page.content();
    const fs = await import('fs/promises');
    await fs.writeFile('test-results/debug-carl.html', htmlContent);
    console.log('📄 HTML completo guardado: test-results/debug-carl.html');
    
    // Intentar usar el método waitForResponse de CarlPage
    console.log('\n🔍 === PROBANDO waitForResponse ===\n');
    try {
      const response = await carl.waitForResponse({ timeoutMs: 5000 });
      console.log(`✓ Respuesta obtenida: "${response.slice(0, 200)}..."`);
    } catch (error) {
      console.log(`❌ Error al obtener respuesta: ${error}`);
    }
  });
});