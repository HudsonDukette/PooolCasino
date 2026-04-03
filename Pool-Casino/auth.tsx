import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin, useRegister, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, Mail, AlertCircle, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMut = useLogin();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (currentUser && !currentUser.isGuest) setLocation("/");
  }, [currentUser, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMut.mutate(
      { data: { username, password } },
      {
        onSuccess: async () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          toast({ title: "Welcome back!", description: "Successfully logged in." });
          setLocation("/");
        },
        onError: (err) => {
          toast({ title: "Login Failed", description: err.error?.error || "Invalid credentials", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
        <CardHeader className="space-y-1 pb-8 text-center relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,255,170,0.5)]">
            <Lock className="w-6 h-6 text-black" />
          </div>
          <CardTitle className="text-3xl font-display font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to access the casino</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Username"
              icon={<User className="w-5 h-5" />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-black/50"
            />
            <Input
              type="password"
              placeholder="Password"
              icon={<Lock className="w-5 h-5" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-black/50"
            />
            <Button
              type="submit"
              className="w-full h-12 text-base mt-2 shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
              disabled={loginMut.isPending}
            >
              {loginMut.isPending ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium neon-text-primary">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const registerMut = useRegister();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (currentUser && !currentUser.isGuest) setLocation("/");
  }, [currentUser, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMut.mutate(
      { data: { username, password, email: email || undefined, referralCode: referralCode.trim().toUpperCase() || undefined } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          toast({ title: "Account Created!", description: data.message, className: "bg-success text-success-foreground border-none" });
          setLocation("/");
        },
        onError: (err) => {
          toast({ title: "Registration Failed", description: err.error?.error || "Username might be taken", variant: "destructive" });
        }
      }
    );
  };

  if (currentUser && !currentUser.isGuest) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-accent/20 rounded-full blur-[100px]" />
        <CardHeader className="space-y-1 pb-8 text-center relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-accent to-secondary rounded-xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(255,0,255,0.5)]">
            <User className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-display font-bold tracking-tight">Join the Pool</CardTitle>
          <CardDescription>Create an account to start playing and claiming rewards</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Username (min 3 chars)"
              icon={<User className="w-5 h-5" />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="bg-black/50"
            />
            <Input
              type="email"
              placeholder="Email (Optional)"
              icon={<Mail className="w-5 h-5" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/50"
            />
            <Input
              type="password"
              placeholder="Password (min 6 chars)"
              icon={<Lock className="w-5 h-5" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-black/50"
            />
            <Input
              placeholder="Referral Code (Optional)"
              icon={<Tag className="w-5 h-5" />}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="bg-black/50 font-mono tracking-widest"
            />

            {referralCode.trim().length > 0 && (
              <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-3 flex items-start gap-3">
                <Tag className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-300 leading-relaxed">
                  Referral code applied! You'll receive an extra <span className="font-bold text-green-200">$20,000</span> bonus on signup.
                </p>
              </div>
            )}

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3 mt-2">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary/90 leading-relaxed">
                New accounts receive a starting balance to play. This is a simulator, no real money is required or awarded.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base mt-4 shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
              disabled={registerMut.isPending}
            >
              {registerMut.isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium neon-text-primary">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
