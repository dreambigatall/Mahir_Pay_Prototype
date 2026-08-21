"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Printer } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

export function TreatmentPlanDialog({ patientName }: { patientName: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-[12px] h-8">
          <ClipboardList className="size-3.5" />
          Treatment plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Treatment Plan</DialogTitle>
          <DialogDescription>
            Provide non-medication instructions, dietary advice, or general care plan for {patientName}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Write the treatment plan here..."
            className="min-h-[300px] text-[14px]"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          />
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="default"
              className="gap-2"
              onClick={() => {
                // In a real app, this might generate a PDF or open a print-specific route
                // Here we just trigger browser print. A print stylesheet would handle formatting.
                toast.success("Preparing to print plan...");
                setTimeout(() => window.print(), 500);
              }}
            >
              <Printer className="size-4" />
              Print Plan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
