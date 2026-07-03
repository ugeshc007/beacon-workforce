import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Eye, EyeOff, Mail, AlertTriangle } from "lucide-react";
import { invokeEdge } from "@/lib/invoke-edge";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  new_password: z.string().min(6, "Minimum 6 characters"),
  confirm_password: z.string().min(6, "Minimum 6 characters"),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string } | null;
}

export function ResetPasswordDialog({ open, onOpenChange, employee }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [emailInfo, setEmailInfo] = useState<{ auth_email: string | null; employee_email: string | null; mismatch: boolean } | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);

  useEffect(() => {
    if (!open || !employee) { setEmailInfo(null); return; }
    setLoadingEmail(true);
    invokeEdge<{ auth_email: string | null; employee_email: string | null; mismatch: boolean }>(
      "get-employee-login-email",
      { employee_id: employee.id },
    )
      .then(setEmailInfo)
      .catch(() => setEmailInfo(null))
      .finally(() => setLoadingEmail(false));
  }, [open, employee]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!employee) return;
    setLoading(true);
    try {
      await invokeEdge("reset-employee-password", {
        employee_id: employee.id,
        new_password: values.new_password,
      });

      toast({
        title: "Password Reset",
        description: `Password updated for ${employee.name}. Share the new credentials securely.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Failed to reset password",
        description: e.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{employee?.name}</strong>'s mobile app login.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Login email
          </div>
          {loadingEmail ? (
            <div className="text-muted-foreground text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : emailInfo?.auth_email ? (
            <>
              <div className="font-mono text-sm break-all">{emailInfo.auth_email}</div>
              {emailInfo.mismatch && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Employee record has a different email ({emailInfo.employee_email}). User must log in with the address above.</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-xs">No login account found.</div>
          )}
        </div>


        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        placeholder="Minimum 6 characters"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPw(!showPw)}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    At least 6 characters. Share securely with the employee.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type={showPw ? "text" : "password"} placeholder="Re-enter password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
