# GitHub Actions Setup for Token Rotation

Automated Clerk token rotation using GitHub Actions.

## Overview

Two GitHub Actions workflows are included:

1. **rotate-clerk-token.yml** - Automatic scheduled rotation (runs weekly)
2. **rotate-clerk-token-manual.yml** - Manual on-demand rotation

Both can:
- Generate new Clerk tokens
- Update Cloudflare secrets
- Notify Slack on success/failure
- Auto-create issues if rotation fails

## Prerequisites

### 1. Clerk Setup

Get these from Clerk:
- `CLERK_SECRET_KEY` - From Clerk Dashboard → API Keys → Secret Key
- `CLERK_MACHINE_SECRET_KEY` - From Clerk Dashboard → Configure → Machines → View machine secret

### 2. Cloudflare Setup

Get these from Cloudflare:
- `CLOUDFLARE_API_TOKEN` - From Cloudflare Dashboard → My Profile → API Tokens
  - Need permission: `Edit Cloudflare Workers`
- `CLOUDFLARE_ACCOUNT_ID` - From Cloudflare Dashboard → Account Home

### 3. Slack Setup (Optional)

For Slack notifications:
- `SLACK_WEBHOOK_URL` - Create at https://api.slack.com/messaging/webhooks

## Step 1: Add GitHub Secrets

Go to your GitHub repository:

1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

```
Name: CLERK_SECRET_KEY
Value: sk_live_xxxxxx
```

```
Name: CLERK_MACHINE_SECRET_KEY
Value: ak_xxxxxx
```

```
Name: CLOUDFLARE_API_TOKEN
Value: your_api_token
```

```
Name: CLOUDFLARE_ACCOUNT_ID
Value: your_account_id
```

Optional - for Slack notifications:

```
Name: SLACK_WEBHOOK_URL
Value: https://hooks.slack.com/services/...
```

## Step 2: Verify Setup

Check that secrets are set:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all secrets listed (values hidden)

## Step 3: Test Manual Rotation

1. Go to **Actions** tab
2. Click **Rotate Clerk Token** (manual workflow)
3. Click **Run workflow**
4. Choose environment: `production` or `development`
5. Click **Run workflow** again

Wait for completion. You should see:
- ✓ Successful token generation
- ✓ Secret updated in Cloudflare
- ✓ Worker redeployed
- ✓ Slack notification (if configured)

## Step 4: Enable Automatic Rotation

The scheduled workflow runs automatically every Sunday at 2 AM UTC.

To change the schedule, edit `.github/workflows/rotate-clerk-token.yml`:

```yaml
on:
  schedule:
    # Change this cron expression
    - cron: '0 2 * * 0'  # Sunday 2 AM UTC
```

Common schedules:
- `0 2 * * 0` - Weekly (Sunday 2 AM)
- `0 2 * * 0,3` - Twice weekly (Sun & Wed 2 AM)
- `0 2 1,15 * *` - Bi-weekly (1st & 15th)

## How It Works

### Automatic (Scheduled)

1. Every Sunday at 2 AM UTC:
   - GitHub Actions workflow triggers
   - Generates new Clerk token
   - Updates `CLERK_REFRESH_TOKEN` secret in Cloudflare
   - Redeployed worker
   - Sends Slack notification

2. No manual intervention needed

### Manual (On-Demand)

1. Go to **Actions** → **Rotate Clerk Token**
2. Click **Run workflow**
3. Choose environment
4. Same process as automatic, but triggered manually

## Monitoring

### View Logs

Go to **Actions** tab to see:
- Workflow run status
- Detailed logs for each step
- Error messages if failed

### Slack Notifications

If configured, you'll receive messages like:

**Success:**
```
✓ Clerk Token Rotated
Expires: 2025-12-22T10:00:00Z
Action: Update CLERK_REFRESH_TOKEN secret in Cloudflare
```

**Failure:**
```
✗ Clerk Token Rotation Failed
Error: Check GitHub Actions logs
Action: Manual rotation may be needed
```

### Auto-Issues

