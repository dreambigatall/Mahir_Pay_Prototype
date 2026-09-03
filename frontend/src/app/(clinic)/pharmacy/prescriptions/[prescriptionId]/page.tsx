import { LiveDispensingWorkspace } from "@/components/clinic/live-dispensing-workspace";
import { PageHeader } from "@/components/layout/page-header";

export default async function DispensingPage({ params }: { params: Promise<{ prescriptionId: string }> }) {
  const { prescriptionId } = await params;
  return <div className="space-y-6"><PageHeader title="Dispense prescription" description="Verify medication, stock, and quantity before supply." /><LiveDispensingWorkspace prescriptionId={prescriptionId} /></div>;
}
