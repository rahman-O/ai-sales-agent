# Multi-Business Platform — Mind Map

> Visual map of the entire platform surface. Items marked ✅ exist today; items marked 🔮 are future phases.

---

## System Overview

```mermaid
mindmap
  root((Multi-Business<br/>AI Sales Platform))
    Organization
      ✅ Profile Name
      🔮 Business Type
      🔮 Description & Branding
      🔮 Capabilities
      ✅ Team / Members
      ✅ Locations
      🔮 Onboarding State
    Business Data
      ✅ Services / Catalog
      🔮 Products
      🔮 Listings
      🔮 Packages
      🔮 Offers / Promotions
      🔮 Business Policies
      ✅ Pricing
      🔮 Inventory
    AI Layer
      ✅ Context Builder
      ✅ Working State
      🔮 Dynamic Intent Detection
      🔮 Conversation Style Profile
      ✅ Knowledge / RAG
      ✅ Tool Authorization
      ✅ Orchestrator
      ✅ Model Provider
    Workflows
      ✅ Leads
      ✅ Booking
      🔮 Orders
      🔮 Quotes
      ✅ Follow-ups
      ✅ Handoff to Human
      🔮 Generic Workflow Registry
    Channels
      ✅ WhatsApp
      🔮 Future Channels
    Dashboard
      ✅ Overview
      ✅ Conversations / Inbox
      ✅ Customers
      ✅ Leads
      ✅ Bookings
      🔮 Orders
      🔮 Catalog Management
      🔮 Offers Management
      ✅ Knowledge
      🔮 AI Settings
      ✅ Analytics
      ✅ Follow-ups
      🔮 Dynamic Navigation
    Security
      ✅ Multi-tenancy
      ✅ RLS
      ✅ Tool Authorization
      ✅ Human Takeover
      ✅ Kill Switch
      ✅ Idempotency
      ✅ Audit Logging
    Observability
      ✅ Agent Runs
      ✅ Tool Calls
      ✅ Usage Events
      🔮 Error Dashboard
      ✅ Audit Logs
```

---

## Capability-Driven Architecture Map

```mermaid
graph TB
    subgraph Core["Core Agent Engine ✅"]
        ORC["Orchestrator"]
        CTX["Context Builder"]
        WS["Working State"]
        TE["Tool Executor"]
    end

    subgraph Config["Organization Configuration 🔮"]
        PROF["Organization Profile"]
        CAP["Capabilities"]
        STYLE["Conversation Style"]
        POL["Business Policies"]
    end

    subgraph Data["Business Data"]
        CAT["Catalog ✅→🔮"]
        OFFER["Offers 🔮"]
        KNOW["Knowledge ✅"]
        STAFF["Staff ✅"]
        LOC["Locations ✅"]
    end

    subgraph Workflows["Workflows"]
        BOOK["Booking ✅"]
        LEAD["Leads ✅"]
        ORDER["Orders 🔮"]
        QUOTE["Quotes 🔮"]
        FU["Follow-ups ✅"]
        HO["Handoff ✅"]
    end

    subgraph Channels["Channels"]
        WA["WhatsApp ✅"]
        FUTURE["Future 🔮"]
    end

    Config --> CTX
    Config --> TE
    CTX --> ORC
    TE --> ORC
    WS --> ORC
    Data --> CTX
    Data --> TE
    Workflows --> TE
    ORC --> Channels
```

---

## Module Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Exists and is production-proven |
| 🔮 | Future phase — planned but not implemented |
| ✅→🔮 | Exists but requires generalization |
