import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';
import { OrganizationEntity } from './entities/organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
  ) {}

  create(tenantId: string, dto: CreateOrganizationDto) {
    return this.organizationsRepository.save(
      this.organizationsRepository.create({
        ...dto,
        tenantId,
        slug: dto.slug.toLowerCase(),
      }),
    );
  }

  findAll(tenantId: string) {
    return this.organizationsRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string) {
    const organization = await this.organizationsRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async update(id: string, tenantId: string, dto: UpdateOrganizationDto) {
    const organization = await this.findOne(id, tenantId);
    Object.assign(organization, {
      ...dto,
      slug: dto.slug?.toLowerCase() ?? organization.slug,
    });
    return this.organizationsRepository.save(organization);
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.organizationsRepository.softDelete(id);
  }
}
