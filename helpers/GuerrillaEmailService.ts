/**
 * Servicio de email usando Guerrilla Mail API
 * Completamente automatizado, sin configuración adicional
 */

interface GuerrillaEmailResponse {
  email_addr: string;
  email_timestamp: number;
  sid_token: string;
}

interface GuerrillaMessage {
  mail_id: string;
  mail_from: string;
  mail_subject: string;
  mail_excerpt: string;
  mail_timestamp: string;
  mail_read: number;
  mail_date: string;
}

interface MailContent {
  mail_body: string;
  mail_subject: string;
  mail_from: string;
}

export class GuerrillaEmailService {
  private baseUrl = 'https://api.guerrillamail.com/ajax.php';
  private sessionData: { email: string; sid_token: string } | null = null;

  async generateTemporaryEmail(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}?f=get_email_address`, {
        method: 'GET',
        headers: {
          'User-Agent': 'EPX-QA-Automation/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GuerrillaEmailResponse = await response.json();
      
      this.sessionData = {
        email: data.email_addr,
        sid_token: data.sid_token
      };

      console.log(`📧 Email temporal generado: ${data.email_addr}`);
      return data.email_addr;

    } catch (error) {
      console.error('❌ Error generando email temporal:', error);
      throw new Error('No se pudo generar email temporal');
    }
  }

  async getVerificationCode(expectedEmail: string, maxWaitTime: number = 120000): Promise<string> {
    if (!this.sessionData) {
      throw new Error('No hay sesión de email activa. Genera un email primero.');
    }

    console.log(`📧 Buscando código de verificación en ${this.sessionData.email}...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const messages = await this.getMessages();
        
        for (const message of messages) {
          if (this.isVerificationEmail(message)) {
            const mailContent = await this.getMessageContent(message.mail_id);
            const code = this.extractVerificationCode(mailContent.mail_body);
            
            if (code) {
              console.log(`✅ Código encontrado: ${code}`);
              return code;
            }
          }
        }
        
        console.log('⏳ Email no encontrado, esperando 5 segundos...');
        await this.sleep(5000);
        
      } catch (error) {
        console.warn('⚠️ Error buscando emails:', error);
        await this.sleep(3000);
      }
    }
    
    throw new Error(`❌ No se encontró código de verificación después de ${maxWaitTime/1000}s`);
  }

  private async getMessages(): Promise<GuerrillaMessage[]> {
    if (!this.sessionData) {
      throw new Error('No hay sesión activa');
    }

    const response = await fetch(
      `${this.baseUrl}?f=get_email_list&sid_token=${this.sessionData.sid_token}&offset=0`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'EPX-QA-Automation/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error obteniendo mensajes: ${response.status}`);
    }

    const data = await response.json();
    return data.list || [];
  }

  private async getMessageContent(mailId: string): Promise<MailContent> {
    if (!this.sessionData) {
      throw new Error('No hay sesión activa');
    }

    const response = await fetch(
      `${this.baseUrl}?f=fetch_email&sid_token=${this.sessionData.sid_token}&email_id=${mailId}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'EPX-QA-Automation/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error obteniendo contenido: ${response.status}`);
    }

    return await response.json();
  }

  private isVerificationEmail(message: GuerrillaMessage): boolean {
    const from = message.mail_from.toLowerCase();
    const subject = message.mail_subject.toLowerCase();
    const excerpt = message.mail_excerpt.toLowerCase();

    const isFromEPX = from.includes('epx') || from.includes('noreply') || from.includes('support');
    const isVerificationEmail = subject.includes('verification') || subject.includes('verify') || subject.includes('code') || subject.includes('confirm') || excerpt.includes('verification') || excerpt.includes('code');

    return isFromEPX && isVerificationEmail;
  }
  
  // =================================================================
  // FUNCIÓN DE EXTRACCIÓN DE CÓDIGO CORREGIDA Y MEJORADA
  // =================================================================
  private extractVerificationCode(emailBody: string): string | null {
    // Limpiar HTML y otros caracteres para quedarnos con texto plano
    const cleanText = emailBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Patrones de búsqueda, ordenados del más específico al más general.
    // Buscamos específicamente secuencias de 4 a 6 dígitos.
    const patterns = [
        /your verification code is[:\s]*(\d{4,6})/i, // "your verification code is 123456"
        /code[:\s]*(\d{4,6})/i,                      // "code: 123456"
        /\b(\d{4,6})\b/                               // Cualquier número de 4 a 6 dígitos aislado
    ];

    for (const pattern of patterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            const code = match[1];
            // Verificamos que sea puramente numérico y tenga la longitud correcta
            if (/^\d{4,6}$/.test(code)) {
                return code;
            }
        }
    }

    console.warn('⚠️ No se pudo extraer un código numérico del email:', cleanText.slice(0, 250));
    return null;
  }
  // =================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    if (this.sessionData) {
      console.log(`🧹 Sesión de email temporal limpia: ${this.sessionData.email}`);
      this.sessionData = null;
    }
  }

  getCurrentEmail(): string | null {
    return this.sessionData?.email || null;
  }
}