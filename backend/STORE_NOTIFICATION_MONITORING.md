# Store notification monitoring on Railway

The API emits aggregate-only deployment log markers; it does not send email,
Slack, or webhook alerts itself.

## Railway log searches

In the HappiNotes Railway project, select the **production** environment and
open **Observability → Logs**. Select the HappiNotes API service and search
these filters separately:

```text
"store_notification_inbox_attention_required"
```

```text
"store_notification_inbox_monitor_failed"
```

The first marker includes only the aggregate number of blocked inbox events and
unmatched events older than one hour. The second means the monitoring query
could not run. Neither marker contains transaction keys, event IDs, tokens, or
provider payloads.

The Google linked-account reconciliation path also uses a short MongoDB
transaction to fence the lease, transaction ledger update, and User entitlement
update together. The production `MONGODB_URI` must target a MongoDB replica set
or sharded cluster with transaction support. Standalone MongoDB does not
support transactions; in that configuration linked Google notification
processing fails with a retryable response and does not acknowledge the event.
No new environment variable is introduced.

For a combined search, use:

```text
"store_notification_inbox_attention_required" OR "store_notification_inbox_monitor_failed"
```

Save a Logs widget in the production Observability dashboard with this combined
filter so the markers are visible in one place.

## Notifications and alerting limitation

Railway's documented built-in Observability monitors send email/in-app or
webhook notifications for CPU, RAM, disk usage, and network egress thresholds.
They do not document log-query matching as a monitor trigger. Therefore, a Logs
widget/search is visibility, not a notification alert, and this repository does
not claim that alerts are configured.

To receive a notification when either marker appears, forward the API service's
stdout/stderr to an external log monitoring service and create two message-match
alerts using the exact filters above. Confirm that the receiver is configured
for both markers and test each rule during the later authorized verification
stage. Keep alert payloads restricted to the marker and aggregate counts.

Railway documentation:

- Logs and filter syntax: <https://docs.railway.com/observability/logs>
- Observability monitors and their supported resource thresholds:
  <https://docs.railway.com/observability>
