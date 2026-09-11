"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { AddCatalogItemDialog } from "@/components/clinic/add-catalog-item-dialog";
import { AddSupplyDialog } from "@/components/clinic/add-supply-dialog";
import { LiveInventoryWorkspace } from "@/components/clinic/live-inventory-workspace";
import { LiveSupplyInventory } from "@/components/clinic/live-supply-inventory";
import { PageHeader } from "@/components/clinic/page-header";
import { SupplyUsageQueue } from "@/components/clinic/supply-usage-queue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <AdminInventoryBody />
    </Suspense>
  );
}

function AdminInventoryBody() {
  const searchParams = useSearchParams();
  const initialTab = useMemo(
    () => (searchParams.get("tab") === "supplies" ? "supplies" : "medications"),
    [searchParams],
  );
  const [tab, setTab] = useState(initialTab);
  const [medicationRefreshKey, setMedicationRefreshKey] = useState(0);
  const [supplyRefreshKey, setSupplyRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Medications deduct when the invoice is fully paid. Clinic supplies deduct after you approve lab usage."
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList
            variant="line"
            className="h-auto w-full justify-start sm:w-fit"
          >
            <TabsTrigger value="medications" className="px-3 py-2">
              Medications
            </TabsTrigger>
            <TabsTrigger value="supplies" className="px-3 py-2">
              Clinic supplies
            </TabsTrigger>
          </TabsList>

          {tab === "medications" ? (
            <AddCatalogItemDialog
              defaultType="drug"
              onSaved={() =>
                setMedicationRefreshKey((value) => value + 1)
              }
              trigger={
                <Button className="min-h-11 gap-2 px-4">
                  <Plus className="size-4" aria-hidden="true" />
                  Add item
                </Button>
              }
            />
          ) : (
            <AddSupplyDialog
              onSaved={() => setSupplyRefreshKey((value) => value + 1)}
            />
          )}
        </div>

        <TabsContent value="medications">
          <LiveInventoryWorkspace
            key={medicationRefreshKey}
            showAdd={false}
          />
        </TabsContent>

        <TabsContent value="supplies" className="space-y-6">
          <SupplyUsageQueue
            onChanged={() => setSupplyRefreshKey((value) => value + 1)}
          />
          <LiveSupplyInventory key={supplyRefreshKey} hideAdd />
        </TabsContent>
      </Tabs>
    </div>
  );
}
