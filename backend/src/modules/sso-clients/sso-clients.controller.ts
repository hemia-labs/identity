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
import { CreateSsoClientDto } from './dtos/create-sso-client.dto';
import { UpdateSsoClientDto } from './dtos/update-sso-client.dto';
import { SsoClientsService } from './sso-clients.service';

@Controller('sso-clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SsoClientsController {
  constructor(private readonly ssoClientsService: SsoClientsService) {}

  @Post()
  @Permissions('sso_clients.create')
  create(@Body() dto: CreateSsoClientDto) {
    return this.ssoClientsService.create(dto);
  }

  @Get()
  @Permissions('sso_clients.read')
  findAll() {
    return this.ssoClientsService.findAll();
  }

  @Get(':id')
  @Permissions('sso_clients.read')
  findOne(@Param('id') id: string) {
    return this.ssoClientsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('sso_clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateSsoClientDto) {
    return this.ssoClientsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('sso_clients.delete')
  remove(@Param('id') id: string) {
    return this.ssoClientsService.remove(id);
  }
}
