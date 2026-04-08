
## Maintenance Module Plan

### 1. Database (migration)
**`maintenance_calls` table:**
- company_name, contact_number, location, scope (text), permit_required (boolean)
- priority: enum `emergency | high | normal | low`
- status: enum `open | scheduled | in_progress | completed | closed`
- scheduled_date, notes, created_by, branch_id
- RLS: branch-scoped (same pattern as projects)

**`maintenance_assignments` table:**
- maintenance_call_id, employee_id, date, shift_start, shift_end
- Reuses same staff scheduling pattern as project assignments
- RLS: branch-scoped via maintenance_calls

### 2. Hooks (`src/hooks/useMaintenance.ts`)
- `useMaintenanceCalls(filters)` — list with search/status/priority filters
- `useMaintenanceCall(id)` — single call detail
- `useCreateMaintenanceCall()`, `useUpdateMaintenanceCall()`, `useDeleteMaintenanceCall()`
- `useMaintenanceAssignments(callId)` — staff assigned
- `useAssignToMaintenance()`, `useRemoveFromMaintenance()`

### 3. Pages
- **`/maintenance`** — list all calls with filters (status, priority, search)
- **`/maintenance/:id`** — detail view with info + assigned staff + status updates

### 4. Components
- `MaintenanceFormDialog` — create/edit form
- `MaintenanceAssignDialog` — assign staff (similar to TeamAssignDialog)

### 5. Navigation
- Add "Maintenance" to sidebar with Wrench icon
