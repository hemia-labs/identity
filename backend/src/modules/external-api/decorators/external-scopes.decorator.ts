import { SetMetadata } from '@nestjs/common';

export const EXTERNAL_SCOPES_KEY = 'external_scopes';

export const ExternalScopes = (...scopes: string[]) =>
  SetMetadata(EXTERNAL_SCOPES_KEY, scopes);
