import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Users,
  CalendarDays,
  ClipboardCheck,
  Car,
  Clock,
  BarChart3,
  Wrench,
  ClipboardList,
  Settings,
  Smartphone,
  Shield,
  HelpCircle,
} from "lucide-react";

type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  summary: string;
  topics: { q: string; a: React.ReactNode; tags?: string[] }[];
};

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: HelpCircle,
    summary: "Login, navigation basics and roles.",
    topics: [
      {
        q: "How do I log in?",
        a: (
          <p>
            Open the portal URL and enter your email and password on the <b>Login</b> page. Forgot password? Use the
            <b> Forgot Password</b> link to receive a reset email.
          </p>
        ),
      },
      {
        q: "What are the user roles?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Admin</b> — full access to all modules and Settings.</li>
            <li><b>Manager</b> — projects, schedule, attendance, reports (per permissions).</li>
            <li><b>Employee</b> — limited web access (Dashboard, Projects, Schedule, Timesheets) and full Mobile app.</li>
          </ul>
        ),
      },
      {
        q: "How do I change my password?",
        a: (
          <p>
            Click your avatar in the top-right header → <b>Change Password</b>.
          </p>
        ),
      },
      {
        q: "Light / Dark mode",
        a: <p>Use the sun/moon icon in the top-right header to toggle the theme.</p>,
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    summary: "Live overview of today's operations.",
    topics: [
      {
        q: "What does the Dashboard show?",
        a: (
          <p>
            KPIs for today: present/absent counts, ongoing projects, travel map of teams in transit, alerts
            (missed punches, overtime), and the morning briefing.
          </p>
        ),
      },
      {
        q: "Where is the Morning Briefing?",
        a: <p>Top-right header → bell/megaphone icon. It auto-generates a daily summary you can share.</p>,
      },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    icon: FolderKanban,
    summary: "Create projects, assign teams, track costs.",
    topics: [
      {
        q: "How do I create a project?",
        a: (
          <p>
            Go to <b>Projects → + New Project</b>. Fill name, client, location (pick on map), start/end dates,
            estimated cost, and skills required. Save.
          </p>
        ),
      },
      {
        q: "How do I import projects from CSV?",
        a: <p>Projects page → <b>Import CSV</b> button. Download the sample template, fill rows, upload.</p>,
      },
      {
        q: "Where do I see project costs?",
        a: (
          <p>
            Open a project → <b>Costs</b> tab. Shows labor, expenses, purchase invoices and profit margin.
            Use <b>Bulk Expense</b> or <b>Purchase Invoice</b> buttons to add costs.
          </p>
        ),
      },
      {
        q: "Daily log per project",
        a: <p>Project detail → <b>Daily Log</b> tab. Shows site supervisor entries and photos from the mobile app.</p>,
      },
      {
        q: "Gantt view",
        a: <p>Projects → <b>Gantt</b> button (top right) shows all projects on a timeline.</p>,
      },
    ],
  },
  {
    id: "employees",
    title: "Employees",
    icon: Users,
    summary: "Manage workforce, skills, leave and logins.",
    topics: [
      {
        q: "How do I add an employee?",
        a: (
          <p>
            <b>Employees → + New Employee</b>. Enter name, role, skills, hourly rate, document expiries (visa,
            passport, license).
          </p>
        ),
      },
      {
        q: "How do I create a mobile login for an employee?",
        a: (
          <p>
            Open the employee row → <b>Create Login</b>. The system generates credentials for the BeBright
            mobile app.
          </p>
        ),
      },
      {
        q: "Marking leave",
        a: <p>Employee row → <b>Mark Leave</b> → choose date range and leave type (annual, sick, unpaid).</p>,
      },
      {
        q: "Bulk import",
        a: <p>Employees page → <b>Import CSV</b>. Use the provided template.</p>,
      },
    ],
  },
  {
    id: "schedule",
    title: "Schedule",
    icon: CalendarDays,
    summary: "Plan who works on which project each day.",
    topics: [
      {
        q: "How do I assign someone to a project?",
        a: (
          <p>
            Open <b>Schedule</b>, pick the date, click the project row → the day panel opens on the right.
            Pick employees from the list to add them.
          </p>
        ),
      },
      {
        q: "In-House vs Site",
        a: (
          <p>
            Each assigned employee has <Badge variant="secondary">In-House</Badge> /{" "}
            <Badge variant="secondary">Site</Badge> toggles next to their name. Tag each person individually
            so cost reports split correctly.
          </p>
        ),
      },
      {
        q: "Auto-assign",
        a: <p>Schedule page → <b>Auto-assign</b> uses skill match and availability to suggest a team.</p>,
      },
    ],
  },
  {
    id: "attendance",
    title: "Attendance & Travel",
    icon: ClipboardCheck,
    summary: "Punches, GPS, overrides.",
    topics: [
      {
        q: "Where do I see today's punches?",
        a: <p><b>Attendance</b> page lists every employee with punch-in / punch-out, hours, and status badge.</p>,
      },
      {
        q: "Daily Team view",
        a: <p><b>Attendance → Daily Team</b> shows a team-by-team matrix for the chosen date.</p>,
      },
      {
        q: "Manual override (e.g. employee forgot to punch out)",
        a: (
          <p>
            Click the employee row → <b>Override</b>. Set the correct in/out times. The system recalculates
            hours and costs automatically.
          </p>
        ),
      },
      {
        q: "Travel page",
        a: <p><b>Travel</b> shows live GPS pings of teams traveling to/from sites (data from the mobile app).</p>,
      },
    ],
  },
  {
    id: "driver-workflow",
    title: "Driver Workflow",
    icon: Car,
    summary: "Multi-leg driver flow on the mobile app.",
    topics: [
      {
        q: "How does a driver use the app?",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Punch In at office.</li>
            <li>Select pre-assigned project → <b>Start Travel</b>.</li>
            <li>Arrive site → <b>Drop Off</b> / <b>Pickup</b> / <b>Wait</b> (waiting is paid).</li>
            <li>End leg → start travel to next pre-assigned project.</li>
            <li>Return to office → <b>Punch Out</b>.</li>
          </ol>
        ),
      },
      {
        q: "How is driver cost split across projects?",
        a: <p>Time on each leg is allocated to that project. Reports automatically show the split per project.</p>,
      },
      {
        q: "Driver who also works as technician",
        a: <p>Assign them as a technician in the schedule — they then follow the standard technician flow.</p>,
      },
    ],
  },
  {
    id: "timesheets",
    title: "Timesheets",
    icon: Clock,
    summary: "Approve hours and overtime.",
    topics: [
      {
        q: "How do I approve a timesheet?",
        a: <p>Open <b>Timesheets</b>, filter by week, click an entry → <b>Approve</b> or <b>Reject</b>.</p>,
      },
      {
        q: "Overtime rules",
        a: <p>Anything beyond the standard daily hours configured in <b>Settings</b> is flagged purple as overtime.</p>,
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    icon: Wrench,
    summary: "Track warranty jobs and assignments.",
    topics: [
      {
        q: "Create a maintenance job",
        a: <p><b>Maintenance → + New</b>. Link to original project, set warranty/SLA, assign a team.</p>,
      },
      {
        q: "Warranty alerts",
        a: <p>The system pushes alerts before warranty expiry. View them on the Dashboard and Notifications panel.</p>,
      },
    ],
  },
  {
    id: "site-visits",
    title: "Site Visits",
    icon: ClipboardList,
    summary: "Pre-sales / survey visits.",
    topics: [
      {
        q: "Schedule a site visit",
        a: <p><b>Site Visits → + New Visit</b>. Set client, address, date and assigned surveyor.</p>,
      },
      {
        q: "Survey report",
        a: <p>Open the visit → <b>Report</b> section shows photos, notes and findings captured on the mobile app.</p>,
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    icon: BarChart3,
    summary: "Schedule, attendance, costs, profitability and more.",
    topics: [
      {
        q: "Where do I find each report?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Schedule Report</b> — daily team breakdown with In-House/Site tags.</li>
            <li><b>Cost Report</b> — labor + expenses per project.</li>
            <li><b>Utilization</b> — % of time each employee was billable.</li>
            <li><b>Overtime</b> — OT hours by employee/period.</li>
            <li><b>Manpower</b> — headcount per project per day.</li>
            <li><b>Absentee</b> — who missed work and why.</li>
            <li><b>Executive</b> — top-level KPIs for management.</li>
            <li><b>Profitability</b> — revenue vs cost per project.</li>
            <li><b>Site Visits</b> — survey activity report.</li>
          </ul>
        ),
      },
      {
        q: "Export to PDF / CSV",
        a: <p>Every report has <b>Export PDF</b> and <b>Export CSV</b> buttons in its top-right corner.</p>,
      },
      {
        q: "Why are some costs AED 0?",
        a: (
          <p>
            Costs are computed from punch-in to punch-out × hourly rate. If an employee never punched out, or
            the hourly rate is missing, the value will be 0. Fix via <b>Attendance → Override</b> and ensure
            the employee profile has a rate.
          </p>
        ),
      },
    ],
  },
  {
    id: "mobile-app",
    title: "Mobile App",
    icon: Smartphone,
    summary: "What field staff see on Android.",
    topics: [
      {
        q: "Logging in to the mobile app",
        a: <p>Use the credentials generated by your admin via <b>Employees → Create Login</b>.</p>,
      },
      {
        q: "Daily flow (technician)",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Punch In at office.</li>
            <li>Travel → Arrive Site → Start Work.</li>
            <li>Take breaks as needed.</li>
            <li>End Work → Return Travel → Arrive Office → Punch Out.</li>
          </ol>
        ),
      },
      {
        q: "Daily Log & Photos",
        a: <p>From the project screen tap <b>Daily Log</b> to add notes and photos for the supervisor.</p>,
      },
      {
        q: "Team Leader view",
        a: <p>Team leaders see an extra <b>Team</b> tab to view and assist their crew's status.</p>,
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    summary: "Company config, holidays, skills, permissions.",
    topics: [
      {
        q: "Where do I add public holidays?",
        a: <p><b>Settings → Public Holidays</b>. Add date, name, and whether it's a paid holiday.</p>,
      },
      {
        q: "Custom skill roles",
        a: <p><b>Settings → Skill Roles</b>. Add roles like LED Tech, Driver, Rigger.</p>,
      },
      {
        q: "Module permissions",
        a: <p>Settings → Permissions. Toggle view/edit per module per role.</p>,
      },
      {
        q: "Office location for GPS validation",
        a: <p>Settings → Office Location → drop a pin on the map. Punches outside the radius are flagged.</p>,
      },
    ],
  },
  {
    id: "security",
    title: "Security & Data",
    icon: Shield,
    summary: "How your data is protected.",
    topics: [
      {
        q: "Who can see what?",
        a: <p>Row-level security ensures employees only see their own data; managers see their teams; admins see everything.</p>,
      },
      {
        q: "GPS data",
        a: <p>The web portal only displays GPS captured by the mobile app — the portal itself does not collect location.</p>,
      },
    ],
  },
];

export default function HelpCenter() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      topics: s.topics.filter(
        (t) =>
          t.q.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q),
      ),
    })).filter((s) => s.topics.length > 0);
  }, [query]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-brand" />
          Help Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete guide to BeBright Planner — find any feature, learn how it works and where to click.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search help (e.g. 'punch out', 'cost report', 'create employee')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {!query && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 p-3 rounded-md border border-border hover:border-brand hover:bg-accent/40 transition-colors"
            >
              <s.icon className="h-4 w-4 text-brand shrink-0" />
              <span className="text-sm font-medium">{s.title}</span>
            </a>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            No topics match "{query}". Try different keywords.
          </p>
        )}

        {filtered.map((s) => (
          <Card key={s.id} id={s.id} className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <s.icon className="h-5 w-5 text-brand" />
                {s.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{s.summary}</p>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {s.topics.map((t, i) => (
                  <AccordionItem key={i} value={`${s.id}-${i}`}>
                    <AccordionTrigger className="text-left text-sm">{t.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2">
                      {t.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        Need more help? Contact your system administrator.
      </div>
    </div>
  );
}
