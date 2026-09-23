# Domain model

```mermaid
erDiagram
  User ||--o{ OrganizationMember : joins
  Organization ||--o{ OrganizationMember : grants
  Organization ||--o{ Customer : owns
  Customer ||--o{ CustomerIdentity : identifies
  ChannelConnection ||--o{ Conversation : carries
  Customer ||--o{ Conversation : participates
  Conversation ||--o{ Message : orders
  Customer ||--o{ Lead : pursues
  Lead ||--o{ Booking : converts
  Service ||--o{ Booking : specifies
  StaffMember ||--o{ Booking : fulfills
  Conversation ||--o{ AgentRun : processes
  AgentRun ||--o{ ToolCall : requests
  KnowledgeDocument ||--o{ KnowledgeChunk : versions
```

Every domain relationship above except global user identity is scoped by organization. Diagram omits infrastructure records and optional relationships for readability; [entity catalog](entities.md) defines them. A booking may be entered manually without a lead, but attribution must then be explicitly unassigned.

Conversation ownership, lead stage, booking status and message delivery are separate state machines. Do not overload a single status field to represent them. A customer can have multiple historical opportunities and bookings without duplicating their contact record.
