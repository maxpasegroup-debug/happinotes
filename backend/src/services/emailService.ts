import sanitizeHtml from 'sanitize-html';
import { Resend, type Attachment } from 'resend';
import { env } from '../config/env';

const FROM_NAME = "Happinotes";
const FROM_EMAIL = env.RESEND_FROM_EMAIL.trim();
const OTP_EXPIRY_MINUTES = 5;

export type EmailImage = { content: Buffer; contentType: 'image/png' | 'image/jpeg'; filename: string };

type EmailDeliveryFailureCategory = 'configuration_missing' | 'provider_rejected' | 'provider_exception';

export class EmailDeliveryError extends Error {
  constructor(readonly category: EmailDeliveryFailureCategory) {
    super('Email delivery failed');
    this.name = 'EmailDeliveryError';
  }
}

function getClient(): Resend {
  const apiKey = env.RESEND_API_KEY.trim();
  if (!apiKey) {
    throw new EmailDeliveryError('configuration_missing');
  }
  return new Resend(apiKey);
}

function buildOTPHtml(otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your OTP - Happinotes</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <div style="background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1f2937;">Hello!</h1>
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280; line-height: 1.5;">Use the code below to complete your request on Happinotes.</p>
      <div style="background: #f9fafb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1f2937;">${otp}</p>
      </div>
      <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>. Do not share it with anyone.</p>
      <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
    <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">Happinotes</p>
  </div>
</body>
</html>
  `.trim();
}

async function deliverEmail(
  to: string,
  message: { subject: string; text: string; html?: string; attachments?: Attachment[] } | { subject: string; html: string },
  idempotencyKey?: string,
): Promise<void> {
  try {
    const resend = getClient();
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      ...message,
    }, { idempotencyKey });

    if (error) throw new EmailDeliveryError('provider_rejected');
    console.info('email_delivery_succeeded', { provider: 'resend' });
  } catch (error) {
    const category = error instanceof EmailDeliveryError
      ? error.category
      : 'provider_exception';
    console.error('email_delivery_failed', { provider: 'resend', category });
    throw new EmailDeliveryError(category);
  }
}

export function sendOTPEmail(to: string, otp: string): Promise<void> {
  return deliverEmail(to, { subject: "Your OTP Code - Happinotes", html: buildOTPHtml(otp) });
}

export function sendAdminEmail(to: string, subject: string, text: string, idempotencyKey: string, html?: string, image?: EmailImage): Promise<void> {
  const formatted = html && sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'blockquote', 'strong', 'em', 'u', 's', 'code', 'ul', 'ol', 'li'],
    allowedAttributes: { p: ['style'], h2: ['style'], h3: ['style'], ol: ['start'] },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right)$/] } },
  });
  if (image) {
    const contentId = 'message-image';
    const plainHtml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    return deliverEmail(to, {
      subject, text: text || 'Image attached.',
      html: `${formatted || plainHtml}<p><img src="cid:${contentId}" alt="Attached image" style="max-width:100%;height:auto"></p>`,
      attachments: [{ ...image, content: image.content.toString('base64'), contentId }],
    }, idempotencyKey);
  }
  return deliverEmail(to, { subject, text, ...(formatted && { html: formatted }) }, idempotencyKey);
}
