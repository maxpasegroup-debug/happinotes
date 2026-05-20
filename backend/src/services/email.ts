import nodemailer from 'nodemailer';
import { env } from '../config/env';

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

export const sendPasswordResetOtp = async (email: string, otp: string): Promise<void> => {
  if (!hasSmtpConfig) {
    if (env.NODE_ENV !== 'production') {
      console.info(`Password reset OTP for ${email}: ${otp}`);
      return;
    }
    throw new Error('SMTP is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Your HappiNotes password reset OTP',
    text: `Your HappiNotes password reset OTP is ${otp}. It expires in 10 minutes.`,
  });
};
