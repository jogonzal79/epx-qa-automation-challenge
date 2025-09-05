export class CaptchaService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.CAPTCHA_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('CAPTCHA_API_KEY not found in environment variables');
    }
  }
  
  async solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
    console.log('Submitting reCAPTCHA to 2captcha service...');
    
    const taskId = await this.submitCaptcha(siteKey, pageUrl);
    console.log(`Task ID: ${taskId}`);
    
    const solution = await this.waitForSolution(taskId);
    console.log('Captcha solved successfully');
    
    return solution;
  }
  
  private async submitCaptcha(siteKey: string, pageUrl: string): Promise<string> {
    const response = await fetch('http://2captcha.com/in.php', {
      method: 'POST',
      body: new URLSearchParams({
        key: this.apiKey,
        method: 'userrecaptcha',
        googlekey: siteKey,
        pageurl: pageUrl,
        json: '1'
      })
    });
    
    const result = await response.json();
    
    if (result.status !== 1) {
      throw new Error(`Captcha submission failed: ${result.error_text}`);
    }
    
    return result.request;
  }
  
  private async waitForSolution(taskId: string, maxAttempts = 24): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const response = await fetch(`http://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${taskId}&json=1`);
      const result = await response.json();
      
      if (result.status === 1) {
        return result.request;
      }
      
      if (result.error_text && result.error_text !== 'CAPCHA_NOT_READY') {
        throw new Error(`Captcha solving failed: ${result.error_text}`);
      }
      
      console.log(`Waiting for captcha solution... attempt ${i + 1}/${maxAttempts}`);
    }
    
    throw new Error('Captcha solving timeout after 2 minutes');
  }
}