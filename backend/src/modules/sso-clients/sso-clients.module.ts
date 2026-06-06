import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsoClientEntity } from './entities/sso-client.entity';
import { SsoClientsController } from './sso-clients.controller';
import { SsoClientsService } from './sso-clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([SsoClientEntity])],
  controllers: [SsoClientsController],
  providers: [SsoClientsService],
  exports: [SsoClientsService],
})
export class SsoClientsModule {}
