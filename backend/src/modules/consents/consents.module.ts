import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthClientEntity } from '../oauth/entities/oauth-client.entity';
import { ConsentsController } from './consents.controller';
import { OAuthConsentEntity } from './entities/oauth-consent.entity';
import { ConsentsService } from './consents.service';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthConsentEntity, OAuthClientEntity])],
  controllers: [ConsentsController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
