import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { organizationsApi } from '@/api/organizations'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import type { OrganizationMember, Role } from '@/types/auth'

export function OrgMembers() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { currentOrganization, user } = useAuthStore()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [isInviting, setIsInviting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!currentOrganization) {
        navigate('/')
        return
      }

      try {
        const [membersData, rolesData] = await Promise.all([
          organizationsApi.listMembers(currentOrganization.id),
          organizationsApi.listRoles(currentOrganization.id),
        ])
        setMembers(membersData)
        setRoles(rolesData)
      } catch (err) {
        console.error('Failed to load members:', err)
        setError('Failed to load members')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [currentOrganization, navigate])

  const handleInvite = async () => {
    if (!currentOrganization || !inviteEmail.trim()) return

    setIsInviting(true)
    setError(null)

    try {
      const member = await organizationsApi.inviteMember(currentOrganization.id, {
        email: inviteEmail,
        role_name: inviteRole,
      })
      setMembers([...members, member])
      setInviteEmail('')
    } catch (err) {
      console.error('Failed to invite member:', err)
      setError('Failed to invite member. Make sure the email is registered.')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!currentOrganization || !confirm('Remove this member?')) return

    try {
      await organizationsApi.removeMember(currentOrganization.id, userId)
      setMembers(members.filter((m) => m.user_id !== userId))
    } catch (err) {
      console.error('Failed to remove member:', err)
      setError('Failed to remove member')
    }
  }

  const handleRoleChange = async (userId: string, roleName: string) => {
    if (!currentOrganization) return

    try {
      const updated = await organizationsApi.updateMemberRole(
        currentOrganization.id,
        userId,
        roleName
      )
      setMembers(members.map((m) => (m.user_id === userId ? updated : m)))
    } catch (err) {
      console.error('Failed to update role:', err)
      setError('Failed to update role')
    }
  }

  const systemRoles = roles.filter((r) => r.is_system)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Members</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage organization members and their roles
          </p>
        </div>
        <Link
          to={`/org/${slug}/settings`}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Organization Settings
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Invite Member
        </h2>
        <div className="flex gap-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {systemRoles
              .filter((r) => r.name !== 'owner')
              .map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
          </select>
          <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
            {isInviting ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium text-sm">
                      {member.display_name?.[0]?.toUpperCase() ||
                        member.email[0].toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.display_name || member.email}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {member.user_id === user?.id || member.role_name === 'owner' ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize">
                      {member.role_name}
                    </span>
                  ) : (
                    <select
                      value={member.role_name}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                      className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      {systemRoles
                        .filter((r) => r.name !== 'owner')
                        .map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(member.joined_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {member.user_id !== user?.id && member.role_name !== 'owner' && (
                    <button
                      onClick={() => handleRemove(member.user_id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
