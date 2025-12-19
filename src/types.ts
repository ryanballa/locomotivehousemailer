export interface EmailQueueItem {
  id: number;
  recipient_email: string;
  subject: string;
  body: string;
  html_body?: string;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  max_retries: number;
  last_error?: string;
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export type AuthMethod = 'jwt' | 'clerk';

export interface MailerConfig {
  apiBaseUrl: string;
  clientBaseUrl: string;
  authMethod: AuthMethod;
  apiJwtToken?: string;
  clerkRefreshToken?: string;
  apiKey?: string;
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  pollIntervalMs: number;
  maxBatchSize: number;
}

export interface QueueResponse<T> {
  data: T;
}

export interface QueueListResponse {
  data: EmailQueueItem[];
}

export interface PollResult {
  processed: number;
  failed: number;
  errors: Array<{
    emailId: number;
    error: string;
  }>;
}

export interface Tower {
  id: number;
  name: string;
  owner_id?: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  token?: string;
  permission?: number;
}

export interface Report {
  id: number;
  tower_id: number;
  year: number;
  month: number;
  created_at: string;
  updated_at: string;
}

export interface TowerWithMissingReport extends Tower {
  hasReport: boolean;
}

export interface TowerWithOwnerEmail extends Tower {
  ownerEmail?: string;
  ownerName?: string;
}

export interface Env {
  RESEND_API_KEY: string;
  API_BASE_URL?: string;
  CLIENT_BASE_URL?: string;
  API_KEY?: string;
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  POLL_INTERVAL_MS?: string;

  // Auth method 1: JWT
  API_JWT_TOKEN?: string;

  // Auth method 2: Clerk
  CLERK_REFRESH_TOKEN?: string;
  AUTH_METHOD?: 'jwt' | 'clerk';

  // Token refresh (Clerk)
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  SERVICE_USER_ID?: string;
}
