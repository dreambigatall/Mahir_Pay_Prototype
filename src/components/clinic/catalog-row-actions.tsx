"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EditCatalogItemDialog } from "@/components/clinic/edit-catalog-item-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClinic } from "@/lib/clinic-store";
import type { CatalogItem } from "@/lib/types";

export function CatalogRowActions({ item }: { item: CatalogItem }) {
  const { updateCatalogItem, deleteCatalogItem } = useClinic();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-fg-muted hover:text-foreground"
            aria-label={`Actions for ${item.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-3.5" />
            Edit price & details
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              const nextActive = !item.active;
              updateCatalogItem(item.id, { active: nextActive });
              toast.success(
                nextActive ? `"${item.name}" activated` : `"${item.name}" deactivated`,
                {
                  description: nextActive
                    ? "Doctors and reception can now select this item."
                    : "This item is hidden from active order forms.",
                },
              );
            }}
          >
            <Power className="mr-2 size-3.5" />
            {item.active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-3.5" />
            Delete item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <EditCatalogItemDialog
        item={item}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete catalog item?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-medium text-foreground">"{item.name}"</span> from the clinic service catalog? This action will remove it from future ordering.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                deleteCatalogItem(item.id);
                toast.success("Item removed from catalog", {
                  description: `"${item.name}" has been deleted.`,
                });
                setDeleteOpen(false);
              }}
            >
              Delete item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
