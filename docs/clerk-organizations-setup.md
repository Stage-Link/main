# Clerk Organizations — Dashboard Setup

Follow these steps in the [Clerk Dashboard](https://dashboard.clerk.com) to enable Organizations and configure roles/permissions for Stage Link.

## 1. Enable Organizations

1. In the Clerk Dashboard, go to **Organizations** (or **Configure** → **Organizations**).
2. Click **Enable**.
3. Choose **Membership required** so every user must belong to an organization.
4. Enable **Create first organization automatically** so new users get an org when they sign up.
5. Save.

## 2. Roles & Permissions

1. Go to **Organizations** → **Settings** → **Roles & Permissions** (or [Organizations Settings → Roles](https://dashboard.clerk.com/~/organizations-settings/roles)).

### Default roles

- **Admin** (`org:admin`) — Keep as-is. Ensure it has:
  - System: Manage members, Read members, Manage organization, Delete organization, etc.
  - Custom permission: `org:stream:host` and `org:stream:view` (create these in the next step).
- **Member** (`org:member`) — Ensure it has:
  - Custom permission: `org:stream:view` only (no host).

### Custom role: Stage Manager

1. Click **Add role**.
2. Create a role:
   - **Name:** Stage Manager  
   - **Key:** `org:stage_manager`  
   - **Description:** Can host streams and manage show settings.
3. Assign **Custom permissions** to this role:
   - `org:stream:host`
   - `org:stream:view`

## 3. Create Custom Permissions (Feature)

1. Under **Roles & Permissions**, open the **Features** (or custom permissions) section.
2. Create a feature (e.g. **Stream**) and add permissions:
   - **Permission key:** `org:stream:host` — “Can host streams”
   - **Permission key:** `org:stream:view` — “Can view streams”
3. Assign:
   - `org:stream:host` → **Admin** and **Stage Manager**
   - `org:stream:view` → **Admin**, **Stage Manager**, and **Member**

## 4. Summary

| Role           | Key                | Permissions              |
|----------------|--------------------|---------------------------|
| Admin          | `org:admin`        | `org:stream:host`, `org:stream:view`, plus all system |
| Stage Manager  | `org:stage_manager`| `org:stream:host`, `org:stream:view` |
| Member         | `org:member`       | `org:stream:view`         |

After this, the app will:

- Require an active organization for `/host` and `/viewer`.
- Allow only users with `org:stream:host` to open the Host page.
- Allow any org member with `org:stream:view` to open the Viewer page.
- Use `organization.id` as the PartyKit room so each org has an isolated stream.
