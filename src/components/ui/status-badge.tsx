import { cn } from "@/lib/utils";

type StatusType = "present" | "traveling" | "absent" | "planned" | "overtime";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-status-present/15 text-status-present border-status-present/30" },
  traveling: { label: "Traveling", className: "bg-status-traveling/15 text-status-traveling border-status-traveling/30" },
  absent: { label: "Absent", className: "bg-status-absent/15 text-status-absent border-status-absent/30" },
  planned: { label: "Planned", className: "bg-status-planned/15 text-status-planned border-status-planned/30" },
  overtime: { label: "Overtime", className: "bg-status-overtime/15 text-status-overtime border-status-overtime/30" },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border",
        config.className,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
