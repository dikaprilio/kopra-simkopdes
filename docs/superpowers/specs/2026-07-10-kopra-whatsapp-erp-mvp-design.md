# Kopra WhatsApp–ERP Integration MVP Design

**Date:** 2026-07-10  
**Status:** Approved in conversation  
**Product:** Kopra — Hackathon MVP for demonstrating a WhatsApp chatbot bridge to existing cooperative-system workflows

## 1. Purpose

Kopra demonstrates that a WhatsApp assistant can integrate safely with the Finance and Inventory workflows already available in the government cooperative ecosystem. The web application is a small surrogate ERP used for the demonstration; it is not a replacement for SIMKOPDES and does not write to the government database.

The MVP proves five outcomes:

1. An unregistered WhatsApp user can ask public cooperative questions and can start registration without sending credentials through chat.
2. A registered user is resolved to exactly one cooperative and receives role-scoped access.
3. A `PENGURUS` or local-cooperative `OWNER` can perform guarded ERP CRUD from a direct message.
4. A WhatsApp group can carry cooperative-aware read context while remaining unable to perform Create, Update, or Delete actions.
5. The same Finance and Inventory records are visible through the Next.js web application.

## 2. Verified Starting Point

The repository is currently a specification and Prisma-schema scaffold:

- `apps/web`, `apps/api`, and `apps/agent` contain scaffold instructions but no application source.
- `packages/db/prisma/schema.prisma` contains the initial Finance, Inventory-lite, identity, RAG, and audit concepts.
- PostgreSQL 16 with pgvector is the only active service in the main Compose file.
- The sibling `kopra-whatsapp-waha` repository now runs GoWA as the primary gateway, although the main repository still contains stale WAHA references.
- The government PostgreSQL account is read-only. Its identity values are intentionally redacted: NIK values are masked and phone values are not reliable identity proof.

The implementation must therefore begin by reconciling documentation, scaffolding the applications, and revising the schema before feature work.

## 3. Locked Product Decisions

### 3.1 MVP scope

- Finance means CORE-style accounting: COA, journals, financial dashboard, Buku Besar, Neraca Saldo, PHU, and Neraca.
- Inventory means Inventory-lite: products/SKUs, `IN`/`OUT`/`ADJUST` stock movements, current balances, low-stock status, and stock-card history.
- The system is a hackathon integration surrogate. The government database is an import source, not the runtime ERP database.
- A person and WhatsApp number can attach to only one cooperative.
- Next.js never accesses Prisma.
- NestJS and Mastra may both access the shared Prisma client directly.
- Every bot-triggered Create, Update, or Delete operation requires a deterministic preview followed by `YA` or `BATAL` in direct message.
- WhatsApp groups are read-only for ERP operations.

### 3.2 Explicit cuts

The MVP excludes:

- loan or financing-application workflows;
- warehouses, bins, batches, expiry tracking, transfers, and stock-count adjudication;
- OCR, receipt processing, and voice-note transcription;
- web chat;
- multi-cooperative users;
- ERP writes from WhatsApp groups;
- live writes to the government database;
- Cloud Run, Cloud SQL, GKE, Redis, BullMQ, and a microservice/event-bus architecture;
- a large legal-document RAG program;
- point of sale, barcode scanning, and payment gateways.

## 4. System Architecture

```text
Browser
  -> Next.js web
  -> NestJS REST API
  -> shared domain services + Prisma
  -> PostgreSQL

WhatsApp user/group
  -> GoWA
  -> NestJS HMAC webhook
  -> identity, tenant, role, group, and idempotency guards
  -> Mastra agent
  -> shared domain services + Prisma
  -> PostgreSQL
  -> GoWA outbound adapter

Government PostgreSQL
  -> read-only import command
  -> imported cooperative and identity-candidate tables in local PostgreSQL
```

### 4.1 Application boundaries

#### `apps/web` — Next.js

Responsibilities:

