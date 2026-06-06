import { Controller, Get, Headers } from '@nestjs/common';
import { OidcService } from './oidc.service';

@Controller()
export class OidcController {
  constructor(private readonly oidcService: OidcService) {}

  @Get('.well-known/openid-configuration')
  getDiscovery() {
    return this.oidcService.getDiscovery();
  }

  @Get('oidc/userinfo')
  getUserInfo(@Headers('authorization') authorization?: string) {
    return this.oidcService.getUserInfo(authorization);
  }
}
