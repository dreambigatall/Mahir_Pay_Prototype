"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clipboard, FlaskConical, LayoutDashboard, Loader2, LockKeyhole, Pill, Plus, RefreshCw, Search, ShieldCheck, Stethoscope, UserRoundCog, Users, X } from "lucide-react";
import { toast } from "sonner";

import { MetricCard } from "@/components/clinic/metric-card";
import { PageHeader } from "@/components/clinic/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { createStaff, listRoles, listStaff, setStaffStatus, type BackendRole, type BackendStaffMember } from "@/lib/api/staff";
import { useSession } from "@/lib/session";

const supportedRoles = new Set(["receptionist", "doctor", "lab", "pharmacist", "admin"]);
const roleIcons: Record<string, typeof Users> = {
  receptionist: Users,
  doctor: Stethoscope,
  lab: FlaskConical,
  pharmacist: Pill,
  admin: LayoutDashboard,
};
const roleVariants: Record<string, "clinical" | "info" | "warning" | "neutral"> = {
  receptionist: "neutral",
  doctor: "clinical",
  lab: "warning",
  pharmacist: "info",
  admin: "info",
};

export default function AdminUsersPage() {
  const { user } = useSession();
  const [members, setMembers] = useState<BackendStaffMember[]>([]);
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<BackendStaffMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [staffResponse, rolesResponse] = await Promise.all([listStaff(page, pageSize), listRoles()]);
      setMembers(staffResponse.items);
      setTotal(staffResponse.total);
      setRoles(rolesResponse.items.filter((role) => supportedRoles.has(role.slug)));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Staff records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== "all" && !member.roles.includes(roleFilter)) return false;
      if (!value) return true;
      return [member.full_name, member.email, member.title ?? "", member.room ?? ""].some((field) => field.toLowerCase().includes(value));
    });
  }, [members, query, roleFilter]);

  const counts = useMemo(() => ({
    active: members.filter((member) => member.status === "active").length,
    doctors: members.filter((member) => member.roles.includes("doctor")).length,
    reception: members.filter((member) => member.roles.includes("receptionist")).length,
    pending: members.filter((member) => member.must_change_password).length,
  }), [members]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader title="Staff directory & access" description="Create role-based accounts, issue temporary credentials, and control system access." action={<Button className="min-h-11 gap-2" onClick={() => setCreateOpen(true)}><Plus className="size-4" aria-hidden="true" />Add staff account</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total accounts" value={String(total)} />
        <MetricCard label="Active on page" value={String(counts.active)} />
        <MetricCard label="Doctors / reception" value={`${counts.doctors} / ${counts.reception}`} />
        <MetricCard label="Password change due" value={String(counts.pending)} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="min-h-11 w-full sm:w-52"><SelectValue placeholder="Filter by role" /></SelectTrigger><SelectContent><SelectItem value="all">All supported roles</SelectItem>{roles.map((role) => <SelectItem key={role.slug} value={role.slug}>{role.name}</SelectItem>)}</SelectContent></Select>
          <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search current page" className="min-h-11 pl-9 pr-9" />{query ? <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-accent" aria-label="Clear staff search"><X className="size-4" /></button> : null}</div>
        </div>
        <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />Refresh</Button>
      </div>

      {error ? <div role="alert" className="flex items-center justify-between rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void load()}>Try again</Button></div> : null}

      {loading ? <StaffTableSkeleton /> : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-fg-muted">No staff accounts match the selected filters.</div> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-2">
          <Table className="min-w-[920px]">
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Staff member</TableHead><TableHead>Role</TableHead><TableHead>Designation</TableHead><TableHead>Account state</TableHead><TableHead>Security</TableHead><TableHead className="text-right">Access control</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((member) => (
              <TableRow key={member.id} className="hover:bg-surface-1/60">
                <TableCell><div className="flex items-center gap-3"><Avatar className="size-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(member.full_name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{member.full_name}</p><p className="mt-0.5 text-xs text-fg-muted">{member.email}</p></div></div></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{member.roles.map((role) => <RoleChip key={role} role={role} />)}</div></TableCell>
                <TableCell><p className="text-sm">{member.title || "—"}</p>{member.room ? <p className="mt-0.5 text-xs text-fg-muted">{member.room}</p> : null}</TableCell>
                <TableCell><StatusLabel status={member.status} /></TableCell>
                <TableCell>{member.must_change_password ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning-text"><LockKeyhole className="size-3.5" aria-hidden="true" />Temporary password</span> : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-text"><ShieldCheck className="size-3.5" aria-hidden="true" />Password updated</span>}</TableCell>
                <TableCell className="text-right"><Button type="button" variant="outline" size="sm" className="min-h-9" disabled={member.id === user?.id} onClick={() => setStatusTarget(member)}>{member.status === "active" ? "Disable" : "Enable"}</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-fg-secondary"><span>Page {page} of {totalPages} · {total} accounts</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="min-h-9" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" aria-hidden="true" />Previous</Button><Button type="button" variant="outline" size="sm" className="min-h-9" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="size-4" aria-hidden="true" /></Button></div></div>

      <CreateStaffDialog open={createOpen} onOpenChange={setCreateOpen} roles={roles} onCreated={() => { setPage(1); void load(); }} />
      <StatusDialog member={statusTarget} onOpenChange={(open) => { if (!open) setStatusTarget(null); }} onChanged={() => { setStatusTarget(null); void load(); }} />
    </div>
  );
}

function CreateStaffDialog({ open, onOpenChange, roles, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; roles: BackendRole[]; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [role, setRole] = useState("receptionist");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  function reset() { setFullName(""); setEmail(""); setTitle(""); setRoom(""); setRole("receptionist"); setTemporaryPassword(""); setShowPassword(false); setCreated(null); setError(""); }
  function close() { onOpenChange(false); reset(); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try {
      await createStaff({ email: email.trim(), temporaryPassword, fullName: fullName.trim(), title: title.trim() || undefined, room: room.trim() || undefined, roles: [role] });
      setCreated({ email: email.trim(), password: temporaryPassword });
      onCreated();
      toast.success("Staff account created", { description: "Share the temporary credentials securely." });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The staff account could not be created.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally { setSubmitting(false); }
  }

  async function copyCredentials() {
    if (!created) return;
    try { await navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.password}`); toast.success("Temporary credentials copied"); }
    catch { toast.error("Copy failed. Select and copy the credentials manually."); }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); else onOpenChange(true); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{created ? "Account created" : "Add staff account"}</DialogTitle><DialogDescription>{created ? "Copy these credentials now. The temporary password is not stored in readable form." : "The staff member must replace the temporary password at first login."}</DialogDescription></DialogHeader>
        {created ? <div className="space-y-4"><div className="rounded-xl border border-success-fill/30 bg-success-fill/10 p-4"><div className="flex items-center gap-2 font-medium text-success-text"><Check className="size-4" aria-hidden="true" />Ready for first login</div><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs text-fg-muted">Email</dt><dd className="mt-1 font-mono break-all">{created.email}</dd></div><div><dt className="text-xs text-fg-muted">Temporary password</dt><dd className="mt-1 font-mono break-all">{created.password}</dd></div></dl></div><DialogFooter><Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => void copyCredentials()}><Clipboard className="size-4" aria-hidden="true" />Copy credentials</Button><Button type="button" className="min-h-11" onClick={close}>Done</Button></DialogFooter></div> : (
          <form className="space-y-4" onSubmit={submit}>
            {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text"><p className="font-medium">Account was not created</p><p className="mt-1">{error}</p></div> : null}
            <Field label="Full name *" htmlFor="staff-full-name"><Input id="staff-full-name" required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus /></Field>
            <Field label="Work email *" htmlFor="staff-email"><Input id="staff-email" required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Job title" htmlFor="staff-title"><Input id="staff-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Assigned room" htmlFor="staff-room"><Input id="staff-room" value={room} onChange={(event) => setRoom(event.target.value)} /></Field></div>
            <div className="grid gap-1.5"><Label htmlFor="staff-role">System role *</Label><Select value={role} onValueChange={setRole}><SelectTrigger id="staff-role" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item.slug} value={item.slug}>{item.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-fg-muted">Role permissions are enforced by the backend.</p></div>
            <div className="grid gap-1.5"><div className="flex items-center justify-between"><Label htmlFor="temporary-password">Temporary password *</Label><button type="button" onClick={() => { setTemporaryPassword(generateTemporaryPassword()); setShowPassword(true); }} className="text-xs font-medium text-primary hover:underline">Generate password</button></div><div className="flex gap-2"><Input id="temporary-password" required minLength={6} type={showPassword ? "text" : "password"} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} aria-describedby="temporary-password-help" /><Button type="button" variant="outline" className="min-h-10 shrink-0" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</Button></div><p id="temporary-password-help" className="text-xs leading-5 text-fg-muted">At least 6 characters. Letters, numbers, or a mix are all fine.</p></div>
            <DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" className="min-h-11 gap-2" disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserRoundCog className="size-4" aria-hidden="true" />}{submitting ? "Creating account…" : "Create account"}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ member, onOpenChange, onChanged }: { member: BackendStaffMember | null; onOpenChange: (open: boolean) => void; onChanged: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (!member) return null;
  const nextStatus = member.status === "active" ? "disabled" : "active";
  async function confirm() { setSubmitting(true); setError(""); try { await setStaffStatus(member!.id, nextStatus); toast.success(nextStatus === "active" ? "Account enabled" : "Account disabled"); onChanged(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Account status could not be changed."); } finally { setSubmitting(false); } }
  return <Dialog open={Boolean(member)} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{nextStatus === "active" ? "Enable account" : "Disable account"}</DialogTitle><DialogDescription>{nextStatus === "active" ? `${member.full_name} will regain access using their existing password.` : `${member.full_name} will be signed out and prevented from accessing clinic records.`}</DialogDescription></DialogHeader>{error ? <div role="alert" className="rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">{error}</div> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant={nextStatus === "disabled" ? "destructive" : "default"} disabled={submitting} onClick={() => void confirm()}>{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{submitting ? "Updating…" : nextStatus === "active" ? "Enable account" : "Disable account"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
function StaffTableSkeleton() { return <div className="space-y-2 rounded-xl border border-border p-4" aria-label="Loading staff accounts">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2); }
function StatusLabel({ status }: { status: BackendStaffMember["status"] }) { const active = status === "active"; return <span className={active ? "inline-flex items-center gap-1.5 text-xs font-medium text-success-text" : "inline-flex items-center gap-1.5 text-xs font-medium text-danger-text"}><span className={active ? "size-2 rounded-full bg-success-fill" : "size-2 rounded-full bg-danger-fill"} aria-hidden="true" />{status === "active" ? "Active" : status === "locked" ? "Locked" : "Disabled"}</span>; }
function RoleChip({ role }: { role: string }) { const Icon = roleIcons[role] ?? Users; return <Chip variant={roleVariants[role] ?? "neutral"} icon={<Icon aria-hidden="true" />}>{role.replaceAll("_", " ")}</Chip>; }
function generateTemporaryPassword() {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
