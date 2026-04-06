import { useTravelingNow } from "@/hooks/useTravel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Navigation } from "lucide-react";
import { Link } from "react-router-dom";

export function TravelMapCard() {
  const { data: travelers, isLoading } = useTravelingNow();

  if (isLoading) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Car className="h-4 w-4 text-status-traveling" />
            Live Travel
          </CardTitle>
          <Link to="/travel" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
      </CardHeader>
      <CardContent>
        {!travelers?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">No employees currently traveling</p>
        ) : (
          <div className="space-y-2">
            {/* Visual map representation */}
            <div className="relative rounded-lg bg-muted/30 border border-border p-4 min-h-[140px] overflow-hidden">
              {/* Grid lines for map feel */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`h${i}`} className="absolute w-full border-t border-foreground" style={{ top: `${(i + 1) * 20}%` }} />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`v${i}`} className="absolute h-full border-l border-foreground" style={{ left: `${(i + 1) * 20}%` }} />
                ))}
              </div>

              {/* Traveling pins */}
              {travelers.map((t, i) => {
                // Distribute pins visually across the card
                const x = 15 + ((i * 37) % 70);
                const y = 15 + ((i * 29) % 60);
                const elapsedMin = Math.round((Date.now() - new Date(t.travel_start).getTime()) / 60000);

                return (
                  <div
                    key={t.employee_id}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    title={`${t.employee_name} → ${t.project_name}`}
                  >
                    <div className="relative">
                      <div className="h-6 w-6 rounded-full bg-status-traveling/20 border-2 border-status-traveling flex items-center justify-center animate-pulse">
                        <Navigation className="h-3 w-3 text-status-traveling" />
                      </div>
                    </div>
                    <span className="text-[8px] font-medium text-foreground mt-0.5 whitespace-nowrap max-w-[60px] truncate">
                      {t.employee_name.split(" ")[0]}
                    </span>
                    <span className="text-[7px] text-muted-foreground">{elapsedMin}m ago</span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] gap-1 border-status-traveling/50 text-status-traveling">
                <Car className="h-2.5 w-2.5" />{travelers.length} in transit
              </Badge>
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
              {travelers.map((t) => {
                const elapsedMin = Math.round((Date.now() - new Date(t.travel_start).getTime()) / 60000);
                return (
                  <div key={t.employee_id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                    <div>
                      <span className="text-foreground font-medium">{t.employee_name}</span>
                      <span className="text-muted-foreground ml-1">→ {t.project_name}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{elapsedMin}m</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
