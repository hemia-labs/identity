import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from './entities/session.entity';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
