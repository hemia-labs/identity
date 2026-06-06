import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreatePermissionDto } from './dtos/create-permission.dto';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions('permissions.assign')
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Get()
  @Permissions('permissions.read')
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @Permissions('permissions.read')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Post('sync-base')
  @Permissions('permissions.assign')
  syncBasePermissions() {
    return this.permissionsService.syncBasePermissions();
  }
}
