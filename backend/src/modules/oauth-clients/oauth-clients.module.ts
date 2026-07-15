import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessAdminGuard } from '../../common/guards/access-admin.guard';
import { IdentityAdminGuard } from '../../common/guards/identity-admin.guard';
import { OAuthClientEntity } from '../oauth/entities/oauth-client.entity';
import { OAuthTokenEntity } from '../oauth/entities/oauth-token.entity';
import { OAuthClientsController } from './oauth-clients.controller';
import { OAuthClientsService } from './oauth-clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClientEntity, OAuthTokenEntity])],
  controllers: [OAuthClientsController],
  providers: [OAuthClientsService, AccessAdminGuard, IdentityAdminGuard],
  exports: [OAuthClientsService],
})
export class OAuthClientsModule {}
