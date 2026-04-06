import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";

export default function Schedule() {
  return <EmptyState icon={CalendarDays} title="No Schedules Yet" description="Plan weekly assignments and manage recurring schedules for your projects." actionLabel="Create Schedule" onAction={() => {}} />;
}
