import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwksKeyEntity } from './entities/jwks-key.entity';
import { JwksController } from './jwks.controller';
import { JwksService } from './jwks.service';

@Module({
  imports: [TypeOrmModule.forFeature([JwksKeyEntity])],
  controllers: [JwksController],
  providers: [JwksService],
  exports: [JwksService],
})
export class JwksModule {}
