// Database types for Supabase

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role_id: string | null
          location_id: string | null
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role_id?: string | null
          location_id?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role_id?: string | null
          location_id?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          permissions: Json
          is_fixed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          permissions?: Json
          is_fixed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          permissions?: Json
          is_fixed?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Role = Database['public']['Tables']['roles']['Row']

export type ProfileWithRole = Profile & {
  roles: Role | null
}

// Permission types
export type Permission =
  | 'all'
  | 'inventory:read'
  | 'inventory:write'
  | 'tasks:view'
  | 'tasks:update'
  | 'tasks:manage'
  | 'orders:manage'
  | 'reports:view'

// User role names
export type RoleName = 'Admin' | 'Manager' | 'Staff'
