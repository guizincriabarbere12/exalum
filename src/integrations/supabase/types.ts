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
      clientes: {
        Row: {
          cpf_cnpj: string
          created_at: string | null
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cpf_cnpj: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cpf_cnpj?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome_empresa: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque: {
        Row: {
          id: string
          produto_id: string
          quantidade: number
          quantidade_minima: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          produto_id: string
          quantidade?: number
          quantidade_minima?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          produto_id?: string
          quantidade?: number
          quantidade_minima?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          cnpj: string
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kit_itens: {
        Row: {
          created_at: string | null
          id: string
          kit_id: string
          produto_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          kit_id: string
          produto_id: string
          quantidade: number
        }
        Update: {
          created_at?: string | null
          id?: string
          kit_id?: string
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          preco_venda: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          preco_venda: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          preco_venda?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      movimentacao_estoque: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          tipo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade: number
          tipo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacao_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          created_at: string | null
          id: string
          orcamento_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          orcamento_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          orcamento_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string
          created_at: string | null
          created_by: string | null
          id: string
          numero: string
          observacoes: string | null
          status: string
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_confirmacao: string | null
          data_entrega: string | null
          data_envio: string | null
          data_pedido: string
          id: string
          numero: string
          observacoes: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_confirmacao?: string | null
          data_entrega?: string | null
          data_envio?: string | null
          data_pedido?: string
          id?: string
          numero: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_confirmacao?: string | null
          data_entrega?: string | null
          data_envio?: string | null
          data_pedido?: string
          id?: string
          numero?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          codigo: string
          cor: string | null
          created_at: string | null
          created_by: string | null
          descricao: string
          imagem_url: string | null
          id: string
          liga: string | null
          localizacao: string | null
          peso: number | null
          preco_custo: number | null
          preco_por_kg: number | null
          preco_venda: number
          tipo: string | null
          unidade: string
          updated_at: string | null
        }
        Insert: {
          codigo: string
          cor?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao: string
          imagem_url?: string | null
          id?: string
          liga?: string | null
          localizacao?: string | null
          peso?: number | null
          preco_custo?: number | null
          preco_por_kg?: number | null
          preco_venda: number
          tipo?: string | null
          unidade?: string
          updated_at?: string | null
        }
        Update: {
          codigo?: string
          cor?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          imagem_url?: string | null
          id?: string
          liga?: string | null
          localizacao?: string | null
          peso?: number | null
          preco_custo?: number | null
          preco_por_kg?: number | null
          preco_venda?: number
          tipo?: string | null
          unidade?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transacoes_financeiras: {
        Row: {
          categoria: string | null
          created_at: string | null
          created_by: string | null
          data: string
          descricao: string
          id: string
          status: string
          tipo: string
          updated_at: string | null
          valor: number
          venda_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          descricao: string
          id?: string
          status?: string
          tipo: string
          updated_at?: string | null
          valor: number
          venda_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          status?: string
          tipo?: string
          updated_at?: string | null
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_financeiras_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          created_at: string | null
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_id: string
          created_at: string | null
          created_by: string | null
          id: string
          numero: string
          observacoes: string | null
          orcamento_id: string | null
          status: string
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          orcamento_id?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          orcamento_id?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_kit_availability: {
        Args: { kit_id_param: string }
        Returns: {
          disponivel: number
          faltando: number
          necessario: number
          produto_id: string
          produto_nome: string
        }[]
      }
      check_pedido_availability: {
        Args: { pedido_id_param: string }
        Returns: {
          disponivel: number
          faltando: number
          necessario: number
          produto_id: string
          produto_nome: string
        }[]
      }
      gerar_numero_orcamento: { Args: never; Returns: string }
      gerar_numero_pedido: { Args: never; Returns: string }
      get_dashboard_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      processar_orcamento_aprovado: {
        Args: { orcamento_id_param: string }
        Returns: Json
      }
      processar_pedido: { Args: { pedido_id_param: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
