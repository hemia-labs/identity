import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityEventEntity } from './entities/identity-event.entity';
import { IdentityEventsService } from './identity-events.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([IdentityEventEntity])],
  providers: [IdentityEventsService],
  exports: [IdentityEventsService],
})
export class IdentityEventsModule {}
