import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { ExternalAccountEntity } from './entities/external-account.entity';
import { ExternalAccountsService } from './external-accounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalAccountEntity, UserEntity])],
  providers: [ExternalAccountsService],
  exports: [ExternalAccountsService],
})
export class ExternalAccountsModule {}
