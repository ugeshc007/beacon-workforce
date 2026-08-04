import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CommonTask, useCreateCommonTask, useUpdateCommonTask } from "@/hooks/useCommonTasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: CommonTask | null;
}

export function CommonTaskFormDialog({ open, onOpenChange, task }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [maxHeadcount, setMaxHeadcount] = useState("5");
  const create = useCreateCommonTask();
  const update = useUpdateCommonTask();
  const { toast } = useToast();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "normal");
    setMaxHeadcount(String(task?.max_headcount ?? 5));
  }, [open, task]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Task title is required", variant: "destructive" });
      return;
    }
    const cap = Math.max(1, parseInt(maxHeadcount, 10) || 1);
    try {
      if (task) {
        await update.mutateAsync({
          id: task.id,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          max_headcount: cap,
        });
        toast({ title: "Common task updated" });
      } else {
        await create.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          max_headcount: cap,
        });
        toast({ title: "Common task created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Common Task" : "New Common Task"}</DialogTitle>
          <DialogDescription>
            Any employee can pick this up from the mobile app after punching in. Only admins can
            mark it completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ct-title">Task title *</Label>
            <Input
              id="ct-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Warehouse Arrangements"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-desc">Description</Label>
            <Textarea
              id="ct-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-cap">Max headcount / day</Label>
              <Input
                id="ct-cap"
                type="number"
                min={1}
                value={maxHeadcount}
                onChange={(e) => setMaxHeadcount(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : task ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
