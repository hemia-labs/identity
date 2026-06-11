import { EmailSender } from '@hemia/email-sender';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SENDER_CLIENT } from './mail.constants';

type EmailRecipient = string | string[];

type EmailAttachment = {
  filename: string;
  path?: string;
  content?: string | Buffer;
};

export type SendMailInput = {
  to: EmailRecipient;
  subject: string;
  template: string;
  data?: Record<string, unknown>;
  app?: string;
  cc?: EmailRecipient;
  bcc?: EmailRecipient;
  attachments?: EmailAttachment[];
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(EMAIL_SENDER_CLIENT)
    private readonly emailSender: EmailSender,
    private readonly configService: ConfigService,
  ) {}

  async send(input: SendMailInput) {
    try {
      return await this.emailSender.sendEmail({
        ...input,
        app: input.app ?? this.configService.getOrThrow<string>('email.app'),
      });
    } catch (error) {
      this.logger.error('Email delivery failed', this.getErrorStack(error));
      throw new ServiceUnavailableException({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Email delivery failed',
      });
    }
  }

  private getErrorStack(error: unknown) {
    if (error instanceof Error) {
      return error.stack;
    }

    return undefined;
  }
}
