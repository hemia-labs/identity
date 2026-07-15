import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAction } from '../../common/decorators/admin-action.decorator';
import { IdentityAdminGuard } from '../../common/guards/identity-admin.guard';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserStatus } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(IdentityAdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @AdminAction('identity.users.create')
  async create(
    @Req() request: Request & { adminActorClientId?: string },
    @Body() dto: CreateUserDto,
  ) {
    const user = await this.usersService.create(dto, request.adminActorClientId);
    return this.usersService.toPublicUser(user);
  }

  @Get()
  @AdminAction('identity.users.read')
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Get(':id')
  @AdminAction('identity.users.read')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id')
  @AdminAction('identity.users.update')
  async update(
    @Req() request: Request & { adminActorClientId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, dto, request.adminActorClientId);
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id/status')
  @AdminAction('identity.users.update')
  async updateStatus(
    @Req() request: Request & { adminActorClientId?: string },
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    const user = await this.usersService.updateStatus(
      id,
      status,
      request.adminActorClientId,
    );
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id/lock')
  @AdminAction('identity.users.lock')
  async lock(
    @Req() request: Request & { adminActorClientId?: string },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.updateStatus(
      id,
      UserStatus.Locked,
      request.adminActorClientId,
    );
    return this.usersService.toPublicUser(user);
  }

  @Patch(':id/unlock')
  @AdminAction('identity.users.unlock')
  async unlock(
    @Req() request: Request & { adminActorClientId?: string },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.updateStatus(
      id,
      UserStatus.Active,
      request.adminActorClientId,
    );
    return this.usersService.toPublicUser(user);
  }

  @Delete(':id')
  @AdminAction('identity.users.delete')
  remove(
    @Req() request: Request & { adminActorClientId?: string },
    @Param('id') id: string,
  ) {
    return this.usersService.remove(id, request.adminActorClientId);
  }
}
