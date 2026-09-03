import { LivePharmacyBoard } from "@/components/clinic/live-pharmacy-board";
import { PageHeader } from "@/components/layout/page-header";

export default function PharmacyPage() {
  return <div className="space-y-6"><PageHeader title="Pharmacy" description="Paid prescriptions ready for safe, stock-aware dispensing." /><LivePharmacyBoard /></div>;
}
