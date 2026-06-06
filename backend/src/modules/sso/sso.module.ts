import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SsoClientsModule } from '../sso-clients/sso-clients.module';
import { UsersModule } from '../users/users.module';
import { SsoAuthorizationCodeEntity } from './entities/sso-authorization-code.entity';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SsoAuthorizationCodeEntity]),
    AuthModule,
    SessionsModule,
    SsoClientsModule,
    UsersModule,
  ],
  controllers: [SsoController],
  providers: [SsoService],
})
export class SsoModule {}
