import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getQueue, type QueuedAction } from "@/lib/offline-queue";
import { getDailyLogQueue, type QueuedDailyLog, syncPendingDailyLogs } from "@/lib/offline-daily-logs";
import { syncPendingActions, onSyncChange } from "@/lib/offline-sync";
import { useToast } from "@/hooks/use-toast";

export function SyncStatusBadge() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [logs, setLogs] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [dailyLogs, setDailyLogs] = useState<QueuedDailyLog[]>([]);
  const { toast } = useToast();

  const refresh = async () => {
    const [q, dl] = await Promise.all([getQueue(), getDailyLogQueue()]);
    setActions(q);
    setDailyLogs(dl);
    setPending(q.filter((x) => x.sync_status !== "synced").length);
    setLogs(dl.filter((x) => x.sync_status !== "syncing").length);
  };

  useEffect(() => {
    refresh();
    const on = () => { setOnline(true); refresh(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = onSyncChange((p, s) => { setPending(p); setSyncing(s); refresh(); });
    const interval = setInterval(refresh, 10000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
      clearInterval(interval);
    };
  }, []);

  const total = pending + logs;

  const dotColor = !online
    ? "bg-red-500"
    : total > 0
    ? "bg-amber-400"
    : "bg-emerald-500";

  const label = !online ? "Offline" : total > 0 ? `${total} pending` : "Online";

  const handleRetry = async () => {
    if (!online) {
      toast({ title: "Still offline", description: "Connect to sync.", variant: "destructive" });
      return;
    }
    toast({ title: "Syncing…" });
    const [a, d] = await Promise.all([syncPendingActions(), syncPendingDailyLogs()]);
    refresh();
    toast({ title: "Sync complete", description: `${a.synced + d.synced} sent, ${a.failed + d.failed} failed` });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/50 text-xs"
          aria-label="Sync status"
        >
          <span className={`h-2 w-2 rounded-full ${dotColor} ${syncing ? "animate-pulse" : ""}`} />
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span className="font-medium">{label}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5" /> Sync Queue
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{total} item{total === 1 ? "" : "s"} waiting</p>
              <p className="text-xs text-muted-foreground">{online ? "Connected" : "Waiting for connection"}</p>
            </div>
            <Button size="sm" variant="outline" disabled={!online || syncing} onClick={handleRetry} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Retry now
            </Button>
          </div>

          {total === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Everything is synced ✓
            </div>
          )}

          {actions.map((a) => (
            <QueueItem
              key={a.local_id}
              title={a.action_type.replace(/_/g, " ")}
              timestamp={a.timestamp}
              status={a.sync_status}
              error={a.error_message}
            />
          ))}
          {dailyLogs.map((l) => (
            <QueueItem
              key={l.local_id}
              title={`Daily log · ${l.photos.length} photo${l.photos.length === 1 ? "" : "s"}`}
              timestamp={l.queued_at}
              status={l.sync_status}
              error={l.error_message}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QueueItem({ title, timestamp, status, error }: { title: string; timestamp: string; status: string; error?: string }) {
  const color = status === "error" ? "text-red-400 border-red-500/30" : status === "synced" ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30";
  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium capitalize truncate">{title}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>{status}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(timestamp).toLocaleString()}</p>
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}
