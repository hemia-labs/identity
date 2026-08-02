import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { SessionEntity } from './entities/session.entity';

type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionsRepository: Repository<SessionEntity>,
  ) {}

  create(input: CreateSessionInput) {
    return this.sessionsRepository.save(
      this.sessionsRepository.create({
        ...input,
        sessionFamilyId: randomUUID(),
        isActive: true,
      }),
    );
  }

  findActive(id: string) {
    return this.sessionsRepository.findOne({
      where: {
        id,
        isActive: true,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  findActiveByUser(userId: string) {
    return this.sessionsRepository.find({
      where: { userId, isActive: true, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async updateRefreshHash(id: string, refreshTokenHash: string) {
    await this.sessionsRepository.update(id, { refreshTokenHash });
  }

  async revoke(id: string) {
    await this.sessionsRepository.update(id, {
      isActive: false,
      revokedAt: new Date(),
    });
  }

  async revokeAllForUser(userId: string) {
    await this.sessionsRepository.update(
      { userId, isActive: true },
      { isActive: false, revokedAt: new Date() },
    );
  }

  async revokeFamily(sessionFamilyId: string) {
    await this.sessionsRepository.update(
      { sessionFamilyId, isActive: true },
      { isActive: false, revokedAt: new Date() },
    );
  }
}
