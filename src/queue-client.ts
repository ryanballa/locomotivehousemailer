import { EmailQueueItem, QueueListResponse, QueueResponse, MailerConfig, AuthMethod } from './types';

export class QueueClient {
  private apiBaseUrl: string;
  private authMethod: AuthMethod;
  private authToken?: string;
  private clerkRefreshToken?: string;

  constructor(config: MailerConfig) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.authMethod = config.authMethod;

    if (config.authMethod === 'clerk') {
      this.clerkRefreshToken = config.clerkRefreshToken;
    } else {
      this.authToken = config.apiJwtToken;
    }
  }

  private getAuthHeader(): string {
    if (this.authMethod === 'clerk') {
      if (!this.clerkRefreshToken) {
        throw new Error('Clerk refresh token not configured');
      }
      return `Bearer ${this.clerkRefreshToken}`;
    } else {
      if (!this.authToken) {
        throw new Error('JWT token not configured');
      }
      return `Bearer ${this.authToken}`;
    }
  }

  async getPendingEmails(limit: number = 10): Promise<EmailQueueItem[]> {
    try {
      const url = new URL('/api/email-queue/pending/list', this.apiBaseUrl);
      url.searchParams.set('limit', Math.min(limit, 100).toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch pending emails: ${response.status} ${response.statusText}`
        );
      }

      const result = (await response.json()) as QueueListResponse;
      return result.data || [];
    } catch (error) {
      console.error('Error fetching pending emails:', error);
      throw error;
    }
  }

  async markAsSent(emailId: number, resendId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/email-queue/${emailId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to mark email as sent: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(`Error marking email ${emailId} as sent:`, error);
      throw error;
    }
  }

  async markAsFailed(
    emailId: number,
    errorMessage: string,
    retryCount: number,
    maxRetries: number
  ): Promise<void> {
    try {
      const shouldRetry = retryCount < maxRetries;
      const status = shouldRetry ? 'pending' : 'failed';

      const response = await fetch(
        `${this.apiBaseUrl}/api/email-queue/${emailId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status,
            retry_count: retryCount + 1,
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to mark email as failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(`Error marking email ${emailId} as failed:`, error);
      throw error;
    }
  }

  async getQueueStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
  }> {
    try {
      const [pending, sent, failed] = await Promise.all([
        this.countByStatus('pending'),
        this.countByStatus('sent'),
        this.countByStatus('failed'),
      ]);

      return { pending, sent, failed };
    } catch (error) {
      console.error('Error fetching queue stats:', error);
      throw error;
    }
  }

  private async countByStatus(status: string): Promise<number> {
    const url = new URL('/api/email-queue/', this.apiBaseUrl);
    url.searchParams.set('status', status);
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return 0;
    }

    const result = (await response.json()) as QueueListResponse;
    // This is a rough count based on a single item
    // For accurate counts, the API would need a separate stats endpoint
    return result.data?.length || 0;
  }
}
