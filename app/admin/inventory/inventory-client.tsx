'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Package, Edit, Trash2, Search, X, ChevronDown, Upload, Download } from 'lucide-react'

interface Location {
  id: string
  name: string
  path: string
  type: string
}

interface ItemLocation {
  id?: string
  location_id: string
  quantity: number
  min_threshold?: number | null
  max_threshold?: number | null
  locations?: Location
}

interface Item {
  id: string
  sku: string
  barcode?: string | null
  name: string
  description?: string | null
  category?: string | null
  unit: string
  is_active: boolean
  item_locations?: ItemLocation[]
  total_stock?: number
}

interface StockAllocation {
  location_id: string
  quantity: number
  min_threshold?: number
  max_threshold?: number
}

interface InventoryClientPageProps {
  initialItems: Item[]
  locations: Location[]
  userRole: string
}

export default function InventoryClientPage({
  initialItems,
  locations,
  userRole,
}: InventoryClientPageProps) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>(initialItems)
  const [filteredItems, setFilteredItems] = useState<Item[]>(initialItems)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Import state
  interface ImportError {
    row: number
    field: string
    message: string
    value?: string
  }

  interface ImportPreview {
    preview: boolean
    totalRows: number
    uniqueItems: number
    uniqueLocations: number
    validationErrors: ImportError[]
    isValid: boolean
    sampleData: Record<string, string>[]
  }

  interface ImportResult {
    success: boolean
    itemsCreated: number
    itemsSkipped: number
    locationsCreated: string[]
    errors: ImportError[]
    duplicateSKUs: string[]
  }

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Form state
  const [formSku, setFormSku] = useState('')
  const [formBarcode, setFormBarcode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formUnit, setFormUnit] = useState('piece')
  const [stockAllocations, setStockAllocations] = useState<StockAllocation[]>([])

  // Category suggestions
  const [categories, setCategories] = useState<string[]>([])
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)

  // Fetch categories for auto-suggest
  useEffect(() => {
    fetch('/api/items/categories')
      .then(res => res.json())
      .then(data => setCategories(data.categories || []))
      .catch(err => console.error('Error fetching categories:', err))
  }, [])

  // Filter items
  useEffect(() => {
    let filtered = items

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    setFilteredItems(filtered)
  }, [searchTerm, categoryFilter, items])

  const isReadOnly = userRole === 'Staff'

  const resetForm = () => {
    setFormSku('')
    setFormBarcode('')
    setFormName('')
    setFormDescription('')
    setFormCategory('')
    setFormUnit('piece')
    setStockAllocations([])
  }

  const addStockAllocation = () => {
    setStockAllocations([...stockAllocations, {
      location_id: locations[0]?.id || '',
      quantity: 0,
      min_threshold: undefined,
      max_threshold: undefined,
    }])
  }

  const removeStockAllocation = (index: number) => {
    setStockAllocations(stockAllocations.filter((_, i) => i !== index))
  }

  const updateStockAllocation = (index: number, field: keyof StockAllocation, value: string | number | undefined) => {
    const updated = [...stockAllocations]
    updated[index] = { ...updated[index], [field]: value }
    setStockAllocations(updated)
  }

  const handleAdd = async () => {
    if (!formSku || !formName || !formUnit) {
      alert('SKU, Name, and Unit are required')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formSku.trim(),
          barcode: formBarcode.trim() || null,
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory.trim() || null,
          unit: formUnit,
          stock_allocations: stockAllocations.filter(sa => sa.quantity > 0),
        }),
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to create item')
      }

      const { item } = await response.json()
      
      // Calculate total stock
      const total_stock = item.item_locations?.reduce(
        (sum: number, il: ItemLocation) => sum + Number(il.quantity || 0), 0
      ) || 0
      
      setItems([...items, { ...item, total_stock }])
      setIsAddOpen(false)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      console.error('Error creating item:', error)
      alert((error as Error).message || 'Failed to create item')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedItem || !formName || !formUnit) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/items/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory.trim() || null,
          unit: formUnit,
          barcode: formBarcode.trim() || null,
          stock_allocations: stockAllocations,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update item')
      }

      const { item } = await response.json()
      
      // Calculate total stock
      const total_stock = item.item_locations?.reduce(
        (sum: number, il: ItemLocation) => sum + Number(il.quantity || 0), 0
      ) || 0
      
      setItems(items.map((i) => (i.id === item.id ? { ...item, total_stock } : i)))
      setIsEditOpen(false)
      setSelectedItem(null)
      resetForm()
      router.refresh()
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Failed to update item. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/items/${selectedItem.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete item')
      }

      setItems(items.filter((i) => i.id !== selectedItem.id))
      setIsDeleteOpen(false)
      setSelectedItem(null)
      router.refresh()
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (item: Item) => {
    setSelectedItem(item)
    setFormSku(item.sku) // Read-only, just for display
    setFormBarcode(item.barcode || '')
    setFormName(item.name)
    setFormDescription(item.description || '')
    setFormCategory(item.category || '')
    setFormUnit(item.unit)
    setStockAllocations(
      item.item_locations?.map(il => ({
        location_id: il.location_id,
        quantity: Number(il.quantity),
        min_threshold: il.min_threshold ? Number(il.min_threshold) : undefined,
        max_threshold: il.max_threshold ? Number(il.max_threshold) : undefined,
      })) || []
    )
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: Item) => {
    setSelectedItem(item)
    setIsDeleteOpen(true)
  }

  const openDetailDialog = (item: Item) => {
    setSelectedItem(item)
    setIsDetailOpen(true)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    // Read and preview CSV
    const reader = new FileReader()
    reader.onload = async (event) => {
      const csvData = event.target?.result as string

      try {
        setIsLoading(true)
        const response = await fetch('/api/items/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvData, preview: true }),
        })

        const result = await response.json()
        setImportPreview(result)
        setIsPreviewOpen(true)
      } catch (error) {
        console.error('Error previewing CSV:', error)
        alert('Failed to preview CSV. Please check the file format.')
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!csvFile) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const csvData = event.target?.result as string

      try {
        setIsLoading(true)
        const response = await fetch('/api/items/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvData, preview: false }),
        })

        const result = await response.json()
        setImportResult(result)
        setIsPreviewOpen(false)
        setIsSummaryOpen(true)

        // Fetch updated items list
        const itemsResponse = await fetch('/api/items')
        if (itemsResponse.ok) {
          const { items: updatedItems } = await itemsResponse.json()
          // Calculate total stock for each item
          const itemsWithStock = updatedItems.map((item: Item) => ({
            ...item,
            total_stock: item.item_locations?.reduce(
              (sum: number, il: ItemLocation) => sum + Number(il.quantity || 0), 0
            ) || 0
          }))
          setItems(itemsWithStock)
        }
        
        router.refresh()
      } catch (error) {
        console.error('Error importing CSV:', error)
        alert('Failed to import CSV. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsText(csvFile)
  }

  const handleExport = () => {
    // Generate CSV
    const headers = ['SKU', 'Name', 'Description', 'Category', 'Unit', 'Barcode', 'Location', 'Quantity', 'MinThreshold', 'MaxThreshold']
    const rows: string[] = []

    items.forEach(item => {
      if (item.item_locations && item.item_locations.length > 0) {
        item.item_locations.forEach(il => {
          const location = locations.find(l => l.id === il.location_id)
          rows.push([
            item.sku,
            item.name,
            item.description || '',
            item.category || '',
            item.unit,
            item.barcode || '',
            location?.path || '',
            il.quantity.toString(),
            il.min_threshold?.toString() || '',
            il.max_threshold?.toString() || '',
          ].join(','))
        })
      } else {
        // Item without location
        rows.push([
          item.sku,
          item.name,
          item.description || '',
          item.category || '',
          item.unit,
          item.barcode || '',
          '',
          '0',
          '',
          '',
        ].join(','))
      }
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDemo = () => {
    window.open('/demo-inventory.csv', '_blank')
  }

  const uniqueCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)))
  const filteredCategorySuggestions = categories.filter(cat =>
    cat.toLowerCase().includes(formCategory.toLowerCase()) && cat !== formCategory
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-stone-600 dark:text-stone-400">
            Manage your inventory items and stock levels
          </p>
        </div>
        {!isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.getElementById('csv-file-input')?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadDemo}>
                <Download className="mr-2 h-4 w-4" />
                Download Demo CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
              <Input
                placeholder="Search by SKU or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat || ''}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Total Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-stone-500">
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow 
                    key={item.id}
                    className="cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-900"
                    onClick={() => openDetailDialog(item)}
                  >
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-stone-500" />
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.category ? (
                        <Badge variant="outline">{item.category}</Badge>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.total_stock || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        {!isReadOnly && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>
              Create a new inventory item with stock allocation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  placeholder="e.g., ITEM-001"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  placeholder="Optional"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Item name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Item description"
                value={formDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g., Electronics"
                  value={formCategory}
                  onChange={(e) => {
                    setFormCategory(e.target.value)
                    setShowCategorySuggestions(true)
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  disabled={isLoading}
                />
                {showCategorySuggestions && filteredCategorySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-stone-900 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCategorySuggestions.map(cat => (
                      <div
                        key={cat}
                        className="px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        onClick={() => {
                          setFormCategory(cat)
                          setShowCategorySuggestions(false)
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select value={formUnit} onValueChange={setFormUnit} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="g">Gram (g)</SelectItem>
                    <SelectItem value="l">Liter (L)</SelectItem>
                    <SelectItem value="ml">Milliliter (mL)</SelectItem>
                    <SelectItem value="m">Meter (m)</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stock Allocations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Stock Allocation</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStockAllocation}
                  disabled={isLoading}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Location
                </Button>
              </div>

              {stockAllocations.length === 0 ? (
                <p className="text-sm text-stone-500">No stock allocations yet. Add locations to set initial stock.</p>
              ) : (
                <div className="space-y-2">
                  {stockAllocations.map((alloc, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-md">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <div className="col-span-4 sm:col-span-1">
                          <Select
                            value={alloc.location_id}
                            onValueChange={(value) => updateStockAllocation(index, 'location_id', value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.path}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={alloc.quantity}
                          onChange={(e) => updateStockAllocation(index, 'quantity', Number(e.target.value))}
                          disabled={isLoading}
                          min="0"
                        />
                        <Input
                          type="number"
                          placeholder="Min"
                          value={alloc.min_threshold || ''}
                          onChange={(e) => updateStockAllocation(index, 'min_threshold', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isLoading}
                          min="0"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={alloc.max_threshold || ''}
                          onChange={(e) => updateStockAllocation(index, 'max_threshold', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isLoading}
                          min="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStockAllocation(index)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm() }} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog - Similar structure, SKU read-only */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update item details and stock allocation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={formSku} disabled className="bg-stone-100 dark:bg-stone-900" />
                <p className="text-xs text-stone-500">SKU cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-barcode">Barcode</Label>
                <Input
                  id="edit-barcode"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={formCategory}
                  onChange={(e) => {
                    setFormCategory(e.target.value)
                    setShowCategorySuggestions(true)
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  disabled={isLoading}
                />
                {showCategorySuggestions && filteredCategorySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-stone-900 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCategorySuggestions.map(cat => (
                      <div
                        key={cat}
                        className="px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        onClick={() => {
                          setFormCategory(cat)
                          setShowCategorySuggestions(false)
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit *</Label>
                <Select value={formUnit} onValueChange={setFormUnit} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="g">Gram (g)</SelectItem>
                    <SelectItem value="l">Liter (L)</SelectItem>
                    <SelectItem value="ml">Milliliter (mL)</SelectItem>
                    <SelectItem value="m">Meter (m)</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stock Allocations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Stock Allocation</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStockAllocation}
                  disabled={isLoading}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Location
                </Button>
              </div>

              {stockAllocations.length === 0 ? (
                <p className="text-sm text-stone-500">No stock allocations. Add locations to set stock levels.</p>
              ) : (
                <div className="space-y-2">
                  {stockAllocations.map((alloc, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-md">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <div className="col-span-4 sm:col-span-1">
                          <Select
                            value={alloc.location_id}
                            onValueChange={(value) => updateStockAllocation(index, 'location_id', value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.path}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={alloc.quantity}
                          onChange={(e) => updateStockAllocation(index, 'quantity', Number(e.target.value))}
                          disabled={isLoading}
                          min="0"
                        />
                        <Input
                          type="number"
                          placeholder="Min"
                          value={alloc.min_threshold || ''}
                          onChange={(e) => updateStockAllocation(index, 'min_threshold', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isLoading}
                          min="0"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={alloc.max_threshold || ''}
                          onChange={(e) => updateStockAllocation(index, 'max_threshold', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isLoading}
                          min="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStockAllocation(index)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false)
                setSelectedItem(null)
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedItem?.name}&quot;? This will mark the item as inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false)
                setSelectedItem(null)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
            <DialogDescription>Item Details</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-stone-500">SKU</Label>
                  <p className="font-mono">{selectedItem.sku}</p>
                </div>
                {selectedItem.barcode && (
                  <div>
                    <Label className="text-stone-500">Barcode</Label>
                    <p className="font-mono">{selectedItem.barcode}</p>
                  </div>
                )}
              </div>

              {selectedItem.description && (
                <div>
                  <Label className="text-stone-500">Description</Label>
                  <p>{selectedItem.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-stone-500">Category</Label>
                  <p>{selectedItem.category || '-'}</p>
                </div>
                <div>
                  <Label className="text-stone-500">Unit</Label>
                  <p>{selectedItem.unit}</p>
                </div>
              </div>

              <div>
                <Label className="text-stone-500 mb-2 block">Stock Distribution</Label>
                {selectedItem.item_locations && selectedItem.item_locations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedItem.item_locations.map((il) => (
                      <div key={il.id} className="flex justify-between items-center p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{il.locations?.name}</p>
                          <p className="text-sm text-stone-500">{il.locations?.path}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{il.quantity}</p>
                          {(il.min_threshold || il.max_threshold) && (
                            <p className="text-xs text-stone-500">
                              Min: {il.min_threshold || '-'} / Max: {il.max_threshold || '-'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-stone-100 dark:bg-stone-900 rounded-md font-bold">
                      <span>Total Stock</span>
                      <span className="text-lg">{selectedItem.total_stock || 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-stone-500">No stock allocated</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the data before importing
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {importPreview && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xl font-bold">{importPreview.totalRows}</div>
                      <div className="text-xs text-stone-500">Total Rows</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xl font-bold">{importPreview.uniqueItems}</div>
                      <div className="text-xs text-stone-500">Unique Items</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xl font-bold">{importPreview.uniqueLocations}</div>
                      <div className="text-xs text-stone-500">Unique Locations</div>
                    </CardContent>
                  </Card>
                </div>

                {importPreview.validationErrors && importPreview.validationErrors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-red-600 text-sm">Validation Errors ({importPreview.validationErrors.length})</h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                      {importPreview.validationErrors.map((error: ImportError, index: number) => (
                        <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          Row {error.row}, {error.field}: {error.message}
                          {error.value && ` (${error.value})`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importPreview.sampleData && importPreview.sampleData.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Sample Data (First 5 rows)</h3>
                    <div className="border rounded overflow-hidden">
                      <div className="overflow-x-auto max-h-64">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">SKU</TableHead>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Category</TableHead>
                              <TableHead className="text-xs">Location</TableHead>
                              <TableHead className="text-xs">Quantity</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importPreview.sampleData.map((row: Record<string, string>, index: number) => (
                              <TableRow key={index}>
                                <TableCell className="font-mono text-xs">{row.SKU}</TableCell>
                                <TableCell className="text-xs">{row.Name}</TableCell>
                                <TableCell className="text-xs">{row.Category}</TableCell>
                                <TableCell className="font-mono text-xs">{row.Location}</TableCell>
                                <TableCell className="text-xs">{row.Quantity}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}

                {importPreview.isValid ? (
                  <div className="bg-green-50 text-green-700 p-2.5 rounded text-sm">
                    ✓ All data is valid and ready to import
                  </div>
                ) : (
                  <div className="bg-red-50 text-red-700 p-2.5 rounded text-sm">
                    ✗ Please fix validation errors before importing
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importPreview?.isValid || isLoading}
            >
              {isLoading ? 'Importing...' : 'Confirm Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Summary Dialog */}
      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Import Summary</DialogTitle>
            <DialogDescription>
              Review the import results
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {importResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-2xl font-bold text-green-600">{importResult.itemsCreated}</div>
                      <div className="text-xs text-stone-500">Items Created</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-2xl font-bold text-orange-600">{importResult.itemsSkipped}</div>
                      <div className="text-xs text-stone-500">Items Skipped</div>
                    </CardContent>
                  </Card>
                </div>

                {importResult.locationsCreated && importResult.locationsCreated.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-blue-600 text-sm">Locations Created ({importResult.locationsCreated.length})</h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                      {importResult.locationsCreated.map((location: string, index: number) => (
                        <div key={index} className="text-xs bg-blue-50 p-2 rounded font-mono">
                          {location}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.duplicateSKUs && importResult.duplicateSKUs.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-orange-600 text-sm">Skipped - Duplicate SKUs ({importResult.duplicateSKUs.length})</h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                      {importResult.duplicateSKUs.map((sku: string, index: number) => (
                        <div key={index} className="text-xs bg-orange-50 p-2 rounded font-mono">
                          {sku}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-red-600 text-sm">Errors ({importResult.errors.length})</h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                      {importResult.errors.map((error: ImportError, index: number) => (
                        <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {error.field}: {error.message}
                          {error.value && ` (${error.value})`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.success && (
                  <div className="bg-green-50 text-green-700 p-2.5 rounded text-sm">
                    ✓ Import completed successfully!
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button onClick={() => {
              setIsSummaryOpen(false)
              setCsvFile(null)
              setImportPreview(null)
              setImportResult(null)
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
