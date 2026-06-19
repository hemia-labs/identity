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

  @Delete(':id')
  @Permissions('oauth_clients.delete')
  remove(@Param('id') id: string) {
    return this.oauthClientsService.remove(id);
  }
}
