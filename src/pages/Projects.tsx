import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban } from "lucide-react";

export default function Projects() {
  return <EmptyState icon={FolderKanban} title="No Projects Yet" description="Create your first project to start managing LED wall installations and assignments." actionLabel="Create Project" onAction={() => {}} />;
}
