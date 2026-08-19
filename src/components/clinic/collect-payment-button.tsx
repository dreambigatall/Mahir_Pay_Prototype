"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CollectPaymentButton() {
  return (
    <Button
      onClick={() =>
        toast.success("Payment recorded", {
          description: "Visit would close after this in the live system.",
        })
      }
    >
      Collect payment
    </Button>
  );
}
