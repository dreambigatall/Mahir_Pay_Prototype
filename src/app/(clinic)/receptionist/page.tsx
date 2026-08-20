"use client";

import { PageHeader } from "@/components/clinic/page-header";
import { QueueBoard } from "@/components/clinic/queue-board";
import { RegisterPatientDialog } from "@/components/clinic/register-patient-dialog";
import { useClinic } from "@/lib/clinic-store";
import { todaysVisits } from "@/lib/mock-data";

export default function ReceptionistQueuePage() {
  const { visits } = useClinic();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Today’s queue"
        description="Walk-ins and scheduled patients across all doctors."
        action={<RegisterPatientDialog />}
      />
      <QueueBoard
        visits={todaysVisits(visits)}
        hrefFor={(visit) =>
          visit.kind === "procedure" && visit.courseId
            ? `/receptionist/courses/${visit.courseId}`
            : visit.status === "ready-for-billing" || visit.status === "billed"
            ? `/receptionist/billing/${visit.id}`
            : `/receptionist/visits/${visit.id}`
        }
      />
    </div>
  );
}
