# Locomotive House Email Mailer

A Cloudflare Workers application that polls the Locomotive House email queue API and sends emails using Resend.

## Overview

This worker processes pending emails from the email queue in the Locomotive House API and sends them via Resend. It includes:

- **Queue polling**: Regularly fetches pending emails from the API
- **Email sending**: Uses Resend to deliver emails reliably
- **Retry logic**: Automatically retries failed emails with configurable limits
- **Error handling**: Detailed error tracking and reporting
- **Health monitoring**: Endpoints to check worker status and queue statistics

## Architecture

```
┌──────────────────────────┐
│   Locomotive House API   │ (email queue storage)
└──────────────┬───────────┘
               │
               │ (HTTP REST API)
               │
┌──────────────▼───────────┐
│  Email Mailer Worker     │ (Cloudflare Workers)
│  ├─ Queue Client         │
│  ├─ Email Service        │
│  └─ Email Processor      │
└──────────────┬───────────┘
               │
               │ (Resend API)
               │
┌──────────────▼───────────┐
│   Resend Email Service   │ (email delivery)
└──────────────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Choose your authentication method and fill in the required values:

**Option A: JWT Authentication (default)**

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
AUTH_METHOD=jwt
API_JWT_TOKEN=your_jwt_token_here
API_BASE_URL=http://localhost:8787
FROM_EMAIL=noreply@locomotivehouse.com
FROM_NAME=Locomotive House
```

**Option B: Clerk Refresh Token Authentication**

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
AUTH_METHOD=clerk
CLERK_REFRESH_TOKEN=your_clerk_refresh_token_here
API_BASE_URL=http://localhost:8787
FROM_EMAIL=noreply@locomotivehouse.com
FROM_NAME=Locomotive House
```

See [`CLERK_SETUP.md`](./CLERK_SETUP.md) for detailed Clerk configuration.

### 3. Development Setup

Start the local development server:

```bash
npm run dev
```

The worker will start on `http://localhost:8787`

### 4. Testing Locally

Test the health check:

```bash
curl http://localhost:8787/health
```

Manually trigger email processing:

```bash
curl -X POST http://localhost:8787/process
```

Get queue statistics:

```bash
curl http://localhost:8787/stats
```

## Deployment

### Prerequisites

- Cloudflare account
- `wrangler` CLI installed and authenticated

### Deploy to Production

```bash
npm run deploy
```

### Configure Secrets

Set the required secrets in production:

```bash
wrangler secret put RESEND_API_KEY --env production
wrangler secret put API_JWT_TOKEN --env production
```

### Schedule Worker Execution

Update `wrangler.toml` to add a scheduled trigger:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Run every 5 minutes
```

Then redeploy:

```bash
npm run deploy
```

## API Endpoints

### Health Check

**GET** `/health`

Returns the worker's status.

```bash
curl http://localhost:8787/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-22T15:30:00.000Z"
}
```

### Process Pending Emails

**POST** `/process`

Manually trigger email processing. The worker will:
1. Fetch pending emails from the queue API
2. Send each email via Resend
3. Update the queue with success/failure status

```bash
curl -X POST http://localhost:8787/process
```

Response:
```json
{
  "success": true,
  "message": "Email processing completed",
  "result": {
    "processed": 5,
    "failed": 0,
    "errors": []
  },
  "timestamp": "2025-11-22T15:30:00.000Z"
}
```

### Get Queue Statistics

**GET** `/stats`

Returns statistics about the email queue.

```bash
curl http://localhost:8787/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "pending": 10,
    "sent": 150,
    "failed": 2
  },
  "timestamp": "2025-11-22T15:30:00.000Z"
}
```

### Get Configuration

**GET** `/config`

Returns the current configuration (without secrets).

```bash
curl http://localhost:8787/config
```

Response:
```json
{
  "apiBaseUrl": "http://localhost:8787",
  "fromEmail": "noreply@locomotivehouse.com",
  "fromName": "Locomotive House",
  "pollIntervalMs": 5000,
  "maxBatchSize": 10
}
```

## How It Works

### Email Processing Flow

1. **Polling**: The worker fetches up to 10 pending emails from the queue API
2. **Sending**: For each email, it calls Resend's API to send
3. **Status Update**: After sending, it updates the queue with:
   - Success: Marks as `sent` with timestamp
   - Failure: Increments `retry_count` and either retries or marks as `failed`

### Retry Logic

- Failed emails are retried automatically (configurable via `max_retries`)
- If `retry_count < max_retries`, the email stays `pending` for the next attempt
- If `retry_count >= max_retries`, the email is marked `failed`
- Detailed error messages are stored in `last_error`

### Scheduled Execution

The worker can be configured to run on a schedule using Cloudflare's cron triggers:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

## Error Handling

The worker gracefully handles various error scenarios:

- **API Connection Errors**: Logs and retries on next scheduled run
- **Invalid Email Address**: Marks email as failed after max retries
- **Resend API Errors**: Captures error details and updates queue
- **Authentication Failures**: Returns 401 with appropriate message

All errors are logged with context for debugging.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | Required | API key for Resend |
| `AUTH_METHOD` | `jwt` | Authentication method: `jwt` or `clerk` |
| `API_JWT_TOKEN` | (if jwt) | JWT token for queue API authentication |
| `CLERK_REFRESH_TOKEN` | (if clerk) | Clerk refresh token for authentication |
| `API_BASE_URL` | `http://localhost:8787` | Base URL of the email queue API |
| `FROM_EMAIL` | `noreply@example.com` | Email address to send from |
| `FROM_NAME` | `Locomotive House` | Display name for emails |
| `POLL_INTERVAL_MS` | `5000` | Polling interval (development) |

