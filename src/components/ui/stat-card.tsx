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
}

const variantStyles = {
  default: "text-muted-foreground bg-muted/50",
  brand: "text-brand bg-brand/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default", className }: StatCardProps) {
  return (
    <div className={cn("glass-card p-5 space-y-3 animate-fade-in", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", variantStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
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
