"""Validate the planning package, not the unimplemented application.

Run from any directory: python <path-to-this-file>
Uses only the Python standard library.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
BASELINE = {
    '00-overview': 'vision problem-statement product-scope goals-and-non-goals terminology assumptions',
    '01-mind-map': 'system-mind-map product-capabilities user-journeys dependency-map',
    '02-architecture': 'system-context container-architecture backend-architecture frontend-architecture agent-architecture messaging-architecture data-architecture queue-architecture rag-architecture multi-tenancy security-architecture observability',
    '03-domain': 'domain-model entities aggregates value-objects domain-events conversation-state-machine lead-state-machine booking-state-machine',
    '04-agent': 'agent-runtime context-builder memory-strategy tool-registry tool-contracts tool-execution-loop guardrails prompt-strategy model-provider-abstraction failure-handling evaluation-strategy',
    '05-integrations': 'whatsapp messaging-channel-contract webhooks calendar-booking storage future-integrations',
    '06-data': 'database-design prisma-model-plan indexing-strategy tenant-isolation idempotency audit-log retention-policy migration-strategy',
    '07-api': 'api-principles auth-api organization-api conversation-api customer-api lead-api booking-api knowledge-api agent-api webhook-api',
    '08-frontend': 'information-architecture dashboard conversations leads bookings knowledge-base agent-settings organization-settings analytics',
    '09-testing': 'testing-strategy unit-tests integration-tests e2e-tests agent-evaluation tool-tests webhook-tests security-tests load-tests',
    '10-devops': 'environments local-development docker ci-cd secrets deployment monitoring backup-and-recovery',
    '11-product-metrics': 'metrics-model funnel usage-metrics ai-cost-metrics business-outcomes',
    '12-decisions': 'README ADR-template',
    '13-risks': 'technical-risks product-risks ai-risks integration-risks risk-register',
    '14-roadmap': 'README master-plan phase-00-discovery phase-01-foundation phase-02-core-domain phase-03-conversations phase-04-agent-core phase-05-knowledge-rag phase-06-leads-crm phase-07-booking-tools phase-08-whatsapp phase-09-human-handoff phase-10-followups phase-11-dashboard phase-12-analytics phase-13-hardening phase-14-pilot-readiness future-roadmap',
}
HEADINGS = [
    'Objective', 'Why This Phase Exists', 'Entry Criteria', 'Scope',
    'Out of Scope', 'Architecture Impact', 'Files / Modules Expected',
    'Data Model Changes', 'APIs', 'Business Rules', 'Implementation Tasks',
    'Testing Requirements', 'Observability Requirements',
    'Security Considerations', 'Acceptance Criteria', 'Exit Criteria',
    'Dependencies', 'Risks', 'Deliverables',
]
errors = []
expected = {'README.md'} | {
    f'{folder}/{name}.md' for folder, names in BASELINE.items() for name in names.split()
}
for relative in sorted(expected):
    if not (ROOT / relative).is_file():
        errors.append(f'Missing baseline document: {relative}')
files = sorted(ROOT.rglob('*.md'))
roadmap_phase_files = {
    name + '.md' for name in BASELINE['14-roadmap'].split()
    if re.fullmatch(r'phase-\d{2}-.+', name)
}
links = diagrams = words = 0
task_ids = []
for path in files:
    body = path.read_text(encoding='utf-8')
    relative = path.relative_to(ROOT)
    words += len(body.split())
    if not body.startswith('# '):
        errors.append(f'Missing title: {relative}')
    if len(re.findall(r'^```', body, re.M)) % 2:
        errors.append(f'Unbalanced fenced blocks: {relative}')
    diagrams += len(re.findall(r'^```mermaid$', body, re.M))
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', body):
        if re.match(r'^(https?://|mailto:|#)', target):
            continue
        links += 1
        target = target.split('#', 1)[0].strip('<>')
        resolved = (path.parent / target).resolve()
        if not resolved.exists():
            errors.append(f'Broken link: {relative} -> {target}')
    if path.name in roadmap_phase_files:
        found = re.findall(r'^## (\d+)\. (.+)$', body, re.M)
        if found != [(str(i), title) for i, title in enumerate(HEADINGS, 1)]:
            errors.append(f'Invalid nineteen-section structure: {relative}')
        phase = path.name[6:8]
        ids = re.findall(r'^- \[ \] (P\d{2}-T\d{3}):', body, re.M)
        if len(ids) != 6 or any(not x.startswith('P' + phase + '-') for x in ids):
            errors.append(f'Invalid task IDs: {relative}')
        task_ids.extend(ids)
        allowed_phase_status = ('Status: NOT STARTED.' in body or
                                (path.name == 'phase-00-discovery.md' and
                                 'Status: IN REVIEW — BLOCKED.' in body))
        if not allowed_phase_status or '- [x]' in body.lower():
            errors.append(f'Unexpected implementation completion claim: {relative}')
        acceptance = body.split('## 15. Acceptance Criteria\n', 1)[-1].split('## 16.', 1)[0]
        if acceptance.count('- [ ]') < 4:
            errors.append(f'Insufficient acceptance checks: {relative}')
if len(task_ids) != len(set(task_ids)):
    errors.append('Duplicate task IDs')
mindmap = (ROOT / '01-mind-map/system-mind-map.md').read_text(encoding='utf-8')
for branch in ['Users', 'Organizations', 'Channels', 'Conversations', 'Customers',
               'Leads', 'AI Agent', 'Memory', 'Knowledge', 'Tools', 'Booking',
               'Human Handoff', 'Follow-Ups', 'Analytics', 'Infrastructure',
               'Security', 'Observability', 'Integrations']:
    if not re.search(r'^    ' + re.escape(branch) + r'$', mindmap, re.M):
        errors.append('Missing mind map branch: ' + branch)
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'PASS: {len(expected)} baseline documents; {len(files)} Markdown documents; '
      f'{len(task_ids)} unique phase tasks; {links} valid local links; '
      f'{diagrams} balanced Mermaid blocks; {words} words.')
print('Structural checks only: application tests and rendered Mermaid validation are not performed.')
