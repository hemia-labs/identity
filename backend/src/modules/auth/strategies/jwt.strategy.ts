import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../constants/auth.constants';
import { SessionsService } from '../../sessions/sessions.service';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/entities/user.entity';

type JwtPayload = {
  sub: string;
  email: string;
  username?: string | null;
  sessionId: string;
  tenantId?: string | null;
  organizationId?: string | null;
  teamId?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          (request.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    const [session, user] = await Promise.all([
      this.sessionsService.findActive(payload.sessionId),
      this.usersService.findOne(payload.sub),
    ]);

    if (!session || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      sessionId: payload.sessionId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      teamId: session.teamId,
    };
  }
}
