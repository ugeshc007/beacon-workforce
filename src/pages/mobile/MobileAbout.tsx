import { useNavigate } from "react-router-dom";
import { APP_VERSION, APP_BUILD } from "@/lib/app-version";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Smartphone, Hash, Tag } from "lucide-react";

export default function MobileAbout() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 p-4 pb-32 safe-area-inset">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/m/profile")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground hover:bg-brand/10 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-foreground">About</h1>
      </div>

      {/* App identity */}
      <div className="flex flex-col items-center gap-2 py-6">
        <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center">
          <Smartphone className="h-8 w-8 text-brand" />
        </div>
        <p className="text-lg font-bold text-foreground">BeBright Planner</p>
        <p className="text-xs text-muted-foreground">Workforce Management</p>
      </div>

      {/* Version info */}
      <Card className="border-border/50 bg-card divide-y divide-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Version</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Build Number</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{APP_BUILD}</span>
        </div>
      </Card>
    </div>
  );
}
