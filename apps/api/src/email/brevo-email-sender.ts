import type { EmailSender } from './email-sender.ts';

const endpoint = 'https://api.brevo.com/v3/smtp/email';

export interface BrevoOptions {
  apiKey: string;
  /** A sender address verified in Brevo. */
  from: { email: string; name: string };
  /** Passed in so tests can replace the network call. */
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/** Sends email through Brevo's transactional email API. */
export function createBrevoEmailSender({
  apiKey,
  from,
  fetch = globalThis.fetch,
  timeoutMs = 10_000,
}: BrevoOptions): EmailSender {
  return {
    async send(message) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: from,
          to: [message.to],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(
          `Brevo rejected the email: ${String(response.status)} ${await errorCode(response)}`,
        );
      }
    },
  };
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'code' in body) {
      if (typeof body.code === 'string') return body.code;
    }
  } catch {
    // Not JSON.
  }
  return 'unknown';
}
