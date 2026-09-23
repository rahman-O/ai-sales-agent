# Environments

Local uses fake providers and seeded synthetic tenants. CI uses ephemeral databases/Redis and deterministic fixtures. Staging has separate provider test accounts, secrets and storage; production contains real customer data only after release gates. Never copy raw production conversations into developer environments.

Each environment has explicit region, database role, storage bucket, queue prefix, channel credential and approved model profile. Validate configuration on startup and refuse production mode with fake credentials, missing encryption keys or unsafe debug logging. Separate migration and runtime credentials.

P00 selects hosting/identity/model vendors and data region; P01 locks compatible toolchain versions. Environment promotion uses the same built image with environment-specific secret references. Staging must exercise extension/RLS behavior equivalent to production; SQLite is not an isolation/booking test substitute.
