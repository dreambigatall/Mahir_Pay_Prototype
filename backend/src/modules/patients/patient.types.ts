export type Sex = "female" | "male" | "intersex" | "unknown";
export type AllergySeverity = "mild" | "moderate" | "severe";

export type Allergy = {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  recorded_at: Date;
};

export type Patient = {
  id: string;
  medical_record_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  blood_group: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  allergies: Allergy[];
};

export type PatientWrite = {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  allergies: Array<{ allergen: string; reaction?: string; severity?: AllergySeverity }>;
};
