/**
 * Sends email through Brevo's HTTPS API (port 443).
 * Render's free plan blocks the SMTP ports (25, 465, 587), so Gmail SMTP
 * times out there. Brevo is used whenever BREVO_API_KEY is set.
 */
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 10000;

export interface BrevoMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

export const isBrevoConfigured = (): boolean => Boolean(process.env.BREVO_API_KEY?.trim());

/** Sender must be verified in Brevo (Senders, Domains & Dedicated IPs). */
export const getBrevoSender = (): { email: string; name: string } => ({
  email: (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || '').trim(),
  name: (process.env.BREVO_SENDER_NAME || 'MediArca').trim(),
});

export async function sendViaBrevo(
  message: BrevoMessage,
  fetchImpl: typeof fetch = fetch
): Promise<{ messageId: string }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const sender = getBrevoSender();
  if (!sender.email) throw new Error('BREVO_SENDER_EMAIL is not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BREVO_TIMEOUT_MS);
  try {
    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [message.toName ? { email: message.to, name: message.toName } : { email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: controller.signal,
    });

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Brevo returns { code, message }, never the key, so this is safe to log
      throw new Error(`Brevo ${res.status}: ${body?.message || body?.code || 'request failed'}`);
    }
    return { messageId: String(body?.messageId || '') };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Brevo timed out after ${BREVO_TIMEOUT_MS / 1000} seconds`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
