import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Repository } from 'typeorm';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from '../oauth/entities/oauth-client.entity';
import { CreateOAuthClientDto } from './dtos/create-oauth-client.dto';
import { UpdateOAuthClientDto } from './dtos/update-oauth-client.dto';

// View = client sin el hash del secret (nunca se expone).
type OAuthClientView = Omit<OAuthClientEntity, 'clientSecretHash'>;

@Injectable()
export class OAuthClientsService {
  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly clientsRepository: Repository<OAuthClientEntity>,
  ) {}

  async create(dto: CreateOAuthClientDto) {
    const confidential = dto.type === OAuthClientType.Confidential;
    const secret = confidential ? this.generateSecret() : null;

    const saved = await this.clientsRepository.save(
      this.clientsRepository.create({
        clientId: dto.clientId.toLowerCase(),
        audience: dto.audience,
        type: dto.type,
        clientSecretHash: secret ? await argon2.hash(secret) : null,
        redirectUris: dto.redirectUris ?? [],
        grantTypes: dto.grantTypes ?? [],
        responseTypes: dto.responseTypes ?? [],
        scopes: dto.scopes ?? [],
        requiresConsent: dto.requiresConsent ?? true,
        status: dto.status ?? OAuthClientStatus.Active,
      }),
    );

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

  async remove(id: string) {
    const client = await this.findEntity(id);
    client.status = OAuthClientStatus.Deleted;
    await this.clientsRepository.save(client);
    await this.clientsRepository.softDelete(id);
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

  private toView(client: OAuthClientEntity): OAuthClientView {
    const { clientSecretHash: _omit, ...view } = client;
    void _omit;
    return view;
  }
}
