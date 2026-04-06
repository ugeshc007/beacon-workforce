import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return <EmptyState icon={BarChart3} title="Reports" description="Generate attendance, overtime, utilization, manpower, and cost reports with filters and export options." actionLabel="Generate Report" onAction={() => {}} />;
}
