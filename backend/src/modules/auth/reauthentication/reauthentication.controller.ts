import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ReauthenticateDto } from './reauthenticate.dto';
import { ReauthenticationService } from './reauthentication.service';

@Controller('auth')
export class ReauthenticationController {
  constructor(private readonly service: ReauthenticationService) {}

  @Post('reauthenticate')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  reauthenticate(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: ReauthenticateDto,
  ) {
    return this.service.reauthenticate(authorization, dto);
  }
}
