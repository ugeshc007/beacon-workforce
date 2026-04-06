import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

export default function Employees() {
  return <EmptyState icon={Users} title="No Employees Yet" description="Add your team members to start assigning them to projects and tracking their work hours." actionLabel="Add Employee" onAction={() => {}} />;
}
