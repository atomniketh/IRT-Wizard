import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { organizationsApi } from '@/api/organizations'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import type { Organization } from '@/types/auth'

export function OrgSettings() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { currentOrganization, setCurrentOrganization, organizations, setOrganizations } =
    useAuthStore()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    const loadOrg = async () => {
      if (!currentOrganization) {
        navigate('/')
        return
      }

      try {
        const org = await organizationsApi.get(currentOrganization.id)
        setOrganization(org)
        setFormData({
          name: org.name,
          description: org.description || '',
        })
      } catch (err) {
        console.error('Failed to load organization:', err)
        setError('Failed to load organization')
      } finally {
        setIsLoading(false)
      }
    }

    loadOrg()
  }, [currentOrganization, navigate])

  const handleSave = async () => {
    if (!organization) return

    setIsSaving(true)
    setError(null)

    try {
      const updated = await organizationsApi.update(organization.id, formData)
      setOrganization(updated)

      const updatedOrgs = organizations.map((o) =>
        o.id === updated.id ? { ...o, name: updated.name } : o
      )
      setOrganizations(updatedOrgs)

      if (currentOrganization?.id === updated.id) {
        setCurrentOrganization({ ...currentOrganization, name: updated.name })
      }
    } catch (err) {
      console.error('Failed to update organization:', err)
      setError('Failed to update organization')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Organization not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Organization Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{organization.slug}</p>
        </div>
        <Link
          to={`/org/${slug}/members`}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Manage Members
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          General
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Organization Info
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Slug</dt>
            <dd className="text-gray-900 dark:text-white font-mono">{organization.slug}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Created</dt>
            <dd className="text-gray-900 dark:text-white">
              {new Date(organization.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
