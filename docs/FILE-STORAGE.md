# Private file storage and malware scanning

ERP files are private objects. The browser never receives AWS credentials and the bucket is not intended to be public.

## Upload flow
1. An authenticated user requests an upload intent with a declared purpose, file name, MIME type and byte size.
2. The API checks purpose-specific RBAC, MIME allowlists, extensions and maximum size.
3. The API creates a tenant-scoped `FileAsset` and issues a five-minute S3 presigned POST.
4. The POST policy fixes object key, MIME metadata and enforces a `content-length-range` condition.
5. The browser uploads directly to S3-compatible object storage.
6. The confirmation endpoint uses `HeadObject` to verify actual byte length, content type and signed tenant/asset metadata.
7. The file enters `PENDING` malware scan state and is inaccessible for download.
8. BullMQ sends a `file-scan` job to the worker. The worker streams the private object to ClamAV using `INSTREAM` and reports CLEAN/INFECTED/ERROR through a secret internal API callback.
9. Only CLEAN files move to `READY`. Infected objects are deleted. Download endpoints issue five-minute signed GET URLs only for READY files.

## Production configuration
- `S3_BUCKET`, `S3_REGION` and standard AWS credentials (or workload identity) are required.
- `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` support compatible private stores such as MinIO-style deployments.
- `FILE_SCAN_MODE=required` is mandatory in production.
- `CLAMAV_HOST`/`CLAMAV_PORT` are configured on the worker.
- `WORKER_CALLBACK_SECRET` must be a high-entropy deployment secret shared only by API and worker.
- Bucket CORS should allow only the school web origins and the required POST/GET headers.

S3 presigned access is time-limited and inherits the permissions of the signing identity. File-size constraints are enforced at the POST policy and verified again using object metadata before scanning.
