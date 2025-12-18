import { createClerkClient } from '@clerk/backend';

export interface TokenRefreshConfig {
  clerkSecretKey: string;
  serviceUserId: string;
  tokenExpirationSeconds?: number;
}

export interface RefreshResult {
  success: boolean;
  newToken?: string;
  error?: string;
  expiresAt?: string;
  timestamp: string;
}

/**
 * Clerk Token Refresher
 *
 * Automatically generates new Clerk refresh tokens on a schedule.
 * Can be called via scheduled Cloudflare cron or via HTTP endpoint.
 *
 * Usage:
 * 1. Set up CLERK_SECRET_KEY environment variable
 * 2. Set up SERVICE_USER_ID (from Clerk dashboard)
 * 3. Call refreshToken() on a schedule
 * 4. Update CLERK_REFRESH_TOKEN secret with the new token
 */
export class ClerkTokenRefresher {
  private clerkClient: ReturnType<typeof createClerkClient>;
  private serviceUserId: string;
  private tokenExpirationSeconds: number;

  constructor(config: TokenRefreshConfig) {
    this.clerkClient = createClerkClient({
      secretKey: config.clerkSecretKey,
    });
    this.serviceUserId = config.serviceUserId;
    this.tokenExpirationSeconds = config.tokenExpirationSeconds || 2592000; // 30 days
  }

  /**
   * Generate a new Clerk refresh token
   */
  async refreshToken(): Promise<RefreshResult> {
    try {
      console.log(`[Token Refresh] Generating new token for user ${this.serviceUserId}`);

      // Step 1: Create a session for the service user
      const sessionData = await this.clerkClient.sessions.createSession({
        userId: this.serviceUserId,
      });

      // Step 2: Get a token from that session
      const token = await this.clerkClient.sessions.getToken(
        sessionData.id,
        undefined,
        this.tokenExpirationSeconds
      );

      if (!token || !token.jwt) {
        throw new Error('No token returned from Clerk API');
      }

      const expiresAt = new Date(
        Date.now() + this.tokenExpirationSeconds * 1000
      ).toISOString();

      console.log(`[Token Refresh] ✓ New token generated, expires at ${expiresAt}`);

      return {
        success: true,
        newToken: token.jwt,
        expiresAt,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Token Refresh] ✗ Failed to refresh token: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if a token needs refreshing (within 7 days of expiry)
   * This helps with proactive rotation
   */
  static shouldRefresh(expiryDate: Date): boolean {
    const now = new Date();
    const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7; // Refresh if less than 7 days until expiry
  }
}

/**
 * Helper function to get refresh schedule recommendations
 */
export function getRefreshSchedule(expirationDays: number = 30): {
  recommended: string;
  explanation: string;
} {
  // Recommend refreshing every N days (default: every 20 days for 30-day tokens)
  const refreshDays = Math.max(Math.floor(expirationDays * 0.67), 1);

  const cronSchedules = {
    1: '0 0 * * *', // Daily: at midnight
    3: '0 0 */3 * *', // Every 3 days
    7: '0 0 * * 0', // Weekly: Sundays at midnight
    14: '0 0 1,15 * *', // Bi-weekly: 1st and 15th
    20: '0 2 * * 0,3', // Twice weekly: Sun & Wed at 2am
    30: '0 2 * * 0', // Weekly: Sundays at 2am
  };

  const closestSchedule = Object.entries(cronSchedules).reduce((prev, curr) => {
    const [days] = curr;
    return Math.abs(parseInt(days) - refreshDays) < Math.abs(parseInt(prev[0]) - refreshDays)
      ? curr
      : prev;
  });

  return {
    recommended: closestSchedule[1],
    explanation: `For ${expirationDays}-day tokens, refresh every ${closestSchedule[0]} days using cron: ${closestSchedule[1]}`,
  };
}
