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
          full_name: string | null
          email: string | null
          phone_number: string
          created_at: string
          updated_at: string | null
          subscription_status: 'trial' | 'pending_approval' | 'active' | 'inactive' | 'expired'
          trial_start_date: string | null
          trial_end_date: string | null
          subscription_expiry: string | null
          current_billing_cycle: 'trial' | 'month2-3' | 'month4+'
          role: 'user' | 'admin'
          last_login: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone_number: string
          created_at?: string
          updated_at?: string | null
          subscription_status?: 'trial' | 'pending_approval' | 'active' | 'inactive' | 'expired'
          trial_start_date?: string | null
          trial_end_date?: string | null
          subscription_expiry?: string | null
          current_billing_cycle?: 'trial' | 'month2-3' | 'month4+'
          role?: 'user' | 'admin'
          last_login?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone_number?: string
          created_at?: string
          updated_at?: string | null
          subscription_status?: 'trial' | 'pending_approval' | 'active' | 'inactive' | 'expired'
          trial_start_date?: string | null
          trial_end_date?: string | null
          subscription_expiry?: string | null
          current_billing_cycle?: 'trial' | 'month2-3' | 'month4+'
          role?: 'user' | 'admin'
          last_login?: string | null
        }
      }
      sales: {
        Row: {
          id: string
          user_id: string
          product_name: string
          seller: string
          buying_price: number
          selling_price: number
          delivery_guy: string
          delivery_fee: number
          delivery_fee_paid: boolean
          location: string
          payment_status: 'Paid' | 'Unpaid'
          date: string
          profit: number
          created_at: string
          updated_at: string | null
          tax_type: 'none' | 'vat' | 'turnover' | null
          vat_amount: number | null
          turnover_tax_amount: number | null
          is_deleted: boolean
        }
        Insert: {
          id: string
          user_id: string
          product_name: string
          seller: string
          buying_price: number
          selling_price: number
          delivery_guy: string
          delivery_fee: number
          delivery_fee_paid: boolean
          location: string
          payment_status: 'Paid' | 'Unpaid'
          date: string
          profit: number
          created_at?: string
          updated_at?: string | null
          tax_type?: 'none' | 'vat' | 'turnover' | null
          vat_amount?: number | null
          turnover_tax_amount?: number | null
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          product_name?: string
          seller?: string
          buying_price?: number
          selling_price?: number
          delivery_guy?: string
          delivery_fee?: number
          delivery_fee_paid?: boolean
          location?: string
          payment_status?: 'Paid' | 'Unpaid'
          date?: string
          profit?: number
          created_at?: string
          updated_at?: string | null
          tax_type?: 'none' | 'vat' | 'turnover' | null
          vat_amount?: number | null
          turnover_tax_amount?: number | null
          is_deleted?: boolean
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          client: string
          product: string
          delivery_guy: string
          buying_price: number
          selling_price: number
          payment_status: 'Paid' | 'Not Paid'
          date: string
          profit: number
          created_at: string
          updated_at: string | null
          tax_type: 'none' | 'vat' | 'turnover' | null
          vat_amount: number | null
          turnover_tax_amount: number | null
          is_deleted: boolean
        }
        Insert: {
          id: string
          user_id: string
          client: string
          product: string
          delivery_guy: string
          buying_price: number
          selling_price: number
          payment_status: 'Paid' | 'Not Paid'
          date: string
          profit: number
          created_at?: string
          updated_at?: string | null
          tax_type?: 'none' | 'vat' | 'turnover' | null
          vat_amount?: number | null
          turnover_tax_amount?: number | null
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          client?: string
          product?: string
          delivery_guy?: string
          buying_price?: number
          selling_price?: number
          payment_status?: 'Paid' | 'Not Paid'
          date?: string
          profit?: number
          created_at?: string
          updated_at?: string | null
          tax_type?: 'none' | 'vat' | 'turnover' | null
          vat_amount?: number | null
          turnover_tax_amount?: number | null
          is_deleted?: boolean
        }
      }
    }
    Functions: {
      get_user_profile: {
        Args: {
          user_id: string
        }
        Returns: {
          id: string
          full_name: string | null
          email: string | null
          phone_number: string
          subscription_status: string
          trial_end_date: string
          current_billing_cycle: string
          role: string
        }[]
      }
      check_auth_status: {
        Args: Record<string, never>
        Returns: {
          is_authenticated: boolean
          user_id: string | null
          user_role: string | null
        }[]
      }
      update_last_login: {
        Args: {
          user_id: string
        }
        Returns: void
      }
    }
  }
}