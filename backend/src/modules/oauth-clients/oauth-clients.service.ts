import { assertClientCatalog } from '../oauth-scopes/oauth-catalog-policy';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { IsNull, Repository } from 'typeorm';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from '../oauth/entities/oauth-client.entity';
import {
  CreateOAuthClientDto,
  OAuthClientDestinationDto,
} from './dtos/create-oauth-client.dto';
import { UpdateOAuthClientDto } from './dtos/update-oauth-client.dto';

// View = client sin el hash del secret (nunca se expone).
type OAuthClientView = Omit<OAuthClientEntity, 'clientSecretHash'>;
type OAuthClientArrayKey =
  'redirectUris' | 'scopes' | 'grantTypes' | 'responseTypes';

@Injectable()
export class OAuthClientsService {
  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly clientsRepository: Repository<OAuthClientEntity>,
  ) {}

  async create(dto: CreateOAuthClientDto) {
    await assertClientCatalog(this.clientsRepository.manager, {
      audience: dto.audience,
      scopes: dto.scopes ?? [],
      serviceDestinations: dto.serviceDestinations,
    });
    const confidential = dto.type === OAuthClientType.Confidential;
    const secret = confidential ? this.generateSecret() : null;

    const saved = await this.clientsRepository
      .save(
        this.clientsRepository.create({
          clientId: dto.clientId.toLowerCase(),
          audience: dto.audience,
          serviceDestinations: dto.serviceDestinations ?? null,
          type: dto.type,
          clientSecretHash: secret ? await argon2.hash(secret) : null,
          redirectUris: dto.redirectUris ?? [],
          grantTypes: dto.grantTypes ?? [],
          responseTypes: dto.responseTypes ?? [],
          scopes: dto.scopes ?? [],
          requiresConsent: dto.requiresConsent ?? true,
          status: dto.status ?? OAuthClientStatus.Active,
        }),
      )
      .catch((cause: unknown) => {
        if ((cause as { code?: string }).code === '23505')
          throw new ConflictException(
            'El identificador del cliente ya está registrado.',
          );
        throw cause;
      });

    // El secret en claro solo se devuelve aquí, una vez.
    return { ...this.toView(saved), clientSecret: secret };
  }

  async findAll(): Promise<OAuthClientView[]> {
    const clients = await this.clientsRepository.find({
      order: { createdAt: 'DESC' },
    });
    return clients.map((client) => this.toView(client));
  }

  async findOne(id: string): Promise<OAuthClientView> {
    return this.toView(await this.findEntity(id));
  }

  async update(id: string, dto: UpdateOAuthClientDto) {
    const client = await this.findEntity(id);
    await assertClientCatalog(
      this.clientsRepository.manager,
      { ...client, ...dto },
      client,
    );
    Object.assign(client, {
      ...dto,
      clientId: dto.clientId?.toLowerCase() ?? client.clientId,
    });
    return this.toView(await this.clientsRepository.save(client));
  }

  async rotateSecret(id: string) {
    const client = await this.findEntity(id);
    const secret = this.generateSecret();
    client.clientSecretHash = await argon2.hash(secret);
    await this.clientsRepository.save(client);
    return { ...this.toView(client), clientSecret: secret };
  }

  async ensureServiceDestination(id: string, dto: OAuthClientDestinationDto) {
    return this.clientsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(OAuthClientEntity);
      const client = await repository.findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!client) throw new NotFoundException('OAuth client not found');
      if (
        client.status !== OAuthClientStatus.Active ||
        client.type !== OAuthClientType.Confidential ||
        !client.grantTypes.includes('client_credentials')
      )
        throw new BadRequestException(
          'An active confidential service client is required',
        );
      if (!client.serviceDestinations)
        throw new ConflictException(
          'Configure explicit destinations before adding a destination; existing service permissions must be preserved',
        );
      await assertClientCatalog(
        manager,
        { ...client, serviceDestinations: [dto] },
        client,
      );
      const destinations = client.serviceDestinations.map((destination) => ({
        ...destination,
        scopes: [...destination.scopes],
      }));
      const existing = destinations.find(
        (destination) => destination.resource === dto.resource,
      );
      if (
        (existing && existing.audience !== dto.audience) ||
        destinations.some(
          (destination) =>
            destination.audience === dto.audience &&
            destination.resource !== dto.resource,
        )
      )
        throw new ConflictException(
          'El destino o la audiencia ya están asociados a otra configuración OAuth.',
        );
      if (
        existing &&
        dto.scopes.every((scope) => existing.scopes.includes(scope))
      )
        return this.toView(client);
      if (existing) {
        existing.scopes = [...new Set([...existing.scopes, ...dto.scopes])];
        if (existing.scopes.length > 100)
          throw new BadRequestException('Too many destination scopes');
      } else {
        if (destinations.length >= 32)
          throw new BadRequestException('Too many service destinations');
        destinations.push({
          resource: dto.resource,
          audience: dto.audience,
          scopes: [...new Set(dto.scopes)],
        });
      }
      // Update only this policy under the row lock; keep credentials and other flows intact.
      await repository.update(id, { serviceDestinations: destinations });
      return this.toView(await repository.findOneByOrFail({ id }));
    });
  }

  async removeServiceDestinationScopes(
    id: string,
    dto: OAuthClientDestinationDto,
  ) {
    return this.clientsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(OAuthClientEntity);
      const client = await repository.findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!client) throw new NotFoundException('OAuth client not found');
      if (!client.serviceDestinations)
        throw new ConflictException(
          'Explicit service destinations are required',
        );
      const existing = client.serviceDestinations.find(
        (destination) =>
          destination.resource === dto.resource &&
          destination.audience === dto.audience,
      );
      if (
        !existing ||
        !dto.scopes.some((scope) => existing.scopes.includes(scope))
      )
        return this.toView(client);
      const scopes = existing.scopes.filter(
        (scope) => !dto.scopes.includes(scope),
      );
      const destinations = client.serviceDestinations.flatMap((destination) =>
        destination === existing
          ? scopes.length
            ? [{ ...destination, scopes }]
            : []
          : [destination],
      );
      // Keep [] explicit: null would restore the client's top-level scope policy.
      await repository.update(id, { serviceDestinations: destinations });
      return this.toView(await repository.findOneByOrFail({ id }));
    });
  }

  addRedirectUri(id: string, value: string) {
    this.assertUrlWithProtocol(value);
    return this.addValue(id, 'redirectUris', value);
  }

  removeRedirectUri(id: string, value: string) {
    this.assertUrlWithProtocol(value);
    return this.removeValue(id, 'redirectUris', value);
  }

  addScope(id: string, value: string) {
    return this.addValue(id, 'scopes', value);
  }

  removeScope(id: string, value: string) {
    return this.removeValue(id, 'scopes', value);
  }

  addGrantType(id: string, value: string) {
    return this.addValue(id, 'grantTypes', value);
  }

  removeGrantType(id: string, value: string) {
    return this.removeValue(id, 'grantTypes', value);
  }

  addResponseType(id: string, value: string) {
    return this.addValue(id, 'responseTypes', value);
  }

  removeResponseType(id: string, value: string) {
    return this.removeValue(id, 'responseTypes', value);
  }

  async remove(id: string) {
    const result = await this.clientsRepository.update(
      { id, deletedAt: IsNull() },
      { status: OAuthClientStatus.Deleted, deletedAt: new Date() },
    );
    if (!result.affected) throw new NotFoundException('OAuth client not found');
  }

  private async findEntity(id: string) {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }
    return client;
  }

  private generateSecret() {
    return randomBytes(32).toString('base64url');
  }

  private async addValue(
    id: string,
    key: OAuthClientArrayKey,
    value: string,
  ): Promise<OAuthClientView> {
    const client = await this.findEntity(id);
    const previous = { ...client };
    client[key] = [...new Set([...(client[key] ?? []), value])];
    if (key === 'scopes')
      await assertClientCatalog(
        this.clientsRepository.manager,
        client,
        previous,
      );
    return this.toView(await this.clientsRepository.save(client));
  }

  private async removeValue(
    id: string,
    key: OAuthClientArrayKey,
    value: string,
  ): Promise<OAuthClientView> {
    const client = await this.findEntity(id);
    client[key] = (client[key] ?? []).filter((item) => item !== value);
    return this.toView(await this.clientsRepository.save(client));
  }

  private assertUrlWithProtocol(value: string) {
    try {
      const url = new URL(value);
      if (!url.protocol) {
        throw new Error();
      }
    } catch {
      throw new BadRequestException('redirect uri must be an absolute URL');
    }
  }

  private toView(client: OAuthClientEntity): OAuthClientView {
    const { clientSecretHash: _omit, ...view } = client;
    void _omit;
    return view;
  }
}
