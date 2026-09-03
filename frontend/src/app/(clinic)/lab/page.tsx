import { LiveLabBoard } from "@/components/clinic/live-lab-board";
import { PageHeader } from "@/components/clinic/page-header";

export default function LabBoardPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Lab board"
        description="One card per requisition. Open a patient to enter results, save each test, and verify before returning them to the doctor."
      />
      <LiveLabBoard />
    </div>
  );
}
