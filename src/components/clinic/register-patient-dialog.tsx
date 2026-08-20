"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarClock, Plus, Search, Syringe, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { StartCourseDialog } from "@/components/clinic/start-course-dialog";
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
import { dosesForCourse, nextOpenDose } from "@/lib/courses";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getStaff, staff } from "@/lib/mock-data";
import type { Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "new" | "returning" | "appointment" | "course";

const modes: { id: Mode; label: string; icon: typeof UserPlus }[] = [
  { id: "new", label: "New walk-in", icon: UserPlus },
  { id: "returning", label: "Returning search", icon: Search },
  { id: "appointment", label: "Appointments", icon: CalendarClock },
  { id: "course", label: "Injection / vaccine", icon: Syringe },
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
        <Button className="gap-2 shadow-sm mr-2 mt-1 px-5">
          <Plus className="size-4" />
          Register patient
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(620px,90vh)] w-full sm:max-w-[620px] flex-col gap-4 overflow-hidden p-6">
        <DialogHeader>
          <DialogTitle>Register or check in patient</DialogTitle>
          <DialogDescription>
            Register walk-ins, returning consults, appointments, or daily injection/vaccination attendance.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Segmented Bar */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-surface-1 p-1.5 border border-border/80 sm:grid-cols-4">
          {modes.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  "flex h-[44px] items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-surface-2 text-foreground shadow-sm border border-border font-semibold"
                    : "text-fg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
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
              onDone={() => {
                setOpen(false);
                reset();
              }}
            />
          ) : null}

          {mode === "appointment" ? (
            <AppointmentList
              onDone={() => {
                setOpen(false);
                reset();
              }}
            />
          ) : null}

          {mode === "course" ? (
            <CourseCheckIn
              query={query}
              onQueryChange={setQuery}
              onDone={() => {
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
  const { registerPatient } = useClinic();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"F" | "M">("F");
  const [phone, setPhone] = useState("");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [reason, setReason] = useState("Consultation");
  const [allergiesText, setAllergiesText] = useState("");

  return (
    <form
      className="flex h-full flex-col justify-between"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !dob || !phone.trim()) {
          toast.error("Please fill in all required fields.");
          return;
        }

        const allergies = allergiesText
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);

        const { patient } = registerPatient({
          name: name.trim(),
          dob,
          gender,
          phone: phone.trim(),
          doctorId,
          reason: reason.trim(),
          allergies,
        });

        const assignedDoctor = getStaff(doctorId);

        toast.success("Patient registered & queued", {
          description: `${patient.name} (${patient.patientId}) queued for ${assignedDoctor?.name ?? "the doctor"}.`,
        });

        onDone();
      }}
    >
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="grid gap-4 pb-2">
          {/* Full Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="full-name" className="text-[13px] font-medium text-foreground">
              Full legal name *
            </Label>
            <Input
              id="full-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Samuel Kwabena Appiah"
              required
              autoFocus
              className="h-10 bg-surface-1/60 text-[14px]"
            />
          </div>

          {/* DOB & Gender */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="dob" className="text-[13px] font-medium text-foreground">
                Date of birth *
              </Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className="h-10 bg-surface-1/60 text-[14px]"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-[13px] font-medium text-foreground">Gender *</Label>
              <Select
                value={gender}
                onValueChange={(val) => setGender(val as "F" | "M")}
              >
                <SelectTrigger className="h-10 w-full bg-surface-1/60 text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="M">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Phone & Doctor */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="phone" className="text-[13px] font-medium text-foreground">
                Phone number *
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 024 123 4567"
                required
                className="h-10 bg-surface-1/60 text-[14px] font-mono"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-[13px] font-medium text-foreground">Assign doctor *</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-10 w-full bg-surface-1/60 text-[14px]">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name}
                      {doctor.room ? ` (${doctor.room})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chief Complaint */}
          <div className="grid gap-1.5">
            <Label htmlFor="visit-reason" className="text-[13px] font-medium text-foreground">
              Primary complaint / Reason for visit
            </Label>
            <Input
              id="visit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Fever, persistent cough, general checkup"
              className="h-10 bg-surface-1/60 text-[14px]"
            />
          </div>

          {/* Drug Allergies */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1 text-danger-text">
              <AlertCircle className="size-3.5" />
              <Label htmlFor="known-allergies" className="text-[13px] font-medium text-danger-text">
                Known drug allergies (comma separated)
              </Label>
            </div>
            <Input
              id="known-allergies"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="e.g. Penicillin, Sulfa drugs, Aspirin"
              className="h-10 border-danger-fill/30 bg-danger-bg/20 text-[14px] text-danger-text placeholder:text-danger-text/60"
            />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter className="pt-3 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save profile & check in
        </Button>
      </DialogFooter>
    </form>
  );
}

function ReturningSearch({
  query,
  onQueryChange,
  onDone,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onDone: () => void;
}) {
  const { patients: clinicPatients, checkInVisit } = useClinic();
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id ?? "");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clinicPatients.slice(0, 6);
    return clinicPatients.filter((patient) => {
      const phone = patient.phone.replace(/\s/g, "");
      return (
        patient.name.toLowerCase().includes(q) ||
        patient.patientId.toLowerCase().includes(q) ||
        phone.includes(q.replace(/\s/g, ""))
      );
    });
  }, [query, clinicPatients]);

  function handleSelect(patient: Patient) {
    checkInVisit(patient.id, selectedDoctorId, "Follow-up consultation");
    const doc = getStaff(selectedDoctorId);

    toast.success("Patient checked in", {
      description: `${patient.name} is now in queue for ${doc?.name ?? "the doctor"}.`,
    });

    onDone();
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search patient by name, phone, or ID…"
            className="pl-9 h-10 text-[14px] bg-surface-1/60"
          />
        </div>

        <div className="w-48">
          <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
            <SelectTrigger className="h-10 text-[13px] bg-surface-1/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} {d.room ? `(${d.room})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {matches.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-fg-muted">
            No matching patient records found. Use &ldquo;New walk-in patient&rdquo; if first visit.
          </div>
        ) : (
          <div className="space-y-2 pr-2">
            {matches.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => handleSelect(patient)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-1/60 p-3 text-left hover:border-border-strong hover:bg-surface-1 transition-all"
              >
                <div>
                  <p className="text-[14px] font-semibold text-foreground">
                    {patient.name}
                  </p>
                  <p className="font-mono text-[12px] text-fg-muted mt-0.5">
                    {patient.patientId} · {ageFromDob(patient.dateOfBirth)} yrs ·{" "}
                    {patient.gender === "F" ? "Female" : "Male"}
                    {patient.allergies?.length > 0 && (
                      <span className="ml-2 font-medium text-danger-text">
                        · Allergies: {patient.allergies.join(", ")}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[13px] font-medium text-fg-secondary">
                    {patient.phone}
                  </span>
                  <span className="block text-[11px] text-clinical-text font-medium mt-0.5">
                    Click to check in →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function AppointmentList({ onDone }: { onDone: () => void }) {
  const { patients: clinicPatients, checkInVisit } = useClinic();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2.5 pr-2">
        {todayAppointments.map((slot) => {
          const patient = clinicPatients.find((item) => item.id === slot.patientId);
          const doctor = getStaff(slot.doctorId);
          if (!patient) return null;

          return (
            <div
              key={`${slot.patientId}-${slot.time}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-1/60 p-3.5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold text-foreground">{patient.name}</p>
                  <span className="rounded bg-clinical-bg px-2 py-0.5 font-mono text-[11px] font-medium text-clinical-text border border-clinical-fill/20">
                    {slot.time}
                  </span>
                </div>
                <p className="text-[13px] text-fg-secondary mt-0.5">
                  Scheduled with {doctor?.name} ({doctor?.room}) · ID: {patient.patientId}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  checkInVisit(patient.id, slot.doctorId, `Scheduled at ${slot.time}`);
                  toast.success("Appointment checked in", {
                    description: `${patient.name} has been moved to today's queue.`,
                  });
                  onDone();
                }}
              >
                Check in
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function CourseCheckIn({
  query,
  onQueryChange,
  onDone,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onDone: () => void;
}) {
  const { courses, doses, patients, checkInDose } = useClinic();

  const dueRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((course) => course.status === "active")
      .map((course) => {
        const patient = patients.find((item) => item.id === course.patientId);
        const due = nextOpenDose(dosesForCourse(doses, course.id));
        return { course, patient, due };
      })
      .filter((row) => row.patient && row.due && row.due.status !== "given")
      .filter((row) => {
        if (!q) return true;
        return (
          row.patient?.name.toLowerCase().includes(q) ||
          row.patient?.patientId.toLowerCase().includes(q) ||
          row.course.procedureName.toLowerCase().includes(q)
        );
      });
  }, [courses, doses, patients, query]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Find a course by patient or vaccine…"
            className="pl-9 h-10 text-[14px] bg-surface-1/60"
          />
        </div>
        <StartCourseDialog
          trigger={
            <Button type="button" variant="outline" size="sm" className="gap-1">
              <Syringe className="size-3.5" />
              New course
            </Button>
          }
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {dueRows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-fg-muted">
            No open injection courses match. Start a new multi-day course instead of a GP visit.
          </div>
        ) : (
          <div className="space-y-2 pr-2">
            {dueRows.map(({ course, patient, due }) => {
              if (!patient || !due) return null;
              return (
                <div
                  key={course.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-1/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{patient.name}</p>
                    <p className="text-[12px] text-fg-secondary">
                      {course.procedureName} · Day {due.dayNumber} of {course.totalDoses}
                      {due.status === "checked-in" ? " · already checked in" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={due.status === "checked-in"}
                    onClick={() => {
                      try {
                        checkInDose(due.id);
                        toast.success("Checked in for today’s dose", {
                          description: `${patient.name} is on the injection register, not the GP queue.`,
                        });
                        onDone();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not check in.",
                        );
                      }
                    }}
                  >
                    Check in
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
