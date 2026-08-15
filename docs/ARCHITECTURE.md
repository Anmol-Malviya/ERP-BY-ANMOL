# Architecture

```text
School Browser -> apps/web ---------+
                                    +--> apps/api --> MongoDB
Platform Browser -> super-admin ----+       |
                                            +--> Redis/BullMQ --> apps/worker
```

ERP BY ANMOL V2 is a modular monolith with separate front-end trust surfaces.

## Tenant isolation
School-owned schemas use a Mongoose tenant plugin backed by AsyncLocalStorage request context. Reads, writes and aggregates automatically apply `schoolId`. Client-supplied tenant IDs are never authoritative.

## Scaling
Scale stateless API instances horizontally, use MongoDB indexes/pooling, Redis queues/cache and dedicated workers. Extract only proven hotspots later.
