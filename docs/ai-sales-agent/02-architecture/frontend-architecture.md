# Frontend architecture

Next.js and TypeScript provide the staff shell; shadcn/ui provides accessible primitives. TanStack Query owns server-state fetch/mutation caching. Keep local draft input separate from server state and never treat optimistic booking success as committed truth.

Use a same-origin API proxy/BFF for secure session cookies, CSRF validation and API forwarding; NestJS remains the authorization authority. Do not create a second business-command implementation in Next.js actions. Organization switching cancels in-flight queries, closes subscriptions and clears tenant-specific caches. Query keys include organization ID and filters.

Choose server-sent events for inbox notifications with authenticated reconnect cursors; events prompt scoped refetch rather than serving as the durable message store. If events expire, refetch with pagination. Polling is an acceptable fallback. No bearer tokens in event URLs.

Build the minimum operator inbox during P03/P09; P11 completes the required MVP views and dashboard. English/Arabic labels, RTL layout, keyboard interaction, visible timezones, and status/error states are acceptance concerns. [Frontend information architecture](../08-frontend/information-architecture.md) owns screens.
