import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { AcceptInvitationDto } from './dtos/accept-invitation.dto';
import { CreateInvitationDto } from './dtos/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions('invitations.create')
  create(
    @Body() dto: CreateInvitationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invitationsService.create(
      {
        ...dto,
        tenantId,
        emailContext: {
          actorName: user.username ?? user.email,
          actorEmail: user.email,
          action: 'invitation.created',
          actionLabel: 'te invito a unirte',
        },
      },
      user.id,
    );
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions('invitations.update')
  resend(@Param('id') id: string) {
    return this.invitationsService.resend(id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions('invitations.update')
  cancel(@Param('id') id: string) {
    return this.invitationsService.cancel(id);
  }

  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(dto);
  }
}
