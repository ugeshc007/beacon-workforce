import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export default function CostReports() {
  return <EmptyState icon={BarChart3} title="Project Cost Reports" description="Analyze labor, overtime, and expense costs across all projects with budget vs actual comparisons." />;
}
