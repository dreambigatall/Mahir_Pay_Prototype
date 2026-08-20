"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";

import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getPatient, getStaff } from "@/lib/mock-data";
import type { Visit } from "@/lib/types";
import { QUEUE_COLUMNS, visitDot } from "@/lib/visit-status";

export function QueueBoard({
  visits,
  hrefFor,
}: {
  visits: Visit[];
  hrefFor: (visit: Visit) => string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [visits]);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 402; // width (400) + gap (2)
      scrollRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="relative group">
      {showLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 shadow-lg border border-border p-3 hover:bg-surface-2 transition-all backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="size-6 text-primary" />
        </button>
      )}

      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-0.5 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {QUEUE_COLUMNS.map((column) => {
          const cards = visits.filter((visit) =>
            column.statuses.includes(visit.status),
          );
          return (
            <div
              key={column.id}
              className="w-[400px] shrink-0 rounded-xl bg-surface-1 p-5"
            >
              <div className="mb-5 flex items-center justify-between border-b border-border pb-3.5">
                <p className="text-[18px] font-bold text-foreground">{column.title}</p>
                <span className="font-mono text-[16px] font-medium text-fg-muted">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-4">
                {cards.length === 0 ? (
                  <p className="py-12 text-center text-[16px] text-fg-muted">
                    No patients in this stage
                  </p>
                ) : (
                  cards.map((visit) => (
                    <QueueCard
                      key={visit.id}
                      visit={visit}
                      href={hrefFor(visit)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 shadow-lg border border-border p-3 hover:bg-surface-2 transition-all backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="size-6 text-primary" />
        </button>
      )}
    </div>
  );
}

function QueueCard({ visit, href }: { visit: Visit; href: string }) {
  const { patients } = useClinic();
  const patient =
    patients.find((p) => p.id === visit.patientId) || getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) return null;

  const overSla = visit.waitMinutes > 20;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-surface-2 p-5 transition-colors hover:border-border-strong mb-3"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <GripVertical className="size-6 text-primary shrink-0" />
          <p className="text-[18px] font-bold text-primary truncate">{patient.name}</p>
        </div>
        <span className={`mt-2 size-3 shrink-0 rounded-full ${visitDot(visit.status)}`} />
      </div>

      <p className="mt-2 font-mono text-[14px] text-fg-muted">
        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}{patient.gender}
      </p>
      <p className="mt-2.5 text-[15px] text-fg-secondary truncate">
        {doctor?.name} {doctor?.room ? `· ${doctor.room}` : ""}
      </p>
      <p className="text-[15px] text-fg-muted truncate">{visit.reason}</p>
      {visit.kind === "procedure" ? (
        <p className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-clinical-text">
          Injection / vaccine
        </p>
      ) : null}

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-[14px]">
        {visit.status !== "billed" ? (
          <span className={overSla ? "font-semibold text-danger-text" : "text-fg-muted font-mono"}>
            Waiting {visit.waitMinutes}m
          </span>
        ) : (
          <span className="text-success-text font-medium">Visit closed</span>
        )}

        <span className="font-mono text-fg-muted text-[13px] uppercase">
          {visit.id.slice(-6)}
        </span>
      </div>
    </Link>
  );
}
