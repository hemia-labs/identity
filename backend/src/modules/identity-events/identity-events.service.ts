import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IdentityEventEntity,
  IdentityEventType,
} from './entities/identity-event.entity';

type EmitIdentityEventInput = {
  type: IdentityEventType;
  userId?: string | null;
  payload: Record<string, unknown>;
};

@Injectable()
export class IdentityEventsService {
  constructor(
    @InjectRepository(IdentityEventEntity)
    private readonly eventsRepository: Repository<IdentityEventEntity>,
  ) {}

  emit(input: EmitIdentityEventInput) {
    return this.eventsRepository.save(this.eventsRepository.create(input));
  }

  findRecent(options: {
    type?: IdentityEventType;
    after?: Date;
    limit?: number;
  }) {
    const query = this.eventsRepository
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC')
      .limit(Math.min(options.limit ?? 100, 500));

    if (options.type) {
      query.andWhere('event.type = :type', { type: options.type });
    }

    if (options.after) {
      query.andWhere('event.created_at > :after', { after: options.after });
    }

    return query.getMany();
  }
}
