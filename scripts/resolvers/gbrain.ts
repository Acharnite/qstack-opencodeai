/**
 * GBrain resolver — brain-first lookup and save-to-brain for thinking skills.
 *
 * GBrain is a "mod" for gstack. When installed, coding skills become brain-aware:
 * they search the brain for context before starting and save results after finishing.
 *
 * These resolvers are suppressed on hosts that don't support brain features
 * (via suppressedResolvers in each host config). For those hosts,
 * {{GBRAIN_CONTEXT_LOAD}} and {{GBRAIN_SAVE_RESULTS}} resolve to empty string.
 *
 * Compatible with GBrain >= v0.10.0 (search CLI, doctor --fast --json, entity enrichment).
 */
import type { TemplateContext } from './types';

export function generateGBrainContextLoad(ctx: TemplateContext): string {
  let base = `## Brain Context Load

Before starting this skill, search your brain for relevant context:

1. Extract 2-4 keywords from the user's request (nouns, error names, file paths, technical terms).
   Search GBrain: \`gbrain search "keyword1 keyword2"\`
   Example: for "the login page is broken after deploy", search \`gbrain search "login broken deploy"\`
   Search returns lines like: \`[slug] Title (score: 0.85) - first line of content...\`
2. If few results, broaden to the single most specific keyword and search again.
3. For each result page, read it: \`gbrain get "<page_slug>"\`
   Read the top 3 pages for context.
4. Use this brain context to inform your analysis.

If GBrain is not available or returns no results, proceed without brain context.
Any non-zero exit code from gbrain commands should be treated as a transient failure.`;

  if (ctx.skillName === 'investigate') {
    base += `\n\nIf the user's request is about tracking, extracting, or researching structured data (e.g., "track this data", "extract from emails", "build a tracker"), route to GBrain's data-research skill instead: \`gbrain call data-research\`. This skill has a 7-phase pipeline optimized for structured data extraction.`;
  }

  return base;
}

export function generateGBrainSaveResults(ctx: TemplateContext): string {
  const skillSaveMap: Record<string, string> = {
    'office-hours': 'Save the design document as a brain page:\n```bash\n_SLUG="office-hours-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Office Hours: <project name>"\ntags: [design-doc, <project-slug>]\n---\n<design doc content in markdown>\nGBEOF\n```',
    'investigate': 'Save the root cause analysis as a brain page:\n```bash\n_SLUG="investigation-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Investigation: <issue summary>"\ntags: [investigation, <affected-files>]\n---\n<investigation findings in markdown>\nGBEOF\n```',
    'plan-ceo-review': 'Save the CEO plan as a brain page:\n```bash\n_SLUG="ceo-plan-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "CEO Plan: <feature name>"\ntags: [ceo-plan, <feature-slug>]\n---\n<scope decisions and vision in markdown>\nGBEOF\n```',
    'retro': 'Save the retrospective as a brain page:\n```bash\n_SLUG="retro-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Retro: <date range>"\ntags: [retro, <date>]\n---\n<retro output in markdown>\nGBEOF\n```',
    'plan-eng-review': 'Save the architecture decisions as a brain page:\n```bash\n_SLUG="eng-review-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Eng Review: <feature name>"\ntags: [eng-review, <feature-slug>]\n---\n<review findings and decisions in markdown>\nGBEOF\n```',
    'ship': 'Save the release notes as a brain page:\n```bash\n_SLUG="release-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Release: <version>"\ntags: [release, <version>]\n---\n<changelog entry and deploy details in markdown>\nGBEOF\n```',
    'cso': 'Save the security audit as a brain page:\n```bash\n_SLUG="security-audit-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Security Audit: <date>"\ntags: [security-audit, <date>]\n---\n<findings and remediation status in markdown>\nGBEOF\n```',
    'design-consultation': 'Save the design system as a brain page:\n```bash\n_SLUG="design-system-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "Design System: <project name>"\ntags: [design-system, <project-slug>]\n---\n<design decisions in markdown>\nGBEOF\n```',
  };

  const saveInstruction = skillSaveMap[ctx.skillName] || 'Save the skill output as a brain page if the results are worth preserving:\n```bash\n_SLUG="skill-output-$(date +%Y%m%d)-${SLUG:-unknown}"\ngbrain put "$_SLUG" <<GBEOF\n---\ntitle: "<descriptive title>"\ntags: [<relevant, tags>]\n---\n<content in markdown>\nGBEOF\n```';

  return `## Save Results to Brain

After completing this skill, persist the results to your brain for future reference:

${saveInstruction}

After saving the page, extract and enrich mentioned entities: for each actual person name or company/organization name found in the output, \`gbrain search "<entity name>"\` to check if a page exists. If not, create a stub page:
\`\`\`bash
ENTITY_SLUG=$(echo "<Person or Company Name>" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-')
gbrain put "$ENTITY_SLUG" <<GBEOF
---
title: "<Person or Company Name>"
tags: [entity, person]
---
Stub page. Mentioned in <skill name> output.
GBEOF
\`\`\`
Only extract actual person names and company/organization names. Skip product names, section headings, technical terms, and file paths.

Throttle errors appear as: exit code 1 with stderr containing "throttle", "rate limit", "capacity", or "busy". If GBrain returns a throttle or rate-limit error on any save operation, defer the save and move on. The brain is busy — the content is not lost, just not persisted this run. Any other non-zero exit code should also be treated as a transient failure.

Add backlinks to related brain pages if they exist. If GBrain is not available, skip this step.

After brain operations complete, note in your completion output: how many pages were found in the initial search, how many entities were enriched, and whether any operations were throttled. This helps the user see brain utilization over time.`;
}
