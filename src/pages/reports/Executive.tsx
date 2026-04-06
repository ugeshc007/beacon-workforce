import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export default function Executive() {
  return <EmptyState icon={BarChart3} title="Executive Summary" description="High-level KPIs, company-wide utilization, branch comparisons, and top project costs at a glance." />;
}
