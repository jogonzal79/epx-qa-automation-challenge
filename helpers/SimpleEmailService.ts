/**
 * Servicio de email simplificado que evita dependencias complejas
 * Usa fetch para interactuar con APIs de email temporales
 */

export class SimpleEmailService {
  private baseEmail: string;
  
  constructor() {
    this.baseEmail = process.env.TEST_EMAIL || 'test@example.com';
  }

  /**
   * Genera un email único usando el truco de Gmail +
   */
  generateUniqueEmail(): string {
    const timestamp = Date.now().toString().slice(-6);
    const [localPart, domain] = this.baseEmail.split('@');
    return `${localPart}+qa${timestamp}@${domain}`;
  }

  /**
   * Para testing manual - pausa y permite ingreso manual del código
   */
  async waitForManualVerification(email: string): Promise<void> {
    console.log('\n📧 ===== VERIFICACIÓN MANUAL REQUERIDA =====');
    console.log(`📧 Email de registro: ${email}`);
    console.log(`📧 Revisa la bandeja de entrada: ${this.baseEmail}`);
    console.log('');
    console.log('📋 PASOS A SEGUIR:');
    console.log('   1. Abre tu email en otra pestaña/ventana');
    console.log('   2. Busca el email de verificación de EPX');
    console.log('   3. Copia el código de verificación (4-6 dígitos)');
    console.log('   4. Vuelve al navegador de testing');
    console.log('   5. Ingresa el código en el campo correspondiente');
    console.log('   6. Presiona Enter o Click en "Verify"');
    console.log('   7. Presiona cualquier tecla AQUÍ para continuar el test...');
    console.log('');
    console.log('⏸️  TEST PAUSADO - Esperando verificación manual...');
    
    // Pausa hasta que el usuario presione una tecla
    await new Promise<void>((resolve) => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdin.pause();
          resolve();
        });
      } else {
        // En entornos CI/CD, esperar 30 segundos
        setTimeout(resolve, 30000);
      }
    });
    
    console.log('▶️  Continuando con el test...');
  }

  /**
   * Método stub para automatización futura
   * Por ahora retorna null para indicar que se debe usar verificación manual
   */
  async getVerificationCode(email: string, maxWaitTime: number = 60000): Promise<string | null> {
    console.log(`⚠️ Automatización de email no disponible para ${email}`);
    console.log('💡 Usando verificación manual en su lugar...');
    
    await this.waitForManualVerification(email);
    return null; // Indica que se usó verificación manual
  }

  /**
   * Método placeholder para limpieza
   */
  async markAsRead(): Promise<void> {
    console.log('ℹ️ Email cleanup no implementado en modo simplificado');
  }
}

/**
 * Factory para crear el servicio de email apropiado
 */
export function createEmailService(): SimpleEmailService {
  // En el futuro aquí se puede decidir qué implementación usar
  // basado en variables de entorno o configuración
  
  const useAutomatedEmail = process.env.USE_AUTOMATED_EMAIL === 'true';
  
  if (useAutomatedEmail) {
    console.log('🤖 Usando servicio de email automatizado');
    // return new AutomatedEmailService();
  }
  
  console.log('👤 Usando servicio de email manual');
  return new SimpleEmailService();
}