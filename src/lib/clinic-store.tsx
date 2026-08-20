"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dosesForCourse } from "@/lib/courses";
import { addDaysISO, CLINIC_TODAY } from "@/lib/format";
import {
  catalog as seedCatalog,
  courseDoses as seedCourseDoses,
  invoices as seedInvoices,
  labRequests as seedLabRequests,
  patients as seedPatients,
  treatmentCourses as seedCourses,
  visits as seedVisits,
  prescriptions as seedPrescriptions,
  appointments as seedAppointments,
  referrals as seedReferrals,
} from "@/lib/mock-data";
import type {
  CatalogItem,
  CatalogType,
  CourseBillingMode,
  CourseDose,
  Invoice,
  InvoiceLine,
  LabRequest,
  LabResultFlag,
  LabUrgency,
  Patient,
  Prescription,
  TreatmentCourse,
  Visit,
  VisitStatus,
  Appointment,
  Referral,
} from "@/lib/types";

const STORAGE_KEY = "ridgeway-cms-clinic-data-v4";

type ClinicState = {
  catalog: CatalogItem[];
  labRequests: LabRequest[];
  visits: Visit[];
  prescriptions: Prescription[];
  patients: Patient[];
  invoices: Invoice[];
  courses: TreatmentCourse[];
  doses: CourseDose[];
  appointments: Appointment[];
  referrals: Referral[];
};

type OrderLabsInput = {
  visitId: string;
  doctorId: string;
  catalogItemIds: string[];
  urgency: LabUrgency;
  clinicalNotes: string;
};

type RegisterPatientInput = {
  name: string;
  dob: string;
  gender: "F" | "M";
  phone: string;
  doctorId: string;
  reason?: string;
  allergies?: string[];
  address?: string;
  emergencyContact?: string;
};

type StartCourseInput = {
  patientId?: string;
  newPatient?: {
    name: string;
    dob: string;
    gender: "F" | "M";
    phone: string;
    allergies?: string[];
  };
  catalogItemId: string;
  totalDoses: number;
  startDate: string;
  billingMode: CourseBillingMode;
  notes?: string;
  checkInToday?: boolean;
};

