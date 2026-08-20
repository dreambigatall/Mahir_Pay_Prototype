"use client";

import { PageHeader } from "@/components/clinic/page-header";
import { QueueBoard } from "@/components/clinic/queue-board";
import { useClinic } from "@/lib/clinic-store";
import { visitsForDoctor } from "@/lib/mock-data";
import { useSession } from "@/lib/session";

export default function DoctorQueuePage() {
  const { user } = useSession();
  const { visits } = useClinic();
  const mine = user ? visitsForDoctor(user.id, visits) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="My queue"
        description={user ? `${user.name} · ${user.room ?? "Clinic"}` : "Doctor workspace"}
      />
      <QueueBoard
        visits={mine.filter((visit) => visit.kind !== "procedure")}
        hrefFor={(visit) => `/doctor/visits/${visit.id}`}
      />
    </div>
  );
}
