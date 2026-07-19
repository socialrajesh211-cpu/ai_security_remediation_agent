import { Finding, Patch } from "../types";

export function buildPullRequestPrompt(finding: Finding, patch: Patch): string {
  return `Create a GitHub Pull Request.

Return JSON:
{
  "title":"",
  "shortSummary":"",
  "description":""
}

"shortSummary" rules — read carefully:
- Plain English, one line, no jargon, no trailing period.
- HARD LIMIT: 50 characters maximum. Use as few words as possible while still being understandable on its own.
- Describes what the fix does, e.g. "Parameterize SQL query to stop injection".

"description" rules:
- Markdown, sections: Summary, Vulnerability, Fix, Testing.
- Be as minimal as possible while still giving a reviewer enough to approve confidently — short bullets over long prose, no filler sentences.

Finding

Title:
${finding.title}

Severity:
${finding.severity}

CWE:
${finding.cwe ?? "unknown"}

File:
${finding.file}

Fix:

${patch.explanation}
`;
}
