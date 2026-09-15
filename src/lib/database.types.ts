export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          structured_response: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          structured_response?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          structured_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_expenses: {
        Row: {
          ad_platform: string
          ad_type: string
          amount: number | null
          amount_kes: number
          created_at: string | null
          created_by: string
          date: string | null
          entered_by: string | null
          id: string
          is_archived: boolean
          is_deleted: boolean
          notes: string | null
          occurred_on: string
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          ad_platform?: string
          ad_type?: string
          amount?: number | null
          amount_kes: number
          created_at?: string | null
          created_by?: string
          date?: string | null
          entered_by?: string | null
          id?: string
          is_archived?: boolean
          is_deleted?: boolean
          notes?: string | null
          occurred_on: string
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          ad_platform?: string
          ad_type?: string
          amount?: number | null
          amount_kes?: number
          created_at?: string | null
          created_by?: string
          date?: string | null
          entered_by?: string | null
          id?: string
          is_archived?: boolean
          is_deleted?: boolean
          notes?: string | null
          occurred_on?: string
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_goals: {
        Row: {
          created_at: string
          id: string
          manual_current_value: number | null
          metric_type: string
          name: string
          notes: string | null
          period_end: string
          period_start: string
          status: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manual_current_value?: number | null
          metric_type: string
          name: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manual_current_value?: number | null
          metric_type?: string
          name?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          hide_financial_details: boolean
          id: string
          invited_at: string
          invited_email: string
          member_id: string | null
          owner_id: string
          permissions: string[]
          restrict_to_own_records: boolean
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          hide_financial_details?: boolean
          id?: string
          invited_at?: string
          invited_email: string
          member_id?: string | null
          owner_id: string
          permissions?: string[]
          restrict_to_own_records?: boolean
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          hide_financial_details?: boolean
          id?: string
          invited_at?: string
          invited_email?: string
          member_id?: string | null
          owner_id?: string
          permissions?: string[]
          restrict_to_own_records?: boolean
          status?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          bank_details: string | null
          business_name: string | null
          city: string | null
          country: string | null
          created_at: string | null
          default_currency: string | null
          default_template: string | null
          email: string | null
          id: string
          invoice_footer: string | null
          invoice_next_number: number | null
          invoice_prefix: string | null
          kra_pin: string | null
          logo_url: string | null
          payment_instructions: string | null
          phone: string | null
          physical_address: string | null
          postal_address: string | null
          quotation_footer: string | null
          quotation_next_number: number | null
          quotation_prefix: string | null
          receipt_footer: string | null
          receipt_next_number: number | null
          receipt_prefix: string | null
          signature_url: string | null
          stamp_url: string | null
          updated_at: string | null
          user_id: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          bank_details?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          default_currency?: string | null
          default_template?: string | null
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          kra_pin?: string | null
          logo_url?: string | null
          payment_instructions?: string | null
          phone?: string | null
          physical_address?: string | null
          postal_address?: string | null
          quotation_footer?: string | null
          quotation_next_number?: number | null
          quotation_prefix?: string | null
          receipt_footer?: string | null
          receipt_next_number?: number | null
          receipt_prefix?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          bank_details?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          default_currency?: string | null
          default_template?: string | null
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          kra_pin?: string | null
          logo_url?: string | null
          payment_instructions?: string | null
          phone?: string | null
          physical_address?: string | null
          postal_address?: string | null
          quotation_footer?: string | null
          quotation_next_number?: number | null
          quotation_prefix?: string | null
          receipt_footer?: string | null
          receipt_next_number?: number | null
          receipt_prefix?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      business_tasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          due_date: string | null
          id: string
          task_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          task_type?: string | null
          title: string
          user_id?: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          task_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          entered_by: string | null
          first_seen_at: string
          id: string
          last_activity_at: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          entered_by?: string | null
          first_seen_at?: string
          id?: string
          last_activity_at?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          entered_by?: string | null
          first_seen_at?: string
          id?: string
          last_activity_at?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          created_at: string | null
          id: string
          show_attention: boolean | null
          show_chart: boolean | null
          show_kpi_cards: boolean | null
          show_recent_sales: boolean | null
          show_tasks: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          show_attention?: boolean | null
          show_chart?: boolean | null
          show_kpi_cards?: boolean | null
          show_recent_sales?: boolean | null
          show_tasks?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          show_attention?: boolean | null
          show_chart?: boolean | null
          show_kpi_cards?: boolean | null
          show_recent_sales?: boolean | null
          show_tasks?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percent: number | null
          document_id: string
          entered_by: string | null
          id: string
          product_name: string
          quantity: number | null
          sort_order: number | null
          tax_percent: number | null
          total: number | null
          unit_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          document_id: string
          entered_by?: string | null
          id?: string
          product_name?: string
          quantity?: number | null
          sort_order?: number | null
          tax_percent?: number | null
          total?: number | null
          unit_price?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          document_id?: string
          entered_by?: string | null
          id?: string
          product_name?: string
          quantity?: number | null
          sort_order?: number | null
          tax_percent?: number | null
          total?: number | null
          unit_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          created_at: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          date: string | null
          delivery_charge: number | null
          discount_amount: number | null
          document_number: string
          document_type: string
          due_date: string | null
          entered_by: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          payment_method: string | null
          project_id: string | null
          related_document_id: string | null
          related_sale_id: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          template: string | null
          terms: string | null
          total: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date?: string | null
          delivery_charge?: number | null
          discount_amount?: number | null
          document_number: string
          document_type: string
          due_date?: string | null
          entered_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          related_document_id?: string | null
          related_sale_id?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          template?: string | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date?: string | null
          delivery_charge?: number | null
          discount_amount?: number | null
          document_number?: string
          document_type?: string
          due_date?: string | null
          entered_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          related_document_id?: string | null
          related_sale_id?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          template?: string | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          recipient_count: number
          subject: string
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_count?: number
          subject: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_count?: number
          subject?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          name: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          key: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      general_expenses: {
        Row: {
          amount: number | null
          created_at: string | null
          date: string | null
          description: string | null
          entered_by: string | null
          expense_type: string
          id: string
          is_archived: boolean
          is_deleted: boolean | null
          notes: string | null
          project_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          entered_by?: string | null
          expense_type: string
          id?: string
          is_archived?: boolean
          is_deleted?: boolean | null
          notes?: string | null
          project_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          entered_by?: string | null
          expense_type?: string
          id?: string
          is_archived?: boolean
          is_deleted?: boolean | null
          notes?: string | null
          project_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          colors: string[]
          cost_price: number | null
          created_at: string | null
          current_stock: number | null
          description: string | null
          entered_by: string | null
          id: string
          is_deleted: boolean | null
          name: string | null
          notes: string | null
          product_name: string | null
          quantity: number | null
          reorder_level: number | null
          selling_price: number | null
          sku: string | null
          unit: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          colors?: string[]
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          entered_by?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          reorder_level?: number | null
          selling_price?: number | null
          sku?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          colors?: string[]
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          entered_by?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          reorder_level?: number | null
          selling_price?: number | null
          sku?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          min_priority: string
          muted_types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          min_priority?: string
          muted_types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          min_priority?: string
          muted_types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_tab: string | null
          body: string | null
          created_at: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_archived: boolean
          is_read: boolean
          priority: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_tab?: string | null
          body?: string | null
          created_at?: string
          dedupe_key: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          priority?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_tab?: string | null
          body?: string | null
          created_at?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          priority?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string | null
          currency: string
          gateway: string | null
          gateway_reference: string | null
          gateway_transaction_id: string | null
          id: string
          payment_method: string
          plan_key: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          source: string
          status: string | null
          submitted_at: string | null
          transaction_reference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string | null
          currency?: string
          gateway?: string | null
          gateway_reference?: string | null
          gateway_transaction_id?: string | null
          id?: string
          payment_method: string
          plan_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          source?: string
          status?: string | null
          submitted_at?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string | null
          currency?: string
          gateway?: string | null
          gateway_reference?: string | null
          gateway_transaction_id?: string | null
          id?: string
          payment_method?: string
          plan_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          source?: string
          status?: string | null
          submitted_at?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_color_options: {
        Row: {
          color_name: string
          created_at: string | null
          id: string
          product_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color_name: string
          created_at?: string | null
          id?: string
          product_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color_name?: string
          created_at?: string | null
          id?: string
          product_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_color_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "user_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          current_billing_cycle: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login: string | null
          phone_number: string | null
          phone_token: string | null
          role: Database["public"]["Enums"]["user_role"]
          subscription_expiry: string | null
          subscription_status: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_billing_cycle?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login?: string | null
          phone_number?: string | null
          phone_token?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          subscription_expiry?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_billing_cycle?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          phone_number?: string | null
          phone_token?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          subscription_expiry?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          bucket_key: string
          count: number
          created_at: string
          id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          action: string
          bucket_key: string
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          action?: string
          bucket_key?: string
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      recurring_invoices: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          day_of_month: number | null
          day_of_week: number | null
          description: string
          entered_by: string | null
          frequency: string
          id: string
          is_active: boolean
          next_run_date: string
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description: string
          entered_by?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          next_run_date: string
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string
          entered_by?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          next_run_date?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          description: string
          entered_by: string | null
          expense_type: string
          frequency: string
          id: string
          is_active: boolean
          next_run_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description: string
          entered_by?: string | null
          expense_type?: string
          frequency: string
          id?: string
          is_active?: boolean
          next_run_date: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string
          entered_by?: string | null
          expense_type?: string
          frequency?: string
          id?: string
          is_active?: boolean
          next_run_date?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          buying_price: number | null
          color: string | null
          created_at: string | null
          entered_by: string | null
          id: string
          is_deleted: boolean | null
          item_type: string
          product_name: string
          profit: number | null
          quantity: number | null
          sale_id: string
          selling_price: number | null
          service_type: string | null
          staff_name: string | null
          subtotal: number | null
          tax_type: string | null
          turnover_tax_amount: number | null
          unit_price: number | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vendor: string | null
          vendor_name: string | null
          vendor_payment: number | null
          vendor_payment_status: string | null
        }
        Insert: {
          buying_price?: number | null
          color?: string | null
          created_at?: string | null
          entered_by?: string | null
          id?: string
          is_deleted?: boolean | null
          item_type?: string
          product_name: string
          profit?: number | null
          quantity?: number | null
          sale_id: string
          selling_price?: number | null
          service_type?: string | null
          staff_name?: string | null
          subtotal?: number | null
          tax_type?: string | null
          turnover_tax_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vendor?: string | null
          vendor_name?: string | null
          vendor_payment?: number | null
          vendor_payment_status?: string | null
        }
        Update: {
          buying_price?: number | null
          color?: string | null
          created_at?: string | null
          entered_by?: string | null
          id?: string
          is_deleted?: boolean | null
          item_type?: string
          product_name?: string
          profit?: number | null
          quantity?: number | null
          sale_id?: string
          selling_price?: number | null
          service_type?: string | null
          staff_name?: string | null
          subtotal?: number | null
          tax_type?: string | null
          turnover_tax_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vendor?: string | null
          vendor_name?: string | null
          vendor_payment?: number | null
          vendor_payment_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_owed_to_vendor: number | null
          buying_price: number | null
          client_name: string | null
          created_at: string | null
          customer_id: string | null
          customer_phone: string | null
          date: string | null
          delivery_charge: number | null
          delivery_date: string | null
          delivery_fee: number | null
          delivery_fee_paid: boolean | null
          delivery_guy: string | null
          delivery_status: string | null
          discount: number | null
          entered_by: string | null
          id: string
          is_archived: boolean
          is_deleted: boolean | null
          location: string | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          product_name: string | null
          profit: number | null
          sale_date: string | null
          seller: string | null
          seller_name: string | null
          selling_price: number | null
          tax_type: string | null
          total_amount: number | null
          turnover_tax_amount: number | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          amount_owed_to_vendor?: number | null
          buying_price?: number | null
          client_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          date?: string | null
          delivery_charge?: number | null
          delivery_date?: string | null
          delivery_fee?: number | null
          delivery_fee_paid?: boolean | null
          delivery_guy?: string | null
          delivery_status?: string | null
          discount?: number | null
          entered_by?: string | null
          id?: string
          is_archived?: boolean
          is_deleted?: boolean | null
          location?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          product_name?: string | null
          profit?: number | null
          sale_date?: string | null
          seller?: string | null
          seller_name?: string | null
          selling_price?: number | null
          tax_type?: string | null
          total_amount?: number | null
          turnover_tax_amount?: number | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          amount_owed_to_vendor?: number | null
          buying_price?: number | null
          client_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          date?: string | null
          delivery_charge?: number | null
          delivery_date?: string | null
          delivery_fee?: number | null
          delivery_fee_paid?: boolean | null
          delivery_guy?: string | null
          delivery_status?: string | null
          discount?: number | null
          entered_by?: string | null
          id?: string
          is_archived?: boolean
          is_deleted?: boolean | null
          location?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          product_name?: string | null
          profit?: number | null
          sale_date?: string | null
          seller?: string | null
          seller_name?: string | null
          selling_price?: number | null
          tax_type?: string | null
          total_amount?: number | null
          turnover_tax_amount?: number | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          amount: number | null
          amount_paid: number | null
          balance_due: number | null
          buying_price: number | null
          client: string | null
          created_at: string | null
          date: string | null
          delivery_guy: string | null
          entered_by: string | null
          id: string
          is_deleted: boolean | null
          name: string | null
          notes: string | null
          payment_status: string | null
          product: string | null
          profit: number | null
          seller: string | null
          selling_price: number | null
          tax_type: string | null
          turnover_tax_amount: number | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          balance_due?: number | null
          buying_price?: number | null
          client?: string | null
          created_at?: string | null
          date?: string | null
          delivery_guy?: string | null
          entered_by?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          notes?: string | null
          payment_status?: string | null
          product?: string | null
          profit?: number | null
          seller?: string | null
          selling_price?: number | null
          tax_type?: string | null
          turnover_tax_amount?: number | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          balance_due?: number | null
          buying_price?: number | null
          client?: string | null
          created_at?: string | null
          date?: string | null
          delivery_guy?: string | null
          entered_by?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          notes?: string | null
          payment_status?: string | null
          product?: string | null
          profit?: number | null
          seller?: string | null
          selling_price?: number | null
          tax_type?: string | null
          turnover_tax_amount?: number | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: []
      }
      user_clients: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_delivery_guys: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_expense_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_products: {
        Row: {
          buying_price: number | null
          colors: string[] | null
          created_at: string | null
          id: string
          name: string
          price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          buying_price?: number | null
          colors?: string[] | null
          created_at?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          buying_price?: number | null
          colors?: string[] | null
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sellers: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_staff: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vendor_expenses: {
        Row: {
          amount: number | null
          amount_kes: number
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          created_by: string
          date: string | null
          entered_by: string | null
          expense_type: string
          id: string
          is_cleared: boolean
          is_deleted: boolean
          notes: string | null
          occurred_on: string
          project_id: string | null
          updated_at: string | null
          user_id: string | null
          vendor_name: string
        }
        Insert: {
          amount?: number | null
          amount_kes: number
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          created_by?: string
          date?: string | null
          entered_by?: string | null
          expense_type: string
          id?: string
          is_cleared?: boolean
          is_deleted?: boolean
          notes?: string | null
          occurred_on: string
          project_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string
        }
        Update: {
          amount?: number | null
          amount_kes?: number
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          created_by?: string
          date?: string | null
          entered_by?: string | null
          expense_type?: string
          id?: string
          is_cleared?: boolean
          is_deleted?: boolean
          notes?: string | null
          occurred_on?: string
          project_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_name: string | null
          created_at: string
          entered_by: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          client_name?: string | null
          created_at?: string
          entered_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          client_name?: string | null
          created_at?: string
          entered_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_action: string
          p_anon_key?: string
          p_max?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      check_user_role: {
        Args: {
          required_role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Returns: boolean
      }
      claim_pending_invite: { Args: never; Returns: string }
      decrement_inventory_stock: {
        Args: { p_product_name: string; p_quantity: number }
        Returns: undefined
      }
      generate_document_number: {
        Args: { p_document_type: string; p_user_id?: string }
        Returns: string
      }
      get_business_metrics: {
        Args: { p_end: string; p_start: string }
        Returns: {
          ad_expenses: number
          cash_received: number
          general_expenses: number
          gross_profit: number
          net_profit: number
          outstanding_payables: number
          outstanding_receivables: number
          sales_count: number
          sales_profit: number
          sales_revenue: number
          supplier_count: number
          supplier_profit: number
          supplier_revenue: number
          total_expenses: number
          vendor_expenses: number
        }[]
      }
      apply_my_subscription_lapse: { Args: never; Returns: string }
      get_business_owner_id: { Args: never; Returns: string }
      get_unpaid_invoice_total: {
        Args: { p_end: string; p_start: string }
        Returns: {
          unpaid_total: number
          unpaid_count: number
          oldest_unpaid_date: string
        }[]
      }
      get_vendor_balance_summary: {
        Args: { p_limit?: number }
        Returns: {
          vendor_name: string
          total_owed: number
          total_paid: number
          balance: number
        }[]
      }
      get_project_summary: {
        Args: { p_project_id?: string }
        Returns: {
          project_id: string
          invoiced_total: number
          spent_total: number
        }[]
      }
      get_daily_series: {
        Args: { p_end: string; p_start: string }
        Returns: {
          day: string
          expenses: number
          profit: number
          revenue: number
          transaction_count: number
        }[]
      }
      get_profit_by_customer: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: {
          customer_id: string
          customer_name: string
          last_order_date: string
          profit: number
          revenue: number
          transaction_count: number
        }[]
      }
      get_profit_by_product: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: {
          cost: number
          margin_pct: number
          product_name: string
          profit: number
          revenue: number
          transaction_count: number
          units_sold: number
        }[]
      }
      get_profit_by_vendor: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: {
          cost: number
          profit: number
          revenue: number
          transaction_count: number
          units_bought: number
          vendor_name: string
        }[]
      }
      has_permission: { Args: { p_section: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      restricts_to_own_records: { Args: never; Returns: boolean }
      run_due_recurring_expenses: { Args: never; Returns: number }
      run_due_recurring_invoices: { Args: never; Returns: number }
      universal_search: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          action_tab: string
          match_rank: number
          result_id: string
          result_type: string
          subtitle: string
          title: string
        }[]
      }
      valid_username: { Args: { username: string }; Returns: boolean }
      vendor_expenses_mark_all_paid: {
        Args: { v_vendor_name: string }
        Returns: number
      }
    }
    Enums: {
      payment_status: "pending" | "paid"
      subscription_status: "trial" | "active" | "expired" | "suspended"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: ["pending", "paid"],
      subscription_status: ["trial", "active", "expired", "suspended"],
      user_role: ["admin", "user"],
    },
  },
} as const
