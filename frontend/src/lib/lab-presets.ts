export type LabTestPreset = {
  defaultUnit: string;
  referenceRange: string;
  presets: { label: string; value: string; flag: "normal" | "abnormal" }[];
};

export const LAB_TEST_PRESETS: Record<string, LabTestPreset> = {
  malaria: {
    defaultUnit: "",
    referenceRange: "Negative",
    presets: [
      { label: "Negative", value: "Negative", flag: "normal" },
      { label: "Positive (+)", value: "Positive (+)", flag: "abnormal" },
      { label: "Positive (++)", value: "Positive (++)", flag: "abnormal" },
    ],
  },
  glucose: {
    defaultUnit: "mmol/L",
    referenceRange: "3.9 – 5.6 mmol/L",
    presets: [
      { label: "4.8 (Normal)", value: "4.8", flag: "normal" },
      { label: "5.4 (Normal)", value: "5.4", flag: "normal" },
      { label: "6.8 (Elevated)", value: "6.8", flag: "abnormal" },
      { label: "8.5 (High)", value: "8.5", flag: "abnormal" },
    ],
  },
  fbc: {
    defaultUnit: "g/dL",
    referenceRange: "12.0 – 15.5 g/dL (Hb)",
    presets: [
      { label: "13.5 (Normal)", value: "13.5", flag: "normal" },
      { label: "11.2 (Mild Anaemia)", value: "11.2", flag: "abnormal" },
      { label: "9.0 (Moderate)", value: "9.0", flag: "abnormal" },
    ],
  },
  urinalysis: {
    defaultUnit: "",
    referenceRange: "Nil protein / Nil glucose",
    presets: [
      { label: "Normal (Nil)", value: "Normal / Nil", flag: "normal" },
      { label: "Protein (+)", value: "Protein (+)", flag: "abnormal" },
      { label: "Leukocytes (+)", value: "Leukocytes (+)", flag: "abnormal" },
      { label: "Glucose (+)", value: "Glucose (+)", flag: "abnormal" },
    ],
  },
  widal: {
    defaultUnit: "titre",
    referenceRange: "< 1:80 O & H",
    presets: [
      { label: "< 1:80 (Negative)", value: "< 1:80", flag: "normal" },
      { label: "1:160 (Positive)", value: "1:160", flag: "abnormal" },
      { label: "1:320 (High)", value: "1:320", flag: "abnormal" },
    ],
  },
  lipid: {
    defaultUnit: "mmol/L",
    referenceRange: "< 5.2 mmol/L (Total Chol)",
    presets: [
      { label: "4.4 (Desirable)", value: "4.4", flag: "normal" },
      { label: "5.6 (Borderline)", value: "5.6", flag: "abnormal" },
      { label: "6.8 (High)", value: "6.8", flag: "abnormal" },
    ],
  },
};

export function getPresetForTest(testName: string): LabTestPreset | null {
  const name = testName.toLowerCase();
  if (name.includes("malaria") || name.includes("rdt")) return LAB_TEST_PRESETS.malaria;
  if (name.includes("glucose") || name.includes("sugar") || name.includes("fbs")) return LAB_TEST_PRESETS.glucose;
  if (name.includes("blood count") || name.includes("fbc") || name.includes("cbc") || name.includes("hemoglobin") || name.includes("hb")) return LAB_TEST_PRESETS.fbc;
  if (name.includes("urine") || name.includes("urinalysis")) return LAB_TEST_PRESETS.urinalysis;
  if (name.includes("widal") || name.includes("typhoid")) return LAB_TEST_PRESETS.widal;
  if (name.includes("lipid") || name.includes("cholesterol")) return LAB_TEST_PRESETS.lipid;
  return null;
}
