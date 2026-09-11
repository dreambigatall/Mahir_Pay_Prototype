"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, Loader2, MoreHorizontal, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

import { EditCatalogItemDialog } from "@/components/clinic/edit-catalog-item-dialog";
import { EditLabPanelDialog } from "@/components/clinic/edit-lab-panel-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api/client";
import { updateCatalogItem, type CatalogItem, type LabPanel } from "@/lib/api/catalog";
import { announceCoreDataChanged } from "@/lib/core-events";

export function CatalogRowActions({
  item,
  panel,
  onChanged,
}: {
  item: CatalogItem;
  panel?: LabPanel;
  onChanged?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function toggleActive() {
    const nextActive = !item.active;
    setToggling(true);
    try {
      await updateCatalogItem(item.id, { active: nextActive });
      announceCoreDataChanged();
      onChanged?.();
      toast.success(nextActive ? `"${item.name}" activated` : `"${item.name}" deactivated`, {
        description: nextActive
          ? "Doctors and reception can now select this item."
          : "This item is hidden from active order forms.",
      });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The catalog item could not be updated.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-fg-muted hover:text-foreground"
            aria-label={`Actions for ${item.name}`}
            disabled={toggling}
          >
            {toggling ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-3.5" />
            {item.item_type === "lab_panel" ? "Edit panel tests" : "Edit price & details"}
          </DropdownMenuItem>

          {item.item_type === "drug" && item.track_inventory ? (
            <DropdownMenuItem asChild>
              <Link href="/admin/inventory">
                <Boxes className="mr-2 size-3.5" />
                Manage inventory
              </Link>
            </DropdownMenuItem>
          ) : null}

          {item.item_type === "supply" ? (
            <DropdownMenuItem asChild>
              <Link href="/admin/inventory?tab=supplies">
                <Boxes className="mr-2 size-3.5" />
                Manage supplies
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem onClick={() => void toggleActive()} disabled={toggling}>
            <Power className="mr-2 size-3.5" />
            {item.active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {item.item_type === "lab_panel" && panel ? (
        <EditLabPanelDialog panel={panel} open={editOpen} onOpenChange={setEditOpen} onSaved={onChanged} />
      ) : (
        <EditCatalogItemDialog item={item} open={editOpen} onOpenChange={setEditOpen} onSaved={onChanged} />
      )}
    </>
  );
}
