'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Warehouse, Plus, X } from 'lucide-react'

export default function SetupWizard() {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<string[]>([''])
  const [isLoading, setIsLoading] = useState(false)

  const addWarehouse = () => {
    setWarehouses([...warehouses, ''])
  }

  const removeWarehouse = (index: number) => {
    setWarehouses(warehouses.filter((_, i) => i !== index))
  }

  const updateWarehouse = (index: number, value: string) => {
    const updated = [...warehouses]
    updated[index] = value
    setWarehouses(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validWarehouses = warehouses.filter(w => w.trim() !== '')
    if (validWarehouses.length === 0) {
      alert('Please add at least one warehouse name')
      return
    }

    setIsLoading(true)

    try {
      // Create each warehouse
      for (const name of validWarehouses) {
        const response = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            type: 'warehouse',
            parent_id: null,
            metadata: {}
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to create warehouse: ${name}`)
        }
      }

      // Redirect to locations page after successful setup
      router.push('/admin/locations')
      router.refresh()
    } catch (error) {
      console.error('Error creating warehouses:', error)
      alert('Failed to create warehouses. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-900 dark:bg-stone-100">
            <Warehouse className="h-10 w-10 text-stone-50 dark:text-stone-900" />
          </div>
          <CardTitle className="text-3xl">Welcome to I-OMS</CardTitle>
          <CardDescription className="text-base">
            Let&apos;s set up your warehouse locations to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Add your warehouse(s)
              </Label>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                You can add sub-locations later from the locations page
              </p>

              {warehouses.map((warehouse, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="e.g., Main Warehouse, Warehouse A, Distribution Center"
                      value={warehouse}
                      onChange={(e) => updateWarehouse(index, e.target.value)}
                      disabled={isLoading}
                      required={index === 0}
                    />
                  </div>
                  {warehouses.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeWarehouse(index)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addWarehouse}
                disabled={isLoading}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Warehouse
              </Button>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Continue to Dashboard'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
