import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AuthModule, MembershipsModule, SessionsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
