import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import argon2 from 'argon2';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import {
  IdentityEventEntity,
  IdentityEventType,
} from '../../identity-events/entities/identity-event.entity';
import {
  OAuthClientEntity,
  OAuthClientStatus,
} from '../../oauth/entities/oauth-client.entity';
import { OAuthTokenEntity } from '../../oauth/entities/oauth-token.entity';
import { SessionEntity } from '../../sessions/entities/session.entity';
import { UserEntity, UserStatus } from '../../users/entities/user.entity';
import {
  ReauthenticateDto,
  WEBHOOK_PAYLOAD_PURPOSE,
} from './reauthenticate.dto';

const ATTEMPT_LIMIT = 5;

@Injectable()
export class ReauthenticationService {
  constructor(private readonly database: DataSource) {}

  async reauthenticate(
    authorization: string | undefined,
    dto: ReauthenticateDto,
  ) {
    const bearer = /^Bearer ([^\s]+)$/.exec(authorization ?? '')?.[1];
    if (!bearer || bearer.length > 8192) {
      throw new UnauthorizedException('Bearer user access token is required');
    }
    if (dto.purpose !== WEBHOOK_PAYLOAD_PURPOSE) {
      throw new ForbiddenException('Reauthentication purpose is not allowed');
    }

    try {
      const result = await this.database.transaction(async (manager) => {
        const token = await manager.findOne(OAuthTokenEntity, {
          where: {
            tokenHash: createHash('sha256').update(bearer).digest('hex'),
            revokedAt: IsNull(),
            expiresAt: MoreThan(new Date()),
          },
        });
        if (!token?.userId || !token.sessionId) {
          throw new UnauthorizedException(
            'Active user access token is required',
          );
        }
        const client = await manager.findOne(OAuthClientEntity, {
          where: { clientId: token.clientId, status: OAuthClientStatus.Active },
        });
        const session = await manager.findOne(SessionEntity, {
          where: {
            id: token.sessionId,
            userId: token.userId,
            isActive: true,
            revokedAt: IsNull(),
            expiresAt: MoreThan(new Date()),
          },
        });
        if (!client || !session) {
          throw new UnauthorizedException(
            'Active user access token is required',
          );
        }
        const scopes = token.scope.split(/\s+/);
        if (!scopes.includes('openid') || !scopes.includes('billing.access')) {
          throw new ForbiddenException('Billing user access is required');
        }

        // The database lock and persisted outcomes share the limit across processes and clients.
        const locks = await manager.query<Array<{ acquired: boolean }>>(
          `SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired`,
          [`identity:reauthentication:${token.userId}`],
        );
        if (!locks[0]?.acquired) {
          throw new HttpException(
            'Reauthentication already in progress',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        const counts = await manager.query<Array<{ attempts: string }>>(
          `SELECT count(*) AS attempts FROM identity_events
            WHERE user_id=$1 AND type IN ($2,$3)
              AND payload->>'operation'='reauthentication'
              AND created_at > clock_timestamp() - interval '15 minutes'`,
          [
            token.userId,
            IdentityEventType.LoginSucceeded,
            IdentityEventType.LoginFailed,
          ],
        );
        if (Number(counts[0]?.attempts ?? ATTEMPT_LIMIT) >= ATTEMPT_LIMIT) {
          throw new HttpException(
            'Too many reauthentication attempts; try again later',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        const user = await manager.findOne(UserEntity, {
          where: { id: token.userId },
          select: { id: true, status: true, passwordHash: true },
          lock: { mode: 'pessimistic_read' },
        });
        if (!user || user.status !== UserStatus.Active) {
          throw new UnauthorizedException(
            'Active user access token is required',
          );
        }
        const verified = Boolean(
          user.passwordHash &&
          (await argon2.verify(user.passwordHash, dto.password)),
        );
        await manager.save(
          IdentityEventEntity,
          manager.create(IdentityEventEntity, {
            type: verified
              ? IdentityEventType.LoginSucceeded
              : IdentityEventType.LoginFailed,
            userId: user.id,
            payload: {
              operation: 'reauthentication',
              purpose: WEBHOOK_PAYLOAD_PURPOSE,
              clientId: token.clientId,
              sessionId: token.sessionId,
            },
          }),
        );
        return { verified, subject: user.id, purpose: WEBHOOK_PAYLOAD_PURPOSE };
      });
      // Throw after commit so failed checks still count toward the persisted limit.
      if (!result.verified)
        throw new ForbiddenException('Password verification failed');
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Reauthentication is temporarily unavailable',
      );
    }
  }
}
