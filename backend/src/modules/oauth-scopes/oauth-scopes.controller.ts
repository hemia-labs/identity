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
import { SaveOAuthScopeDto } from './oauth-scope.dto';
import { OAuthScopesService } from './oauth-scopes.service';
@Controller('oauth-scopes')
@UseGuards(IdentityAdminGuard)
export class OAuthScopesController {
  constructor(private readonly scopes: OAuthScopesService) {}
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
    dto: SaveOAuthScopeDto,
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
    dto: SaveOAuthScopeDto,
  ) {
    return this.scopes.save(dto, id);
  }
}
