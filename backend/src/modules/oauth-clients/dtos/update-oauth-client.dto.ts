import { PartialType } from '@nestjs/mapped-types';
import { CreateOAuthClientDto } from './create-oauth-client.dto';

export class UpdateOAuthClientDto extends PartialType(CreateOAuthClientDto) {}
