import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTeamDto } from './dtos/create-team.dto';
import { UpdateTeamDto } from './dtos/update-team.dto';
import { TeamEntity } from './entities/team.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamsRepository: Repository<TeamEntity>,
  ) {}

  create(tenantId: string, dto: CreateTeamDto) {
    return this.teamsRepository.save(
      this.teamsRepository.create({
        ...dto,
        tenantId,
        slug: dto.slug.toLowerCase(),
      }),
    );
  }

  findAll(tenantId: string) {
    return this.teamsRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string) {
    const team = await this.teamsRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  async update(id: string, tenantId: string, dto: UpdateTeamDto) {
    const team = await this.findOne(id, tenantId);
    Object.assign(team, { ...dto, slug: dto.slug?.toLowerCase() ?? team.slug });
    return this.teamsRepository.save(team);
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.teamsRepository.softDelete(id);
  }
}
