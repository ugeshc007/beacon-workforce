INSERT INTO public.project_assignments (id, project_id, employee_id, date, shift_start, shift_end, assigned_role, work_location, task, assignment_mode)
VALUES ('0e9a7377-eda9-4fd9-883a-30b48c1642b1', '69728108-5fbb-481f-972a-77728833ea6a', 'd4503988-9873-4fe3-9645-b4ef1198b057', '2026-09-03', '00:00:00', '08:00:00', 'team_member', 'site', 'STRUCTURE AND SCREEN INSTALLATION', 'manual')
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.daily_team_overrides
WHERE id = 'a5b68c12-e76e-4225-bbd7-0686d5f78d93';

INSERT INTO public.assignment_audit_log (project_id, date, change_type, before_state, after_state, reason)
VALUES ('69728108-5fbb-481f-972a-77728833ea6a', '2026-09-03', 'admin_restored', '{"cancelled_by_employee": true}', '{"employee_id": "d4503988-9873-4fe3-9645-b4ef1198b057", "restored": true}', 'Admin requested restore of same-day assignment cancelled at punch-out');