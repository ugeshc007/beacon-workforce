import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { session, loading } = useAuth();
  
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}
