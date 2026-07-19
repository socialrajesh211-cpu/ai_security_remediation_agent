import { Finding } from "../types";
import { Audience, AUDIENCE_HINTS } from "./system.prompt";

export function buildAnalysisPrompt(finding: Finding, audience: Audience = "senior"): string {
  return `Analyze this vulnerability.

Return JSON:
{
  "shortSummary":"",
  "rootCause":"",
  "whyVulnerable":"",
  "attackExample":"",
  "owaspCategory":"",
  "businessImpact":"",
  "likelihood":"low",
  "exploitability":"low",
  "priority":"medium",
  "recommendation":"",
  "confidence":95
}

"shortSummary" rules — read carefully:
- Plain English, one line, no jargon, no CWE/CVE codes, no trailing period.
- HARD LIMIT: 50 characters maximum. Use as few words as possible while still being understandable on its own.
- It must let someone grasp the issue at a glance without reading anything else.
- Example style: "SQL query built from raw user input".

All other fields: explain for ${AUDIENCE_HINTS[audience]}.

Title:
${finding.title}

Severity:
${finding.severity}

CWE:
${finding.cwe ?? "unknown"}

File:
${finding.file}

Lines:
${finding.startLine}-${finding.endLine}

Description:
${finding.description}

Code:

${finding.codeSnippet}
`;
}
