import { addDaysISO } from "@/lib/format";
import type {
  CatalogItem,
  CourseDose,
  Invoice,
  LabRequest,
  Patient,
  Prescription,
  Appointment,
  Referral,
  StaffUser,
  TreatmentCourse,
  Visit,
} from "@/lib/types";

export const staff: StaffUser[] = [
  {
    id: "u-rec-1",
    name: "Ama Serwaa",
    role: "receptionist",
    title: "Front desk",
  },
  {
    id: "u-doc-1",
    name: "Dr. Kwame Osei",
    role: "doctor",
    title: "General practitioner",
    room: "Room 3",
  },
  {
    id: "u-doc-2",
    name: "Dr. Akosua Mensah",
    role: "doctor",
    title: "General practitioner",
    room: "Room 1",
  },
  {
    id: "u-lab-1",
    name: "Isaac Boateng",
    role: "lab",
    title: "Lab technician",
  },
  {
    id: "u-adm-1",
    name: "Nadia Owusu",
    role: "admin",
    title: "Clinic administrator",
  },
];

export const patients: Patient[] = [
  {
    id: "p-1",
    patientId: "PT-00482",
    name: "Maria Chen",
    dateOfBirth: "1992-03-14",
    gender: "F",
    phone: "024 441 2290",
    address: "12 Ring Road, Accra",
    emergencyContact: "Daniel Chen · 024 880 1122",
    allergies: ["Penicillin"],
  },
  {
    id: "p-2",
    patientId: "PT-00490",
    name: "Ama Boateng",
    dateOfBirth: "1985-11-02",
    gender: "F",
    phone: "020 334 1188",
    address: "East Legon",
    emergencyContact: "Kofi Boateng · 020 334 1199",
    allergies: [],
  },
  {
    id: "p-3",
    patientId: "PT-00491",
    name: "Kwame Asare",
    dateOfBirth: "1997-06-21",
    gender: "M",
    phone: "027 556 0091",
    address: "Madina",
    emergencyContact: "Abena Asare · 027 556 0092",
    allergies: ["Sulfa drugs"],
  },
  {
    id: "p-4",
    patientId: "PT-00477",
    name: "Yaw Mensah",
    dateOfBirth: "1974-01-09",
    gender: "M",
    phone: "024 990 4411",
    address: "Kaneshie",
    emergencyContact: "Efua Mensah · 024 990 4412",
    allergies: [],
  },
  {
    id: "p-5",
    patientId: "PT-00470",
    name: "Efua Darko",
    dateOfBirth: "1988-08-30",
    gender: "F",
    phone: "026 221 7788",
    address: "Osu",
    emergencyContact: "Kojo Darko · 026 221 7789",
    allergies: [],
  },
  {
    id: "p-6",
    patientId: "PT-00461",
    name: "Kofi Addo",
    dateOfBirth: "1965-04-18",
    gender: "M",
    phone: "024 110 3344",
    address: "Tema",
    emergencyContact: "Ama Addo · 024 110 3345",
    allergies: ["Aspirin"],
  },
  {
    id: "p-7",
    patientId: "PT-00455",
    name: "Akua Frimpong",
    dateOfBirth: "2001-12-05",
    gender: "F",
    phone: "055 667 1200",
    address: "Adenta",
    emergencyContact: "Yaw Frimpong · 055 667 1201",
    allergies: [],
  },
  {
    id: "p-8",
    patientId: "PT-00502",
    name: "Abena Owusu",
    dateOfBirth: "1990-05-22",
    gender: "F",
    phone: "024 772 3344",
    address: "Dansoman",
    emergencyContact: "Kwesi Owusu · 024 772 3345",
    allergies: [],
  },
];