- login and registration pages;
- OTP and approval-status UX;
- Finance dashboard, COA, journals, and reports;
- Inventory product, stock movement, balance, low-stock, and stock-card screens;
- member and role management for owners of locally created cooperatives;
- HTTP calls to NestJS only.

The browser never receives database credentials, imports `@kopra/db`, or calls Mastra directly.

#### `apps/api` — NestJS

Responsibilities:

- REST API, DTO validation, JWT issuance, and route guards;
- web registration, OTP, cooperative applications, and approval state;
- web Finance and Inventory CRUD;
- GoWA webhook verification and normalization;
- deterministic super-administrator commands;
- GoWA outbound delivery and retry;
- import orchestration from the read-only government database;
- audit queries and health endpoints.

NestJS may query Prisma directly for application operations, but it must use shared domain functions for rules that Mastra also needs.

#### `apps/agent` — Mastra

Responsibilities:

- Indonesian conversational behavior;
- intent extraction and structured tool inputs;
- small cooperative-guidance retrieval over the existing tutorial and practical-guidance corpus;
- direct-message CRUD workflows with suspend/resume confirmation;
- direct and group read tools;
- conversation memory keyed by user for DM and group ID for group context.

Mastra may query Prisma directly. It must not issue arbitrary SQL or expose a generic database tool. All tools are purpose-specific and receive an already resolved actor, cooperative, channel, and role context.

#### `packages/db` — shared Prisma client

Responsibilities:

- Prisma schema and migrations;
- one shared `PrismaClient` factory/singleton per process;
- seed and import utilities;
- database transaction helpers.

It is consumed only by NestJS, Mastra, scripts, and tests.

#### `packages/core` — shared domain rules

Responsibilities:

- cooperative scoping and role-policy evaluation;
- deterministic accounting posting rules;
- journal balance validation;
- stock movement validation and balance calculation;
- pending-action creation and confirmation;
- immutable-confirmed-record rules;
- audit-event construction;
- PII redaction utilities.

This package prevents the direct Prisma capability in NestJS and Mastra from creating two implementations of the same policy.

#### GoWA gateway

GoWA remains a separately versioned gateway container. The MVP pins `ghcr.io/aldinokemal/go-whatsapp-web-multidevice:v8.6.0` rather than using `latest`. All device-scoped calls include the selected device ID. NestJS adapts GoWA payloads into internal message events so gateway-specific details do not enter the agent or domain layer.

## 5. Data Design

### 5.1 Identity and tenancy

The revised schema contains these concepts:

- `User`: full plaintext `nik` (unique), name, email, password hash, and account status.
- `Koperasi`: name, source reference, origin `IMPORTED|LOCAL`, status `PENDING|ACTIVE|REJECTED`, and management mode `SUPER_ADMIN|OWNER`.
- `Membership`: one user-to-cooperative attachment and role `OWNER|PENGURUS|MEMBER`; `userId` is unique to enforce one cooperative per user.
- `WhatsappIdentity`: normalized E.164 phone/JID mapped uniquely to one user and cooperative.
- `ImportedIdentity`: source table, source reference, cooperative, imported profile fields, masked NIK, and source role. It is a candidate record, not an authenticated user.
- `RegistrationRequest`: channel, requested path, phone, cooperative, submitted full NIK, selected imported candidate, status, expiry, and decision metadata.
- `OtpChallenge`: phone, hashed OTP, attempt count, expiry, and consumed timestamp.
- `CooperativeApplication`: new cooperative details, applicant, approval status, and decision metadata.

Full NIK storage in `User` and registration records is an explicit product requirement. It is never included in ordinary API responses, frontend state after submission, agent prompts, application logs, telemetry, group messages, or `AuditLog.payloadJson`. Passwords and OTPs remain one-way hashed because the plaintext-NIK decision does not apply to authentication secrets.

### 5.2 Conversation and delivery state

