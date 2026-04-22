import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Car,
  CalendarDays,
  ClipboardCheck,
  Clock,
  BarChart3,
  Settings,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useMyPermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { title: "Maintenance", url: "/maintenance", icon: Wrench, module: "maintenance" },
  { title: "Site Visits", url: "/site-visits", icon: ClipboardList, module: "site_visits" },
  { title: "Projects", url: "/projects", icon: FolderKanban, module: "projects" },
  { title: "Employees", url: "/employees", icon: Users, module: "employees" },
  { title: "Schedule", url: "/schedule", icon: CalendarDays, module: "schedule" },
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck, module: "attendance" },
  { title: "Travel", url: "/travel", icon: Car, module: "attendance" },
  { title: "Timesheets", url: "/timesheets", icon: Clock, module: "timesheets" },
];

const reportNav = [
  { title: "Schedule", url: "/reports/schedule", icon: BarChart3 },
  { title: "Utilization", url: "/reports/utilization", icon: BarChart3 },
  { title: "Cost Reports", url: "/reports/costs", icon: BarChart3 },
  { title: "Executive", url: "/reports/executive", icon: BarChart3 },
  { title: "All Reports", url: "/reports", icon: BarChart3 },
];

// Modules employees can access on the web portal
const EMPLOYEE_MODULES = ["dashboard", "projects", "schedule", "timesheets"];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const { permissions } = useMyPermissions();
  const { isAdmin, isEmployee } = useAuth();

  const canView = (module: string) => {
    if (isAdmin) return true;
    if (isEmployee) return EMPLOYEE_MODULES.includes(module);
    return permissions.get(module)?.can_view ?? false;
  };

  const visibleMain = mainNav.filter((item) => canView(item.module));
  const showReports = !isEmployee && canView("reports");
  const showSettings = !isEmployee && canView("settings");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src="/bebright-logo.png" alt="BeBright" className="h-9 w-auto shrink-0" />
          {!collapsed && (
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Planner</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-brand font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showReports && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">
              Reports
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {reportNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-brand font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {showSettings && (
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/settings")}>
                <NavLink
                  to="/settings"
                  end
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  activeClassName="bg-sidebar-accent text-brand font-medium"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Settings</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
