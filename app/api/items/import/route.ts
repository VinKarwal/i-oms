import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface CSVRow {
  SKU: string;
  Name: string;
  Description: string;
  Category: string;
  Unit: string;
  Barcode: string;
  Location: string;
  Quantity: string;
  MinThreshold: string;
  MaxThreshold: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

interface ImportResult {
  success: boolean;
  itemsCreated: number;
  itemsSkipped: number;
  locationsCreated: string[];
  errors: ValidationError[];
  duplicateSKUs: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csvData, preview = false } = body;

    if (!csvData || typeof csvData !== 'string') {
      return NextResponse.json(
        { error: 'CSV data is required' },
        { status: 400 }
      );
    }

    // Parse CSV
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV must contain header and at least one data row' },
        { status: 400 }
      );
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['SKU', 'Name', 'Description', 'Category', 'Unit', 'Barcode', 'Location', 'Quantity', 'MinThreshold', 'MaxThreshold'];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Missing required headers: ${missingHeaders.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse rows
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const row: Partial<CSVRow> = {};
      
      headers.forEach((header, index) => {
        (row as Record<string, string>)[header] = values[index] || '';
      });

      rows.push(row as CSVRow);
    }

    // Validate rows
    const validationErrors: ValidationError[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because of header and 0-index

      // Required field validation
      if (!row.SKU) {
        validationErrors.push({ row: rowNum, field: 'SKU', message: 'SKU is required' });
      }
      if (!row.Name) {
        validationErrors.push({ row: rowNum, field: 'Name', message: 'Name is required' });
      }
      if (!row.Category) {
        validationErrors.push({ row: rowNum, field: 'Category', message: 'Category is required' });
      }
      if (!row.Unit) {
        validationErrors.push({ row: rowNum, field: 'Unit', message: 'Unit is required' });
      }
      if (!row.Location) {
        validationErrors.push({ row: rowNum, field: 'Location', message: 'Location is required' });
      }

      // Numeric validation
      if (row.Quantity && isNaN(Number(row.Quantity))) {
        validationErrors.push({ row: rowNum, field: 'Quantity', message: 'Quantity must be a number', value: row.Quantity });
      }
      if (row.MinThreshold && isNaN(Number(row.MinThreshold))) {
        validationErrors.push({ row: rowNum, field: 'MinThreshold', message: 'MinThreshold must be a number', value: row.MinThreshold });
      }
      if (row.MaxThreshold && isNaN(Number(row.MaxThreshold))) {
        validationErrors.push({ row: rowNum, field: 'MaxThreshold', message: 'MaxThreshold must be a number', value: row.MaxThreshold });
      }

      // Location path validation
      if (row.Location && !row.Location.startsWith('/')) {
        validationErrors.push({ row: rowNum, field: 'Location', message: 'Location must start with /', value: row.Location });
      }
    }

    // If preview mode, return validation results
    if (preview) {
      const uniqueSKUs = new Set(rows.map(r => r.SKU).filter(Boolean));
      const uniqueLocations = new Set(rows.map(r => r.Location).filter(Boolean));

      return NextResponse.json({
        preview: true,
        totalRows: rows.length,
        uniqueItems: uniqueSKUs.size,
        uniqueLocations: uniqueLocations.size,
        validationErrors,
        isValid: validationErrors.length === 0,
        sampleData: rows.slice(0, 5) // First 5 rows for preview
      });
    }

    // If validation errors, return them
    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        errors: validationErrors
      }, { status: 400 });
    }

    // Process import
    const result: ImportResult = {
      success: true,
      itemsCreated: 0,
      itemsSkipped: 0,
      locationsCreated: [],
      errors: [],
      duplicateSKUs: []
    };

    // Get existing items to check for duplicates
    const { data: existingItems } = await supabaseAdmin
      .from('items')
      .select('sku')
      .eq('is_active', true);

    const existingSKUs = new Set(existingItems?.map(item => item.sku) || []);

    // Group rows by SKU
    const itemGroups = new Map<string, CSVRow[]>();
    for (const row of rows) {
      if (!itemGroups.has(row.SKU)) {
        itemGroups.set(row.SKU, []);
      }
      itemGroups.get(row.SKU)!.push(row);
    }

    // Get existing locations
    const { data: existingLocations } = await supabaseAdmin
      .from('locations')
      .select('id, path')
      .eq('is_active', true);

    const locationMap = new Map(existingLocations?.map(loc => [loc.path, loc.id]) || []);

    // Process each unique item
    for (const [sku, itemRows] of itemGroups) {
      // Skip if item already exists
      if (existingSKUs.has(sku)) {
        result.duplicateSKUs.push(sku);
        result.itemsSkipped++;
        continue;
      }

      // Use first row for item data
      const firstRow = itemRows[0];

      try {
        // Create item
        const { data: newItem, error: itemError } = await supabaseAdmin
          .from('items')
          .insert({
            sku: firstRow.SKU,
            name: firstRow.Name,
            description: firstRow.Description || null,
            category: firstRow.Category,
            unit: firstRow.Unit,
            barcode: firstRow.Barcode || null,
            is_active: true
          })
          .select()
          .single();

        if (itemError) {
          result.errors.push({
            row: 0,
            field: 'SKU',
            message: `Failed to create item ${sku}: ${itemError.message}`,
            value: sku
          });
          continue;
        }

        // Process stock allocations for all locations
        for (const row of itemRows) {
          let locationId = locationMap.get(row.Location);

          // Auto-create location if it doesn't exist
          if (!locationId) {
            const pathParts = row.Location.split('/').filter(Boolean);
            const locationName = pathParts[pathParts.length - 1];
            const level = pathParts.length;
            
            let parentId = null;
            if (level > 1) {
              const parentPath = '/' + pathParts.slice(0, -1).join('/');
              parentId = locationMap.get(parentPath) || null;
            }

            const { data: newLocation, error: locError } = await supabaseAdmin
              .from('locations')
              .insert({
                name: locationName,
                type: level === 1 ? 'warehouse' : 'zone',
                parent_id: parentId,
                path: row.Location,
                level: level,
                is_active: true
              })
              .select()
              .single();

            if (locError) {
              result.errors.push({
                row: 0,
                field: 'Location',
                message: `Failed to create location ${row.Location}: ${locError.message}`,
                value: row.Location
              });
              continue;
            }

            locationId = newLocation.id;
            locationMap.set(row.Location, locationId);
            result.locationsCreated.push(row.Location);
          }

          // Create item_location entry
          const { error: allocError } = await supabaseAdmin
            .from('item_locations')
            .insert({
              item_id: newItem.id,
              location_id: locationId,
              quantity: Number(row.Quantity) || 0,
              min_threshold: Number(row.MinThreshold) || 0,
              max_threshold: Number(row.MaxThreshold) || 0
            });

          if (allocError) {
            result.errors.push({
              row: 0,
              field: 'Location',
              message: `Failed to allocate stock for ${sku} at ${row.Location}: ${allocError.message}`,
              value: row.Location
            });
          }
        }

        result.itemsCreated++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push({
          row: 0,
          field: 'SKU',
          message: `Unexpected error processing ${sku}: ${errorMessage}`,
          value: sku
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to import CSV';
    console.error('Import error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
