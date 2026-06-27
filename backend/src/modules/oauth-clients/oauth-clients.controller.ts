import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateOAuthClientDto } from './dtos/create-oauth-client.dto';
import { OAuthClientValueDto } from './dtos/oauth-client-value.dto';
import { UpdateOAuthClientDto } from './dtos/update-oauth-client.dto';
import { OAuthClientsService } from './oauth-clients.service';

@Controller('oauth-clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OAuthClientsController {
  constructor(private readonly oauthClientsService: OAuthClientsService) {}

  @Post()
  @Permissions('oauth_clients.create')
  create(@Body() dto: CreateOAuthClientDto) {
    return this.oauthClientsService.create(dto);
  }

  @Get()
  @Permissions('oauth_clients.read')
  findAll() {
    return this.oauthClientsService.findAll();
  }

  @Get(':id')
  @Permissions('oauth_clients.read')
  findOne(@Param('id') id: string) {
    return this.oauthClientsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('oauth_clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateOAuthClientDto) {
    return this.oauthClientsService.update(id, dto);
  }

  @Post(':id/rotate-secret')
  @Permissions('oauth_clients.update')
  rotateSecret(@Param('id') id: string) {
    return this.oauthClientsService.rotateSecret(id);
  }

  @Post(':id/redirect-uris')
  @Permissions('oauth_clients.update')
  addRedirectUri(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.addRedirectUri(id, dto.value);
  }

  @Delete(':id/redirect-uris')
  @Permissions('oauth_clients.update')
  removeRedirectUri(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.removeRedirectUri(id, dto.value);
  }

  @Post(':id/scopes')
  @Permissions('oauth_clients.update')
  addScope(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.addScope(id, dto.value);
  }

  @Delete(':id/scopes')
  @Permissions('oauth_clients.update')
  removeScope(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.removeScope(id, dto.value);
  }

  @Post(':id/grant-types')
  @Permissions('oauth_clients.update')
  addGrantType(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.addGrantType(id, dto.value);
  }

  @Delete(':id/grant-types')
  @Permissions('oauth_clients.update')
  removeGrantType(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.removeGrantType(id, dto.value);
  }

  @Post(':id/response-types')
  @Permissions('oauth_clients.update')
  addResponseType(@Param('id') id: string, @Body() dto: OAuthClientValueDto) {
    return this.oauthClientsService.addResponseType(id, dto.value);
  }

  @Delete(':id/response-types')
  @Permissions('oauth_clients.update')
  removeResponseType(
    @Param('id') id: string,
    @Body() dto: OAuthClientValueDto,
  ) {
    return this.oauthClientsService.removeResponseType(id, dto.value);
  }

  @Delete(':id')
  @Permissions('oauth_clients.delete')
  remove(@Param('id') id: string) {
    return this.oauthClientsService.remove(id);
  }
}
