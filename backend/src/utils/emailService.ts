import nodemailer, { Transporter } from 'nodemailer';
import prisma from '../config/database';

let cachedTransporter: Transporter | null = null;
let cachedFrom: string = '';

export async function getTransporter(): Promise<{ transporter: Transporter | null; from: string }> {
  if (cachedTransporter) {
    return { transporter: cachedTransporter, from: cachedFrom };
  }

  let user = process.env.SMTP_USER || '';
  let pass = process.env.SMTP_PASS || '';
  let host = process.env.SMTP_HOST || 'smtp.gmail.com';
  let port = Number(process.env.SMTP_PORT) || 465;
  let secure = process.env.SMTP_SECURE === 'true' || port === 465;
  let from = process.env.SMTP_FROM || (user ? `MediArca <${user}>` : 'MediArca <noreply@mediarca.com>');

  // If environment variables are not set in cloud host, query database SystemConfig table
  if (!user || !pass) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
        `SELECT "key", "value" FROM "SystemConfig" WHERE "key" IN ('SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_FROM')`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const configMap = new Map(rows.map(r => [r.key, r.value]));
        const dbUser = configMap.get('SMTP_USER');
        const dbPass = configMap.get('SMTP_PASS');
        if (dbUser && dbPass) {
          user = dbUser;
          pass = dbPass;
          host = configMap.get('SMTP_HOST') || host;
          port = Number(configMap.get('SMTP_PORT')) || port;
          secure = configMap.get('SMTP_SECURE') === 'true' || port === 465;
          from = configMap.get('SMTP_FROM') || `MediArca <${user}>`;
        }
      }
    } catch (dbErr: any) {
      console.warn('[emailService] Notice: could not load SMTP credentials from SystemConfig table:', dbErr?.message || dbErr);
    }
  }

  if (!user || !pass) {
    console.warn('[emailService] Warning: SMTP credentials are not configured in environment or database.');
    return { transporter: null, from };
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 4000,
    auth: {
      user,
      pass,
    },
  });
  cachedFrom = from;

  return { transporter: cachedTransporter, from: cachedFrom };
}

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

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[emailService] Dispatching email verification OTP to ${toEmail}`);
    }

    const { transporter, from } = await getTransporter();
    if (!transporter) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[emailService] Verification email dispatch skipped for ${toEmail} (SMTP not configured)`);
      }
      return { success: false, error: 'SMTP credentials not configured' };
    }

    const sendPromise = transporter.sendMail({
      from,
      to: toEmail,
      subject: `${otp} is your MediArca verification code`,
      text: textContent,
      html: htmlContent,
    });

    const timeoutPromise = new Promise<{ messageId: string }>((_, reject) =>
      setTimeout(() => reject(new Error('SMTP connection timed out after 4 seconds')), 4000)
    );

    const info = (await Promise.race([sendPromise, timeoutPromise])) as any;
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`Failed to send verification email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}