export const visits: Visit[] = [
  {
    id: "v-1007",
    patientId: "p-1",
    doctorId: "u-doc-1",
    receptionistId: "u-rec-1",
    status: "in-consultation",
    reason: "Fever and headache",
    waitMinutes: 8,
    createdAt: "2026-08-18T09:40:00",
  },
  {
    id: "v-1008",
    patientId: "p-2",
    doctorId: "u-doc-2",
    receptionistId: "u-rec-1",
    status: "registered",
    reason: "Follow-up",
    waitMinutes: 6,
    createdAt: "2026-08-18T10:12:00",
  },
  {
    id: "v-1009",
    patientId: "p-3",
    doctorId: "u-doc-1",
    receptionistId: "u-rec-1",
    status: "registered",
    reason: "Cough",
    waitMinutes: 22,
    createdAt: "2026-08-18T09:55:00",
  },
  {
    id: "v-1006",
    patientId: "p-4",
    doctorId: "u-doc-1",
    receptionistId: "u-rec-1",
    status: "awaiting-lab",
    reason: "Fatigue",
    waitMinutes: 35,
    createdAt: "2026-08-18T08:50:00",
  },
  {
    id: "v-1004",
    patientId: "p-5",
    doctorId: "u-doc-2",
    receptionistId: "u-rec-1",
    status: "ready-for-billing",
    reason: "Sore throat",
    waitMinutes: 4,
    createdAt: "2026-08-18T08:10:00",
  },
  {
    id: "v-0998",
    patientId: "p-6",
    doctorId: "u-doc-1",
    receptionistId: "u-rec-1",
    status: "billed",
    reason: "Hypertension review",
    waitMinutes: 0,
    createdAt: "2026-08-18T07:30:00",
  },
  {
    id: "v-0991",
    patientId: "p-1",
    doctorId: "u-doc-1",
    receptionistId: "u-rec-1",
    status: "billed",
    reason: "Malaria follow-up",
    waitMinutes: 0,
    createdAt: "2026-08-11T11:00:00",
  },
  {
    id: "v-1010",
    patientId: "p-7",
    doctorId: "u-doc-2",
    receptionistId: "u-rec-1",
    status: "registered",
    reason: "Skin rash",
    waitMinutes: 3,
    createdAt: "2026-08-18T10:20:00",
  },
  {
    id: "v-rx-1",
    patientId: "p-8",
    doctorId: "",
    receptionistId: "u-rec-1",
    status: "billed",
    reason: "Rabies vaccine (daily dose) · Day 1 of 7",
    waitMinutes: 0,
    createdAt: "2026-08-13T08:15:00",
    kind: "procedure",
    courseId: "course-1",
    doseId: "dose-1-1",
  },
];

export const labRequests: LabRequest[] = [
  {
    id: "lab-22",
    visitId: "v-1006",
    doctorId: "u-doc-1",
    catalogItemId: "svc-3",
    testName: "Complete blood count",
    urgency: "urgent",
    status: "in-progress",
    clinicalNotes: "Rule out anemia. Fatigue for 3 weeks.",
  },
  {
    id: "lab-23",
    visitId: "v-1006",
    doctorId: "u-doc-1",
    catalogItemId: "svc-10",
    testName: "Urinalysis",
    urgency: "urgent",
    status: "in-progress",
    clinicalNotes: "Rule out anemia. Fatigue for 3 weeks.",
  },
  {
    id: "lab-21",
    visitId: "v-1007",
    doctorId: "u-doc-1",
    catalogItemId: "svc-4",
    testName: "Malaria RDT",
    urgency: "urgent",
    status: "requested",
    clinicalNotes: "Fever 38.6°C, headache.",
  },
  {
    id: "lab-24",
    visitId: "v-1007",
    doctorId: "u-doc-1",
    catalogItemId: "svc-9",
    testName: "Blood glucose",
    urgency: "urgent",
    status: "requested",
    clinicalNotes: "Fever 38.6°C, headache.",
  },
  {
    id: "lab-18",
    visitId: "v-1004",
    doctorId: "u-doc-2",
    catalogItemId: "svc-5",
    testName: "Throat swab",
    urgency: "routine",
    status: "result-ready",
    clinicalNotes: "Recurrent pharyngitis.",
    resultValue: "Positive",
    resultFlag: "abnormal",
    resultNotes: "Group A streptococcus detected.",
  },
];

export const invoices: Invoice[] = [
  {
    id: "INV-1094",
    visitId: "v-1004",
    lineItems: [
      { type: "consultation", name: "GP consultation", amount: 80 },
      { type: "lab_test", name: "Throat swab", amount: 40 },
      { type: "drug", name: "Amoxicillin 500mg", amount: 25 },
    ],
    discount: 0,
    paymentStatus: "unpaid",
  },
  {
    id: "INV-1088",
    visitId: "v-0998",
    lineItems: [
      { type: "consultation", name: "GP consultation", amount: 80 },
      { type: "drug", name: "Amlodipine 5mg", amount: 18 },
    ],
    discount: 0,
    paymentStatus: "paid",
  },
  {
    id: "INV-RX01",
    visitId: "v-rx-1",
    lineItems: [
      {
        type: "procedure",
        name: "Rabies vaccine (daily dose) × 7 days",
        amount: 245,
      },
    ],
    discount: 0,
    paymentStatus: "paid",
  },
];

