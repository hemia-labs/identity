import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SaveOAuthScopeDto } from './oauth-scope.dto';
export type OAuthScope = SaveOAuthScopeDto & {
  id: string;
  kind: 'protocol' | 'api';
};
@Injectable()
export class OAuthScopesService {
  constructor(private readonly db: DataSource) {}
  list(): Promise<OAuthScope[]> {
    return this.db.query(
      'SELECT id,code,name,description,enabled,kind FROM oauth_scopes ORDER BY name,code',
    );
  }
  async save(dto: SaveOAuthScopeDto, id?: string): Promise<OAuthScope> {
    if (!dto.name.trim())
      throw new BadRequestException('Escribe el nombre del permiso.');
    try {
      if (id) {
        const [old]: OAuthScope[] = await this.db.query(
          'SELECT * FROM oauth_scopes WHERE id=$1',
          [id],
        );
        if (!old) throw new NotFoundException('Permiso no encontrado.');
        if (old.code !== dto.code)
          throw new ConflictException(
            'El código de un permiso registrado es fijo.',
          );
      }
      const [saved]: OAuthScope[] = await this.db.query(
        id
          ? 'UPDATE oauth_scopes SET name=$2,description=$3,enabled=$4,updated_at=now() WHERE code=$1 AND id=$5 RETURNING id,code,name,description,enabled,kind'
          : "INSERT INTO oauth_scopes(code,name,description,enabled,kind) VALUES($1,$2,$3,$4,'api') RETURNING id,code,name,description,enabled,kind",
        [
          dto.code,
          dto.name.trim(),
          dto.description.trim(),
          dto.enabled,
          ...(id ? [id] : []),
        ],
      );
      if (!saved) throw new NotFoundException('Permiso no encontrado.');
      return saved;
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505')
        throw new ConflictException('Este código de scope ya está registrado.');
      throw cause;
    }
  }
}