- `InboundWhatsappEvent`: unique device ID plus message/event ID, normalized sender/chat fields, and processing result.
- `OutboundWhatsappMessage`: recipient, payload, attempt count, next attempt, and delivery status.
- `PendingAction`: actor, cooperative, direct chat, action type, target reference, serialized preview, Mastra run ID, expiry, and state.
- `WhatsappGroup`: group JID, binding state, bound cooperative, and last participant refresh.
- `WhatsappGroupMessage`: bounded text context, sender, timestamp, and reply/mention metadata.
- `AuditLog`: cooperative, actor, channel, action, resource type/reference, result, correlation ID, and redacted payload.

Only one active `PendingAction` may exist per direct-message actor. Group chats cannot own a pending action.

### 5.3 Finance and Inventory

The existing accounting and stock models remain the foundation:

- COA is unique per cooperative.
- Journal entries contain balanced journal lines.
- only draft journals may be updated or deleted;
- confirmed journals are immutable and corrected through a reversal entry;
- product deletion is allowed only when no stock movement references the product; otherwise the product becomes inactive;
- only draft stock movements may be updated or deleted;
- confirmed stock movements are immutable and corrected through a compensating `ADJUST` movement;
- current stock is the signed sum of confirmed movements;
- quantities use a decimal type so kg, litre, and other fractional units are supported;
- all reads and writes include `koperasiId` in the query predicate.

### 5.4 Government import boundary

The government database is accessed only by an explicit read-only import command, never by a web request, agent tool, or live demo flow.

- Import all available cooperative profiles and the minimum `karyawan_koperasi`, `pengurus_koperasi`, and `anggota_koperasi` identity-candidate fields needed for cooperative search and super-administrator approval.
- Preserve government source references and masked NIK values in `ImportedIdentity`; do not treat redacted phone values as authentication evidence.
- Import operational Finance/Inventory data only for the selected demonstration cooperative: member references, products, and opening-stock facts that can be represented safely.
- Generate opening `ADJUST` movements for imported stock so derived local balances are correct.
- Seed local balanced journals for the Finance demonstration because the source copy does not provide the complete CORE journal ledger required by the MVP.
- Record import batch, source timestamp, row counts, and failures without storing source credentials or unmasked PII in logs.
- After import, all registration and ERP runtime behavior uses local PostgreSQL and remains functional when the government database is unavailable.

## 6. Registration and Approval Flows

### 6.1 First WhatsApp conversation

1. NestJS receives and verifies the GoWA webhook.
2. The sender is not found in `WhatsappIdentity`.
3. The bot introduces Kopra and explains that ERP access requires registration.
4. The user may continue asking public cooperative questions.
5. If the user chooses registration, the bot asks whether they are registering a new cooperative owner or joining as a member.

### 6.2 WhatsApp-started member registration

1. The bot asks for the cooperative.
2. NestJS creates a single-use registration link bound to the sender's normalized phone and valid for 15 minutes.
3. The webpage asks for full NIK and password. It does not request imported profile fields again.
4. A five-minute OTP is sent to the same WhatsApp number. It permits three verification attempts.
5. The system searches `ImportedIdentity` using the selected cooperative and the visible prefix of the imported masked NIK.
6. Every registration targeting an imported cooperative enters `PENDING_SUPER_ADMIN`, including zero, one, or several candidate matches.
7. When masked data yields several candidates, the WhatsApp-only super administrator selects the correct source reference while approving. A request with no source match is clearly marked and may be approved as a new `MEMBER` or rejected.
8. Approval creates or updates the local `User`, stores the submitted full NIK, attaches the verified phone, copies imported profile data when a candidate was selected, and creates a `MEMBER` membership.
9. Rejection returns a safe reason without exposing candidate identity data.

If an exact local full-NIK user already exists and its phone is null, the profile form is skipped; approval and OTP attach the phone. A non-null phone conflict is rejected and routed to super-administrator resolution.

### 6.3 Web-started member registration

The web flow uses the same state machine without the WhatsApp conversational prelude:

1. user selects cooperative and enters full NIK;
2. imported/local lookup decides whether profile fields are prefilled or required;
3. user creates login credentials;
4. WhatsApp OTP verifies the submitted number;
5. imported identities go to super-administrator approval;
6. membership requests for a local cooperative go to its owner for web approval;
7. approved users receive `MEMBER`.

