import { FhirResource } from "@/features/clinical/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function firstCoding(value: unknown) {
  const coding = asArray<Record<string, unknown>>(asRecord(value).coding);
  const first = coding[0] ?? {};
  return {
    display: typeof first.display === "string" ? first.display : null,
    code: typeof first.code === "string" ? first.code : null,
  };
}

function humanName(value: unknown) {
  const names = asArray<Record<string, unknown>>(value);
  const first = names[0] ?? {};
  const text = typeof first.text === "string" ? first.text : null;
  if (text) return text;

  const given = asArray<string>(first.given)
    .filter((part) => typeof part === "string")
    .join(" ");
  const family = typeof first.family === "string" ? first.family : "";
  const combined = `${given} ${family}`.trim();
  return combined || null;
}

function referenceString(value: unknown) {
  const record = asRecord(value);
  return typeof record.reference === "string" ? record.reference : null;
}

function quantityString(value: unknown) {
  const quantity = asRecord(value);
  if (typeof quantity.value !== "number") return null;
  const unit = typeof quantity.unit === "string" ? ` ${quantity.unit}` : "";
  return `${quantity.value}${unit}`;
}

export function clinicalBlockForFhirResource(resource: FhirResource) {
  const header = [resource.resourceType ?? "Resource", resource.id].filter(Boolean).join("/");

  if (resource.resourceType === "Observation") {
    const code = firstCoding(resource.code);
    const category = firstCoding(asArray(resource.category)[0]);
    const value =
      quantityString(resource.valueQuantity) ||
      (typeof resource.valueString === "string" ? resource.valueString : null) ||
      (typeof resource.valueInteger === "number" ? String(resource.valueInteger) : null) ||
      (typeof resource.valueBoolean === "boolean" ? (resource.valueBoolean ? "Yes" : "No") : null) ||
      firstCoding(resource.valueCodeableConcept).display ||
      firstCoding(resource.valueCodeableConcept).code;

    return [
      `### FHIR Resource: ${header}`,
      "- Type: Observation",
      `- Test: ${code.display ?? code.code ?? "Not provided"}`,
      `- Result: ${value ?? "Not provided"}`,
      `- Status: ${typeof resource.status === "string" ? resource.status : "Not provided"}`,
      `- Category: ${category.display ?? category.code ?? "Not provided"}`,
      `- Observed at: ${typeof resource.effectiveDateTime === "string" ? resource.effectiveDateTime : "Not provided"}`,
      `- Patient reference: ${referenceString(resource.subject) ?? "Not provided"}`,
      `- Encounter reference: ${referenceString(resource.encounter) ?? "Not provided"}`,
    ].join("\n");
  }

  if (resource.resourceType === "Condition") {
    const code = firstCoding(resource.code);
    const clinical = firstCoding(resource.clinicalStatus);
    const verification = firstCoding(resource.verificationStatus);

    return [
      `### FHIR Resource: ${header}`,
      "- Type: Condition",
      `- Condition: ${code.display ?? code.code ?? "Not provided"}`,
      `- Clinical status: ${clinical.display ?? clinical.code ?? "Not provided"}`,
      `- Verification status: ${verification.display ?? verification.code ?? "Not provided"}`,
      `- Onset: ${typeof resource.onsetDateTime === "string" ? resource.onsetDateTime : "Not provided"}`,
      `- Recorded date: ${typeof resource.recordedDate === "string" ? resource.recordedDate : "Not provided"}`,
      `- Patient reference: ${referenceString(resource.subject) ?? "Not provided"}`,
    ].join("\n");
  }

  if (resource.resourceType === "Patient") {
    const identifiers = asArray<Record<string, unknown>>(resource.identifier)
      .map((item) => (typeof item.value === "string" ? item.value : null))
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
      .join(", ");

    return [
      `### FHIR Resource: ${header}`,
      "- Type: Patient",
      `- Name: ${humanName(resource.name) ?? "Not provided"}`,
      `- Gender: ${typeof resource.gender === "string" ? resource.gender : "Not provided"}`,
      `- Date of birth: ${typeof resource.birthDate === "string" ? resource.birthDate : "Not provided"}`,
      `- Identifiers: ${identifiers || "Not provided"}`,
    ].join("\n");
  }

  return [
    `### FHIR Resource: ${header}`,
    `- Type: ${resource.resourceType ?? "Unknown"}`,
    `- Status: ${typeof resource.status === "string" ? resource.status : "Not provided"}`,
    `- Last updated: ${typeof asRecord(resource.meta).lastUpdated === "string" ? asRecord(resource.meta).lastUpdated : "Not provided"}`,
  ].join("\n");
}
