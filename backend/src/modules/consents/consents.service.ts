import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  OAuthClientEntity,
  OAuthClientStatus,
} from '../oauth/entities/oauth-client.entity';
import { OAuthConsentEntity } from './entities/oauth-consent.entity';

@Injectable()
export class ConsentsService {
  constructor(
    @InjectRepository(OAuthConsentEntity)
    private readonly consentsRepository: Repository<OAuthConsentEntity>,
    @InjectRepository(OAuthClientEntity)
    private readonly clientsRepository: Repository<OAuthClientEntity>,
  ) {}

  async hasConsent(userId: string, clientId: string, scopes: string[]) {
    const consent = await this.consentsRepository.findOne({
      where: { userId, clientId, revokedAt: IsNull() },
    });

    if (!consent) {
      return false;
    }

    return scopes.every((scope) => consent.scopes.includes(scope));
  }

  async getOAuthRequest(userId: string, returnTo: string) {
    const request = await this.parseOAuthReturnTo(returnTo);
    const approved = await this.hasConsent(
      userId,
      request.client.clientId,
      request.scopes,
    );

    return {
      clientId: request.client.clientId,
      clientName: request.client.clientId,
      redirectUri: request.redirectUri,
      scopes: request.scopes.map((scope) => ({
        key: scope,
        label: this.humanizeScope(scope),
        description: `Permite acceso a ${this.humanizeScope(scope).toLowerCase()}.`,
      })),
      state: request.state,
      returnTo,
      approved,
    };
  }

  async approveOAuthConsent(userId: string, returnTo: string) {
    const request = await this.parseOAuthReturnTo(returnTo);
    await this.grantConsent(userId, request.client.clientId, request.scopes);

    return {
      approved: true,
      authorizeUrl: returnTo,
    };
  }

  async grantConsent(userId: string, clientId: string, scopes: string[]) {
    const consent = await this.consentsRepository.findOne({
      where: { userId, clientId, revokedAt: IsNull() },
    });

    if (consent) {
      consent.scopes = Array.from(new Set([...consent.scopes, ...scopes]));
      consent.grantedAt = new Date();
      return this.consentsRepository.save(consent);
    }

    return this.consentsRepository.save(
      this.consentsRepository.create({
        userId,
        clientId,
        scopes,
      }),
    );
  }

  private async parseOAuthReturnTo(returnTo: string) {
    const parsed = new URL(returnTo, 'http://hemia-id.local');

    if (parsed.pathname !== '/oauth/authorize') {
      throw new BadRequestException('returnTo must point to /oauth/authorize');
    }

    const clientId = parsed.searchParams.get('client_id');
    const redirectUri = parsed.searchParams.get('redirect_uri');
    const scope = parsed.searchParams.get('scope');

    if (!clientId || !redirectUri || !scope) {
      throw new BadRequestException(
        'client_id, redirect_uri and scope are required',
      );
    }

    const client = await this.clientsRepository.findOne({
      where: { clientId, status: OAuthClientStatus.Active },
    });

    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException('redirect_uri is not allowed');
    }

    const scopes = scope.split(' ').filter(Boolean);
    const unknownScope = scopes.find(
      (requestedScope) => !client.scopes.includes(requestedScope),
    );

    if (unknownScope) {
      throw new BadRequestException(`scope is not allowed: ${unknownScope}`);
    }

    return {
      client,
      redirectUri,
      scopes,
      state: parsed.searchParams.get('state'),
    };
  }

  private humanizeScope(scope: string) {
    return scope
      .split(/[:._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
