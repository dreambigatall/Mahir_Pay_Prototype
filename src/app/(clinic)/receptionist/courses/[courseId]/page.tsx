"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Syringe } from "lucide-react";
import { toast } from "sonner";

import { CourseDoseGrid } from "@/components/clinic/course-dose-grid";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { dosesForCourse, givenCount, isDoseOverdue } from "@/lib/courses";
import { useClinic } from "@/lib/clinic-store";
import { CLINIC_TODAY, formatMoney, formatShortDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { CourseDose } from "@/lib/types";

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useSession();
  const {
    courses,
    doses,
    patients,
    catalog,
    ready,
    checkInDose,
    administerDose,
    markDoseMissed,
    getInvoiceByVisit,
  } = useClinic();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const course = courses.find((item) => item.id === courseId);
  const courseDoses = useMemo(
    () => (course ? dosesForCourse(doses, course.id) : []),
    [course, doses],
  );

  const selected =
    courseDoses.find((item) => item.id === selectedId) ??
    courseDoses.find((item) => item.scheduledDate === CLINIC_TODAY) ??
    courseDoses.find((item) => item.status === "checked-in") ??
    courseDoses.find((item) => item.status === "scheduled");

  if (!ready) return <div className="min-h-[40vh]" />;
  if (!course) notFound();

  const patient = patients.find((item) => item.id === course.patientId);
  if (!patient) notFound();

  const patientName = patient.name;
  const totalDoses = course.totalDoses;
  const price = catalog.find((item) => item.id === course.catalogItemId)?.price ?? 0;
  const invoice = selected?.visitId ? getInvoiceByVisit(selected.visitId) : undefined;

  function handleCheckIn(dose: CourseDose) {
    try {
      checkInDose(dose.id);
      setSelectedId(dose.id);
      toast.success("Checked in", {
        description: `${patientName} · Day ${dose.dayNumber} of ${totalDoses}.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check in.");
    }
  }

  function handleGive(dose: CourseDose) {
    administerDose(dose.id, user?.name ?? "Reception");
    toast.success("Dose marked given", {
      description: `Day ${dose.dayNumber} ticked. Patient can go home.`,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/receptionist/courses"
        className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to register
      </Link>

      <PageHeader
        title={patient.name}
        description={`${patient.patientId} · ${course.procedureName}`}
        action={
          <StatusBadge role={course.status === "completed" ? "success" : "clinical"}>
            {course.status === "completed"
              ? "Completed"
              : `${givenCount(courseDoses)} / ${course.totalDoses} given`}
          </StatusBadge>
        }
      />

      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Syringe className="size-4 text-fg-muted" />
          <h2 className="text-[14px] font-semibold">Daily attendance ticks</h2>
        </div>
        <CourseDoseGrid
          doses={courseDoses}
          selectedId={selected?.id}
          onSelect={(dose) => setSelectedId(dose.id)}
        />
        <p className="mt-3 text-[12px] text-fg-muted">
          Same as the paper book: each cell is a day. Tick after the injection is given.
        </p>
      </div>

      {selected ? (
        <div className="rounded-xl border border-border bg-surface-2 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">
                Day {selected.dayNumber} of {course.totalDoses}
              </p>
              <p className="text-[13px] text-fg-secondary">
                {formatShortDate(selected.scheduledDate)}
                {selected.scheduledDate === CLINIC_TODAY ? " · Today" : ""}
                {isDoseOverdue(selected) ? " · Overdue" : ""}
              </p>
            </div>
            <StatusBadge
              role={
                selected.status === "given"
                  ? "success"
                  : selected.status === "missed"
                    ? "danger"
                    : selected.status === "checked-in"
                      ? "clinical"
                      : "neutral"
              }
            >
              {selected.status === "given"
                ? "Given"
                : selected.status === "missed"
                  ? "Missed"
                  : selected.status === "checked-in"
                    ? "Checked in"
                    : "Not yet"}
            </StatusBadge>
          </div>

          {selected.givenAt ? (
            <p className="text-[13px] text-fg-secondary">
              Marked by {selected.givenBy} at{" "}
              {new Date(selected.givenAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          ) : null}

          <div className="rounded-lg bg-surface-1 px-3 py-2.5 text-[13px] text-fg-secondary">
            Billing:{" "}
            {course.billingMode === "package"
              ? `Full course ${formatMoney(price * course.totalDoses)} on day 1`
              : `${formatMoney(price)} each attendance`}
            {invoice ? ` · Invoice ${invoice.id} (${invoice.paymentStatus})` : ""}
          </div>

          {selected.status !== "given" ? (
            <div className="flex flex-wrap gap-2">
              {selected.status === "scheduled" ? (
                <Button onClick={() => handleCheckIn(selected)}>Check in today</Button>
              ) : null}
              <Button
                onClick={() => handleGive(selected)}
                className="gap-1.5"
                variant={selected.status === "checked-in" ? "default" : "outline"}
              >
                <CheckCircle2 className="size-4" />
                Mark dose given
              </Button>
              {selected.status !== "missed" ? (
                <Button variant="outline" onClick={() => markDoseMissed(selected.id)}>
                  Mark missed
                </Button>
              ) : null}
              {selected.visitId && invoice && invoice.paymentStatus !== "paid" ? (
                <Button asChild variant="outline">
                  <Link href={`/receptionist/billing/${selected.visitId}`}>Collect payment</Link>
                </Button>
              ) : null}
            </div>
          ) : selected.visitId && invoice && invoice.paymentStatus !== "paid" ? (
            <Button asChild>
              <Link href={`/receptionist/billing/${selected.visitId}`}>Collect payment</Link>
            </Button>
          ) : (
            <p className="text-[13px] text-success-text">This day is ticked. Patient went home.</p>
          )}
        </div>
      ) : null}

      {course.notes ? (
        <p className="text-[13px] text-fg-secondary">Note: {course.notes}</p>
      ) : null}
    </div>
  );
}
