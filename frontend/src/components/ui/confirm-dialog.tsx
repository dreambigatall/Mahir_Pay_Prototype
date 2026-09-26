"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * One standard "are you sure?" for irreversible actions. The description should state
 * the consequence (what gets locked, sent, or charged), not just repeat the title.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Go back",
  tone = "default",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent size="confirm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button type="button" variant={tone === "danger" ? "destructive" : "default"} disabled={busy} onClick={() => void confirm()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Protects half-filled forms. Route the dialog's onOpenChange through `onOpenChange`
 * and render `prompt`; closing with unsaved changes asks before discarding.
 *
 *   const guard = useDiscardGuard(isDirty, () => { setOpen(false); resetForm(); });
 *   <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : guard.requestClose()}>
 *   {guard.prompt}
 */
export function useDiscardGuard(dirty: boolean, close: () => void) {
  const [asking, setAsking] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else close();
  }, [close, dirty]);

  const prompt = (
    <ConfirmDialog
      open={asking}
      onOpenChange={setAsking}
      title="Discard changes?"
      description="What you entered in this form has not been saved and will be lost."
      cancelLabel="Keep editing"
      confirmLabel="Discard"
      tone="danger"
      onConfirm={() => {
        setAsking(false);
        close();
      }}
    />
  );

  return { requestClose, prompt };
}
