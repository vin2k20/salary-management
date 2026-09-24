import { describe, expect, it, vi } from 'vitest';
import { createBrevoEmailSender } from './brevo-email-sender.ts';

const message = {
  to: { email: 'hr.in@acme.example.com', name: 'India HR' },
  subject: 'Reset your password',
  text: 'Plain text',
  html: '<p>HTML</p>',
};

function sender(response: Response | Error) {
  const fetch = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  const brevo = createBrevoEmailSender({
    apiKey: 'xkeysib-test-key',
    from: { email: 'sender@example.com', name: 'ACME Salary Management' },
    fetch,
  });
  return { brevo, fetch };
}

describe('Brevo email sender', () => {
  it('posts the message to the Brevo transactional email API', async () => {
    const { brevo, fetch } = sender(Response.json({ messageId: '<id@brevo>' }, { status: 201 }));

    await brevo.send(message);

    expect(fetch).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': 'xkeysib-test-key',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'sender@example.com', name: 'ACME Salary Management' },
        to: [{ email: 'hr.in@acme.example.com', name: 'India HR' }],
        subject: 'Reset your password',
        textContent: 'Plain text',
        htmlContent: '<p>HTML</p>',
      }),
      signal: expect.any(AbortSignal) as unknown,
    });
  });

  it('fails with the status and Brevo error code, without the API key', async () => {
    const { brevo } = sender(
      Response.json({ code: 'unauthorized', message: 'Key not found' }, { status: 401 }),
    );

    const error = await brevo.send(message).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Brevo rejected the email: 401 unauthorized');
    expect((error as Error).message).not.toContain('xkeysib');
  });

  it('passes on a network failure', async () => {
    const { brevo } = sender(new TypeError('fetch failed'));

    await expect(brevo.send(message)).rejects.toThrow('fetch failed');
  });
});
