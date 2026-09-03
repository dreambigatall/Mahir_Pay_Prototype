"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";

export function PrescribeMedicineDialog({
  visitId,
  doctorId,
}: {
  visitId: string;
  doctorId: string;
}) {
  const { drugs, prescribeMedications } = useClinic();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const activeDrugs = drugs.filter((test) => test.active);

  function reset() {
    setSelected({});
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
        <Button variant="outline" size="sm" className="gap-1.5 text-[12px] h-8">
          <Pill className="size-3.5" />
          Prescribe medicine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prescribe Medication</DialogTitle>
          <DialogDescription>
            Select medicines from the clinic catalog and add instructions. They will be sent to the pharmacy via reception.
          </DialogDescription>
        </DialogHeader>
        {activeDrugs.length === 0 ? (
          <p className="text-[13px] text-fg-secondary">
            No active drugs found in the catalog.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-border p-3">
              {activeDrugs.map((drug) => {
                const isSelected = selected[drug.id] !== undefined;
                return (
                  <div key={drug.id} className="grid gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                    <label className="flex items-center gap-2 rounded-md px-1 py-1 text-[14px]">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) => {
                          setSelected((current) => {
                            if (value) {
                              return { ...current, [drug.id]: "" };
                            } else {
                              const next = { ...current };
                              delete next[drug.id];
                              return next;
                            }
                          });
                        }}
                      />
                      <span className="flex-1">{drug.name}</span>
                      <span className="tabular-nums text-[12px] text-fg-muted">
                        {formatMoney(drug.price)}
                      </span>
                    </label>
                    {isSelected ? (
                      <div className="pl-6 pr-2">
                        <Input
                          placeholder="Instructions (e.g. 1 tablet 3 times a day for 5 days)"
                          value={selected[drug.id]}
                          onChange={(e) =>
                            setSelected((current) => ({
                              ...current,
                              [drug.id]: e.target.value,
                            }))
                          }
                          className="h-8 text-[13px]"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={Object.keys(selected).length === 0}
            onClick={() => {
              const prescriptions = Object.entries(selected).map(([id, instructions]) => ({
                catalogItemId: id,
                instructions,
              }));
              prescribeMedications({
                visitId,
                doctorId,
                prescriptions,
              });
              toast.success("Prescriptions created", {
                description: "Reception must approve payment before pharmacy dispensation.",
              });
              setOpen(false);
              reset();
            }}
          >
            Prescribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
