"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { roleHome } from "@/lib/nav";
import { useSession } from "@/lib/session";

export default function ChangePasswordPage() {
  const { user, ready, changePassword } = useSession();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (!user.mustChangePassword) router.replace(roleHome[user.role]);
  }, [ready, user, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      if (user) router.replace(roleHome[user.role]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Password could not be changed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !user) return <div className="min-h-screen bg-background" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-1 px-4 py-10">
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Set your permanent password</CardTitle>
            <CardDescription className="mt-1.5">
              Your temporary password must be replaced before clinical records can be accessed.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Temporary password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} aria-describedby="password-help" />
              <p id="password-help" className="text-xs leading-5 text-fg-muted">
                Use at least 6 characters. Letters, numbers, or a mix are all fine.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
            {error ? <div role="alert" className="rounded-lg border border-danger-fill/30 bg-danger-fill/10 px-3 py-2.5 text-sm text-danger-text">{error}</div> : null}
            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
              {submitting ? "Updating password…" : "Update password and continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
