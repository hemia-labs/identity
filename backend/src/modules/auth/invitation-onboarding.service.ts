import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createPublicKey } from 'crypto';
import type { JsonWebKey } from 'crypto';
import { JwksService } from '../jwks/jwks.service';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';
import { RegisterInvitationDto } from './dtos/invitation.dto';

@Injectable()
export class InvitationOnboardingService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly jwks: JwksService,
    private readonly users: UsersService,
  ) {}

  private async access(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(
        `${this.config.getOrThrow<string>('ACCESS_API_URL').replace(/\/$/, '')}/v1/public/invitations/${path}`,
        {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new ServiceUnavailableException('Invitation service unavailable');
    }
    if (!response.ok) {
      if (response.status >= 500)
        throw new ServiceUnavailableException('Invitation service unavailable');
      throw new BadRequestException(
        'Invitation is invalid, expired, already accepted or does not match your account',
      );
    }
    try {
      const data: unknown = await response.json();
      return data;
    } catch {
      throw new ServiceUnavailableException(
        'Invitation service returned an invalid response',
      );
    }
  }

  async preview(token: string) {
    const data = (await this.access('preview', { token })) as {
      email: string;
      organization: string;
      expiresAt: string;
      proof: string;
    };
    try {
      const decoded = this.jwt.decode<{ header: { kid: string; typ: string } }>(
        data.proof,
        { complete: true },
      );
      if (decoded?.header.typ !== 'invitation-registration+jwt')
        throw new Error('Invalid proof');
      const response = await fetch(
        this.config.getOrThrow<string>('ACCESS_JWKS_URI'),
        { redirect: 'error', signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) throw new Error('Invalid key response');
      const keys = (await response.json()) as {
        keys: (JsonWebKey & { kid: string })[];
      };
      const key = keys.keys.find(
        (key) => key.kid === decoded.header.kid && key.kty === 'RSA',
      );
      if (!key) throw new Error('Unknown key');
      const proof = await this.jwt.verifyAsync<{
        email: string;
        token_hash: string;
        invitation_issued_at?: string;
      }>(data.proof, {
        publicKey: createPublicKey({ key, format: 'jwk' })
          .export({ type: 'spki', format: 'pem' })
          .toString(),
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow<string>('ACCESS_ISSUER'),
        audience: 'hemia-id-invitation',
        maxAge: '5m',
      });
      if (
        proof.token_hash !== createHash('sha256').update(token).digest('hex') ||
        proof.email !== data.email
      )
        throw new Error('Invalid proof binding');
      return {
        email: proof.email,
        organization: data.organization,
        expiresAt: data.expiresAt,
        issuedAt: proof.invitation_issued_at,
      };
    } catch {
      throw new BadRequestException('Invalid invitation proof');
    }
  }

  async register(dto: RegisterInvitationDto & { token: string }) {
    const invitation = await this.preview(dto.token);
    if (await this.users.findByEmail(invitation.email))
      throw new ConflictException(
        'This email already has an account. Sign in with your existing method.',
      );
    try {
      return await this.users.create(
        {
          email: invitation.email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          password: dto.password,
          status: UserStatus.Active,
        },
        undefined,
        true,
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException(
          'This email already has an account. Sign in with your existing method.',
        );
      throw error;
    }
  }

  async accept(token: string, userId: string) {
    const invitation = await this.preview(token);
    const user = await this.users.findOne(userId);
    if (
      user.status !== UserStatus.Active ||
      user.deletedAt ||
      user.email.trim().toLowerCase() !== invitation.email
    ) {
      throw new BadRequestException(
        'Sign in with the email that received this invitation',
      );
    }
    const key = await this.jwks.getActiveKey();
    const proof = await this.jwt.signAsync(
      {
        email: user.email,
        email_verified: true,
        token_hash: createHash('sha256').update(token).digest('hex'),
      },
      {
        algorithm: 'RS256',
        header: { alg: 'RS256', typ: 'invitation-accept+jwt', kid: key.kid },
        issuer: this.config.getOrThrow<string>('app.issuer'),
        audience: 'hemia-access-invitation-accept',
        subject: user.id,
        expiresIn: '60s',
        privateKey: key.privateKey,
      },
    );
    const result = (await this.access('accept', {
      token,
      identity_proof: proof,
    })) as {
      accepted?: unknown;
      membership_id?: unknown;
      redirect_url?: unknown;
    } | null;
    if (
      result?.accepted !== true ||
      typeof result.membership_id !== 'string' ||
      typeof result.redirect_url !== 'string'
    )
      throw new ServiceUnavailableException(
        'Invalid invitation acceptance response',
      );
    return {
      accepted: true,
      membership_id: result.membership_id,
      redirect_url: result.redirect_url,
    };
  }
}
