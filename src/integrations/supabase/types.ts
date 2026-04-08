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
      assignment_audit_log: {
        Row: {
          after_state: Json | null
          before_state: Json | null
          change_type: string
          changed_by: string | null
          created_at: string
          date: string | null
          id: string
          project_id: string | null
          reason: string | null
        }
        Insert: {
          after_state?: Json | null
          before_state?: Json | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          date?: string | null
          id?: string
          project_id?: string | null
          reason?: string | null
        }
        Update: {
          after_state?: Json | null
          before_state?: Json | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          date?: string | null
          id?: string
          project_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          break_end_time: string | null
          break_minutes: number | null
          break_start_time: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          is_manual_override: boolean | null
          notes: string | null
          office_punch_in: string | null
          office_punch_in_accuracy: number | null
          office_punch_in_distance_m: number | null
          office_punch_in_lat: number | null
          office_punch_in_lng: number | null
          office_punch_in_spoofed: boolean | null
          office_punch_in_valid: boolean | null
          office_punch_out: string | null
          override_by: string | null
          override_reason: string | null
          overtime_cost: number | null
          overtime_minutes: number | null
          project_id: string | null
          regular_cost: number | null
          site_arrival_distance_m: number | null
          site_arrival_lat: number | null
          site_arrival_lng: number | null
          site_arrival_time: string | null
          site_arrival_valid: boolean | null
          total_work_minutes: number | null
          travel_start_lat: number | null
          travel_start_lng: number | null
          travel_start_time: string | null
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          is_manual_override?: boolean | null
          notes?: string | null
          office_punch_in?: string | null
          office_punch_in_accuracy?: number | null
          office_punch_in_distance_m?: number | null
          office_punch_in_lat?: number | null
          office_punch_in_lng?: number | null
          office_punch_in_spoofed?: boolean | null
          office_punch_in_valid?: boolean | null
          office_punch_out?: string | null
          override_by?: string | null
          override_reason?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          project_id?: string | null
          regular_cost?: number | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          total_work_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_manual_override?: boolean | null
          notes?: string | null
          office_punch_in?: string | null
          office_punch_in_accuracy?: number | null
          office_punch_in_distance_m?: number | null
          office_punch_in_lat?: number | null
          office_punch_in_lng?: number | null
          office_punch_in_spoofed?: boolean | null
          office_punch_in_valid?: boolean | null
          office_punch_out?: string | null
          override_by?: string | null
          override_reason?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          project_id?: string | null
          regular_cost?: number | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          total_work_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_branches_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_team_overrides: {
        Row: {
          action: Database["public"]["Enums"]["override_action"]
          apply_to: string
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          project_id: string
          reason: string | null
          replacement_employee_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["override_action"]
          apply_to?: string
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          project_id: string
          reason?: string | null
          replacement_employee_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["override_action"]
          apply_to?: string
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          project_id?: string
          reason?: string | null
          replacement_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_team_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_overrides_replacement_employee_id_fkey"
            columns: ["replacement_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leave: {
        Row: {
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_id: string | null
          branch_id: string
          created_at: string
          designation: string | null
          email: string | null
          emergency_contact: string | null
          employee_code: string
          hourly_rate: number
          id: string
          is_active: boolean
          join_date: string | null
          name: string
          notes: string | null
          overtime_rate: number
          phone: string | null
          skill_type: Database["public"]["Enums"]["skill_type"]
          standard_hours_per_day: number
        }
        Insert: {
          auth_id?: string | null
          branch_id: string
          created_at?: string
          designation?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          join_date?: string | null
          name: string
          notes?: string | null
          overtime_rate?: number
          phone?: string | null
          skill_type?: Database["public"]["Enums"]["skill_type"]
          standard_hours_per_day?: number
        }
        Update: {
          auth_id?: string | null
          branch_id?: string
          created_at?: string
          designation?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          join_date?: string | null
          name?: string
          notes?: string | null
          overtime_rate?: number
          phone?: string | null
          skill_type?: Database["public"]["Enums"]["skill_type"]
          standard_hours_per_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          priority: Database["public"]["Enums"]["notification_priority"]
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          branch_id: string
          created_at: string
          gps_radius_meters: number
          id: string
          latitude: number | null
          longitude: number | null
          name: string
        }
        Insert: {
          address?: string | null
          branch_id: string
          created_at?: string
          gps_radius_meters?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
        }
        Update: {
          address?: string | null
          branch_id?: string
          created_at?: string
          gps_radius_meters?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "offices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          assigned_by: string | null
          assignment_mode: Database["public"]["Enums"]["assignment_mode"]
          auto_score: Json | null
          created_at: string
          date: string
          employee_id: string
          id: string
          is_locked: boolean
          project_id: string
          shift_end: string | null
          shift_start: string | null
        }
        Insert: {
          assigned_by?: string | null
          assignment_mode?: Database["public"]["Enums"]["assignment_mode"]
          auto_score?: Json | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          is_locked?: boolean
          project_id: string
          shift_end?: string | null
          shift_start?: string | null
        }
        Update: {
          assigned_by?: string | null
          assignment_mode?: Database["public"]["Enums"]["assignment_mode"]
          auto_score?: Json | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_locked?: boolean
          project_id?: string
          shift_end?: string | null
          shift_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          added_by: string | null
          amount: number
          amount_aed: number | null
          approval_notes: string | null
          approved_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          date: string
          description: string | null
          due_date: string | null
          exchange_rate: number
          id: string
          invoice_number: string | null
          project_id: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["expense_status"]
          supplier_name: string | null
        }
        Insert: {
          added_by?: string | null
          amount: number
          amount_aed?: number | null
          approval_notes?: string | null
          approved_by?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          date: string
          description?: string | null
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_number?: string | null
          project_id: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          supplier_name?: string | null
        }
        Update: {
          added_by?: string | null
          amount?: number
          amount_aed?: number | null
          approval_notes?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_number?: string | null
          project_id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          cost_categories: Json | null
          created_at: string
          created_by: string | null
          default_duration_days: number | null
          id: string
          name: string
          required_helpers: number
          required_supervisors: number
          required_technicians: number
        }
        Insert: {
          cost_categories?: Json | null
          created_at?: string
          created_by?: string | null
          default_duration_days?: number | null
          id?: string
          name: string
          required_helpers?: number
          required_supervisors?: number
          required_technicians?: number
        }
        Update: {
          cost_categories?: Json | null
          created_at?: string
          created_by?: string | null
          default_duration_days?: number | null
          id?: string
          name?: string
          required_helpers?: number
          required_supervisors?: number
          required_technicians?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          branch_id: string
          budget: number | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          health_score: number | null
          id: string
          name: string
          notes: string | null
          project_value: number | null
          required_helpers: number
          required_supervisors: number
          required_technicians: number
          site_address: string | null
          site_gps_radius: number
          site_latitude: number | null
          site_longitude: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          template_id: string | null
        }
        Insert: {
          branch_id: string
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          health_score?: number | null
          id?: string
          name: string
          notes?: string | null
          project_value?: number | null
          required_helpers?: number
          required_supervisors?: number
          required_technicians?: number
          site_address?: string | null
          site_gps_radius?: number
          site_latitude?: number | null
          site_longitude?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
        }
        Update: {
          branch_id?: string
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          health_score?: number | null
          id?: string
          name?: string
          notes?: string | null
          project_value?: number | null
          required_helpers?: number
          required_supervisors?: number
          required_technicians?: number
          site_address?: string | null
          site_gps_radius?: number
          site_latitude?: number | null
          site_longitude?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_presets: {
        Row: {
          created_at: string
          email_recipients: string[] | null
          filters: Json | null
          id: string
          name: string
          report_type: string
          schedule: Database["public"]["Enums"]["report_schedule"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email_recipients?: string[] | null
          filters?: Json | null
          id?: string
          name: string
          report_type: string
          schedule?: Database["public"]["Enums"]["report_schedule"]
          user_id: string
        }
        Update: {
          created_at?: string
          email_recipients?: string[] | null
          filters?: Json | null
          id?: string
          name?: string
          report_type?: string
          schedule?: Database["public"]["Enums"]["report_schedule"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          module: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          is_encrypted: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          is_encrypted?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          is_encrypted?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: string | null
          module: string
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          module: string
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          module?: string
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_approvals: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          created_at: string
          days_worked: number | null
          employee_id: string
          id: string
          month: string
          status: string
          total_hours: number | null
          total_ot_cost: number | null
          total_ot_hours: number | null
          total_regular_cost: number | null
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          created_at?: string
          days_worked?: number | null
          employee_id: string
          id?: string
          month: string
          status?: string
          total_hours?: number | null
          total_ot_cost?: number | null
          total_ot_hours?: number | null
          total_regular_cost?: number | null
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          created_at?: string
          days_worked?: number | null
          employee_id?: string
          id?: string
          month?: string
          status?: string
          total_hours?: number | null
          total_ot_cost?: number | null
          total_ot_hours?: number | null
          total_regular_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_approvals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          name: string
          preferences: Json | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name: string
          preferences?: Json | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string
          preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_branch_id: { Args: never; Returns: string }
      get_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      update_absent_check_cron: {
        Args: { cron_expr: string }
        Returns: undefined
      }
      update_morning_briefing_cron: {
        Args: { cron_expr: string }
        Returns: undefined
      }
    }
    Enums: {
      assignment_mode: "manual" | "auto" | "hybrid"
      expense_category:
        | "labor"
        | "overtime"
        | "travel"
        | "material"
        | "transport"
        | "equipment"
        | "misc"
      expense_status: "pending" | "approved" | "rejected"
      notification_priority: "low" | "normal" | "high" | "critical"
      override_action: "absent" | "replaced" | "added" | "removed"
      project_status: "planned" | "assigned" | "in_progress" | "completed"
      report_schedule: "none" | "daily" | "weekly" | "monthly"
      skill_type: "technician" | "helper" | "team_leader"
      user_role: "admin" | "manager" | "team_leader"
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
      assignment_mode: ["manual", "auto", "hybrid"],
      expense_category: [
        "labor",
        "overtime",
        "travel",
        "material",
        "transport",
        "equipment",
        "misc",
      ],
      expense_status: ["pending", "approved", "rejected"],
      notification_priority: ["low", "normal", "high", "critical"],
      override_action: ["absent", "replaced", "added", "removed"],
      project_status: ["planned", "assigned", "in_progress", "completed"],
      report_schedule: ["none", "daily", "weekly", "monthly"],
      skill_type: ["technician", "helper", "team_leader"],
      user_role: ["admin", "manager", "team_leader"],
    },
  },
} as const
