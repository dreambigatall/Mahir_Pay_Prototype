"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { StartCourseDialog } from "@/components/clinic/start-course-dialog";
import { OrderLabDialog } from "@/components/clinic/order-lab-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClinic } from "@/lib/clinic-store";

export function DoctorVisitActions({
  visitId,
  doctorId,
  patientId,
  patientName,
}: {
  visitId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
}) {
  const router = useRouter();
  const { labRequests, completeDoctorConsultation } = useClinic();
  const [completeOpen, setCompleteOpen] = useState(false);

  const pendingLabs = labRequests.filter(
    (req) => req.visitId === visitId && req.status !== "result-ready",
  );

  function handleComplete() {
    completeDoctorConsultation(visitId);
    toast.success("Consultation completed", {
      description:
        pendingLabs.length > 0
          ? `${patientName} is now awaiting diagnostic lab results.`
          : `${patientName} is now ready for billing at reception.`,
    });
    setCompleteOpen(false);
    router.push("/doctor");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <OrderLabDialog visitId={visitId} doctorId={doctorId} />
        <StartCourseDialog
          patientId={patientId}
          trigger={
            <Button variant="outline" className="gap-1.5">
              Start injection course
            </Button>
          }
        />

        <Button
          onClick={() => setCompleteOpen(true)}
          className="gap-1.5 shadow-sm"
        >
          <CheckCircle2 className="size-4" />
          Complete visit
        </Button>
      </div>

      {/* Complete Consultation Confirmation Modal */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-[520px] p-6">
          <DialogHeader>
            <DialogTitle>Complete clinical consultation?</DialogTitle>
            <DialogDescription>
              Conclude the active examination session for <span className="font-semibold text-foreground">{patientName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {pendingLabs.length > 0 ? (
              <div className="rounded-xl border border-warning-fill/30 bg-warning-bg/40 p-4 text-[13px] text-foreground space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-warning-text">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{pendingLabs.length} pending laboratory {pendingLabs.length === 1 ? "test" : "tests"}</span>
                </div>
                <p className="text-[12px] text-fg-secondary">
                  Completing consultation now will route {patientName} to the laboratory stage. Once test results are verified, the visit will advance to reception cashier.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface-1/60 p-4 text-[13px] text-foreground space-y-1">
                <p className="font-medium">Ready for Reception Billing</p>
                <p className="text-[12px] text-fg-secondary">
                  Consultation charges and all recorded medication prescriptions will be automatically compiled into an invoice for reception.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCompleteOpen(false)}
            >
              Back to consultation
            </Button>
            <Button type="button" onClick={handleComplete}>
              Confirm & complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
