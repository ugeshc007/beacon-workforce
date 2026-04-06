import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useBulkCreateExpenses } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["material", "transport", "equipment", "misc"] as const;
const CURRENCIES = [
  { code: "AED", label: "AED", rate: 1 },
  { code: "USD", label: "USD", rate: 3.6725 },
  { code: "EUR", label: "EUR", rate: 4.02 },
] as const;

interface LineItem {
  category: string;
  quantity: string;
  unitRate: string;
  description: string;
}

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseInvoiceDialog({ projectId, open, onOpenChange }: Props) {
  const bulkCreate = useBulkCreateExpenses();
  const { data: settings } = useSettings();
  const { toast } = useToast();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [lines, setLines] = useState<LineItem[]>([
    { category: "material", quantity: "", unitRate: "", description: "" },
  ]);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    const c = CURRENCIES.find((c) => c.code === code);
    setExchangeRate(c ? String(c.rate) : "1");
  };

  const addLine = () => setLines([...lines, { category: "material", quantity: "", unitRate: "", description: "" }]);

  const updateLine = (i: number, field: keyof LineItem, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const totalAmount = lines.reduce((s, l) => s + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unitRate) || 0)), 0);
  const rate = parseFloat(exchangeRate) || 1;
  const totalAed = currency === "AED" ? totalAmount : Math.round(totalAmount * rate * 100) / 100;
  const threshold = Number(settings?.expense_approval_threshold ?? 0);

  const reset = () => {
    setInvoiceNumber("");
    setSupplierName("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setCurrency("AED");
    setExchangeRate("1");
    setLines([{ category: "material", quantity: "", unitRate: "", description: "" }]);
  };

  const handleSubmit = async () => {
    if (!invoiceNumber.trim()) {
      toast({ title: "Invoice number required", variant: "destructive" });
      return;
    }
    const validLines = lines.filter((l) => (parseFloat(l.quantity) || 0) * (parseFloat(l.unitRate) || 0) > 0);
    if (!validLines.length) {
      toast({ title: "Add at least one line with an amount", variant: "destructive" });
      return;
    }

    const expenses = validLines.map((l) => {
      const amt = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitRate) || 0);
      const amountAed = currency === "AED" ? amt : Math.round(amt * rate * 100) / 100;
      const needsApproval = threshold > 0 && amountAed > threshold;
      return {
        project_id: projectId,
        category: l.category as any,
        amount: amt,
        amount_aed: amountAed,
        currency,
        exchange_rate: rate,
        description: l.description || null,
        date: invoiceDate,
        status: (needsApproval ? "pending" : "approved") as any,
        invoice_number: invoiceNumber.trim(),
        supplier_name: supplierName.trim() || null,
        due_date: dueDate || null,
      };
    });

    try {
      await bulkCreate.mutateAsync(expenses);
      toast({ title: "Invoice added", description: `${validLines.length} line(s) recorded` });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice No. *</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Vendor name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice Date</Label>
              <DateInput value={invoiceDate} onChange={setInvoiceDate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <DateInput value={dueDate} onChange={setDueDate} />
            </div>
          </div>

          {/* Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currency !== "AED" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Rate → AED</Label>
                <Input type="number" step="0.0001" min="0" value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)} />
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Line Items</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-brand" onClick={addLine}>
                <Plus className="h-3 w-3 mr-1" /> Add Line
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[120px_100px_1fr_32px] gap-2 items-end">
                  <Select value={line.category} onValueChange={(v) => updateLine(i, "category", v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    className="h-9 text-xs" value={line.amount}
                    onChange={(e) => updateLine(i, "amount", e.target.value)} />
                  <Input placeholder="Description" className="h-9 text-xs"
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)} />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    disabled={lines.length <= 1} onClick={() => removeLine(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end pt-2 border-t border-border">
              <p className="text-sm font-medium">
                Total: <span className="font-mono">AED {totalAed.toLocaleString()}</span>
                {currency !== "AED" && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({currency} {totalAmount.toLocaleString()})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={bulkCreate.isPending}>
            {bulkCreate.isPending ? "Saving..." : "Save Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
