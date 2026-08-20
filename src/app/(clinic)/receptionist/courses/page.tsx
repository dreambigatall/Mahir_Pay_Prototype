"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Syringe, X } from "lucide-react";

import { CourseDoseGrid } from "@/components/clinic/course-dose-grid";
import { PageHeader } from "@/components/clinic/page-header";
import { StartCourseDialog } from "@/components/clinic/start-course-dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { courseProgressLabel, dosesForCourse, nextOpenDose } from "@/lib/courses";
import { useClinic } from "@/lib/clinic-store";
import { CLINIC_TODAY } from "@/lib/format";

export default function CoursesPage() {
  const { courses, doses, patients, ready } = useClinic();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .map((course) => {
        const patient = patients.find((item) => item.id === course.patientId);
        const courseDoses = dosesForCourse(doses, course.id);
        const due = nextOpenDose(courseDoses);
        return { course, patient, courseDoses, due };
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.patient?.name.toLowerCase().includes(q) ||
          row.patient?.patientId.toLowerCase().includes(q) ||
          row.course.procedureName.toLowerCase().includes(q)
        );
      });
  }, [courses, doses, patients, query]);

  const dueToday = rows.filter(
    (row) =>
      row.course.status === "active" &&
      row.due?.scheduledDate === CLINIC_TODAY &&
      row.due.status !== "given",
  ).length;

  if (!ready) return <div className="min-h-[40vh]" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Injection & vaccination register"
        description="Paper-book replacement: name, vaccine, and a mark for each day they attend."
        action={<StartCourseDialog />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patient or vaccine…"
            className="h-9 pl-9 pr-8 text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <p className="text-[13px] text-fg-secondary">
          {dueToday} due today · {courses.filter((item) => item.status === "active").length} active
          courses
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Syringe className="mx-auto size-8 text-fg-muted" />
          <p className="mt-3 text-[14px] font-medium">No courses in the register</p>
          <p className="mt-1 text-[13px] text-fg-muted">
            Start a 3–7 day injection or vaccination course for a walk-in or returning patient.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ course, patient, courseDoses, due }) => (
            <Link
              key={course.id}
              href={`/receptionist/courses/${course.id}`}
              className="block rounded-xl border border-border bg-surface-2 p-4 hover:border-border-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold">{patient?.name ?? "Unknown patient"}</p>
                  <p className="font-mono text-[12px] text-fg-muted">
                    {patient?.patientId} · {course.procedureName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    role={
                      course.status === "completed"
                        ? "success"
                        : due?.scheduledDate === CLINIC_TODAY
                          ? "warning"
                          : "clinical"
                    }
                  >
                    {course.status === "completed"
                      ? "Course complete"
                      : due?.status === "checked-in"
                        ? "Checked in today"
                        : due?.scheduledDate === CLINIC_TODAY
                          ? `Due today · Day ${due.dayNumber}`
                          : courseProgressLabel(course, courseDoses)}
                  </StatusBadge>
                </div>
              </div>
              <div className="mt-3">
                <CourseDoseGrid doses={courseDoses} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
