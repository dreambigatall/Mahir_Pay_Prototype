import { LiveBillingBoard } from "@/components/clinic/live-billing-board";
import { PageHeader } from "@/components/clinic/page-header";

export default function BillingListPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & cashier"
        description="Patient invoicing, clinical charge reconciliations, and payment collection."
      />
      <LiveBillingBoard />
    </div>
  );
}
