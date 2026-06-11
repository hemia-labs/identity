import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IdentityEventType,
} from '../identity-events/entities/identity-event.entity';
import { IdentityEventsService } from '../identity-events/identity-events.service';
import { MailService } from '../mail/mail.service';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { MembershipsService } from '../memberships/memberships.service';
import { UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AcceptInvitationDto } from './dtos/accept-invitation.dto';
import {
  InvitationEntity,
  InvitationStatus,
} from './entities/invitation.entity';

const INVITATION_DAYS = 7;
const INVITATION_EMAIL_TEMPLATE = `
<mjml>
  <mj-body background-color="#f6f8fb">
    <mj-section background-color="#ffffff" padding="32px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="700" color="#111827">
          Invitacion a <%= app %>
        </mj-text>
        <mj-text font-size="15px" line-height="24px" color="#374151">
          <%= actorLabel %> <%= actionLabel %><% if (resourceName) { %> en <strong><%= resourceName %></strong><% } %>.
        </mj-text>
        <mj-button background-color="#111827" color="#ffffff" href="<%= acceptUrl %>" font-size="14px">
          Aceptar invitacion
        </mj-button>
        <mj-text font-size="13px" line-height="20px" color="#6b7280">
          Este enlace expira el <%= expiresAt %>. Si no esperabas esta invitacion, puedes ignorar este correo.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

type InvitationEmailContext = {
  app?: string;
  actorName?: string;
  actorEmail?: string;
  action?: string;
  actionLabel?: string;
  resourceName?: string;
};

type CreateInvitationInput = {
  email: string;
  tenantId: string;
  organizationId?: string | null;
  teamId?: string | null;
  emailContext?: InvitationEmailContext;
};

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(InvitationEntity)
    private readonly invitationsRepository: Repository<InvitationEntity>,
    private readonly configService: ConfigService,
    private readonly identityEventsService: IdentityEventsService,
    private readonly mailService: MailService,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateInvitationInput, invitedByUserId?: string | null) {
    const token = this.createToken();
    const invitation = await this.invitationsRepository.save(
      this.invitationsRepository.create({
        email: dto.email.toLowerCase(),
        tokenHash: this.hashToken(token),
        tenantId: dto.tenantId,
        organizationId: dto.organizationId,
        teamId: dto.teamId,
        invitedByUserId,
        status: InvitationStatus.Pending,
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
      }),
    );

    await this.sendInvitationEmail(invitation, token, dto.emailContext);

    return { invitation: this.toPublicInvitation(invitation), token };
  }

  async findOne(id: string) {
    const invitation = await this.invitationsRepository.findOne({
      where: { id },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    return invitation;
  }

  async resend(id: string) {
    const invitation = await this.findOne(id);
    if (invitation.status !== InvitationStatus.Pending) {
      throw new BadRequestException('Only pending invitations can be resent');
    }
    if (invitation.expiresAt <= new Date()) {
      invitation.status = InvitationStatus.Expired;
      await this.invitationsRepository.save(invitation);
      throw new BadRequestException('Invitation expired');
    }

    const token = this.createToken();
    invitation.tokenHash = this.hashToken(token);
    invitation.resentAt = new Date();
    await this.invitationsRepository.save(invitation);

    await this.sendInvitationEmail(invitation, token);

    return { invitation: this.toPublicInvitation(invitation), token };
  }

  async cancel(id: string) {
    const invitation = await this.findOne(id);
    if (invitation.status !== InvitationStatus.Pending) {
      throw new BadRequestException('Only pending invitations can be cancelled');
    }

    invitation.status = InvitationStatus.Cancelled;
    invitation.cancelledAt = new Date();
    await this.invitationsRepository.save(invitation);
    return this.toPublicInvitation(invitation);
  }

  async accept(dto: AcceptInvitationDto) {
    const invitation = await this.invitationsRepository.findOne({
      where: {
        tokenHash: this.hashToken(dto.token),
        status: InvitationStatus.Pending,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.expiresAt <= new Date()) {
      invitation.status = InvitationStatus.Expired;
      await this.invitationsRepository.save(invitation);
      throw new BadRequestException('Invitation expired');
    }

    const user = await this.usersService.findOrCreateExternalUser({
      email: invitation.email,
      firstName: dto.firstName ?? invitation.email.split('@')[0],
      lastName: dto.lastName ?? '',
    });

    await this.membershipsService.upsertActiveMembership({
      userId: user.id,
      tenantId: invitation.tenantId,
      organizationId: invitation.organizationId,
      teamId: invitation.teamId,
    });

    invitation.status = InvitationStatus.Accepted;
    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = user.id;
    await this.invitationsRepository.save(invitation);

    await this.identityEventsService.emit({
      type: IdentityEventType.InvitationAccepted,
      tenantId: invitation.tenantId,
      organizationId: invitation.organizationId,
      teamId: invitation.teamId,
      userId: user.id,
      payload: {
        invitationId: invitation.id,
        email: invitation.email,
        userId: user.id,
      },
    });

    return {
      invitation: this.toPublicInvitation(invitation),
      user: this.usersService.toBasicProfile(user),
      membershipStatus: MembershipStatus.Active,
      userStatus: UserStatus.Active,
    };
  }

  toPublicInvitation(invitation: InvitationEntity) {
    return {
      id: invitation.id,
      email: invitation.email,
      tenantId: invitation.tenantId,
      organizationId: invitation.organizationId,
      teamId: invitation.teamId,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      resentAt: invitation.resentAt,
      acceptedAt: invitation.acceptedAt,
      cancelledAt: invitation.cancelledAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }

  private createToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private sendInvitationEmail(
    invitation: InvitationEntity,
    token: string,
    context: InvitationEmailContext = {},
  ) {
    const app = context.app ?? this.configService.getOrThrow<string>('email.app');

    return this.mailService.send({
      to: invitation.email,
      subject: `Invitacion a ${app}`,
      template: INVITATION_EMAIL_TEMPLATE,
      app,
      data: {
        app,
        acceptUrl: this.buildAcceptUrl(token),
        action: context.action ?? 'invitation.created',
        actionLabel: context.actionLabel ?? 'te invito a unirte',
        actorLabel: this.getActorLabel(context),
        actorName: context.actorName,
        actorEmail: context.actorEmail,
        expiresAt: invitation.expiresAt.toLocaleDateString('es-MX', {
          dateStyle: 'long',
        }),
        inviteeEmail: invitation.email,
        resourceName: context.resourceName,
        tenantId: invitation.tenantId,
        organizationId: invitation.organizationId,
        teamId: invitation.teamId,
      },
    });
  }

  private buildAcceptUrl(token: string) {
    const acceptUrl = new URL(
      this.configService.getOrThrow<string>('email.invitationAcceptUrl'),
    );
    acceptUrl.searchParams.set('token', token);
    return acceptUrl.toString();
  }

  private getActorLabel(context: InvitationEmailContext) {
    if (context.actorName && context.actorEmail) {
      return `${context.actorName} (${context.actorEmail})`;
    }

    if (context.actorName) {
      return context.actorName;
    }

    if (context.actorEmail) {
      return context.actorEmail;
    }

    return context.app ?? this.configService.getOrThrow<string>('email.app');
  }
}
