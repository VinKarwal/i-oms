'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { createClient } from '@/lib/supabase/client'
import { Upload, X } from 'lucide-react'

interface Location {
  id: string
  name: string
  path: string
}

interface StockMovementDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  itemId: string
  itemSku: string
  itemName: string
  locations: Location[]
  currentLocationId?: string
  userRole: string
}

const movementTypes = [
  { value: 'receive', label: 'Receive', category: 'Inbound' },
  { value: 'production', label: 'Production', category: 'Inbound' },
  { value: 'return_from_customer', label: 'Return from Customer', category: 'Inbound' },
  { value: 'sale', label: 'Sale', category: 'Outbound' },
  { value: 'transfer_out', label: 'Transfer Out', category: 'Outbound' },
  { value: 'disposal', label: 'Disposal/Damage', category: 'Outbound' },
  { value: 'return_to_supplier', label: 'Return to Supplier', category: 'Outbound' },
  { value: 'transfer_in', label: 'Transfer In', category: 'Internal' },
  { value: 'adjustment_increase', label: 'Adjustment (Increase)', category: 'Internal' },
  { value: 'adjustment_decrease', label: 'Adjustment (Decrease)', category: 'Internal' },
]

export default function StockMovementDialog({
  isOpen,
  onClose,
  onSuccess,
  itemId,
  itemSku,
  itemName,
  locations,
  currentLocationId,
  userRole,
}: StockMovementDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [movementType, setMovementType] = useState('')
  const [locationId, setLocationId] = useState(currentLocationId || '')
  const [toLocationId, setToLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const supabase = createClient()

  const resetForm = () => {
    setMovementType('')
    setLocationId(currentLocationId || '')
    setToLocationId('')
    setQuantity('')
    setUnitCost('')
    setBatchNumber('')
    setSerialNumber('')
    setReferenceNumber('')
    setReason('')
    setNotes('')
    setFile(null)
    setUploadProgress(0)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setUploadProgress(0)
  }

  const uploadFile = async (userId: string, movementId: string): Promise<string | null> => {
    if (!file) return null

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${movementId}_${Date.now()}.${fileExt}`
      const filePath = `${userId}/${fileName}`

      setUploadProgress(50)

      const { error: uploadError } = await supabase.storage
        .from('stock-movement-attachments')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      setUploadProgress(100)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('stock-movement-attachments')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('File upload error:', error)
      return null
    }
  }

  const handleSubmit = async () => {
    if (!movementType || !locationId || !quantity || !reason) {
      alert('Please fill in all required fields: Movement Type, Location, Quantity, and Reason')
      return
    }

    if (parseFloat(quantity) <= 0) {
      alert('Quantity must be greater than 0')
      return
    }

    if (movementType === 'transfer_out' && !toLocationId) {
      alert('Please select a destination location for transfer')
      return
    }

    if (toLocationId === locationId) {
      alert('Destination location must be different from source location')
      return
    }

    setIsLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      let attachmentUrl: string | null = null

      // Upload file if present (will be updated after movement is created)
      if (file) {
        // We'll upload after creating the movement to get the movement ID
        setUploadProgress(10)
      }

      // Create movement
      const response = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          location_id: locationId,
          to_location_id: movementType === 'transfer_out' ? toLocationId : undefined,
          movement_type: movementType,
          quantity: parseFloat(quantity),
          unit_cost: unitCost ? parseFloat(unitCost) : undefined,
          batch_number: batchNumber || undefined,
          serial_number: serialNumber || undefined,
          reference_number: referenceNumber || undefined,
          reason,
          notes: notes || undefined,
          user_id: user.id,
          user_role: userRole,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create movement')
      }

      const result = await response.json()
      const movementId = result.movement?.id || result.movements?.[0]?.id

      // Upload file if present
      if (file && movementId) {
        attachmentUrl = await uploadFile(user.id, movementId)
        
        // Update movement with attachment URL if upload succeeded
        if (attachmentUrl) {
          await fetch(`/api/stock-movements/${movementId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attachment_url: attachmentUrl,
            }),
          })
        }
      }

      alert(result.message || 'Movement created successfully')
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating movement:', error)
      alert((error as Error).message || 'Failed to create movement')
    } finally {
      setIsLoading(false)
      setUploadProgress(0)
    }
  }

  const isTransfer = movementType === 'transfer_out'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Record Stock Movement</DialogTitle>
          <DialogDescription>
            Item: {itemSku} - {itemName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {/* Movement Type */}
          <div className="space-y-2">
            <Label htmlFor="movement-type">
              Movement Type <span className="text-red-500">*</span>
            </Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger id="movement-type">
                <SelectValue placeholder="Select movement type" />
              </SelectTrigger>
              <SelectContent>
                {['Inbound', 'Outbound', 'Internal'].map((category) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-stone-500">
                      {category}
                    </div>
                    {movementTypes
                      .filter((t) => t.category === category)
                      .map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source Location */}
          <div className="space-y-2">
            <Label htmlFor="location">
              {isTransfer ? 'From Location' : 'Location'} <span className="text-red-500">*</span>
            </Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Location (for transfers) */}
          {isTransfer && (
            <div className="space-y-2">
              <Label htmlFor="to-location">
                To Location <span className="text-red-500">*</span>
              </Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger id="to-location">
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((loc) => loc.id !== locationId)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.path}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity and Unit Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-cost">Unit Cost</Label>
              <Input
                id="unit-cost"
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Batch and Serial Number */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch-number">Batch Number</Label>
              <Input
                id="batch-number"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="BATCH-2025-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial-number">Serial Number</Label>
              <Input
                id="serial-number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="SN-12345"
              />
            </div>
          </div>

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="reference-number">Reference Number</Label>
            <Input
              id="reference-number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="PO-2025-001, SO-2025-001, etc."
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Purchase from supplier, customer order, etc."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or comments..."
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="attachment">Attachment</Label>
            {!file ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                <p className="text-sm text-stone-600 mb-2">
                  Upload receipt, delivery note, or supporting document
                </p>
                <Input
                  id="attachment"
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />
                <Label htmlFor="attachment">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>Choose File</span>
                  </Button>
                </Label>
                <p className="text-xs text-stone-500 mt-2">
                  Max 10MB - Images, PDF, Word, Excel
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-stone-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Movement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
