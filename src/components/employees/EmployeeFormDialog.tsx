import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreateEmployee, useUpdateEmployee, useBranches } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  employee_code: z.string().min(1, "Employee code is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  designation: z.string().max(100).optional().or(z.literal("")),
  skill_type: z.enum(["team_member", "team_leader", "driver"]),
  branch_id: z.string().uuid("Select a branch"),
  hourly_rate: z.coerce.number().min(0),
  overtime_rate: z.coerce.number().min(0),
  standard_hours_per_day: z.coerce.number().min(1).max(24),
  join_date: z.string().optional().or(z.literal("")),
  emergency_contact: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Tables<"employees"> | null;
}

const ALL_SKILLS = [
  { value: "team_member", label: "Team Member" },
  { value: "team_leader", label: "Team Leader" },
  { value: "driver", label: "Driver" },
];

export function EmployeeFormDialog({ open, onOpenChange, employee }: Props) {
  const isEdit = !!employee;
  const { toast } = useToast();
  const { data: branches } = useBranches();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const [secondarySkills, setSecondarySkills] = useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_code: "",
      name: "",
      phone: "",
      email: "",
      designation: "",
      skill_type: "team_member",
      branch_id: "",
      hourly_rate: 25,
      overtime_rate: 37.5,
      standard_hours_per_day: 8,
      join_date: "",
      emergency_contact: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        employee_code: employee.employee_code,
        name: employee.name,
        phone: employee.phone ?? "",
        email: employee.email ?? "",
        designation: employee.designation ?? "",
        skill_type: employee.skill_type as "team_member" | "team_leader" | "driver",
        branch_id: employee.branch_id,
        hourly_rate: Number(employee.hourly_rate),
        overtime_rate: Number(employee.overtime_rate),
        standard_hours_per_day: Number(employee.standard_hours_per_day),
        join_date: employee.join_date ?? "",
        emergency_contact: employee.emergency_contact ?? "",
        notes: employee.notes ?? "",
      });
      setSecondarySkills((employee as any).secondary_skills ?? []);
    } else {
      form.reset();
      setSecondarySkills([]);
    }
  }, [employee, open]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        phone: values.phone || null,
        email: values.email || null,
        designation: values.designation || null,
        join_date: values.join_date || null,
        emergency_contact: values.emergency_contact || null,
        notes: values.notes || null,
        secondary_skills: secondarySkills.filter(s => s !== values.skill_type),
      };

      if (isEdit) {
        await update.mutateAsync({ id: employee.id, ...payload });
        toast({ title: "Employee updated", description: `${values.name} has been updated.` });
      } else {
        await create.mutateAsync(payload as any);
        toast({ title: "Employee added", description: `${values.name} has been added to the team.` });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update employee details below." : "Fill in the details to add a new team member."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="employee_code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Code</FormLabel>
                  <FormControl><Input placeholder="BB-T001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Ahmed Al Rashid" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="+971501234567" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="ahmed@bebright.ae" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="designation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <FormControl><Input placeholder="Senior Technician" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="skill_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Skill</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="team_member">Team Member</SelectItem>
                      <SelectItem value="team_leader">Team Leader</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="branch_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {branches?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Secondary Skills */}
            <div>
              <label className="text-sm font-medium">Secondary Skills</label>
              <p className="text-xs text-muted-foreground mb-2">Select additional skills this employee can perform</p>
              <div className="flex gap-4">
                {ALL_SKILLS.filter(s => s.value !== form.watch("skill_type")).map(skill => (
                  <label key={skill.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={secondarySkills.includes(skill.value)}
                      onCheckedChange={(checked) => {
                        setSecondarySkills(prev =>
                          checked ? [...prev, skill.value] : prev.filter(s => s !== skill.value)
                        );
                      }}
                    />
                    {skill.label}
                  </label>
                ))}
              </div>
            </div>

              <FormField control={form.control} name="hourly_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hourly Rate (AED)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="overtime_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>OT Rate (AED)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="standard_hours_per_day" render={({ field }) => (
                <FormItem>
                  <FormLabel>Std Hours/Day</FormLabel>
                  <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="join_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Join Date</FormLabel>
                  <FormControl><DateInput value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="emergency_contact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input placeholder="+971..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Additional notes..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
