"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";

export function ReferPatientDialog({
  visitId,
  patientId,
  doctorId,
}: {
  visitId: string;
  patientId: string;
  doctorId: string;
}) {
  const { referPatient } = useClinic();
  const [open, setOpen] = useState(false);
  const [referType, setReferType] = useState<"internal" | "branch">("internal");
  const [target, setTarget] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setReferType("internal");
    setTarget("");
    setDiagnosis("");
    setNotes("");
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
        <Button variant="outline">Refer patient</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refer Patient</DialogTitle>
          <DialogDescription>
            Refer the patient to another department internally or to another branch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <RadioGroup
            value={referType}
            onValueChange={(value) => setReferType(value as "internal" | "branch")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="internal" id="ref-internal" />
              <Label htmlFor="ref-internal" className="font-normal">
                Internal Department
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="branch" id="ref-branch" />
              <Label htmlFor="ref-branch" className="font-normal">
                Other Branch
              </Label>
            </div>
          </RadioGroup>

          <div className="grid gap-1.5">
            <Label htmlFor="ref-target" className="font-normal">
              {referType === "internal" ? "Department Name" : "Branch Location"}
            </Label>
            <Input
              id="ref-target"
              placeholder={referType === "internal" ? "e.g. Cardiology" : "e.g. Kumasi Branch"}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ref-diagnosis" className="font-normal">
              Diagnosis
            </Label>
            <Input
              id="ref-diagnosis"
              placeholder="Current diagnosis to share..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ref-notes" className="font-normal">
              Referral Notes
            </Label>
            <Textarea
              id="ref-notes"
              placeholder="Reason for referral and any relevant history..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!target.trim() || !diagnosis.trim()}
            onClick={() => {
              referPatient({
                visitId,
                patientId,
                fromDoctorId: doctorId,
                toDepartment: referType === "internal" ? target.trim() : undefined,
                toBranch: referType === "branch" ? target.trim() : undefined,
                diagnosis: diagnosis.trim(),
                notes: notes.trim(),
              });
              toast.success("Patient referred successfully");
              setOpen(false);
              reset();
            }}
          >
            Create Referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
