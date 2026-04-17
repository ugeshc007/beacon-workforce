import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!employee) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-employee-password", {
        body: {
          employee_id: employee.id,
          new_password: values.new_password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => {
                const v = field.value || "";
                const checks = [
                  { ok: v.length >= 8, label: "At least 8 characters" },
                  { ok: /[A-Za-z]/.test(v), label: "Contains a letter" },
                  { ok: /[0-9]/.test(v), label: "Contains a number" },
                  { ok: v.length > 0 && !/^(demo|test|password|12345678|qwerty)/i.test(v), label: "Not a common password" },
                ];
                const suggestion = `BeBright${new Date().getFullYear()}!`;
                return (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          placeholder="Min 8 chars, letters + numbers"
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

                    <div className="rounded-md border border-border bg-muted/30 p-2.5 mt-2 space-y-1.5">
                      <p className="text-xs font-medium text-foreground">Password must have:</p>
                      <ul className="space-y-1">
                        {checks.map((c, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs">
                            <span className={c.ok ? "text-status-present" : "text-muted-foreground"}>
                              {c.ok ? "✓" : "○"}
                            </span>
                            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                              {c.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground pt-1">
                        Try:{" "}
                        <button
                          type="button"
                          className="font-mono text-primary hover:underline"
                          onClick={() => {
                            field.onChange(suggestion);
                            form.setValue("confirm_password", suggestion);
                          }}
                        >
                          {suggestion}
                        </button>
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
