import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthModule } from '../oauth/oauth.module';
import { OidcIdTokenEntity } from './entities/oidc-id-token.entity';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

@Module({
  imports: [TypeOrmModule.forFeature([OidcIdTokenEntity]), OAuthModule],
  controllers: [OidcController],
  providers: [OidcService],
})
export class OidcModule {}
