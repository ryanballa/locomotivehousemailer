#!/usr/bin/env node

/**
 * Local Token Refresh Script
 *
 * This script generates a fresh Clerk JWT token using your dev Clerk credentials
 * and automatically updates the CLERK_REFRESH_TOKEN in .env.local.
 *
 * Usage:
 *   1. Ensure .env.local has:
 *      CLERK_SECRET_KEY=sk_test_xxx (dev key)
 *      SERVICE_USER_ID=user_xxx
 *
 *   2. Run: npm run refresh-token
 */

import { config } from 'dotenv';
import { ClerkTokenRefresher } from './clerk-token-refresher.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Load environment variables from .env.clerk.dev for Clerk credentials
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clerkEnvPath = resolve(__dirname, '..', '.env.clerk.dev');
const localEnvPath = resolve(__dirname, '..', '.env.local');

// Load Clerk credentials
config({ path: clerkEnvPath });

async function main() {
  console.log(`📁 Loading Clerk credentials from: ${clerkEnvPath}`);
  console.log('');

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const serviceUserId = process.env.SERVICE_USER_ID;

  if (!clerkSecretKey) {
    console.error('❌ Error: CLERK_SECRET_KEY not found in .env.clerk.dev');
    console.error('');
    console.error('Please create a .env.clerk.dev file in the project root with:');
    console.error('');
    console.error('  CLERK_SECRET_KEY=sk_test_xxx (your dev Clerk secret key)');
    console.error('  SERVICE_USER_ID=user_xxx');
    console.error('');
    console.error('Get your secret key from: https://dashboard.clerk.com/ → API Keys');
    process.exit(1);
  }

  if (!serviceUserId) {
    console.error('❌ Error: SERVICE_USER_ID not found in .env.clerk.dev');
    console.error('');
    console.error('Please add to your .env.clerk.dev file:');
    console.error('');
    console.error('  SERVICE_USER_ID=user_xxx');
    console.error('');
    console.error('This is the Clerk user ID of your service account');
    process.exit(1);
  }

  console.log('🔄 Generating new Clerk JWT token...');
  console.log(`   Using service user: ${serviceUserId}`);
  console.log('');

  const refresher = new ClerkTokenRefresher({
    clerkSecretKey,
    serviceUserId,
    tokenExpirationSeconds: 2592000, // 30 days
  });

  const result = await refresher.refreshToken();

  if (!result.success) {
    console.error('❌ Token refresh failed:');
    console.error(`   ${result.error}`);
    process.exit(1);
  }

  console.log('✅ Token generated successfully!');
  console.log(`   Expires: ${result.expiresAt}`);
  console.log('');

  // Update .env.local with the new token
  try {
    let envContent = readFileSync(localEnvPath, 'utf-8');

    // Check if CLERK_REFRESH_TOKEN already exists
    const tokenRegex = /^CLERK_REFRESH_TOKEN=.*/m;

    if (tokenRegex.test(envContent)) {
      // Replace existing token
      envContent = envContent.replace(tokenRegex, `CLERK_REFRESH_TOKEN=${result.newToken}`);
    } else {
      // Add token after SERVICE_USER_ID line
      envContent = envContent.replace(
        /(SERVICE_USER_ID=.*)/,
        `$1\nCLERK_REFRESH_TOKEN=${result.newToken}`
      );
    }

    writeFileSync(localEnvPath, envContent, 'utf-8');

    console.log('✅ Updated CLERK_REFRESH_TOKEN in .env.local');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Next steps for local development:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. Restart your dev server: npm run dev');
    console.log('');
    console.log('2. Test the endpoint:');
    console.log('');
    console.log(`   curl 'http://localhost:8787/admin/clubs/1/missing-reports?year=2025&month=12' \\`);
    console.log(`     -H 'Authorization: Bearer ${result.newToken}'`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('For production deployment:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Run the "Manual Clerk Token Rotation" workflow in GitHub');
    console.log('or manually update the Cloudflare secret:');
    console.log('');
    console.log('   npx wrangler secret put CLERK_REFRESH_TOKEN --env production');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to update .env.local:', error.message);
    console.log('');
    console.log('Token (copy manually):');
    console.log(result.newToken);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
