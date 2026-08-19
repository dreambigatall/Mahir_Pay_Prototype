"use client";

import { PageHeader } from "@/components/clinic/page-header";
import { LabBoard } from "@/components/clinic/lab-board";
import { useClinic } from "@/lib/clinic-store";

export default function LabBoardPage() {
  const { labRequests } = useClinic();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lab board"
        description="One card per patient. Open the patient to enter every test result."
      />
      <LabBoard requests={labRequests} />
    </div>
  );
}
