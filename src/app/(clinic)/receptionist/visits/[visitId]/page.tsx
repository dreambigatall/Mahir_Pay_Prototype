import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/clinic/page-header";
import { Chip } from "@/components/ui/chip";
import { ageFromDob } from "@/lib/format";
import { getPatient, getStaff, getVisit } from "@/lib/mock-data";
import { visitBadge } from "@/lib/visit-status";

export default async function ReceptionistVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const visit = getVisit(visitId);
  if (!visit) notFound();

  const patient = getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) notFound();

  const badge = visitBadge(visit.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={patient.name}
        description={`${patient.patientId} · ${ageFromDob(patient.dateOfBirth)}${patient.gender}`}
      />
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-medium">{visit.reason}</p>
          <Chip variant={badge.role}>{badge.label}</Chip>
        </div>
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-fg-muted">Doctor</dt>
            <dd>
              {doctor?.name} {doctor?.room ? `· ${doctor.room}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-muted">Wait</dt>
            <dd>{visit.waitMinutes} min</dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-muted">Allergies</dt>
            <dd>{patient.allergies.length ? patient.allergies.join(", ") : "None recorded"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-muted">Phone</dt>
            <dd>{patient.phone}</dd>
          </div>
        </dl>
        {(visit.status === "ready-for-billing" || visit.status === "billed") && (
          <Link
            href={`/receptionist/billing/${visit.id}`}
            className="mt-4 inline-block text-[13px] font-medium text-clinical-text hover:underline"
          >
            Open invoice
          </Link>
        )}
      </div>
    </div>
  );
}