If rotation fails:
1. GitHub Actions automatically creates an issue
2. Tagged with: `automated`, `token-rotation`, `urgent`
3. Includes link to failed workflow

You'll see the issue in your repository with instructions to fix it.

## Troubleshooting

### "CLERK_SECRET_KEY not found"

**Solution**: Add the secret to GitHub
1. Settings → Secrets and variables → Actions
2. Click New repository secret
3. Name: `CLERK_SECRET_KEY`
4. Value: Your Clerk secret key

### "Token rotation failed: Invalid credentials"

**Solution**: Verify credentials are correct
1. Check CLERK_SECRET_KEY starts with `sk_`
2. Check CLERK_MACHINE_SECRET_KEY starts with `ak_`
3. Verify they're not expired in Clerk dashboard

### "Cloudflare secret not updated"

**Solution**: Verify Cloudflare credentials
1. Check CLOUDFLARE_API_TOKEN is valid
2. Check API token has `Edit Cloudflare Workers` permission
3. Verify CLOUDFLARE_ACCOUNT_ID is correct

### Workflow not running on schedule

**Solution**: GitHub Actions schedules can be delayed
1. Workflows may not run if repo is inactive
2. They're relative to UTC (not your timezone)
3. They may delay up to an hour after scheduled time
4. Use manual trigger to test: click **Run workflow**

## Best Practices

### 1. Pair with Slack Notifications

Always enable Slack notifications to:
- Know when rotation succeeds
- Get alerted if rotation fails
- Track rotation history

### 2. Regular Manual Tests

Once per month, manually trigger rotation:
1. Go to **Actions** → **Rotate Clerk Token**
2. Click **Run workflow**
3. Verify it completes successfully

### 3. Monitor the Logs

Check workflow logs weekly:
1. Go to **Actions**
2. Click the latest completed workflow
3. Review the logs for any warnings

### 4. Keep Secrets Updated

When you rotate Clerk credentials:
1. Update the GitHub secret
2. Test with manual workflow
3. Verify automatic rotation still works

### 5. Document Your Process

In your team wiki, document:
- When tokens are rotated (Sundays 2 AM UTC)
- Who to contact if rotation fails
- How to manually rotate if needed

## Integration with Email Processing

Both token rotation and email processing can run on schedules:

```yaml
# Token rotation: Sundays 2 AM UTC
- cron: '0 2 * * 0'

# Email processing: Every 5 minutes (separate worker schedule)
```

They don't conflict - GitHub Actions rotates token, Cloudflare cron processes emails.

## Advanced: Custom Logic

To customize the rotation process, edit:
- `.github/workflows/rotate-clerk-token.yml` - Automatic rotation
- `.github/workflows/rotate-clerk-token-manual.yml` - Manual rotation

Examples of customizations:
- Send webhook notification instead of Slack
- Log rotation to a database
- Create backup of old token
- Validate new token before deployment

## Security Considerations

### 1. Secret Protection

- Never log secrets in workflow output
- GitHub hides secrets in logs automatically
- Secrets are encrypted at rest and in transit

### 2. API Token Permissions

For CLOUDFLARE_API_TOKEN:
- Use minimal required permissions
- Don't use account-wide tokens
- Create separate tokens for different workflows

### 3. Slack Webhook

- Use a dedicated Slack webhook
- Restrict permissions to one channel
- Rotate webhook URL if exposed

### 4. Audit Trail

GitHub Actions logs all workflow runs:
- View in Actions tab
- See who triggered it (automatic vs manual)
- Track all rotations over time

## Cost

GitHub Actions usage:
- **Free tier**: 2,000 minutes/month for private repos
- Token rotation: ~1 minute per run
- Weekly rotation: ~4 minutes/month
- **Cost**: Free (well within limits)

## Next Steps

1. Add GitHub secrets (see Step 1 above)
2. Test manual rotation (see Step 3)
3. Enable automatic rotation (already enabled by default)
4. Monitor logs and Slack notifications
5. Document in your team wiki

Your Clerk tokens will now rotate automatically every week! 🎉
