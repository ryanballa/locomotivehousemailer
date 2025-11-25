import { Hono } from 'hono';
import { createClerkClient } from '@clerk/backend';
import { EmailService } from './email-service';
import { QueueClient } from './queue-client';
import { ClubsClient } from './clubs-client';
import { EmailProcessor } from './processor';
import { Env, MailerConfig, PollResult } from './types';
import { setupTokenRefreshRoutes } from './token-refresh-handler';
import { ClerkTokenRefresher } from './clerk-token-refresher';

const app = new Hono<{ Bindings: Env }>();

// Middleware for Clerk authentication on protected routes
const clerkAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);
  const env = c.env as Env;

  try {
    const authMethod = env.AUTH_METHOD || 'jwt';

    if (authMethod === 'clerk') {
      // For Clerk auth, verify the token with Clerk if secret key is available
      if (env.CLERK_SECRET_KEY) {
        const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
        try {
          // Verify the JWT token signature with Clerk
          const decoded = await client.verifyToken(token);
          c.set('user', decoded);
        } catch (error) {
          return c.json({ error: 'Unauthorized: Invalid Clerk token' }, 401);
        }
      } else {
        // Clerk mode but no secret key - accept any bearer token (for development)
        console.warn('Clerk auth mode but CLERK_SECRET_KEY not set - accepting any bearer token');
      }
    } else if (authMethod === 'jwt') {
      // For JWT auth, validate against API_JWT_TOKEN
      if (token !== env.API_JWT_TOKEN) {
        return c.json({ error: 'Unauthorized: Invalid JWT token' }, 401);
      }
    } else {
      return c.json({ error: 'Unauthorized: Invalid AUTH_METHOD configuration' }, 401);
    }

    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Unauthorized: Authentication failed' }, 401);
  }
};

// Setup token refresh endpoints
setupTokenRefreshRoutes(app, clerkAuth);

function getConfig(env: Env): MailerConfig {
  const authMethod = (env.AUTH_METHOD || 'jwt') as 'jwt' | 'clerk';

  if (authMethod === 'clerk' && !env.CLERK_REFRESH_TOKEN) {
    throw new Error('AUTH_METHOD is set to clerk but CLERK_REFRESH_TOKEN is not configured');
  }

  if (authMethod === 'jwt' && !env.API_JWT_TOKEN) {
    throw new Error('AUTH_METHOD is set to jwt but API_JWT_TOKEN is not configured');
  }

  return {
    apiBaseUrl: env.API_BASE_URL || 'http://localhost:8787',
    authMethod,
    apiJwtToken: env.API_JWT_TOKEN,
    clerkRefreshToken: env.CLERK_REFRESH_TOKEN,
    resendApiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL || 'noreply@example.com',
    fromName: env.FROM_NAME || 'Locomotive House',
    pollIntervalMs: parseInt(env.POLL_INTERVAL_MS || '5000', 10),
    maxBatchSize: 10,
  };
}

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manual trigger to process pending emails (requires authentication)
app.post('/process', clerkAuth, async (c) => {
  try {
    const env = c.env;
    const config = getConfig(env);

    const emailService = new EmailService(
      config.resendApiKey,
      config.fromEmail,
      config.fromName
    );
    const queueClient = new QueueClient(config);
    const processor = new EmailProcessor(emailService, queueClient, config.maxBatchSize);

    const result = await processor.processPendingEmails();

    return c.json(
      {
        success: true,
        message: 'Email processing completed',
        result,
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    console.error('Error processing emails:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Get queue statistics (requires authentication)
app.get('/stats', clerkAuth, async (c) => {
  try {
    const env = c.env;
    const config = getConfig(env);

    const queueClient = new QueueClient(config);
    const stats = await queueClient.getQueueStats();

    return c.json(
      {
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    console.error('Error fetching stats:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Get towers missing reports for a specific club and month (requires authentication)
app.get('/admin/clubs/:clubId/missing-reports', clerkAuth, async (c) => {
  try {
    const env = c.env;
    const config = getConfig(env);
    const clubId = parseInt(c.req.param('clubId'), 10);

    // Get current date or from query params
    const today = new Date();
    const year = parseInt(c.req.query('year') || today.getFullYear().toString(), 10);
    const month = parseInt(c.req.query('month') || (today.getMonth() + 1).toString(), 10);

    // Validate inputs
    if (isNaN(clubId) || clubId <= 0) {
      return c.json(
        {
          success: false,
          error: 'Invalid clubId parameter',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return c.json(
        {
          success: false,
          error: 'Invalid year parameter (must be between 2000 and 2100)',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return c.json(
        {
          success: false,
          error: 'Invalid month parameter (must be between 1 and 12)',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    const clubsClient = new ClubsClient(config);
    const towersLackingReports = await clubsClient.findTowersLackingReportsWithOwnerEmail(
      clubId,
      year,
      month
    );

    return c.json(
      {
        success: true,
        clubId,
        year,
        month,
        towersWithoutReports: towersLackingReports,
        count: towersLackingReports.length,
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    console.error('Error fetching towers missing reports:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Get configuration (without secrets)
app.get('/config', (c) => {
  const env = c.env;
  const config = getConfig(env);

  return c.json({
    apiBaseUrl: config.apiBaseUrl,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    pollIntervalMs: config.pollIntervalMs,
    maxBatchSize: config.maxBatchSize,
  });
});

// Scheduled worker trigger (configure in wrangler.toml)
async function handleSchedule(env: Env): Promise<void> {
  const scheduleCron = (env as any).CRON || '';

  // Check if this is a token refresh cron job
  if (scheduleCron.includes('token-refresh')) {
    await handleTokenRefresh(env);
    return;
  }

  // Otherwise, process emails
  await handleEmailProcessing(env);
}

async function handleEmailProcessing(env: Env): Promise<void> {
  const config = getConfig(env);

  const emailService = new EmailService(
    config.resendApiKey,
    config.fromEmail,
    config.fromName
  );
  const queueClient = new QueueClient(config);
  const processor = new EmailProcessor(emailService, queueClient, config.maxBatchSize);

  try {
    console.log('Running scheduled email processing');
    const result = await processor.processPendingEmails();
    console.log('Scheduled processing result:', result);
  } catch (error) {
    console.error('Error in scheduled email handler:', error);
  }
}

async function handleTokenRefresh(env: Env): Promise<void> {
  try {
    const clerkSecretKey = env.CLERK_SECRET_KEY;
    const serviceUserId = env.SERVICE_USER_ID;

    if (!clerkSecretKey || !serviceUserId) {
      console.error(
        'Token refresh scheduled but CLERK_SECRET_KEY or SERVICE_USER_ID not configured'
      );
      return;
    }

    console.log('Running scheduled Clerk token refresh');

    const refresher = new ClerkTokenRefresher({
      clerkSecretKey,
      serviceUserId,
    });

    const result = await refresher.refreshToken();

    if (result.success) {
      console.log('✓ Token refresh successful');
      console.log(`New token expires at: ${result.expiresAt}`);
      console.log(
        'Remember to update CLERK_REFRESH_TOKEN secret: wrangler secret put CLERK_REFRESH_TOKEN --env production'
      );
    } else {
      console.error(`✗ Token refresh failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error in scheduled token refresh handler:', error);
  }
}

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env) => {
    await handleSchedule(env);
  },
};
