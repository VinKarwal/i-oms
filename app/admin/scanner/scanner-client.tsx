'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Camera, Scan, Trash2, CheckCircle, XCircle, Plus, Minus } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Item = {
  id: string
  sku: string
  barcode: string | null
  name: string
  unit: string
}

type Location = {
  id: string
  name: string
  path: string
}

type ScannedItem = {
  id: string
  item: Item
  quantity: number
  location_id: string
  unit_cost?: number
  batch_number?: string
  serial_number?: string
  reference_number?: string
  notes?: string
}

type OperationMode = 
  | 'receive'
  | 'production'
  | 'return_from_customer'
  | 'sale'
  | 'transfer_out'
  | 'transfer_in'
  | 'disposal'
  | 'return_to_supplier'
  | 'adjustment_increase'
  | 'adjustment_decrease'

interface ScannerClientProps {
  items: Item[]
  locations: Location[]
  userRole: string
}

export default function ScannerClient({ items, locations, userRole }: ScannerClientProps) {
  const router = useRouter()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // Scanner state
  const [scanInput, setScanInput] = useState('')
  const [operationMode, setOperationMode] = useState<OperationMode>('receive')
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Feedback state
  const [lastScanStatus, setLastScanStatus] = useState<'success' | 'error' | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  
  // Default location
  const [defaultLocation, setDefaultLocation] = useState<string>(locations[0]?.id || '')

  // Keep input focused for physical scanner
  useEffect(() => {
    const focusInput = () => {
      if (!isCameraOpen && scanInputRef.current) {
        scanInputRef.current.focus()
      }
    }
    
    focusInput()
    window.addEventListener('click', focusInput)
    
    return () => window.removeEventListener('click', focusInput)
  }, [isCameraOpen])

  const formatOperationName = (mode: OperationMode) => {
    return mode
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Audio feedback
  const playSound = (type: 'success' | 'error') => {
    if (typeof window === 'undefined') return
    
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioContextClass()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      if (type === 'success') {
        oscillator.frequency.value = 800
        gainNode.gain.value = 0.3
        oscillator.start()
        setTimeout(() => oscillator.stop(), 100)
      } else {
        oscillator.frequency.value = 200
        gainNode.gain.value = 0.5
        oscillator.start()
        setTimeout(() => oscillator.stop(), 300)
      }
    } catch {
      // Audio might not be supported, fail silently
      console.log('Audio feedback not available')
    }
  }

  // Visual feedback
  const showFeedback = (status: 'success' | 'error', message: string) => {
    setLastScanStatus(status)
    setScanMessage(message)
    playSound(status)
    
    // Haptic feedback on mobile
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (status === 'success') {
        navigator.vibrate(50)
      } else {
        navigator.vibrate([100, 50, 100])
      }
    }

    setTimeout(() => {
      setLastScanStatus(null)
      setScanMessage('')
    }, 3000)
  }

  // Handle barcode scan
  const handleScan = async (barcode: string) => {
    if (!barcode.trim()) return

    // Find item by barcode or SKU
    const item = items.find(
      (i) => i.barcode?.toLowerCase() === barcode.toLowerCase() || i.sku.toLowerCase() === barcode.toLowerCase()
    )

    if (!item) {
      showFeedback('error', `Item not found: ${barcode}`)
      return
    }

    // Check if item already scanned
    const existingIndex = scannedItems.findIndex((si) => si.item.id === item.id)

    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...scannedItems]
      updated[existingIndex].quantity += 1
      setScannedItems(updated)
      showFeedback('success', `${item.name} - Quantity increased to ${updated[existingIndex].quantity}`)
    } else {
      // Add new item
      const newScannedItem: ScannedItem = {
        id: Math.random().toString(36).substr(2, 9),
        item,
        quantity: 1,
        location_id: defaultLocation,
      }
      setScannedItems([...scannedItems, newScannedItem])
      showFeedback('success', `Added: ${item.name}`)
    }
  }

  // Handle manual input
  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(scanInput)
      setScanInput('')
    }
  }

  // Update scanned item
  const updateScannedItem = (id: string, updates: Partial<ScannedItem>) => {
    setScannedItems(scannedItems.map((si) => (si.id === id ? { ...si, ...updates } : si)))
  }

  // Remove scanned item
  const removeScannedItem = (id: string) => {
    setScannedItems(scannedItems.filter((si) => si.id !== id))
  }

  // Start camera scanning
  const startCamera = async () => {
    if (typeof window === 'undefined') return
    
    setIsCameraOpen(true)
    
    setTimeout(async () => {
      if (videoRef.current) {
        try {
          // Dynamic import for Quagga to avoid SSR issues
          const Quagga = (await import('@ericblade/quagga2')).default
          
          Quagga.init(
            {
              inputStream: {
                type: 'LiveStream',
                target: videoRef.current,
                constraints: {
                  facingMode: 'environment',
                },
              },
              decoder: {
                readers: [
                  'code_128_reader',
                  'ean_reader',
                  'ean_8_reader',
                  'code_39_reader',
                  'upc_reader',
                  'upc_e_reader',
                ],
              },
              locate: true,
            },
            (err: Error | null) => {
              if (err) {
                console.error('Error starting camera:', err)
                showFeedback('error', 'Failed to start camera')
                setIsCameraOpen(false)
                return
              }
              Quagga.start()
            }
          )

          Quagga.onDetected((result: { codeResult: { code?: string | null } }) => {
            if (result.codeResult.code) {
              handleScan(result.codeResult.code)
              stopCamera()
            }
          })
        } catch (error) {
          console.error('Error loading Quagga:', error)
          showFeedback('error', 'Failed to initialize camera scanner')
          setIsCameraOpen(false)
        }
      }
    }, 100)
  }

  // Stop camera scanning
  const stopCamera = async () => {
    if (typeof window === 'undefined') return
    
    try {
      const Quagga = (await import('@ericblade/quagga2')).default
      Quagga.stop()
    } catch (error) {
      console.error('Error stopping camera:', error)
    }
    setIsCameraOpen(false)
  }

  // Submit batch
  const handleSubmitBatch = async () => {
    if (scannedItems.length === 0) {
      showFeedback('error', 'No items to submit')
      return
    }

    setIsProcessing(true)

    try {
      // Create movements for each item
      const movements = scannedItems.map((si) => ({
        item_id: si.item.id,
        location_id: si.location_id,
        movement_type: operationMode,
        quantity: si.quantity,
        unit_cost: si.unit_cost,
        batch_number: si.batch_number,
        serial_number: si.serial_number,
        reference_number: si.reference_number,
        reason: `Batch ${formatOperationName(operationMode)}`,
        notes: si.notes,
      }))

      const responses = await Promise.all(
        movements.map((movement) =>
          fetch('/api/stock-movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movement),
          })
        )
      )

      const failedCount = responses.filter((r) => !r.ok).length

      if (failedCount === 0) {
        showFeedback('success', `Successfully processed ${movements.length} items`)
        setScannedItems([])
        router.refresh()
      } else {
        showFeedback('error', `${failedCount} items failed to process`)
      }
    } catch (error) {
      console.error('Error submitting batch:', error)
      showFeedback('error', 'Failed to submit batch')
    } finally {
      setIsProcessing(false)
    }
  }

  const getOperationColor = (mode: OperationMode) => {
    if (
      mode === 'receive' ||
      mode === 'production' ||
      mode === 'return_from_customer' ||
      mode === 'transfer_in' ||
      mode === 'adjustment_increase'
    ) {
      return 'bg-green-100 text-green-800 border-green-300'
    } else {
      return 'bg-red-100 text-red-800 border-red-300'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Barcode Scanner</h1>
        <p className="text-muted-foreground mt-1">Scan items for batch operations</p>
      </div>

      {/* Operation Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Operation Mode</CardTitle>
          <CardDescription>Select the type of operation for this batch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Operation Type</Label>
              <Select value={operationMode} onValueChange={(value) => setOperationMode(value as OperationMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">📥 Receive</SelectItem>
                  <SelectItem value="production">🏭 Production</SelectItem>
                  <SelectItem value="return_from_customer">↩️ Return from Customer</SelectItem>
                  <SelectItem value="sale">💰 Sale</SelectItem>
                  <SelectItem value="transfer_out">📤 Transfer Out</SelectItem>
                  <SelectItem value="transfer_in">📥 Transfer In</SelectItem>
                  <SelectItem value="disposal">🗑️ Disposal</SelectItem>
                  <SelectItem value="return_to_supplier">↪️ Return to Supplier</SelectItem>
                  {userRole !== 'Staff' && (
                    <>
                      <SelectItem value="adjustment_increase">➕ Adjustment Increase</SelectItem>
                      <SelectItem value="adjustment_decrease">➖ Adjustment Decrease</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default Location</Label>
              <Select value={defaultLocation} onValueChange={setDefaultLocation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Badge variant="outline" className={getOperationColor(operationMode)}>
              Current Mode: {formatOperationName(operationMode)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Scanner Input */}
      <Card className={lastScanStatus === 'success' ? 'border-green-500' : lastScanStatus === 'error' ? 'border-red-500' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan Items
          </CardTitle>
          <CardDescription>Use physical scanner or camera to scan barcodes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                ref={scanInputRef}
                type="text"
                placeholder="Scan barcode or enter manually..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyPress={handleInputKeyPress}
                className="text-lg h-12"
                autoFocus
              />
            </div>
            <Button onClick={startCamera} variant="outline" size="lg">
              <Camera className="h-5 w-5" />
            </Button>
          </div>

          {lastScanStatus && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              lastScanStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {lastScanStatus === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span>{scanMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Scanned Items ({scannedItems.length})</CardTitle>
          <CardDescription>Review and edit quantities before submitting</CardDescription>
        </CardHeader>
        <CardContent>
          {scannedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No items scanned yet</p>
              <p className="text-sm">Start scanning items to build your batch</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Batch/Serial</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedItems.map((si) => (
                      <TableRow key={si.id}>
                        <TableCell className="font-medium">{si.item.sku}</TableCell>
                        <TableCell>{si.item.name}</TableCell>
                        <TableCell>
                          <Select
                            value={si.location_id}
                            onValueChange={(value) => updateScannedItem(si.id, { location_id: value })}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateScannedItem(si.id, { quantity: Math.max(1, si.quantity - 1) })
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={si.quantity}
                              onChange={(e) =>
                                updateScannedItem(si.id, { quantity: parseInt(e.target.value) || 1 })
                              }
                              className="w-16 text-center"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateScannedItem(si.id, { quantity: si.quantity + 1 })}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={si.unit_cost || ''}
                            onChange={(e) =>
                              updateScannedItem(si.id, { unit_cost: parseFloat(e.target.value) || undefined })
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Input
                              placeholder="Batch"
                              value={si.batch_number || ''}
                              onChange={(e) => updateScannedItem(si.id, { batch_number: e.target.value })}
                              className="w-32 text-xs"
                            />
                            <Input
                              placeholder="Serial"
                              value={si.serial_number || ''}
                              onChange={(e) => updateScannedItem(si.id, { serial_number: e.target.value })}
                              className="w-32 text-xs"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeScannedItem(si.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Total Items: {scannedItems.length} | Total Quantity:{' '}
                  {scannedItems.reduce((sum, si) => sum + si.quantity, 0)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setScannedItems([])} disabled={isProcessing}>
                    Clear All
                  </Button>
                  <Button onClick={handleSubmitBatch} disabled={isProcessing} size="lg">
                    {isProcessing ? 'Processing...' : `Submit ${formatOperationName(operationMode)} Batch`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Camera Scanner Dialog */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Camera Scanner</DialogTitle>
            <DialogDescription>Position the barcode within the camera view</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-lg"
              style={{ maxHeight: '400px' }}
            />
            <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
          </div>
          <Button onClick={stopCamera} variant="outline" className="w-full">
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
