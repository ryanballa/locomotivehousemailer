/**
 * Token Refresh Handler
 *
 * Integrates with the main Hono app to provide token refresh endpoints
 * and scheduled token refresh capability
 */

import { Hono } from "hono";
import { ClerkTokenRefresher } from "../scripts/clerk-token-refresher";
import { Env } from "./types";

export function setupTokenRefreshRoutes(
  app: Hono<{ Bindings: Env }>,
  authMiddleware?: any
): void {
  /**
   * GET /admin
   *
   * Admin dashboard UI for managing tokens and queue
   * This route is public - it prompts for token on the client side
   */
  app.get("/admin", adminDashboardHandler);

  /**
   * POST /admin/refresh-clerk-token
   *
   * Manually trigger a Clerk M2M token refresh
   *
   * Requires authentication and environment variables:
   * - CLERK_SECRET_KEY: Clerk secret for token generation
   * - CLERK_MACHINE_SECRET_KEY: Clerk machine secret for M2M authentication
   *
   * Response:
   * {
   *   "success": true,
   *   "newToken": "mt_...",
   *   "expiresAt": "2025-12-22T10:00:00Z",
   *   "instructions": "Update your CLERK_REFRESH_TOKEN secret with this token"
   * }
   */
  const refreshTokenRoute = authMiddleware
    ? app.post(
        "/admin/refresh-clerk-token",
        authMiddleware,
        refreshTokenHandler
      )
    : app.post("/admin/refresh-clerk-token", refreshTokenHandler);

  /**
   * GET /admin/refresh-schedule
   *
   * Get recommended cron schedule for token refresh
   *
   * Query parameters:
   * - tokenExpirationDays: How long tokens are valid (default: 30)
   *
   * Response:
   * {
   *   "recommended": "0 2 * * 0",
   *   "explanation": "For 30-day tokens, refresh every 20 days..."
   * }
   */
  const refreshScheduleRoute = authMiddleware
    ? app.get("/admin/refresh-schedule", authMiddleware, refreshScheduleHandler)
    : app.get("/admin/refresh-schedule", refreshScheduleHandler);
}

