import { PartialType } from '@nestjs/mapped-types';
import { CreateSsoClientDto } from './create-sso-client.dto';

export class UpdateSsoClientDto extends PartialType(CreateSsoClientDto) {}
