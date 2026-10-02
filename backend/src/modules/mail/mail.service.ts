import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { loadEnv } from '../../config/env';

/**
 * Outbound account mail: verification and password reset.
 *
 * Two transports. With `SMTP_URL` set, real mail over SMTP. Without it — which
 * is only permitted outside production, see config/env.ts — the message is
 * written to the log with its link intact, so the whole flow can be walked
 * through locally without standing up a mail server or, worse, wiring a real
 * provider into a development machine.
 *
 * Sending never throws into the caller. A reset endpoint that 500s because the
 * mail provider is having an afternoon tells an attacker which addresses exist
 * (the failure only happens for real users) and tells the real user to give up.
 * Failures are logged and swallowed; the caller always reports the same neutral
 * outcome.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter | null;

  constructor() {
    const { SMTP_URL } = loadEnv();
    this.transporter = SMTP_URL ? createTransport(SMTP_URL) : null;
  }

  async sendVerification(to: string, username: string, token: string): Promise<void> {
    const url = `${loadEnv().PUBLIC_APP_URL}/verify?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Confirm your RepX address',
      heading: 'Confirm your address',
      body: `Welcome to RepX, ${username}. Confirm this address to secure your account and start playing ranked.`,
      action: 'Confirm address',
      url,
      footer: 'If you did not create a RepX account, ignore this message.',
    });
  }

  async sendPasswordReset(to: string, username: string, token: string): Promise<void> {
    const url = `${loadEnv().PUBLIC_APP_URL}/reset?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Reset your RepX password',
      heading: 'Reset your password',
      body: `Hello ${username}. Use the link below to choose a new password. It expires in one hour and can only be used once.`,
      action: 'Choose a new password',
      url,
      footer:
        'If you did not ask for this, no action is needed — your password has not changed.',
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    heading: string;
    body: string;
    action: string;
    url: string;
    footer: string;
  }): Promise<void> {
    const { MAIL_FROM } = loadEnv();

    if (!this.transporter) {
      this.logger.log(
        `\n─── mail (not sent: no SMTP_URL) ───\nTo: ${message.to}\nSubject: ${message.subject}\n${message.action}: ${message.url}\n────────────────────────────────────`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: `${message.heading}\n\n${message.body}\n\n${message.action}: ${message.url}\n\n${message.footer}`,
        html: render(message),
      });
    } catch (error) {
      // Swallowed on purpose — see the class comment.
      this.logger.error(`Could not send "${message.subject}" to ${message.to}: ${String(error)}`);
    }
  }
}

/**
 * The HTML body.
 *
 * Table-based, inline-styled and no external assets, because that is what mail
 * clients actually render. Outlook has no flexbox, Gmail strips <style> blocks,
 * and a remote image is blocked by default — so the link is a styled anchor and
 * the plain-text alternative above carries the same URL for anyone whose client
 * refuses HTML entirely.
 */
function render(message: {
  heading: string;
  body: string;
  action: string;
  url: string;
  footer: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#07080c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07080c;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#15181f;border-radius:16px;padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;">
<tr><td style="font-size:22px;font-weight:800;color:#b6ff3b;letter-spacing:1px;padding-bottom:20px;">REPX</td></tr>
<tr><td style="font-size:24px;font-weight:800;color:#ffffff;padding-bottom:12px;">${escapeHtml(message.heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#a7adb8;padding-bottom:26px;">${escapeHtml(message.body)}</td></tr>
<tr><td style="padding-bottom:26px;">
  <a href="${escapeAttr(message.url)}" style="display:inline-block;background:#b6ff3b;color:#09090b;font-weight:700;font-size:15px;text-decoration:none;padding:14px 26px;border-radius:12px;">${escapeHtml(message.action)}</a>
</td></tr>
<tr><td style="font-size:12.5px;line-height:1.5;color:#6f7580;border-top:1px solid #2b303c;padding-top:18px;">
  ${escapeHtml(message.footer)}<br><br>
  If the button does not work, paste this into your browser:<br>
  <span style="color:#a7adb8;word-break:break-all;">${escapeHtml(message.url)}</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Attribute context additionally has to survive a quote breaking out of href. */
function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
