import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { ACCESS_TOKEN_COOKIE } from '../auth/constants/auth.constants';
import { AuthService } from '../auth/auth.service';
import { AccountsService } from './accounts.service';
import { SwitchAccountDto } from './dtos/switch-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.listAccounts(user.id);
  }

  @Post('switch')
  async switchAccount(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSession() sessionId: string,
    @Body() dto: SwitchAccountDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const account = await this.accountsService.switchAccount(
      user.id,
      sessionId,
      dto.accountIndex,
    );
    const auth = await this.authService.issueAccessTokenForSession(sessionId);
    this.setAccessCookie(response, auth.accessToken);
    return { account, session: auth.session };
  }

  @Delete(':accountIndex')
  removeAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountIndex', ParseIntPipe) accountIndex: number,
  ) {
    return this.accountsService.removeAccount(user.id, accountIndex);
  }

  @Get('active')
  getActive(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getActiveAccount(
      user.tenantId,
      user.organizationId,
      user.teamId,
    );
  }

  private setAccessCookie(response: Response, token: string) {
    response.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.configService.get<boolean>('cookie.secure', false),
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>(
        'cookie.sameSite',
        'lax',
      ),
      domain: this.configService.get<string | undefined>('cookie.domain'),
      path: '/',
      maxAge:
        this.configService.get<number>('cookie.accessTokenMaxAgeSeconds', 900) *
        1000,
    });
  }
}
