import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export default function Utilization() {
  return <EmptyState icon={BarChart3} title="Staff Utilization" description="View employee utilization rates, worked vs idle hours, and identify capacity trends." />;
}
