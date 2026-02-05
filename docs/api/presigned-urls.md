# Presigned URL API

## Meta
- **Purpose**: Document presigned URL generation and validation rules.
- **Inputs**: Object keys, content types (PUT), expiry timestamps, signatures.
- **Outputs**: Signed upload/download URLs with expiration timestamps.
- **Invariants**: HMAC-SHA256 signatures; expired/tampered URLs are rejected.

## Overview

Presigned URLs allow clients to upload/download files directly to storage while the server only
signs the request. This reduces server load and keeps file data out of the API layer.

## Server Functions

### `generateUploadUrl(key, contentType, expirySeconds?)`
Returns a presigned URL for uploads.

**Returns**
```json
{
  "url": "https://your-domain.com/api/storage/upload?...",
  "expiresAt": "2026-02-05T12:00:00.000Z"
}
```

### `generateDownloadUrl(key, expirySeconds?)`
Returns a presigned URL for downloads.

### `validatePresignedUrl(method, key, contentType, expires, signature)`
Validates URL signature and expiry.

## API Endpoints

### `POST /api/upload/presigned/upload`
Generate a presigned upload URL.

**Auth**: Required  
**Body**:
```json
{
  "key": "photos/uuid.jpg",
  "contentType": "image/jpeg",
  "expiresInSeconds": 900
}
```

**Response**:
```json
{
  "url": "https://your-domain.com/api/storage/upload?...",
  "expiresAt": "2026-02-05T12:00:00.000Z"
}
```

### `POST /api/upload/presigned/download`
Generate a presigned download URL.

**Auth**: Required  
**Body**:
```json
{
  "key": "photos/uuid.jpg",
  "expiresInSeconds": 900
}
```

**Response**:
```json
{
  "url": "https://your-domain.com/api/storage/download?...",
  "expiresAt": "2026-02-05T12:00:00.000Z"
}
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `PRESIGNED_URL_SECRET` | 64-hex secret used to sign URLs. |
| `STORAGE_BASE_URL` | Base URL used in presigned URL generation. |
