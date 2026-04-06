import { EmptyState } from "@/components/ui/empty-state";
import { Clock } from "lucide-react";

export default function Timesheets() {
  return <EmptyState icon={Clock} title="No Timesheet Data" description="Timesheet summaries will be generated from attendance records. Export to Excel or PDF for payroll." />;
}
