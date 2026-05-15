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
  Bell,
  FileText,
  Map,
  KeyRound,
  Download,
  Plane,
} from "lucide-react";

type Topic = { q: string; a: React.ReactNode };
type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  summary: string;
  topics: Topic[];
};

const Path = ({ children }: { children: React.ReactNode }) => (
  <span className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-medium">{children}</span>
);

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: HelpCircle,
    summary: "First steps, login, navigation, theme and roles.",
    topics: [
      {
        q: "How do I log in to the web portal?",
        a: (
          <p>
            Open your portal URL → enter email + password on the <b>Login</b> page. If you forgot it, use{" "}
            <Path>Forgot Password</Path> to receive a reset email, then open the link and set a new password
            on the <b>Reset Password</b> screen.
          </p>
        ),
      },
      {
        q: "What user roles exist?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Admin</b> — full access including Settings & Permissions.</li>
            <li><b>Manager</b> — modules per their permission grants.</li>
            <li><b>Employee</b> — limited web access (Dashboard, Projects, Schedule, Timesheets) + full Mobile app.</li>
            <li><b>Team Leader</b> — same as employee + the <b>Team</b> tab on the mobile app.</li>
          </ul>
        ),
      },
      {
        q: "Switch light / dark mode",
        a: <p>Top-right header → sun/moon icon. The dark theme is default.</p>,
      },
      {
        q: "Change password",
        a: <p>Top-right header → user avatar → <Path>Change Password</Path>.</p>,
      },
      {
        q: "Sign out",
        a: <p>Top-right header → user avatar → <Path>Sign Out</Path>.</p>,
      },
      {
        q: "Collapse the sidebar",
        a: <p>Top-left of the header → menu / sidebar trigger icon.</p>,
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    summary: "Today's KPIs, alerts, travel map and morning briefing.",
    topics: [
      {
        q: "What's on the Dashboard?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Headcount KPIs (present, absent, on leave, traveling).</li>
            <li>Active project count and ongoing tasks.</li>
            <li>Live travel map of teams currently moving.</li>
            <li>Alert tiles: missed punch-in, missed punch-out, overtime, document expiries.</li>
          </ul>
        ),
      },
      {
        q: "Open the Morning Briefing",
        a: <p>Top-right header → megaphone/briefing icon. Generates today's auto-summary.</p>,
      },
      {
        q: "View notifications",
        a: <p>Top-right header → bell icon opens the Notification Panel with unread alerts.</p>,
      },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    icon: FolderKanban,
    summary: "Create, plan, cost and report on projects.",
    topics: [
      {
        q: "Create a project",
        a: (
          <p>
            <Path>Projects</Path> → <Path>+ New Project</Path>. Fill name, client, location (drop pin on map),
            start/end dates, estimated cost, required skills.
          </p>
        ),
      },
      {
        q: "Bulk import projects via CSV",
        a: <p><Path>Projects</Path> → <Path>Import CSV</Path>. Download the sample, fill rows, upload.</p>,
      },
      {
        q: "Project tabs (inside a project)",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Overview</b> — details, dates, client.</li>
            <li><b>Team</b> — assigned members across the project lifespan.</li>
            <li><b>Costs</b> — labor + expenses + invoices, profit margin.</li>
            <li><b>Expenses</b> — per-day expense entries.</li>
            <li><b>Daily Log</b> — supervisor notes & photos from mobile.</li>
          </ul>
        ),
      },
      {
        q: "Add an expense / bulk expenses",
        a: <p>Project → <Path>Expenses</Path> tab → <Path>Add</Path> or <Path>Bulk Expense</Path>.</p>,
      },
      {
        q: "Add a purchase invoice",
        a: <p>Project → <Path>Costs</Path> tab → <Path>Purchase Invoice</Path> → upload PDF + amount.</p>,
      },
      {
        q: "Gantt chart of all projects",
        a: <p><Path>Projects</Path> → <Path>Gantt</Path> button (top right).</p>,
      },
      {
        q: "Project health indicator",
        a: (
          <p>
            Each project card shows a colored dot — green (on track), amber (at risk), red (over budget /
            behind schedule). Computed from dates, budget burn and team availability.
          </p>
        ),
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    icon: Wrench,
    summary: "Warranty / SLA jobs after installation.",
    topics: [
      {
        q: "Create a maintenance job",
        a: <p><Path>Maintenance</Path> → <Path>+ New</Path>. Link to original project, set warranty period, SLA, priority, assign team.</p>,
      },
      {
        q: "Assign a team to a maintenance job",
        a: <p>Open the job → <Path>Assign</Path> → pick employees and date.</p>,
      },
      {
        q: "Warranty expiry alerts",
        a: <p>Auto-pushed via the daily <b>check-warranty</b> job. Visible on Dashboard alert tiles and in Notifications.</p>,
      },
    ],
  },
  {
    id: "site-visits",
    title: "Site Visits",
    icon: ClipboardList,
    summary: "Pre-sales / survey visits with photo reports.",
    topics: [
      {
        q: "Schedule a site visit",
        a: <p><Path>Site Visits</Path> → <Path>+ New Visit</Path>. Set client, address (pin on map), date, surveyor.</p>,
      },
      {
        q: "View the survey report",
        a: <p>Open the visit → <b>Report</b> section shows photos, notes, measurements captured by the mobile surveyor.</p>,
      },
      {
        q: "Site visit workflow on mobile",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Start Travel → Arrive Site.</li>
            <li>Start Survey → take photos & notes.</li>
            <li>Take breaks if needed.</li>
            <li>End Visit → Start Return Travel → Arrive Office.</li>
          </ol>
        ),
      },
    ],
  },
  {
    id: "employees",
    title: "Employees",
    icon: Users,
    summary: "Workforce master data, skills, leave, mobile logins.",
    topics: [
      {
        q: "Add an employee",
        a: <p><Path>Employees</Path> → <Path>+ New Employee</Path>. Name, role, skills, hourly rate, document expiries.</p>,
      },
      {
        q: "Bulk import employees",
        a: <p><Path>Employees</Path> → <Path>Import CSV</Path>. Use the sample template.</p>,
      },
      {
        q: "Create a mobile app login",
        a: <p>Employee row → <Path>Create Login</Path>. System generates email + password and emails it.</p>,
      },
      {
        q: "Reset an employee's password",
        a: <p>Employee row → three-dot menu → <Path>Reset Password</Path>.</p>,
      },
      {
        q: "Mark leave",
        a: <p>Employee row → <Path>Mark Leave</Path>. Choose dates and type (annual, sick, unpaid, public holiday).</p>,
      },
      {
        q: "Document expiry tracking",
        a: <p>Visa, passport, license, medical expiries appear on the employee detail drawer and as Dashboard alerts before expiry.</p>,
      },
      {
        q: "Custom skills",
        a: <p>Manage in <Path>Settings → Skill Roles</Path>. Then assign per employee.</p>,
      },
    ],
  },
  {
    id: "schedule",
    title: "Schedule",
    icon: CalendarDays,
    summary: "Daily planning of who works on which project.",
    topics: [
      {
        q: "Assign employees to a project for a date",
        a: (
          <p>
            <Path>Schedule</Path> → pick the date → click the project row. The Day Assignment Panel opens
            on the right → tick employees from the available list to assign them.
          </p>
        ),
      },
      {
        q: "In-House vs Site tagging (per employee)",
        a: (
          <p>
            Each assigned employee row has individual{" "}
            <Badge variant="secondary">In-House</Badge> and <Badge variant="secondary">Site</Badge>{" "}
            toggles. Tag every person — cost & schedule reports split by this tag.
          </p>
        ),
      },
      {
        q: "Auto-assign team",
        a: <p>Schedule page → <Path>Auto-assign</Path>. Suggests a team based on required skills + availability.</p>,
      },
      {
        q: "Why is an employee unavailable?",
        a: <p>The list greys out anyone on leave, off-day, or already assigned to another project that day.</p>,
      },
      {
        q: "Notify assigned employees",
        a: <p>Notifications are sent automatically (push + in-app) when you save the assignment. No action needed.</p>,
      },
      {
        q: "Schedule task summary",
        a: <p>The top of the Schedule page shows total assigned vs unassigned per day for quick gaps.</p>,
      },
    ],
  },
  {
    id: "attendance",
    title: "Attendance",
    icon: ClipboardCheck,
    summary: "Punches, hours, GPS validation, overrides.",
    topics: [
      {
        q: "Today's attendance list",
        a: <p><Path>Attendance</Path> page lists every employee with punch-in, punch-out, hours, status badge.</p>,
      },
      {
        q: "Status colors",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><Badge className="bg-green-500/20 text-green-500">Present</Badge> — punched in.</li>
            <li><Badge className="bg-amber-500/20 text-amber-500">Traveling</Badge> — on the road.</li>
            <li><Badge className="bg-red-500/20 text-red-500">Absent</Badge> — scheduled but no punch-in.</li>
            <li><Badge className="bg-blue-500/20 text-blue-500">Planned</Badge> — scheduled, day not yet started.</li>
            <li><Badge className="bg-purple-500/20 text-purple-500">Overtime</Badge> — past standard hours.</li>
          </ul>
        ),
      },
      {
        q: "View employee timeline (every event of the day)",
        a: <p>Click the employee row → drawer opens with full timeline (punch-in, travel, breaks, work, punch-out) and GPS map.</p>,
      },
      {
        q: "Manual override (forgot to punch out, wrong time)",
        a: (
          <p>
            Click employee row → <Path>Override</Path> → set correct in/out times and reason. Costs auto
            recalculate.
          </p>
        ),
      },
      {
        q: "Daily Team view",
        a: <p><Path>Attendance → Daily Team</Path> — team-by-team grid for the chosen date.</p>,
      },
      {
        q: "Missed punch alerts",
        a: <p>Edge cron jobs check throughout the day; alerts appear on Dashboard + Notifications + push.</p>,
      },
    ],
  },
  {
    id: "travel",
    title: "Travel",
    icon: Car,
    summary: "Live GPS tracking of teams in transit.",
    topics: [
      {
        q: "What does the Travel page show?",
        a: <p>Live map with markers for every team currently traveling, last GPS ping time, destination project.</p>,
      },
      {
        q: "Where does GPS data come from?",
        a: <p>Only from the BeBright Android app — the web portal never collects GPS itself.</p>,
      },
      {
        q: "GPS validation for office punch",
        a: <p>If the punch happens outside the office radius defined in <Path>Settings</Path>, it's flagged for review.</p>,
      },
    ],
  },
  {
    id: "driver-workflow",
    title: "Driver Workflow",
    icon: Plane,
    summary: "Multi-leg flow for drivers (drop-off / pickup / wait).",
    topics: [
      {
        q: "Driver daily flow (step by step)",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Punch In</b> at office (standard).</li>
            <li><b>Pick a project</b> from today's driver assignments.</li>
            <li><b>Start Travel</b> — leg status becomes <i>traveling</i>.</li>
            <li>Arrive at site → tap one of:
              <ul className="list-disc pl-5 mt-1">
                <li><b>Drop Off</b> — log time, free to leave.</li>
                <li><b>Pick Up</b> — log time, free to leave.</li>
                <li><b>Wait</b> — stays on site, paid until <i>Done Waiting</i>.</li>
              </ul>
            </li>
            <li><b>End Leg</b> (Leaving Site / Done Waiting) — leg becomes <i>completed</i>.</li>
            <li>Then either <b>Start another project</b> (new leg) or <b>Return to Office</b> → Arrive Office → <b>Punch Out</b>.</li>
          </ol>
        ),
      },
      {
        q: "What counts as a 'leg'?",
        a: <p>Each drop-off, pickup, or wait is a separate leg with its own travel time and on-site time. A pickup later in the day is a new leg, not a continuation of an earlier drop-off.</p>,
      },
      {
        q: "How are driver costs split per project?",
        a: <p>The time the driver spent on each leg (travel + wait + drop) is allocated to that project. Cost reports show the split automatically.</p>,
      },
      {
        q: "Driver who is also a technician for a job",
        a: <p>Assign them as a technician in <Path>Schedule</Path> for that day — they then follow the standard technician flow instead.</p>,
      },
      {
        q: "Pre-assigning multiple projects for a driver",
        a: <p>In <Path>Schedule</Path>, add the driver to every project they need to visit that day. The mobile app shows them in order.</p>,
      },
    ],
  },
  {
    id: "timesheets",
    title: "Timesheets",
    icon: Clock,
    summary: "Approve hours and overtime for payroll.",
    topics: [
      {
        q: "Approve a timesheet",
        a: <p><Path>Timesheets</Path> → filter by week → click row → <Path>Approve</Path> or <Path>Reject</Path>.</p>,
      },
      {
        q: "Bulk approve",
        a: <p>Use the checkbox column → tick rows → <Path>Approve Selected</Path> at the top.</p>,
      },
      {
        q: "How is Overtime (OT) calculated?",
        a: (
          <div className="space-y-2">
            <p><b>Worked minutes</b> = punch-out − punch-in − break minutes (default 1h break).</p>
            <p><b>Standard day</b> = employee's <i>standard hours per day</i> (default 8h productive, i.e. 9h on site including 1h break).</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Regular pay</b> = min(worked, standard) × hourly rate</li>
              <li><b>Overtime</b> = max(0, worked − standard) × hourly rate × <i>OT multiplier</i> (from <Path>Settings</Path>, default ×1.5)</li>
            </ul>
            <p>OT hours show as <Badge className="bg-purple-500/20 text-purple-500">Overtime</Badge> in Attendance and Timesheets.</p>
          </div>
        ),
      },
      {
        q: "Public holiday & weekly off-day OT",
        a: (
          <div className="space-y-2">
            <p>On a public holiday or the employee's weekly off day, <b>all hours are premium</b> — there is no regular-pay portion.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Multiplier mode</b>: hourly rate × OT multiplier × holiday rate value (default 1.5)</li>
              <li><b>Fixed mode</b>: flat AED/hour set on the skill role</li>
            </ul>
            <p>Configure per skill in <Path>Settings → Skill Roles</Path> (holiday rate type + value). The premium amount is stored as overtime cost in reports.</p>
          </div>
        ),
      },
      {
        q: "Why does OT seem off for a 9-hour day?",
        a: <p>The official day is <b>9 hours including a 1-hour break</b> = 8 productive hours. OT triggers only after 8 productive hours, not 9 clock hours. If you want OT to start at 9 productive hours, raise <i>standard hours per day</i> on the employee profile.</p>,
      },
      {
        q: "Edit a timesheet entry",
        a: <p>Click the entry → opens detail drawer. If the punches are wrong, fix via <Path>Attendance → Override</Path> (timesheet refreshes).</p>,
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    icon: BarChart3,
    summary: "All operational and financial reports.",
    topics: [
      {
        q: "List of available reports",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Schedule</b> — daily team breakdown with In-House/Site tags.</li>
            <li><b>Utilization</b> — % billable per employee per period.</li>
            <li><b>Cost Reports</b> — labor + expenses per project.</li>
            <li><b>Profitability</b> — revenue vs total cost per project.</li>
            <li><b>Executive</b> — top-level KPIs for management.</li>
            <li><b>Attendance</b> — punches per employee/day.</li>
            <li><b>Overtime</b> — OT hours.</li>
            <li><b>Manpower</b> — headcount per project per day.</li>
            <li><b>Absentee</b> — who missed work, with reasons.</li>
            <li><b>Site Visits</b> — survey activity.</li>
          </ul>
        ),
      },
      {
        q: "Date filter",
        a: <p>Every report has a date range filter at the top — preset (Today, Week, Month) or custom.</p>,
      },
      {
        q: "Export to PDF / CSV",
        a: <p>Top-right of every report: <Path>Export PDF</Path> and <Path>Export CSV</Path> buttons.</p>,
      },
      {
        q: "Why are some costs showing AED 0?",
        a: (
          <p>
            Cost = (punch-out − punch-in) × hourly rate. Returns 0 if the employee never punched out, or
            their hourly rate is missing. Fix via <Path>Attendance → Override</Path> and ensure the
            employee profile has an <b>Hourly Rate</b>.
          </p>
        ),
      },
      {
        q: "Cost split by In-House vs Site",
        a: <p>Cost Report uses each assignment's individual location tag (set in Schedule). Make sure every employee row is tagged.</p>,
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    summary: "In-app alerts and push notifications.",
    topics: [
      {
        q: "Where do notifications appear?",
        a: <p>Bell icon in the top-right header. Unread count shows as a red dot.</p>,
      },
      {
        q: "What triggers a notification?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>New schedule assignment (sent to mobile).</li>
            <li>Missed punch-in / punch-out.</li>
            <li>Overtime threshold reached.</li>
            <li>Document expiry approaching.</li>
            <li>Daily log submitted.</li>
            <li>Warranty / SLA expiring.</li>
          </ul>
        ),
      },
      {
        q: "Push notifications to phone",
        a: <p>Sent via the mobile app — employee must be logged in on Android.</p>,
      },
    ],
  },
  {
    id: "mobile-app",
    title: "Mobile App (Android)",
    icon: Smartphone,
    summary: "Field staff workflow.",
    topics: [
      {
        q: "Where do field staff get the app?",
        a: <p>Install the BeBright Planner Android APK provided by your admin. Login with credentials issued via <Path>Employees → Create Login</Path>.</p>,
      },
      {
        q: "Standard technician flow",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Punch In</b> at office.</li>
            <li>Select project → <b>Start Travel</b>.</li>
            <li>Arrive site → <b>Start Work</b>.</li>
            <li>Take breaks → Resume.</li>
            <li><b>End Work</b> → <b>Start Return Travel</b> → <b>Arrive Office</b> → <b>Punch Out</b>.</li>
          </ol>
        ),
      },
      {
        q: "Submit daily log + photos",
        a: <p>Project screen → <Path>Daily Log</Path> → add notes & photos. Visible in the web portal under the project's Daily Log tab.</p>,
      },
      {
        q: "Team Leader features",
        a: <p>Team Leaders see an extra <b>Team</b> tab to monitor and assist their crew's punches.</p>,
      },
      {
        q: "Offline mode",
        a: <p>Punches and daily logs queue locally and sync once back online.</p>,
      },
      {
        q: "Biometric login",
        a: <p>After first password login, enable fingerprint/face from the mobile profile screen.</p>,
      },
      {
        q: "Notifications on phone",
        a: <p>Tap the bell on the bottom nav. Push alerts also appear in the OS notification tray.</p>,
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    summary: "Company config, roles, holidays, locations, permissions.",
    topics: [
      {
        q: "Public holidays",
        a: <p><Path>Settings → Public Holidays</Path>. Add date, name, and whether it's paid. Affects timesheet & overtime calc.</p>,
      },
      {
        q: "Skill roles",
        a: <p><Path>Settings → Skill Roles</Path>. Add roles like LED Tech, Driver, Rigger.</p>,
      },
      {
        q: "Office location for GPS validation",
        a: <p><Path>Settings → Office Location</Path>. Drop a pin and set radius (meters). Punches outside the radius are flagged.</p>,
      },
      {
        q: "Module permissions per role",
        a: <p><Path>Settings → Permissions</Path>. Toggle view / edit per module per role.</p>,
      },
      {
        q: "Working hours & overtime threshold",
        a: <p><Path>Settings → Company</Path>. Set standard daily hours; anything beyond becomes OT.</p>,
      },
      {
        q: "Currency & date format",
        a: <p>Defaults: AED, 24-hour time, DD/MM/YYYY. Change in <Path>Settings → Company</Path>.</p>,
      },
    ],
  },
  {
    id: "exports",
    title: "Exports & Imports",
    icon: Download,
    summary: "CSV / PDF in and out of the system.",
    topics: [
      {
        q: "Export reports",
        a: <p>Every report → <Path>Export PDF</Path> / <Path>Export CSV</Path> top-right.</p>,
      },
      {
        q: "Import employees / projects",
        a: <p>Each list page has an <Path>Import CSV</Path> button with a downloadable template.</p>,
      },
      {
        q: "Backup",
        a: <p>All data is stored on Lovable Cloud and backed up automatically. Exports are available on demand from each report.</p>,
      },
    ],
  },
  {
    id: "security",
    title: "Security & Privacy",
    icon: Shield,
    summary: "Access control and data handling.",
    topics: [
      {
        q: "Who can see what?",
        a: <p>Row-level security: employees see only their own data; managers see their teams; admins see everything.</p>,
      },
      {
        q: "Authentication",
        a: <p>Email + password with hashed storage. Mobile supports biometric unlock after first login.</p>,
      },
      {
        q: "GPS privacy",
        a: <p>The web portal never collects GPS — it only displays data captured by the mobile app for active work events.</p>,
      },
      {
        q: "Audit trail",
        a: <p>Manual overrides record who edited a punch and when. Visible on the employee timeline drawer.</p>,
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: KeyRound,
    summary: "Common issues and fixes.",
    topics: [
      {
        q: "Employee can't log in to mobile",
        a: <p>Reset their password via <Path>Employees → … → Reset Password</Path>. Make sure they have a login created.</p>,
      },
      {
        q: "Hours showing dashes (—)",
        a: <p>Means there's no punch-out for that day. Use <Path>Attendance → Override</Path> to set the missing time.</p>,
      },
      {
        q: "Costs are AED 0",
        a: <p>Either the employee never punched out, or their hourly rate is empty. Fix the rate in their profile and override the punch.</p>,
      },
      {
        q: "Schedule assignment was slow",
        a: <p>Notifications are now sent in the background, so the UI shouldn't wait. If it still feels slow, refresh the page and try again.</p>,
      },
      {
        q: "Push notifications not arriving",
        a: <p>Check the employee is logged in on the mobile app, and that Android battery optimization isn't killing the app in the background.</p>,
      },
      {
        q: "GPS pin is wrong on map",
        a: <p>Ask the employee to enable high-accuracy GPS on their phone. Indoor punches can be off by 50–100m.</p>,
      },
    ],
  },
  {
    id: "glossary",
    title: "Glossary",
    icon: FileText,
    summary: "Key terms used in the app.",
    topics: [
      {
        q: "Assignment",
        a: <p>A single (employee, project, date) record placing someone on a project for one day.</p>,
      },
      {
        q: "Leg",
        a: <p>One travel segment for a driver — e.g. office → site A is one leg, site A → site B is the next leg.</p>,
      },
      {
        q: "In-House vs Site",
        a: <p>Where the work was performed: at the workshop (In-House) or at the client/installation site (Site). Drives cost split.</p>,
      },
      {
        q: "Overtime (OT)",
        a: <p>Hours beyond the configured standard daily hours. Counted toward payroll separately.</p>,
      },
      {
        q: "Daily Log",
        a: <p>Free-text + photo entry submitted from the mobile app per project per day.</p>,
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
          Complete guide to BeBright Planner. Search any feature or browse by module to learn how it works
          and exactly where to click.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search help (e.g. 'punch out', 'cost report', 'driver', 'create login')"
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
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {s.topics.length} topic{s.topics.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{s.summary}</p>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {s.topics.map((t, i) => (
                  <AccordionItem key={i} value={`${s.id}-${i}`}>
                    <AccordionTrigger className="text-left text-sm">{t.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
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
        Can't find what you need? Contact your system administrator.
      </div>
    </div>
  );
}
