import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "brand" | "success" | "warning" | "destructive";
  className?: string;
  compact?: boolean;
}

const variantStyles = {
  default: "text-muted-foreground bg-muted/50",
  brand: "text-brand bg-brand/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default", className, compact = false }: StatCardProps) {
  return (
    <div className={cn("glass-card animate-fade-in", compact ? "p-3 space-y-1.5" : "p-5 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className={cn("font-medium text-muted-foreground uppercase tracking-wider", compact ? "text-[10px]" : "text-xs")}>{title}</span>
        <div className={cn("rounded-lg flex items-center justify-center", compact ? "h-6 w-6" : "h-8 w-8", variantStyles[variant])}>
          <Icon className={compact ? "h-3 w-3" : "h-4 w-4"} />
        </div>
      </div>
      <div>
        <p className={cn("font-bold text-foreground tracking-tight", compact ? "text-lg" : "text-2xl")}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {trend && (
        <p className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </p>
      )}
    </div>
  );
}
