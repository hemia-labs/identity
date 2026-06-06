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
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserStatus } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users.create')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Permissions('users.read')
  findAll(@CurrentTenant() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  @Permissions('users.read')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Permissions('users.update')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto, tenantId);
  }

  @Patch(':id/status')
  @Permissions('users.update')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    return this.usersService.updateStatus(id, status, tenantId);
  }

  @Patch(':id/lock')
  @Permissions('users.lock')
  lock(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.updateStatus(id, UserStatus.Locked, tenantId);
  }

  @Patch(':id/unlock')
  @Permissions('users.unlock')
  unlock(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.updateStatus(id, UserStatus.Active, tenantId);
  }

  @Delete(':id')
  @Permissions('users.delete')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.remove(id, tenantId);
  }
}
