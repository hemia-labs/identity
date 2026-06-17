import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { ConsentsService } from './consents.service';
import { ApproveOAuthConsentDto } from './dtos/approve-oauth-consent.dto';
import { OAuthConsentRequestQueryDto } from './dtos/oauth-consent-request-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('consents/oauth')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get('request')
  getOAuthRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OAuthConsentRequestQueryDto,
  ) {
    return this.consentsService.getOAuthRequest(user.id, query.returnTo);
  }

  @Post('approve')
  approveOAuthConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApproveOAuthConsentDto,
  ) {
    return this.consentsService.approveOAuthConsent(user.id, dto.returnTo);
  }
}
