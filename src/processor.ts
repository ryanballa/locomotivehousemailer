import { EmailService } from './email-service';
import { QueueClient } from './queue-client';
import { EmailQueueItem, PollResult } from './types';

export class EmailProcessor {
  private emailService: EmailService;
  private queueClient: QueueClient;
  private maxBatchSize: number;
  private delayBetweenEmails: number; // milliseconds

  constructor(
    emailService: EmailService,
    queueClient: QueueClient,
    maxBatchSize: number = 10,
    delayBetweenEmails: number = 5000 // 5 second delay between emails
  ) {
    this.emailService = emailService;
    this.queueClient = queueClient;
    this.maxBatchSize = maxBatchSize;
    this.delayBetweenEmails = delayBetweenEmails;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processPendingEmails(): Promise<PollResult> {
    const result: PollResult = {
      processed: 0,
      failed: 0,
      errors: [],
    };

    try {
      const emails = await this.queueClient.getPendingEmails(this.maxBatchSize);

      if (emails.length === 0) {
        console.log('No pending emails to process');
        return result;
      }

      console.log(`Processing ${emails.length} pending emails with ${this.delayBetweenEmails}ms delay between sends`);

      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        await this.processEmail(email, result);

        // Add delay between emails (except after the last one)
        if (i < emails.length - 1) {
          console.log(`Waiting ${this.delayBetweenEmails}ms before next email...`);
          await this.sleep(this.delayBetweenEmails);
        }
      }

      return result;
    } catch (error) {
      console.error('Error in processPendingEmails:', error);
      throw error;
    }
  }

  private async processEmail(
    email: EmailQueueItem,
    result: PollResult
  ): Promise<void> {
    try {
      console.log(`Sending email ${email.id} to ${email.recipient_email}`);

      const sendResult = await this.emailService.sendEmail(email);
      await this.queueClient.markAsSent(email.id, sendResult.id);

      result.processed++;
      console.log(`Email ${email.id} sent successfully`);
    } catch (error) {
      result.failed++;

      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        emailId: email.id,
        error: errorMessage,
      });

      console.error(`Failed to send email ${email.id}:`, errorMessage);

      try {
        await this.queueClient.markAsFailed(
          email.id,
          errorMessage,
          email.retry_count,
          email.max_retries
        );
      } catch (updateError) {
        console.error(`Failed to update status for email ${email.id}:`, updateError);
      }
    }
  }

  async getQueueStats() {
    return this.queueClient.getQueueStats();
  }
}
