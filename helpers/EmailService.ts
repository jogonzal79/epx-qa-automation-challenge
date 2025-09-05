export class EmailService {
  private testEmail: string;
  
  constructor() {
    this.testEmail = process.env.TEST_EMAIL || '';
    if (!this.testEmail) {
      throw new Error('TEST_EMAIL not found in environment variables');
    }
  }
  
  async waitForManualVerificationCode(): Promise<void> {
    console.log('\n📧 MANUAL STEP: Check email and enter verification code');
    console.log(`📧 Check: ${this.testEmail}`);
    console.log('⏸️  Paused for manual verification code entry...');
    console.log('   1. Check the test email for 4-digit code');
    console.log('   2. Enter code in the browser');
    console.log('   3. Click "Let\'s go!" button');
    console.log('   4. Press any key here to continue test...');
    
    return new Promise((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
  }
}