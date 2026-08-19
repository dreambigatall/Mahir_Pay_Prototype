"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClinic } from "@/lib/clinic-store";

export function AddLabTestDialog() {
  const { addLabTest } = useClinic();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add lab test</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add lab test</DialogTitle>
          <DialogDescription>
            This test appears on the doctor’s order form and carries a price for billing.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(price);
            if (!name.trim() || Number.isNaN(amount) || amount < 0) return;
            addLabTest({ name, price: amount });
            toast.success("Lab test added", {
              description: "Doctors can select it the next time they order labs.",
            });
            setName("");
            setPrice("");
            setOpen(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="lab-test-name" className="font-normal">
              Test name
            </Label>
            <Input
              id="lab-test-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Thyroid function test"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lab-test-price" className="font-normal">
              Price (GHS)
            </Label>
            <Input
              id="lab-test-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="tabular-nums"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save test</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
