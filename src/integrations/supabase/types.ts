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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      fee_config: {
        Row: {
          borrow_fee_bps_hourly: number
          buyback_share_bps: number
          id: string
          liquidation_fee_bps: number
          lp_share_bps: number
          max_leverage: number
          singleton: boolean
          trading_fee_bps: number
          treasury_share_bps: number
          updated_at: string
        }
        Insert: {
          borrow_fee_bps_hourly?: number
          buyback_share_bps?: number
          id?: string
          liquidation_fee_bps?: number
          lp_share_bps?: number
          max_leverage?: number
          singleton?: boolean
          trading_fee_bps?: number
          treasury_share_bps?: number
          updated_at?: string
        }
        Update: {
          borrow_fee_bps_hourly?: number
          buyback_share_bps?: number
          id?: string
          liquidation_fee_bps?: number
          lp_share_bps?: number
          max_leverage?: number
          singleton?: boolean
          trading_fee_bps?: number
          treasury_share_bps?: number
          updated_at?: string
        }
        Relationships: []
      }
      fee_events: {
        Row: {
          account: string
          amount: number
          buyback_amount: number
          created_at: string
          id: string
          kind: string
          lp_amount: number
          treasury_amount: number
        }
        Insert: {
          account: string
          amount: number
          buyback_amount?: number
          created_at?: string
          id?: string
          kind: string
          lp_amount?: number
          treasury_amount?: number
        }
        Update: {
          account?: string
          amount?: number
          buyback_amount?: number
          created_at?: string
          id?: string
          kind?: string
          lp_amount?: number
          treasury_amount?: number
        }
        Relationships: []
      }
      lp_positions: {
        Row: {
          account: string
          amount: number
          created_at: string
          id: string
        }
        Insert: {
          account: string
          amount: number
          created_at?: string
          id?: string
        }
        Update: {
          account?: string
          amount?: number
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          base_price: number
          created_at: string
          id: string
          is_active: boolean
          max_leverage: number
          name: string
          pool_address: string | null
          symbol: string
          token_address: string | null
        }
        Insert: {
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_leverage?: number
          name: string
          pool_address?: string | null
          symbol: string
          token_address?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_leverage?: number
          name?: string
          pool_address?: string | null
          symbol?: string
          token_address?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          account: string
          closed_at: string | null
          collateral: number
          entry_price: number
          exit_price: number | null
          fees_paid: number
          id: string
          leverage: number
          liquidation_price: number
          market_symbol: string
          opened_at: string
          pnl: number | null
          side: string
          status: string
        }
        Insert: {
          account: string
          closed_at?: string | null
          collateral: number
          entry_price: number
          exit_price?: number | null
          fees_paid?: number
          id?: string
          leverage: number
          liquidation_price: number
          market_symbol: string
          opened_at?: string
          pnl?: number | null
          side?: string
          status?: string
        }
        Update: {
          account?: string
          closed_at?: string | null
          collateral?: number
          entry_price?: number
          exit_price?: number | null
          fees_paid?: number
          id?: string
          leverage?: number
          liquidation_price?: number
          market_symbol?: string
          opened_at?: string
          pnl?: number | null
          side?: string
          status?: string
        }
        Relationships: []
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
