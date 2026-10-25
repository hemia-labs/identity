import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessAdminGuard } from '../../common/guards/access-admin.guard';
import { IdentityAdminGuard } from '../../common/guards/identity-admin.guard';
import { OAuthTokenEntity } from '../oauth/entities/oauth-token.entity';
import { OAuthClientEntity } from '../oauth/entities/oauth-client.entity';
import { UserEntity } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, OAuthClientEntity, OAuthTokenEntity]),
  ],
  controllers: [UsersController],
  providers: [UsersService, AccessAdminGuard, IdentityAdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
