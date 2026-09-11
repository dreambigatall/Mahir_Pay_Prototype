import { LivePharmacyBoard } from "@/components/clinic/live-pharmacy-board";
import { PageHeader } from "@/components/clinic/page-header";

export default function PharmacyPage() {
  return <div className="space-y-6"><PageHeader title="Pharmacy" description="See unpaid prescriptions as a preview. Dispense unlocks after reception collects full payment." /><LivePharmacyBoard /></div>;
}
