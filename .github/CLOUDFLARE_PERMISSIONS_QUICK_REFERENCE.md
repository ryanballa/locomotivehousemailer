# Cloudflare API Token Permissions - Quick Reference

**TL;DR**: You need these 2 permissions for GitHub Actions token rotation.

## Required Permissions

```
✓ Cloudflare Workers Write    (Account level)
✓ Account Settings Write      (Account level)
```

## Step-by-Step in Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token** → **Create Custom Token**
3. Name: `GitHub Actions - Email Mailer Token Rotation`

4. **Add Permission 1:**
   - Click **Add More** button
   - Category: **Account**
   - Permission: **Cloudflare Workers Write**
   - Resource: **Include → All accounts**

5. **Add Permission 2:**
   - Click **Add More** button
   - Category: **Account**
   - Permission: **Account Settings Write**
   - Resource: **Include → All accounts**

6. **Set expiration (optional but recommended):**
   - TTL: **90 days**

7. Click **Create Token**

8. Copy the token (starts with `v1.0-`)

## Add to GitHub

Repository Settings → Secrets and variables → Actions

```
Name: CLOUDFLARE_API_TOKEN
Value: v1.0-xxxxxxxxxxxxxxxxxxxxx
```

Also get your Account ID:

From dashboard URL: `https://dash.cloudflare.com/YOUR_ACCOUNT_ID/...`

```
Name: CLOUDFLARE_ACCOUNT_ID
Value: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## Test Token

```bash
curl -X GET https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer v1.0-xxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json"
```

Should return `"success": true`

## Permissions Explained

| Permission | Allows | Needed |
|-----------|--------|--------|
| Cloudflare Workers Write | Update worker secrets & deploy | ✓ YES |
| Account Settings Write | Modify account settings | ✓ YES |
| API Token Management | Create/delete tokens | ✗ No |
| Zone Settings | Manage DNS, SSL, etc | ✗ No |
| Billing | Access billing info | ✗ No |

## Common Issues

| Error | Solution |
|-------|----------|
| "Permission denied" | Add both permissions listed above |
| "401 Unauthorized" | Token expired or invalid, create new one |
| "Account not found" | Verify Account ID is correct |
| "Invalid token format" | Token should start with `v1.0-` |

## That's It!

Your token is ready for GitHub Actions token rotation. 🚀

For detailed guide, see: `CLOUDFLARE_API_TOKEN_SETUP.md`
