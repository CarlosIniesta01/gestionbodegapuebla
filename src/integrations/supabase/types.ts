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
      bodegas: {
        Row: {
          created_at: string
          id: string
          nombre: string
          organization_id: string
          ubicacion: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          organization_id: string
          ubicacion?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          organization_id?: string
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bodegas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_zonas: {
        Row: {
          membership_id: string
          zona_id: string
        }
        Insert: {
          membership_id: string
          zona_id: string
        }
        Update: {
          membership_id?: string
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_zonas_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          bodega_id: string
          created_at: string
          estado: Database["public"]["Enums"]["membership_estado"]
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          bodega_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["membership_estado"]
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          bodega_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["membership_estado"]
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          bodega_id: string
          canal: Database["public"]["Enums"]["mensaje_canal"]
          canal_ref: string | null
          contenido: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          bodega_id: string
          canal?: Database["public"]["Enums"]["mensaje_canal"]
          canal_ref?: string | null
          contenido: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          bodega_id?: string
          canal?: Database["public"]["Enums"]["mensaje_canal"]
          canal_ref?: string | null
          contenido?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          categoria: string
          descripcion: string | null
          key: string
          label: string
        }
        Insert: {
          categoria: string
          descripcion?: string | null
          key: string
          label: string
        }
        Update: {
          categoria?: string
          descripcion?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          nombre: string | null
          telefono: string | null
          ultima_conexion: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          nombre?: string | null
          telefono?: string | null
          ultima_conexion?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          nombre?: string | null
          telefono?: string | null
          ultima_conexion?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          activo: boolean
          bodega_id: string | null
          color: string
          created_at: string
          descripcion: string | null
          icono: string
          id: string
          is_system: boolean
          key: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          bodega_id?: string | null
          color?: string
          created_at?: string
          descripcion?: string | null
          icono?: string
          id?: string
          is_system?: boolean
          key: string
          nombre: string
        }
        Update: {
          activo?: boolean
          bodega_id?: string | null
          color?: string
          created_at?: string
          descripcion?: string | null
          icono?: string
          id?: string
          is_system?: boolean
          key?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajo_eventos: {
        Row: {
          contenido: string | null
          created_at: string
          id: string
          meta: Json
          tipo: string
          trabajo_id: string
          user_id: string
        }
        Insert: {
          contenido?: string | null
          created_at?: string
          id?: string
          meta?: Json
          tipo: string
          trabajo_id: string
          user_id: string
        }
        Update: {
          contenido?: string | null
          created_at?: string
          id?: string
          meta?: Json
          tipo?: string
          trabajo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajo_eventos_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajos: {
        Row: {
          asignado_a: string | null
          bodega_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          datos: Json
          deposito_destino: string | null
          deposito_origen: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["trabajo_estado"]
          id: string
          prioridad: Database["public"]["Enums"]["trabajo_prioridad"]
          scheduled_at: string | null
          started_at: string | null
          tipo: Database["public"]["Enums"]["trabajo_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          bodega_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          datos?: Json
          deposito_destino?: string | null
          deposito_origen?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["trabajo_estado"]
          id?: string
          prioridad?: Database["public"]["Enums"]["trabajo_prioridad"]
          scheduled_at?: string | null
          started_at?: string | null
          tipo: Database["public"]["Enums"]["trabajo_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          bodega_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          datos?: Json
          deposito_destino?: string | null
          deposito_origen?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["trabajo_estado"]
          id?: string
          prioridad?: Database["public"]["Enums"]["trabajo_prioridad"]
          scheduled_at?: string | null
          started_at?: string | null
          tipo?: Database["public"]["Enums"]["trabajo_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajos_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_bodegas: { Args: never; Returns: string[] }
      has_permission: {
        Args: { _bodega: string; _perm: string }
        Returns: boolean
      }
      is_bodega_admin: { Args: { _bodega: string }; Returns: boolean }
      user_bodegas: { Args: { _user: string }; Returns: string[] }
    }
    Enums: {
      membership_estado: "activo" | "inactivo" | "suspendido"
      mensaje_canal: "general" | "deposito" | "trabajo"
      trabajo_estado: "pendiente" | "en_curso" | "completado" | "cancelado"
      trabajo_prioridad: "baja" | "normal" | "alta" | "urgente"
      trabajo_tipo:
        | "trasiego"
        | "vendimia"
        | "producto"
        | "limpieza"
        | "embotellado"
        | "incidencia"
        | "observacion"
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
      membership_estado: ["activo", "inactivo", "suspendido"],
      mensaje_canal: ["general", "deposito", "trabajo"],
      trabajo_estado: ["pendiente", "en_curso", "completado", "cancelado"],
      trabajo_prioridad: ["baja", "normal", "alta", "urgente"],
      trabajo_tipo: [
        "trasiego",
        "vendimia",
        "producto",
        "limpieza",
        "embotellado",
        "incidencia",
        "observacion",
      ],
    },
  },
} as const
