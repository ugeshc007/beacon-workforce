import { initConnectivity } from "@/lib/connectivity";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { MobileAuthProvider } from "@/hooks/useMobileAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import SuperAdminLayout from "./pages/admin/SuperAdminLayout";
import SuperAdminOverview from "./pages/admin/SuperAdminOverview";
import CompaniesPage from "./pages/admin/CompaniesPage";
import AdminComingSoon from "./pages/admin/ComingSoon";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
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
import ScheduleReport from "./pages/reports/ScheduleReport";
import SiteVisitsReport from "./pages/reports/SiteVisitsReport";
import IdleTimeReport from "./pages/reports/IdleTimeReport";
import SettingsPage from "./pages/SettingsPage";
import HelpCenter from "./pages/HelpCenter";
import Maintenance from "./pages/Maintenance";
import MaintenanceDetail from "./pages/MaintenanceDetail";
import SiteVisits from "./pages/SiteVisits";
import SiteVisitDetail from "./pages/SiteVisitDetail";
import RecurringJobs from "./pages/RecurringJobs";
import CommonTasks from "./pages/CommonTasks";
import DeployConsole from "./pages/DeployConsole";
import ErrorAudit from "./pages/ErrorAudit";
import OAuthConsent from "./pages/OAuthConsent";

// Mobile screens
import MobileLogin from "./pages/mobile/MobileLogin";
import MobileLayout from "./pages/mobile/MobileLayout";
import MobileHome from "./pages/mobile/MobileHome";
import MobileTimesheet from "./pages/mobile/MobileTimesheet";
import MobileCommonTasks from "./pages/mobile/MobileCommonTasks";
import MobileNotifications from "./pages/mobile/MobileNotifications";
import MobileProfile from "./pages/mobile/MobileProfile";
import MobileSyncStatus from "./pages/mobile/MobileSyncStatus";
import MobileAbout from "./pages/mobile/MobileAbout";

import MobileTeamStatus from "./pages/mobile/MobileTeamStatus";
import MobileDailyLog from "./pages/mobile/MobileDailyLog";
import MobileSiteVisits from "./pages/mobile/MobileSiteVisits";
import MobileSiteVisitDetail from "./pages/mobile/MobileSiteVisitDetail";
import MobileProjectWorkflow from "./pages/mobile/MobileProjectWorkflow";

// Offline-tolerant defaults: don't burn the main thread on long retry chains
// when the device has no connection (the classic "app slow after unlock").
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      retry: 1,
      retryDelay: 1500,
      staleTime: 15_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
    },
    mutations: { networkMode: "offlineFirst", retry: 0 },
  },
});

