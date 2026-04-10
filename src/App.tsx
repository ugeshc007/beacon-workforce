import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { MobileAuthProvider } from "@/hooks/useMobileAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectGantt from "./pages/ProjectGantt";
import Employees from "./pages/Employees";
import Schedule from "./pages/Schedule";
import Attendance from "./pages/Attendance";
import DailyTeam from "./pages/DailyTeam";
import Travel from "./pages/Travel";
import Timesheets from "./pages/Timesheets";
import Reports from "./pages/Reports";
import Utilization from "./pages/reports/Utilization";
import CostReports from "./pages/reports/CostReports";
import Profitability from "./pages/reports/Profitability";
import Executive from "./pages/reports/Executive";
import AttendanceReport from "./pages/reports/AttendanceReport";
import OvertimeReport from "./pages/reports/OvertimeReport";
import ManpowerReport from "./pages/reports/ManpowerReport";
import AbsenteeReport from "./pages/reports/AbsenteeReport";
import SettingsPage from "./pages/SettingsPage";
import Maintenance from "./pages/Maintenance";
import MaintenanceDetail from "./pages/MaintenanceDetail";

// Mobile screens
import MobileLogin from "./pages/mobile/MobileLogin";
import MobileLayout from "./pages/mobile/MobileLayout";
import MobileHome from "./pages/mobile/MobileHome";
import MobileTimesheet from "./pages/mobile/MobileTimesheet";
import MobileNotifications from "./pages/mobile/MobileNotifications";
import MobileProfile from "./pages/mobile/MobileProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* ── Mobile App Routes ── */}
          <Route path="/m/login" element={<MobileAuthProvider><MobileLogin /></MobileAuthProvider>} />
          <Route
            path="/m"
            element={<MobileAuthProvider><MobileLayout /></MobileAuthProvider>}
          >
            <Route index element={<MobileHome />} />
            <Route path="timesheet" element={<MobileTimesheet />} />
            <Route path="notifications" element={<MobileNotifications />} />
            <Route path="profile" element={<MobileProfile />} />
          </Route>

          {/* ── Admin Portal Routes ── */}
          <Route element={<AuthProvider><Routes><Route path="/login" element={<Login />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/" element={<Index />} /><Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}><Route path="/dashboard" element={<ModuleGuard module="dashboard"><Dashboard /></ModuleGuard>} /><Route path="/projects" element={<ModuleGuard module="projects"><Projects /></ModuleGuard>} /><Route path="/projects/gantt" element={<ModuleGuard module="projects"><ProjectGantt /></ModuleGuard>} /><Route path="/projects/:id" element={<ModuleGuard module="projects"><ProjectDetail /></ModuleGuard>} /><Route path="/employees" element={<ModuleGuard module="employees"><Employees /></ModuleGuard>} /><Route path="/schedule" element={<ModuleGuard module="schedule"><Schedule /></ModuleGuard>} /><Route path="/attendance" element={<ModuleGuard module="attendance"><Attendance /></ModuleGuard>} /><Route path="/attendance/daily" element={<ModuleGuard module="attendance"><DailyTeam /></ModuleGuard>} /><Route path="/travel" element={<ModuleGuard module="attendance"><Travel /></ModuleGuard>} /><Route path="/timesheets" element={<ModuleGuard module="timesheets"><Timesheets /></ModuleGuard>} /><Route path="/maintenance" element={<ModuleGuard module="maintenance"><Maintenance /></ModuleGuard>} /><Route path="/maintenance/:id" element={<ModuleGuard module="maintenance"><MaintenanceDetail /></ModuleGuard>} /><Route path="/reports" element={<ModuleGuard module="reports"><Reports /></ModuleGuard>} /><Route path="/reports/utilization" element={<ModuleGuard module="reports"><Utilization /></ModuleGuard>} /><Route path="/reports/costs" element={<ModuleGuard module="reports"><CostReports /></ModuleGuard>} /><Route path="/reports/profitability" element={<ModuleGuard module="reports"><Profitability /></ModuleGuard>} /><Route path="/reports/executive" element={<ModuleGuard module="reports"><Executive /></ModuleGuard>} /><Route path="/reports/attendance" element={<ModuleGuard module="reports"><AttendanceReport /></ModuleGuard>} /><Route path="/reports/overtime" element={<ModuleGuard module="reports"><OvertimeReport /></ModuleGuard>} /><Route path="/reports/manpower" element={<ModuleGuard module="reports"><ManpowerReport /></ModuleGuard>} /><Route path="/reports/absentee" element={<ModuleGuard module="reports"><AbsenteeReport /></ModuleGuard>} /><Route path="/settings" element={<ModuleGuard module="settings"><SettingsPage /></ModuleGuard>} /></Route><Route path="*" element={<NotFound />} /></Routes></AuthProvider>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
