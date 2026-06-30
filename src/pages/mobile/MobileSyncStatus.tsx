import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getQueue,
  type QueuedAction,
  removeAction,
  retryAction,
  clearErrored,
  clearSynced,
} from "@/lib/offline-queue";
import {
  getDailyLogQueue,
  type QueuedDailyLog,
  syncPendingDailyLogs,
} from "@/lib/offline-daily-logs";
import { syncPendingActions, onSyncChange, getSyncDiagnostics, type SyncDiagnostics } from "@/lib/offline-sync";
import { useToast } from "@/hooks/use-toast";

type Tab = "pending" | "failed" | "synced";

export default function MobileSyncStatus() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [syncing, setSyncing] = useState(false);
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [dailyLogs, setDailyLogs] = useState<QueuedDailyLog[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [diag, setDiag] = useState<SyncDiagnostics>(() => getSyncDiagnostics());
  const [netInfo, setNetInfo] = useState<{ connected: boolean; type: string } | null>(null);
  const [appActive, setAppActive] = useState(true);
  const [platform, setPlatform] = useState<string>("web");

  const refresh = async () => {
    const [q, dl] = await Promise.all([getQueue(), getDailyLogQueue()]);
    setActions(q);
    setDailyLogs(dl);
    setDiag(getSyncDiagnostics());
    try {
      const { Network } = await import("@capacitor/network");
      const s = await Network.getStatus();
      setNetInfo({ connected: s.connected, type: s.connectionType });
      setOnline(s.connected);
    } catch {
      setNetInfo({ connected: navigator.onLine, type: "browser" });
    }
  };

  useEffect(() => {
    refresh();
    let removeAppSub: (() => void) | null = null;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        setPlatform(Capacitor.getPlatform());
      } catch {}
      try {
        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("appStateChange", (s) => setAppActive(s.isActive));
        removeAppSub = () => sub.remove();
      } catch {}
    })();
    const on = () => { setOnline(true); refresh(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = onSyncChange((_p, s) => {
      setSyncing(s);
      refresh();
    });
    const interval = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
      clearInterval(interval);
      removeAppSub?.();
    };
  }, []);


  const pendingActions = actions.filter((a) => a.sync_status === "pending");
  const failedActions = actions.filter((a) => a.sync_status === "error");
  const syncedActions = actions.filter((a) => a.sync_status === "synced");

  const pendingLogs = dailyLogs.filter((l) => l.sync_status === "pending");
  const failedLogs = dailyLogs.filter((l) => l.sync_status === "error");

  const counts = {
    pending: pendingActions.length + pendingLogs.length,
    failed: failedActions.length + failedLogs.length,
    synced: syncedActions.length,
  };

  const handleSyncAll = async () => {
    if (!online) {
      toast({
        title: "Still offline",
        description: "Connect to the internet to sync.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Syncing…" });
    const [a, d] = await Promise.all([
      syncPendingActions(),
      syncPendingDailyLogs(),
    ]);
    await refresh();
    toast({
      title: "Sync complete",
      description: `${a.synced + d.synced} sent · ${a.failed + d.failed} failed`,
    });
  };

  const handleRetryOne = async (id: string) => {
    await retryAction(id);
    await refresh();
    if (online) {
      await syncPendingActions();
      await refresh();
    } else {
      toast({ title: "Queued for retry", description: "Will run when online." });
    }
  };

  const handleRemove = async (id: string) => {
    await removeAction(id);
    await refresh();
    toast({ title: "Removed from queue" });
  };

  const handleClearErrors = async () => {
    await clearErrored();
    await refresh();
    toast({ title: "Cleared failed items" });
  };

  const handleClearSynced = async () => {
    await clearSynced();
    await refresh();
  };

  const visibleActions =
    tab === "pending"
      ? pendingActions
      : tab === "failed"
      ? failedActions
      : syncedActions;
  const visibleLogs =
    tab === "pending" ? pendingLogs : tab === "failed" ? failedLogs : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border/50 safe-area-top">
        <div className="flex items-center gap-2 px-3 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-semibold flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-brand" />
              Sync Status
            </h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {online ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-red-400" /> Offline — actions
                  queued locally
                </>
              )}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSyncAll}
            disabled={!online || syncing}
            className="gap-1.5 h-9"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            Sync now
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="px-3 pt-3 grid grid-cols-3 gap-2">
        <SummaryTile
          label="Pending"
          value={counts.pending}
          icon={Clock}
          tone="amber"
          active={tab === "pending"}
          onClick={() => setTab("pending")}
        />
        <SummaryTile
          label="Failed"
          value={counts.failed}
          icon={AlertTriangle}
          tone="red"
          active={tab === "failed"}
          onClick={() => setTab("failed")}
        />
        <SummaryTile
          label="Synced"
          value={counts.synced}
          icon={CheckCircle2}
          tone="green"
          active={tab === "synced"}
          onClick={() => setTab("synced")}
        />
      </div>

      {/* Diagnostics */}
      <div className="px-3 mt-3">
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnostics
            </p>
            <span className="text-[10px] text-muted-foreground">{platform}</span>
          </div>
          <DiagRow
            label="Network"
            value={
              netInfo
                ? `${netInfo.connected ? "Connected" : "Disconnected"} · ${netInfo.type}`
                : online ? "Connected" : "Disconnected"
            }
            tone={netInfo?.connected ?? online ? "green" : "red"}
          />
          <DiagRow
            label="App state"
            value={appActive ? "Foreground" : "Background"}
            tone={appActive ? "green" : "amber"}
          />
          <DiagRow
            label="Sync engine"
            value={syncing ? "Running…" : "Idle"}
            tone={syncing ? "sky" : "muted"}
          />
          <DiagRow
            label="Last sync"
            value={
              diag.last_sync_at
                ? `${new Date(diag.last_sync_at).toLocaleTimeString()} (${diag.last_sync_trigger ?? "?"})`
                : "Never"
            }
            tone="muted"
          />
          <DiagRow
            label="Last result"
            value={
              diag.last_sync_result
                ? `${diag.last_sync_result.synced} sent · ${diag.last_sync_result.failed} failed`
                : "—"
            }
            tone={
              diag.last_sync_result && diag.last_sync_result.failed > 0 ? "red" : "muted"
            }
          />
          {diag.last_error && (
            <p className="text-[11px] text-red-400 break-words pt-1 border-t border-border/40">
              {diag.last_error}
            </p>
          )}
        </Card>
      </div>



      {/* Bulk actions */}
      {tab === "failed" && counts.failed > 0 && (
        <div className="px-3 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={handleClearErrors}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all failed
          </Button>
        </div>
      )}
      {tab === "synced" && counts.synced > 0 && (
        <div className="px-3 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={handleClearSynced}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </Button>
        </div>
      )}

      {/* List */}
      <div className="px-3 mt-3 flex flex-col gap-2">
        {visibleActions.length === 0 && visibleLogs.length === 0 && (
          <Card className="py-10 text-center text-sm text-muted-foreground">
            {tab === "pending" && "Nothing waiting to sync ✓"}
            {tab === "failed" && "No failed items 🎉"}
            {tab === "synced" && "No recent sync history"}
          </Card>
        )}

        {visibleActions.map((a) => (
          <ActionRow
            key={a.local_id}
            action={a}
            onRetry={() => handleRetryOne(a.local_id)}
            onRemove={() => handleRemove(a.local_id)}
            allowRetry={tab !== "synced"}
          />
        ))}

        {visibleLogs.map((l) => (
          <Card key={l.local_id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">
                Daily log · {l.photos.length} photo
                {l.photos.length === 1 ? "" : "s"}
              </p>
              <StatusPill status={l.sync_status} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Queued {new Date(l.queued_at).toLocaleString()}
            </p>
            {l.error_message && (
              <p className="text-[11px] text-red-400 mt-1 break-words">
                {l.error_message}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "amber" | "red" | "green";
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    amber: "text-amber-400 border-amber-500/40",
    red: "text-red-400 border-red-500/40",
    green: "text-emerald-400 border-emerald-500/40",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 text-left transition-all ${
        active ? `${toneClasses} ring-1 ring-current/30` : "border-border/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${active ? toneClasses : "text-muted-foreground"}`} />
        <span className={`text-lg font-semibold ${active ? toneClasses : ""}`}>{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "text-amber-400 border-amber-500/40",
    error: "text-red-400 border-red-500/40",
    synced: "text-emerald-400 border-emerald-500/40",
    syncing: "text-sky-400 border-sky-500/40",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${
        map[status] ?? "text-muted-foreground border-border"
      }`}
    >
      {status}
    </span>
  );
}

function ActionRow({
  action,
  onRetry,
  onRemove,
  allowRetry,
}: {
  action: QueuedAction;
  onRetry: () => void;
  onRemove: () => void;
  allowRetry: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium capitalize truncate">
          {action.action_type.replace(/_/g, " ")}
        </p>
        <StatusPill status={action.sync_status} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Queued {new Date(action.timestamp).toLocaleString()}
      </p>
      {(action.attempts ?? 0) > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Attempts: {action.attempts}
          {action.last_attempt_at &&
            ` · last ${new Date(action.last_attempt_at).toLocaleTimeString()}`}
        </p>
      )}
      {action.error_message && (
        <p className="text-[11px] text-red-400 mt-1 break-words">
          {action.error_message}
        </p>
      )}
      {allowRetry && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 gap-1.5"
            onClick={onRetry}
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-red-400 hover:text-red-300"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      )}
    </Card>
  );
}

function DiagRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "amber" | "sky" | "muted";
}) {
  const toneClass = {
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    sky: "text-sky-400",
    muted: "text-foreground/80",
  }[tone];
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${toneClass} text-right`}>{value}</span>
    </div>
  );
}

