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
import { CreateTenantDto } from './dtos/create-tenant.dto';
import { UpdateTenantDto } from './dtos/update-tenant.dto';
import { TenantStatus } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Permissions('tenants.create')
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @Permissions('tenants.read')
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Permissions('tenants.read')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('tenants.update')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/status')
  @Permissions('tenants.suspend')
  updateStatus(@Param('id') id: string, @Body('status') status: TenantStatus) {
    return this.tenantsService.updateStatus(id, status);
  }

  @Delete(':id')
  @Permissions('tenants.update')
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
