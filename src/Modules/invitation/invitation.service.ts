import { Injectable } from '@nestjs/common';
import {
  CreateInvitationsOptions,
  GetOneInvitationSelections,
  invitationSelect,
  UpdateInvitationSelections,
  UpdateInvitationsOptions,
} from './invitation.type';
import { DatabaseService } from '../../app/database/database.service';
import { FilterGroup, Invitation, Prisma } from '../../app/database/prisma';
@Injectable()
export class InvitationService {
  constructor(private readonly client: DatabaseService) {}

  async findAll() {
    const prismaWhere: FilterGroup<Prisma.InvitationWhereInput> = {
      deletedAt: null,
      AND: [],
    };

    const invitations = await this.client.invitation.findMany({
      where: prismaWhere,
      select: invitationSelect,
    });

    const rowCount = await this.client.invitation.count({ where: prismaWhere });
    return { rowCount, invitations };
  }

  /** Find one invitation in database. */
  async findOneBy(selections: GetOneInvitationSelections) {
    const prismaWhere = {} as Prisma.InvitationWhereInput;

    const { invitationId, email, tenantId, status } = selections;

    if (invitationId) {
      Object.assign(prismaWhere, { id: invitationId });
    }
    if (email) {
      Object.assign(prismaWhere, { email });
    }
    if (tenantId) {
      Object.assign(prismaWhere, { tenantId });
    }
    if (status) {
      Object.assign(prismaWhere, { status });
    }
    const invitation = await this.client.invitation.findFirst({
      where: { ...prismaWhere, deletedAt: null },
    });

    return invitation;
  }

  /** Create one invitation in database. */
  async createOne(options: CreateInvitationsOptions): Promise<Invitation> {
    const { token, tenantId, email, expireDate, status, role } = options;

    const invitation = this.client.invitation.create({
      data: {
        role,
        token,
        tenantId,
        email,
        expireDate,
        status,
      },
    });

    return invitation;
  }

  /** Update one invitation in database. */
  async updateOne(
    selections: UpdateInvitationSelections,
    options: UpdateInvitationsOptions,
  ): Promise<Invitation> {
    const { invitationId } = selections;
    const { token, tenantId, email, expireDate, status, deletedAt } = options;

    const invitation = this.client.invitation.update({
      where: { id: invitationId },
      data: { token, tenantId, email, expireDate, status, deletedAt },
    });

    return invitation;
  }
}
