import { Link } from "react-router-dom";
import { MapPin, Calendar, ChevronRight, ClipboardCheck, Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useMySiteVisits, useMyTodaySiteVisits } from "@/hooks/useSiteVisits";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
  converted: "bg-purple-500/15 text-purple-400",
};

export default function MobileSiteVisits() {
  const { employee } = useMobileAuth();
  const { data: today = [], isLoading: todayLoading } = useMyTodaySiteVisits(employee?.id ?? null);
  const { data: allVisits = [], isLoading } = useMySiteVisits(employee?.id ?? null);

  // Other = not in today's list
  const todayIds = new Set(today.map((t) => t.visit.id));
  const other = allVisits.filter((v) => !todayIds.has(v.id));

  return (
    <div className="p-4 pb-24 space-y-4 safe-area-inset">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Site Visits</h1>
        <p className="text-sm text-muted-foreground">Sequential — finish one before starting the next</p>
      </div>

      {/* Today */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</h2>
        {todayLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : today.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No site visits for today.</Card>
        ) : (
          today.map(({ visit: v, isActive, isCompleted, isLocked }) => {
            const stateBadge = isCompleted ? (
              <Badge variant="outline" className="bg-green-500/15 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>
            ) : isActive ? (
              <Badge variant="outline" className="bg-blue-500/15 text-blue-400 animate-pulse"><PlayCircle className="h-3 w-3 mr-1" />Active</Badge>
            ) : isLocked ? (
              <Badge variant="outline" className="bg-muted text-muted-foreground"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
            ) : (
              <Badge variant="outline" className={statusColors[v.status]}>{v.status.replace("_", " ")}</Badge>
            );

            const Wrapper = isLocked ? "div" : Link;
            const wrapperProps = isLocked ? { className: "block opacity-60" } : { to: `/m/site-visits/${v.id}`, className: "block" };

            return (
              // @ts-expect-error dynamic wrapper
              <Wrapper key={v.id} {...wrapperProps}>
                <Card className={`p-4 transition-colors ${isActive ? "border-brand/60 bg-brand/5" : "hover:border-brand/40"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground truncate">{v.client_name}</h3>
                        {stateBadge}
                      </div>
                      {v.site_address && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{v.site_address}</p>}
                      {isLocked && <p className="text-xs text-amber-400 mt-1">Finish your active visit first.</p>}
                    </div>
                    {!isLocked && <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                  </div>
                </Card>
              </Wrapper>
            );
          })
        )}
      </section>

      {/* Other dates */}
      {other.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other Dates</h2>
          {other.map((v) => (
            <Link key={v.id} to={`/m/site-visits/${v.id}`}>
              <Card className="p-4 hover:border-brand/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground truncate">{v.client_name}</h3>
                      <Badge variant="outline" className={statusColors[v.status]}>{v.status.replace("_", " ")}</Badge>
                    </div>
                    {v.site_address && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{v.site_address}</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" />{v.visit_date}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {!isLoading && allVisits.length === 0 && (
        <Card className="p-8 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No site visits assigned.</p>
        </Card>
      )}
    </div>
  );
}
