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

const REQUIRED_HEADERS = ["name", "branch_id", "status"];
const ALL_HEADERS = [
  "name", "branch_id", "status", "client_name", "client_phone", "client_email",
  "site_address", "site_latitude", "site_longitude", "site_gps_radius",
  "start_date", "end_date", "budget", "project_value",
  "required_technicians", "required_helpers", "required_supervisors",
  "notes",
];

const VALID_STATUSES = ["planned", "assigned", "in_progress", "completed"];

function downloadTemplate(branches: { id: string; name: string }[]) {
  const header = ALL_HEADERS.join(",");
  const branchNote = branches.map(b => `# Branch: ${b.name} → ${b.id}`).join("\n");
  const example = [
    "Dubai Mall LED Wall", branches[0]?.id ?? "BRANCH_ID_HERE", "planned",
    "Emaar Properties", "+971501234567", "client@example.com",
    "Dubai Mall, Ground Floor", "25.1972", "55.2744", "100",
    "2026-04-15", "2026-06-30", "50000", "75000",
    "2", "3", "1", "LED wall installation project",
  ].join(",");
  const csv = `${branchNote}\n${header}\n${example}`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "projects_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += char;
    }
    result.push(current.trim());
    return result;
  });
  return { headers, rows };
}

function validateRow(headers: string[], values: string[], rowNum: number, branchIds: string[]): ParsedRow {
  const data: Record<string, string> = {};
  const errors: string[] = [];
  headers.forEach((h, i) => { data[h] = values[i] ?? ""; });

  for (const req of REQUIRED_HEADERS) {
    if (!data[req]) errors.push(`Missing ${req}`);
  }

  if (data.status && !VALID_STATUSES.includes(data.status.toLowerCase())) {
    errors.push(`Invalid status: ${data.status} (use: ${VALID_STATUSES.join("/")})`);
  }

  if (data.branch_id && !branchIds.includes(data.branch_id)) {
    errors.push(`Unknown branch_id`);
  }

  if (data.budget && isNaN(Number(data.budget))) errors.push("Invalid budget");
  if (data.project_value && isNaN(Number(data.project_value))) errors.push("Invalid project_value");
  if (data.site_latitude && isNaN(Number(data.site_latitude))) errors.push("Invalid site_latitude");
  if (data.site_longitude && isNaN(Number(data.site_longitude))) errors.push("Invalid site_longitude");
  if (data.required_technicians && isNaN(Number(data.required_technicians))) errors.push("Invalid required_technicians");
  if (data.required_helpers && isNaN(Number(data.required_helpers))) errors.push("Invalid required_helpers");
  if (data.required_supervisors && isNaN(Number(data.required_supervisors))) errors.push("Invalid required_supervisors");

  if (data.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.start_date)) errors.push("start_date must be YYYY-MM-DD");
  if (data.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.end_date)) errors.push("end_date must be YYYY-MM-DD");

  return { row: rowNum, data, errors, valid: errors.length === 0 };
}

export function CsvProjectImportDialog({ open, onOpenChange, branches }: Props) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const branchIds = branches.map(b => b.id);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (!headers.length) {
        toast({ title: "Invalid CSV", description: "Could not parse headers", variant: "destructive" });
        return;
      }
      const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
      if (missing.length) {
        toast({ title: "Missing columns", description: `Required: ${missing.join(", ")}`, variant: "destructive" });
        return;
      }
      setParsed(rows.map((row, i) => validateRow(headers, row, i + 2, branchIds)));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsed) return;
    const validRows = parsed.filter((r) => r.valid);
    if (!validRows.length) {
      toast({ title: "No valid rows to import", variant: "destructive" });
      return;
    }
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      const d = row.data;
      const { error } = await supabase.from("projects").insert({
        name: d.name,
        branch_id: d.branch_id,
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

      if (error) {
        failed++;
        row.errors.push(error.message);
        row.valid = false;
      } else {
        success++;
      }
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

  const validCount = parsed?.filter((r) => r.valid).length ?? 0;
  const errorCount = parsed?.filter((r) => !r.valid).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Project Import</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create multiple projects at once. Download the template first for the correct format.
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
                  <Download className="h-4 w-4 mr-2" /> Download Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileText className="h-4 w-4 mr-2" /> Choose CSV File
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Required columns:</strong> name, branch_id, status</p>
                <p><strong>Status values:</strong> planned, assigned, in_progress, completed</p>
                <p><strong>Date format:</strong> YYYY-MM-DD (e.g. 2026-04-15)</p>
                <p><strong>Branch IDs:</strong></p>
                {branches.map(b => (
                  <p key={b.id} className="font-mono text-[10px]">{b.name}: {b.id}</p>
                ))}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
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