### 6.4 New cooperative owner registration

1. The applicant selects the owner path in WhatsApp or web.
2. The form collects cooperative identity, address, applicant identity, credentials, and WhatsApp number.
3. WhatsApp OTP verifies the phone.
4. The request enters `PENDING_SUPER_ADMIN`.
5. Approval creates an `ACTIVE`, `LOCAL`, owner-managed cooperative and an `OWNER` membership for the applicant.
6. Rejection leaves no active cooperative or membership.

Imported cooperatives are stored as `ACTIVE`, `IMPORTED`, already claimed, and super-admin-managed. They cannot enter the owner flow and never receive a local `OWNER`.

### 6.5 WhatsApp-only super administrator

The super administrator is identified only by the normalized number in `SUPER_ADMIN_WA_NUMBER`; it has no web account and no ordinary ERP data access. Commands are parsed deterministically before the LLM:

- `PERMOHONAN` — list pending short codes;
- `DETAIL <code>` — show a redacted request summary and candidate short references;
- `SETUJUI <code> [candidate-ref]` — approve registration or cooperative creation;
- `TOLAK <code> <reason>` — reject a request;
- `PERAN <user-ref> MEMBER|PENGURUS` — manage an imported cooperative's member roles.

Approval requests expire after 24 hours and can be reissued. Every command is idempotent and audited.

## 7. Authorization Matrix

| Capability | Unregistered | MEMBER | PENGURUS | Local OWNER | Super admin |
|---|---:|---:|---:|---:|---:|
| Public cooperative Q&A | Yes | Yes | Yes | Yes | Approval commands only |
| Read Inventory in DM/web | No | Yes | Yes | Yes | No |
| Read Finance in DM/web | No | Yes | Yes | Yes | No |
| Finance/Inventory CRUD in DM/web | No | No | Yes | Yes | No |
| Promote/demote local members | No | No | No | Yes | No |
| Manage imported roles | No | No | No | No | Yes |
| Approve imported identities | No | No | No | No | Yes |
| Approve new cooperative | No | No | No | No | Yes |

Web and DM share the same role-policy functions. Channel-specific group restrictions are applied in addition to this table.

## 8. Bot Tools and Confirmation

### 8.1 Read tools

- `getCooperativeProfile`
- `listCoaAccounts`
- `listJournalEntries`
- `getFinancialDashboard`
- `generateFinancialReport`
- `listProducts`
- `getStockLevels`
- `getStockCard`
- `searchCooperativeGuidance`

The guidance tool uses PostgreSQL full-text search over the existing curated Markdown corpus for the MVP. Vector embeddings remain optional schema capability and are not on the critical path.

### 8.2 Write tools

- `createCoaDraft`, `updateCoaDraft`, `deleteUnusedCoaDraft`
- `createJournalDraft`, `updateJournalDraft`, `deleteJournalDraft`, `confirmJournalDraft`
- `createProductDraft`, `updateProductDraft`, `deleteUnusedProductDraft`
- `createStockMovementDraft`, `updateStockMovementDraft`, `deleteStockMovementDraft`, `confirmStockMovementDraft`

The model never receives a raw Prisma client or generic SQL tool. A tool validates its typed input, actor, channel, role, cooperative, and target state before touching Prisma.

### 8.3 Direct-message write sequence

1. The LLM extracts intent into a typed schema.
2. Shared domain code validates role, tenant, references, and business rules.
3. The system creates a noncommitted `PendingAction` preview.
4. The bot shows the complete human-readable effect.
5. Mastra suspends the workflow and persists its snapshot.
6. `YA` from the same actor resumes and commits in one Prisma transaction.
7. `BATAL` expires the action without an ERP mutation.
8. Correction text regenerates and redisplays the preview.
9. A pending action expires after 15 minutes.

Repeated `YA`, webhook retries, or concurrent delivery cannot apply an action twice because confirmation locks the pending row and checks its terminal state inside the same transaction.

