import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTenantDto } from './dtos/create-tenant.dto';
import { UpdateTenantDto } from './dtos/update-tenant.dto';
import { TenantEntity, TenantStatus } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantsRepository: Repository<TenantEntity>,
  ) {}

  create(dto: CreateTenantDto) {
    return this.tenantsRepository.save(
      this.tenantsRepository.create({
        ...dto,
        slug: dto.slug.toLowerCase(),
        status: dto.status ?? TenantStatus.Trial,
      }),
    );
  }

  findAll() {
    return this.tenantsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const tenant = await this.tenantsRepository.findOne({ where: { id } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.findOne(id);
    Object.assign(tenant, {
      ...dto,
      slug: dto.slug?.toLowerCase() ?? tenant.slug,
    });
    return this.tenantsRepository.save(tenant);
  }

  async updateStatus(id: string, status: TenantStatus) {
    const tenant = await this.findOne(id);
    tenant.status = status;
    return this.tenantsRepository.save(tenant);
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);
    tenant.status = TenantStatus.Deleted;
    await this.tenantsRepository.save(tenant);
    await this.tenantsRepository.softDelete(id);
  }
}
