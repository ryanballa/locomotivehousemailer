/**
 * Email template for notifying tower owners about missing reports
 */

export interface MissingReportEmailData {
  ownerName?: string;
  towerName: string;
  clubName?: string;
  month: number;
  year: number;
  reportUrl?: string;
}

export function getMissingReportEmailSubject(data: MissingReportEmailData): string {
  const monthName = new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' });
  return `Reminder: Missing Tower Report for ${data.towerName} - ${monthName} ${data.year}`;
}

export function getMissingReportEmailText(data: MissingReportEmailData): string {
  const monthName = new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' });
  const greeting = data.ownerName ? `Dear ${data.ownerName}` : 'Dear Tower Owner';

  return `${greeting},

This is a friendly reminder that a tower report has not been submitted for ${data.towerName} for ${monthName} ${data.year}.

Please submit your tower report at your earliest convenience to help us maintain accurate records.

${data.reportUrl ? `Submit your report here: ${data.reportUrl}` : ''}

Thank you for your cooperation.

Best regards,
${data.clubName || 'Locomotive House'}`;
}

export function getMissingReportEmailHtml(data: MissingReportEmailData): string {
  const monthName = new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' });
  const greeting = data.ownerName ? `Dear ${data.ownerName}` : 'Dear Tower Owner';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Missing Tower Report Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">🔔 Tower Report Reminder</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="margin-top: 0; font-size: 16px;">${greeting},</p>

    <p style="font-size: 16px;">This is a friendly reminder that a tower report has not been submitted for:</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 18px; font-weight: 600; color: #667eea;">${data.towerName}</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">
        <strong>Period:</strong> ${monthName} ${data.year}
      </p>
    </div>

    <p style="font-size: 16px;">Please submit your tower report at your earliest convenience to help us maintain accurate records.</p>

    ${data.reportUrl ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.reportUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Submit Report Now
      </a>
    </div>
    ` : ''}

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      Thank you for your cooperation.<br>
      <strong>${data.clubName || 'Locomotive House'}</strong>
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
    <p>This is an automated reminder. Please do not reply to this email.</p>
  </div>

</body>
</html>`;
}
