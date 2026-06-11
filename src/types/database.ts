export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          vat_rate: number
          settings: Json
          theme_config: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['stores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['stores']['Insert']>
      }
      branches: {
        Row: {
          id: string
          store_id: string
          name: string
          address: string | null
          phone: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          store_id: string | null
          branch_id: string | null
          full_name: string | null
          phone: string | null
          role: 'store_admin' | 'manager' | 'cashier' | 'inventory_staff' | 'accountant' | 'customer'
          is_active: boolean
          avatar_url: string | null
          loyalty_points: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      products: {
        Row: {
          id: string
          store_id: string
          category_id: string | null
          supplier_id: string | null
          name: string
          sku: string
          barcode: string | null
          description: string | null
          selling_price: number
          cost_price: number
          images: string[]
          is_active: boolean
          is_taxable: boolean
          tax_category: string | null
          tax_override_rate: number | null
          unit: string
          is_featured: boolean
          metadata: Json
          low_stock_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          name: string
          sku: string
          barcode: string | null
          attributes: Json
          selling_price: number | null
          cost_price: number | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_variants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>
      }
      categories: {
        Row: {
          id: string
          store_id: string
          parent_id: string | null
          name: string
          slug: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          store_id: string
          name: string
          contact_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      stock_movements: {
        Row: {
          id: string
          store_id: string
          product_id: string
          branch_id: string
          variant_id: string | null
          quantity: number
          movement_type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'transfer' | 'initial'
          reference_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>
      }
      orders: {
        Row: {
          id: string
          store_id: string
          branch_id: string | null
          customer_id: string | null
          cashier_id: string | null
          status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'refunded'
          total_amount: number
          tax_amount: number
          discount_amount: number
          notes: string | null
          source: 'pos' | 'online' | 'app'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          unit_price: number
          total_price: number
        }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      payments: {
        Row: {
          id: string
          order_id: string
          amount: number
          method: 'cash' | 'card' | 'wallet' | 'bank_transfer'
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          reference: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          store_id: string
          branch_id: string | null
          supplier_id: string
          po_number: string
          status: 'draft' | 'submitted' | 'confirmed' | 'in_transit' | 'received' | 'cancelled'
          subtotal: number
          tax_amount: number
          total: number
          notes: string | null
          expected_date: string | null
          received_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          variant_id: string | null
          quantity_ordered: number
          quantity_received: number
          unit_cost: number
          total_cost: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_order_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_order_items']['Insert']>
      }
      tax_rules: {
        Row: {
          id: string
          store_id: string
          name: string
          category: string
          rate: number
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tax_rules']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tax_rules']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          store_id: string
          type: 'low_stock' | 'order_update' | 'system' | 'payment'
          title: string
          message: string
          is_read: boolean
          metadata: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          store_id: string
          branch_id: string | null
          category: string
          amount: number
          description: string | null
          receipt_url: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      audit_log: {
        Row: {
          id: string
          store_id: string | null
          entity_type: string
          entity_id: string | null
          action: string
          changes: Json | null
          performed_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'>
        Update: never
      }
      shifts: {
        Row: {
          id: string
          branch_id: string
          cashier_id: string
          started_at: string
          ended_at: string | null
          opening_cash: number
          closing_cash: number | null
          status: 'open' | 'closed'
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['shifts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['shifts']['Insert']>
      }
    }
    Views: {
      current_stock: {
        Row: {
          product_id: string
          branch_id: string
          quantity?: number
          quantity_on_hand?: number
          is_low_stock: boolean
          product_name: string
          low_stock_threshold: number
        }
      }
      revenue_summary: {
        Row: {
          date: string
          total_revenue: number
          order_count: number
          items_sold: number
        }
      }
      product_sales_summary: {
        Row: {
          product_id: string
          product_name: string
          total_units_sold: number
          total_revenue: number
          image_url: string | null
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
export type InsertRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type Product = Tables<'products'>
export type ProductVariant = Tables<'product_variants'>
export type Category = Tables<'categories'>
export type Supplier = Tables<'suppliers'>
export type StockMovement = Tables<'stock_movements'>
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type Payment = Tables<'payments'>
export type PurchaseOrder = Tables<'purchase_orders'>
export type PurchaseOrderItem = Tables<'purchase_order_items'>
export type TaxRule = Tables<'tax_rules'>
export type Branch = Tables<'branches'>
export type Notification = Tables<'notifications'>
export type AuditLog = Tables<'audit_log'>
export type CurrentStock = Views<'current_stock'>
export type RevenueSummary = Views<'revenue_summary'>
export type ProductSalesSummary = Views<'product_sales_summary'>

export interface ProductWithStock extends Product {
  category?: Category | null
  supplier?: Supplier | null
  total_stock: number
  is_low_stock: boolean
  variants?: ProductVariant[]
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplier?: Supplier | null
  items?: (PurchaseOrderItem & { product?: Product })[]
}

export interface CategoryNode extends Category {
  children: CategoryNode[]
  product_count: number
}
