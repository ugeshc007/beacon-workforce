import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, ExternalLink, Paperclip, Check, X, FileText, Upload, Receipt, Trash2,
} from "lucide-react";
import { PurchaseInvoiceDialog } from "./PurchaseInvoiceDialog";
import { BulkExpenseDialog } from "./BulkExpenseDialog";
import { supabase } from "@/integrations/supabase/client";
import { useCreateExpense, useApproveExpense, useDeleteExpense } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const CATEGORIES = ["labor", "overtime", "travel", "material", "transport", "equipment", "misc"] as const;
const CURRENCIES = [
  { code: "AED", label: "AED", rate: 1 },
  { code: "USD", label: "USD", rate: 3.6725 },
  { code: "EUR", label: "EUR", rate: 4.02 },
] as const;

interface Props {
  projectId: string;
  expenses: Tables<"project_expenses">[] | undefined;
}

export function ProjectExpensesTab({ projectId, expenses }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const createMutation = useCreateExpense();
  const approveMutation = useApproveExpense();
  const deleteMutation = useDeleteExpense();
  const { data: settings } = useSettings();
  const { isAdmin, isManager } = useAuth();
  const { toast } = useToast();

  // Form state
  const [category, setCategory] = useState<string>("material");
  const [quantity, setQuantity] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const computedAmount = (parseFloat(quantity) || 0) * (parseFloat(unitRate) || 0);

  const threshold = Number(settings?.expense_approval_threshold ?? 0);
  const canApprove = isAdmin || isManager;

  const resetForm = () => {
    setCategory("material");
    setQuantity("");
    setUnitRate("");
    setCurrency("AED");
    setExchangeRate("1");
    setDescription("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setReceiptFile(null);
  };

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    const c = CURRENCIES.find((c) => c.code === code);
    setExchangeRate(c ? String(c.rate) : "1");
  };

  const handleSubmit = async () => {
    const amtNum = computedAmount;
    if (!amtNum || amtNum <= 0) {
      toast({ title: "Enter valid quantity and unit rate", variant: "destructive" });
      return;
    }
    const rate = parseFloat(exchangeRate) || 1;
    const amountAed = currency === "AED" ? amtNum : Math.round(amtNum * rate * 100) / 100;
    const needsApproval = threshold > 0 && amountAed > threshold;

    try {
      const { id: expenseId } = await createMutation.mutateAsync({
        project_id: projectId,
        category: category as any,
        amount: amtNum,
        amount_aed: amountAed,
        currency,
        exchange_rate: rate,
        description: description || null,
        date: expenseDate,
        status: needsApproval ? "pending" : "approved",
      });

      // Upload receipt if provided
      if (receiptFile && expenseId) {
        const ext = receiptFile.name.split(".").pop();
        const path = `${projectId}/${expenseId}.${ext}`;
        await supabase.storage.from("receipts").upload(path, receiptFile, { upsert: true });
        await supabase.from("project_expenses").update({ receipt_url: path }).eq("id", expenseId);
      }

      toast({
        title: "Expense added",
        description: needsApproval ? "Pending manager approval" : "Auto-approved (below threshold)",
      });
      resetForm();
      setAddOpen(false);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (expenseId: string, status: "approved" | "rejected") => {
    try {
      await approveMutation.mutateAsync({ expenseId, projectId, status });
      toast({ title: `Expense ${status}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleReceiptUpload = async (expenseId: string, file: File) => {
    setUploadingId(expenseId);
    const ext = file.name.split(".").pop();
    const path = `${projectId}/${expenseId}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("project_expenses").update({ receipt_url: path }).eq("id", expenseId);
      toast({ title: "Receipt uploaded" });
    }
    setUploadingId(null);
  };

  const statusColor = (s: string) =>
    s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {expenses?.length ?? 0} expense{(expenses?.length ?? 0) !== 1 ? "s" : ""}
          {threshold > 0 && (
            <span className="ml-2 text-xs">(Auto-approve ≤ AED {threshold.toLocaleString()})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setInvoiceOpen(true)}>
            <Receipt className="h-3.5 w-3.5" /> Purchase Invoice
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setBulkOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Bulk Add
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="pt-4">
          {!expenses?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-left py-2 font-medium">Invoice</th>
                    <th className="text-left py-2 font-medium">Supplier</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-right py-2 font-medium">AED</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-left py-2 font-medium">Receipt</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    {canApprove && <th className="text-right py-2 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-mono text-xs">{format(new Date(e.date), "dd/MM/yyyy")}</td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{e.category}</Badge>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">{(e as any).invoice_number ?? "—"}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{(e as any).supplier_name ?? "—"}</td>
                      <td className="py-2.5 text-right font-mono text-xs">
                        {e.currency !== "AED" ? `${e.currency} ${Number(e.amount).toLocaleString()}` : `AED ${Number(e.amount).toLocaleString()}`}
                      </td>
                      <td className="py-2.5 text-right font-mono font-medium">
                        AED {Number(e.amount_aed ?? e.amount).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">
                        {e.description ?? "—"}
                      </td>
                      <td className="py-2.5">
                        {e.receipt_url ? (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-brand"
                            onClick={async () => {
                              const { data } = await supabase.storage.from("receipts").createSignedUrl(e.receipt_url!, 3600);
                              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                            disabled={uploadingId === e.id}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*,.pdf";
                              input.onchange = (ev) => {
                                const file = (ev.target as HTMLInputElement).files?.[0];
                                if (file) handleReceiptUpload(e.id, file);
                              };
                              input.click();
                            }}
                          >
                            <Paperclip className="h-3 w-3 mr-1" />
                            {uploadingId === e.id ? "..." : "Attach"}
                          </Button>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Badge variant={statusColor(e.status)} className="text-[10px]">
                          {e.status}
                        </Badge>
                        {e.approval_notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{e.approval_notes}</p>
                        )}
                      </td>
                      {canApprove && (
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {e.status === "pending" && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-status-present hover:bg-status-present/10"
                                  disabled={approveMutation.isPending}
                                  onClick={() => handleApprove(e.id, "approved")}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  disabled={approveMutation.isPending}
                                  onClick={() => handleApprove(e.id, "rejected")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  if (confirm("Delete this expense?")) {
                                    deleteMutation.mutate(
                                      { expenseId: e.id, projectId },
                                      { onSuccess: () => toast({ title: "Expense deleted" }) }
                                    );
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <DateInput value={expenseDate} onChange={setExpenseDate} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input type="number" step="1" min="0" placeholder="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit Rate</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rate → AED</Label>
                <Input type="number" step="0.0001" min="0" value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  disabled={currency === "AED"}
                />
              </div>
            </div>

            {computedAmount > 0 && (
              <div className="rounded-lg bg-muted/30 border border-border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono font-medium">{currency} {computedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {currency !== "AED" && (
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">≈ AED</span>
                    <span className="font-mono font-medium">AED {(computedAmount * (parseFloat(exchangeRate) || 1)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What was this expense for?" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Receipt (optional)</Label>
              <Input type="file" accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setAddOpen(false); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PurchaseInvoiceDialog projectId={projectId} open={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <BulkExpenseDialog projectId={projectId} open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}
