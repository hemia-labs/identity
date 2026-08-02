import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { AccountsService } from './accounts.service';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  getAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getAccount(user);
  }

  @Get('active')
  getActive(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getAccount(user);
  }
}
