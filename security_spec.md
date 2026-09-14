# Security Specification: Multi-Tenant Architecture & Access Control

## 1. Core Data Invariants

1. **Tenant Isolation Invariant**:
   An Office record (`/offices/{officeId}`) and its subcollections (`/offices/{officeId}/fiscal_years/{fiscalYear}`, `/offices/{officeId}/audit_logs/{logId}`) belong strictly to `officeId`.
   Users assigned to `office_A` can NEVER read or write data inside `office_B`.

2. **Role Hierarchy Invariant**:
   - `SUPER_ADMIN`: System-wide master administrator. Can read/write all offices, create offices, assign Office Admins, manage all users.
   - `ADMIN` (Office Admin): Administrator for a single Office (`organizationId`). Can read/write their own office profile, manage users belonging to their own office, create/update/delete employees and salary/tax data in their own office. Cannot assign `SUPER_ADMIN` role or change `organizationId` to another office.
   - `OFFICE_USER` (`GENERAL_USER`, `ACCOUNTANT`, `VIEWER`): Can read/write only permitted records belonging to their assigned Office.

3. **Identity & Authentication Invariant**:
   - No plaintext passwords or credentials in Firestore.
   - User document in `/users/{userId}` cannot have its `role` or `organizationId` escalated by a non-Super Admin.
   - Unauthenticated callers (`request.auth == null`) cannot access any tenant records.

---

## 2. The Dirty Dozen Payloads (Security Attack Vectors)

1. **Cross-Tenant Read Attack**:
   User with `organizationId: "org_A"` attempts to read `/offices/org_B/fiscal_years/2081-82`.
   *Expected Result*: `PERMISSION_DENIED`.

2. **Cross-Tenant Write Attack**:
   User with `organizationId: "org_A"` attempts to write employee records to `/offices/org_B/fiscal_years/2081-82`.
   *Expected Result*: `PERMISSION_DENIED`.

3. **Unauthenticated Public Read Attack**:
   Caller with `request.auth == null` attempts to query `/offices` or `/users`.
   *Expected Result*: `PERMISSION_DENIED`.

4. **Privilege Escalation Attack (User Profile Role)**:
   Non-Super Admin user attempts to update their own document in `/users/{userId}` with `{ role: "SUPER_ADMIN" }`.
   *Expected Result*: `PERMISSION_DENIED`.

5. **Tenant Reassignment Attack**:
   Office Admin for `org_A` attempts to change a user's `organizationId` to `org_B`.
   *Expected Result*: `PERMISSION_DENIED`.

6. **Office Admin Impersonation of Super Admin Creation**:
   Office Admin for `org_A` attempts to create a new user with `role: "SUPER_ADMIN"`.
   *Expected Result*: `PERMISSION_DENIED`.

7. **Arbitrary Office Creation Attack**:
   Non-Super Admin user attempts to create a new root document in `/offices/{newOfficeId}`.
   *Expected Result*: `PERMISSION_DENIED`.

8. **Document ID Path Poisoning Attack**:
   Attacker attempts to create a document with a 2000-character malicious path ID containing SQL/XSS injections.
   *Expected Result*: `PERMISSION_DENIED` via `isValidId()`.

9. **Oversized Payload / Denial of Wallet Attack**:
   Attacker attempts to upload a 5MB junk string in office fields or audit log.
   *Expected Result*: `PERMISSION_DENIED` via string length boundaries.

10. **Foreign Audit Log Injection Attack**:
    User from `org_A` attempts to inject forged audit events into `org_B`'s `/offices/org_B/audit_logs`.
    *Expected Result*: `PERMISSION_DENIED`.

11. **Tenant Cross-Contamination in Batch Write**:
    A batch write attempts to update `org_A` and `org_B` simultaneously from an `org_A` admin session.
    *Expected Result*: Entire batch rejected with `PERMISSION_DENIED`.

12. **Unauthenticated System Settings Tampering**:
    Unauthenticated caller attempts to overwrite `/system_settings/system_support_contact`.
    *Expected Result*: `PERMISSION_DENIED`.
