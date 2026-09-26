import { LiveLabBoard } from "@/components/clinic/live-lab-board";
import { PageHeader } from "@/components/clinic/page-header";

export default function LabBoardPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Lab board"
        description="Urgent requests first. Open a card to enter and verify results."
      />
      <LiveLabBoard />
    </div>
  );
}
