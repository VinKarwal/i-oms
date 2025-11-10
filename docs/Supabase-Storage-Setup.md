# Supabase Storage Bucket Setup for Stock Movements
# Run these commands in the Supabase SQL Editor or use the Supabase Dashboard

## 1. Create Storage Bucket for Movement Attachments

```sql
-- Create bucket for stock movement attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('stock-movement-attachments', 'stock-movement-attachments', false)
ON CONFLICT (id) DO NOTHING;
```

## 2. Set up Storage Policies

```sql
-- Policy: Allow authenticated users to upload files
CREATE POLICY "Users can upload movement attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stock-movement-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to view files
CREATE POLICY "Users can view movement attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'stock-movement-attachments');

-- Policy: Allow users to update their own files
CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'stock-movement-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own files
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stock-movement-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## 3. Alternative: Create Bucket via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Set:
   - Name: `stock-movement-attachments`
   - Public: OFF (unchecked)
   - File size limit: 10 MB (or your preference)
   - Allowed MIME types: `image/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
5. Click **"Create bucket"**
6. Go to bucket **Policies** and add the policies above

## File Structure
Files will be stored as: `{user_id}/{movement_id}_{filename}`
Example: `a1b2c3d4-e5f6.../mvmt123_receipt.pdf`
