import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Card } from "@/components/ui/card";
import { Bell, Check, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  reference_id: string | null;
  reference_type: string | null;
}

export default function MobileNotifications() {
  const { employee } = useMobileAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("employee_notifications")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications((data as Notification[]) || []);
      setLoading(false);
    };

    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel("emp-notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "employee_notifications",
        filter: `employee_id=eq.${employee.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employee]);

  const markRead = async (id: string) => {
    await supabase
      .from("employee_notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    if (n.reference_type === "project" && n.reference_id) {
      navigate(`/m/project/${n.reference_id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 pb-24 safe-area-inset">
      <h1 className="text-xl font-bold text-foreground">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
          <Bell className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        notifications.map((n) => {
          const isProjectLink = n.reference_type === "project" && !!n.reference_id;
          return (
            <Card
              key={n.id}
              onClick={() => handleClick(n)}
              className={`p-4 border-border/50 transition-colors ${
                n.is_read ? "bg-card opacity-60" : "bg-card"
              } ${isProjectLink ? "cursor-pointer hover:bg-card/80 hover:border-brand/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {new Date(n.created_at).toLocaleString("en-AE", { timeZone: "Asia/Dubai" })}
                  </p>
                  {isProjectLink && (
                    <p className="text-[10px] text-brand mt-1 font-medium">
                      Tap to open project →
                    </p>
                  )}
                </div>
                {!n.is_read ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                ) : isProjectLink ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : null}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
