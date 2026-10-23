import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConsentsModule } from '../consents/consents.module';
import { JwksModule } from '../jwks/jwks.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { OAuthAuthorizationCodeEntity } from './entities/oauth-authorization-code.entity';
import { OAuthClientEntity } from './entities/oauth-client.entity';
import { OAuthTokenEntity } from './entities/oauth-token.entity';
import { ReauthenticationController } from '../auth/reauthentication/reauthentication.controller';
import { ReauthenticationService } from '../auth/reauthentication/reauthentication.service';
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
    AuthModule,
    ConsentsModule,
    JwksModule,
    SessionsModule,
    UsersModule,
  ],
  controllers: [OAuthController, ReauthenticationController],
  providers: [OAuthService, ReauthenticationService],
  exports: [OAuthService],
})
export class OAuthModule {}
