import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Res,
  Headers,
  Get,
  Req,
  UseGuards,
  Put,
  Param,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import {
  CreateLoginUserDto,
  RegisterUserDto,
  ResetPasswordUserDto,
  UpdateResetPasswordUserDto,
  UserInvitationConfirmationDto,
  UserInvitationDto,
} from './users.dto';
import { checkIfPasswordMatch, hashPassword } from './users.type';
import { reply } from '../../app/utils/reply';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantsService } from '../user-tenants/user-tenants.service';
import { config } from '../../app/config';
import {
  validation_login_cookie_setting,
  validation_verify_cookie_setting,
} from '../../app/utils/cookies';
import { CheckUserService, JwtToken } from './middleware/check-user.service';
import { UserAuthGuard } from './middleware';
import { InvitationService } from '../invitation/invitation.service';
import { Role, Status } from '../../app/database/prisma';

@Controller()
export class UsersAuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly checkUserService: CheckUserService,
    private readonly userTenantsService: UserTenantsService,
    private readonly invitationService: InvitationService,
  ) {}

  /** Post one User */
  @Post(`/tenant/register`)
  async createOne(@Res() res: Response, @Body() body: RegisterUserDto) {
    const { email, password, fullName, tenantName } = body;

    const findOneUser = await this.usersService.findOneBy({ email });
    if (findOneUser)
      throw new HttpException(
        `Email ${email} already exists please change`,
        HttpStatus.FOUND,
      );

    const hashedPassword = String(await hashPassword(password));

    const tenant = await this.tenantsService.createOne({
      name: tenantName,
      status: true,
    });

    const user = await this.usersService.createOne({
      password: hashedPassword,
      email: email.toLocaleLowerCase(),
      name: fullName,
      status: true,
      tenantId: tenant.id,
    });

    await this.userTenantsService.createOne({
      tenantId: tenant.id,
      userId: user.id,
      role: Role.TENANT_ADMIN,
    });

    return reply({
      res,
      results: {
        message: 'User created successfully',
        user: user,
      },
    });
  }

  /** Login user */
  @Post(`/auth/login`)
  async createOneLogin(
    @Res() res,
    @Body() body: CreateLoginUserDto,
    @Headers('origin') origin: string,
  ) {
    const { email, password } = body;

    const findOneUser = await this.usersService.findOneBy({
      email,
    });
    if (!findOneUser)
      throw new HttpException(`Invalid credentials`, HttpStatus.NOT_FOUND);
    if (!(await checkIfPasswordMatch(findOneUser?.password, password)))
      throw new HttpException(`Invalid credentials`, HttpStatus.NOT_FOUND);

    const tokenUser = await this.checkUserService.createTokenCookie(
      { userId: findOneUser.id } as JwtToken,
      config.cookie_access.user.accessExpireLogin,
    );

    res.cookie(
      config.cookie_access.user.nameLogin,
      tokenUser,
      validation_login_cookie_setting,
    );
    return reply({
      res,
      results: {
        message: 'User logged in successfully',
        url: origin,
      },
    });
  }

  /** Get one User */
  @Get(`/me/tenant`)
  @UseGuards(UserAuthGuard)
  async getMe(@Res() res, @Req() req) {
    const { user } = req;
    const findOneUser = await this.usersService.findMe({
      userId: user.id,
    });
    if (!findOneUser)
      throw new HttpException(`Invalid user`, HttpStatus.NOT_FOUND);

    const userTenant = await this.userTenantsService.findOneBy({
      userId: findOneUser.id,
      tenantId: user?.tenantId,
    });

    if (!userTenant) {
      throw new ForbiddenException(
        'You are not a member of the current tenant',
      );
    }

    return reply({
      res,
      results: {
        ...findOneUser,
        role: userTenant.role,
      },
    });
  }

  /** Get tenaant Users */
  @Get(`/users`)
  @UseGuards(UserAuthGuard)
  async findAll(@Res() res) {
    const { user } = res.req;

    const users = await this.usersService.findAll({
      tenantId: user?.tenantId,
    });

    return reply({ res, results: users });
  }

  /** Switch tenant */
  @Put(`/tenant/:tenantId/select`)
  @UseGuards(UserAuthGuard)
  async changeUserTenant(
    @Res() res,
    @Req() req,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    const { user } = req;

    const findOneTenant = await this.tenantsService.findOneBy({
      tenantId,
    });
    if (!findOneTenant)
      throw new HttpException(
        `TenantId: ${tenantId} doesn't exists, please change`,
        HttpStatus.NOT_FOUND,
      );

    const findUserTenant = await this.userTenantsService.findOneBy({
      userId: user?.id,
      tenantId,
    });

    if (!findUserTenant) {
      throw new ForbiddenException(
        'You are not a member of the current tenant',
      );
    }

    const switchTenant = await this.usersService.updateOne(
      { userId: user?.id },
      { tenantId: findOneTenant?.id },
    );

    return reply({ res, results: switchTenant });
  }

  /** Invite Contributor */
  @Post(`/users/invite`)
  @UseGuards(UserAuthGuard)
  async inviteContributor(
    @Res() res,
    @Req() req,
    @Body() body: UserInvitationDto,
  ) {
    const { user } = req;
    const { email, role } = body;

    const userTenant = await this.userTenantsService.findOneBy({
      userId: user?.id,
      tenantId: user?.tenantId,
    });

    if (!userTenant) {
      throw new ForbiddenException(
        'You are not a member of the current tenant',
      );
    }

    const allowedRoles: Role[] = [Role.TENANT_ADMIN, Role.PLATFORM_ADMIN];
    if (!allowedRoles.includes(userTenant.role)) {
      throw new ForbiddenException(
        'Only authorized tenant users can invite members',
      );
    }

    const verifyExpire = config.cookie_access.user.accessExpireVerify;
    const verifyExpireSeconds = Number(verifyExpire);

    const invitation = await this.invitationService.createOne({
      role,
      tenantId: user?.tenantId,
      email: email.toLocaleLowerCase(),
      expireDate: new Date(Date.now() + verifyExpireSeconds * 1000),
      status: Status.PENDING,
    });

    const token = await this.checkUserService.createTokenCookie(
      {
        role,
        invitationId: invitation.id,
        reqUserId: user?.id,
        email: email.toLocaleLowerCase(),
        tenantId: user?.tenantId,
      } as JwtToken,
      verifyExpire,
    );

    const invitationUpdate = await this.invitationService.updateOne(
      { invitationId: invitation.id },
      { token },
    );

    return reply({
      res,
      results: {
        message: 'Invitation sent successfully',
        invitationUpdate,
      },
    });
  }

  /** User token invitation confirmation */
  @Put(`/user/invitation/:token/confirm`)
  async userTokenInvitation(
    @Res() res,
    @Body() body: UserInvitationConfirmationDto,
    @Param('token') token: string,
  ) {
    const { password, fullName } = body;

    const payload = await this.checkUserService.verifyTokenCookie(token);
    const findOneUser = await this.usersService.findOneBy({
      email: payload?.email,
    });

    if (findOneUser) {
      const findUserTenant = await this.userTenantsService.findOneBy({
        userId: findOneUser?.id,
        tenantId: payload?.tenantId,
      });
      if (findUserTenant)
        throw new HttpException(
          `User already exists in this tenant`,
          HttpStatus.FOUND,
        );

      await this.usersService.updateOne(
        { userId: findOneUser?.id },
        {
          name: fullName,
        },
      );

      await this.userTenantsService.createOne({
        tenantId: payload?.tenantId,
        userId: findOneUser?.id,
        role: payload?.role,
      });
    } else {
      const user = await this.usersService.createOne({
        name: fullName,
        email: payload?.email,
        password: await hashPassword(password),
        status: true,
        tenantId: payload?.tenantId,
      });

      await this.userTenantsService.createOne({
        tenantId: payload?.tenantId,
        userId: user?.id,
        role: payload?.role,
      });
    }

    await this.invitationService.updateOne(
      { invitationId: payload?.invitationId },
      { status: Status.ACCEPTED },
    );

    return reply({
      res,
      results: { message: 'Invitation confirmed and user updated' },
    });
  }

  /** Reset password user */
  @Post(`/auth/reset-password`)
  async resetPassword(@Res() res, @Body() body: ResetPasswordUserDto) {
    const { email } = body;

    const findOneUser = await this.usersService.findOneBy({
      email,
    });
    if (!findOneUser)
      throw new HttpException(
        `User email ${email} invalid`,
        HttpStatus.NOT_FOUND,
      );

    const token = await this.checkUserService.createTokenCookie(
      { userId: findOneUser.id } as JwtToken,
      config.cookie_access.user.accessExpireVerify,
    );

    return reply({ res, results: token });
  }

  /** Password reset token */
  @Put(`/password/:token/update`)
  async updatePassword(
    @Res() res,
    @Body() body: UpdateResetPasswordUserDto,
    @Param('token') token: string,
  ) {
    const { password } = body;

    const payload = await this.checkUserService.verifyTokenCookie(token);
    const findOneUser = await this.usersService.findOneBy({
      userId: payload?.userId,
    });
    if (!findOneUser)
      throw new HttpException(`User  invalid`, HttpStatus.NOT_FOUND);
    await this.usersService.updateOne(
      { userId: findOneUser?.id },
      { password: await hashPassword(password) },
    );

    return reply({ res, results: 'Password updated' });
  }

  /** Logout user */
  @Get(`/auth/logout`)
  async logout(@Res() res) {
    res.clearCookie(
      config.cookie_access.user.nameLogin,
      validation_login_cookie_setting,
    );
    res.clearCookie(
      config.cookie_access.user.nameVerify,
      validation_verify_cookie_setting,
    );

    return reply({ res, results: 'User logout successfully' });
  }
}
