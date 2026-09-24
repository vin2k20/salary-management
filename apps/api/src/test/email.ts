import type { EmailMessage, EmailSender } from '../email/email-sender.ts';

/** An email sender that keeps messages in memory, so tests can read them. */
export function createRecordingEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}
