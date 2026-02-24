export type Audience = "self" | "team" | "public";
export type OutputFormat = "checklist" | "paragraph" | "table" | "json";

export interface IntentSpec {
  goalText: string;
  goalFraming?: string;
  audience: Audience;
  outputFormat: OutputFormat;
  constraints: string[];
  successCriteria: string[];
  version: number;
}

export const defaultIntentSpec: IntentSpec = {
  goalText: "",
  audience: "self",
  outputFormat: "paragraph",
  constraints: [],
  successCriteria: [],
  version: 0,
};
