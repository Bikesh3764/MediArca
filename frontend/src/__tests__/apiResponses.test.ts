import { describe, expect, it } from 'vitest';
import { handleResponse } from '../services/api';

const response = (body: string, status: number, contentType = 'application/json') =>
  new Response(body, { status, headers: { 'Content-Type': contentType } });

describe('API response handling', () => {
  it('turns a 502 HTML error page into a clean error, not a crash', async () => {
    const html = '<html><body><h1>502 Bad Gateway</h1></body></html>';
    const err: any = await handleResponse(response(html, 502, 'text/html')).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SyntaxError);
    expect(err.status).toBe(502);
  });

  it('uses the server message when a request is refused', async () => {
    const err: any = await handleResponse(
      response(JSON.stringify({ success: false, message: 'Demo account: this change is turned off.' }), 403)
    ).catch((e) => e);
    expect(err.message).toContain('Demo account');
    expect(err.status).toBe(403);
  });

  it('unwraps { data } on success', async () => {
    const data = await handleResponse<{ id: string }>(response(JSON.stringify({ success: true, data: { id: 'a1' } }), 200));
    expect(data).toEqual({ id: 'a1' });
  });

  it('passes on resend cooldowns so the OTP screen can count down', async () => {
    const err: any = await handleResponse(
      response(JSON.stringify({ success: false, message: 'Wait', data: { cooldownSeconds: 42 } }), 429)
    ).catch((e) => e);
    expect(err.cooldownSeconds).toBe(42);
  });
});
