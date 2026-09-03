import { LiveBatchInventory } from "@/components/clinic/live-batch-inventory";
import { LiveInventoryWorkspace } from "@/components/clinic/live-inventory-workspace";
import { PageHeader } from "@/components/layout/page-header";

export default function InventoryPage(){return <div className="space-y-6"><PageHeader title="Medication inventory" description="Monitor stock, receive deliveries, record corrections, and review the movement ledger." /><LiveInventoryWorkspace /><LiveBatchInventory /></div>}


