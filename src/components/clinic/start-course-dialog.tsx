"use client";

import { useMemo, useState } from "react";
import { Syringe } from "lucide-react";
import { toast } from "sonner";
import { HeightTransition } from "@/components/ui/height-transition";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { useClinic } from "@/lib/clinic-store";
import { CLINIC_TODAY, formatMoney } from "@/lib/format";
import type { CourseBillingMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StartCourseDialog({
  patientId,
  trigger,
}: {
  patientId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-1.5 shadow-sm">
            <Syringe className="size-4" />
            Start course
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[min(680px,92vh)] w-full sm:max-w-[640px] flex-col gap-4 overflow-hidden p-6">
        <DialogHeader>
          <DialogTitle>Start injection / vaccination course</DialogTitle>
          <DialogDescription>
            Opens a digital register: patient name, vaccine or injection, and a tick for each day they come.
          </DialogDescription>
        </DialogHeader>
        <StartCourseForm 
          patientId={patientId} 
          onCancel={() => setOpen(false)} 
          onDone={() => setOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  );
}

export function StartCourseForm({
  patientId,
  onCancel,
  onDone,
}: {
  patientId?: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { patients, procedures, startCourse } = useClinic();
  const [selectedPatientId, setSelectedPatientId] = useState(patientId ?? "");
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"F" | "M">("F");
  const [phone, setPhone] = useState("");
  const [catalogItemId, setCatalogItemId] = useState(procedures[0]?.id ?? "");
  const [totalDoses, setTotalDoses] = useState("7");
  const [startDate, setStartDate] = useState(CLINIC_TODAY);
  const [billingMode, setBillingMode] = useState<CourseBillingMode>("package");
  const [notes, setNotes] = useState("");
  const [checkInToday, setCheckInToday] = useState(true);
  const [query, setQuery] = useState("");

  const selectedProcedure = procedures.find((item) => item.id === catalogItemId);
  const days = Math.max(1, Number(totalDoses) || 1);
  const packageTotal = (selectedProcedure?.price ?? 0) * days;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) ||
        patient.patientId.toLowerCase().includes(q) ||
        patient.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
    );
  }, [patients, query]);

  function reset() {
    setSelectedPatientId(patientId ?? "");
    setIsNewPatient(false);
    setName("");
    setDob("");
    setGender("F");
    setPhone("");
    setCatalogItemId(procedures[0]?.id ?? "");
    setTotalDoses("7");
    setStartDate(CLINIC_TODAY);
    setBillingMode("package");
    setNotes("");
    setCheckInToday(true);
    setQuery("");
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col justify-between"
      onSubmit={(event) => {
        event.preventDefault();
        if (!catalogItemId) {
          toast.error("Add a procedure to the catalog first.");
          return;
        }
        if (!patientId && !isNewPatient && !selectedPatientId) {
          toast.error("Select an existing patient or register a new one.");
          return;
        }
        if (isNewPatient && (!name.trim() || !dob || !phone.trim())) {
          toast.error("Enter name, date of birth, and phone for the new patient.");
          return;
        }

        try {
          const result = startCourse({
            patientId: patientId || (!isNewPatient ? selectedPatientId : undefined),
            newPatient: isNewPatient
              ? { name, dob, gender, phone }
              : undefined,
            catalogItemId,
            totalDoses: days,
            startDate,
            billingMode,
            notes,
            checkInToday,
          });

          toast.success("Course opened", {
            description: `${result.patient.name} · ${result.course.procedureName} · ${result.course.totalDoses} days.`,
          });
          reset();
          onDone();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not start course.");
        }
      }}
    >
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="grid gap-4 pb-2">
          {!patientId ? (
            <HeightTransition>
              <div className="grid gap-2 relative">
                <div className="pb-2">
                  <Label className="text-[13px] font-medium">Patient *</Label>
                </div>

                {isNewPatient ? (
                  <div className="grid gap-3 pt-1">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Full name"
                      required
                      className="h-10"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <DatePicker
                        value={dob}
                        onChange={setDob}
                        required
                        allowPastYears
                        className="h-10"
                      />
                      <Select
                        value={gender}
                        onValueChange={(value) => setGender(value as "F" | "M")}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="F">Female</SelectItem>
                          <SelectItem value="M">Male</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Phone"
                      required
                      className="h-10 font-mono"
                    />
                  </div>
                ) : (
                  <div className="grid gap-2 pt-1">
                    <div className="relative">
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search name, phone, or ID…"
                        className="h-10"
                      />
                      
                      {matches.length > 0 && (
                        <div className="absolute top-full left-0 z-50 mt-1 w-full max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
                          {matches.map((patient) => (
                            <button
                              key={patient.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatientId(patient.id);
                                setQuery(patient.name); // Optional: fill input with selected name
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px]",
                                selectedPatientId === patient.id
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent/50",
                              )}
                            >
                              <span className="font-medium">{patient.name}</span>
                              <span className="font-mono text-[11px] text-fg-muted">
                                {patient.patientId}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </HeightTransition>
          ) : null}

          <div className="grid gap-1.5">
            <Label className="text-[13px] font-medium">Vaccine / injection *</Label>
            <Select value={catalogItemId} onValueChange={setCatalogItemId}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select procedure" />
              </SelectTrigger>
              <SelectContent>
                {procedures.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {formatMoney(item.price)} / day
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[13px] font-medium">Number of days *</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={totalDoses}
                onChange={(event) => setTotalDoses(event.target.value)}
                className="h-10 font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[13px] font-medium">Start date *</Label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className="h-10"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[13px] font-medium">How they pay *</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    id: "package" as const,
                    label: "Pay full course",
                    hint: selectedProcedure
                      ? `${days} days · ${formatMoney(packageTotal)}`
                      : "Charged on day 1",
                  },
                  {
                    id: "per-dose" as const,
                    label: "Pay each day",
                    hint: selectedProcedure
                      ? `${formatMoney(selectedProcedure.price)} per attendance`
                      : "One dose fee",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBillingMode(option.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left",
                    billingMode === option.id
                      ? "border-foreground/40 bg-surface-1 shadow-sm"
                      : "border-border bg-surface-2 text-fg-secondary",
                  )}
                >
                  <p className="text-[13px] font-medium text-foreground">{option.label}</p>
                  <p className="mt-0.5 text-[11px] text-fg-muted">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[13px] font-medium">Register note</Label>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Post-exposure, left deltoid"
              className="h-10"
            />
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={checkInToday}
              onChange={(event) => setCheckInToday(event.target.checked)}
              className="size-4 accent-foreground"
            />
            Check in for today’s dose now
          </label>
        </div>
      </ScrollArea>

      <DialogFooter className="flex w-full items-center pt-3">
        {!patientId && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsNewPatient(!isNewPatient)}
            className="text-[13px] mr-auto px-4 shadow-sm"
          >
            {isNewPatient ? "Search existing chart instead" : "Register new patient instead"}
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Open register</Button>
        </div>
      </DialogFooter>
    </form>
  );
}
