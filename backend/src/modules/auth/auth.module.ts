import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ExternalAccountsModule } from '../external-accounts/external-accounts.module';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google/google-auth.guard';
import { GoogleStrategy } from './google/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    ExternalAccountsModule,
    SessionsModule,
    RefreshTokensModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GoogleAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
