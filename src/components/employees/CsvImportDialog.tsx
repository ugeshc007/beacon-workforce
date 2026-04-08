import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
}

interface ParsedRow {
  row: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

const REQUIRED_HEADERS = ["employee_code", "name", "skill_type", "branch_id"];
const ALL_HEADERS = [
  "employee_code", "name", "skill_type", "branch_id",
  "phone", "email", "designation", "hourly_rate", "overtime_rate",
  "standard_hours_per_day", "join_date", "emergency_contact", "notes",
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
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

function validateRow(headers: string[], values: string[], rowNum: number): ParsedRow {
  const data: Record<string, string> = {};
  const errors: string[] = [];

  headers.forEach((h, i) => { data[h] = values[i] ?? ""; });

  for (const req of REQUIRED_HEADERS) {
    if (!data[req]) errors.push(`Missing ${req}`);
  }

  if (data.skill_type && !["team_member", "team_leader"].includes(data.skill_type.toLowerCase())) {
    errors.push(`Invalid skill_type: ${data.skill_type} (must be team_member/team_leader)`);
  }

  if (data.hourly_rate && isNaN(Number(data.hourly_rate))) errors.push("Invalid hourly_rate");
  if (data.overtime_rate && isNaN(Number(data.overtime_rate))) errors.push("Invalid overtime_rate");
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Invalid email");

  return { row: rowNum, data, errors, valid: errors.length === 0 };
}

export function CsvImportDialog({ open, onOpenChange, branchId }: Props) {
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

      const validated = rows.map((row, i) => validateRow(headers, row, i + 2));
      setParsed(validated);
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
      const { error } = await supabase.from("employees").insert({
        employee_code: d.employee_code,
        name: d.name,
        skill_type: d.skill_type.toLowerCase() as any,
        branch_id: d.branch_id || branchId || "",
        phone: d.phone || null,
        email: d.email || null,
        designation: d.designation || null,
        hourly_rate: d.hourly_rate ? Number(d.hourly_rate) : 25,
        overtime_rate: d.overtime_rate ? Number(d.overtime_rate) : 37.5,
        standard_hours_per_day: d.standard_hours_per_day ? Number(d.standard_hours_per_day) : 8,
        join_date: d.join_date || null,
        emergency_contact: d.emergency_contact || null,
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
    qc.invalidateQueries({ queryKey: ["employees"] });
    toast({ title: `Import complete`, description: `${success} added, ${failed} failed` });
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
          <DialogTitle>Bulk CSV Import</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: {REQUIRED_HEADERS.join(", ")} (required), plus optional: phone, email, designation, hourly_rate, overtime_rate, etc.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Select a CSV file to validate and import</p>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <FileText className="h-4 w-4 mr-2" /> Choose CSV File
              </Button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <>
            {/* Summary */}
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

            {/* Validation Results */}
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
                    <span className="font-medium shrink-0 w-28 truncate">{row.data.name || "—"}</span>
                    <span className="font-mono shrink-0 w-20 truncate text-muted-foreground">{row.data.employee_code || "—"}</span>
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

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; }}>
                Choose different file
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing || validCount === 0 || !!result}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {result ? `Done (${result.success} added)` : `Import ${validCount} employees`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
