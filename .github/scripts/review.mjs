import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import { execSync } from 'child_process';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const diff = fs.readFileSync('pr.diff', 'utf8');
const prTitle = process.env.PR_TITLE || '';
const prBody = process.env.PR_BODY || '(no description)';
const prAuthor = process.env.PR_AUTHOR || '';
const prBase = process.env.PR_BASE || 'main';
const prHead = process.env.PR_HEAD || '';

// Truncate diff if too large (keep first 80k chars)
const MAX_DIFF = 80_000;
const truncated = diff.length > MAX_DIFF;
const diffContent = truncated
  ? diff.slice(0, MAX_DIFF) + '\n\n[...diff truncated — showing first 80k chars...]'
  : diff;

const systemPrompt = `You are an expert code reviewer for a Next.js / React / TypeScript project called UIGen — an AI-powered React component generator.

Your job is to review pull request diffs and produce:
1. A structured review with categorised findings
2. A single integer confidence score from 1–10 representing overall merge-readiness

Scoring guide:
- 9–10: Production-ready, clean, well-tested
- 7–8:  Good quality, minor issues only, safe to merge
- 5–6:  Notable issues that should be addressed before merging
- 3–4:  Significant problems — bugs, security issues, missing tests
- 1–2:  Critical issues — data loss risk, breaking changes, security vulnerabilities

Return your response as valid JSON matching this exact schema (no markdown fences, just raw JSON):
{
  "score": <integer 1-10>,
  "summary": "<2-3 sentence overall assessment>",
  "positives": ["<strength 1>", "<strength 2>"],
  "issues": [
    { "severity": "critical|major|minor|suggestion", "file": "<file:line or general>", "description": "<what and why>" }
  ],
  "security_concerns": ["<concern or empty array>"],
  "test_coverage": "<assessment of test coverage>",
  "recommendation": "approve|request_changes|comment"
}`;

const userMessage = `PR #${process.env.GITHUB_PR_NUMBER || ''}
Title: ${prTitle}
Author: ${prAuthor}
Branch: ${prHead} → ${prBase}
Description: ${prBody}

--- DIFF ---
${diffContent}`;

let parsed;
try {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].text.trim();
  // Strip markdown code fences if Claude adds them anyway
  const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  parsed = JSON.parse(jsonText);
} catch (err) {
  console.error('Failed to parse Claude response:', err);
  // Emit a safe fallback so the workflow doesn't crash silently
  parsed = {
    score: 5,
    summary: 'Review could not be completed due to a parsing error. Manual review required.',
    positives: [],
    issues: [{ severity: 'critical', file: 'general', description: 'Automated review failed — check workflow logs.' }],
    security_concerns: [],
    test_coverage: 'Unknown',
    recommendation: 'comment',
  };
}

const score = Math.max(1, Math.min(10, parseInt(parsed.score, 10)));
const scoreBar = '█'.repeat(score) + '░'.repeat(10 - score);
const scoreEmoji = score >= 7 ? '✅' : score >= 5 ? '⚠️' : '❌';
const recEmoji = { approve: '✅', request_changes: '🔴', comment: '💬' }[parsed.recommendation] ?? '💬';

const severityEmoji = { critical: '🔴', major: '🟠', minor: '🟡', suggestion: '💡' };

const issuesSection = parsed.issues.length === 0
  ? '_No issues found._'
  : parsed.issues.map(i =>
      `${severityEmoji[i.severity] ?? '•'} **[${i.severity.toUpperCase()}]** \`${i.file}\`\n  ${i.description}`
    ).join('\n\n');

const securitySection = parsed.security_concerns.length === 0
  ? '_No security concerns._'
  : parsed.security_concerns.map(c => `- ${c}`).join('\n');

const positivesSection = parsed.positives.length === 0
  ? '_None noted._'
  : parsed.positives.map(p => `- ${p}`).join('\n');

const mergeNote = score >= 7
  ? `> ✅ **This PR meets the confidence threshold (${score}/10 ≥ 7) and is eligible to merge.**`
  : `> ❌ **This PR does not meet the confidence threshold (${score}/10 < 7). Address the issues above before merging, or ask a maintainer to bypass.**`;

const body = `## 🤖 AI PR Review

${mergeNote}

---

### Confidence Score: ${score}/10  ${scoreEmoji}
\`${scoreBar}\`

**Recommendation:** ${recEmoji} ${parsed.recommendation.replace('_', ' ')}

---

### Summary
${parsed.summary}

---

### ✅ Positives
${positivesSection}

---

### 🔍 Issues Found
${issuesSection}

---

### 🔒 Security
${securitySection}

---

### 🧪 Test Coverage
${parsed.test_coverage}

---
<sub>Reviewed by Claude \`claude-sonnet-4-6\` · ${truncated ? '⚠️ diff was truncated · ' : ''}Score ≥ 7 required to merge</sub>`;

// Write outputs for subsequent workflow steps
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  const delimiter = 'EOF_REVIEW_BODY';
  fs.appendFileSync(outputFile, `score=${score}\n`);
  fs.appendFileSync(outputFile, `review_body<<${delimiter}\n${body}\n${delimiter}\n`);
} else {
  // Local test mode
  console.log('SCORE:', score);
  console.log(body);
}
