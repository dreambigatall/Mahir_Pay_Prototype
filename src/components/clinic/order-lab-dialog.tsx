"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";
import type { LabUrgency } from "@/lib/types";

export function OrderLabDialog({
  visitId,
  doctorId,
}: {
  visitId: string;
  doctorId: string;
}) {
  const { labTests, labRequests, orderLabs } = useClinic();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<LabUrgency>("routine");
  const [notes, setNotes] = useState("");

  const activeTests = labTests.filter((test) => test.active);
  const pendingIds = useMemo(
    () =>
      new Set(
        labRequests
          .filter(
            (request) =>
              request.visitId === visitId && request.status !== "result-ready",
          )
          .map((request) => request.catalogItemId),
      ),
    [labRequests, visitId],
  );

  function reset() {
    setSelected([]);
    setUrgency("routine");
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
        <Button variant="outline">Order lab test</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order lab tests</DialogTitle>
          <DialogDescription>
            Choose from the clinic lab catalog. Admin maintains this list — doctors cannot type a custom test.
          </DialogDescription>
        </DialogHeader>
        {activeTests.length === 0 ? (
          <p className="text-[13px] text-fg-secondary">
            No active lab tests yet. Ask admin to add tests in the catalog.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-border p-3">
              {activeTests.map((test) => {
                const already = pendingIds.has(test.id);
                const checked = already || selected.includes(test.id);
                return (
                  <label
                    key={test.id}
                    className="flex items-center gap-2 rounded-md px-1 py-1 text-[14px]"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={already}
                      onCheckedChange={(value) => {
                        setSelected((current) =>
                          value === true
                            ? [...current, test.id]
                            : current.filter((id) => id !== test.id),
                        );
                      }}
                    />
                    <span className="flex-1">
                      {test.name}
                      {already ? (
                        <span className="ml-2 text-[12px] text-fg-muted">
                          already requested
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-[12px] text-fg-muted">
                      {formatMoney(test.price)}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="grid gap-2">
              <p className="text-[14px]">Urgency</p>
              <RadioGroup
                value={urgency}
                onValueChange={(value) => setUrgency(value as LabUrgency)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="routine" id="lab-routine" />
                  <Label htmlFor="lab-routine" className="font-normal">
                    Routine
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="urgent" id="lab-urgent" />
                  <Label htmlFor="lab-urgent" className="font-normal">
                    Urgent
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lab-notes" className="font-normal">
                Clinical notes
              </Label>
              <Textarea
                id="lab-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Reason for the tests…"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              const created = orderLabs({
                visitId,
                doctorId,
                catalogItemIds: selected,
                urgency,
                clinicalNotes: notes,
              });
              toast.success(
                created.length === 1
                  ? "Lab request sent"
                  : `${created.length} lab requests sent`,
                { description: "The laboratory board is updated." },
              );
              setOpen(false);
              reset();
            }}
          >
            Send to lab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
