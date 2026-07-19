import { Schema, model, Document } from "mongoose";
import { Severity } from "../types";

export interface FindingDocument extends Document {
  findingId: string;
  repoFullName: string; // "owner/repo"
  title: string;
  severity: Severity;
  cve?: string;
  cwe?: string;
  description: string;
  file: string;
  startLine: number;
  endLine: number;
  source: "codeql" | "dependabot" | "semgrep" | "sarif";
  codeSnippet: string;
  scannedAt: Date;
}

const findingSchema = new Schema<FindingDocument>({
  findingId: { type: String, required: true },
  repoFullName: { type: String, required: true, index: true },
  title: { type: String, required: true },
  severity: { type: String, enum: ["critical", "high", "medium", "low"], required: true },
  cve: { type: String },
  cwe: { type: String },
  description: { type: String, default: "", maxlength: 2_000 },
  file: { type: String, required: true },
  startLine: { type: Number, default: 1 },
  endLine: { type: Number, default: 1 },
  source: { type: String, enum: ["codeql", "dependabot", "semgrep", "sarif"], required: true },
  codeSnippet: { type: String, default: "", maxlength: 8_000 },
  scannedAt: { type: Date, default: () => new Date() },
});

findingSchema.index({ repoFullName: 1, findingId: 1 }, { unique: true });

export const FindingModel = model<FindingDocument>("Finding", findingSchema);
