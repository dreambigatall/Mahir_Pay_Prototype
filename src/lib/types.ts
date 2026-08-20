export type Role = "receptionist" | "doctor" | "lab" | "admin";

export type VisitStatus =
  | "registered"
  | "in-consultation"
  | "awaiting-lab"
  | "lab-complete"
  | "medication-prescribed"
  | "ready-for-billing"
  | "billed"
  | "cancelled";

export type LabStatus = "requested" | "in-progress" | "result-ready" | "reviewed";
export type LabUrgency = "routine" | "urgent";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "pending-credit";
export type CatalogType = "consultation" | "lab_test" | "radiology" | "drug" | "procedure";
export type VisitKind = "consultation" | "procedure";
export type CourseStatus = "active" | "completed" | "cancelled";
export type DoseStatus = "scheduled" | "checked-in" | "given" | "missed";
export type CourseBillingMode = "per-dose" | "package";

export type StaffUser = {
  id: string;
  name: string;
  role: Role;
  title: string;
  room?: string;
};

export type Patient = {
  id: string;
  patientId: string;
  name: string;
  dateOfBirth: string;
  gender: "F" | "M";
  phone: string;
  address: string;
  emergencyContact: string;
  allergies: string[];
};

export type Visit = {
  id: string;
  patientId: string;
  doctorId: string;
  receptionistId: string;
  status: VisitStatus;
  reason: string;
  diagnosis?: string;
  waitMinutes: number;
  createdAt: string;
  kind?: VisitKind;
  courseId?: string;
  doseId?: string;
};

export type LabResultFlag = "normal" | "abnormal";

export type LabRequest = {
  id: string;
  visitId: string;
  doctorId: string;
  catalogItemId: string;
  testName: string;
  urgency: LabUrgency;
  status: LabStatus;
  clinicalNotes: string;
  resultValue?: string;
  resultUnit?: string;
  resultFlag?: LabResultFlag;
  resultNotes?: string;
};

export type InvoiceLine = {
  type: CatalogType;
  name: string;
  amount: number;
};

export type Invoice = {
  id: string;
  visitId: string;
  lineItems: InvoiceLine[];
  discount: number;
  paymentStatus: PaymentStatus;
};

export type CatalogItem = {
  id: string;
  type: CatalogType;
  name: string;
  price: number;
  active: boolean;
};

export type TreatmentCourse = {
  id: string;
  patientId: string;
  catalogItemId: string;
  procedureName: string;
  totalDoses: number;
  startDate: string;
  billingMode: CourseBillingMode;
  status: CourseStatus;
  notes: string;
  createdAt: string;
  receptionistId: string;
};

export type CourseDose = {
  id: string;
  courseId: string;
  dayNumber: number;
  scheduledDate: string;
  status: DoseStatus;
  visitId?: string;
  givenAt?: string;
  givenBy?: string;
};

export type PrescriptionStatus = "awaiting-payment" | "payment-approved" | "dispensed";

export type Prescription = {
  id: string;
  visitId: string;
  drugName: string;
  instructions: string;
  createdAt: string;
  
  // From HEAD (Pharmacy flow)
  drugId?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  
  // From Color_Update
  doctorId?: string;
  catalogItemId?: string;
  status?: PrescriptionStatus;
};

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  reason: string;
  createdAt: string;
};

export type Referral = {
  id: string;
  visitId: string;
  patientId: string;
  fromDoctorId: string;
  toDepartment?: string;
  toBranch?: string;
  diagnosis: string;
  notes: string;
  createdAt: string;
};
