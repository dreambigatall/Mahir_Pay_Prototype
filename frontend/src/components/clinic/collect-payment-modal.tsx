"use client";

import { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Printer,
  Receipt,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney, invoiceTotal } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";

const paymentMethods = [
  {
    id: "cash",
    label: "Cash",
    icon: Banknote,
    description: "Physical cash collected at cashier counter",
  },
  {
    id: "momo",
    label: "Mobile Money",
    icon: Smartphone,
    description: "MTN MoMo, Telecel Cash, AT Money",
  },
  {
    id: "card",
    label: "POS / Card",
    icon: CreditCard,
    description: "Debit / Credit card swipe or contactless",
  },
  {
    id: "insurance",
    label: "Insurance",
    icon: ShieldCheck,
    description: "Private health insurance / Corporate credit",
  },
];

export function CollectPaymentModal({
  invoice,
  patientName,
  trigger,
}: {
  invoice: Invoice;
  patientName: string;
  trigger?: React.ReactNode;
}) {
  const { collectPayment } = useClinic();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("cash");
  const [paidSuccess, setPaidSuccess] = useState(false);

  const total = invoiceTotal(invoice.lineItems, invoice.discount);

  function handleCollect() {
    collectPayment(invoice.visitId, method);
    const selectedMethod = paymentMethods.find((m) => m.id === method)?.label ?? "Cash";

    toast.success("Payment confirmed & receipt issued", {
      description: `Collected ${formatMoney(total)} via ${selectedMethod} for ${patientName}.`,
    });

    setPaidSuccess(true);
  }

  function handleClose() {
    setOpen(false);
    setPaidSuccess(false);
    setMethod("cash");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-1.5 shadow-sm">
            <Receipt className="size-4" />
            Collect payment
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[580px] p-6">
        {!paidSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle>Process invoice payment</DialogTitle>
              <DialogDescription>
                Reconcile itemized clinical charges and record payment method for {patientName}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              {/* Itemized Line Items Breakdown */}
              <div className="rounded-xl border border-border bg-surface-1/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <p className="text-[12px] font-semibold text-fg-secondary uppercase tracking-wider">
                    Itemized clinical services ({invoice.lineItems.length})
                  </p>
                  <p className="font-mono text-[12px] text-fg-muted">
                    {invoice.id}
                  </p>
                </div>

                <div className="space-y-2 text-[14px]">
                  {invoice.lineItems.map((item, idx) => (
                    <div
                      key={`${item.name}-${idx}`}
                      className="flex items-center justify-between text-foreground"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-muted border border-border">
                          {item.type === "lab_test"
                            ? "Lab"
                            : item.type === "drug"
                              ? "Rx"
                              : "Consult"}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-foreground font-medium shrink-0">
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {invoice.discount > 0 && (
                  <div className="flex items-center justify-between text-[13px] text-success-text pt-1">
                    <span>Discount applied</span>
                    <span className="font-mono tabular-nums">
                      -{formatMoney(invoice.discount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/80 pt-2.5 text-[15px] font-bold text-foreground">
                  <span>Total amount payable</span>
                  <span className="font-mono tabular-nums text-[18px] text-foreground">
                    {formatMoney(total)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector Grid */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-foreground">
                  Select payment method *
                </Label>
                <RadioGroup
                  value={method}
                  onValueChange={setMethod}
                  className="grid grid-cols-2 gap-2.5"
                >
                  {paymentMethods.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = method === opt.id;
                    return (
                      <label
                        key={opt.id}
                        htmlFor={`pm-${opt.id}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all",
                          isSelected
                            ? "border-foreground/40 bg-surface-1 shadow-sm font-semibold ring-1 ring-foreground/20"
                            : "border-border bg-surface-2 hover:border-border-strong text-fg-secondary",
                        )}
                      >
                        <RadioGroupItem value={opt.id} id={`pm-${opt.id}`} className="sr-only" />
                        <Icon
                          className={cn(
                            "size-5 shrink-0 mt-0.5",
                            isSelected ? "text-foreground" : "text-fg-muted",
                          )}
                        />
                        <div className="min-w-0">
                          <span className="text-[13px] text-foreground block font-medium">
                            {opt.label}
                          </span>
                          <span className="text-[11px] text-fg-muted block leading-tight mt-0.5">
                            {opt.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCollect}>
                Confirm & collect {formatMoney(total)}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Receipt Generated View */
          <>
            <DialogHeader className="text-center sm:text-center pt-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-bg text-success-fill mb-2 border border-success-fill/20">
                <CheckCircle2 className="size-7" />
              </div>
              <DialogTitle className="text-[20px]">Payment successfully recorded</DialogTitle>
              <DialogDescription>
                Receipt #{invoice.id} is confirmed. The patient record is updated.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-surface-1/60 p-5 text-center my-2 space-y-1">
              <p className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
                Total amount received
              </p>
              <p className="font-mono text-[28px] font-bold text-foreground tabular-nums">
                {formatMoney(total)}
              </p>
              <p className="text-[13px] text-fg-secondary">
                Tendered via {paymentMethods.find((m) => m.id === method)?.label} · {patientName}
              </p>
            </div>

            <DialogFooter className="sm:justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.print();
                }}
                className="gap-1.5"
              >
                <Printer className="size-4" />
                Print receipt
              </Button>
              <Button type="button" onClick={handleClose}>
                Done & return
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