initConnectivity();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TenantProvider>
        <Routes>
          {/* ── Mobile App Routes ── */}
          <Route path="/m/login" element={<MobileAuthProvider><MobileLogin /></MobileAuthProvider>} />
          <Route path="/m" element={<MobileAuthProvider><MobileLayout /></MobileAuthProvider>}>
            <Route index element={<MobileHome />} />
            <Route path="timesheet" element={<MobileTimesheet />} />
            <Route path="common-tasks" element={<MobileCommonTasks />} />
            <Route path="notifications" element={<MobileNotifications />} />
            <Route path="team" element={<MobileTeamStatus />} />
            <Route path="daily-log" element={<MobileDailyLog />} />
            <Route path="site-visits" element={<MobileSiteVisits />} />
            <Route path="site-visits/:id" element={<MobileSiteVisitDetail />} />
            <Route path="project/:projectId" element={<MobileProjectWorkflow />} />
            <Route path="profile" element={<MobileProfile />} />
            <Route path="sync" element={<MobileSyncStatus />} />
            <Route path="about" element={<MobileAbout />} />

          </Route>

          {/* ── Super Admin Console ── */}
          <Route
            element={
              <AuthProvider>
                <ProtectedRoute>
                  <SuperAdminLayout />
                </ProtectedRoute>
              </AuthProvider>
            }
          >
            <Route path="/admin" element={<SuperAdminOverview />} />
            <Route path="/admin/companies" element={<CompaniesPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/activity" element={<AdminComingSoon title="Platform Activity" />} />
          </Route>

          {/* ── Admin Portal Routes ── */}
          <Route path="/login" element={<AuthProvider><Login /></AuthProvider>} />
          <Route path="/forgot-password" element={<AuthProvider><ForgotPassword /></AuthProvider>} />
          <Route path="/reset-password" element={<AuthProvider><ResetPassword /></AuthProvider>} />
          <Route path="/.lovable/oauth/consent" element={<AuthProvider><OAuthConsent /></AuthProvider>} />
          <Route path="/" element={<AuthProvider><Index /></AuthProvider>} />
          <Route
            element={
              <AuthProvider>
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              </AuthProvider>
            }
          >
            <Route path="/dashboard" element={<ModuleGuard module="dashboard"><Dashboard /></ModuleGuard>} />
            <Route path="/projects" element={<ModuleGuard module="projects"><Projects /></ModuleGuard>} />
            <Route path="/projects/gantt" element={<ModuleGuard module="projects"><ProjectGantt /></ModuleGuard>} />
            <Route path="/projects/:id" element={<ModuleGuard module="projects"><ProjectDetail /></ModuleGuard>} />
            <Route path="/employees" element={<ModuleGuard module="employees"><Employees /></ModuleGuard>} />
            <Route path="/schedule" element={<ModuleGuard module="schedule"><Schedule /></ModuleGuard>} />
            <Route path="/schedule/deploy" element={<ModuleGuard module="schedule"><DeployConsole /></ModuleGuard>} />
            <Route path="/schedule/common-tasks" element={<ModuleGuard module="schedule"><CommonTasks /></ModuleGuard>} />
            <Route path="/attendance" element={<ModuleGuard module="attendance"><Attendance /></ModuleGuard>} />
            <Route path="/attendance/daily" element={<ModuleGuard module="attendance"><DailyTeam /></ModuleGuard>} />
            <Route path="/travel" element={<ModuleGuard module="attendance"><Travel /></ModuleGuard>} />
            <Route path="/timesheets" element={<ModuleGuard module="timesheets"><Timesheets /></ModuleGuard>} />
            <Route path="/recurring-jobs" element={<ModuleGuard module="projects"><RecurringJobs /></ModuleGuard>} />
            <Route path="/maintenance" element={<ModuleGuard module="maintenance"><Maintenance /></ModuleGuard>} />
            <Route path="/maintenance/:id" element={<ModuleGuard module="maintenance"><MaintenanceDetail /></ModuleGuard>} />
            <Route path="/site-visits" element={<ModuleGuard module="site_visits"><SiteVisits /></ModuleGuard>} />
            <Route path="/site-visits/:id" element={<ModuleGuard module="site_visits"><SiteVisitDetail /></ModuleGuard>} />
            <Route path="/reports" element={<ModuleGuard module="reports"><Reports /></ModuleGuard>} />
            <Route path="/reports/utilization" element={<ModuleGuard module="reports"><Utilization /></ModuleGuard>} />
            <Route path="/reports/costs" element={<ModuleGuard module="reports"><CostReports /></ModuleGuard>} />
            <Route path="/reports/profitability" element={<ModuleGuard module="reports"><Profitability /></ModuleGuard>} />
            <Route path="/reports/executive" element={<ModuleGuard module="reports"><Executive /></ModuleGuard>} />
            <Route path="/reports/attendance" element={<ModuleGuard module="reports"><AttendanceReport /></ModuleGuard>} />
            <Route path="/reports/overtime" element={<ModuleGuard module="reports"><OvertimeReport /></ModuleGuard>} />
            <Route path="/reports/manpower" element={<ModuleGuard module="reports"><ManpowerReport /></ModuleGuard>} />
            <Route path="/reports/absentee" element={<ModuleGuard module="reports"><AbsenteeReport /></ModuleGuard>} />
            <Route path="/reports/schedule" element={<ModuleGuard module="reports"><ScheduleReport /></ModuleGuard>} />
            <Route path="/reports/site-visits" element={<ModuleGuard module="reports"><SiteVisitsReport /></ModuleGuard>} />
            <Route path="/reports/idle-time" element={<ModuleGuard module="reports"><IdleTimeReport /></ModuleGuard>} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/audit" element={<ModuleGuard module="settings"><ErrorAudit /></ModuleGuard>} />
            <Route path="/settings" element={<ModuleGuard module="settings"><SettingsPage /></ModuleGuard>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </TenantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
