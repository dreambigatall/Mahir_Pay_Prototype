"use client";

import { toast } from "sonner";

import { OrderLabDialog } from "@/components/clinic/order-lab-dialog";
import { Button } from "@/components/ui/button";

export function DoctorVisitActions({
  visitId,
  doctorId,
}: {
  visitId: string;
  doctorId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <OrderLabDialog visitId={visitId} doctorId={doctorId} />
      <Button
        onClick={() =>
          toast.success("Visit complete", {
            description: "Reception would now see this visit as ready for billing.",
          })
        }
      >
        Complete visit
      </Button>
    </div>
  );
}
