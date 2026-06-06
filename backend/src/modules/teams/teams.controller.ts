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
import { CreateTeamDto } from './dtos/create-team.dto';
import { UpdateTeamDto } from './dtos/update-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Permissions('teams.create')
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(tenantId, dto);
  }

  @Get()
  @Permissions('teams.read')
  findAll(@CurrentTenant() tenantId: string) {
    return this.teamsService.findAll(tenantId);
  }

  @Get(':id')
  @Permissions('teams.read')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.teamsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Permissions('teams.update')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Permissions('teams.delete')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.teamsService.remove(id, tenantId);
  }
}
