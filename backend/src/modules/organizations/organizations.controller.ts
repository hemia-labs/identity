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
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Permissions('organizations.create')
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(tenantId, dto);
  }

  @Get()
  @Permissions('organizations.read')
  findAll(@CurrentTenant() tenantId: string) {
    return this.organizationsService.findAll(tenantId);
  }

  @Get(':id')
  @Permissions('organizations.read')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.organizationsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Permissions('organizations.update')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Permissions('organizations.delete')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.organizationsService.remove(id, tenantId);
  }
}
