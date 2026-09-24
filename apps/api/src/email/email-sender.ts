import type { Logger } from 'pino';

export interface EmailMessage {
  to: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
}

/** Sends email. Brevo in production, the console in development, a recorder in tests. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Writes emails to the log instead of sending them, so links can be opened in development. It
 * logs the link, so it is refused in production (see config).
 */
export function createConsoleEmailSender(logger: Logger): EmailSender {
  return {
    send(message) {
      logger.info(
        { email: { to: message.to.email, subject: message.subject, text: message.text } },
        'Email written to the log instead of being sent',
      );
      return Promise.resolve();
    },
  };
}