export const prescriptions: Prescription[] = [];
export const appointments: Appointment[] = [];
export const referrals: Referral[] = [];

export const catalog: CatalogItem[] = [
  { id: "svc-1", type: "consultation", name: "GP consultation", price: 80, active: true },
  { id: "svc-2", type: "consultation", name: "Review visit", price: 50, active: true },
  { id: "svc-3", type: "lab_test", name: "Complete blood count", price: 45, active: true },
  { id: "svc-4", type: "lab_test", name: "Malaria RDT", price: 25, active: true },
  { id: "svc-5", type: "lab_test", name: "Throat swab", price: 40, active: true },
  { id: "svc-9", type: "lab_test", name: "Blood glucose", price: 20, active: true },
  { id: "svc-10", type: "lab_test", name: "Urinalysis", price: 18, active: true },
  { id: "svc-11", type: "lab_test", name: "Lipid profile", price: 55, active: true },
  { id: "svc-12", type: "lab_test", name: "Liver function test", price: 60, active: true },
  { id: "svc-13", type: "lab_test", name: "Widal test", price: 22, active: true },
  { id: "svc-14", type: "lab_test", name: "H. pylori stool antigen", price: 35, active: true },
  { id: "svc-15", type: "radiology", name: "Chest X-Ray", price: 120, active: true },
  { id: "svc-16", type: "radiology", name: "Ultrasound Abdomen", price: 150, active: true },
  { id: "svc-6", type: "drug", name: "Amoxicillin 500mg", price: 25, active: true },
  { id: "svc-7", type: "drug", name: "Paracetamol 500mg", price: 8, active: true },
  { id: "svc-8", type: "drug", name: "Amlodipine 5mg", price: 18, active: true },
  { id: "svc-20", type: "procedure", name: "Rabies vaccine (daily dose)", price: 35, active: true },
  { id: "svc-21", type: "procedure", name: "Tetanus toxoid injection", price: 20, active: true },
  { id: "svc-22", type: "procedure", name: "Daily IM injection", price: 15, active: true },
];

const rabiesStart = "2026-08-13";

export const treatmentCourses: TreatmentCourse[] = [
  {
    id: "course-1",
    patientId: "p-8",
    catalogItemId: "svc-20",
    procedureName: "Rabies vaccine (daily dose)",
    totalDoses: 7,
    startDate: rabiesStart,
    billingMode: "package",
    status: "active",
    notes: "Post-exposure series. Mark each day after the injection is given.",
    createdAt: `${rabiesStart}T08:10:00`,
    receptionistId: "u-rec-1",
  },
];

export const courseDoses: CourseDose[] = Array.from({ length: 7 }, (_, index) => {
  const dayNumber = index + 1;
  const scheduledDate = addDaysISO(rabiesStart, index);
  const given = dayNumber <= 6;
  return {
    id: `dose-1-${dayNumber}`,
    courseId: "course-1",
    dayNumber,
    scheduledDate,
    status: given ? "given" : "scheduled",
    visitId: given ? `v-rx-${dayNumber}` : undefined,
    givenAt: given ? `${scheduledDate}T08:40:00` : undefined,
    givenBy: given ? "Ama Serwaa" : undefined,
  } satisfies CourseDose;
});

export function getStaff(id: string) {
  return staff.find((item) => item.id === id);
}

export function getPatient(id: string) {
  return patients.find((item) => item.id === id);
}

export function getVisit(id: string) {
  return visits.find((item) => item.id === id);
}

export function getInvoiceByVisit(visitId: string) {
  return invoices.find((item) => item.visitId === visitId);
}

export function visitsForDoctor(doctorId: string, source = visits) {
  return source.filter(
    (visit) =>
      visit.doctorId === doctorId &&
      visit.kind !== "procedure" &&
      visit.createdAt.startsWith("2026-08-18"),
  );
}

export function todaysVisits(source = visits) {
  return source.filter((visit) => visit.createdAt.startsWith("2026-08-18"));
}

export function patientHistory(patientId: string) {
  return visits
    .filter((visit) => visit.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