type ClinicContextValue = ClinicState & {
  ready: boolean;
  labTests: CatalogItem[];
  radiologyTests: CatalogItem[];
  drugs: CatalogItem[];
  procedures: CatalogItem[];
  addLabTest: (input: { name: string; price: number }) => void;
  setLabTestActive: (id: string, active: boolean) => void;
  addCatalogItem: (input: { type: CatalogType; name: string; price: number }) => void;
  updateCatalogItem: (
    id: string,
    patch: { name?: string; price?: number; type?: CatalogType; active?: boolean },
  ) => void;
  deleteCatalogItem: (id: string) => void;
  orderLabs: (input: OrderLabsInput) => LabRequest[];
  markVisitLabsInProgress: (visitId: string) => void;
  submitVisitLabResults: (
    visitId: string,
    results: Record<
      string,
      {
        resultValue: string;
        resultUnit: string;
        resultFlag: LabResultFlag;
        resultNotes: string;
      }
    >,
  ) => void;
  updateVisitStatus: (visitId: string, status: VisitStatus) => void;
  completeDoctorConsultation: (visitId: string) => void;
  addPrescription: (prescription: Omit<Prescription, "id" | "createdAt">) => void;
  removePrescription: (prescriptionId: string) => void;
  registerPatient: (input: RegisterPatientInput) => { patient: Patient; visit: Visit };
  checkInVisit: (patientId: string, doctorId: string, reason: string) => Visit;
  startCourse: (input: StartCourseInput) => {
    patient: Patient;
    course: TreatmentCourse;
    visit?: Visit;
  };
  checkInDose: (doseId: string) => Visit;
  administerDose: (doseId: string, givenBy: string) => void;
  markDoseMissed: (doseId: string) => void;
  collectPayment: (visitId: string, paymentMethod?: string) => void;
  getInvoiceByVisit: (visitId: string) => Invoice | undefined;
  prescribeMedications: (input: { visitId: string; doctorId: string; prescriptions: { catalogItemId: string; instructions: string }[] }) => void;
  scheduleAppointment: (input: Omit<Appointment, "id" | "createdAt">) => void;
  referPatient: (input: Omit<Referral, "id" | "createdAt">) => void;
  reviewLabResult: (requestId: string, notes: string) => void;
  updateVisitDiagnosis: (visitId: string, diagnosis: string) => void;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

function uniquePendingLabs(requests: LabRequest[]) {
  const pending = new Map<string, LabRequest>();
  const completed: LabRequest[] = [];
  for (const request of requests) {
    if (request.status === "result-ready" || request.status === "reviewed") {
      completed.push(request);
      continue;
    }
    pending.set(`${request.visitId}:${request.catalogItemId}`, request);
  }
  return [...pending.values(), ...completed];
}

function mergeCatalog(stored: CatalogItem[] | undefined): CatalogItem[] {
  const byId = new Map(seedCatalog.map((item) => [item.id, item]));
  for (const item of stored ?? []) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function catalogPrefix(type: CatalogType) {
  if (type === "lab_test") return "lab";
  if (type === "drug") return "drug";
  if (type === "procedure") return "proc";
  return "svc";
}

function createPatientRecord(input: {
  name: string;
  dob: string;
  gender: "F" | "M";
  phone: string;
  allergies?: string[];
  address?: string;
  emergencyContact?: string;
}): Patient {
  return {
    id: `p-${Date.now()}`,
    patientId: `PT-${Math.floor(10000 + Math.random() * 90000)}`,
    name: input.name.trim(),
    dateOfBirth: input.dob,
    gender: input.gender,
    phone: input.phone.trim(),
    address: input.address?.trim() || "",
    emergencyContact: input.emergencyContact?.trim() || "",
    allergies: input.allergies ?? [],
  };
}

function packagePaid(state: ClinicState, course: TreatmentCourse) {
  const day1 = state.doses.find(
    (dose) => dose.courseId === course.id && dose.dayNumber === 1,
  );
  if (!day1?.visitId) return false;
  return state.invoices.some(
    (invoice) => invoice.visitId === day1.visitId && invoice.paymentStatus === "paid",
  );
}

function buildProcedureInvoice(
  state: ClinicState,
  visit: Visit,
): Invoice | undefined {
  if (visit.kind !== "procedure" || !visit.courseId || !visit.doseId) return undefined;

  const course = state.courses.find((item) => item.id === visit.courseId);
  const dose = state.doses.find((item) => item.id === visit.doseId);
  if (!course || !dose) return undefined;

  const catalogItem = state.catalog.find((item) => item.id === course.catalogItemId);
  const unitPrice = catalogItem?.price ?? 0;

  if (course.billingMode === "package") {
    const day1 = state.doses.find(
      (item) => item.courseId === course.id && item.dayNumber === 1,
    );
    const packageVisitId = day1?.visitId ?? visit.id;
    const existing = state.invoices.find((invoice) => invoice.visitId === packageVisitId);
    if (existing) return existing;

    if (dose.dayNumber !== 1) {
      return {
        id: `INV-${visit.id.replace("v-", "")}`,
        visitId: visit.id,
        lineItems: [
          {
            type: "procedure",
            name: `${course.procedureName} · Day ${dose.dayNumber} (covered by course)`,
            amount: 0,
          },
        ],
        discount: 0,
        paymentStatus: packagePaid(state, course) ? "paid" : "unpaid",
      };
    }

    return {
      id: `INV-${visit.id.replace("v-", "")}`,
      visitId: visit.id,
      lineItems: [
        {
          type: "procedure",
          name: `${course.procedureName} × ${course.totalDoses} days`,
          amount: unitPrice * course.totalDoses,
        },
      ],
      discount: 0,
      paymentStatus: visit.status === "billed" ? "paid" : "unpaid",
    };
  }

  const existing = state.invoices.find((invoice) => invoice.visitId === visit.id);
  if (existing) return existing;

  return {
    id: `INV-${visit.id.replace("v-", "")}`,
    visitId: visit.id,
    lineItems: [
      {
        type: "procedure",
        name: `${course.procedureName} · Day ${dose.dayNumber} of ${course.totalDoses}`,
        amount: unitPrice,
      },
    ],
    discount: 0,
    paymentStatus: visit.status === "billed" ? "paid" : "unpaid",
  };
}

function buildConsultationInvoice(state: ClinicState, visit: Visit): Invoice {
  const existing = state.invoices.find((invoice) => invoice.visitId === visit.id);
  if (existing) return existing;

  const lines: InvoiceLine[] = [
    { type: "consultation", name: "GP consultation", amount: 80 },
  ];

  const labs = state.labRequests.filter((lab) => lab.visitId === visit.id);
  for (const lab of labs) {
    const item = state.catalog.find((catalogItem) => catalogItem.id === lab.catalogItemId);
    lines.push({
      type: "lab_test",
      name: lab.testName,
      amount: item?.price ?? 40,
    });
  }

  const rxs = state.prescriptions.filter((rx) => rx.visitId === visit.id);
  for (const rx of rxs) {
    const item = state.catalog.find((catalogItem) => catalogItem.id === rx.drugId);
    lines.push({
      type: "drug",
      name: rx.drugName,
      amount: item?.price ?? 20,
    });
  }

  return {
    id: `INV-${visit.id.replace("v-", "")}`,
    visitId: visit.id,
    lineItems: lines,
    discount: 0,
    paymentStatus: visit.status === "billed" ? "paid" : "unpaid",
  };
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClinicState>({
    catalog: seedCatalog,
    labRequests: seedLabRequests,
    visits: seedVisits,
    prescriptions: seedPrescriptions,
    patients: seedPatients,
    invoices: seedInvoices,
    courses: seedCourses,
    doses: seedCourseDoses,
    appointments: seedAppointments,
    referrals: seedReferrals,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClinicState>;
        setState({
          catalog: mergeCatalog(parsed.catalog),
          labRequests: parsed.labRequests?.length ? parsed.labRequests : seedLabRequests,
          visits: parsed.visits?.length ? parsed.visits : seedVisits,
          prescriptions: parsed.prescriptions?.length ? parsed.prescriptions : seedPrescriptions,
          patients: parsed.patients?.length ? parsed.patients : seedPatients,
          invoices: parsed.invoices?.length ? parsed.invoices : seedInvoices,
          courses: parsed.courses?.length ? parsed.courses : seedCourses,
          doses: parsed.doses?.length ? parsed.doses : seedCourseDoses,
          appointments: parsed.appointments?.length ? parsed.appointments : seedAppointments,
          referrals: parsed.referrals?.length ? parsed.referrals : seedReferrals,
        });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const value = useMemo<ClinicContextValue>(() => {
    const labTests = state.catalog
      .filter((item) => item.type === "lab_test")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const radiologyTests = state.catalog
      .filter((item) => item.type === "radiology" && item.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const drugs = state.catalog
      .filter((item) => item.type === "drug" && item.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const procedures = state.catalog
      .filter((item) => item.type === "procedure" && item.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const getInvoiceByVisit = (visitId: string): Invoice | undefined => {
      const visit = state.visits.find((item) => item.id === visitId);
      if (!visit) {
        return state.invoices.find((invoice) => invoice.visitId === visitId);
      }
      if (visit.kind === "procedure") {
        return buildProcedureInvoice(state, visit);
      }
      return buildConsultationInvoice(state, visit);
    };
    return {
      ...state,
      ready,
      labTests,
      radiologyTests,
      drugs,
      procedures,
      addCatalogItem: ({ type, name, price }) => {
        const item: CatalogItem = {
          id: `${catalogPrefix(type)}-${Date.now()}`,
          type,
          name: name.trim(),
          price,
          active: true,
        };
        setState((current) => ({ ...current, catalog: [item, ...current.catalog] }));
      },
      updateCatalogItem: (id, patch) => {
        setState((current) => ({
          ...current,
          catalog: current.catalog.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                  ...(patch.price !== undefined ? { price: patch.price } : {}),
                  ...(patch.type !== undefined ? { type: patch.type } : {}),
                  ...(patch.active !== undefined ? { active: patch.active } : {}),
                }
              : item,
          ),
        }));
      },
      deleteCatalogItem: (id) => {
        setState((current) => ({
          ...current,
          catalog: current.catalog.filter((item) => item.id !== id),
        }));
      },
      addLabTest: ({ name, price }) => {
        const item: CatalogItem = {
          id: `lab-${Date.now()}`,
          type: "lab_test",
          name: name.trim(),
          price,
          active: true,
        };
        setState((current) => ({ ...current, catalog: [item, ...current.catalog] }));
      },
      setLabTestActive: (id, active) => {
        setState((current) => ({
          ...current,
          catalog: current.catalog.map((item) =>
            item.id === id ? { ...item, active } : item,
          ),
        }));
      },
      orderLabs: ({ visitId, doctorId, catalogItemIds, urgency, clinicalNotes }) => {
        const pendingIds = new Set(
          state.labRequests
            .filter(
              (request) =>
                request.visitId === visitId && request.status !== "result-ready" && request.status !== "reviewed",
            )
            .map((request) => request.catalogItemId),
        );
        const created: LabRequest[] = [];
        for (const catalogItemId of catalogItemIds) {
          if (pendingIds.has(catalogItemId)) continue;
          const test = state.catalog.find((item) => item.id === catalogItemId);
          if (!test || !test.active || (test.type !== "lab_test" && test.type !== "radiology")) continue;
          created.push({
            id: `lab-${visitId}-${catalogItemId}-${Date.now()}`,
            visitId,
            doctorId,
            catalogItemId: test.id,
            testName: test.name,
            urgency,
            status: "requested",
            clinicalNotes: clinicalNotes.trim(),
          });
        }
        if (created.length > 0) {
          setState((current) => ({
            ...current,
            labRequests: uniquePendingLabs([...created, ...current.labRequests]),
            visits: current.visits.map((visit) =>
              visit.id === visitId &&
              (visit.status === "registered" || visit.status === "in-consultation")
                ? { ...visit, status: "awaiting-lab" }
                : visit,
            ),
          }));
        }
        return created;
      },
      markVisitLabsInProgress: (visitId) => {
        setState((current) => {
          const needsUpdate = current.labRequests.some(
            (request) => request.visitId === visitId && request.status === "requested",
          );
          if (!needsUpdate) return current;
          return {
            ...current,
            labRequests: current.labRequests.map((request) =>
              request.visitId === visitId && request.status === "requested"
                ? { ...request, status: "in-progress" }
                : request,
            ),
          };
        });
      },
      submitVisitLabResults: (visitId, results) => {
        setState((current) => {
          const labRequests = current.labRequests.map((request) => {
            if (request.visitId !== visitId) return request;
            const result = results[request.id];
            if (!result) return request;
            return {
              ...request,
              status: "result-ready" as const,
              resultValue: result.resultValue.trim(),
              resultUnit: result.resultUnit.trim(),
              resultFlag: result.resultFlag,
              resultNotes: result.resultNotes.trim(),
            };
          });
          const visitDone = labRequests
            .filter((request) => request.visitId === visitId)
            .every((request) => request.status === "result-ready" || request.status === "reviewed");
          return {
            ...current,
            labRequests,
            visits: current.visits.map((visit) =>
              visit.id === visitId && visitDone
                ? { ...visit, status: "lab-complete" }
                : visit,
            ),
          };
        });
      },
      updateVisitStatus: (visitId, status) => {
        setState((current) => ({
          ...current,
          visits: current.visits.map((v) =>
            v.id === visitId ? { ...v, status } : v,
          ),
        }));
      },
      completeDoctorConsultation: (visitId) => {
        setState((current) => {
          const pendingLabs = current.labRequests.filter(
            (req) => req.visitId === visitId && req.status !== "result-ready",
          );
          const targetStatus: VisitStatus =
            pendingLabs.length > 0 ? "awaiting-lab" : "ready-for-billing";

          return {
            ...current,
            visits: current.visits.map((v) =>
              v.id === visitId ? { ...v, status: targetStatus } : v,
            ),
          };
        });
      },
      addPrescription: (prescription) => {
        const item: Prescription = {
          ...prescription,
          id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          prescriptions: [item, ...current.prescriptions],
        }));
      },
      removePrescription: (prescriptionId) => {
        setState((current) => ({
          ...current,
          prescriptions: current.prescriptions.filter((rx) => rx.id !== prescriptionId),
        }));
      },
      getInvoiceByVisit,
      registerPatient: ({
        name,
        dob,
        gender,
        phone,
        doctorId,
        reason,
        allergies,
        address,
        emergencyContact,
      }) => {
        const newPatient = createPatientRecord({
          name,
          dob,
          gender,
          phone,
          allergies,
          address,
          emergencyContact,
        });

        const visitId = `v-${Date.now()}`;
        const newVisit: Visit = {
          id: visitId,
          patientId: newPatient.id,
          doctorId,
          receptionistId: "u-rec-1",
          status: "registered",
          reason: reason?.trim() || "Consultation",
          waitMinutes: 0,
          createdAt: new Date().toISOString(),
          kind: "consultation",
        };

        setState((current) => ({
          ...current,
          patients: [newPatient, ...current.patients],
          visits: [newVisit, ...current.visits],
        }));

        return { patient: newPatient, visit: newVisit };
      },
      checkInVisit: (patientId, doctorId, reason) => {
        const visitId = `v-${Date.now()}`;
        const newVisit: Visit = {
          id: visitId,
          patientId,
          doctorId,
          receptionistId: "u-rec-1",
          status: "registered",
          reason: reason?.trim() || "Follow-up",
          waitMinutes: 0,
          createdAt: new Date().toISOString(),
          kind: "consultation",
        };

        setState((current) => ({
          ...current,
          visits: [newVisit, ...current.visits],
        }));

        return newVisit;
      },
      startCourse: (input) => {
        const catalogItem = state.catalog.find((item) => item.id === input.catalogItemId);
        if (!catalogItem || catalogItem.type !== "procedure") {
          throw new Error("Select a procedure from the catalog.");
        }

        let patient = input.patientId
          ? state.patients.find((item) => item.id === input.patientId)
          : undefined;
        const createdPatient = !patient && input.newPatient
          ? createPatientRecord(input.newPatient)
          : undefined;
        patient = patient ?? createdPatient;
        if (!patient) {
          throw new Error("Select or register a patient for this course.");
        }

        const courseId = `course-${Date.now()}`;
        const totalDoses = Math.max(1, Math.min(31, Math.round(input.totalDoses)));
        const course: TreatmentCourse = {
          id: courseId,
          patientId: patient.id,
          catalogItemId: catalogItem.id,
          procedureName: catalogItem.name,
          totalDoses,
          startDate: input.startDate,
          billingMode: input.billingMode,
          status: "active",
          notes: input.notes?.trim() || "",
          createdAt: new Date().toISOString(),
          receptionistId: "u-rec-1",
        };

        const doses: CourseDose[] = Array.from({ length: totalDoses }, (_, index) => ({
          id: `dose-${courseId}-${index + 1}`,
          courseId,
          dayNumber: index + 1,
          scheduledDate: addDaysISO(input.startDate, index),
          status: "scheduled",
        }));

        let visit: Visit | undefined;
        if (input.checkInToday) {
          const dose =
            doses.find((item) => item.scheduledDate === CLINIC_TODAY) ?? doses[0];
          const visitId = `v-${Date.now()}`;
          visit = {
            id: visitId,
            patientId: patient.id,
            doctorId: "",
            receptionistId: "u-rec-1",
            status: "registered",
            reason: `${catalogItem.name} · Day ${dose.dayNumber} of ${totalDoses}`,
            waitMinutes: 0,
            createdAt: new Date().toISOString(),
            kind: "procedure",
            courseId,
            doseId: dose.id,
          };
          dose.status = "checked-in";
          dose.visitId = visitId;
        }

        const patientToAdd = createdPatient;
        const visitToAdd = visit;

        setState((current) => ({
          ...current,
          patients: patientToAdd ? [patientToAdd, ...current.patients] : current.patients,
          courses: [course, ...current.courses],
          doses: [...doses, ...current.doses],
          visits: visitToAdd ? [visitToAdd, ...current.visits] : current.visits,
        }));

        return { patient, course, visit };
      },
      checkInDose: (doseId) => {
        const dose = state.doses.find((item) => item.id === doseId);
        const course = dose
          ? state.courses.find((item) => item.id === dose.courseId)
          : undefined;
        if (!dose || !course) {
          throw new Error("Dose not found.");
        }
        if (dose.status === "given") {
          throw new Error("This day’s dose is already marked as given.");
        }
        if (dose.visitId) {
          const existing = state.visits.find((item) => item.id === dose.visitId);
          if (existing) return existing;
        }

        const visitId = `v-${Date.now()}`;
        const visit: Visit = {
          id: visitId,
          patientId: course.patientId,
          doctorId: "",
          receptionistId: "u-rec-1",
          status: "registered",
          reason: `${course.procedureName} · Day ${dose.dayNumber} of ${course.totalDoses}`,
          waitMinutes: 0,
          createdAt: new Date().toISOString(),
          kind: "procedure",
          courseId: course.id,
          doseId: dose.id,
        };

        setState((current) => ({
          ...current,
          visits: [visit, ...current.visits],
          doses: current.doses.map((item) =>
            item.id === doseId
              ? { ...item, status: "checked-in" as const, visitId }
              : item,
          ),
        }));

        return visit;
      },
      administerDose: (doseId, givenBy) => {
        setState((current) => {
          const dose = current.doses.find((item) => item.id === doseId);
          const course = dose
            ? current.courses.find((item) => item.id === dose.courseId)
            : undefined;
          if (!dose || !course || dose.status === "given") return current;

          let visits = current.visits;
          let visitId = dose.visitId;
          let nextDoses = current.doses;

          if (!visitId) {
            visitId = `v-${Date.now()}`;
            const visit: Visit = {
              id: visitId,
              patientId: course.patientId,
              doctorId: "",
              receptionistId: "u-rec-1",
              status: "registered",
              reason: `${course.procedureName} · Day ${dose.dayNumber} of ${course.totalDoses}`,
              waitMinutes: 0,
              createdAt: new Date().toISOString(),
              kind: "procedure",
              courseId: course.id,
              doseId: dose.id,
            };
            visits = [visit, ...current.visits];
            nextDoses = current.doses.map((item) =>
              item.id === doseId ? { ...item, visitId, status: "checked-in" as const } : item,
            );
          }

          const covered =
            course.billingMode === "package" && packagePaid({ ...current, visits }, course);
          const needsBilling =
            course.billingMode === "per-dose" ||
            (course.billingMode === "package" && dose.dayNumber === 1 && !covered);

          const nextStatus: VisitStatus =
            needsBilling && !covered ? "ready-for-billing" : "billed";

          nextDoses = nextDoses.map((item) =>
            item.id === doseId
              ? {
                  ...item,
                  status: "given" as const,
                  visitId,
                  givenAt: new Date().toISOString(),
                  givenBy,
                }
              : item,
          );

          const courseDoses = dosesForCourse(nextDoses, course.id);
          const allGiven = courseDoses.every((item) => item.status === "given");

          return {
            ...current,
            doses: nextDoses,
            courses: current.courses.map((item) =>
              item.id === course.id && allGiven
                ? { ...item, status: "completed" as const }
                : item,
            ),
            visits: visits.map((visit) =>
              visit.id === visitId ? { ...visit, status: nextStatus } : visit,
            ),
          };
        });
      },
      markDoseMissed: (doseId) => {
        setState((current) => ({
          ...current,
          doses: current.doses.map((item) =>
            item.id === doseId && item.status !== "given"
              ? { ...item, status: "missed" as const }
              : item,
          ),
        }));
      },
      collectPayment: (visitId, _paymentMethod) => {
        setState((current) => {
          const visit = current.visits.find((item) => item.id === visitId);
          const invoice =
            visit?.kind === "procedure"
              ? buildProcedureInvoice(current, visit)
              : visit
                ? buildConsultationInvoice(current, visit)
                : current.invoices.find((item) => item.visitId === visitId);

          let updatedInvoices = current.invoices;
          if (invoice) {
            const exists = current.invoices.some((item) => item.visitId === invoice.visitId);
            if (exists) {
              updatedInvoices = current.invoices.map((item) =>
                item.visitId === invoice.visitId
                  ? { ...item, paymentStatus: "paid" as const }
                  : item,
              );
            } else {
              updatedInvoices = [
                { ...invoice, paymentStatus: "paid" },
                ...current.invoices,
              ];
            }
          }

          return {
            ...current,
            invoices: updatedInvoices,
            visits: current.visits.map((item) =>
              item.id === visitId ? { ...item, status: "billed" as const } : item,
            ),
          };
        });
      },
      prescribeMedications: ({ visitId, doctorId, prescriptions }) => {
        const created: Prescription[] = [];
        for (const req of prescriptions) {
          const test = state.catalog.find((item) => item.id === req.catalogItemId);
          if (!test || !test.active || test.type !== "drug") continue;
          created.push({
            id: `rx-${visitId}-${test.id}-${Date.now()}`,
            visitId,
            doctorId,
            catalogItemId: test.id,
            drugName: test.name,
            instructions: req.instructions.trim(),
            status: "awaiting-payment",
            createdAt: new Date().toISOString(),
          });
        }
        if (created.length > 0) {
          setState((current) => ({
            ...current,
            prescriptions: [...created, ...current.prescriptions],
            visits: current.visits.map((visit) =>
              visit.id === visitId
                ? { ...visit, status: "medication-prescribed" }
                : visit,
            ),
          }));
        }
      },
      scheduleAppointment: (input) => {
        const item: Appointment = {
          ...input,
          id: `apt-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({ ...current, appointments: [item, ...current.appointments] }));
      },
      referPatient: (input) => {
        const item: Referral = {
          ...input,
          id: `ref-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({ ...current, referrals: [item, ...current.referrals] }));
      },
      reviewLabResult: (requestId, notes) => {
        setState((current) => ({
          ...current,
          labRequests: current.labRequests.map((req) => 
            req.id === requestId ? { ...req, status: "reviewed", resultNotes: req.resultNotes ? `${req.resultNotes}\nDoctor Note: ${notes}` : notes } : req
          )
        }));
      },
      updateVisitDiagnosis: (visitId, diagnosis) => {
        setState((current) => ({
          ...current,
          visits: current.visits.map((visit) => 
            visit.id === visitId ? { ...visit, diagnosis } : visit
          )
        }));
      },
    };
  }, [ready, state]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error("useClinic must be used within ClinicProvider");
  return context;
}
