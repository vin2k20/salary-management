import { describe, expect, it } from 'vitest';
import { createLogger } from '../logger.ts';
import { createConsoleEmailSender } from './email-sender.ts';

describe('console email sender', () => {
  it('writes the recipient, subject and text to the log instead of sending', async () => {
    const lines: Record<string, unknown>[] = [];
    const logger = createLogger('info', {
      write: (line: string) => {
        lines.push(JSON.parse(line) as Record<string, unknown>);
      },
    });

    await createConsoleEmailSender(logger).send({
      to: { email: 'hr.in@acme.example.com', name: 'India HR' },
      subject: 'Reset your password',
      text: 'Open http://localhost:5173/set-password?token=abc',
      html: '<p>Open the link</p>',
    });

    expect(lines).toContainEqual(
      expect.objectContaining({
        email: {
          to: 'hr.in@acme.example.com',
          subject: 'Reset your password',
          text: 'Open http://localhost:5173/set-password?token=abc',
        },
      }),
    );
  });
});
