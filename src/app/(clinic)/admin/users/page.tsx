"use client";

import { useMemo, useState } from "react";
import { Search, UserCheck, Users, X } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { staff } from "@/lib/mock-data";
import { roleLabel } from "@/lib/nav";
import type { Role } from "@/lib/types";

export default function AdminUsersPage() {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredStaff = useMemo(() => {
    let list = staff;

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
  }, [roleFilter, search]);

  const counts = useMemo(() => {
    return {
      all: staff.length,
      doctor: staff.filter((s) => s.role === "doctor").length,
      receptionist: staff.filter((s) => s.role === "receptionist").length,
      lab: staff.filter((s) => s.role === "lab").length,
      admin: staff.filter((s) => s.role === "admin").length,
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff directory & access"
        description="Role-based credentials, assigned clinical rooms, and personnel roster."
      />

      {/* Filter Tabs and Search Bar */}
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
            className="h-9 pl-8 pr-8 text-[13px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
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
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[35%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Staff member
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  System role
                </TableHead>
                <TableHead className="h-11 w-[25%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Designation & room
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Duty status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((person) => (
                <TableRow key={person.id} className="h-12 hover:bg-surface-1/60">
                  <TableCell className="px-4 py-2.5 text-left">
                    <p className="font-medium text-[14px] text-foreground">
                      {person.name}
                    </p>
                    <p className="font-mono text-[11px] text-fg-muted">
                      ID: {person.id.toUpperCase()}
                    </p>
                  </TableCell>

                  <TableCell className="px-4 py-2.5 text-left">
                    <Chip variant={
                        person.role === "doctor"
                          ? "clinical"
                          : person.role === "admin"
                            ? "info"
                            : person.role === "lab"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {roleLabel[person.role]}
                    </Chip>
                  </TableCell>

                  <TableCell className="px-4 py-2.5 text-left text-[13px] text-foreground">
                    <p>{person.title}</p>
                    {person.room && (
                      <span className="font-mono text-[11px] text-fg-muted">
                        Assigned: {person.room}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-2.5 text-left">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success-text">
                      <span className="size-2 rounded-full bg-success-fill" />
                      Active / On duty
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
