'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Edit, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  email: string
  full_name: string | null
  role_id: string | null
  created_at: string
  updated_at: string
  roles: { id: string; name: string } | { id: string; name: string }[] | null
}

type Role = {
  id: string
  name: string
  description: string | null
}

interface UserManagementClientProps {
  initialUsers: Profile[]
  roles: Role[]
}

export function UserManagementClient({ initialUsers, roles }: UserManagementClientProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) return

    const { error } = await supabase
      .from('profiles')
      .update({ role_id: selectedRole })
      .eq('id', selectedUser.id)

    if (!error) {
      // Update local state
      setUsers(
        users.map((u) =>
          u.id === selectedUser.id
            ? { ...u, role_id: selectedRole, roles: roles.find((r) => r.id === selectedRole) || null }
            : u
        )
      )
      setIsEditOpen(false)
      setSelectedUser(null)
      setSelectedRole('')
      router.refresh()
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    // Note: In Supabase, deleting a user requires admin API
    // For now, we'll just remove the role
    const { error } = await supabase
      .from('profiles')
      .update({ role_id: null })
      .eq('id', selectedUser.id)

    if (!error) {
      setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, role_id: null, roles: null } : u)))
      setIsDeleteOpen(false)
      setSelectedUser(null)
      router.refresh()
    }
  }

  const openEditDialog = (user: Profile) => {
    setSelectedUser(user)
    setSelectedRole(user.role_id || '')
    setIsEditOpen(true)
  }

  const openDeleteDialog = (user: Profile) => {
    setSelectedUser(user)
    setIsDeleteOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Search users by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border border-stone-200 dark:border-stone-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-stone-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || '-'}</TableCell>
                  <TableCell>
                    {user.roles ? (
                      <Badge variant="secondary">
                        {Array.isArray(user.roles) ? user.roles[0]?.name : user.roles.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        No Role
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(user)}
                        title="Remove role"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {role.description && (
                        <span className="text-xs text-stone-500 ml-2">
                          - {role.description}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={!selectedRole}>
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the role from {selectedUser?.email}? They will need
              to be reassigned a role to access the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Remove Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
