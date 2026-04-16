import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, Briefcase, TrendingUp, Clock, CalendarX, AlertTriangle, UserCheck, CalendarDays } from "lucide-react";

const reports = [
  { title: "Schedule", description: "Daily assignments, employee coverage, team sizes, and staffing gaps.", icon: CalendarDays, path: "/reports/schedule", color: "text-brand bg-brand/10" },
  { title: "Staff Utilization", description: "Employee utilization rates, capacity trends, and skill breakdown.", icon: Users, path: "/reports/utilization", color: "text-brand bg-brand/10" },
  { title: "Attendance", description: "Punch-in rates, daily attendance trends, and punctuality analysis.", icon: UserCheck, path: "/reports/attendance", color: "text-status-present bg-status-present/10" },
  { title: "Overtime", description: "OT hours, costs, daily trends, and top overtime employees.", icon: Clock, path: "/reports/overtime", color: "text-status-overtime bg-status-overtime/10" },
  { title: "Project Costs", description: "Labor, overtime, and expense costs per project with budget comparison.", icon: DollarSign, path: "/reports/costs", color: "text-status-traveling bg-status-traveling/10" },
  { title: "Project Manpower", description: "Required vs assigned staff, fill rates, and skill distribution.", icon: Briefcase, path: "/reports/manpower", color: "text-brand bg-brand/10" },
  { title: "Absentee", description: "Absence frequency, leave tracking, unexcused absences, and day-of-week patterns.", icon: CalendarX, path: "/reports/absentee", color: "text-status-absent bg-status-absent/10" },
  { title: "Profitability", description: "Budget vs actual cost, gross margin analysis, and project-level P&L.", icon: TrendingUp, path: "/reports/profitability", color: "text-status-present bg-status-present/10" },
  { title: "Executive Summary", description: "High-level KPIs, daily cost trend, and company-wide metrics.", icon: BarChart3, path: "/reports/executive", color: "text-status-overtime bg-status-overtime/10" },
];

export default function Reports() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Analytics and insights from your workforce data</p>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {reports.map((r) => (
          <Card key={r.path} className="glass-card cursor-pointer hover:border-brand/40 transition-colors" onClick={() => navigate(r.path)}>
            <CardContent className="p-6 space-y-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${r.color}`}>
                <r.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
