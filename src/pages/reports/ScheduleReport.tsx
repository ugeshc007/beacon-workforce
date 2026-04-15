import { useState } from "react";
import { useScheduleReport } from "@/hooks/useScheduleReport";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, CalendarDays, Users, FolderKanban, UsersRound, AlertTriangle } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";

export default function ScheduleReport() {
  const [dateRange, setDateRange] = useReportDateRange("This Month");
  const { data, isLoading } = useScheduleReport(dateRange.start, dateRange.end);

  const handleCsv = (tab: string) => {
    if (!data) return;
    if (tab === "daily") {
      downloadCsv("schedule-daily.csv", ["Date", "Time", "Project", "Tasks", "Team Members", "Location"],
        data.dailyOverview.map((r) => [r.date, r.shiftStart && r.shiftEnd ? `${r.shiftStart.slice(0,5)}–${r.shiftEnd.slice(0,5)}` : "—", r.project, r.tasks.join("; ") || "—", r.teamNames.join(", "), r.location]));
    } else if (tab === "employee") {
      const available = data.employeeSummary.filter((r) => r.status !== "scheduled");
      downloadCsv("schedule-available-employees.csv", ["Employee", "Code", "Skill"],
        available.map((r) => [r.name, r.code, r.skillType?.replace("_", " ") ?? "—"]));
    } else if (tab === "coverage") {
      downloadCsv("schedule-coverage.csv", ["Project", "Days Active", "Avg Team", "Required", "Assigned", "Fill Rate %"],
        data.projectCoverage.map((r) => [r.project, r.daysActive, r.avgTeamSize, r.required, r.assigned, r.fillRate]));
    } else if (tab === "gaps") {
      downloadCsv("schedule-gaps.csv", ["Date", "Project", "Required", "Assigned", "Gap"],
        data.unscheduledDays.map((r) => [r.date, r.project, r.required, r.assigned, r.gap]));
    }
  };

  const handlePdf = () => {
    if (!data) return;
    exportReportPdf({
      title: "Schedule Report",
      subtitle: `${dateRange.start} — ${dateRange.end}`,
      filename: "schedule-report.pdf",
      summaryCards: [
        { label: "Total Assignments", value: String(data.summary.totalAssignments) },
        { label: "Unique Employees", value: String(data.summary.uniqueEmployees) },
        { label: "Projects Covered", value: String(data.summary.projectsCovered) },
        { label: "Avg Team Size", value: String(data.summary.avgTeamSize) },
      ],
      tables: [
        {
          title: "Daily Schedule Overview",
          headers: ["Date", "Time", "Project", "Tasks", "Team Members", "Location"],
          rows: data.dailyOverview.map((r) => [r.date, r.shiftStart && r.shiftEnd ? `${r.shiftStart.slice(0,5)}–${r.shiftEnd.slice(0,5)}` : "—", r.project, r.tasks.join("; ") || "—", r.teamNames.join(", "), r.location]),
        },
        {
          title: "Available Employees (Not Scheduled)",
          headers: ["Employee", "Code", "Skill"],
          rows: data.employeeSummary.filter((r) => r.status !== "scheduled").map((r) => [r.name, r.code, r.skillType?.replace("_", " ") ?? "—"]),
        },
        {
          title: "Project Coverage",
          headers: ["Project", "Days Active", "Avg Team", "Required", "Fill Rate %"],
          rows: data.projectCoverage.map((r) => [r.project, r.daysActive, r.avgTeamSize, r.required, r.fillRate]),
        },
        {
          title: "Under-Staffed Days",
          headers: ["Date", "Project", "Required", "Assigned", "Gap"],
          rows: data.unscheduledDays.map((r) => [r.date, r.project, r.required, r.assigned, r.gap]),
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Schedule Report</h1>
          <p className="text-sm text-muted-foreground">{dateRange.label}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <ReportDateFilter value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handlePdf} disabled={!data}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Assignments" value={data.summary.totalAssignments} icon={CalendarDays} />
            <StatCard title="Unique Employees" value={data.summary.uniqueEmployees} icon={Users} />
            <StatCard title="Projects Covered" value={data.summary.projectsCovered} icon={FolderKanban} />
            <StatCard title="Avg Team Size" value={data.summary.avgTeamSize} icon={UsersRound} />
          </div>

          <Tabs defaultValue="daily">
            <TabsList>
              <TabsTrigger value="daily">Daily Overview</TabsTrigger>
              <TabsTrigger value="employee">Employees</TabsTrigger>
              <TabsTrigger value="coverage">Coverage</TabsTrigger>
              <TabsTrigger value="gaps">
                Gaps {data.unscheduledDays.length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1">{data.unscheduledDays.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleCsv("daily")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              <Card>
                <CardContent className="p-0 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Time</th>
                        <th className="text-left p-3">Project</th>
                        <th className="text-left p-3">Tasks</th>
                        <th className="text-left p-3">Team Members</th>
                        <th className="text-left p-3">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dailyOverview.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30 align-top">
                          <td className="p-3 text-foreground whitespace-nowrap">{r.date}</td>
                          <td className="p-3 text-foreground whitespace-nowrap text-xs">
                            {r.shiftStart || r.shiftEnd
                              ? `${r.shiftStart?.slice(0,5) ?? "—"} – ${r.shiftEnd?.slice(0,5) ?? "—"}`
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 font-medium text-foreground">{r.project}</td>
                          <td className="p-3">
                            {r.tasks.length > 0 ? (
                              <div className="space-y-0.5">
                                {r.tasks.map((t, j) => (
                                  <p key={j} className="text-xs text-foreground">• {t}</p>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {r.teamNames.map((name, j) => (
                                <Badge key={j} variant="secondary" className="text-[10px] font-normal">{name}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{r.location}</td>
                        </tr>
                      ))}
                      {data.dailyOverview.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No assignments found</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employee" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleCsv("employee")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              {(() => {
                const available = data.employeeSummary.filter((r) => r.status !== "scheduled");
                const skillGroups = new Map<string, typeof available>();
                for (const emp of available) {
                  const skill = emp.skillType?.replace("_", " ") ?? "other";
                  if (!skillGroups.has(skill)) skillGroups.set(skill, []);
                  skillGroups.get(skill)!.push(emp);
                }
                const sortedSkills = [...skillGroups.keys()].sort();

                if (available.length === 0) {
                  return (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">All employees are scheduled</CardContent>
                    </Card>
                  );
                }

                return sortedSkills.map((skill) => (
                  <Card key={skill}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground capitalize flex items-center gap-2">
                        {skill}
                        <Badge variant="secondary" className="text-[10px]">{skillGroups.get(skill)!.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground text-xs">
                            <th className="text-left p-3">Employee</th>
                            <th className="text-left p-3">Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skillGroups.get(skill)!.map((r, i) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="p-3 font-medium text-foreground">{r.name}</td>
                              <td className="p-3 text-muted-foreground">{r.code}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                ));
              })()}
            </TabsContent>

            <TabsContent value="coverage" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleCsv("coverage")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              <Card>
                <CardContent className="p-0 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left p-3">Project</th>
                        <th className="text-center p-3">Days Active</th>
                        <th className="text-center p-3">Avg Team</th>
                        <th className="text-center p-3">Required</th>
                        <th className="text-center p-3">Fill Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projectCoverage.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3 font-medium text-foreground">{r.project}</td>
                          <td className="p-3 text-center">{r.daysActive}</td>
                          <td className="p-3 text-center">{r.avgTeamSize}</td>
                          <td className="p-3 text-center">{r.required}</td>
                          <td className="p-3 text-center">
                            <Badge variant={r.fillRate >= 100 ? "default" : r.fillRate >= 80 ? "secondary" : "destructive"} className="text-[10px]">
                              {r.fillRate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gaps" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleCsv("gaps")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              <Card>
                <CardContent className="p-0 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Project</th>
                        <th className="text-center p-3">Required</th>
                        <th className="text-center p-3">Assigned</th>
                        <th className="text-center p-3">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.unscheduledDays.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3 text-foreground">{r.date}</td>
                          <td className="p-3 font-medium text-foreground">{r.project}</td>
                          <td className="p-3 text-center">{r.required}</td>
                          <td className="p-3 text-center">{r.assigned}</td>
                          <td className="p-3 text-center">
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-0.5" /> -{r.gap}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {data.unscheduledDays.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">All projects fully staffed 🎉</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
