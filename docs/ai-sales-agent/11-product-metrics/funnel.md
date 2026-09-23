# Funnel definitions and attribution

Conversation → Lead → Qualified Lead → Booking → Attendance → Revenue.

Eligible conversation denominator: distinct conversations with at least one valid customer inbound message during cohort period; exclude sandbox/spam according to a recorded rule. Lead rate: distinct eligible conversations with at least one linked lead / eligible conversations. Qualification rate: distinct qualified leads / created leads in the lead cohort. Booking rate: distinct leads with a confirmed booking / qualified leads in that cohort; also report unqualified/manual bookings separately rather than forcing them into this denominator.

Attendance rate: completed appointments / appointments due in the observation window, with cancelled and pending outcomes reported separately and the denominator definition displayed. Revenue attaches only to verified RevenueRecord, not appointment price. Multiple bookings per lead must not multiply the lead-level conversion rate.

Default attribution: persist source conversation on lead creation, link booking to that lead when the command commits, and freeze origin unless an audited correction occurs. Attribute assisted conversion only when a linked AgentRun/action exists; distinguish human-only and mixed assistance. Use a 30-day observation window initially and show immature cohorts.

Cross-device identity merges or last-touch marketing attribution are deferred. No causal claim that AI increased revenue follows from simple funnel counts; compare against the discovery baseline with caveats.
