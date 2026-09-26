import { LivePharmacyBoard } from "@/components/clinic/live-pharmacy-board";
import { PageHeader } from "@/components/clinic/page-header";

export default function PharmacyPage() {
  return <div className="space-y-6"><PageHeader title="Pharmacy" description="Paid prescriptions are ready to dispense. Unpaid ones unlock after payment." /><LivePharmacyBoard /></div>;
}
