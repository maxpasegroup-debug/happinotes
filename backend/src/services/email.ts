import { env } from '../config/env';

export const sendPasswordResetOtp = async (email: string, otp: string): Promise<void> => {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    throw new Error('Resend email delivery is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [email],
      subject: 'Your HappiNotes password reset code',
      text: `Your HappiNotes password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend email delivery failed (${response.status}): ${detail}`);
  }
};
