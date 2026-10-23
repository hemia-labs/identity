import { EmailSender } from '@hemia/email-sender';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_SENDER_CLIENT } from './mail.constants';
import { MailService } from './mail.service';
import { MailTemplateManager } from './mail-template.manager';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_SENDER_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new EmailSender(
          {
            host: configService.getOrThrow<string>('email.host'),
            port: configService.getOrThrow<number>('email.port'),
            secure: configService.getOrThrow<boolean>('email.secure'),
            auth: {
              user: configService.getOrThrow<string>('email.user'),
              pass: configService.getOrThrow<string>('email.pass'),
            },
          },
          MailTemplateManager,
        ),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
