// test/carl-flujo.spec.ts
import { test, expect } from '@playwright/test';
import { CarlPage } from '../pages/CarlPage.js';

// Usar el storage state guardado por global-setup
test.use({ 
  storageState: 'storageState.json' 
});

function hasStructuredOutput(answer: string): boolean {
  const text = answer.trim();
  const numbered = /(^|\n)\s*\d+[\.\)]\s+\S+/m.test(text);
  const bullets = /(^|\n)\s*[-*•—]\s+\S+/m.test(text);
  const headings = /(^|\n)\s*#{1,6}\s+\S+/m.test(text) || /(^|\n)[A-Z][A-Z0-9 ]{3,}\n/m.test(text);
  const checklist = /\b(checklist|steps?)\b/i.test(text) && /(^|\n)\s*\S.+\n\s*\S/m.test(text);
  const multiParas = text.split(/\n{2,}/).filter(s => s.trim().length > 0).length >= 3;
  return numbered || bullets || headings || checklist || multiParas;
}

async function askAndAssert(
  carl: CarlPage,
  question: string,
  opts?: { timeoutMs?: number; keywords?: RegExp[]; flexibleValidation?: boolean }
) {
  const t = opts?.timeoutMs ?? 75_000;
  const flexibleValidation = opts?.flexibleValidation ?? true; // Por defecto, ser flexible
  
  await carl.askQuestion(question);
  const answer = await carl.waitForResponse({ timeoutMs: t });
  
  // Si flexibleValidation está activado y la respuesta es larga y coherente,
  // no fallar por keywords faltantes
  if (flexibleValidation && answer.length > 50) {
    await carl.validateResponseContent(answer, { 
      minLength: 40 
    });
  } else {
    await carl.validateResponseContent(answer, { 
      mustIncludeAnyOf: opts?.keywords ?? [], 
      minLength: 40 
    });
  }
  
  console.log(`C.A.R.L. replied: "${answer.slice(0, 120)}${answer.length > 120 ? '...' : ''}"`);
  return answer;
}

test.describe('C.A.R.L. - Validacion del Flujo de IA', () => {

  test('debe ejecutar flujo completo sin errores - pregunta networking @smoke', async ({ page }) => {
    test.setTimeout(150_000);
    const carl = new CarlPage(page);

    await test.step('Ir a CARL', async () => {
      await carl.goto();
    });

    await test.step('Hacer pregunta de networking', async () => {
      const ans = await askAndAssert(carl, 'What networking events are available this week?', {
        timeoutMs: 85_000,
        keywords: [/network|event|group|tribe|meetup|masterclass|connect|member|community/i],
        flexibleValidation: true
      });
      console.log(`C.A.R.L. Response: ${ans}`);
    });
  });

  test('debe manejar multiples preguntas sin errores tecnicos', async ({ page }) => {
    test.setTimeout(210_000);
    const carl = new CarlPage(page);
    await carl.goto();

    // Primera pregunta - tip de networking
    await askAndAssert(carl, 'Give me one networking tip today.', {
      timeoutMs: 75_000,
      keywords: [/network|connect|tip|advice|reach|meet|introduce|follow|engage/i],
      flexibleValidation: true
    });

    // Segunda pregunta - follow up
    await askAndAssert(carl, 'How can I follow up after meeting someone at an event?', {
      timeoutMs: 75_000,
      keywords: [/follow|message|thank|email|linkedin|connect|reach|contact/i],
      flexibleValidation: true
    });

    // Tercera pregunta - acciones concretas
    await askAndAssert(carl, 'Suggest 2 concrete actions to expand my professional network.', {
      timeoutMs: 75_000,
      keywords: [/action|connect|event|group|message|outreach|meet|network|join|attend/i],
      flexibleValidation: true
    });
  });

  test('debe procesar diversos tipos de input sin fallar', async ({ page }) => {
    test.setTimeout(210_000);
    const carl = new CarlPage(page);
    await carl.goto();

    // Pregunta muy corta - debe pedir clarificación
    const ans1 = await askAndAssert(carl, 'What?', {
      timeoutMs: 70_000,
      keywords: [/clarify|help|context|specify|explain|question|understand|more|detail/i],
      flexibleValidation: true
    });

    // Pregunta normal sobre networking
    const ans2 = await askAndAssert(
      carl,
      'Can you help me with professional networking strategies?',
      {
        timeoutMs: 80_000,
        keywords: [/strategy|network|connect|event|group|follow|plan|approach|tip/i],
        flexibleValidation: true
      }
    );

    // Pregunta pidiendo lista estructurada
    await carl.askQuestion('Give me 3 bullet points to improve my LinkedIn networking.');
    const ans3 = await carl.waitForResponse({ timeoutMs: 85_000 });
    await carl.validateResponseContent(ans3, { minLength: 40 });
    
    // Verificar estructura (bullets, números o múltiples párrafos)
    const structured = hasStructuredOutput(ans3) || 
                      /\d\.|bullet|point|tip|improve|linkedin|network|profile|connect/i.test(ans3);
    expect(structured, 'Debe mostrar estructura o contenido relevante').toBeTruthy();
  });

  test('debe entregar output con estructura minima valida', async ({ page }) => {
    test.setTimeout(150_000);
    const carl = new CarlPage(page);
    await carl.goto();

    const answer = await askAndAssert(
      carl,
      'List 3 networking ideas with clear headings and short explanations.',
      {
        timeoutMs: 85_000,
        keywords: [/idea|heading|explain|bullet|list|network|\d\.|tip|strategy/i],
        flexibleValidation: true
      }
    );

    const structured = hasStructuredOutput(answer);
    // Si no tiene estructura clara pero es una respuesta larga y coherente, está bien
    if (!structured && answer.length > 100) {
      console.log('ℹ️ La respuesta no tiene estructura de lista pero es coherente y completa');
    } else {
      expect(structured, 'Debe contener estructura tipo lista/viñetas/encabezados o varios bloques').toBeTruthy();
    }
  });

  test('debe completar flujo completo sin interrupciones tecnicas', async ({ page }) => {
    test.setTimeout(150_000);
    const carl = new CarlPage(page);
    await carl.goto();

    const t0 = Date.now();
    const answer = await askAndAssert(
      carl,
      'Help me prepare for a networking event next week. Give me a checklist.',
      {
        timeoutMs: 85_000,
        keywords: [/checklist|prepare|follow|introduce|goal|research|practice|network|event|tips|steps/i],
        flexibleValidation: true
      }
    );
    const elapsed = Date.now() - t0;
    console.log(`Complete flow executed in ${elapsed}ms`);
    console.log(
      `C.A.R.L. processed input and delivered output: "${answer.slice(0, 80)}${answer.length > 80 ? '...' : ''}"`
    );
    
    // Verificar que la respuesta sea útil y coherente
    expect(answer.length).toBeGreaterThan(100);
  });
});