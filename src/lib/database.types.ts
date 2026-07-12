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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          active: boolean
          created_at: string
          grp: string
          id: string
          name: string
          sort_order: number
          space_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          grp?: string
          id?: string
          name: string
          sort_order?: number
          space_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          grp?: string
          id?: string
          name?: string
          sort_order?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          entry_date: string
          from_id: string | null
          id: string
          kind: string
          month: string
          note: string | null
          participant_ids: string[]
          payer_id: string | null
          recurring: boolean
          space_id: string
          split_type: string
          split_values: Json
          status: string
          to_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          entry_date: string
          from_id?: string | null
          id?: string
          kind: string
          month: string
          note?: string | null
          participant_ids?: string[]
          payer_id?: string | null
          recurring?: boolean
          space_id: string
          split_type?: string
          split_values?: Json
          status?: string
          to_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          entry_date?: string
          from_id?: string | null
          id?: string
          kind?: string
          month?: string
          note?: string | null
          participant_ids?: string[]
          payer_id?: string | null
          recurring?: boolean
          space_id?: string
          split_type?: string
          split_values?: Json
          status?: string
          to_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          palette: number
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          palette?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          palette?: number
        }
        Relationships: []
      }
      space_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          responded_at: string | null
          space_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          responded_at?: string | null
          space_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          responded_at?: string | null
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invitations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          space_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          space_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          space_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "space_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invites_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          active_since: string | null
          display_name: string
          id: string
          joined_at: string
          palette: number
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          active_since?: string | null
          display_name: string
          id?: string
          joined_at?: string
          palette?: number
          role?: string
          space_id: string
          user_id: string
        }
        Update: {
          active_since?: string | null
          display_name?: string
          id?: string
          joined_at?: string
          palette?: number
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_invite: {
        Args: {
          p_expires_in_days?: number
          p_max_uses?: number
          p_space_id: string
        }
        Returns: string
      }
      create_space: {
        Args: { p_currency?: string; p_name: string }
        Returns: string
      }
      is_space_member: { Args: { p_space_id: string }; Returns: boolean }
      is_space_owner: { Args: { p_space_id: string }; Returns: boolean }
      redeem_invite: { Args: { p_code: string }; Returns: string }
      respond_to_space_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: undefined
      }
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
