import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentsModule } from '../consents/consents.module';
import { JwksModule } from '../jwks/jwks.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { OAuthAuthorizationCodeEntity } from './entities/oauth-authorization-code.entity';
import { OAuthClientEntity } from './entities/oauth-client.entity';
import { OAuthTokenEntity } from './entities/oauth-token.entity';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OAuthClientEntity,
      OAuthAuthorizationCodeEntity,
      OAuthTokenEntity,
    ]),
    JwtModule.register({}),
    ConsentsModule,
    JwksModule,
    SessionsModule,
    UsersModule,
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
