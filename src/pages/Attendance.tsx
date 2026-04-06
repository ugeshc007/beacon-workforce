import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardCheck } from "lucide-react";

export default function Attendance() {
  return <EmptyState icon={ClipboardCheck} title="No Attendance Records" description="Attendance data will appear here once employees start punching in from the field app." />;
}
