"use client";

import { useMemo, useState } from "react";
import {
  Edit2,
  FlaskConical,
  LayoutDashboard,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { MetricCard } from "@/components/clinic/metric-card";
import { PageHeader } from "@/components/clinic/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { staff as seedStaff } from "@/lib/mock-data";
import { roleLabel } from "@/lib/nav";
import type { Role, StaffUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const roleIcon: Record<Role, typeof Users> = {
  receptionist: Users,
  doctor: Stethoscope,
  lab: FlaskConical,
  admin: LayoutDashboard,
};

const roleChipVariant: Record<Role, "clinical" | "info" | "warning" | "neutral"> = {
  doctor: "clinical",
  admin: "info",
  lab: "warning",
  receptionist: "neutral",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ---------- Add / Edit Staff Dialog ---------- */

function StaffFormDialog({
  open,
  onOpenChange,
  editUser,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editUser: StaffUser | null;
  onSave: (user: StaffUser) => void;
}) {
  const isEdit = !!editUser;
  const [name, setName] = useState(editUser?.name ?? "");
  const [role, setRole] = useState<Role>(editUser?.role ?? "receptionist");
  const [title, setTitle] = useState(editUser?.title ?? "");
  const [room, setRoom] = useState(editUser?.room ?? "");

  // Reset form when dialog opens/closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setName(editUser?.name ?? "");
      setRole(editUser?.role ?? "receptionist");
      setTitle(editUser?.title ?? "");
      setRoom(editUser?.room ?? "");
    }
    onOpenChange(v);
  };

  const handleSubmit = () => {
    if (!name.trim() || !title.trim()) {
      toast.error("Name and title are required");
      return;
    }
    const user: StaffUser = {
      id: editUser?.id ?? `u-${role[0]}-${Date.now()}`,
      name: name.trim(),
      role,
      title: title.trim(),
      room: room.trim() || undefined,
    };
    onSave(user);
    handleOpenChange(false);
    toast.success(isEdit ? "Staff member updated" : "Staff member added", {
      description: `${user.name} — ${roleLabel[user.role]}`,
    });
  };

  const roleOptions: { value: Role; label: string; icon: typeof Users }[] = [
    { value: "receptionist", label: "Receptionist", icon: Users },
    { value: "doctor", label: "Doctor", icon: Stethoscope },
    { value: "lab", label: "Lab Technician", icon: FlaskConical },
    { value: "admin", label: "Admin", icon: LayoutDashboard },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit staff member" : "Add new staff member"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the personnel details below."
              : "Fill out the details to register a new team member."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Full Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="staff-name" className="text-[13px]">
              Full name *
            </Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Kwame Osei"
              className="bg-background"
            />
          </div>

          {/* Role Selection */}
          <div className="grid gap-1.5">
            <Label className="text-[13px]">System role *</Label>
            <RadioGroup
              value={role}
              onValueChange={(v) => setRole(v as Role)}
              className="grid grid-cols-2 gap-2"
              disabled={isEdit}
            >
              {roleOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.value}
                    htmlFor={`role-${opt.value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
                      role === opt.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border bg-background text-fg-secondary hover:border-border-strong",
                      isEdit && "opacity-60 pointer-events-none"
                    )}
                  >
                    <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className="sr-only" />
                    <Icon className="size-4 shrink-0" />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Job Title */}
          <div className="grid gap-1.5">
            <Label htmlFor="staff-title" className="text-[13px]">
              Job title / designation *
            </Label>
            <Input
              id="staff-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. General practitioner"
              className="bg-background"
            />
          </div>

          {/* Room Assignment (optional) */}
          <div className="grid gap-1.5">
            <Label htmlFor="staff-room" className="text-[13px]">
              Assigned room <span className="text-fg-muted">(optional)</span>
            </Label>
            <Input
              id="staff-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. Room 3"
              className="bg-background"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-1.5">
            {isEdit ? (
              <>
                <Edit2 className="size-3.5" />
                Update member
              </>
            ) : (
              <>
                <UserPlus className="size-3.5" />
                Add member
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Delete Confirmation Dialog ---------- */

function DeleteConfirmDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUser | null;
  onConfirm: () => void;
}) {
  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove staff member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove <strong>{user.name}</strong> from the system? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
              toast.success("Staff member removed", {
                description: `${user.name} has been removed from the roster.`,
              });
            }}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Main Page ---------- */

export default function AdminUsersPage() {
  const [staffList, setStaffList] = useState<StaffUser[]>(() => [...seedStaff]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);

  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (roleFilter !== "all") {
      list = list.filter((s) => s.role === roleFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          (s.room && s.room.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [staffList, roleFilter, search]);

  const counts = useMemo(() => {
    return {
      all: staffList.length,
      doctor: staffList.filter((s) => s.role === "doctor").length,
      receptionist: staffList.filter((s) => s.role === "receptionist").length,
      lab: staffList.filter((s) => s.role === "lab").length,
      admin: staffList.filter((s) => s.role === "admin").length,
    };
  }, [staffList]);

  const handleSaveUser = (user: StaffUser) => {
    setStaffList((prev) => {
      const idx = prev.findIndex((s) => s.id === user.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = user;
        return copy;
      }
      return [...prev, user];
    });
  };

  const handleDeleteUser = () => {
    if (!deleteUser) return;
    setStaffList((prev) => prev.filter((s) => s.id !== deleteUser.id));
    setDeleteUser(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff directory & access"
        description="Manage role-based credentials, assigned clinical rooms, and personnel roster."
        action={
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add staff member
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <MetricCard label="Total staff" value={String(counts.all)} />
        <MetricCard label="Doctors" value={String(counts.doctor)} />
        <MetricCard label="Reception" value={String(counts.receptionist)} />
        <MetricCard label="Lab techs" value={String(counts.lab)} />
        <MetricCard label="Admins" value={String(counts.admin)} />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 bg-background">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="doctor">Doctors ({counts.doctor})</SelectItem>
            <SelectItem value="receptionist">Reception ({counts.receptionist})</SelectItem>
            <SelectItem value="lab">Lab ({counts.lab})</SelectItem>
            <SelectItem value="admin">Admin ({counts.admin})</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name or room…"
            className="h-9 pl-8 pr-8 text-[13px] bg-background"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Staff Table */}
      {filteredStaff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-fg-muted">
          No staff members match the selected filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Staff member
                </TableHead>
                <TableHead className="h-11 px-4 text-left text-[12px] font-medium text-fg-secondary">
                  System role
                </TableHead>
                <TableHead className="h-11 px-4 text-left text-[12px] font-medium text-fg-secondary hidden sm:table-cell">
                  Designation & room
                </TableHead>
                <TableHead className="h-11 px-4 text-left text-[12px] font-medium text-fg-secondary hidden md:table-cell">
                  Duty status
                </TableHead>
                <TableHead className="h-11 w-[100px] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((person) => {
                const Icon = roleIcon[person.role];
                return (
                  <TableRow key={person.id} className="h-14 hover:bg-surface-1/60">
                    {/* Name + avatar */}
                    <TableCell className="px-4 py-2.5 text-left">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-[12px] font-semibold">
                            {initials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-[14px] text-foreground">
                            {person.name}
                          </p>
                          <p className="font-mono text-[11px] text-fg-muted">
                            ID: {person.id.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role Chip */}
                    <TableCell className="px-4 py-2.5 text-left">
                      <Chip variant={roleChipVariant[person.role]} icon={<Icon />}>
                        {roleLabel[person.role]}
                      </Chip>
                    </TableCell>

                    {/* Designation & room */}
                    <TableCell className="px-4 py-2.5 text-left text-[13px] text-foreground hidden sm:table-cell">
                      <p>{person.title}</p>
                      {person.room && (
                        <span className="font-mono text-[11px] text-fg-muted">
                          Assigned: {person.room}
                        </span>
                      )}
                    </TableCell>

                    {/* Duty status */}
                    <TableCell className="px-4 py-2.5 text-left hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success-text">
                        <span className="size-2 rounded-full bg-success-fill" />
                        Active / On duty
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditUser(person)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted hover:text-foreground hover:bg-surface-1 transition-colors cursor-pointer"
                          aria-label={`Edit ${person.name}`}
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUser(person)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted hover:text-danger-text hover:bg-danger-bg transition-colors cursor-pointer"
                          aria-label={`Remove ${person.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <StaffFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editUser={null}
        onSave={handleSaveUser}
      />
      <StaffFormDialog
        open={!!editUser}
        onOpenChange={(v) => { if (!v) setEditUser(null); }}
        editUser={editUser}
        onSave={handleSaveUser}
      />
      <DeleteConfirmDialog
        open={!!deleteUser}
        onOpenChange={(v) => { if (!v) setDeleteUser(null); }}
        user={deleteUser}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
}
