import { describe, expect, it } from "vitest";
import { can, type ActorRole, type Capability, type Channel } from "./policy";

const T = (role: ActorRole, cap: Capability, ch: Channel, want: boolean) =>
  it(`${role} ${cap} @${ch} = ${want}`, () => expect(can(role, cap, ch)).toBe(want));

describe("Matriks akses FINAL (unified plan)", () => {
  // PUBLIC_QA — semua kecuali SUPER_ADMIN
  T("GUEST", "PUBLIC_QA", "DM", true);
  T("GUEST", "PUBLIC_QA", "GROUP", true);
  T("ANGGOTA", "PUBLIC_QA", "WEB", true);
  T("SUPER_ADMIN", "PUBLIC_QA", "DM", false);

  // READ_SELF — member+ di DM/WEB, tidak di GROUP
  T("ANGGOTA", "READ_SELF", "DM", true);
  T("ANGGOTA", "READ_SELF", "GROUP", false);
  T("GUEST", "READ_SELF", "DM", false);

  // READ_INVENTORY — member+ semua channel (grup termasuk)
  T("ANGGOTA", "READ_INVENTORY", "GROUP", true);
  T("ANGGOTA", "READ_INVENTORY", "DM", true);
  T("GUEST", "READ_INVENTORY", "GROUP", false);

  // READ_FINANCE — transparansi anggota di DM/WEB; grup hanya pengurus/owner
  T("ANGGOTA", "READ_FINANCE", "DM", true);
  T("ANGGOTA", "READ_FINANCE", "WEB", true);
  T("ANGGOTA", "READ_FINANCE", "GROUP", false);
  T("PENGURUS", "READ_FINANCE", "GROUP", true);
  T("OWNER", "READ_FINANCE", "GROUP", true);
  T("GUEST", "READ_FINANCE", "DM", false);

  // WRITE_ERP — pengurus/owner, TIDAK PERNAH di grup
  T("PENGURUS", "WRITE_ERP", "DM", true);
  T("OWNER", "WRITE_ERP", "WEB", true);
  T("PENGURUS", "WRITE_ERP", "GROUP", false);
  T("OWNER", "WRITE_ERP", "GROUP", false);
  T("ANGGOTA", "WRITE_ERP", "DM", false);

  // MANAGE_LOCAL_ROLES — owner web only
  T("OWNER", "MANAGE_LOCAL_ROLES", "WEB", true);
  T("OWNER", "MANAGE_LOCAL_ROLES", "DM", false);
  T("PENGURUS", "MANAGE_LOCAL_ROLES", "WEB", false);

  // SUPER_ADMIN_CMD — hanya super-admin via DM
  T("SUPER_ADMIN", "SUPER_ADMIN_CMD", "DM", true);
  T("SUPER_ADMIN", "SUPER_ADMIN_CMD", "GROUP", false);
  T("OWNER", "SUPER_ADMIN_CMD", "DM", false);
});
