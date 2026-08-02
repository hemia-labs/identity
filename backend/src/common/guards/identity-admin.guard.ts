import { createHash } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { IsNull, Repository } from 'typeorm';
import { ADMIN_ACTION_KEY } from '../decorators/admin-action.decorator';
import { OAuthTokenEntity } from '../../modules/oauth/entities/oauth-token.entity';
import {
  OAuthClientEntity,
  OAuthClientStatus,
} from '../../modules/oauth/entities/oauth-client.entity';
import { AccessAdminGuard } from './access-admin.guard';

@Injectable()
export class IdentityAdminGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    @InjectRepository(OAuthTokenEntity)
    private readonly tokensRepository: Repository<OAuthTokenEntity>,
    @InjectRepository(OAuthClientEntity)
    private readonly clientsRepository: Repository<OAuthClientEntity>,
    private readonly reflector: Reflector,
    private readonly accessAdminGuard: AccessAdminGuard,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    if (await this.canActivateClient(context)) {
      return true;
    }

    await super.canActivate(context);
    return this.accessAdminGuard.canActivate(context);
  }

  handleRequest<TUser>(error: Error | null, user: TUser | false) {
    if (error || !user) {
      throw error ?? new UnauthorizedException('Invalid access token');
    }

    return user;
  }

  private async canActivateClient(context: ExecutionContext) {
    const action = this.reflector.getAllAndOverride<string>(ADMIN_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return false;

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return false;

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) return false;

    const storedToken = await this.tokensRepository.findOne({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        revokedAt: IsNull(),
      },
    });

    if (!storedToken) {
      if (token.split('.').length === 3) return false;
      throw new UnauthorizedException('Invalid access token');
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (storedToken.userId || storedToken.sessionId) {
      throw new UnauthorizedException('Invalid access token');
    }

    const client = await this.clientsRepository.findOne({
      where: { clientId: storedToken.clientId },
    });
    if (
      !client ||
      client.status !== OAuthClientStatus.Active ||
      client.audience !== 'identity-api'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!storedToken.scope.split(/\s+/).includes(action)) {
      throw new ForbiddenException('Insufficient scope');
    }

    (request as Request & { adminActorClientId?: string }).adminActorClientId =
      storedToken.clientId;

    return true;
  }
}
