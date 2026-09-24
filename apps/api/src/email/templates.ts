import type { EmailMessage } from './email-sender.ts';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Email with a link to choose a new password. */
export function resetPasswordEmail(
  user: { email: string; name: string },
  link: string,
): EmailMessage {
  return {
    to: { email: user.email, name: user.name },
    subject: 'Reset your ACME Salary Management password',
    text: [
      `Hello ${user.name},`,
      '',
      'Someone asked to reset the password for your ACME Salary Management account.',
      `Choose a new password here: ${link}`,
      '',
      'The link works once, for 30 minutes. If you did not ask for this, ignore this email;',
      'your password stays the same.',
    ].join('\n'),
    html: [
      `<p>Hello ${escapeHtml(user.name)},</p>`,
      '<p>Someone asked to reset the password for your ACME Salary Management account.</p>',
      `<p><a href="${escapeHtml(link)}">Choose a new password</a></p>`,
      '<p>The link works once, for 30 minutes. If you did not ask for this, ignore this email;',
      'your password stays the same.</p>',
    ].join('\n'),
  };
}

/** Email with a link to accept an invite and choose a first password. */
export function inviteEmail(
  user: { email: string; name: string },
  invitedBy: string,
  link: string,
): EmailMessage {
  return {
    to: { email: user.email, name: user.name },
    subject: 'You are invited to ACME Salary Management',
    text: [
      `Hello ${user.name},`,
      '',
      `${invitedBy} has added you to ACME Salary Management.`,
      `Choose your password here: ${link}`,
      '',
      'The link works once, for 72 hours. If it has expired, ask for a new invite.',
    ].join('\n'),
    html: [
      `<p>Hello ${escapeHtml(user.name)},</p>`,
      `<p>${escapeHtml(invitedBy)} has added you to ACME Salary Management.</p>`,
      `<p><a href="${escapeHtml(link)}">Choose your password</a></p>`,
      '<p>The link works once, for 72 hours. If it has expired, ask for a new invite.</p>',
    ].join('\n'),
  };
}
