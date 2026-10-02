import nodemailer from 'nodemailer';

const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpFrom = process.env.SMTP_FROM || (smtpUser ? `MediArca <${smtpUser}>` : 'MediArca <noreply@mediarca.com>');

// Configure Gmail SMTP Transporter
export const emailTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for 587
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

/**
 * Sends a 6-digit email verification OTP using Apple-designed responsive HTML template.
 */
export async function sendVerificationOtpEmail(
  toEmail: string,
  otp: string,
  recipientName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const greetingName = recipientName ? recipientName.trim() : 'Valued Member';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MediArca Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1d1d1f;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f5f5f7;
      padding: 40px 16px;
    }
    .card {
      max-width: 480px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      padding: 36px 32px;
      border: 1px solid #e5e5ea;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      text-align: center;
    }
    .logo-container {
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 700;
      color: #0088e8;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .headline {
      font-size: 20px;
      font-weight: 600;
      color: #1d1d1f;
      margin: 16px 0 8px 0;
      letter-spacing: -0.3px;
    }
    .subtext {
      font-size: 14px;
      line-height: 1.5;
      color: #86868b;
      margin: 0 0 28px 0;
    }
    .otp-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px 24px;
      margin: 0 auto 28px auto;
      display: inline-block;
    }
    .otp-code {
      font-family: "SF Mono", Menlo, Consolas, Monaco, monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #0088e8;
      margin: 0;
      padding-left: 8px; /* Offset for letter spacing */
    }
    .expiry-note {
      font-size: 13px;
      color: #86868b;
      margin: 0 0 24px 0;
      line-height: 1.4;
    }
    .divider {
      height: 1px;
      background-color: #e5e5ea;
      margin: 24px 0;
    }
    .footer {
      font-size: 12px;
      color: #a1a1a6;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo-container">
        <h1 class="brand-title">MediArca</h1>
      </div>
      <h2 class="headline">Verify your email address</h2>
      <p class="subtext">
        Hello <strong>${greetingName}</strong>,<br>
        Please use the 6-digit verification code below to verify your MediArca account.
      </p>

      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>

      <p class="expiry-note">
        This code is valid for <strong>10 minutes</strong>.<br>
        For your security, please do not share this code with anyone.
      </p>

      <div class="divider"></div>

      <p class="footer">
        If you didn't create an account on MediArca, you can safely ignore this email.<br>
        &copy; ${new Date().getFullYear()} MediArca Clinical Platform. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `Hello ${greetingName},\n\nYour MediArca 6-digit verification code is: ${otp}\n\nThis code is valid for 10 minutes.\nIf you did not request this, please ignore this email.\n\nMediArca Clinical Platform`;

    const info = await emailTransporter.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: `${otp} is your MediArca verification code`,
      text: textContent,
      html: htmlContent,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Failed to send verification email via Gmail SMTP:', error.message);
    return { success: false, error: error.message };
  }
}
