import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import {
  usePublicHolidays,
  useCreatePublicHoliday,
  useUpdatePublicHoliday,
  useDeletePublicHoliday,
  type PublicHoliday,
} from "@/hooks/usePublicHolidays";
import { useBranchList } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";

export function PublicHolidaysSection() {
  const { data: holidays, isLoading } = usePublicHolidays();
  const del = useDeletePublicHoliday();
  const { toast } = useToast();
  const [editing, setEditing] = useState<PublicHoliday | null>(null);
  const [open, setOpen] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    try {
      await del.mutateAsync(id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand" /> Public Holidays
          </CardTitle>
          <CardDescription className="text-xs">
            Dates flagged as paid holidays. When an employee works on these days, the holiday rate from their skill role is applied.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Holiday
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !holidays?.length ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No public holidays yet.</p>
        ) : (
          <div className="space-y-2">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </Badge>
                  <span className="text-sm font-medium">{h.name}</span>
                  {h.branches?.name ? (
                    <Badge variant="secondary" className="text-[10px]">{h.branches.name}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">All branches</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(h); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(h.id, h.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <HolidayDialog open={open} onOpenChange={setOpen} holiday={editing} />
    </Card>
  );
}

function HolidayDialog({ open, onOpenChange, holiday }: { open: boolean; onOpenChange: (v: boolean) => void; holiday: PublicHoliday | null }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [branchId, setBranchId] = useState<string>("__all__");
  const create = useCreatePublicHoliday();
  const update = useUpdatePublicHoliday();
  const { data: branches } = useBranchList();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(holiday?.name ?? "");
      setDate(holiday?.date ?? new Date().toISOString().slice(0, 10));
      setBranchId(holiday?.branch_id ?? "__all__");
    }
  }, [open, holiday]);

  const handleSave = async () => {
    if (!name.trim() || !date) {
      toast({ title: "Name and date are required", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        date,
        branch_id: branchId === "__all__" ? null : branchId,
      };
      if (holiday) {
        await update.mutateAsync({ id: holiday.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{holiday ? "Edit Holiday" : "Add Public Holiday"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Holiday Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. UAE National Day, Eid Al Fitr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date *</Label>
            <DateInput value={date} onChange={setDate} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Applies To</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Branches</SelectItem>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {holiday ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
