import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthClientEntity } from '../oauth/entities/oauth-client.entity';
import { OAuthClientsController } from './oauth-clients.controller';
import { OAuthClientsService } from './oauth-clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClientEntity])],
  controllers: [OAuthClientsController],
  providers: [OAuthClientsService],
  exports: [OAuthClientsService],
})
export class OAuthClientsModule {}
