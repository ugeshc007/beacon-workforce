import { Navigate } from "react-router-dom";
import { useCanAccess } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Modules employees can access on the web portal
const EMPLOYEE_MODULES = ["dashboard", "projects", "schedule", "timesheets"];

interface ModuleGuardProps {
  module: string;
  children: React.ReactNode;
}

/** Blocks access to a page if the user's role doesn't have can_view for that module */
export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { allowed, isLoading } = useCanAccess(module);
  const { isEmployee, loading: authLoading } = useAuth();

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  // Employees get access to a fixed set of modules
  if (isEmployee) {
    if (!EMPLOYEE_MODULES.includes(module)) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
