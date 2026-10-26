import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SaveOAuthApiDto } from './oauth-api.dto';
export type OAuthApi = Omit<SaveOAuthApiDto, 'resource'> & {
  id: string;
  resource: string | null;
};
@Injectable()
export class OAuthApisService {
  constructor(private readonly db: DataSource) {}
  list(): Promise<OAuthApi[]> {
    return this.db.query(`SELECT a.id,a.name,a.audience,a.resource,a.enabled,
      COALESCE(array_agg(s.code ORDER BY s.code) FILTER (WHERE s.code IS NOT NULL),'{}') AS scopes
      FROM oauth_apis a LEFT JOIN oauth_api_scopes r ON r.api_id=a.id
      LEFT JOIN oauth_scopes s ON s.id=r.scope_id GROUP BY a.id ORDER BY a.name,a.audience`);
  }
  async save(dto: SaveOAuthApiDto, id?: string): Promise<OAuthApi> {
    let url: URL;
    try {
      url = new URL(dto.resource);
    } catch {
      throw new BadRequestException('URL de API inválida.');
    }
    if (
      !dto.name.trim() ||
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new BadRequestException(
        'Escribe un nombre y una URL HTTP o HTTPS sin credenciales, parámetros ni fragmentos.',
      );
    const resource = url.origin + url.pathname.replace(/\/$/, '');
    try {
      return await this.db.transaction(async (manager) => {
        if (id) {
          const [old]: OAuthApi[] = await manager.query(
            'SELECT * FROM oauth_apis WHERE id=$1 FOR UPDATE',
            [id],
          );
          if (!old) throw new NotFoundException('API no encontrada.');
          if (
            old.audience !== dto.audience ||
            (old.resource && old.resource !== resource)
          )
            throw new ConflictException(
              'La audiencia y la URL de una API registrada son fijas.',
            );
        }
        const scopes: {
          id: string;
          code: string;
          enabled: boolean;
          assigned: boolean;
        }[] = await manager.query(
          `SELECT s.id,s.code,s.enabled,EXISTS(SELECT 1 FROM oauth_api_scopes r WHERE r.scope_id=s.id AND r.api_id=$2) AS assigned
             FROM oauth_scopes s WHERE s.code=ANY($1::text[]) AND s.kind='api' FOR SHARE`,
          [dto.scopes, id ?? null],
        );
        if (
          scopes.length !== dto.scopes.length ||
          scopes.some((s) => !s.enabled && !s.assigned)
        )
          throw new BadRequestException(
            'Selecciona scopes de API habilitados en el catálogo.',
          );
        const [api]: OAuthApi[] = await manager.query(
          id
            ? 'UPDATE oauth_apis SET name=$2,resource=$3,enabled=$4,updated_at=now() WHERE audience=$1 AND id=$5 RETURNING *'
            : 'INSERT INTO oauth_apis(audience,name,resource,enabled) VALUES($1,$2,$3,$4) RETURNING *',
          [
            dto.audience,
            dto.name.trim(),
            resource,
            dto.enabled,
            ...(id ? [id] : []),
          ],
        );
        await manager.query('DELETE FROM oauth_api_scopes WHERE api_id=$1', [
          api.id,
        ]);
        await manager.query(
          'INSERT INTO oauth_api_scopes(api_id,scope_id) SELECT $1,unnest($2::uuid[])',
          [api.id, scopes.map((s) => s.id)],
        );
        return { ...api, scopes: dto.scopes };
      });
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505')
        throw new ConflictException(
          'La audiencia o la URL ya están registradas.',
        );
      throw cause;
    }
  }
}
