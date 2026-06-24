import { Module } from '@nestjs/common';
import { TenantsModule } from './Modules/tenants/tenants.module';
import { UserTenantsModule } from './Modules/user-tenants/user-tenants.module';
import { UsersModule } from './Modules/users/users.module';
import { DatabaseModule } from './app/database/database.module';
import { InvitationModule } from './Modules/invitation/invitation.module';

@Module({
  imports: [
    DatabaseModule,
    TenantsModule,
    UserTenantsModule,
    UsersModule,
    InvitationModule,
  ],
})
export class AppModule {}
