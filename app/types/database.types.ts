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
      users: {
        Row: {
          id: string
          nrp: string
          name: string
          department: string | null
          faculty: string | null
          email: string | null
          role: string | null
          created_at: string | null
          avatar_url: string | null
          phone: string | null
          gender: string | null
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          slug: string
        }
      }
      products: {
        Row: {
          id: string
          seller_id: string | null
          category_id: number | null
          title: string
          description: string | null
          price: number
          condition: string | null
          stock: number | null
          is_negotiable: boolean | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
      }
      product_media: {
        Row: {
          id: string
          product_id: string | null
          media_url: string
          media_type: string | null
          is_primary: boolean | null
        }
      }
      orders: {
        Row: {
          id: string
          buyer_id: string | null
          seller_id: string | null
          total_amount: number
          shipping_method: string | null
          shipping_address_id: string | null
          status: string | null
          created_at: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number | null
        }
      }
      addresses: {
        Row: {
          id: string
          user_id: string | null
          label: string | null
          full_address: string | null
          is_primary: boolean | null
          city: string | null
          notes: string | null
          lat: number | null
          lng: number | null
          created_at: string | null
        }
      }
      user_settings: {
        Row: {
          user_id: string
          chat_popup: boolean
          notif_product: boolean
          show_online: boolean
          read_receipts: boolean
          updated_at: string | null
        }
        Insert: {
          user_id: string
          chat_popup?: boolean
          notif_product?: boolean
          show_online?: boolean
          read_receipts?: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          chat_popup?: boolean
          notif_product?: boolean
          show_online?: boolean
          read_receipts?: boolean
          updated_at?: string
        }
      }
    }
  }
}
 