The LLM extracts and explains; shared domain code calculates totals, selects posting rules, validates balanced journals, and commits records.

## 9. WhatsApp Group Behavior

### 9.1 Context capture and response trigger

- GoWA sends `message`, `group.joined`, and `group.participants` events.
- NestJS stores every inbound group text message in a bounded context window, even when the bot does not reply.
- A group retains the newest 50 text messages for at most 24 hours.
- Media content is not interpreted in the MVP.
- The bot responds only when the message contains a native mention of the bot number or the explicit text `@Kopra`. Replying to a bot message without mentioning it does not trigger a response.
- An initial integration spike records redacted raw payload structure to determine whether GoWA supplies native incoming mention metadata. The explicit `@Kopra` text rule remains the deterministic fallback used by the demo.

### 9.2 Cooperative binding

1. When added, the bot fetches the current participant list from GoWA.
2. NestJS maps participant JIDs to registered `WhatsappIdentity` records.
3. Exactly one distinct cooperative binds the group automatically.
4. Zero or multiple distinct cooperatives put the group in `UNRESOLVED` and prompt for its cooperative.
5. The first registered participant to answer binds the group to that participant's own cooperative; arbitrary selection of another cooperative is not accepted.
6. If zero members are registered, public Q&A remains available until one participant registers and answers.
7. Participant join/leave events refresh candidates. If the bound cooperative no longer has any registered participant in the group, the binding returns to `UNRESOLVED`.

### 9.3 Group access rules

- Anyone may ask public cooperative questions.
- A registered `MEMBER` may request Inventory reads.
- Only `PENGURUS` or local `OWNER` may request Finance reads.
- Any Create, Update, or Delete intent receives a refusal and a direct-message link/instruction.
- No draft or suspended workflow is created from a group request.

## 10. API Shape

NestJS exposes versioned REST endpoints under `/api/v1`:

- `/auth`: login, current user, registration links, OTP, and registration requests;
- `/cooperatives`: search, local applications, membership requests, and local role management;
- `/coa`, `/journals`, `/reports`;
- `/products`, `/stock-movements`;
- `/whatsapp/webhook`: raw-body HMAC endpoint;
- `/internal/approvals`: service functions invoked by deterministic WhatsApp commands, not a public web administration UI;
- `/health/live` and `/health/ready`.

Every list endpoint has pagination, bounded page size, deterministic ordering, and cooperative scoping. Decimal values serialize as strings. Dates serialize as ISO 8601. Errors use a stable code, user-safe message, and correlation ID.

## 11. Reliability, Privacy, and Error Handling

### 11.1 WhatsApp delivery

- Verify `X-Hub-Signature-256` with the raw body and a constant-time comparison.
- Reject missing or invalid signatures before JSON processing.
- Deduplicate inbound events with unique `(deviceId, eventId)` storage.
- Ignore `is_from_me` messages to prevent loops.
- Store failed outbound sends in PostgreSQL and retry with bounded exponential backoff.
- Pin GoWA and configure its device ID explicitly.

### 11.2 Database integrity

- Use Prisma transactions for confirmation, stock/journal linkage, role changes, and approvals.
- Enforce cross-tenant equality in shared domain code and composite database constraints where Prisma/PostgreSQL supports them.
- Never accept `koperasiId` from an LLM without comparing it to resolved actor/group context.
- Use decimals for currency and fractional inventory quantities.
- Audit successful and rejected mutations.

### 11.3 PII handling

- NIK is plaintext at rest by explicit requirement.
- NIK is masked before display and removed from logs, traces, prompts, exports, errors, and audit JSON.
- Registration endpoints never echo the submitted NIK.
- Passwords use Argon2id; OTP values are stored as keyed hashes.
- Government database credentials exist only in the import process environment and are never placed in Compose, images, logs, or repository files.

### 11.4 User-facing failures

