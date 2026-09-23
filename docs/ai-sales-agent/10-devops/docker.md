# Container plan

Create separate web/API/worker image targets from one versioned workspace. Multi-stage builds install locked dependencies and copy only runtime artifacts. Run as non-root, use read-only filesystem where practical, limit resources, and never bake secrets into layers or build arguments.

Local compose services supply PostgreSQL/Redis and optional storage emulation with persistent named volumes. Pin image versions and document extension availability. Health checks distinguish process liveness from dependency readiness; worker readiness includes ability to claim work, not empty queue length.

Graceful shutdown stops accepting new jobs, renews active leases while draining up to a bounded deadline, then releases or lets leases expire safely. Outbound attempts interrupted during I/O become reconciliation candidates. Migrations run as a separate controlled job, not in every container startup.

CI scans built images and tests the production start command. No Kubernetes requirement is introduced; a managed container service or small container host is sufficient for pilot.
