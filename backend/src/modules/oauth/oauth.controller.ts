import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../common/types/authenticated-request.type';
import { OAuthAuthorizeQueryDto } from './dtos/oauth-authorize-query.dto';
import { OAuthIntrospectDto } from './dtos/oauth-introspect.dto';
import { OAuthRevokeDto } from './dtos/oauth-revoke.dto';
import { OAuthTokenDto } from './dtos/oauth-token.dto';
import { OAuthService } from './oauth.service';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OAuthService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('authorize')
  async authorize(
    @Query() query: OAuthAuthorizeQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const user = (request as AuthenticatedRequest).user;
    if (!user) {
      const frontendUrl = this.configService.get<string>(
        'app.frontendUrl',
        'http://localhost:5173',
      );
      return response.redirect(
        `${frontendUrl}/login?returnTo=${encodeURIComponent(request.originalUrl)}`,
      );
    }

    const redirectUrl = await this.oauthService.authorize(query, user);
    return response.redirect(redirectUrl);
  }

  @Post('token')
  token(@Body() dto: OAuthTokenDto) {
    return this.oauthService.token(dto);
  }

  @Post('revoke')
  revoke(@Body() dto: OAuthRevokeDto) {
    return this.oauthService.revoke(dto);
  }

  @Post('introspect')
  introspect(@Body() dto: OAuthIntrospectDto) {
    return this.oauthService.introspect(dto);
  }
}
