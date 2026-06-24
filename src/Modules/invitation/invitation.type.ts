import { Invitation } from '../../app/database/prisma';
export type GetInvitationsSelections = {
  tenantId?: string;
};

export type GetOneInvitationSelections = {
  invitationId?: Invitation['id'];
  email?: Invitation['email'];
  tenantId?: Invitation['tenantId'];
  status?: Invitation['status'];
};

export type UpdateInvitationSelections = {
  invitationId: Invitation['id'];
};

export type CreateInvitationsOptions = Partial<Invitation>;

export type UpdateInvitationsOptions = Partial<Invitation>;

export const invitationSelect = {
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  id: true,
  email: true,
  status: true,
  tenantId: true,
  tenant: {
    select: {
      id: true,
      name: true,
      plan: true,
      status: true,
    },
  },
};
