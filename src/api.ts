export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + url, {
    method,
    credentials: "same-origin",
    headers: {
      "X-Smriti-Client": "1",
      ...(body === undefined || body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.error || "Please try again.", response.status);
  return result;
}
export type User = {
  id: string;
  email: string;
  role: "patient" | "caregiver";
  email_verified: boolean;
};
export type Profile = {
  id: string;
  role: string;
  key: Uint8Array<ArrayBuffer>;
  name: string;
  dob: string;
  relationship: string;
  language: "en" | "hi";
  emergencyName: string;
  emergencyPhone: string;
  timezone: string;
  notes: string;
  cultureEnabled?: boolean;
  cultureRegion?: string;
  cultureLanguage?: string;
  caregiverName?: string;
  caregiverPhone?: string;
};
export type CareRecord = {
  id: string;
  version: number;
  created_at: string;
  photo_id?: string;
  [key: string]: any;
};
