'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Check, X, Download, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

type StockMovement = {
  id: string
  movement_type: string
  quantity: number
  before_quantity: number
  after_quantity: number
  unit_cost: number | null
  total_value: number | null
  batch_number: string | null
  serial_number: string | null
  reference_number: string | null
  reason: string
  notes: string | null
  attachment_url: string | null
  status: string
  transfer_reference: string | null
  created_at: string
  created_by: string
  approved_at: string | null
  approved_by: string | null
  items: { id: string; sku: string; name: string } | null
  locations: { id: string; name: string; path: string } | null
}

type Item = {
  id: string
  sku: string
  name: string
}

type Location = {
  id: string
  name: string
  path: string
}

interface StockMovementsClientProps {
  initialMovements: StockMovement[]
  pendingMovements: StockMovement[]
  items: Item[]
  locations: Location[]
  userRole: string
}

export default function StockMovementsClient({
  initialMovements,
  pendingMovements,
  items,
  locations,
  userRole,
}: StockMovementsClientProps) {
  const router = useRouter()
  const [movements] = useState(initialMovements)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterItem, setFilterItem] = useState<string>('all')
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [sortField] = useState<'created_at' | 'quantity'>('created_at')
  const [sortOrder] = useState<'asc' | 'desc'>('desc')
  const [approvalAction, setApprovalAction] = useState<{
    movementId: string
    action: 'approve' | 'reject'
  } | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  const canApprove = userRole === 'Admin' || userRole === 'Manager'

  // Filter and search movements
  const filteredMovements = useMemo(() => {
    const result = movements.filter((movement) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        !searchTerm ||
        movement.items?.sku.toLowerCase().includes(searchLower) ||
        movement.items?.name.toLowerCase().includes(searchLower) ||
        movement.reference_number?.toLowerCase().includes(searchLower) ||
        movement.batch_number?.toLowerCase().includes(searchLower) ||
        movement.serial_number?.toLowerCase().includes(searchLower)

      // Type filter
      const matchesType = filterType === 'all' || movement.movement_type === filterType

      // Status filter
      const matchesStatus = filterStatus === 'all' || movement.status === filterStatus

      // Item filter
      const matchesItem = filterItem === 'all' || movement.items?.id === filterItem

      // Location filter
      const matchesLocation =
        filterLocation === 'all' || movement.locations?.id === filterLocation

      return matchesSearch && matchesType && matchesStatus && matchesItem && matchesLocation
    })

    // Sort
    result.sort((a, b) => {
      let aValue: number, bValue: number

      if (sortField === 'created_at') {
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
      } else {
        aValue = a.quantity
        bValue = b.quantity
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

    return result
  }, [movements, searchTerm, filterType, filterStatus, filterItem, filterLocation, sortField, sortOrder])

  const handleApproval = async () => {
    if (!approvalAction) return

    setIsApproving(true)
    try {
      const response = await fetch(`/api/stock-movements/${approvalAction.movementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: approvalAction.action === 'approve' ? 'approved' : 'rejected',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update movement status')
      }

      // Refresh the page to get updated data
      router.refresh()
    } catch (error) {
      console.error('Error updating movement:', error)
      alert('Failed to update movement status')
    } finally {
      setIsApproving(false)
      setApprovalAction(null)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Date',
      'SKU',
      'Item Name',
      'Type',
      'Quantity',
      'Before',
      'After',
      'Location',
      'Unit Cost',
      'Total Value',
      'Batch',
      'Serial',
      'Reference',
      'Status',
      'Reason',
    ]

    const rows = filteredMovements.map((m) => [
      format(new Date(m.created_at), 'yyyy-MM-dd HH:mm'),
      m.items?.sku || '',
      m.items?.name || '',
      formatMovementType(m.movement_type),
      m.quantity,
      m.before_quantity,
      m.after_quantity,
      m.locations?.path || '',
      m.unit_cost?.toFixed(2) || '',
      m.total_value?.toFixed(2) || '',
      m.batch_number || '',
      m.serial_number || '',
      m.reference_number || '',
      m.status,
      m.reason,
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-movements-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const formatMovementType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Approved</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getMovementTypeColor = (type: string) => {
    if (
      type === 'receive' ||
      type === 'production' ||
      type === 'return_from_customer' ||
      type === 'transfer_in' ||
      type === 'adjustment_increase'
    ) {
      return 'text-green-600'
    } else if (
      type === 'sale' ||
      type === 'transfer_out' ||
      type === 'disposal' ||
      type === 'return_to_supplier' ||
      type === 'adjustment_decrease'
    ) {
      return 'text-red-600'
    }
    return 'text-gray-600'
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage all inventory movements
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {canApprove && pendingMovements.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
            <CardDescription>
              {pendingMovements.length} movement{pendingMovements.length !== 1 ? 's' : ''} awaiting approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingMovements.slice(0, 5).map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {movement.items?.sku} - {movement.items?.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatMovementType(movement.movement_type)} • {movement.quantity} units •{' '}
                      {format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700"
                      onClick={() => setApprovalAction({ movementId: movement.id, action: 'approve' })}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setApprovalAction({ movementId: movement.id, action: 'reject' })}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
              {pendingMovements.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">
                  and {pendingMovements.length - 5} more...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>Filter and search through all stock movements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search SKU, name, ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="receive">Receive</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="return_from_customer">Return from Customer</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="transfer_out">Transfer Out</SelectItem>
                  <SelectItem value="transfer_in">Transfer In</SelectItem>
                  <SelectItem value="disposal">Disposal</SelectItem>
                  <SelectItem value="return_to_supplier">Return to Supplier</SelectItem>
                  <SelectItem value="adjustment_increase">Adjustment +</SelectItem>
                  <SelectItem value="adjustment_decrease">Adjustment -</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterItem} onValueChange={setFilterItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.sku} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredMovements.length} of {movements.length} movements
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    {canApprove && <TableHead className="text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canApprove ? 11 : 10} className="text-center text-muted-foreground">
                        No movements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMovements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(movement.created_at), 'MMM dd, yyyy')}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(movement.created_at), 'HH:mm:ss')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{movement.items?.sku}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {movement.items?.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${getMovementTypeColor(movement.movement_type)}`}>
                            {formatMovementType(movement.movement_type)}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getMovementTypeColor(movement.movement_type)}`}>
                          {movement.quantity}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {movement.before_quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {movement.after_quantity}
                        </TableCell>
                        <TableCell className="text-sm">{movement.locations?.path}</TableCell>
                        <TableCell className="text-right">
                          {movement.total_value ? `$${movement.total_value.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {movement.reference_number || '-'}
                          {movement.batch_number && (
                            <div className="text-xs text-muted-foreground">B: {movement.batch_number}</div>
                          )}
                          {movement.serial_number && (
                            <div className="text-xs text-muted-foreground">S: {movement.serial_number}</div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(movement.status)}</TableCell>
                        {canApprove && (
                          <TableCell>
                            {movement.status === 'pending' && (
                              <div className="flex gap-1 justify-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                  onClick={() =>
                                    setApprovalAction({ movementId: movement.id, action: 'approve' })
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  onClick={() =>
                                    setApprovalAction({ movementId: movement.id, action: 'reject' })
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Confirmation Dialog */}
      <AlertDialog open={!!approvalAction} onOpenChange={() => setApprovalAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalAction?.action === 'approve' ? 'Approve Movement' : 'Reject Movement'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approvalAction?.action === 'approve'
                ? 'This will approve the stock movement and update inventory quantities. This action cannot be undone.'
                : 'This will reject the stock movement. The inventory will not be updated. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproval} disabled={isApproving}>
              {isApproving ? 'Processing...' : approvalAction?.action === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
