"use client";

import { LiveQueueBoard } from "@/components/clinic/live-queue-board";
import { LiveRegisterPatientDialog } from "@/components/clinic/live-register-patient-dialog";
import { PageHeader } from "@/components/clinic/page-header";

export default function ReceptionistQueuePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Today’s queue"
        description="Where every patient is right now. Urgent and longest-waiting patients are at the top of each column."
        action={<LiveRegisterPatientDialog />}
      />
      <LiveQueueBoard />
    </div>
  );
}
