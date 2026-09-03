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
          auto_closed_by_user: boolean
          break_end_time: string | null
          break_minutes: number | null
          break_start_time: string | null
          created_at: string
          date: string
          derived_break_minutes: number | null
          derived_computed_at: string | null
          derived_idle_minutes: number | null
          derived_overtime_minutes: number | null
          derived_travel_minutes: number | null
          derived_worked_minutes: number | null
          employee_id: string
          holiday_premium_cost: number | null
          id: string
          idempotency_key: string | null
          is_absent: boolean
          is_holiday: boolean
          is_incomplete_process: boolean
          is_manual_override: boolean | null
          notes: string | null
          office_arrival_accuracy: number | null
          office_arrival_distance_m: number | null
          office_arrival_lat: number | null
          office_arrival_lng: number | null
          office_arrival_time: string | null
          office_arrival_valid: boolean | null
          office_punch_in: string | null
          office_punch_in_accuracy: number | null
          office_punch_in_distance_m: number | null
          office_punch_in_lat: number | null
          office_punch_in_lng: number | null
          office_punch_in_spoofed: boolean | null
          office_punch_in_valid: boolean | null
          office_punch_out: string | null
          office_punch_out_accuracy: number | null
          office_punch_out_distance_m: number | null
          office_punch_out_lat: number | null
          office_punch_out_lng: number | null
          office_punch_out_valid: boolean | null
          override_by: string | null
          override_reason: string | null
          overtime_cost: number | null
          overtime_minutes: number | null
          project_id: string | null
          regular_cost: number | null
          return_travel_start_accuracy: number | null
          return_travel_start_lat: number | null
          return_travel_start_lng: number | null
          return_travel_start_time: string | null
          site_arrival_accuracy: number | null
          site_arrival_distance_m: number | null
          site_arrival_lat: number | null
          site_arrival_lng: number | null
          site_arrival_time: string | null
          site_arrival_valid: boolean | null
          total_work_minutes: number | null
          travel_start_accuracy: number | null
          travel_start_lat: number | null
          travel_start_lng: number | null
          travel_start_time: string | null
          verification_type: string | null
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          auto_closed_by_user?: boolean
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date: string
          derived_break_minutes?: number | null
          derived_computed_at?: string | null
          derived_idle_minutes?: number | null
          derived_overtime_minutes?: number | null
          derived_travel_minutes?: number | null
          derived_worked_minutes?: number | null
          employee_id: string
          holiday_premium_cost?: number | null
          id?: string
          idempotency_key?: string | null
          is_absent?: boolean
          is_holiday?: boolean
          is_incomplete_process?: boolean
          is_manual_override?: boolean | null
          notes?: string | null
          office_arrival_accuracy?: number | null
          office_arrival_distance_m?: number | null
          office_arrival_lat?: number | null
          office_arrival_lng?: number | null
          office_arrival_time?: string | null
          office_arrival_valid?: boolean | null
          office_punch_in?: string | null
          office_punch_in_accuracy?: number | null
          office_punch_in_distance_m?: number | null
          office_punch_in_lat?: number | null
          office_punch_in_lng?: number | null
          office_punch_in_spoofed?: boolean | null
          office_punch_in_valid?: boolean | null
          office_punch_out?: string | null
          office_punch_out_accuracy?: number | null
          office_punch_out_distance_m?: number | null
          office_punch_out_lat?: number | null
          office_punch_out_lng?: number | null
          office_punch_out_valid?: boolean | null
          override_by?: string | null
          override_reason?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          project_id?: string | null
          regular_cost?: number | null
          return_travel_start_accuracy?: number | null
          return_travel_start_lat?: number | null
          return_travel_start_lng?: number | null
          return_travel_start_time?: string | null
          site_arrival_accuracy?: number | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          total_work_minutes?: number | null
          travel_start_accuracy?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          verification_type?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          auto_closed_by_user?: boolean
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date?: string
          derived_break_minutes?: number | null
          derived_computed_at?: string | null
          derived_idle_minutes?: number | null
          derived_overtime_minutes?: number | null
          derived_travel_minutes?: number | null
          derived_worked_minutes?: number | null
          employee_id?: string
          holiday_premium_cost?: number | null
          id?: string
          idempotency_key?: string | null
          is_absent?: boolean
          is_holiday?: boolean
          is_incomplete_process?: boolean
          is_manual_override?: boolean | null
          notes?: string | null
          office_arrival_accuracy?: number | null
          office_arrival_distance_m?: number | null
          office_arrival_lat?: number | null
          office_arrival_lng?: number | null
          office_arrival_time?: string | null
          office_arrival_valid?: boolean | null
          office_punch_in?: string | null
          office_punch_in_accuracy?: number | null
          office_punch_in_distance_m?: number | null
          office_punch_in_lat?: number | null
          office_punch_in_lng?: number | null
          office_punch_in_spoofed?: boolean | null
          office_punch_in_valid?: boolean | null
          office_punch_out?: string | null
          office_punch_out_accuracy?: number | null
          office_punch_out_distance_m?: number | null
          office_punch_out_lat?: number | null
          office_punch_out_lng?: number | null
          office_punch_out_valid?: boolean | null
          override_by?: string | null
          override_reason?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          project_id?: string | null
          regular_cost?: number | null
          return_travel_start_accuracy?: number | null
          return_travel_start_lat?: number | null
          return_travel_start_lng?: number | null
          return_travel_start_time?: string | null
          site_arrival_accuracy?: number | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          total_work_minutes?: number | null
          travel_start_accuracy?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          verification_type?: string | null
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
      backfill_jobs: {
        Row: {
          created_at: string
          cursor_date: string | null
          dates_processed: number
          earliest_date: string | null
          id: string
          is_complete: boolean
          is_paused: boolean
          job_name: string
          last_error: string | null
          last_run_at: string | null
          lock_expires_at: string | null
          lock_owner: string | null
          pause_reason: string | null
          rows_processed: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor_date?: string | null
          dates_processed?: number
          earliest_date?: string | null
          id?: string
          is_complete?: boolean
          is_paused?: boolean
          job_name: string
          last_error?: string | null
          last_run_at?: string | null
          lock_expires_at?: string | null
          lock_owner?: string | null
          pause_reason?: string | null
          rows_processed?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor_date?: string | null
          dates_processed?: number
          earliest_date?: string | null
          id?: string
          is_complete?: boolean
          is_paused?: boolean
          job_name?: string
          last_error?: string | null
          last_run_at?: string | null
          lock_expires_at?: string | null
          lock_owner?: string | null
          pause_reason?: string | null
          rows_processed?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_branches_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      common_task_sessions: {
        Row: {
          attendance_log_id: string | null
          break_end_time: string | null
          break_minutes: number | null
          break_start_time: string | null
          common_task_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          overtime_cost: number | null
          overtime_minutes: number | null
          regular_cost: number | null
          status: string
          total_work_minutes: number | null
          updated_at: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          attendance_log_id?: string | null
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          common_task_id: string
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          notes?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          regular_cost?: number | null
          status?: string
          total_work_minutes?: number | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          attendance_log_id?: string | null
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          common_task_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          regular_cost?: number | null
          status?: string
          total_work_minutes?: number | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "common_task_sessions_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_task_sessions_common_task_id_fkey"
            columns: ["common_task_id"]
            isOneToOne: false
            referencedRelation: "common_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_task_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      common_tasks: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_seeded: boolean
          max_headcount: number
          priority: string
          status: Database["public"]["Enums"]["common_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_seeded?: boolean
          max_headcount?: number
          priority?: string
          status?: Database["public"]["Enums"]["common_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_seeded?: boolean
          max_headcount?: number
          priority?: string
          status?: Database["public"]["Enums"]["common_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          domain: string | null
          id: string
          is_active: boolean
          locale: string
          logo_url: string | null
          name: string
          plan: string
          primary_color: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          logo_url?: string | null
          name: string
          plan?: string
          primary_color?: string | null
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          logo_url?: string | null
          name?: string
          plan?: string
          primary_color?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_features: {
        Row: {
          company_id: string
          config: Json | null
          enabled: boolean
          id: string
          module: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json | null
          enabled?: boolean
          id?: string
          module: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json | null
          enabled?: boolean
          id?: string
          module?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          id: string
          is_encrypted: boolean
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          company_id: string
          id?: string
          is_encrypted?: boolean
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          is_encrypted?: boolean
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_skills: {
        Row: {
          base_skill_type: Database["public"]["Enums"]["skill_type"] | null
          created_at: string
          created_by: string | null
          holiday_rate_type: Database["public"]["Enums"]["holiday_rate_type"]
          holiday_rate_value: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          base_skill_type?: Database["public"]["Enums"]["skill_type"] | null
          created_at?: string
          created_by?: string | null
          holiday_rate_type?: Database["public"]["Enums"]["holiday_rate_type"]
          holiday_rate_value?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          base_skill_type?: Database["public"]["Enums"]["skill_type"] | null
          created_at?: string
          created_by?: string | null
          holiday_rate_type?: Database["public"]["Enums"]["holiday_rate_type"]
          holiday_rate_value?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_skills_created_by_fkey"
            columns: ["created_by"]
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
      device_tokens: {
        Row: {
          created_at: string
          device_info: string | null
          employee_id: string
          fcm_token: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          employee_id: string
          fcm_token: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          employee_id?: string
          fcm_token?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_trip_legs: {
        Row: {
          attendance_log_id: string | null
          created_at: string
          date: string
          driver_id: string
          id: string
          leg_end_lat: number | null
          leg_end_lng: number | null
          leg_end_time: string | null
          leg_number: number
          leg_type: Database["public"]["Enums"]["driver_leg_type"] | null
          notes: string | null
          project_id: string
          site_arrival_lat: number | null
          site_arrival_lng: number | null
          site_arrival_time: string | null
          status: Database["public"]["Enums"]["driver_leg_status"]
          total_onsite_minutes: number | null
          total_travel_minutes: number | null
          travel_start_lat: number | null
          travel_start_lng: number | null
          travel_start_time: string | null
          updated_at: string
        }
        Insert: {
          attendance_log_id?: string | null
          created_at?: string
          date: string
          driver_id: string
          id?: string
          leg_end_lat?: number | null
          leg_end_lng?: number | null
          leg_end_time?: string | null
          leg_number?: number
          leg_type?: Database["public"]["Enums"]["driver_leg_type"] | null
          notes?: string | null
          project_id: string
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          status?: Database["public"]["Enums"]["driver_leg_status"]
          total_onsite_minutes?: number | null
          total_travel_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          updated_at?: string
        }
        Update: {
          attendance_log_id?: string | null
          created_at?: string
          date?: string
          driver_id?: string
          id?: string
          leg_end_lat?: number | null
          leg_end_lng?: number | null
          leg_end_time?: string | null
          leg_number?: number
          leg_type?: Database["public"]["Enums"]["driver_leg_type"] | null
          notes?: string | null
          project_id?: string
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          status?: Database["public"]["Enums"]["driver_leg_status"]
          total_onsite_minutes?: number | null
          total_travel_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_trip_legs_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_trip_legs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_trip_legs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      employee_notifications: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_read: boolean
          message: string | null
          priority: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_read?: boolean
          message?: string | null
          priority?: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_read?: boolean
          message?: string | null
          priority?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_notifications_employee_id_fkey"
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
          basic_salary: number
          branch_id: string
          company_id: string
          created_at: string
          custom_skill_id: string | null
          designation: string | null
          email: string | null
          emergency_contact: string | null
          employee_code: string
          hourly_rate: number
          id: string
          is_active: boolean
          join_date: string | null
          last_app_build: number | null
          last_app_version: string | null
          last_login_at: string | null
          last_platform: string | null
          name: string
          notes: string | null
          overtime_rate: number
          phone: string | null
          secondary_skills: string[]
          skill_type: Database["public"]["Enums"]["skill_type"]
          standard_hours_per_day: number
        }
        Insert: {
          auth_id?: string | null
          basic_salary?: number
          branch_id: string
          company_id?: string
          created_at?: string
          custom_skill_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          join_date?: string | null
          last_app_build?: number | null
          last_app_version?: string | null
          last_login_at?: string | null
          last_platform?: string | null
          name: string
          notes?: string | null
          overtime_rate?: number
          phone?: string | null
          secondary_skills?: string[]
          skill_type?: Database["public"]["Enums"]["skill_type"]
          standard_hours_per_day?: number
        }
        Update: {
          auth_id?: string | null
          basic_salary?: number
          branch_id?: string
          company_id?: string
          created_at?: string
          custom_skill_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          join_date?: string | null
          last_app_build?: number | null
          last_app_version?: string | null
          last_login_at?: string | null
          last_platform?: string | null
          name?: string
          notes?: string | null
          overtime_rate?: number
          phone?: string | null
          secondary_skills?: string[]
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
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_custom_skill_id_fkey"
            columns: ["custom_skill_id"]
            isOneToOne: false
            referencedRelation: "custom_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          action: string | null
          app_version: string | null
          build_number: string | null
          category: string | null
          company_id: string | null
          context: Json | null
          created_at: string
          employee_id: string | null
          error_code: string | null
          id: string
          message: string
          network_state: string | null
          platform: string | null
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          route: string | null
          severity: string
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          app_version?: string | null
          build_number?: string | null
          category?: string | null
          company_id?: string | null
          context?: Json | null
          created_at?: string
          employee_id?: string | null
          error_code?: string | null
          id?: string
          message: string
          network_state?: string | null
          platform?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          route?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          app_version?: string | null
          build_number?: string | null
          category?: string | null
          company_id?: string | null
          context?: Json | null
          created_at?: string
          employee_id?: string | null
          error_code?: string | null
          id?: string
          message?: string
          network_state?: string | null
          platform?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          route?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          action: string | null
          created_at: string
          employee_id: string | null
          key: string
          response: Json | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          employee_id?: string | null
          key: string
          response?: Json | null
        }
        Update: {
          action?: string | null
          created_at?: string
          employee_id?: string | null
          key?: string
          response?: Json | null
        }
        Relationships: []
      }
      maintenance_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          maintenance_call_id: string
          shift_end: string | null
          shift_start: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          maintenance_call_id: string
          shift_end?: string | null
          shift_start?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          maintenance_call_id?: string
          shift_end?: string | null
          shift_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_assignments_maintenance_call_id_fkey"
            columns: ["maintenance_call_id"]
            isOneToOne: false
            referencedRelation: "maintenance_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_calls: {
        Row: {
          branch_id: string
          company_name: string
          contact_number: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          notes: string | null
          permit_required: boolean
          priority: Database["public"]["Enums"]["maintenance_priority"]
          scheduled_date: string | null
          scope: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          company_name: string
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          permit_required?: boolean
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          scheduled_date?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          company_name?: string
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          permit_required?: boolean
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          scheduled_date?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_calls_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_images: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          id: string
          maintenance_call_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          id?: string
          maintenance_call_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          id?: string
          maintenance_call_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_images_maintenance_call_id_fkey"
            columns: ["maintenance_call_id"]
            isOneToOne: false
            referencedRelation: "maintenance_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          gps_validation_enabled: boolean
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
          gps_validation_enabled?: boolean
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
          gps_validation_enabled?: boolean
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
      pending_invitations: {
        Row: {
          accepted_at: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          assigned_by: string | null
          assigned_role: string
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
          task: string | null
          work_location:
            | Database["public"]["Enums"]["work_location_type"]
            | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_role?: string
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
          task?: string | null
          work_location?:
            | Database["public"]["Enums"]["work_location_type"]
            | null
        }
        Update: {
          assigned_by?: string | null
          assigned_role?: string
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
          task?: string | null
          work_location?:
            | Database["public"]["Enums"]["work_location_type"]
            | null
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
      project_daily_logs: {
        Row: {
          assigned_employee_ids: string[]
          completion_pct: number | null
          created_at: string
          date: string
          description: string
          employee_id: string | null
          id: string
          issues: string | null
          photo_urls: string[] | null
          posted_by: string | null
          project_id: string
          status: string
          task_end_date: string | null
          task_start_date: string | null
          updated_at: string
        }
        Insert: {
          assigned_employee_ids?: string[]
          completion_pct?: number | null
          created_at?: string
          date?: string
          description: string
          employee_id?: string | null
          id?: string
          issues?: string | null
          photo_urls?: string[] | null
          posted_by?: string | null
          project_id: string
          status?: string
          task_end_date?: string | null
          task_start_date?: string | null
          updated_at?: string
        }
        Update: {
          assigned_employee_ids?: string[]
          completion_pct?: number | null
          created_at?: string
          date?: string
          description?: string
          employee_id?: string | null
          id?: string
          issues?: string | null
          photo_urls?: string[] | null
          posted_by?: string | null
          project_id?: string
          status?: string
          task_end_date?: string | null
          task_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_logs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_day_work_locations: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          location: Database["public"]["Enums"]["work_location_type"]
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          location: Database["public"]["Enums"]["work_location_type"]
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          location?: Database["public"]["Enums"]["work_location_type"]
          project_id?: string
          updated_at?: string
        }
        Relationships: []
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
          required_drivers: number
          required_helpers: number
          required_supervisors: number
          required_team_members: number
          required_technicians: number
        }
        Insert: {
          cost_categories?: Json | null
          created_at?: string
          created_by?: string | null
          default_duration_days?: number | null
          id?: string
          name: string
          required_drivers?: number
          required_helpers?: number
          required_supervisors?: number
          required_team_members?: number
          required_technicians?: number
        }
        Update: {
          cost_categories?: Json | null
          created_at?: string
          created_by?: string | null
          default_duration_days?: number | null
          id?: string
          name?: string
          required_drivers?: number
          required_helpers?: number
          required_supervisors?: number
          required_team_members?: number
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
      project_work_sessions: {
        Row: {
          attendance_log_id: string | null
          break_end_time: string | null
          break_minutes: number | null
          break_start_time: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          office_arrival_distance_m: number | null
          office_arrival_lat: number | null
          office_arrival_lng: number | null
          office_arrival_time: string | null
          office_arrival_valid: boolean | null
          overtime_cost: number | null
          overtime_minutes: number | null
          project_id: string
          regular_cost: number | null
          return_travel_start_lat: number | null
          return_travel_start_lng: number | null
          return_travel_start_time: string | null
          site_arrival_distance_m: number | null
          site_arrival_lat: number | null
          site_arrival_lng: number | null
          site_arrival_time: string | null
          site_arrival_valid: boolean | null
          status: string
          total_work_minutes: number | null
          travel_start_lat: number | null
          travel_start_lng: number | null
          travel_start_time: string | null
          updated_at: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          attendance_log_id?: string | null
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          office_arrival_distance_m?: number | null
          office_arrival_lat?: number | null
          office_arrival_lng?: number | null
          office_arrival_time?: string | null
          office_arrival_valid?: boolean | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          project_id: string
          regular_cost?: number | null
          return_travel_start_lat?: number | null
          return_travel_start_lng?: number | null
          return_travel_start_time?: string | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          status?: string
          total_work_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          attendance_log_id?: string | null
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          office_arrival_distance_m?: number | null
          office_arrival_lat?: number | null
          office_arrival_lng?: number | null
          office_arrival_time?: string | null
          office_arrival_valid?: boolean | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          project_id?: string
          regular_cost?: number | null
          return_travel_start_lat?: number | null
          return_travel_start_lng?: number | null
          return_travel_start_time?: string | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          status?: string
          total_work_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_work_sessions_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          company_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          has_warranty: boolean
          health_score: number | null
          id: string
          job_card: string | null
          name: string
          notes: string | null
          project_value: number | null
          required_drivers: number
          required_helpers: number
          required_supervisors: number
          required_team_members: number
          required_technicians: number
          site_address: string | null
          site_gps_radius: number
          site_latitude: number | null
          site_longitude: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          template_id: string | null
          warranty_end_date: string | null
          warranty_notes: string | null
          warranty_notification_sent: boolean
          warranty_start_date: string | null
        }
        Insert: {
          branch_id: string
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          has_warranty?: boolean
          health_score?: number | null
          id?: string
          job_card?: string | null
          name: string
          notes?: string | null
          project_value?: number | null
          required_drivers?: number
          required_helpers?: number
          required_supervisors?: number
          required_team_members?: number
          required_technicians?: number
          site_address?: string | null
          site_gps_radius?: number
          site_latitude?: number | null
          site_longitude?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_notification_sent?: boolean
          warranty_start_date?: string | null
        }
        Update: {
          branch_id?: string
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          has_warranty?: boolean
          health_score?: number | null
          id?: string
          job_card?: string | null
          name?: string
          notes?: string | null
          project_value?: number | null
          required_drivers?: number
          required_helpers?: number
          required_supervisors?: number
          required_team_members?: number
          required_technicians?: number
          site_address?: string | null
          site_gps_radius?: number
          site_latitude?: number | null
          site_longitude?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_notification_sent?: boolean
          warranty_start_date?: string | null
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
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      public_holidays: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          name: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          name: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_holidays_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_job_employees: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_lead: boolean
          recurring_job_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_lead?: boolean
          recurring_job_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_lead?: boolean
          recurring_job_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_employees_recurring_job_id_fkey"
            columns: ["recurring_job_id"]
            isOneToOne: false
            referencedRelation: "recurring_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_job_occurrences: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          notes: string | null
          occurrence_date: string
          project_assignment_id: string | null
          recurring_job_id: string
          status: Database["public"]["Enums"]["recurring_occurrence_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          notes?: string | null
          occurrence_date: string
          project_assignment_id?: string | null
          recurring_job_id: string
          status?: Database["public"]["Enums"]["recurring_occurrence_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          notes?: string | null
          occurrence_date?: string
          project_assignment_id?: string | null
          recurring_job_id?: string
          status?: Database["public"]["Enums"]["recurring_occurrence_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_occurrences_project_assignment_id_fkey"
            columns: ["project_assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_occurrences_recurring_job_id_fkey"
            columns: ["recurring_job_id"]
            isOneToOne: false
            referencedRelation: "recurring_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_jobs: {
        Row: {
          address: string | null
          branch_id: string | null
          break_minutes: number
          client_name: string
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          day_of_month: number | null
          days_of_week: number[] | null
          end_date: string | null
          end_time: string
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          headcount: number
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          project_id: string | null
          required_skills: string[] | null
          site_name: string | null
          skip_holidays: boolean
          start_date: string
          start_time: string
          status: Database["public"]["Enums"]["recurring_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          break_minutes?: number
          client_name: string
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          days_of_week?: number[] | null
          end_date?: string | null
          end_time?: string
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          headcount?: number
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          project_id?: string | null
          required_skills?: string[] | null
          site_name?: string | null
          skip_holidays?: boolean
          start_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          break_minutes?: number
          client_name?: string
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          days_of_week?: number[] | null
          end_date?: string | null
          end_time?: string
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          headcount?: number
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          project_id?: string | null
          required_skills?: string[] | null
          site_name?: string | null
          skip_holidays?: boolean
          start_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      site_visit_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          id: string
          site_visit_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          id?: string
          site_visit_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          id?: string
          site_visit_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_photos_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_work_sessions: {
        Row: {
          attendance_log_id: string | null
          break_end_time: string | null
          break_minutes: number | null
          break_start_time: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          overtime_cost: number | null
          overtime_minutes: number | null
          regular_cost: number | null
          return_travel_start_accuracy: number | null
          return_travel_start_lat: number | null
          return_travel_start_lng: number | null
          return_travel_start_time: string | null
          site_arrival_distance_m: number | null
          site_arrival_lat: number | null
          site_arrival_lng: number | null
          site_arrival_time: string | null
          site_arrival_valid: boolean | null
          site_visit_id: string
          status: string
          total_work_minutes: number | null
          travel_start_lat: number | null
          travel_start_lng: number | null
          travel_start_time: string | null
          updated_at: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          attendance_log_id?: string | null
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          regular_cost?: number | null
          return_travel_start_accuracy?: number | null
          return_travel_start_lat?: number | null
          return_travel_start_lng?: number | null
          return_travel_start_time?: string | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          site_visit_id: string
          status?: string
          total_work_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          attendance_log_id?: string | null
          break_end_time?: string | null
          break_minutes?: number | null
          break_start_time?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          overtime_cost?: number | null
          overtime_minutes?: number | null
          regular_cost?: number | null
          return_travel_start_accuracy?: number | null
          return_travel_start_lat?: number | null
          return_travel_start_lng?: number | null
          return_travel_start_time?: string | null
          site_arrival_distance_m?: number | null
          site_arrival_lat?: number | null
          site_arrival_lng?: number | null
          site_arrival_time?: string | null
          site_arrival_valid?: boolean | null
          site_visit_id?: string
          status?: string
          total_work_minutes?: number | null
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          travel_start_time?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_work_sessions_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_work_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_work_sessions_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          admin_notes: string | null
          assigned_by: string | null
          assigned_employee_id: string | null
          branch_id: string
          challenges: string | null
          client_contact: string | null
          client_email: string | null
          client_name: string
          completed_at: string | null
          converted_to_project_id: string | null
          created_at: string
          data_availability: string | null
          employee_notes: string | null
          environmental_notes: string | null
          id: string
          internet_available: boolean | null
          lead_source: string | null
          mounting_type: string | null
          power_availability: string | null
          priority: Database["public"]["Enums"]["site_visit_priority"]
          project_type: string | null
          recommendations: string | null
          scope_brief: string | null
          screen_size: string | null
          screen_type: string | null
          signature_url: string | null
          signed_by_name: string | null
          site_accessibility: string | null
          site_address: string | null
          site_dimensions: string | null
          site_latitude: number | null
          site_longitude: number | null
          status: Database["public"]["Enums"]["site_visit_status"]
          structural_notes: string | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_by?: string | null
          assigned_employee_id?: string | null
          branch_id: string
          challenges?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name: string
          completed_at?: string | null
          converted_to_project_id?: string | null
          created_at?: string
          data_availability?: string | null
          employee_notes?: string | null
          environmental_notes?: string | null
          id?: string
          internet_available?: boolean | null
          lead_source?: string | null
          mounting_type?: string | null
          power_availability?: string | null
          priority?: Database["public"]["Enums"]["site_visit_priority"]
          project_type?: string | null
          recommendations?: string | null
          scope_brief?: string | null
          screen_size?: string | null
          screen_type?: string | null
          signature_url?: string | null
          signed_by_name?: string | null
          site_accessibility?: string | null
          site_address?: string | null
          site_dimensions?: string | null
          site_latitude?: number | null
          site_longitude?: number | null
          status?: Database["public"]["Enums"]["site_visit_status"]
          structural_notes?: string | null
          updated_at?: string
          visit_date: string
        }
        Update: {
          admin_notes?: string | null
          assigned_by?: string | null
          assigned_employee_id?: string | null
          branch_id?: string
          challenges?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string
          completed_at?: string | null
          converted_to_project_id?: string | null
          created_at?: string
          data_availability?: string | null
          employee_notes?: string | null
          environmental_notes?: string | null
          id?: string
          internet_available?: boolean | null
          lead_source?: string | null
          mounting_type?: string | null
          power_availability?: string | null
          priority?: Database["public"]["Enums"]["site_visit_priority"]
          project_type?: string | null
          recommendations?: string | null
          scope_brief?: string | null
          screen_size?: string | null
          screen_type?: string | null
          signature_url?: string | null
          signed_by_name?: string | null
          site_accessibility?: string | null
          site_address?: string | null
          site_dimensions?: string | null
          site_latitude?: number | null
          site_longitude?: number | null
          status?: Database["public"]["Enums"]["site_visit_status"]
          structural_notes?: string | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_converted_to_project_id_fkey"
            columns: ["converted_to_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          custom_skill_id: string
          id: string
          module: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          custom_skill_id: string
          id?: string
          module: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          custom_skill_id?: string
          id?: string
          module?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_permissions_custom_skill_id_fkey"
            columns: ["custom_skill_id"]
            isOneToOne: false
            referencedRelation: "custom_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_permissions_updated_by_fkey"
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
      travel_pings: {
        Row: {
          accuracy: number | null
          attendance_log_id: string
          employee_id: string
          id: string
          lat: number
          lng: number
          pinged_at: string
        }
        Insert: {
          accuracy?: number | null
          attendance_log_id: string
          employee_id: string
          id?: string
          lat: number
          lng: number
          pinged_at?: string
        }
        Update: {
          accuracy?: number | null
          attendance_log_id?: string
          employee_id?: string
          id?: string
          lat?: number
          lng?: number
          pinged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_pings_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_pings_employee_id_fkey"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_idempotency_keys: { Args: never; Returns: undefined }
      company_of_branch: { Args: { _id: string }; Returns: string }
      company_of_employee: { Args: { _id: string }; Returns: string }
      company_of_maintenance_call: { Args: { _id: string }; Returns: string }
      company_of_project: { Args: { _id: string }; Returns: string }
      company_of_site_visit: { Args: { _id: string }; Returns: string }
      company_of_user: { Args: { _id: string }; Returns: string }
      delete_employee_cascade: { Args: { emp_id: string }; Returns: undefined }
      employee_has_project_assignment: {
        Args: { _project_id: string }
        Returns: boolean
      }
      get_user_branch_id: { Args: never; Returns: string }
      get_user_company_id: { Args: never; Returns: string }
      get_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_company_admin: { Args: { _company_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      resolve_tenant: {
        Args: { _host?: string; _slug?: string }
        Returns: {
          accent_color: string
          id: string
          is_active: boolean
          logo_url: string
          name: string
          primary_color: string
          slug: string
        }[]
      }
      update_absent_check_cron: {
        Args: { cron_expr: string }
        Returns: undefined
      }
      update_day_incomplete_cron: {
        Args: { cron_expr?: string }
        Returns: undefined
      }
      update_derived_backfill_cron: {
        Args: { cron_expr?: string }
        Returns: undefined
      }
      update_morning_briefing_cron: {
        Args: { cron_expr: string }
        Returns: undefined
      }
    }
    Enums: {
      assignment_mode: "manual" | "auto" | "hybrid"
      common_task_status: "in_progress" | "completed"
      driver_leg_status: "traveling" | "on_site" | "completed"
      driver_leg_type: "drop_off" | "pick_up" | "wait"
      expense_category:
        | "labor"
        | "overtime"
        | "travel"
        | "material"
        | "transport"
        | "equipment"
        | "misc"
      expense_status: "pending" | "approved" | "rejected"
      holiday_rate_type: "multiplier" | "fixed"
      maintenance_priority: "emergency" | "high" | "normal" | "low"
      maintenance_status:
        | "open"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "closed"
      notification_priority: "low" | "normal" | "high" | "critical"
      override_action: "absent" | "replaced" | "added" | "removed"
      project_status: "on_hold" | "in_progress" | "completed"
      recurring_frequency: "daily" | "weekly" | "monthly" | "custom"
      recurring_occurrence_status:
        | "scheduled"
        | "skipped"
        | "done"
        | "cancelled"
      recurring_status: "active" | "paused" | "ended"
      report_schedule: "none" | "daily" | "weekly" | "monthly"
      site_visit_priority: "low" | "normal" | "high" | "urgent"
      site_visit_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "converted"
      skill_type:
        | "technician"
        | "helper"
        | "team_leader"
        | "team_member"
        | "driver"
      user_role: "admin" | "manager" | "team_leader" | "super_admin"
      work_location_type: "in_house" | "site"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      common_task_status: ["in_progress", "completed"],
      driver_leg_status: ["traveling", "on_site", "completed"],
      driver_leg_type: ["drop_off", "pick_up", "wait"],
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
      holiday_rate_type: ["multiplier", "fixed"],
      maintenance_priority: ["emergency", "high", "normal", "low"],
      maintenance_status: [
        "open",
        "scheduled",
        "in_progress",
        "completed",
        "closed",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
      override_action: ["absent", "replaced", "added", "removed"],
      project_status: ["on_hold", "in_progress", "completed"],
      recurring_frequency: ["daily", "weekly", "monthly", "custom"],
      recurring_occurrence_status: [
        "scheduled",
        "skipped",
        "done",
        "cancelled",
      ],
      recurring_status: ["active", "paused", "ended"],
      report_schedule: ["none", "daily", "weekly", "monthly"],
      site_visit_priority: ["low", "normal", "high", "urgent"],
      site_visit_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        "converted",
      ],
      skill_type: [
        "technician",
        "helper",
        "team_leader",
        "team_member",
        "driver",
      ],
      user_role: ["admin", "manager", "team_leader", "super_admin"],
      work_location_type: ["in_house", "site"],
    },
  },
} as const
