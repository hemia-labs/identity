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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../common/types/authenticated-request.type';
import { AuthorizeQueryDto } from './dtos/authorize-query.dto';
import { CheckSessionQueryDto } from './dtos/check-session-query.dto';
import { TokenExchangeDto } from './dtos/token-exchange.dto';
import { SsoService } from './sso.service';

@Controller('sso')
export class SsoController {
  constructor(
    private readonly configService: ConfigService,
    private readonly ssoService: SsoService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('authorize')
  async authorize(
    @Query() query: AuthorizeQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const user = (request as AuthenticatedRequest).user;

    if (!user) {
      const frontendUrl =
        this.configService.getOrThrow<string>('app.frontendUrl');
      return response.redirect(
        `${frontendUrl}${this.ssoService.buildLoginRedirect(request.originalUrl)}`,
      );
    }

    const redirectUrl = await this.ssoService.createAuthorizationRedirect(
      query,
      user,
    );

    return response.redirect(redirectUrl);
  }

  @Post('token')
  exchangeCode(@Body() dto: TokenExchangeDto) {
    return this.ssoService.exchangeCode(dto);
  }

  @Post('callback')
  callback(@Body() dto: TokenExchangeDto) {
    return this.ssoService.exchangeCode(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check-session')
  checkSession(
    @Query() query: CheckSessionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ssoService.checkSession(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-client')
  logoutClient(
    @Body() dto: CheckSessionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ssoService.logoutClient(dto, user);
  }
}
