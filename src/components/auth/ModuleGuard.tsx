import { Navigate } from "react-router-dom";
import { useCanAccess } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface ModuleGuardProps {
  module: string;
  children: React.ReactNode;
}

/** Blocks access to a page if the user's role doesn't have can_view for that module */
export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { allowed, isLoading } = useCanAccess(module);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
