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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_type: string
          city: string | null
          created_at: string | null
          full_address: string | null
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          postal_code: string | null
          user_id: string | null
        }
        Insert: {
          address_type?: string
          city?: string | null
          created_at?: string | null
          full_address?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          postal_code?: string | null
          user_id?: string | null
        }
        Update: {
          address_type?: string
          city?: string | null
          created_at?: string | null
          full_address?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          postal_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          added_at: string | null
          cart_id: string
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          added_at?: string | null
          cart_id: string
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          added_at?: string | null
          cart_id?: string
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          buyer_hidden_at: string | null
          buyer_id: string
          created_at: string | null
          id: string
          product_id: string
          seller_hidden_at: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_hidden_at?: string | null
          buyer_id: string
          created_at?: string | null
          id?: string
          product_id: string
          seller_hidden_at?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_hidden_at?: string | null
          buyer_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          seller_hidden_at?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_read: boolean | null
          offer_id: string | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean | null
          offer_id?: string | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean | null
          offer_id?: string | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          product_id: string | null
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          product_id?: string | null
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          product_id?: string | null
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          buyer_id: string
          chat_id: string
          created_at: string | null
          id: string
          offered_price: number
          product_id: string
          quantity: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          chat_id: string
          created_at?: string | null
          id?: string
          offered_price: number
          product_id: string
          quantity?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          chat_id?: string
          created_at?: string | null
          id?: string
          offered_price?: number
          product_id?: string
          quantity?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price_at_time: number
          product_id: string
          quantity: number
        }
        Insert: {
          id?: string
          order_id: string
          price_at_time: number
          product_id: string
          quantity?: number
        }
        Update: {
          id?: string
          order_id?: string
          price_at_time?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          completed_at: string | null
          courier_code: string | null
          courier_name: string | null
          courier_service: string | null
          created_at: string | null
          disbursement_id: string | null
          id: string
          meetup_confirmed_at: string | null
          meetup_location: string | null
          meetup_otp: string | null
          offer_id: string | null
          payment_method: string | null
          payment_gateway_fee: number
          payment_url: string | null
          platform_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address_id: string | null
          shipping_collection_type: string | null
          shipping_cost: number | null
          shipping_insurance_fee: number
          shipping_is_fragile: boolean
          shipping_is_insured: boolean
          shipping_method: string | null
          status: string | null
          total_amount: number
          tracking_number: string | null
          updated_at: string
          xendit_invoice_id: string | null
        }
        Insert: {
          buyer_id: string
          completed_at?: string | null
          courier_code?: string | null
          courier_name?: string | null
          courier_service?: string | null
          created_at?: string | null
          disbursement_id?: string | null
          id?: string
          meetup_confirmed_at?: string | null
          meetup_location?: string | null
          meetup_otp?: string | null
          offer_id?: string | null
          payment_method?: string | null
          payment_gateway_fee?: number
          payment_url?: string | null
          platform_fee?: number
          seller_id: string
          shipped_at?: string | null
          shipping_address_id?: string | null
          shipping_collection_type?: string | null
          shipping_cost?: number | null
          shipping_insurance_fee?: number
          shipping_is_fragile?: boolean
          shipping_is_insured?: boolean
          shipping_method?: string | null
          status?: string | null
          total_amount: number
          tracking_number?: string | null
          updated_at?: string
          xendit_invoice_id?: string | null
        }
        Update: {
          buyer_id?: string
          completed_at?: string | null
          courier_code?: string | null
          courier_name?: string | null
          courier_service?: string | null
          created_at?: string | null
          disbursement_id?: string | null
          id?: string
          meetup_confirmed_at?: string | null
          meetup_location?: string | null
          meetup_otp?: string | null
          offer_id?: string | null
          payment_method?: string | null
          payment_gateway_fee?: number
          payment_url?: string | null
          platform_fee?: number
          seller_id?: string
          shipped_at?: string | null
          shipping_address_id?: string | null
          shipping_collection_type?: string | null
          shipping_cost?: number | null
          shipping_insurance_fee?: number
          shipping_is_fragile?: boolean
          shipping_is_insured?: boolean
          shipping_method?: string | null
          status?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          xendit_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          order_id: string
          paid_at: string | null
          payment_method: string | null
          status: string | null
          xendit_invoice_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          xendit_invoice_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          xendit_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          id: string
          is_primary: boolean | null
          media_type: string | null
          media_url: string
          product_id: string
          thumbnail_url: string | null
        }
        Insert: {
          id?: string
          is_primary?: boolean | null
          media_type?: string | null
          media_url: string
          product_id: string
          thumbnail_url?: string | null
        }
        Update: {
          id?: string
          is_primary?: boolean | null
          media_type?: string | null
          media_url?: string
          product_id?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: number | null
          condition: string | null
          created_at: string | null
          description: string | null
          height: number | null
          id: string
          is_cod: boolean | null
          is_negotiable: boolean | null
          length: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          price: number
          search_vector: unknown
          seller_id: string
          slug: string | null
          status: string | null
          stock: number | null
          title: string
          updated_at: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          category_id?: number | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: string
          is_cod?: boolean | null
          is_negotiable?: boolean | null
          length?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          price: number
          search_vector?: unknown
          seller_id: string
          slug?: string | null
          status?: string | null
          stock?: number | null
          title: string
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          category_id?: number | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: string
          is_cod?: boolean | null
          is_negotiable?: boolean | null
          length?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          price?: number
          search_vector?: unknown
          seller_id?: string
          slug?: string | null
          status?: string | null
          stock?: number | null
          title?: string
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          reason: string
          reported_product_id: string | null
          reported_user_id: string | null
          reporter_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          reason: string
          reported_product_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          reason?: string
          reported_product_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_product_id_fkey"
            columns: ["reported_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          order_id: string
          order_item_id: string | null
          product_id: string
          rating_product: number | null
          rating_seller: number | null
          reviewee_id: string
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          order_item_id?: string | null
          product_id: string
          rating_product?: number | null
          rating_seller?: number | null
          reviewee_id: string
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          product_id?: string
          rating_product?: number | null
          rating_seller?: number | null
          reviewee_id?: string
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          chat_popup: boolean
          notif_product: boolean
          read_receipts: boolean
          show_online: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_popup?: boolean
          notif_product?: boolean
          read_receipts?: boolean
          show_online?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_popup?: boolean
          notif_product?: boolean
          read_receipts?: boolean
          show_online?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_code: string | null
          banned_at: string | null
          banned_by: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string | null
          department: string | null
          email: string | null
          faculty: string | null
          gender: string | null
          id: string
          last_seen_at: string | null
          name: string
          nrp: string
          phone: string | null
          role: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_code?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          faculty?: string | null
          gender?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          nrp: string
          phone?: string | null
          role?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_code?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          faculty?: string | null
          gender?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          nrp?: string
          phone?: string | null
          role?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_chat_participant: { Args: { p_chat_id: string }; Returns: boolean }
      is_order_participant: { Args: { p_order_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
