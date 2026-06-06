import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSsoClientDto } from './dtos/create-sso-client.dto';
import { UpdateSsoClientDto } from './dtos/update-sso-client.dto';
import { SsoClientEntity, SsoClientStatus } from './entities/sso-client.entity';

@Injectable()
export class SsoClientsService {
  constructor(
    @InjectRepository(SsoClientEntity)
    private readonly ssoClientsRepository: Repository<SsoClientEntity>,
  ) {}

  create(dto: CreateSsoClientDto) {
    return this.ssoClientsRepository.save(
      this.ssoClientsRepository.create({
        ...dto,
        clientId: dto.clientId.toLowerCase(),
        allowedOrigins: dto.allowedOrigins ?? [],
        status: dto.status ?? SsoClientStatus.Active,
      }),
    );
  }

  findAll() {
    return this.ssoClientsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const client = await this.ssoClientsRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('SSO client not found');
    }
    return client;
  }

  async findActiveByClientId(clientId: string) {
    const client = await this.ssoClientsRepository.findOne({
      where: { clientId: clientId.toLowerCase() },
    });

    if (!client || client.status !== SsoClientStatus.Active) {
      throw new UnauthorizedException('SSO client is not active');
    }

    return client;
  }

  async update(id: string, dto: UpdateSsoClientDto) {
    const client = await this.findOne(id);
    Object.assign(client, {
      ...dto,
      clientId: dto.clientId?.toLowerCase() ?? client.clientId,
      allowedOrigins: dto.allowedOrigins ?? client.allowedOrigins,
    });
    return this.ssoClientsRepository.save(client);
  }

  async remove(id: string) {
    const client = await this.findOne(id);
    client.status = SsoClientStatus.Deleted;
    await this.ssoClientsRepository.save(client);
    await this.ssoClientsRepository.softDelete(id);
  }
}
