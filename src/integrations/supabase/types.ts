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
      analiticas_lote: {
        Row: {
          bodega_id: string
          created_at: string
          created_by: string | null
          deposito_id: string | null
          fecha: string
          id: string
          lote_id: string
          observaciones: string | null
          parametro: string
          producto_id: string | null
          realizado_por: string | null
          resultado_estado: Database["public"]["Enums"]["analitica_estado"]
          unidad: string | null
          updated_at: string
          updated_by: string | null
          valor: number | null
          valor_texto: string | null
        }
        Insert: {
          bodega_id: string
          created_at?: string
          created_by?: string | null
          deposito_id?: string | null
          fecha?: string
          id?: string
          lote_id: string
          observaciones?: string | null
          parametro: string
          producto_id?: string | null
          realizado_por?: string | null
          resultado_estado?: Database["public"]["Enums"]["analitica_estado"]
          unidad?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_texto?: string | null
        }
        Update: {
          bodega_id?: string
          created_at?: string
          created_by?: string | null
          deposito_id?: string | null
          fecha?: string
          id?: string
          lote_id?: string
          observaciones?: string | null
          parametro?: string
          producto_id?: string | null
          realizado_por?: string | null
          resultado_estado?: Database["public"]["Enums"]["analitica_estado"]
          unidad?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analiticas_lote_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          bodega_id: string | null
          created_at: string
          id: number
          payload: Json | null
          registro_id: string | null
          tabla: string
          user_id: string | null
        }
        Insert: {
          accion: string
          bodega_id?: string | null
          created_at?: string
          id?: number
          payload?: Json | null
          registro_id?: string | null
          tabla: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          bodega_id?: string | null
          created_at?: string
          id?: number
          payload?: Json | null
          registro_id?: string | null
          tabla?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      bodega_maps: {
        Row: {
          bodega_id: string
          created_at: string
          data: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bodega_id: string
          created_at?: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bodega_id?: string
          created_at?: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bodega_maps_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: true
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
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
      calendario_evento_trabajadores: {
        Row: {
          bodega_id: string
          created_at: string
          evento_id: string
          id: string
          user_id: string
        }
        Insert: {
          bodega_id: string
          created_at?: string
          evento_id: string
          id?: string
          user_id: string
        }
        Update: {
          bodega_id?: string
          created_at?: string
          evento_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendario_evento_trabajadores_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendario_evento_trabajadores_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "calendario_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      calendario_eventos: {
        Row: {
          bodega_id: string
          cliente_id: string | null
          contrato_compra_id: string | null
          contrato_venta_id: string | null
          created_at: string
          created_by: string | null
          datos: Json
          deposito_destino: string | null
          deposito_origen: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["calendario_estado"]
          fecha_fin: string
          fecha_inicio: string
          id: string
          observaciones: string | null
          prioridad: Database["public"]["Enums"]["calendario_prioridad"]
          producto_id: string | null
          proveedor_id: string | null
          tipo: Database["public"]["Enums"]["calendario_tipo"]
          titulo: string
          trabajo_id: string | null
          updated_at: string
          zona_id: string | null
        }
        Insert: {
          bodega_id: string
          cliente_id?: string | null
          contrato_compra_id?: string | null
          contrato_venta_id?: string | null
          created_at?: string
          created_by?: string | null
          datos?: Json
          deposito_destino?: string | null
          deposito_origen?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["calendario_estado"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          observaciones?: string | null
          prioridad?: Database["public"]["Enums"]["calendario_prioridad"]
          producto_id?: string | null
          proveedor_id?: string | null
          tipo: Database["public"]["Enums"]["calendario_tipo"]
          titulo: string
          trabajo_id?: string | null
          updated_at?: string
          zona_id?: string | null
        }
        Update: {
          bodega_id?: string
          cliente_id?: string | null
          contrato_compra_id?: string | null
          contrato_venta_id?: string | null
          created_at?: string
          created_by?: string | null
          datos?: Json
          deposito_destino?: string | null
          deposito_origen?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["calendario_estado"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          observaciones?: string | null
          prioridad?: Database["public"]["Enums"]["calendario_prioridad"]
          producto_id?: string | null
          proveedor_id?: string | null
          tipo?: Database["public"]["Enums"]["calendario_tipo"]
          titulo?: string
          trabajo_id?: string | null
          updated_at?: string
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendario_eventos_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          bodega_id: string
          cif_nif: string | null
          created_at: string
          created_by: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          observaciones: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bodega_id: string
          cif_nif?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          observaciones?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bodega_id?: string
          cif_nif?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          observaciones?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      consumos_producto: {
        Row: {
          anulado: boolean
          autorizado_en: string | null
          autorizado_por: string | null
          bodega_id: string
          cantidad: number
          contrato_compra_id: string | null
          contrato_venta_id: string | null
          created_at: string
          created_by: string
          deposito_id: string | null
          elaboracion_id: string | null
          fecha: string
          hora: string
          id: string
          incidencia_id: string | null
          lote_id: string
          motivo_anulacion: string | null
          motivo_autorizacion: string | null
          movimiento_id: string | null
          observaciones: string | null
          producto_id: string
          trabajador_id: string | null
          trabajo_id: string | null
          unidad: string
          uso_caducado_autorizado: boolean
        }
        Insert: {
          anulado?: boolean
          autorizado_en?: string | null
          autorizado_por?: string | null
          bodega_id: string
          cantidad: number
          contrato_compra_id?: string | null
          contrato_venta_id?: string | null
          created_at?: string
          created_by: string
          deposito_id?: string | null
          elaboracion_id?: string | null
          fecha?: string
          hora?: string
          id?: string
          incidencia_id?: string | null
          lote_id: string
          motivo_anulacion?: string | null
          motivo_autorizacion?: string | null
          movimiento_id?: string | null
          observaciones?: string | null
          producto_id: string
          trabajador_id?: string | null
          trabajo_id?: string | null
          unidad: string
          uso_caducado_autorizado?: boolean
        }
        Update: {
          anulado?: boolean
          autorizado_en?: string | null
          autorizado_por?: string | null
          bodega_id?: string
          cantidad?: number
          contrato_compra_id?: string | null
          contrato_venta_id?: string | null
          created_at?: string
          created_by?: string
          deposito_id?: string | null
          elaboracion_id?: string | null
          fecha?: string
          hora?: string
          id?: string
          incidencia_id?: string | null
          lote_id?: string
          motivo_anulacion?: string | null
          motivo_autorizacion?: string | null
          movimiento_id?: string | null
          observaciones?: string | null
          producto_id?: string
          trabajador_id?: string | null
          trabajo_id?: string | null
          unidad?: string
          uso_caducado_autorizado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "consumos_producto_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_producto_elaboracion_id_fkey"
            columns: ["elaboracion_id"]
            isOneToOne: false
            referencedRelation: "elaboraciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_producto_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "producto_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_producto_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_producto_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_producto_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "stock_por_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "consumos_producto_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_compra: {
        Row: {
          bodega_id: string
          campana: string | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["contrato_estado"]
          fecha_contrato: string
          fecha_limite: string | null
          id: string
          litros_contratados: number
          litros_pendientes: number | null
          litros_retirados: number
          numero_contrato: string
          observaciones: string | null
          precio: number | null
          producto_id: string | null
          proveedor_id: string | null
          updated_at: string
        }
        Insert: {
          bodega_id: string
          campana?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["contrato_estado"]
          fecha_contrato?: string
          fecha_limite?: string | null
          id?: string
          litros_contratados: number
          litros_pendientes?: number | null
          litros_retirados?: number
          numero_contrato: string
          observaciones?: string | null
          precio?: number | null
          producto_id?: string | null
          proveedor_id?: string | null
          updated_at?: string
        }
        Update: {
          bodega_id?: string
          campana?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["contrato_estado"]
          fecha_contrato?: string
          fecha_limite?: string | null
          id?: string
          litros_contratados?: number
          litros_pendientes?: number | null
          litros_retirados?: number
          numero_contrato?: string
          observaciones?: string | null
          precio?: number | null
          producto_id?: string | null
          proveedor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_compra_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_compra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_comerciales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_venta: {
        Row: {
          bodega_id: string
          campana: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["contrato_estado"]
          fecha_contrato: string
          fecha_limite: string | null
          id: string
          litros_contratados: number
          litros_pendientes: number | null
          litros_servidos: number
          numero_contrato: string
          observaciones: string | null
          precio: number | null
          producto_id: string | null
          updated_at: string
        }
        Insert: {
          bodega_id: string
          campana?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["contrato_estado"]
          fecha_contrato?: string
          fecha_limite?: string | null
          id?: string
          litros_contratados: number
          litros_pendientes?: number | null
          litros_servidos?: number
          numero_contrato: string
          observaciones?: string | null
          precio?: number | null
          producto_id?: string | null
          updated_at?: string
        }
        Update: {
          bodega_id?: string
          campana?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["contrato_estado"]
          fecha_contrato?: string
          fecha_limite?: string | null
          id?: string
          litros_contratados?: number
          litros_pendientes?: number | null
          litros_servidos?: number
          numero_contrato?: string
          observaciones?: string | null
          precio?: number | null
          producto_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_venta_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_venta_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_comerciales"
            referencedColumns: ["id"]
          },
        ]
      }
      elaboracion_depositos: {
        Row: {
          deposito_codigo: string
          elaboracion_id: string
          id: string
          litros: number
          variedad: string | null
          zona: string | null
        }
        Insert: {
          deposito_codigo: string
          elaboracion_id: string
          id?: string
          litros: number
          variedad?: string | null
          zona?: string | null
        }
        Update: {
          deposito_codigo?: string
          elaboracion_id?: string
          id?: string
          litros?: number
          variedad?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elaboracion_depositos_elaboracion_id_fkey"
            columns: ["elaboracion_id"]
            isOneToOne: false
            referencedRelation: "elaboraciones"
            referencedColumns: ["id"]
          },
        ]
      }
      elaboracion_productos: {
        Row: {
          cantidad: number
          elaboracion_id: string
          id: string
          lote: string
          observaciones: string | null
          producto_id: string
          unidad: string
        }
        Insert: {
          cantidad: number
          elaboracion_id: string
          id?: string
          lote: string
          observaciones?: string | null
          producto_id: string
          unidad?: string
        }
        Update: {
          cantidad?: number
          elaboracion_id?: string
          id?: string
          lote?: string
          observaciones?: string | null
          producto_id?: string
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "elaboracion_productos_elaboracion_id_fkey"
            columns: ["elaboracion_id"]
            isOneToOne: false
            referencedRelation: "elaboraciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaboracion_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaboracion_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "stock_por_producto"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      elaboraciones: {
        Row: {
          bodega_id: string
          created_at: string
          created_by: string
          fecha: string
          id: string
          lote_embotellado: string | null
          nombre: string
          observaciones: string | null
          trabajo_id: string
        }
        Insert: {
          bodega_id: string
          created_at?: string
          created_by: string
          fecha?: string
          id?: string
          lote_embotellado?: string | null
          nombre: string
          observaciones?: string | null
          trabajo_id: string
        }
        Update: {
          bodega_id?: string
          created_at?: string
          created_by?: string
          fecha?: string
          id?: string
          lote_embotellado?: string | null
          nombre?: string
          observaciones?: string | null
          trabajo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elaboraciones_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
            referencedColumns: ["id"]
          },
        ]
      }
      familias_recetas: {
        Row: {
          bodega_id: string
          color: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          bodega_id: string
          color?: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          bodega_id?: string
          color?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
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
      movimiento_lineas: {
        Row: {
          bodega_id: string
          created_at: string
          created_by: string
          deposito_id: string
          grado: number | null
          id: string
          litros: number
          movimiento_id: string
          observaciones: string | null
          producto_id: string | null
          rol: string
        }
        Insert: {
          bodega_id: string
          created_at?: string
          created_by?: string
          deposito_id: string
          grado?: number | null
          id?: string
          litros: number
          movimiento_id: string
          observaciones?: string | null
          producto_id?: string | null
          rol: string
        }
        Update: {
          bodega_id?: string
          created_at?: string
          created_by?: string
          deposito_id?: string
          grado?: number | null
          id?: string
          litros?: number
          movimiento_id?: string
          observaciones?: string | null
          producto_id?: string | null
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_lineas_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_lineas_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_comerciales"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          alcohol_absoluto: number | null
          anulado_en: string | null
          anulado_por: string | null
          bodega_id: string
          contrato_compra_id: string | null
          contrato_venta_id: string | null
          corregido_en: string | null
          corregido_por: string | null
          created_at: string
          created_by: string | null
          deposito_destino_id: string | null
          deposito_origen_id: string | null
          elaboracion_id: string | null
          estado_movimiento: Database["public"]["Enums"]["movimiento_estado"]
          fecha: string
          grado: number | null
          hora: string
          id: string
          incidencia_id: string | null
          litros: number
          lote_id: string | null
          motivo_anulacion: string | null
          motivo_correccion: string | null
          movimiento_original_id: string | null
          observaciones: string | null
          producto_id: string | null
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          trabajo_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alcohol_absoluto?: number | null
          anulado_en?: string | null
          anulado_por?: string | null
          bodega_id: string
          contrato_compra_id?: string | null
          contrato_venta_id?: string | null
          corregido_en?: string | null
          corregido_por?: string | null
          created_at?: string
          created_by?: string | null
          deposito_destino_id?: string | null
          deposito_origen_id?: string | null
          elaboracion_id?: string | null
          estado_movimiento?: Database["public"]["Enums"]["movimiento_estado"]
          fecha?: string
          grado?: number | null
          hora?: string
          id?: string
          incidencia_id?: string | null
          litros: number
          lote_id?: string | null
          motivo_anulacion?: string | null
          motivo_correccion?: string | null
          movimiento_original_id?: string | null
          observaciones?: string | null
          producto_id?: string | null
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          trabajo_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alcohol_absoluto?: number | null
          anulado_en?: string | null
          anulado_por?: string | null
          bodega_id?: string
          contrato_compra_id?: string | null
          contrato_venta_id?: string | null
          corregido_en?: string | null
          corregido_por?: string | null
          created_at?: string
          created_by?: string | null
          deposito_destino_id?: string | null
          deposito_origen_id?: string | null
          elaboracion_id?: string | null
          estado_movimiento?: Database["public"]["Enums"]["movimiento_estado"]
          fecha?: string
          grado?: number | null
          hora?: string
          id?: string
          incidencia_id?: string | null
          litros?: number
          lote_id?: string | null
          motivo_anulacion?: string | null
          motivo_correccion?: string | null
          movimiento_original_id?: string | null
          observaciones?: string | null
          producto_id?: string | null
          tipo?: Database["public"]["Enums"]["movimiento_tipo"]
          trabajo_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contrato_compra_fkey"
            columns: ["contrato_compra_id"]
            isOneToOne: false
            referencedRelation: "contratos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contrato_venta_fkey"
            columns: ["contrato_venta_id"]
            isOneToOne: false
            referencedRelation: "contratos_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_elaboracion_id_fkey"
            columns: ["elaboracion_id"]
            isOneToOne: false
            referencedRelation: "elaboraciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_movimiento_original_id_fkey"
            columns: ["movimiento_original_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_comerciales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
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
      perfiles_auditoria: {
        Row: {
          bodega_id: string
          campos_visibles: Json
          created_at: string
          created_by: string
          descripcion: string | null
          es_predeterminado: boolean
          filtros: Json
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          bodega_id: string
          campos_visibles?: Json
          created_at?: string
          created_by?: string
          descripcion?: string | null
          es_predeterminado?: boolean
          filtros?: Json
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          bodega_id?: string
          campos_visibles?: Json
          created_at?: string
          created_by?: string
          descripcion?: string | null
          es_predeterminado?: boolean
          filtros?: Json
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_auditoria_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
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
      preparaciones: {
        Row: {
          bodega_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          nombre: string
          notas: string | null
          productos: Json
          updated_at: string
          vinos: Json
        }
        Insert: {
          bodega_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          notas?: string | null
          productos?: Json
          updated_at?: string
          vinos?: Json
        }
        Update: {
          bodega_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          productos?: Json
          updated_at?: string
          vinos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "preparaciones_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_lotes: {
        Row: {
          bodega_id: string
          cantidad_disponible: number
          cantidad_inicial: number
          coste_unitario: number | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["lote_estado"]
          fecha_caducidad: string | null
          fecha_recepcion: string | null
          id: string
          motivo_bloqueo: string | null
          numero_lote: string
          observaciones: string | null
          producto_id: string
          proveedor: string | null
          ubicacion: string | null
          unidad: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bodega_id: string
          cantidad_disponible: number
          cantidad_inicial: number
          coste_unitario?: number | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["lote_estado"]
          fecha_caducidad?: string | null
          fecha_recepcion?: string | null
          id?: string
          motivo_bloqueo?: string | null
          numero_lote: string
          observaciones?: string | null
          producto_id: string
          proveedor?: string | null
          ubicacion?: string | null
          unidad?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bodega_id?: string
          cantidad_disponible?: number
          cantidad_inicial?: number
          coste_unitario?: number | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["lote_estado"]
          fecha_caducidad?: string | null
          fecha_recepcion?: string | null
          id?: string
          motivo_bloqueo?: string | null
          numero_lote?: string
          observaciones?: string | null
          producto_id?: string
          proveedor?: string | null
          ubicacion?: string | null
          unidad?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_lotes_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_lotes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_lotes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "stock_por_producto"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          bodega_id: string
          categoria: Database["public"]["Enums"]["producto_categoria"] | null
          created_at: string
          created_by: string
          fabricante: string | null
          fecha_caducidad: string | null
          ficha_seguridad_url: string | null
          ficha_tecnica_url: string | null
          id: string
          lote: string | null
          nombre: string
          observaciones: string | null
          proveedor: string | null
          referencia: string | null
          stock_critico: number | null
          stock_minimo: number | null
          tipo: Database["public"]["Enums"]["producto_tipo"]
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bodega_id: string
          categoria?: Database["public"]["Enums"]["producto_categoria"] | null
          created_at?: string
          created_by: string
          fabricante?: string | null
          fecha_caducidad?: string | null
          ficha_seguridad_url?: string | null
          ficha_tecnica_url?: string | null
          id?: string
          lote?: string | null
          nombre: string
          observaciones?: string | null
          proveedor?: string | null
          referencia?: string | null
          stock_critico?: number | null
          stock_minimo?: number | null
          tipo?: Database["public"]["Enums"]["producto_tipo"]
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bodega_id?: string
          categoria?: Database["public"]["Enums"]["producto_categoria"] | null
          created_at?: string
          created_by?: string
          fabricante?: string | null
          fecha_caducidad?: string | null
          ficha_seguridad_url?: string | null
          ficha_tecnica_url?: string | null
          id?: string
          lote?: string | null
          nombre?: string
          observaciones?: string | null
          proveedor?: string | null
          referencia?: string | null
          stock_critico?: number | null
          stock_minimo?: number | null
          tipo?: Database["public"]["Enums"]["producto_tipo"]
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      productos_comerciales: {
        Row: {
          activo: boolean
          bodega_id: string
          campaña: string | null
          codigo: string
          color: string | null
          created_at: string
          created_by: string | null
          grado_referencia: number | null
          id: string
          nombre: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bodega_id: string
          campaña?: string | null
          codigo: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          grado_referencia?: number | null
          id?: string
          nombre: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bodega_id?: string
          campaña?: string | null
          codigo?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          grado_referencia?: number | null
          id?: string
          nombre?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_comerciales_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
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
      proveedores: {
        Row: {
          activo: boolean
          bodega_id: string
          cif_nif: string | null
          created_at: string
          created_by: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          observaciones: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bodega_id: string
          cif_nif?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          observaciones?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bodega_id?: string
          cif_nif?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          observaciones?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
        ]
      }
      receta_depositos: {
        Row: {
          deposito_codigo: string
          id: string
          litros: number | null
          observaciones: string | null
          orden: number
          receta_id: string
          variedad: string | null
          zona_id: string | null
        }
        Insert: {
          deposito_codigo: string
          id?: string
          litros?: number | null
          observaciones?: string | null
          orden?: number
          receta_id: string
          variedad?: string | null
          zona_id?: string | null
        }
        Update: {
          deposito_codigo?: string
          id?: string
          litros?: number | null
          observaciones?: string | null
          orden?: number
          receta_id?: string
          variedad?: string | null
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receta_depositos_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
        ]
      }
      receta_pasos: {
        Row: {
          id: string
          orden: number
          receta_id: string
          texto: string
        }
        Insert: {
          id?: string
          orden?: number
          receta_id: string
          texto: string
        }
        Update: {
          id?: string
          orden?: number
          receta_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "receta_pasos_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
        ]
      }
      receta_productos: {
        Row: {
          dosis: number | null
          id: string
          lote: string
          observaciones: string | null
          orden: number
          producto_id: string
          receta_id: string
          unidad: string
        }
        Insert: {
          dosis?: number | null
          id?: string
          lote: string
          observaciones?: string | null
          orden?: number
          producto_id: string
          receta_id: string
          unidad?: string
        }
        Update: {
          dosis?: number | null
          id?: string
          lote?: string
          observaciones?: string | null
          orden?: number
          producto_id?: string
          receta_id?: string
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "receta_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receta_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "stock_por_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "receta_productos_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
        ]
      }
      recetas: {
        Row: {
          activa: boolean
          bodega_id: string
          created_at: string
          created_by: string
          descripcion: string | null
          familia_id: string | null
          favorita: boolean
          id: string
          nombre: string
          observaciones: string | null
          parent_id: string | null
          tipo: string | null
          ultimo_uso_at: string | null
          updated_at: string
          uso_count: number
          version: number
        }
        Insert: {
          activa?: boolean
          bodega_id: string
          created_at?: string
          created_by: string
          descripcion?: string | null
          familia_id?: string | null
          favorita?: boolean
          id?: string
          nombre: string
          observaciones?: string | null
          parent_id?: string | null
          tipo?: string | null
          ultimo_uso_at?: string | null
          updated_at?: string
          uso_count?: number
          version?: number
        }
        Update: {
          activa?: boolean
          bodega_id?: string
          created_at?: string
          created_by?: string
          descripcion?: string | null
          familia_id?: string | null
          favorita?: boolean
          id?: string
          nombre?: string
          observaciones?: string | null
          parent_id?: string | null
          tipo?: string | null
          ultimo_uso_at?: string | null
          updated_at?: string
          uso_count?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recetas_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_recetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recetas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
        ]
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
      trabajo_asignados: {
        Row: {
          rol: string
          trabajo_id: string
          user_id: string
        }
        Insert: {
          rol?: string
          trabajo_id: string
          user_id: string
        }
        Update: {
          rol?: string
          trabajo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajo_asignados_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
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
      trabajo_trabajadores: {
        Row: {
          bodega_id: string
          confirmado_por_trabajador: boolean
          created_at: string
          created_by: string | null
          estado_participacion: Database["public"]["Enums"]["participacion_estado"]
          fecha_confirmacion: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          movimiento_id: string | null
          observaciones: string | null
          proceso_id: string | null
          rol_en_trabajo: string | null
          trabajador_id: string
          trabajo_id: string
          updated_at: string
        }
        Insert: {
          bodega_id: string
          confirmado_por_trabajador?: boolean
          created_at?: string
          created_by?: string | null
          estado_participacion?: Database["public"]["Enums"]["participacion_estado"]
          fecha_confirmacion?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          movimiento_id?: string | null
          observaciones?: string | null
          proceso_id?: string | null
          rol_en_trabajo?: string | null
          trabajador_id: string
          trabajo_id: string
          updated_at?: string
        }
        Update: {
          bodega_id?: string
          confirmado_por_trabajador?: boolean
          created_at?: string
          created_by?: string | null
          estado_participacion?: Database["public"]["Enums"]["participacion_estado"]
          fecha_confirmacion?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          movimiento_id?: string | null
          observaciones?: string | null
          proceso_id?: string | null
          rol_en_trabajo?: string | null
          trabajador_id?: string
          trabajo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajo_trabajadores_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajo_trabajadores_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajo_trabajadores_trabajo_id_fkey"
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
      existencias_actuales: {
        Row: {
          alcohol_absoluto: number | null
          bodega_id: string | null
          deposito_id: string | null
          grado_medio: number | null
          litros: number | null
          producto_id: string | null
        }
        Relationships: []
      }
      existencias_por_producto: {
        Row: {
          alcohol_absoluto: number | null
          bodega_id: string | null
          grado_medio: number | null
          litros: number | null
          producto_id: string | null
        }
        Relationships: []
      }
      stock_por_producto: {
        Row: {
          bodega_id: string | null
          categoria: Database["public"]["Enums"]["producto_categoria"] | null
          lotes_activos: number | null
          lotes_caducados: number | null
          nombre: string | null
          producto_id: string | null
          proxima_caducidad: string | null
          stock_critico: number | null
          stock_disponible: number | null
          stock_minimo: number | null
          unidad: string | null
        }
        Relationships: []
      }
      v_contratos_compra_pendientes: {
        Row: {
          bodega_id: string | null
          campana: string | null
          litros_pendientes: number | null
          n_contratos: number | null
          producto_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_compra_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_compra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_comerciales"
            referencedColumns: ["id"]
          },
        ]
      }
      v_contratos_venta_pendientes: {
        Row: {
          bodega_id: string | null
          campana: string | null
          litros_pendientes: number | null
          n_contratos: number | null
          producto_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_venta_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_venta_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_comerciales"
            referencedColumns: ["id"]
          },
        ]
      }
      v_posicion_comercial: {
        Row: {
          alcohol_absoluto: number | null
          bodega_id: string | null
          campana: string | null
          codigo: string | null
          color: string | null
          compras_pendientes: number | null
          disponible_comercial: number | null
          grado_referencia: number | null
          litros_existencia: number | null
          producto_id: string | null
          producto_nombre: string | null
          tipo: string | null
          ventas_pendientes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_rectify_movimientos: { Args: { _bodega: string }; Returns: boolean }
      current_user_bodegas: { Args: never; Returns: string[] }
      has_permission: {
        Args: { _bodega: string; _perm: string }
        Returns: boolean
      }
      is_bodega_admin: { Args: { _bodega: string }; Returns: boolean }
      marcar_lotes_caducados: { Args: never; Returns: number }
      recalcular_contrato_compra: { Args: { _id: string }; Returns: undefined }
      recalcular_contrato_venta: { Args: { _id: string }; Returns: undefined }
      user_bodegas: { Args: { _user: string }; Returns: string[] }
    }
    Enums: {
      analitica_estado: "conforme" | "no_conforme" | "pendiente"
      calendario_estado:
        | "programado"
        | "en_proceso"
        | "completado"
        | "cancelado"
        | "retrasado"
      calendario_prioridad: "baja" | "normal" | "alta" | "critica"
      calendario_tipo:
        | "carga"
        | "descarga"
        | "trabajo"
        | "limpieza"
        | "trasiego"
        | "mezcla"
        | "embotellado"
        | "expedicion"
        | "mantenimiento"
        | "incidencia"
        | "recordatorio"
        | "auditoria"
        | "analisis"
      contrato_estado: "pendiente" | "parcial" | "completado" | "cancelado"
      lote_estado: "disponible" | "agotado" | "caducado" | "bloqueado"
      membership_estado: "activo" | "inactivo" | "suspendido" | "rechazado"
      mensaje_canal: "general" | "deposito" | "trabajo"
      movimiento_estado: "activo" | "corregido" | "anulado"
      movimiento_tipo:
        | "entrada"
        | "salida"
        | "trasiego"
        | "mezcla"
        | "embotellado"
        | "correccion"
        | "ajuste"
      participacion_estado:
        | "asignado"
        | "en_proceso"
        | "finalizado"
        | "ausente"
        | "rechazado"
      producto_categoria:
        | "levaduras"
        | "nutrientes"
        | "clarificantes"
        | "estabilizantes"
        | "enzimas"
        | "limpieza"
        | "laboratorio"
        | "aditivos"
        | "consumibles"
        | "otro"
      producto_tipo: "enologico" | "limpieza" | "otro"
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
      analitica_estado: ["conforme", "no_conforme", "pendiente"],
      calendario_estado: [
        "programado",
        "en_proceso",
        "completado",
        "cancelado",
        "retrasado",
      ],
      calendario_prioridad: ["baja", "normal", "alta", "critica"],
      calendario_tipo: [
        "carga",
        "descarga",
        "trabajo",
        "limpieza",
        "trasiego",
        "mezcla",
        "embotellado",
        "expedicion",
        "mantenimiento",
        "incidencia",
        "recordatorio",
        "auditoria",
        "analisis",
      ],
      contrato_estado: ["pendiente", "parcial", "completado", "cancelado"],
      lote_estado: ["disponible", "agotado", "caducado", "bloqueado"],
      membership_estado: ["activo", "inactivo", "suspendido", "rechazado"],
      mensaje_canal: ["general", "deposito", "trabajo"],
      movimiento_estado: ["activo", "corregido", "anulado"],
      movimiento_tipo: [
        "entrada",
        "salida",
        "trasiego",
        "mezcla",
        "embotellado",
        "correccion",
        "ajuste",
      ],
      participacion_estado: [
        "asignado",
        "en_proceso",
        "finalizado",
        "ausente",
        "rechazado",
      ],
      producto_categoria: [
        "levaduras",
        "nutrientes",
        "clarificantes",
        "estabilizantes",
        "enzimas",
        "limpieza",
        "laboratorio",
        "aditivos",
        "consumibles",
        "otro",
      ],
      producto_tipo: ["enologico", "limpieza", "otro"],
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
