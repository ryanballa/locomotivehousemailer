import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from './email-service';
import { QueueClient } from './queue-client';
import { EmailProcessor } from './processor';
import { MailerConfig, EmailQueueItem } from './types';

describe('Email Mailer', () => {
  describe('EmailService', () => {
    it('should initialize with correct from address', () => {
      const service = new EmailService('test-key', 'test@example.com', 'Test');
      expect(service.getFromEmail()).toBe('test@example.com');
    });
  });

  describe('QueueClient', () => {
    it('should initialize with config', () => {
      const config: MailerConfig = {
        apiBaseUrl: 'http://localhost:8787',
        apiJwtToken: 'test-token',
        resendApiKey: 'test-key',
        fromEmail: 'test@example.com',
        fromName: 'Test',
        pollIntervalMs: 5000,
        maxBatchSize: 10,
      };

      const client = new QueueClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('EmailProcessor', () => {
    it('should handle empty email list', async () => {
      const config: MailerConfig = {
        apiBaseUrl: 'http://localhost:8787',
        apiJwtToken: 'test-token',
        resendApiKey: 'test-key',
        fromEmail: 'test@example.com',
        fromName: 'Test',
        pollIntervalMs: 5000,
        maxBatchSize: 10,
      };

      const emailService = new EmailService(
        config.resendApiKey,
        config.fromEmail,
        config.fromName
      );
      const queueClient = new QueueClient(config);

      // Mock getPendingEmails to return empty array
      vi.spyOn(queueClient, 'getPendingEmails').mockResolvedValue([]);

      const processor = new EmailProcessor(emailService, queueClient);
      const result = await processor.processPendingEmails();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
