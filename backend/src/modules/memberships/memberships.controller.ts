import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateMembershipDto } from './dtos/create-membership.dto';
import { UpdateMembershipStatusDto } from './dtos/update-membership-status.dto';
import { MembershipsService } from './memberships.service';

@Controller('memberships')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Permissions('memberships.create')
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateMembershipDto) {
    return this.membershipsService.create(tenantId, dto);
  }

  @Get()
  @Permissions('memberships.read')
  findAll(@CurrentTenant() tenantId: string, @Query('userId') userId?: string) {
    return userId
      ? this.membershipsService.findByUser(userId, tenantId)
      : this.membershipsService.findAll(tenantId);
  }

  @Patch(':id/status')
  @Permissions('memberships.update')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipStatusDto,
  ) {
    return this.membershipsService.updateStatus(id, tenantId, dto.status);
  }

  @Delete(':id')
  @Permissions('memberships.delete')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.membershipsService.remove(id, tenantId);
  }
}
