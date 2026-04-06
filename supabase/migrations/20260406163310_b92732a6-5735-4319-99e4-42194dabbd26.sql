ALTER TABLE public.project_expenses
  ADD COLUMN invoice_number text,
  ADD COLUMN supplier_name text,
  ADD COLUMN due_date date;