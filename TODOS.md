# TODOs

## Add native chat platform integration

What:
Add first-class integration with one chat platform such as Feishu, WeCom, or Slack.

Why:
The current first version uses a web app with manual message paste-in. That is the right scope for validating the core product logic, but it adds friction and loses real-time context.

Pros:
- Reduces copy-paste friction for the subordinate
- Makes the product part of the real daily workflow
- Enables more realistic follow-up and proactive reporting behavior

Cons:
- Introduces platform auth, permissions, webhook/event handling, retry behavior, and message-format edge cases
- Risks dragging integration complexity into the first version before the core `WorkItem` model is stable

Context:
The engineering review locked first version scope to a web app with manual manager-message intake. That keeps the core architecture focused on the actual product heart: `WorkItem` creation, boundary judgment, follow-up persistence, and report aggregation. Native platform integration should happen only after those foundations are stable and tested.

Depends on / blocked by:
- Stable `WorkItem` schema
- Stable analysis pipeline
- Stable tracking persistence
- Clear decision on which chat platform matters first
