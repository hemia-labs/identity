import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SaveOAuthScopeDto } from './oauth-scope.dto';
export type OAuthScope = SaveOAuthScopeDto & { id: string };
@Injectable()
export class OAuthScopesService {
  constructor(private readonly db: DataSource) {}
  list(): Promise<OAuthScope[]> {
    return this.db.query(
      'SELECT id,code,audience,name,description,resource,enabled FROM oauth_scopes ORDER BY audience,name,code',
    );
  }
  async save(dto: SaveOAuthScopeDto, id?: string): Promise<OAuthScope> {
    if (!dto.name.trim())
      throw new BadRequestException('Escribe el nombre del permiso.');
    let resource: string | null = null;
    if (dto.resource) {
      let url: URL;
      try {
        url = new URL(dto.resource);
      } catch {
        throw new BadRequestException('URL de API inválida.');
      }
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new BadRequestException(
          'La URL debe usar HTTP o HTTPS, sin credenciales, parámetros ni fragmentos.',
        );
      resource = url.origin + url.pathname.replace(/\/$/, '');
    }
    try {
      if (id) {
        const [old]: OAuthScope[] = await this.db.query(
          'SELECT * FROM oauth_scopes WHERE id=$1',
          [id],
        );
        if (!old) throw new NotFoundException('Permiso no encontrado.');
        if (old.code !== dto.code || old.audience !== dto.audience)
          throw new ConflictException(
            'El código y la audiencia de un permiso registrado son fijos.',
          );
      }
      const [saved]: OAuthScope[] = await this.db.query(
        id
          ? 'UPDATE oauth_scopes SET name=$3,description=$4,resource=$5,enabled=$6,updated_at=now() WHERE id=$7 AND code=$1 AND audience=$2 RETURNING id,code,audience,name,description,resource,enabled'
          : 'INSERT INTO oauth_scopes(code,audience,name,description,resource,enabled) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,code,audience,name,description,resource,enabled',
        [
          dto.code,
          dto.audience,
          dto.name.trim(),
          dto.description.trim(),
          resource,
          dto.enabled,
          ...(id ? [id] : []),
        ],
      );
      if (!saved) throw new NotFoundException('Permiso no encontrado.');
      return saved;
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505')
        throw new ConflictException(
          'Este permiso ya está registrado para esa audiencia.',
        );
      throw cause;
    }
  }
}
