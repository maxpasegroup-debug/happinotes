# Security Incident Response SOP

**Internal draft — assign named roles and approve operational contacts before use.**

1. **Detect and report:** staff report suspected exposure, account compromise, lost credentials, vendor incident or deletion failure to the designated security lead. Owner must name this role and an alternate.
2. **Triage:** preserve relevant timestamps and minimal evidence; identify systems, data categories, affected accounts, providers, duration and ongoing risk. Restrict access to evidence.
3. **Contain:** revoke exposed credentials/tokens, isolate affected components, suspend unsafe processing where appropriate, and contact relevant providers. Do not destroy evidence.
4. **Assess:** security lead and counsel assess affected persons, jurisdiction, contractual duties, regulator/user notices and required timing. Do not invent a notification deadline.
5. **Notify and remediate:** send notices through an approved channel when required; document decision and rationale; rotate credentials, patch, restore safely and provide user support.
6. **Close:** maintain a restricted incident record with actions, decisions, approvals and lessons. Keep evidence only for an approved period.

The repository includes logging and authentication code but no complete incident register, named response team, vendor escalation list, breach decision tree, or evidence of drills. Populate these from actual production/provider arrangements and applicable law. This is a procedure draft, not proof of preparedness.
