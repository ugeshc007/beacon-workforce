import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

interface Props {
  open: boolean;
  /** YYYY-MM-DD of the stale shift */
  shiftDate: string;
  /** Human label for the action being timed (e.g. "Start Work") */
  actionLabel: string;
  /** Earliest allowed time on the shift date (HH:mm) — usually previous step's time */
  minTime?: string | null;
  /** Suggested default time on the shift date (HH:mm) */
  defaultTime?: string | null;
  onConfirm: (isoTimestamp: string) => void;
  onCancel: () => void;
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

/** Build ISO timestamp for shiftDate + HH:mm in the device's local zone (assumed Asia/Dubai). */
function toIso(shiftDate: string, hhmm: string): string {
  // shiftDate is YYYY-MM-DD; treat hh:mm as local time.
  const [h, m] = hhmm.split(":").map(Number);
  const [y, mo, d] = shiftDate.split("-").map(Number);
  const dt = new Date(y, mo - 1, d, h, m, 0, 0);
  return dt.toISOString();
}

export function RetroTimeDialog({ open, shiftDate, actionLabel, minTime, defaultTime, onConfirm, onCancel }: Props) {
  const initial = useMemo(() => {
    if (defaultTime) return defaultTime;
    if (minTime) return minTime;
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, [defaultTime, minTime]);

  const [time, setTime] = useState(initial);
  useEffect(() => { setTime(initial); }, [initial, open]);

  const prettyDate = useMemo(() => {
    if (!shiftDate) return "";
    return new Date(shiftDate + "T00:00:00").toLocaleDateString("en-AE", {
      weekday: "long", day: "2-digit", month: "short",
    });
  }, [shiftDate]);

  const invalid = !!minTime && time < minTime;

  const handleConfirm = () => {
    if (invalid) return;
    onConfirm(toIso(shiftDate, time));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand" />
            When did you do this?
          </DialogTitle>
          <DialogDescription>
            You're finishing an old shift from <span className="font-semibold text-foreground">{prettyDate}</span>.
            Enter the actual time you did <span className="font-semibold text-foreground">{actionLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="retro-time">Time (24h)</Label>
          <Input
            id="retro-time"
            type="time"
            value={time}
            min={minTime ?? undefined}
            onChange={(e) => setTime(e.target.value)}
            className="text-lg font-mono"
          />
          {minTime && (
            <p className="text-[11px] text-muted-foreground">
              Must be after previous step ({minTime}).
            </p>
          )}
          {invalid && (
            <p className="text-[11px] text-destructive">
              Time must be after {minTime}.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={invalid}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
