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

export type LabStatus = "requested" | "in-progress" | "result-ready";
export type LabUrgency = "routine" | "urgent";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "pending-credit";
export type CatalogType = "consultation" | "lab_test" | "drug";

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
  waitMinutes: number;
  createdAt: string;
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
