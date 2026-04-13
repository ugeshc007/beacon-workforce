import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
}

interface ParsedRow {
  row: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

const REQUIRED_HEADERS = ["name", "branch", "status"];
const ALL_HEADERS = [
  "name", "branch", "status", "client_name", "client_phone", "client_email",
  "site_address", "site_latitude", "site_longitude", "site_gps_radius",
  "start_date", "end_date", "budget", "project_value",
  "required_technicians", "required_helpers", "required_supervisors",
  "notes",
];
const VALID_STATUSES = ["on_hold", "in_progress", "completed"];

function downloadTemplate(branches: { id: string; name: string }[]) {
  const wb = XLSX.utils.book_new();
  const dubaiName = branches.find(b => b.name === "Dubai")?.name ?? branches[1]?.name ?? "Branch1";
  const damamName = branches.find(b => b.name === "Damam")?.name ?? branches[0]?.name ?? "Branch2";

  const data = [
    ALL_HEADERS,
    [
      "Dubai Mall LED Wall", dubaiName, "on_hold",
      "Emaar Properties", "+971501234567", "emaar@example.com",
      "Dubai Mall, Ground Floor, Financial Center Rd", "25.1972", "55.2744", "100",
      "2026-04-15", "2026-06-30", "50000", "75000",
      "2", "3", "1", "Large LED wall installation at main entrance",
    ],
    [
      "Riyadh Tower Signage", damamName, "on_hold",
      "Al Faisaliah Group", "+966512345678", "projects@alfaisaliah.com",
      "Al Faisaliah Tower, King Fahd Road, Riyadh", "24.6908", "46.6853", "150",
      "2026-05-01", "2026-07-15", "35000", "55000",
      "3", "2", "1", "External signage with LED backlight",
    ],
    [
      "JBR Beach Digital Board", dubaiName, "in_progress",
      "Meraas Holding", "+971504567890", "info@meraas.com",
      "JBR The Walk, Jumeirah Beach Residence", "25.0780", "55.1340", "80",
      "2026-04-20", "2026-05-30", "28000", "42000",
      "2", "2", "1", "Outdoor digital display board near beach",
    ],
    [
      "Dammam Corniche LED Screen", damamName, "on_hold",
      "Eastern Province Municipality", "+966138456789", "projects@epm.gov.sa",
      "Dammam Corniche, King Abdullah Park", "26.4367", "50.1033", "120",
      "2026-06-01", "2026-08-30", "60000", "90000",
      "4", "4", "2", "Large outdoor LED screen facing the waterfront",
    ],
    [
      "Mall of Emirates Store Display", dubaiName, "in_progress",
      "Majid Al Futtaim", "+971506789012", "maf@example.com",
      "Mall of the Emirates, Level 2, Shop 245", "25.1181", "55.2006", "50",
      "2026-03-01", "2026-04-30", "15000", "22000",
      "1", "2", "0", "In-store promotional LED display panels",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 28 },
    { wch: 45 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 44 },
  ];
  // Force text format on phone column
  const phoneCol = ALL_HEADERS.indexOf("client_phone");
  for (let r = 1; r <= 5; r++) {
    const phoneCell = XLSX.utils.encode_cell({ r, c: phoneCol });
    if (ws[phoneCell]) ws[phoneCell].t = "s";
  }
  XLSX.utils.book_append_sheet(wb, ws, "Projects");

  // Instructions sheet
  const instructions = [
    ["Field", "Required", "Format / Notes"],
    ["name", "YES", "Project name"],
    ["branch", "YES", "Branch name (e.g. Dubai, Damam)"],
    ["status", "YES", "on_hold / in_progress / completed"],
    ["client_name", "No", "Client company name"],
    ["client_phone", "No", "Phone with country code e.g. +971501234567"],
    ["client_email", "No", "Email address"],
    ["site_address", "No", "Full address text"],
    ["site_latitude", "No", "Decimal e.g. 25.1972"],
    ["site_longitude", "No", "Decimal e.g. 55.2744"],
    ["site_gps_radius", "No", "Meters (default 100)"],
    ["start_date", "No", "YYYY-MM-DD e.g. 2026-04-15"],
    ["end_date", "No", "YYYY-MM-DD e.g. 2026-06-30"],
    ["budget", "No", "Number in AED"],
    ["project_value", "No", "Number in AED"],
    ["required_technicians", "No", "Number (default 0)"],
    ["required_helpers", "No", "Number (default 0)"],
    ["required_supervisors", "No", "Number (default 0)"],
    ["notes", "No", "Free text"],
    [],
    ["Available Branches"],
    ...branches.map(b => [b.name]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instructions);
  ws2["!cols"] = [{ wch: 22 }, { wch: 44 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");

  XLSX.writeFile(wb, "projects_import_template.xlsx");
}

function normalizeDate(val: any): string {
  if (!val) return "";
  // If it's an Excel serial date number
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // DD-MM-YYYY
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return s;
}

function normalizePhone(val: any): string {
  if (!val) return "";
  // Handle scientific notation from Excel (e.g. 9.71501E+11)
  const n = Number(val);
  if (!isNaN(n) && String(val).includes("E")) return "+" + n.toFixed(0);
  return String(val).trim();
}

function parseFile(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, any>[] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  if (!raw.length) return { headers: [], rows: [] };
  const headers = Object.keys(raw[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = raw.map(r => {
    const out: Record<string, any> = {};
    Object.entries(r).forEach(([k, v], i) => { out[headers[i]] = v; });
    return out;
  });
  return { headers, rows };
}

function validateRow(data: Record<string, any>, rowNum: number, branches: { id: string; name: string }[]): ParsedRow {
  const errors: string[] = [];
  const d: Record<string, string> = {};
  ALL_HEADERS.forEach(h => { d[h] = data[h] != null ? String(data[h]).trim() : ""; });

  // Normalize dates and phone
  d.start_date = normalizeDate(data.start_date);
  d.end_date = normalizeDate(data.end_date);
  d.client_phone = normalizePhone(data.client_phone);

  // Also support legacy branch_id column
  if (!d.branch && data.branch_id) d.branch = String(data.branch_id).trim();

  // Resolve branch name to ID (case-insensitive match)
  const branchName = d.branch;
  const matchedBranch = branches.find(b =>
    b.name.toLowerCase() === branchName.toLowerCase() || b.id === branchName
  );
  if (branchName && matchedBranch) {
    d.branch_id = matchedBranch.id;
  } else if (branchName) {
    errors.push(`Unknown branch: "${branchName}" (use: ${branches.map(b => b.name).join(", ")})`);
  }

  for (const req of REQUIRED_HEADERS) {
    if (!d[req]) errors.push(`Missing ${req}`);
  }
  if (d.status && !VALID_STATUSES.includes(d.status.toLowerCase())) {
    errors.push(`Invalid status: ${d.status}`);
  }
  if (d.budget && isNaN(Number(d.budget))) errors.push("Invalid budget");
  if (d.project_value && isNaN(Number(d.project_value))) errors.push("Invalid project_value");
  if (d.site_latitude && isNaN(Number(d.site_latitude))) errors.push("Invalid latitude");
  if (d.site_longitude && isNaN(Number(d.site_longitude))) errors.push("Invalid longitude");
  if (d.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(d.start_date)) errors.push("Invalid start_date format");
  if (d.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(d.end_date)) errors.push("Invalid end_date format");

  return { row: rowNum, data: d, errors, valid: errors.length === 0 };
}

export function CsvProjectImportDialog({ open, onOpenChange, branches }: Props) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const { headers, rows } = parseFile(buffer);
      if (!headers.length) {
        toast({ title: "Invalid file", description: "Could not parse headers", variant: "destructive" });
        return;
      }
      const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missing.length) {
        toast({ title: "Missing columns", description: `Required: ${missing.join(", ")}`, variant: "destructive" });
        return;
      }
      // Filter out completely empty rows (Excel trailing formatting)
      const nonEmptyRows = rows
        .map((row, i) => ({ row, idx: i }))
        .filter(({ row }) => REQUIRED_HEADERS.some(h => row[h] != null && String(row[h]).trim() !== ""));
      setParsed(nonEmptyRows.map(({ row, idx }) => validateRow(row, idx + 2, branches)));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!parsed) return;
    const validRows = parsed.filter(r => r.valid);
    if (!validRows.length) {
      toast({ title: "No valid rows to import", variant: "destructive" });
      return;
    }
    setImporting(true);
    let success = 0, failed = 0;

    for (const row of validRows) {
      const d = row.data;
      const resolvedBranchId = d.branch_id || branches.find(b => b.name.toLowerCase() === d.branch?.toLowerCase())?.id;
      const { error } = await supabase.from("projects").insert({
        name: d.name,
        branch_id: resolvedBranchId!,
        status: d.status.toLowerCase() as any,
        client_name: d.client_name || null,
        client_phone: d.client_phone || null,
        client_email: d.client_email || null,
        site_address: d.site_address || null,
        site_latitude: d.site_latitude ? Number(d.site_latitude) : null,
        site_longitude: d.site_longitude ? Number(d.site_longitude) : null,
        site_gps_radius: d.site_gps_radius ? Number(d.site_gps_radius) : 100,
        start_date: d.start_date || null,
        end_date: d.end_date || null,
        budget: d.budget ? Number(d.budget) : null,
        project_value: d.project_value ? Number(d.project_value) : null,
        required_technicians: d.required_technicians ? Number(d.required_technicians) : 0,
        required_helpers: d.required_helpers ? Number(d.required_helpers) : 0,
        required_supervisors: d.required_supervisors ? Number(d.required_supervisors) : 0,
        notes: d.notes || null,
      });
      if (error) { failed++; row.errors.push(error.message); row.valid = false; }
      else { success++; }
    }

    setImporting(false);
    setResult({ success, failed });
    qc.invalidateQueries({ queryKey: ["projects"] });
    toast({ title: "Import complete", description: `${success} added, ${failed} failed` });
  };

  const handleClose = () => {
    setParsed(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
    onOpenChange(false);
  };

  const validCount = parsed?.filter(r => r.valid).length ?? 0;
  const errorCount = parsed?.filter(r => !r.valid).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Project Import</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file to create multiple projects. Download the template first.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Download the template, fill in your projects, then upload.</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(branches)}>
                  <Download className="h-4 w-4 mr-2" /> Download Template (.xlsx)
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileText className="h-4 w-4 mr-2" /> Choose File
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Accepts:</strong> .xlsx or .csv files</p>
                <p><strong>Required columns:</strong> name, branch, status</p>
                <p><strong>Status values:</strong> on_hold, in_progress, completed</p>
                <p><strong>Date format:</strong> YYYY-MM-DD (auto-converts M/D/YYYY)</p>
                <p><strong>Branches:</strong> {branches.map(b => b.name).join(", ")}</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <>
            <div className="flex gap-3 py-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {validCount} valid
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> {errorCount} errors
                </Badge>
              )}
              <Badge variant="secondary">{parsed.length} total rows</Badge>
            </div>

            <ScrollArea className="flex-1 min-h-0 border rounded-lg">
              <div className="p-2 space-y-1">
                {parsed.map((row) => (
                  <div
                    key={row.row}
                    className={`flex items-start gap-2 px-3 py-2 rounded text-xs ${
                      row.valid ? "bg-muted/30" : "bg-destructive/10"
                    }`}
                  >
                    <span className="font-mono text-muted-foreground shrink-0 w-8">#{row.row}</span>
                    <span className="font-medium shrink-0 w-40 truncate">{row.data.name || "—"}</span>
                    <span className="text-muted-foreground shrink-0 w-20 truncate">{row.data.status || "—"}</span>
                    {row.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0 mt-0.5" />
                    ) : (
                      <div className="flex items-start gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{row.errors.join("; ")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; }}>
                Choose different file
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing || validCount === 0 || !!result}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {result ? `Done (${result.success} added)` : `Import ${validCount} projects`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
