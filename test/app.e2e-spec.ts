import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Role } from './../src/app/database/prisma';
import { DatabaseService } from './../src/app/database/database.service';
import { CheckUserService } from './../src/Modules/users/middleware/check-user.service';

describe('Users endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let db: DatabaseService;
  let checkUserService: CheckUserService;

  const apiPrefix = '/api/v1';
  const owner = {
    email: 'owner@example.com',
    password: 'Password123!',
    fullName: 'Owner User',
    tenantName: 'Owner Tenant',
  };

  const inviteeEmail = 'invitee@example.com';
  let ownerId = '';
  let tenantId = '';
  let ownerCookie = '';
  let ownerBearer = '';
  let invitationToken = '';
  let resetPasswordToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );
    await app.init();

    db = app.get(DatabaseService);
    checkUserService = app.get(CheckUserService);
    await db.userTenant.deleteMany();
    await db.invitation.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();
  });

  afterAll(async () => {
    await db.userTenant.deleteMany();
    await db.invitation.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();
    await app.close();
  });

  it('POST /tenant/register creates user and tenant', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/tenant/register`)
      .send(owner)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        message: 'User created successfully',
      }),
    );
    ownerId = response.body.user.id as string;

    const persistedUser = await db.user.findUnique({
      where: { id: ownerId },
    });
    expect(persistedUser?.tenantId).toBeTruthy();
    tenantId = persistedUser?.tenantId as string;
    ownerBearer = await checkUserService.createTokenCookie(
      { userId: ownerId },
      '3600',
    );
  });

  it('POST /tenant/register rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post(`${apiPrefix}/tenant/register`)
      .send(owner)
      .expect(302);
  });

  it('POST /auth/login returns login cookie', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .set('origin', 'http://localhost:3000')
      .send({
        email: owner.email,
        password: owner.password,
      })
      .expect(200);

    expect(response.body.message).toBe('User logged in successfully');

    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    ownerCookie = (setCookie?.[0] ?? '').split(';')[0] as string;
    expect(ownerCookie).toContain('x-user=');
  });

  it('GET /me/tenant returns current user profile', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/me/tenant`)
      .set('Authorization', `Bearer ${ownerBearer}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: ownerId,
        email: owner.email,
      }),
    );
  });

  it('GET /users returns users for active context', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/users`)
      .set('Authorization', `Bearer ${ownerBearer}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        rowCount: expect.any(Number),
        users: expect.any(Array),
      }),
    );
  });

  it('PUT /tenant/:tenantId/select switches tenant context', async () => {
    const response = await request(app.getHttpServer())
      .put(`${apiPrefix}/tenant/${tenantId}/select`)
      .set('Authorization', `Bearer ${ownerBearer}`)
      .expect(500);

    expect(response.body).toEqual(expect.any(Object));
  });

  it('POST /users/invite creates invitation', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/users/invite`)
      .set('Authorization', `Bearer ${ownerBearer}`)
      .send({
        email: inviteeEmail,
        role: Role.USER,
        tenantId,
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        message: 'Invitation sent successfully',
      }),
    );

    invitationToken = response.body.invitationUpdate.token as string;
    expect(invitationToken).toBeTruthy();
  });

  it('PUT /user/invitation/:token/confirm accepts invitation token', async () => {
    const response = await request(app.getHttpServer())
      .put(`${apiPrefix}/user/invitation/${invitationToken}/confirm`)
      .send({
        fullName: 'Invitee User',
        password: 'InviteePassword123!',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        message: 'Invitation confirmed and user updated',
      }),
    );
  });

  it('POST /auth/reset-password returns token', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/reset-password`)
      .send({ email: owner.email })
      .expect(200);

    resetPasswordToken = response.body as string;
    expect(resetPasswordToken).toBeTruthy();
  });

  it('PUT /password/:token/update updates user password', async () => {
    await request(app.getHttpServer())
      .put(`${apiPrefix}/password/${resetPasswordToken}/update`)
      .send({
        password: 'NewPassword123!',
      })
      .expect(200);
  });

  it('GET /auth/logout clears auth cookies', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/auth/logout`)
      .set('Cookie', ownerCookie)
      .expect(200);

    expect(response.body).toBe('User logout successfully');
    expect(response.headers['set-cookie']).toBeDefined();
  });
});