### Authentication Methods

The mailer supports two authentication methods:

**JWT** (default, simpler)
- Use a static JWT token
- Good for simple setups
- No token refresh needed
- Set `AUTH_METHOD=jwt`

**Clerk** (advanced, better integration)
- Use Clerk refresh tokens
- Good if you already use Clerk
- Automatic token handling
- Set `AUTH_METHOD=clerk`
- See [`CLERK_SETUP.md`](./CLERK_SETUP.md) for setup

### wrangler.toml

Update the configuration in `wrangler.toml`:

```toml
[env.production]
name = "locomotivehousemailer-prod"
routes = [
  { pattern = "mailer.example.com/*", zone_name = "example.com" }
]
vars = { API_BASE_URL = "https://api.locomotivehouse.com", POLL_INTERVAL_MS = "10000" }
```

## Monitoring and Logging

### Console Logs

The worker logs important events:

```
Processing 5 pending emails
Sending email 1 to user@example.com
Email 1 sent successfully
Failed to send email 2: Invalid email address
```

### Health Check

Monitor worker health:

```bash
curl http://localhost:8787/health
```

### Queue Statistics

Check queue status:

```bash
curl http://localhost:8787/stats
```

## Development

### Project Structure

```
src/
├── index.ts           # Main worker and API endpoints
├── types.ts           # TypeScript type definitions
├── email-service.ts   # Resend email integration
├── queue-client.ts    # Email queue API client
└── processor.ts       # Email processing logic
```

### Key Classes

**EmailService**
- Handles sending emails via Resend
- Formats email with from address and name

**QueueClient**
- Communicates with the email queue API
- Fetches pending emails
- Updates email status (sent/failed)
- Retrieves queue statistics

**EmailProcessor**
- Orchestrates email processing
- Handles batch processing
- Error handling and retry logic

## Troubleshooting

### Worker not sending emails

1. Check `RESEND_API_KEY` is set correctly
2. Verify `API_JWT_TOKEN` is valid
3. Confirm API is reachable at `API_BASE_URL`
4. Check worker logs for detailed errors

### Emails stuck in pending

1. Verify worker has valid Resend API key
2. Check email address format in queue
3. Review `last_error` field for specific error
4. Manually trigger processing: `POST /process`

### High failure rate

1. Check Resend account status and limits
2. Verify email addresses are valid
3. Review error logs for patterns
4. Adjust `max_retries` if needed

## Production Considerations

### Security

- Store `RESEND_API_KEY` and `API_JWT_TOKEN` as secrets using `wrangler secret put`
- Never commit `.env` file to version control
- Use strong JWT tokens from the API

### Performance

- Adjust `maxBatchSize` based on Resend rate limits (default: 10)
- Schedule worker runs based on email volume
- Monitor Resend API usage

### Reliability

- Set up uptime monitoring for `/health` endpoint
- Configure alerts for queue growth
- Archive sent emails periodically
- Review failed emails regularly

## Support

For issues with:

- **Email queue API**: See [EMAIL_QUEUE_GUIDE.md](../locomotivehouseapi/EMAIL_QUEUE_GUIDE.md)
- **Resend integration**: Visit [Resend Documentation](https://resend.com/docs)
- **Cloudflare Workers**: See [Workers Documentation](https://developers.cloudflare.com/workers/)

## License

Private project for Locomotive House
