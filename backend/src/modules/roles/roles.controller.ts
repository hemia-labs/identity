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
import { AssignPermissionDto } from './dtos/assign-permission.dto';
import { AssignUserRoleDto } from './dtos/assign-user-role.dto';
import { CreateRoleDto } from './dtos/create-role.dto';
import { UpdateRoleDto } from './dtos/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions('roles.create')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Permissions('roles.read')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions('roles.read')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('roles.update')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('roles.delete')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @Permissions('roles.assign')
  assignPermission(@Param('id') id: string, @Body() dto: AssignPermissionDto) {
    return this.rolesService.assignPermission(id, dto);
  }

  @Delete(':id/permissions/:permissionId')
  @Permissions('roles.assign')
  removePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.removePermission(id, permissionId);
  }

  @Post('users/:userId')
  @Permissions('roles.assign')
  assignUserRole(
    @Param('userId') userId: string,
    @Body() dto: AssignUserRoleDto,
  ) {
    return this.rolesService.assignUserRole(userId, dto);
  }

  @Delete('users/:userId/:roleId')
  @Permissions('roles.assign')
  removeUserRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.removeUserRole(userId, roleId);
  }
}