- Unknown cooperative: show search correction, never invent a match.
- Ambiguous imported identity: hold for super-administrator candidate selection.
- Expired OTP/link/action: issue a new challenge without partially applying state.
- Role denial: explain the required role and preserve no draft.
- Group write: redirect to DM and preserve no pending action.
- Agent/tool failure: return a safe retry message with correlation ID; do not guess or commit.
- GoWA unavailable: accept and deduplicate webhook work already received, queue outbound response, and surface degraded health.

## 12. Deployment

The MVP runs on one GCP Compute Engine VM in `asia-southeast2` using Docker Compose:

- Caddy reverse proxy for HTTPS;
- Next.js;
- NestJS;
- Mastra;
- PostgreSQL 16 with pgvector available;
- GoWA `v8.6.0`.

A dedicated Persistent Disk stores PostgreSQL and GoWA session/key data. Only SSH, HTTP, and HTTPS are publicly reachable. PostgreSQL, NestJS internal routes, Mastra, and the GoWA management UI remain on the private Compose network; GoWA administration is reached through an SSH tunnel.

Deployment uses environment files stored only on the VM with owner-only permissions. A pre-demo snapshot/backup covers PostgreSQL and the GoWA session volume. The live demo never depends on the government database being reachable.

## 13. Testing Strategy

### 13.1 Unit tests

- complete role/channel authorization matrix;
- one-user/one-cooperative invariants;
- imported-versus-local cooperative rules;
- OTP, link, request, and pending-action expiry;
- journal posting and balance validation;
- product deletion and confirmed-record immutability;
- stock balance and fractional quantities;
- NIK redaction;
- group cooperative resolution and first-registered-answer binding.

### 13.2 Contract tests

- GoWA HMAC and normalized DM/group payload fixtures;
- v8 device-scoped outbound requests;
- group participant refresh payloads;
- NestJS REST request/response schemas;
- agent tool schemas and tool error mapping.

### 13.3 Integration tests

- Prisma/PostgreSQL approval and confirmation transactions;
- duplicate webhook and duplicate `YA` behavior;
- imported identity ambiguity and super-admin selection;
- local owner creation and member promotion;
- journal reversal and stock adjustment;
- outbound retry recovery.

### 13.4 End-to-end demo tests

1. Unknown DM receives introduction and answers public cooperative guidance.
2. Imported member follows the web link, verifies OTP, receives super-admin approval, and gets cooperative context without re-entering profile data.
3. `PENGURUS` creates a journal and stock movement through preview → `YA`; web screens update from the same PostgreSQL records.
4. `MEMBER` can read but receives denial for a write.
5. Bot joins a group, resolves/binds the cooperative, reads unmentioned context silently, and responds when mentioned.
6. Group Inventory and Finance reads follow the role matrix.
7. Group write request redirects to DM and creates no draft.
8. New cooperative owner registration remains unusable until the WhatsApp super administrator approves it.

## 14. MVP Acceptance Criteria

The MVP is complete when:

- all six Compose services start on a fresh VM from documented commands;
- the web Finance and Inventory-lite paths work with seeded/imported demo data;
- both registration channels work and imported approvals are WhatsApp-only;
- one registered DM CRUD flow for Finance and one for Inventory survive service restart while awaiting confirmation;
- duplicate webhook delivery and repeated confirmation are harmless;
- group binding, mention-only response, role-sensitive reads, and DM redirection work on a real WhatsApp group;
- all automated tests pass;
- no secret, production credential, unmasked NIK, or other PII appears in repository history or runtime logs;
- the demo remains functional with the government database disconnected.

## 15. Source References

- SIMKOPDES login: <https://simkopdes.go.id/masuk>
- SIMKOPDES cooperative-account request: <https://simkopdes.go.id/survey/permohonan-akun>
- GoWA repository and API inventory: <https://github.com/aldinokemal/go-whatsapp-web-multidevice>
- GoWA webhook payload and HMAC contract: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/webhook-payload.md>
- Mastra persisted workflow snapshots: <https://mastra.ai/en/reference/workflows/snapshots>
- GCP Persistent Disk: <https://docs.cloud.google.com/compute/docs/disks/persistent-disks>
