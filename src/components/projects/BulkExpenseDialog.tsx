import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import { useBulkCreateExpenses } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["material", "transport", "equipment", "labor", "overtime", "travel", "misc"] as const;

interface Row {
  category: string;
  amount: string;
  date: string;
  description: string;
}

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyRow = (): Row => ({
  category: "material",
  amount: "",
  date: toLocalDateStr(new Date()),
  description: "",
});

export function BulkExpenseDialog({ projectId, open, onOpenChange }: Props) {
  const bulkCreate = useBulkCreateExpenses();
  const { data: settings } = useSettings();
  const { toast } = useToast();

  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("manual");

  const threshold = Number(settings?.expense_approval_threshold ?? 0);

  const addRow = () => setRows([...rows, emptyRow()]);

  const updateRow = (i: number, field: keyof Row, value: string) => {
    const updated = [...rows];
    updated[i] = { ...updated[i], [field]: value };
    setRows(updated);
  };

  const removeRow = (i: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== i));
  };

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast({ title: "CSV must have a header row + data", variant: "destructive" });
        return;
      }

      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const catIdx = header.findIndex((h) => h.includes("categ"));
      const amtIdx = header.findIndex((h) => h.includes("amount"));
      const dateIdx = header.findIndex((h) => h.includes("date"));
      const descIdx = header.findIndex((h) => h.includes("desc"));

      if (amtIdx === -1) {
        toast({ title: "CSV must have an 'amount' column", variant: "destructive" });
        return;
      }

      const parsed: Row[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const rawCat = catIdx >= 0 ? cols[catIdx]?.toLowerCase() : "misc";
        const cat = CATEGORIES.includes(rawCat as any) ? rawCat : "misc";
        const amt = cols[amtIdx] || "";
        const rawDate = dateIdx >= 0 ? cols[dateIdx] : "";
        let isoDate = toLocalDateStr(new Date());
        if (rawDate) {
          // Try DD/MM/YYYY or YYYY-MM-DD
          const ddmm = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (ddmm) isoDate = `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
          else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) isoDate = rawDate;
        }
        const desc = descIdx >= 0 ? cols[descIdx] || "" : "";
        if (parseFloat(amt) > 0) {
          parsed.push({ category: cat, amount: amt, date: isoDate, description: desc });
        }
      }

      if (!parsed.length) {
        toast({ title: "No valid rows found", variant: "destructive" });
        return;
      }

      setCsvRows(parsed);
      toast({ title: `${parsed.length} rows imported from CSV` });
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [toast]);

  const handleXlsxUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const parsed: Row[] = [];
      for (const row of json) {
        const keys = Object.keys(row);
        const catKey = keys.find((k) => k.toLowerCase().includes("categ"));
        const amtKey = keys.find((k) => k.toLowerCase().includes("amount"));
        const dateKey = keys.find((k) => k.toLowerCase().includes("date"));
        const descKey = keys.find((k) => k.toLowerCase().includes("desc"));

        const amt = amtKey ? String(row[amtKey]) : "";
        if (!parseFloat(amt)) continue;

        const rawCat = catKey ? String(row[catKey]).toLowerCase() : "misc";
        const cat = CATEGORIES.includes(rawCat as any) ? rawCat : "misc";
        let isoDate = toLocalDateStr(new Date());
        if (dateKey && row[dateKey]) {
          const val = row[dateKey];
          if (typeof val === "number") {
            // Excel serial date
            const d = XLSX.SSF.parse_date_code(val);
            isoDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          } else {
            const s = String(val);
            const ddmm = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (ddmm) isoDate = `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
            else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) isoDate = s;
          }
        }
        const desc = descKey ? String(row[descKey] ?? "") : "";
        parsed.push({ category: cat, amount: amt, date: isoDate, description: desc });
      }

      if (!parsed.length) {
        toast({ title: "No valid rows found in Excel file", variant: "destructive" });
        return;
      }

      setCsvRows(parsed);
      toast({ title: `${parsed.length} rows imported from Excel` });
    } catch (err: any) {
      toast({ title: "Failed to parse file", description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  }, [toast]);

  const activeRows = tab === "manual" ? rows : csvRows;

  const handleSubmit = async () => {
    const validRows = activeRows.filter((r) => parseFloat(r.amount) > 0);
    if (!validRows.length) {
      toast({ title: "No valid rows to add", variant: "destructive" });
      return;
    }

    const expenses = validRows.map((r) => {
      const amt = parseFloat(r.amount);
      const needsApproval = threshold > 0 && amt > threshold;
      return {
        project_id: projectId,
        category: r.category as any,
        amount: amt,
        amount_aed: amt,
        currency: "AED",
        exchange_rate: 1,
        description: r.description || null,
        date: r.date,
        status: (needsApproval ? "pending" : "approved") as any,
      };
    });

    try {
      await bulkCreate.mutateAsync(expenses);
      toast({ title: "Expenses added", description: `${validRows.length} entries recorded` });
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setCsvRows([]);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Add Expenses</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Inline Entry</TabsTrigger>
            <TabsTrigger value="import">CSV / Excel Import</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3 mt-4">
            {/* Header row */}
            <div className="grid grid-cols-[120px_100px_120px_1fr_32px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wider px-1">
              <span>Category</span><span>Amount (AED)</span><span>Date</span><span>Description</span><span></span>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[120px_100px_120px_1fr_32px] gap-2 items-center">
                <Select value={row.category} onValueChange={(v) => updateRow(i, "category", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-8 text-xs"
                  value={row.amount} onChange={(e) => updateRow(i, "amount", e.target.value)} />
                <DateInput value={row.date} onChange={(v) => updateRow(i, "date", v)} className="h-8 text-xs" />
                <Input placeholder="Description" className="h-8 text-xs"
                  value={row.description} onChange={(e) => updateRow(i, "description", e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={rows.length <= 1} onClick={() => removeRow(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addRow}>
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3">
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file with columns: <strong>category, amount, date, description</strong>
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-3.5 w-3.5 mr-1" /> CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                  </label>
                </Button>
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-3.5 w-3.5 mr-1" /> Excel
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleXlsxUpload} />
                  </label>
                </Button>
              </div>
            </div>

            {csvRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{csvRows.length} rows ready to import:</p>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground border-b bg-muted/30">
                        <th className="text-left py-1.5 px-2">#</th>
                        <th className="text-left py-1.5 px-2">Category</th>
                        <th className="text-right py-1.5 px-2">Amount</th>
                        <th className="text-left py-1.5 px-2">Date</th>
                        <th className="text-left py-1.5 px-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-1 px-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-1 px-2 capitalize">{r.category}</td>
                          <td className="py-1 px-2 text-right font-mono">{r.amount}</td>
                          <td className="py-1 px-2 font-mono">{r.date}</td>
                          <td className="py-1 px-2 text-muted-foreground truncate max-w-[200px]">{r.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={bulkCreate.isPending || activeRows.length === 0}>
            {bulkCreate.isPending ? "Adding..." : `Add ${activeRows.filter((r) => parseFloat(r.amount) > 0).length} Expenses`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
