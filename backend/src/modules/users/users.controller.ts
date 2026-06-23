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
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.usersService.toPublicUser(user);
  }

  @Get()
  @Permissions('users.read')
  async findAll(@CurrentTenant() tenantId: string) {
    const users = await this.usersService.findAll(tenantId);
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Get(':id')
  @Permissions('users.read')
  async findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const user = await this.usersService.findOne(id, tenantId);
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id')
  @Permissions('users.update')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, dto, tenantId);
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id/status')
  @Permissions('users.update')
  async updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    const user = await this.usersService.updateStatus(id, status, tenantId);
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id/lock')
  @Permissions('users.lock')
  async lock(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const user = await this.usersService.updateStatus(
      id,
      UserStatus.Locked,
      tenantId,
    );
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id/unlock')
  @Permissions('users.unlock')
  async unlock(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const user = await this.usersService.updateStatus(
      id,
      UserStatus.Active,
      tenantId,
    );
    return this.usersService.toPublicUser(user);
  }

  @Delete(':id')
  @Permissions('users.delete')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.remove(id, tenantId);
  }
}