function adminDashboardHandler(c: any) {
  const env = c.env as Env;
  const clerkPublishableKey = env.CLERK_PUBLISHABLE_KEY || "";
  const authMethod = env.AUTH_METHOD || "jwt";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Locomotive House Mailer - Admin Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          background: white;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 30px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header h1 {
          color: #333;
          margin-bottom: 8px;
          font-size: 28px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .card h2 {
          color: #333;
          font-size: 18px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .card p {
          color: #666;
          font-size: 13px;
          line-height: 1.6;
          margin-bottom: 15px;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e0e0e0;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-ok {
          background: #d4edda;
          color: #155724;
        }
        .status-warning {
          background: #fff3cd;
          color: #856404;
        }
        .status-error {
          background: #f8d7da;
          color: #721c24;
        }
        .icon {
          font-size: 18px;
        }
        .loader {
          display: none;
          color: #667eea;
          font-weight: 600;
          margin-top: 10px;
        }
        .loader.active {
          display: block;
        }
        .result {
          display: none;
          margin-top: 15px;
          padding: 15px;
          border-radius: 6px;
          background: #f5f5f5;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          max-height: 300px;
          overflow-y: auto;
        }
        .result.active {
          display: block;
        }
        .result-success {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }
        .result-error {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }
        .result pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .nav-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 30px;
          border-bottom: 2px solid #eee;
          background: white;
          border-radius: 12px 12px 0 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .nav-tab {
          padding: 15px 25px;
          cursor: pointer;
          font-weight: 600;
          color: #999;
          border: none;
          background: white;
          transition: all 0.3s ease;
          font-size: 14px;
        }
        .nav-tab:hover {
          color: #667eea;
          background: #f9f9f9;
        }
        .nav-tab.active {
          color: #667eea;
          border-bottom: 3px solid #667eea;
          margin-bottom: -2px;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        .auth-container {
          max-width: 400px;
          margin: 100px auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          text-align: center;
        }
        .auth-container h2 {
          margin-bottom: 20px;
          color: #333;
        }
        .auth-container p {
          color: #666;
          margin-bottom: 20px;
        }
        .auth-container input {
          width: 100%;
          padding: 12px;
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }
        .user-info {
          background: white;
          padding: 15px 30px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .user-info-text {
          color: #333;
          font-size: 14px;
        }
        .user-info-text strong {
          color: #667eea;
        }
        #app-container {
          display: none;
        }
        #app-container.loaded {
          display: block;
        }
      </style>
    </head>
    <body>
      <div id="auth-screen" class="auth-container">
        <h2>🚂 Admin Login</h2>
        <p>Please sign in to access the admin dashboard</p>
        <div id="clerk-sign-in"></div>
        <div id="token-auth" style="display: none;">
          <input type="password" id="token-input" placeholder="Enter API token">
          <button class="btn btn-primary" onclick="loginWithToken()">Sign In</button>
        </div>
      </div>
      <div id="app-container">
      <div class="container">
        <div class="user-info">
          <div class="user-info-text">
            Signed in as <strong id="user-email">Loading...</strong>
          </div>
          <button class="btn btn-secondary" onclick="signOut()">Sign Out</button>
        </div>
        <div class="header">
          <h1>🚂 Locomotive House Mailer</h1>
          <p>Admin Dashboard for Email Queue Management</p>
        </div>

        <div class="nav-tabs">
          <button class="nav-tab active" onclick="switchTab('dashboard')">Dashboard</button>
          <button class="nav-tab" onclick="switchTab('reports')">Reports</button>
        </div>

        <!-- Dashboard Tab -->
        <div id="dashboard-tab" class="tab-content active">
        <div class="cards">
          <div class="card">
            <h2><span class="icon">📧</span> Process Emails</h2>
            <p>Manually trigger email queue processing to send all pending emails.</p>
            <div class="btn-group">
              <button class="btn btn-primary" onclick="processEmails()">Process Now</button>
            </div>
            <div class="loader" id="process-loader">Processing...</div>
            <div class="result" id="process-result"></div>
          </div>

          <div class="card">
            <h2><span class="icon">📊</span> Queue Statistics</h2>
            <p>View current queue status and email processing statistics.</p>
            <div class="btn-group">
              <button class="btn btn-primary" onclick="getStats()">View Stats</button>
            </div>
            <div class="loader" id="stats-loader">Loading...</div>
            <div class="result" id="stats-result"></div>
          </div>

          <div class="card">
            <h2><span class="icon">🔄</span> Refresh Clerk Token</h2>
            <p>Generate a new Clerk authentication token and get update instructions.</p>
            <div class="btn-group">
              <button class="btn btn-primary" onclick="refreshToken()">Refresh Token</button>
            </div>
            <div class="loader" id="token-loader">Generating token...</div>
            <div class="result" id="token-result"></div>
          </div>

          <div class="card">
            <h2><span class="icon">⏰</span> Refresh Schedule</h2>
            <p>Get recommended cron schedule for automated token refresh.</p>
            <div class="btn-group">
              <input type="number" id="expiration-days" placeholder="Days (default: 30)" min="1" max="365" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <button class="btn btn-primary" onclick="getSchedule()">Get Schedule</button>
            </div>
            <div class="loader" id="schedule-loader">Loading...</div>
            <div class="result" id="schedule-result"></div>
          </div>

          <div class="card">
            <h2><span class="icon">🏢</span> Missing Tower Reports</h2>
            <p>Find towers that are lacking reports for a specific month and year.</p>
            <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
              <input type="number" id="club-id" placeholder="Club ID" min="1" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <input type="number" id="report-year" placeholder="Year" min="2000" max="2100" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <input type="number" id="report-month" placeholder="Month (1-12)" min="1" max="12" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <button class="btn btn-primary" onclick="getMissingReports()">Check Reports</button>
              <button class="btn btn-secondary" id="send-reminders-btn" onclick="sendMissingReportReminders()" style="display: none;">📧 Send Reminder Emails</button>
            </div>
            <div class="loader" id="reports-loader">Loading...</div>
            <div class="result" id="reports-result"></div>
            <div class="loader" id="send-reminders-loader">Sending emails...</div>
            <div class="result" id="send-reminders-result"></div>
          </div>
        </div>
        </div>
        <!-- End Dashboard Tab -->

        <!-- Reports Tab -->
        <div id="reports-tab" class="tab-content">
        <div class="cards">
          <div class="card">
            <h2><span class="icon">📋</span> View All Reports</h2>
            <p>Pull all reports submitted for a specific club and month. Includes tower and owner information.</p>
            <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
              <input type="number" id="reports-club-id" placeholder="Club ID" min="1" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <input type="number" id="all-reports-year" placeholder="Year" min="2000" max="2100" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <input type="number" id="all-reports-month" placeholder="Month (1-12)" min="1" max="12" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <button class="btn btn-primary" onclick="getAllReports()">Get Reports</button>
            </div>
            <div class="loader" id="all-reports-loader">Loading...</div>
            <div class="result" id="all-reports-result"></div>
          </div>
        </div>
        </div>
        <!-- End Reports Tab -->
      </div>
      </div>

      <script>
        const apiUrl = window.location.origin;
        const authMethod = '${authMethod}';
        const clerkPublishableKey = '${clerkPublishableKey}';
        let token = null;
        let clerk = null;

        async function initAuth() {
          if (authMethod === 'clerk' && clerkPublishableKey) {
            try {
              // Import Clerk from ESM CDN (recommended by Clerk docs)
              const { Clerk } = await import('https://esm.sh/@clerk/clerk-js@5');

              console.log('Clerk SDK loaded successfully');

              // Initialize Clerk instance
              clerk = new Clerk(clerkPublishableKey);
              await clerk.load();

              console.log('Clerk initialized, user:', clerk.user ? 'signed in' : 'not signed in');

              if (clerk.user) {
                // User is already signed in
                await onSignIn();
              } else {
                // Mount sign-in component
                document.getElementById('clerk-sign-in').style.display = 'block';
                const signInDiv = document.getElementById('clerk-sign-in');

                clerk.mountSignIn(signInDiv, {
                  afterSignInUrl: window.location.href,
                  afterSignUpUrl: window.location.href
                });

                // Listen for authentication changes
                clerk.addListener(({ user }) => {
                  if (user) {
                    onSignIn();
                  }
                });
              }
            } catch (error) {
              console.error('Error initializing Clerk:', error);
              alert('Failed to initialize authentication: ' + error.message);
              // Fallback to token auth
              document.getElementById('clerk-sign-in').style.display = 'none';
              document.getElementById('token-auth').style.display = 'block';
            }
          } else {
            // Fallback to token auth
            document.getElementById('clerk-sign-in').style.display = 'none';
            document.getElementById('token-auth').style.display = 'block';
          }
        }

        async function onSignIn() {
          try {
            // Update UI
            const email = clerk.user.primaryEmailAddress?.emailAddress || 'Unknown';
            document.getElementById('user-email').textContent = email;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-container').classList.add('loaded');

            console.log('User signed in successfully:', email);
          } catch (error) {
            console.error('Error during sign in:', error);
            alert('Failed to complete sign in');
          }
        }

        async function getAuthToken() {
          if (clerk && clerk.session) {
            try {
              // Get a fresh token for each request
              const freshToken = await clerk.session.getToken();
              console.log('Got fresh token, length:', freshToken?.length);
              return freshToken;
            } catch (error) {
              console.error('Error getting session token:', error);
              throw error;
            }
          } else if (token) {
            // Fallback to stored token for non-Clerk auth
            return token;
          }
          throw new Error('No authentication available');
        }

        async function signOut() {
          if (clerk) {
            await clerk.signOut();
            window.location.reload();
          } else {
            sessionStorage.removeItem('adminToken');
            window.location.reload();
          }
        }

        function loginWithToken() {
          const input = document.getElementById('token-input');
          token = input.value;
          if (token) {
            sessionStorage.setItem('adminToken', token);
            document.getElementById('user-email').textContent = 'API Token User';
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-container').classList.add('loaded');
          } else {
            alert('Please enter a token');
          }
        }

        // Initialize authentication on page load
        initAuth();

        async function makeRequest(endpoint, method = 'GET', data = null) {
          // Get fresh token for each request
          const authToken = await getAuthToken();

          const options = {
            method,
            headers: {
              'Authorization': \`Bearer \${authToken}\`,
              'Content-Type': 'application/json'
            }
          };

          if (data) {
            options.body = JSON.stringify(data);
          }

          try {
            const response = await fetch(\`\${apiUrl}\${endpoint}\`, options);
            const result = await response.json();
            return { success: response.ok, data: result };
          } catch (error) {
            return { success: false, data: { error: error.message } };
          }
        }

        async function processEmails() {
          const loader = document.getElementById('process-loader');
          const result = document.getElementById('process-result');

          loader.classList.add('active');
          result.classList.remove('active');

          const { success, data } = await makeRequest('/process', 'POST');

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');
          result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }

        async function getStats() {
          const loader = document.getElementById('stats-loader');
          const result = document.getElementById('stats-result');

          loader.classList.add('active');
          result.classList.remove('active');

          const { success, data } = await makeRequest('/stats');

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');
          result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }

        async function refreshToken() {
          const loader = document.getElementById('token-loader');
          const result = document.getElementById('token-result');

          loader.classList.add('active');
          result.classList.remove('active');

          const { success, data } = await makeRequest('/admin/refresh-clerk-token', 'POST');

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');
          result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }

        async function getSchedule() {
          const days = document.getElementById('expiration-days').value || '30';
          const loader = document.getElementById('schedule-loader');
          const result = document.getElementById('schedule-result');

          loader.classList.add('active');
          result.classList.remove('active');

          const { success, data } = await makeRequest(\`/admin/refresh-schedule?tokenExpirationDays=\${days}\`);

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');
          result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }

        function switchTab(tabName) {
          // Hide all tabs
          const tabs = document.querySelectorAll('.tab-content');
          tabs.forEach(tab => tab.classList.remove('active'));

          // Remove active from all nav tabs
          const navTabs = document.querySelectorAll('.nav-tab');
          navTabs.forEach(tab => tab.classList.remove('active'));

          // Show selected tab
          const selectedTab = document.getElementById(tabName + '-tab');
          if (selectedTab) {
            selectedTab.classList.add('active');
          }

          // Mark nav tab as active
          event.target.classList.add('active');
        }

        async function getMissingReports() {
          const clubId = document.getElementById('club-id').value;
          const year = document.getElementById('report-year').value;
          const month = document.getElementById('report-month').value;
          const loader = document.getElementById('reports-loader');
          const result = document.getElementById('reports-result');
          const sendBtn = document.getElementById('send-reminders-btn');
          const sendResult = document.getElementById('send-reminders-result');

          // Hide send button and clear previous send results
          sendBtn.style.display = 'none';
          sendResult.classList.remove('active');

          // Validate inputs
          if (!clubId || !year || !month) {
            result.classList.add('active', 'result-error');
            result.innerHTML = '<pre>Please fill in Club ID, Year, and Month</pre>';
            return;
          }

          loader.classList.add('active');
          result.classList.remove('active');

          const endpoint = \`/admin/clubs/\${clubId}/missing-reports?year=\${year}&month=\${month}\`;
          const { success, data } = await makeRequest(endpoint);

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');

          if (success && data.towersWithoutReports && data.towersWithoutReports.length > 0) {
            const towers = data.towersWithoutReports;
            const towersWithEmail = towers.filter(t => t.ownerEmail);

            let html = \`<div style="padding: 10px;">\`;
            html += \`<p><strong>Found \${towers.length} tower(s) without reports for \${data.month}/\${data.year}</strong></p>\`;
            if (towersWithEmail.length > 0) {
              html += \`<p style="color: #667eea; font-weight: 600; margin-top: 5px;">\${towersWithEmail.length} tower(s) have owner emails and can receive reminders</p>\`;
            }
            html += \`<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">\`;
            html += \`<tr style="background: rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.1);">\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Tower ID</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Tower Name</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Owner Email</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Owner Name</th>\`;
            html += \`</tr>\`;
            towers.forEach(tower => {
              html += \`<tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">\`;
              html += \`<td style="padding: 8px;">\${tower.id}</td>\`;
              html += \`<td style="padding: 8px;">\${tower.name}</td>\`;
              html += \`<td style="padding: 8px;"><code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px;">\${tower.ownerEmail || 'N/A'}</code></td>\`;
              html += \`<td style="padding: 8px;">\${tower.ownerName || 'N/A'}</td>\`;
              html += \`</tr>\`;
            });
            html += \`</table></div>\`;
            result.innerHTML = html;

            // Show send button if there are towers with emails
            if (towersWithEmail.length > 0) {
              sendBtn.style.display = 'inline-block';
            }
          } else if (success && data.count === 0) {
            result.innerHTML = \`<pre>✓ All towers have submitted reports for \${data.month}/\${data.year}\n\nClub ID: \${data.clubId}\nTotal towers checked: 0 missing</pre>\`;
          } else {
            result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          }
        }

        async function sendMissingReportReminders() {
          const clubId = document.getElementById('club-id').value;
          const year = document.getElementById('report-year').value;
          const month = document.getElementById('report-month').value;
          const loader = document.getElementById('send-reminders-loader');
          const result = document.getElementById('send-reminders-result');
          const sendBtn = document.getElementById('send-reminders-btn');

          // Validate inputs
          if (!clubId || !year || !month) {
            result.classList.add('active', 'result-error');
            result.innerHTML = '<pre>Please fill in Club ID, Year, and Month</pre>';
            return;
          }

          // Disable button while sending
          sendBtn.disabled = true;

          loader.classList.add('active');
          result.classList.remove('active');

          const endpoint = \`/admin/clubs/\${clubId}/missing-reports/send?year=\${year}&month=\${month}\`;
          const { success, data } = await makeRequest(endpoint, 'POST');

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');

          if (success) {
            let html = \`<div style="padding: 10px;">\`;
            html += \`<p style="font-weight: 600; color: #155724;">✓ Email sending completed</p>\`;
            html += \`<div style="margin-top: 10px; line-height: 1.8;">\`;
            html += \`<p><strong>Queued:</strong> \${data.queued} email(s)</p>\`;
            if (data.failed > 0) {
              html += \`<p style="color: #721c24;"><strong>Failed:</strong> \${data.failed} email(s)</p>\`;
            }
            if (data.skipped > 0) {
              html += \`<p><strong>Skipped:</strong> \${data.skipped} tower(s) without owner emails</p>\`;
            }
            html += \`</div>\`;

            // Show errors if any
            if (data.errors && data.errors.length > 0) {
              html += \`<div style="margin-top: 15px; padding: 10px; background: #f8d7da; border-radius: 6px;">\`;
              html += \`<p style="font-weight: 600; margin-bottom: 8px;">Errors:</p>\`;
              data.errors.forEach(err => {
                html += \`<p style="margin: 4px 0; font-size: 12px;"><strong>\${err.towerName}:</strong> \${err.error}</p>\`;
              });
              html += \`</div>\`;
            }

            html += \`<p style="margin-top: 15px; font-size: 12px; color: #666;">\${data.message}</p>\`;
            html += \`</div>\`;
            result.innerHTML = html;
          } else {
            result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          }

          // Re-enable button
          sendBtn.disabled = false;
        }

        async function getAllReports() {
          const clubId = document.getElementById('reports-club-id').value;
          const year = document.getElementById('all-reports-year').value;
          const month = document.getElementById('all-reports-month').value;
          const loader = document.getElementById('all-reports-loader');
          const result = document.getElementById('all-reports-result');

          // Validate inputs
          if (!clubId || !year || !month) {
            result.classList.add('active', 'result-error');
            result.innerHTML = '<pre>Please fill in Club ID, Year, and Month</pre>';
            return;
          }

          loader.classList.add('active');
          result.classList.remove('active');

          const endpoint = \`/admin/clubs/\${clubId}/reports?year=\${year}&month=\${month}\`;
          const { success, data } = await makeRequest(endpoint);

          loader.classList.remove('active');
          result.classList.add('active', success ? 'result-success' : 'result-error');

          if (success && data.reports && data.reports.length > 0) {
            const reports = data.reports;
            let html = \`<div style="padding: 10px;">\`;
            html += \`<p><strong>Found \${reports.length} report(s) for \${data.month}/\${data.year}</strong></p>\`;
            html += \`<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">\`;
            html += \`<tr style="background: rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.1);">\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Report ID</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Tower Name</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Owner Email</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Owner Name</th>\`;
            html += \`<th style="padding: 8px; text-align: left; font-weight: 600;">Submitted</th>\`;
            html += \`</tr>\`;
            reports.forEach(report => {
              const submittedDate = new Date(report.created_at).toLocaleDateString();
              html += \`<tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">\`;
              html += \`<td style="padding: 8px;">\${report.id}</td>\`;
              html += \`<td style="padding: 8px;">\${report.towerName || 'Unknown'}</td>\`;
              html += \`<td style="padding: 8px;"><code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px;">\${report.ownerEmail || 'N/A'}</code></td>\`;
              html += \`<td style="padding: 8px;">\${report.ownerName || 'N/A'}</td>\`;
              html += \`<td style="padding: 8px;">\${submittedDate}</td>\`;
              html += \`</tr>\`;
            });
            html += \`</table></div>\`;
            result.innerHTML = html;
          } else if (success && data.count === 0) {
            result.innerHTML = \`<pre>No reports found for club \${clubId} in \${data.month}/\${data.year}</pre>\`;
          } else {
            result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          }
        }
      </script>
    </body>
    </html>
  `;

  return c.html(html);
}

async function refreshTokenHandler(c: any) {
  try {
    const clerkSecretKey = c.env.CLERK_SECRET_KEY;
    const machineSecretKey = c.env.CLERK_MACHINE_SECRET_KEY;

    if (!clerkSecretKey) {
      return c.json(
        {
          success: false,
          error: "CLERK_SECRET_KEY not configured",
          instructions:
            "Set CLERK_SECRET_KEY environment variable in Cloudflare secrets",
        },
        400
      );
    }

    if (!machineSecretKey) {
      return c.json(
        {
          success: false,
          error: "CLERK_MACHINE_SECRET_KEY not configured",
          instructions:
            "Set CLERK_MACHINE_SECRET_KEY environment variable (from Clerk Dashboard -> Machines -> View machine secret)",
        },
        400
      );
    }

    const refresher = new ClerkTokenRefresher({
      clerkSecretKey,
      machineSecretKey,
    });

    const result = await refresher.refreshToken();

    if (!result.success) {
      return c.json(
        {
          ...result,
          instructions:
            "Check CLERK_SECRET_KEY and CLERK_MACHINE_SECRET_KEY configuration",
        },
        500
      );
    }

    return c.json(
      {
        ...result,
        instructions: `Update your CLERK_REFRESH_TOKEN secret with: ${result.newToken}`,
        updateCommand: `wrangler secret put CLERK_REFRESH_TOKEN --env production`,
        updateSteps: [
          "1. Copy the newToken value above",
          "2. Run: wrangler secret put CLERK_REFRESH_TOKEN --env production",
          "3. Paste the token when prompted",
          "4. Redeploy: npm run deploy",
        ],
      },
      200
    );
  } catch (error) {
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
}

function refreshScheduleHandler(c: any) {
  const expirationDays = parseInt(
    c.req.query("tokenExpirationDays") || "30",
    10
  );

  if (expirationDays < 1 || expirationDays > 365) {
    return c.json(
      {
        error: "tokenExpirationDays must be between 1 and 365",
      },
      400
    );
  }

  const { recommended, explanation } = getRefreshSchedule(expirationDays);

  return c.json({
    recommended,
    explanation,
    expirationDays,
    nextSteps: [
      "1. Add to your wrangler.toml:",
      `   [triggers]`,
      `   crons = ["${recommended}"]`,
      "2. Add environment variables:",
      "   CLERK_SECRET_KEY",
      "   CLERK_MACHINE_SECRET_KEY",
      "3. Redeploy: npm run deploy",
      "4. Worker will automatically refresh token on schedule",
      "5. Check logs: wrangler tail --env production",
    ],
  });
}

function getRefreshSchedule(expirationDays: number): {
  recommended: string;
  explanation: string;
} {
  const refreshDays = Math.max(Math.floor(expirationDays * 0.67), 1);

  const cronSchedules: Record<number, string> = {
    1: "0 0 * * *",
    3: "0 0 */3 * *",
    7: "0 0 * * 0",
    14: "0 0 1,15 * *",
    20: "0 2 * * 0,3",
    30: "0 2 * * 0",
  };

  const closestSchedule = Object.entries(cronSchedules).reduce((prev, curr) => {
    const [days] = curr;
    return Math.abs(parseInt(days) - refreshDays) <
      Math.abs(parseInt(prev[0]) - refreshDays)
      ? curr
      : prev;
  });

  return {
    recommended: closestSchedule[1],
    explanation: `For ${expirationDays}-day tokens, refresh every ${closestSchedule[0]} days using cron: ${closestSchedule[1]}`,
  };
}
