import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AdminAction } from '../../common/decorators/admin-action.decorator';
import { IdentityAdminGuard } from '../../common/guards/identity-admin.guard';
import { SaveOAuthApiDto } from './oauth-api.dto';
import { OAuthApisService } from './oauth-apis.service';
@Controller('oauth-apis')
@UseGuards(IdentityAdminGuard)
export class OAuthApisController {
  constructor(private readonly scopes: OAuthApisService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @AdminAction('identity.oauth_clients.read')
  list() {
    return this.scopes.list();
  }
  @Post() @AdminAction('identity.oauth_clients.create') create(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: SaveOAuthApiDto,
  ) {
    return this.scopes.save(dto);
  }
  @Put(':id') @AdminAction('identity.oauth_clients.update') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: SaveOAuthApiDto,
  ) {
    return this.scopes.save(dto, id);
  }
}
