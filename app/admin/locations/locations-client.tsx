'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, MapPin, Warehouse, Edit, Trash2 } from 'lucide-react'

interface Location {
  id: string
  name: string
  type: string
  parent_id: string | null
  path: string
  level: number
  is_active: boolean
  created_at: string
}

interface LocationsClientPageProps {
  initialLocations: Location[]
  userRole: string
}

export default function LocationsClientPage({
  initialLocations,
}: LocationsClientPageProps) {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('location')
  const [formParentId, setFormParentId] = useState<string>('')

  const warehouses = locations.filter((l) => l.level === 0)

  const handleAdd = async () => {
    if (!formName.trim()) {
      alert('Please enter a location name')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          parent_id: formParentId || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create location')
      }

      const { location } = await response.json()
      setLocations([...locations, location])
      setIsAddOpen(false)
      resetForm()
      router.refresh()
    } catch (error) {
      console.error('Error creating location:', error)
      alert('Failed to create location. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedLocation || !formName.trim()) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/locations/${selectedLocation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update location')
      }

      const { location } = await response.json()
      setLocations(locations.map((l) => (l.id === location.id ? location : l)))
      setIsEditOpen(false)
      setSelectedLocation(null)
      resetForm()
      router.refresh()
    } catch (error) {
      console.error('Error updating location:', error)
      alert('Failed to update location. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedLocation) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/locations/${selectedLocation.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to delete location')
      }

      setLocations(locations.filter((l) => l.id !== selectedLocation.id))
      setIsDeleteOpen(false)
      setSelectedLocation(null)
      router.refresh()
    } catch (error: unknown) {
      console.error('Error deleting location:', error)
      alert((error as Error).message || 'Failed to delete location.')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (location: Location) => {
    setSelectedLocation(location)
    setFormName(location.name)
    setFormType(location.type)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (location: Location) => {
    setSelectedLocation(location)
    setIsDeleteOpen(true)
  }

  const resetForm = () => {
    setFormName('')
    setFormType('location')
    setFormParentId('')
  }

  // Group locations by parent
  const groupedLocations = locations.reduce((acc, location) => {
    const parentKey = location.parent_id || 'root'
    if (!acc[parentKey]) {
      acc[parentKey] = []
    }
    acc[parentKey].push(location)
    return acc
  }, {} as Record<string, Location[]>)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-stone-600 dark:text-stone-400">
            Manage your warehouse locations and hierarchy
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      {/* Warehouses */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((warehouse) => (
          <Card key={warehouse.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-stone-600" />
                  <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(warehouse)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(warehouse)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                <Badge variant="outline">{warehouse.type}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Sub-locations */}
              {groupedLocations[warehouse.id]?.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sub-locations:</p>
                  <div className="space-y-1">
                    {groupedLocations[warehouse.id].map((subloc) => (
                      <div
                        key={subloc.id}
                        className="flex items-center justify-between rounded-md bg-stone-50 dark:bg-stone-900 p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span>{subloc.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openEditDialog(subloc)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openDeleteDialog(subloc)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-500">No sub-locations yet</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Location Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Create a new warehouse or sub-location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Zone A, Aisle 1, Shelf 2"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={formType} onValueChange={setFormType} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="zone">Zone</SelectItem>
                  <SelectItem value="aisle">Aisle</SelectItem>
                  <SelectItem value="shelf">Shelf</SelectItem>
                  <SelectItem value="bin">Bin</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Location (Optional)</Label>
              <Select value={formParentId || 'none'} onValueChange={(value) => setFormParentId(value === 'none' ? '' : value)} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Update location details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select value={formType} onValueChange={setFormType} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="zone">Zone</SelectItem>
                  <SelectItem value="aisle">Aisle</SelectItem>
                  <SelectItem value="shelf">Shelf</SelectItem>
                  <SelectItem value="bin">Bin</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false)
                setSelectedLocation(null)
                resetForm()
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedLocation?.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false)
                setSelectedLocation(null)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
