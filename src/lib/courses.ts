import { CLINIC_TODAY } from "@/lib/format";
import type { CourseDose, TreatmentCourse } from "@/lib/types";

export function dosesForCourse(doses: CourseDose[], courseId: string) {
  return doses
    .filter((dose) => dose.courseId === courseId)
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

export function givenCount(doses: CourseDose[]) {
  return doses.filter((dose) => dose.status === "given").length;
}

export function todayDose(doses: CourseDose[], today = CLINIC_TODAY) {
  return doses.find((dose) => dose.scheduledDate === today);
}

export function nextOpenDose(doses: CourseDose[], today = CLINIC_TODAY) {
  const dueToday = todayDose(doses, today);
  if (dueToday && (dueToday.status === "scheduled" || dueToday.status === "checked-in")) {
    return dueToday;
  }
  return doses.find(
    (dose) => dose.status === "scheduled" || dose.status === "checked-in",
  );
}

export function courseProgressLabel(course: TreatmentCourse, doses: CourseDose[]) {
  return `${givenCount(doses)} of ${course.totalDoses} given`;
}

export function isDoseOverdue(dose: CourseDose, today = CLINIC_TODAY) {
  return dose.status === "scheduled" && dose.scheduledDate < today;
}
