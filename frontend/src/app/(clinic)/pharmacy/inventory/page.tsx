import { LiveInventoryWorkspace } from "@/components/clinic/live-inventory-workspace";
import { PageHeader } from "@/components/clinic/page-header";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Medication inventory" />
      <LiveInventoryWorkspace showAdd={false} />
    </div>
  );
}
