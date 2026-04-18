import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { useCustomSkills, useCreateCustomSkill, useUpdateCustomSkill, useDeleteCustomSkill, type CustomSkill } from "@/hooks/useCustomSkills";
import { useToast } from "@/hooks/use-toast";

const BASE_TYPES = [
  { value: "team_member", label: "Team Member" },
  { value: "team_leader", label: "Team Leader" },
  { value: "driver", label: "Driver" },
  { value: "technician", label: "Technician" },
  { value: "helper", label: "Helper" },
] as const;

export function SkillRolesSection() {
  const { data: skills, isLoading } = useCustomSkills();
  const del = useDeleteCustomSkill();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CustomSkill | null>(null);
  const [open, setOpen] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete custom skill "${name}"? Employees tagged with it will keep their base skill.`)) return;
    try {
      await del.mutateAsync(id);
      toast({ title: "Skill deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand" /> Custom Skill Roles
          </CardTitle>
          <CardDescription className="text-xs">
            Define custom skill names (e.g. Rigger, LED Technician) that appear in the employee form.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Skill
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !skills?.length ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No custom skills yet. Click "Add Skill" to create one.</p>
        ) : (
          <div className="space-y-2">
            {skills.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {BASE_TYPES.find(b => b.value === s.base_skill_type)?.label ?? s.base_skill_type}
                  </Badge>
                  {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id, s.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <SkillDialog open={open} onOpenChange={setOpen} skill={editing} />
    </Card>
  );
}

function SkillDialog({ open, onOpenChange, skill }: { open: boolean; onOpenChange: (v: boolean) => void; skill: CustomSkill | null }) {
  const [name, setName] = useState("");
  const [baseType, setBaseType] = useState<string>("team_member");
  const [isActive, setIsActive] = useState(true);
  const create = useCreateCustomSkill();
  const update = useUpdateCustomSkill();
  const { toast } = useToast();

  // sync on open
  useState(() => {
    // noop placeholder to satisfy linter
  });

  // reset when dialog opens
  if (open && skill && name === "" && skill.name) {
    // initialize once
    setName(skill.name);
    setBaseType(skill.base_skill_type);
    setIsActive(skill.is_active);
  }

  const handleClose = (v: boolean) => {
    if (!v) {
      setName("");
      setBaseType("team_member");
      setIsActive(true);
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      if (skill) {
        await update.mutateAsync({ id: skill.id, name: name.trim(), base_skill_type: baseType as any, is_active: isActive });
        toast({ title: "Skill updated" });
      } else {
        await create.mutateAsync({ name: name.trim(), base_skill_type: baseType as any, is_active: isActive });
        toast({ title: "Skill created" });
      }
      handleClose(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{skill ? "Edit Skill Role" : "Add Skill Role"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Skill Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rigger, LED Technician" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Maps to Base Type *</Label>
            <Select value={baseType} onValueChange={setBaseType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BASE_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Used by scheduling, payroll, and reports.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="text-xs">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {skill ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
