import { apiClient } from './client'
import type {
  Organization,
  OrganizationListItem,
  OrganizationMember,
  Role,
} from '@/types/auth'

export interface CreateOrganizationData {
  slug: string
  name: string
  description?: string
}

export interface UpdateOrganizationData {
  name?: string
  description?: string
  settings?: Record<string, unknown>
}

export interface InviteMemberData {
  email: string
  role_name?: string
}

export interface CreateRoleData {
  name: string
  permission_codes: string[]
}

export interface UpdateRoleData {
  name?: string
  permission_codes?: string[]
}

export const organizationsApi = {
  list: async (): Promise<OrganizationListItem[]> => {
    const response = await apiClient.get('/organizations')
    return response.data
  },

  create: async (data: CreateOrganizationData): Promise<Organization> => {
    const response = await apiClient.post('/organizations', data)
    return response.data
  },

  get: async (orgId: string): Promise<Organization> => {
    const response = await apiClient.get(`/organizations/${orgId}`)
    return response.data
  },

  update: async (orgId: string, data: UpdateOrganizationData): Promise<Organization> => {
    const response = await apiClient.put(`/organizations/${orgId}`, data)
    return response.data
  },

  delete: async (orgId: string): Promise<void> => {
    await apiClient.delete(`/organizations/${orgId}`)
  },

  listMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/members`)
    return response.data
  },

  inviteMember: async (orgId: string, data: InviteMemberData): Promise<OrganizationMember> => {
    const response = await apiClient.post(`/organizations/${orgId}/members`, data)
    return response.data
  },

  removeMember: async (orgId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/organizations/${orgId}/members/${userId}`)
  },

  updateMemberRole: async (
    orgId: string,
    userId: string,
    roleName: string
  ): Promise<OrganizationMember> => {
    const response = await apiClient.put(`/organizations/${orgId}/members/${userId}/role`, {
      role_name: roleName,
    })
    return response.data
  },

  listRoles: async (orgId: string): Promise<Role[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/roles`)
    return response.data
  },

  createRole: async (orgId: string, data: CreateRoleData): Promise<Role> => {
    const response = await apiClient.post(`/organizations/${orgId}/roles`, data)
    return response.data
  },

  updateRole: async (orgId: string, roleId: string, data: UpdateRoleData): Promise<Role> => {
    const response = await apiClient.put(`/organizations/${orgId}/roles/${roleId}`, data)
    return response.data
  },

  deleteRole: async (orgId: string, roleId: string): Promise<void> => {
    await apiClient.delete(`/organizations/${orgId}/roles/${roleId}`)
  },
}
