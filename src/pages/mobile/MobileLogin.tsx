import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import bebrightLogo from "@/assets/bebright-logo.png";

export default function MobileLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useMobileAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    toast({ title: "Welcome!", description: "You're signed in." });
    navigate("/m", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 safe-area-inset">
      {/* Logo area */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-20 h-20 flex items-center justify-center">
          <img src={bebrightLogo} alt="BeBright" className="w-full h-full object-contain drop-shadow-lg" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">BeBright</h1>
          <p className="text-sm text-muted-foreground mt-1">Field Worker App</p>
        </div>
      </div>

      {/* Login form */}
      <div className="w-full max-w-sm space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-email" className="text-sm">Email</Label>
            <Input
              id="m-email"
              type="email"
              placeholder="your.email@bebright.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-password" className="text-sm">Password</Label>
            <div className="relative">
              <Input
                id="m-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-12 text-base pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Contact your supervisor if you need access.
        </p>
      </div>
    </div>
  );
}
