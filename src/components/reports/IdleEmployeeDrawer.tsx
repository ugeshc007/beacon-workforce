import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { IdleEmployeeRow } from "@/hooks/useIdleTimeReport";
import { REASON_LABEL } from "@/lib/idle-time";

const fmtH = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
  weekday: "short", day: "numeric", month: "short",
});

export function IdleEmployeeDrawer({
  employee,
  open,
  onOpenChange,
}: {
  employee: IdleEmployeeRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{employee?.name}</SheetTitle>
          {employee && (
            <p className="text-xs text-muted-foreground">
              {employee.code} · {employee.skill} · {employee.daysWorked} days · Idle {fmtH(employee.idleMin)} of {fmtH(employee.shiftMin)}
            </p>
          )}
        </SheetHeader>

        {employee && (
          <div className="mt-4 space-y-3">
            {employee.days.map((d) => {
              const r = d.result;
              const idlePct = r.shiftMin > 0 ? Math.round((r.idleMin / r.shiftMin) * 100) : 0;
              return (
                <div key={d.logId} className="rounded-lg border border-border bg-card/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fmtDate(d.date)}</p>
                      <p className="text-[11px] text-muted-foreground">{d.projectName ?? "No project"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-status-absent">Idle {fmtH(r.idleMin)}</p>
                      <p className="text-[10px] text-muted-foreground">{idlePct}% of shift</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center mb-2">
                    <Metric label="Shift" value={fmtH(r.shiftMin)} />
                    <Metric label="Productive" value={fmtH(r.productiveMin)} tone="present" />
                    <Metric label="Break" value={fmtH(r.breakMin)} />
                    <Metric label="Idle" value={fmtH(r.idleMin)} tone="absent" />
                  </div>

                  {r.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {r.reasons.map((reason, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] border-status-absent/40 text-status-absent">
                          {REASON_LABEL[reason]}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {r.gaps.length > 0 && (
                    <div className="space-y-1">
                      {r.gaps.map((g, i) => (
                        <div key={i} className="text-[11px] font-mono text-muted-foreground flex justify-between">
                          <span>{g.label}</span>
                          <span>
                            {g.from ? new Date(g.from).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
                            {" → "}
                            {g.to ? new Date(g.to).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "present" | "absent" }) {
  const color = tone === "present"
    ? "text-status-present"
    : tone === "absent"
    ? "text-status-absent"
    : "text-foreground";
  return (
    <div className="rounded bg-muted/30 py-1.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-mono ${color}`}>{value}</p>
    </div>
  );
}
