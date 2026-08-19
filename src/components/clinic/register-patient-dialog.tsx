"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ageFromDob } from "@/lib/format";
import { getStaff, patients, staff } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Mode = "new" | "returning" | "appointment";

const modes: { id: Mode; label: string; icon: typeof UserPlus }[] = [
  { id: "new", label: "New patient", icon: UserPlus },
  { id: "returning", label: "Returning", icon: Search },
  { id: "appointment", label: "Appointment", icon: CalendarClock },
];

const todayAppointments = [
  { patientId: "p-7", time: "10:30", doctorId: "u-doc-2" },
  { patientId: "p-2", time: "11:00", doctorId: "u-doc-2" },
  { patientId: "p-5", time: "11:45", doctorId: "u-doc-1" },
];

const doctors = staff.filter((person) => person.role === "doctor");

export function RegisterPatientDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("new");
  const [query, setQuery] = useState("");

  function reset() {
    setMode("new");
    setQuery("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>Register patient</Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(520px,90vh)] w-[min(520px,calc(100%-2rem))] max-w-[520px] flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Register patient</DialogTitle>
          <DialogDescription>
            New patients get a profile. Returning patients are found by search.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-1 p-1">
          {modes.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  "flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-md text-[12px] font-medium transition-colors duration-150",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-fg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1">
          {mode === "new" ? (
            <NewPatientForm
              onDone={() => {
                setOpen(false);
                reset();
              }}
              onCancel={() => {
                setOpen(false);
                reset();
              }}
            />
          ) : null}
          {mode === "returning" ? (
            <ReturningSearch
              query={query}
              onQueryChange={setQuery}
              onSelect={(name) => {
                toast.success("Added to queue", {
                  description: `${name} would be checked in for today.`,
                });
                setOpen(false);
                reset();
              }}
            />
          ) : null}
          {mode === "appointment" ? (
            <AppointmentList
              onCheckIn={(name) => {
                toast.success("Checked in", {
                  description: `${name} is on today’s queue.`,
                });
                setOpen(false);
                reset();
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewPatientForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        toast.success("Patient registered", {
          description: "They would be added to today’s queue.",
        });
        onDone();
      }}
    >
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="grid gap-3 pb-3">
          <div className="grid gap-1.5">
            <Label htmlFor="full-name" className="font-normal">
              Full name
            </Label>
            <Input id="full-name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="dob" className="font-normal">
                Date of birth
              </Label>
              <Input id="dob" name="dob" type="date" required />
            </div>
            <div className="grid gap-1.5">
              <Label className="font-normal">Gender</Label>
              <Select defaultValue="F">
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="M">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone" className="font-normal">
              Phone number
            </Label>
            <Input id="phone" name="phone" required />
          </div>
          <div className="grid gap-1.5">
            <Label className="font-normal">Assign doctor</Label>
            <Select defaultValue={doctors[0]?.id}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                    {doctor.room ? ` · ${doctor.room}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>
      <DialogFooter className="-mx-4 mt-auto">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save patient</Button>
      </DialogFooter>
    </form>
  );
}

function ReturningSearch({
  query,
  onQueryChange,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (name: string) => void;
}) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients.filter((patient) => {
      const phone = patient.phone.replace(/\s/g, "");
      return (
        patient.name.toLowerCase().includes(q) ||
        patient.patientId.toLowerCase().includes(q) ||
        phone.includes(q.replace(/\s/g, ""))
      );
    });
  }, [query]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name, phone, or patient ID"
          className="pl-9"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {query.trim() === "" ? (
          <p className="py-8 text-center text-[13px] text-fg-muted">
            Type to find a patient who already has a record.
          </p>
        ) : matches.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-fg-muted">
            No patients found. Use New patient if this is a first visit.
          </p>
        ) : (
          <div className="space-y-1 pr-2">
            {matches.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => onSelect(patient.name)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-left hover:border-border-strong"
              >
                <span>
                  <span className="block text-[14px] font-medium">{patient.name}</span>
                  <span className="block font-mono text-[12px] text-fg-muted">
                    {patient.patientId} · {ageFromDob(patient.dateOfBirth)}
                    {patient.gender}
                  </span>
                </span>
                <span className="text-[12px] text-fg-secondary">{patient.phone}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function AppointmentList({ onCheckIn }: { onCheckIn: (name: string) => void }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 pr-2">
        {todayAppointments.map((slot) => {
          const patient = patients.find((item) => item.id === slot.patientId);
          const doctor = getStaff(slot.doctorId);
          if (!patient) return null;
          return (
            <div
              key={`${slot.patientId}-${slot.time}`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2"
            >
              <div>
                <p className="text-[14px] font-medium">{patient.name}</p>
                <p className="text-[12px] text-fg-secondary">
                  {slot.time} · {doctor?.name}
                </p>
              </div>
              <Button size="sm" onClick={() => onCheckIn(patient.name)}>
                Check in
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
