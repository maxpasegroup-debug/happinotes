import { Resend } from 'resend';
import { env } from '../config/env';

const FROM_NAME = "Happinotes";
const FROM_EMAIL = env.RESEND_FROM_EMAIL.trim();
const OTP_EXPIRY_MINUTES = 5;

function getClient(): Resend {
  const apiKey = env.RESEND_API_KEY.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
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

export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  console.log("[Email] Sending OTP email to:", to);
  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: "Your OTP Code - Happinotes",
      html: buildOTPHtml(otp),
    });

    if (error) throw new Error(error.message);
    console.log("[Email] Email sent successfully to", to, data?.id ?? 'accepted');
  } catch (err) {
    console.error("[Email] Email sending failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Email] Failed to send OTP to", to, message);
    throw err;
  }
}
