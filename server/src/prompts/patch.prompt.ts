import { Finding } from "../types";

export function buildPatchPrompt(finding: Finding): string {
  return `Generate a secure fix.

Return JSON:
{
  "patchedCode":"",
  "explanation":"",
  "confidence":95,
  "testsRecommended":true
}

The explanation should describe *why* the fix prevents the vulnerability, in plain terms, not just "changed line X".

Finding

Title:
${finding.title}

Severity:
${finding.severity}

CWE:
${finding.cwe ?? "unknown"}

File:
${finding.file}

Code:

${finding.codeSnippet}
`;
}
