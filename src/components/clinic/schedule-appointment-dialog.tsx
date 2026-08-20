"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";

export function ScheduleAppointmentDialog({
  patientId,
  doctorId,
}: {
  patientId: string;
  doctorId: string;
}) {
  const { scheduleAppointment } = useClinic();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  function reset() {
    setDate("");
    setReason("");
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
        <Button variant="outline">Schedule follow-up</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
          <DialogDescription>
            Set a date for the patient to return. Reception will see this and remind them.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="apt-date" className="font-normal">
              Date & Time
            </Label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-fg-muted" />
              <Input
                id="apt-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="apt-reason" className="font-normal">
              Reason for visit
            </Label>
            <Textarea
              id="apt-reason"
              placeholder="e.g. Check blood pressure progress"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!date || !reason.trim()}
            onClick={() => {
              scheduleAppointment({
                patientId,
                doctorId,
                date,
                reason: reason.trim(),
              });
              toast.success("Appointment scheduled");
              setOpen(false);
              reset();
            }}
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
