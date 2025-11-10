# CSV Import/Export Feature Documentation

## Overview
The CSV import/export feature allows bulk management of inventory items with multi-location stock allocation. This feature is available to Admin and Manager roles.

## Accessing the Feature

Navigate to **Inventory** page (`/admin/inventory` or `/manager/inventory`) and click the **"Add Item"** dropdown button in the top right. You'll see four options:
- **Add Item** - Manual single item creation
- **Import CSV** - Bulk import from CSV file
- **Export CSV** - Export all items to CSV
- **Download Demo CSV** - Download a sample CSV template

## CSV Format

### Required Headers
The CSV file must contain the following headers (case-sensitive):
- `SKU` - Unique stock keeping unit identifier
- `Name` - Item name
- `Description` - Item description
- `Category` - Item category
- `Unit` - Unit of measurement (e.g., piece, box, kg, l)
- `Barcode` - Barcode number (optional)
- `Location` - Location path (e.g., /main-warehouse, /main-warehouse/zone-a)
- `Quantity` - Stock quantity at this location
- `MinThreshold` - Minimum stock alert threshold
- `MaxThreshold` - Maximum stock limit

### Multi-Location Support
The format supports **multi-location allocation** by using multiple rows with the same SKU:

```csv
SKU,Name,Description,Category,Unit,Barcode,Location,Quantity,MinThreshold,MaxThreshold
WIDGET-001,Premium Widget,High-quality widget,Electronics,piece,1234567890123,/main-warehouse,100,20,200
WIDGET-001,Premium Widget,High-quality widget,Electronics,piece,1234567890123,/main-warehouse/zone-a,50,10,100
```

This creates one item (WIDGET-001) with stock allocated to two locations.

## Import Process

### 1. Select CSV File
Click **"Import CSV"** and select your CSV file.

### 2. Preview & Validation
The system automatically validates the CSV and shows:
- **Total Rows** - Number of data rows
- **Unique Items** - Number of unique SKUs
- **Unique Locations** - Number of unique locations
- **Validation Errors** - Any format or data errors
- **Sample Data** - First 5 rows preview

### 3. Error Handling
If validation errors are found, you must fix them before importing. Common errors:
- Missing required fields (SKU, Name, Category, Unit, Location)
- Invalid numeric values (Quantity, MinThreshold, MaxThreshold)
- Location path not starting with `/`

### 4. Confirm Import
If validation passes, click **"Confirm Import"** to proceed.

### 5. Import Summary
After import, you'll see:
- **Items Created** - Successfully imported items
- **Items Skipped** - Duplicate SKUs (already exist)
- **Locations Created** - Auto-created locations
- **Errors** - Any errors during import

## Key Features

### Auto-Create Locations
If a location path in the CSV doesn't exist, the system automatically creates it:
- `/main-warehouse` → Creates warehouse-level location
- `/main-warehouse/zone-a` → Creates zone under main-warehouse
- Parent locations are created recursively if needed

### Duplicate SKU Handling
Items with SKUs that already exist are **skipped** to prevent duplicates. The summary shows:
- List of skipped SKUs
- Reason: Already exists in database

### Validation Rules
- **SKU**: Required, alphanumeric
- **Name**: Required
- **Category**: Required
- **Unit**: Required (piece, box, kg, l, etc.)
- **Location**: Required, must start with `/`
- **Quantity**: Must be a valid number
- **MinThreshold**: Must be a valid number (optional)
- **MaxThreshold**: Must be a valid number (optional)
- **Barcode**: Optional

## Export Process

### Export All Items
Click **"Export CSV"** from the dropdown menu. The system generates a CSV file containing:
- All active items
- All stock locations per item (multi-row per item)
- Filename format: `inventory-export-YYYY-MM-DD.csv`

### Export Format
The export uses the same format as import, making it easy to:
1. Export existing data
2. Modify in Excel/Google Sheets
3. Re-import with updates

## Demo CSV

### Download Demo
Click **"Download Demo CSV"** to get a sample file with example data including:
- 15 sample items across various categories
- Multi-location allocations
- Different units (piece, box, kg, l)
- Min/max thresholds

### Demo File Location
`/public/demo-inventory.csv`

### Using the Demo
1. Download the demo CSV
2. Modify SKUs to avoid duplicates (or delete existing items)
3. Adjust quantities and locations as needed
4. Import to test the feature

## API Endpoints

### Import Endpoint
**POST** `/api/items/import`

Request body:
```json
{
  "csvData": "CSV content as string",
  "preview": true|false
}
```

Preview response:
```json
{
  "preview": true,
  "totalRows": 15,
  "uniqueItems": 10,
  "uniqueLocations": 3,
  "validationErrors": [],
  "isValid": true,
  "sampleData": [...]
}
```

Import response:
```json
{
  "success": true,
  "itemsCreated": 10,
  "itemsSkipped": 2,
  "locationsCreated": ["/warehouse-b"],
  "errors": [],
  "duplicateSKUs": ["WIDGET-001", "TOOL-001"]
}
```

## Best Practices

### Before Import
1. **Backup data** - Export existing inventory before large imports
2. **Validate CSV** - Check format matches demo CSV exactly
3. **Use unique SKUs** - Ensure SKUs don't duplicate existing items
4. **Plan locations** - Use consistent location naming (e.g., /warehouse/zone)

### During Import
1. **Review preview** - Always check the preview before confirming
2. **Fix errors** - Address all validation errors
3. **Check auto-created locations** - Verify location paths are correct

### After Import
1. **Review summary** - Check items created, skipped, and errors
2. **Verify data** - Browse inventory to confirm stock levels
3. **Check locations** - Navigate to Locations page to verify hierarchy

## Troubleshooting

### Import Fails
- **Check CSV format** - Ensure headers match exactly
- **Check encoding** - Use UTF-8 encoding
- **Check line endings** - Use standard line breaks

### Validation Errors
- **Missing fields** - Fill all required columns
- **Invalid numbers** - Use numeric values only (no text in quantity fields)
- **Location format** - Paths must start with `/`

### Duplicate SKUs
- **Expected behavior** - System skips existing SKUs to prevent duplicates
- **To update existing items** - Use the Edit function in the UI
- **To replace items** - Delete old items first, then import

### Locations Not Created
- **Check path format** - Must start with `/` and use `/` as separator
- **Check parent exists** - System creates parents automatically, but check summary
- **Manual creation** - Use Locations page to create complex hierarchies

## Security & Permissions

### Role-Based Access
- **Admin** - Full import/export access
- **Manager** - Full import/export access
- **Staff** - No access (read-only)

### Data Validation
- All imports are validated before execution
- Invalid data is rejected with specific error messages
- Transactions are rolled back on errors

### Auto-Creation Safety
- Only valid location paths are created
- Existing locations are never modified
- Location hierarchy is preserved

## Performance

### Import Speed
- ~100 items/second typical performance
- Preview is nearly instant (< 1 second)
- Import time depends on number of items and locations

### File Size Limits
- CSV file size: Recommended < 10MB
- Rows: Recommended < 10,000 rows
- For larger imports, split into multiple files

### Best Practices
- Import during low-traffic periods
- Split large files (> 1000 items) into batches
- Monitor import summary for errors

## Future Enhancements
- Excel (.xlsx) file support
- Column mapping for custom formats
- Scheduled imports
- Import history and rollback
- Bulk update existing items
