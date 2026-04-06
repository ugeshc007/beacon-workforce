import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, Briefcase } from "lucide-react";

const reports = [
  { title: "Staff Utilization", description: "Employee utilization rates, capacity trends, and skill breakdown.", icon: Users, path: "/reports/utilization", color: "text-brand bg-brand/10" },
  { title: "Project Costs", description: "Labor, overtime, and expense costs per project with budget comparison.", icon: DollarSign, path: "/reports/costs", color: "text-status-traveling bg-status-traveling/10" },
  { title: "Executive Summary", description: "High-level KPIs, daily cost trend, and company-wide metrics.", icon: Briefcase, path: "/reports/executive", color: "text-status-overtime bg-status-overtime/10" },
];

export default function Reports() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Analytics and insights from your workforce data</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
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
