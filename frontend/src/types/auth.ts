export interface User {
  id: string
  external_id: string
  auth_provider: string
  email: string
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
  last_login_at: string | null
}

export interface Organization {
  id: string
  slug: string
  name: string
  description: string | null
  settings: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export interface OrganizationListItem {
  id: string
  slug: string
  name: string
  role: string
  created_at: string
}

export interface OrganizationMember {
  id: string
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role_id: string
  role_name: string
  joined_at: string
}

export interface Permission {
  id: string
  code: string
  name: string
  resource: string
  action: string
}

export interface Role {
  id: string
  organization_id: string | null
  name: string
  is_system: boolean
  permissions: Permission[]
}
