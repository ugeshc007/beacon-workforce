import { Link } from "react-router-dom";
import { MapPin, Calendar, ChevronRight, ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useMySiteVisits } from "@/hooks/useSiteVisits";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
  converted: "bg-purple-500/15 text-purple-400",
};

export default function MobileSiteVisits() {
  const { employee } = useMobileAuth();
  const { data: visits = [], isLoading } = useMySiteVisits(employee?.id ?? null);

  return (
    <div className="p-4 pb-24 space-y-3 safe-area-inset">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Site Visits</h1>
        <p className="text-sm text-muted-foreground">Visits assigned to you</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : visits.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No site visits assigned.</p>
        </Card>
      ) : (
        visits.map((v) => (
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
        ))
      )}
    </div>
  );
}
