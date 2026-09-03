"use client";

import { LiveDoctorKanban } from "@/components/clinic/live-doctor-kanban";
import { PageHeader } from "@/components/clinic/page-header";
import { useSession } from "@/lib/session";

export default function DoctorQueuePage() {
  const { user } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        title="My queue"
        description={user ? `${user.name} · ${user.room ?? "Clinic"}` : "Doctor workspace"}
      />
      <LiveDoctorKanban />
    </div>
  );
}
