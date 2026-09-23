export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MemberStatus = 'ACTIVE' | 'REVOKED';

export interface AuthMeResponse {
  userId: string;
  authSubject: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: MemberRole;
    status: MemberStatus;
  }>;
  activeOrganizationId: string | null;
}

export interface SwitchOrganizationRequest {
  organizationId: string;
}

export interface CreateOrganizationRequest {
  name: string;
}

export interface CreateOrganizationResponse {
  organizationId: string;
  name: string;
  role: 'OWNER';
}

export interface AddMemberRequest {
  userId: string;
  role: Exclude<MemberRole, 'OWNER'>;
}

export interface MembershipDto {
  organizationId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
}
