export const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('mediarca_token');
  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export async function handleResponse<T>(res: Response): Promise<T> {
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      const error: any = new Error(
        `Server returned error ${res.status}: ${res.statusText || 'Unexpected error'}`
      );
      error.status = res.status;
      throw error;
    }
    data = text;
  }

  if (!res.ok || (data && typeof data === 'object' && data.success === false)) {
    const error: any = new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`
    );
    error.status = res.status;
    if (data?.requiresVerification) {
      error.requiresVerification = true;
      error.email = data.email;
    }
    if (data?.isAlreadyVerified) {
      error.isAlreadyVerified = true;
    }
    if (data?.retryAfterSeconds) {
      error.retryAfterSeconds = data.retryAfterSeconds;
    }
    const cooldown =
      data?.data?.cooldownSeconds ??
      data?.cooldownSeconds ??
      data?.retryAfterSeconds ??
      data?.remainingSeconds;
    if (cooldown !== undefined) {
      error.cooldownSeconds = cooldown;
    }
    throw error;
  }
  return data?.data !== undefined ? data.data : data;
}
