import { generateKeyPairSync, createPublicKey } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { JwksKeyEntity, JwksKeyStatus } from './entities/jwks-key.entity';

type ActiveKey = {
  kid: string;
  alg: string;
  publicKey: string;
  privateKey: string;
};

@Injectable()
export class JwksService {
  private fallbackKey?: ActiveKey;

  constructor(
    @InjectRepository(JwksKeyEntity)
    private readonly jwksRepository: Repository<JwksKeyEntity>,
    private readonly configService: ConfigService,
  ) {}

  async getActiveKey(): Promise<ActiveKey> {
    const storedKey = await this.jwksRepository.findOne({
      where: { status: JwksKeyStatus.Active },
      order: { createdAt: 'DESC' },
    });

    if (storedKey) {
      const publicKey = createPublicKey(storedKey.privateKeyEncrypted)
        .export({ type: 'spki', format: 'pem' })
        .toString();

      return {
        kid: storedKey.kid,
        alg: storedKey.alg,
        publicKey,
        privateKey: storedKey.privateKeyEncrypted,
      };
    }

    if (this.configService.get<string>('app.env') === 'production') {
      throw new ServiceUnavailableException(
        'Active JWKS key is required in production',
      );
    }

    this.fallbackKey ??= this.generateFallbackKey();
    return this.fallbackKey;
  }

  async getPublicJwks() {
    const key = await this.getActiveKey();
    const jwk = createPublicKey(key.publicKey).export({ format: 'jwk' });

    const retired =
      key.kid === 'dev-fallback-rs256'
        ? []
        : await this.jwksRepository.find({
            where: {
              status: JwksKeyStatus.Rotated,
              rotatedAt: MoreThan(new Date(Date.now() - 900000)),
            },
            order: { createdAt: 'DESC' },
          });
    return {
      keys: [
        { ...jwk, kid: key.kid, alg: key.alg, use: 'sig' },
        ...retired.map((k) => ({
          ...createPublicKey(k.privateKeyEncrypted).export({ format: 'jwk' }),
          kid: k.kid,
          alg: k.alg,
          use: 'sig',
        })),
      ],
    };
  }

  private generateFallbackKey(): ActiveKey {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      kid: 'dev-fallback-rs256',
      alg: 'RS256',
      publicKey,
      privateKey,
    };
  }
}
