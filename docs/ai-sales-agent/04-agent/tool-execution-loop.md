# Tool execution loop

```mermaid
sequenceDiagram
  participant O as Orchestrator
  participant M as Model adapter
  participant T as Tool executor
  participant D as Domain and database
  O->>M: Bounded context and allowed schemas
  M-->>O: Structured tool request
  O->>T: Request plus server execution context
  T->>T: Validate schema and permissions
  T->>D: Check fence epoch and operation key
  D->>D: Validate and commit action audit result
  D-->>T: Committed result or typed error
  T-->>O: Normalized tool result
  O->>M: Result within remaining budget
  M-->>O: Final response
  O->>D: Recheck ownership and persist outbound intent
```

Read calls may be parallelized only when independent and within provider/tool concurrency limits. Mutations execute serially, never using speculative model arguments as state. If one call fails, return its typed error; do not reinterpret failure as success or silently skip a required action.

Exceeding loop limits terminates the run and escalates. Repeating identical failing tool input consumes budget and cannot trigger unbounded repair. A handoff call ends ordinary reply generation. Malformed tool names/arguments never reach handlers. Trace attempts separately from committed operations so retry volume remains observable.
