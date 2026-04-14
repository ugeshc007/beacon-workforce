import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setSent(true);
    toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <img src="/bebright-logo.png" alt="BeBright" className="h-12 w-auto" />
          <h1 className="text-2xl font-bold text-gradient-brand">Reset Password</h1>
        </div>

        <Card className="border-border/50">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-brand" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a reset link to <span className="font-medium text-foreground">{email}</span>.
                  Check your inbox and follow the link to reset your password.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@bebright.ae"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
