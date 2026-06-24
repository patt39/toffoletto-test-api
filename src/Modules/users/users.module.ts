import { Module } from '@nestjs/common';
import { UsersAuthController } from './users.controller';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantsService } from '../user-tenants/user-tenants.service';
import { UsersService } from './users.service';
import { CheckUserService } from './middleware/check-user.service';
import { UserAuthStrategy } from './middleware';
import { InvitationService } from '../invitation/invitation.service';

@Module({
  controllers: [UsersAuthController],
  providers: [
    TenantsService,
    UserTenantsService,
    UsersService,
    CheckUserService,
    UserAuthStrategy,
    InvitationService,
  ],
})
export class UsersModule {}
