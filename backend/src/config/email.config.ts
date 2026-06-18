import { registerAs } from '@nestjs/config';

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export default registerAs('email', () => ({
  host: process.env.SMTP_HOST ?? '',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  app: process.env.EMAIL_FROM_APP ?? 'Hemia ID',
  invitationAcceptUrl:
    process.env.EMAIL_INVITATION_ACCEPT_URL ??
    `${requireEnv('ID_FRONTEND_URL')}/invitations/accept`,
}));
