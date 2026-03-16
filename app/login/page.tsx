"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_BASE = `${API_URL}/api`;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill hint based on role query param
  useEffect(() => {
    const role = searchParams.get("role");
    if (role === "super-admin") {
      setEmail("admin@dmrc.gov.in");
    } else if (role === "user") {
      setEmail("user@dmrc.gov.in");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Invalid email or password.");
      }

      // Store token in localStorage for now (you can switch to cookies later)
      if (data.token) {
        window.localStorage.setItem("dmrc_token", data.token);
      }

      toast({
        title: "Login successful",
        description: `Welcome, ${data.user?.name || "user"}`,
      });

      const role = data.user?.role;
      if (role === "superadmin") {
        router.push("/admin");
      } else {
        router.push("/staff");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description:
          error?.message ||
          "Unable to sign in. Please verify the backend is running and your credentials are correct.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#1859c9] px-4 text-foreground">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-4 text-white">
        <Button
          variant="ghost"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 backdrop-blur hover:bg-white/20"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          asChild
          variant="ghost"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 backdrop-blur hover:bg-white/20"
        >
          <Link href="/">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </Button>
      </div>
      <div className="mx-auto w-full max-w-md">
        <Card className="border-none bg-gradient-to-b from-slate-50 to-sky-50 shadow-xl shadow-slate-900/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">
              Login to DMRC HMS
            </CardTitle>
            <CardDescription>
              Use the credentials provided by the administrator to access the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800" htmlFor="email">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dmrc.gov.in"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-full bg-[#043373] text-slate-50 hover:bg-[#022653]"
              >
                {loading ? "Signing in..." : "Login"}
              </Button>
            </form>

            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <p className="font-semibold">Demo credentials</p>
              <p>
                <span className="font-medium">Super Admin:</span> admin@dmrc.gov.in / Admin@123
              </p>
              <p>
                <span className="font-medium">User:</span> user@dmrc.gov.in / User@123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
