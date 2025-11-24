import { Resend } from 'resend';
import { SendEmailPayload, EmailQueueItem } from './types';

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(apiKey: string, fromEmail: string, fromName: string) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
    this.fromName = fromName;
  }

  async sendEmail(email: EmailQueueItem): Promise<{ id: string }> {
    const from = this.fromName
      ? `${this.fromName} <${this.fromEmail}>`
      : this.fromEmail;

    const payload: SendEmailPayload = {
      to: email.recipient_email,
      subject: email.subject,
      text: email.body,
      html: email.html_body,
      from,
    };

    const result = await this.resend.emails.send(payload);

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    if (!result.data) {
      throw new Error('No email ID returned from Resend');
    }

    return { id: result.data.id };
  }

  getFromEmail(): string {
    return this.fromEmail;
  }
}
