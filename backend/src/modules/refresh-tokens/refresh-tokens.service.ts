import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

type CreateRefreshTokenInput = {
  sessionId: string;
  familyId: string;
  tokenHash: string;
  previousTokenHash?: string | null;
  expiresAt: Date;
};

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokensRepository: Repository<RefreshTokenEntity>,
  ) {}

  create(input: CreateRefreshTokenInput) {
    return this.refreshTokensRepository.save(
      this.refreshTokensRepository.create(input),
    );
  }

  findByHash(tokenHash: string) {
    return this.refreshTokensRepository.findOne({
      where: { tokenHash },
      relations: { session: true },
    });
  }

  async markUsed(id: string) {
    await this.refreshTokensRepository.update(id, {
      isUsed: true,
      usedAt: new Date(),
    });
  }

  async revokeFamily(familyId: string) {
    await this.refreshTokensRepository.update(
      { familyId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );
  }
}
