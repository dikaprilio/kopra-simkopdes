/**
 * Matriks akses FINAL — docs/plans/2026-07-10-kopra-system-build-plan.md.
 * SEMUA tool/endpoint memanggil can() sebelum menyentuh data.
 * MEMBER (ANGGOTA) boleh read Finance & Inventory di DM/WEB (transparansi);
 * di GRUP: finance-read hanya PENGURUS/OWNER; write TIDAK PERNAH di grup.
 */

export type ActorRole = "OWNER" | "PENGURUS" | "ANGGOTA" | "GUEST" | "SUPER_ADMIN";
export type Channel = "DM" | "GROUP" | "WEB";

export type Capability =
  | "PUBLIC_QA" // RAG umum seputar koperasi
  | "READ_SELF" // profil & simpanan dirinya
  | "READ_INVENTORY" // stok, produk, kartu stok
  | "READ_FINANCE" // dashboard, jurnal, laporan, penunggak
  | "WRITE_ERP" // create/update/delete (selalu via draft→YA di DM)
  | "MANAGE_LOCAL_ROLES" // owner koperasi LOCAL kelola role member
  | "SUPER_ADMIN_CMD"; // PERMOHONAN/SETUJUI/TOLAK/PERAN

const PENGURUS_UP: ActorRole[] = ["PENGURUS", "OWNER"];
const MEMBER_UP: ActorRole[] = ["ANGGOTA", "PENGURUS", "OWNER"];

export function can(role: ActorRole, cap: Capability, channel: Channel): boolean {
  switch (cap) {
    case "PUBLIC_QA":
      return role !== "SUPER_ADMIN"; // super-admin hanya perintah approval
    case "READ_SELF":
      return MEMBER_UP.includes(role) && channel !== "GROUP";
    case "READ_INVENTORY":
      return MEMBER_UP.includes(role); // semua channel (grup: MEMBER+)
    case "READ_FINANCE":
      if (channel === "GROUP") return PENGURUS_UP.includes(role);
      return MEMBER_UP.includes(role); // DM/WEB: transparansi anggota
    case "WRITE_ERP":
      return channel !== "GROUP" && PENGURUS_UP.includes(role);
    case "MANAGE_LOCAL_ROLES":
      return role === "OWNER" && channel === "WEB";
    case "SUPER_ADMIN_CMD":
      return role === "SUPER_ADMIN" && channel === "DM";
  }
}

/** Pesan penolakan konsisten (dipakai tools & orchestrator). */
export function denialMessage(cap: Capability, channel: Channel): string {
  if (cap === "WRITE_ERP" && channel === "GROUP")
    return "📵 Catat-mencatat lewat *japri* (DM) ya, biar aman & rapi. Di grup saya hanya melayani tanya-tanya.";
  if (cap === "READ_FINANCE" && channel === "GROUP")
    return "🙏 Maaf, ringkasan keuangan di grup hanya untuk pengurus. Silakan tanya via DM/web ya.";
  if (cap === "WRITE_ERP")
    return "🙏 Maaf, pencatatan hanya bisa dilakukan pengurus koperasi.";
  return "🙏 Maaf, kamu belum punya akses untuk itu. Ketik *DAFTAR* untuk menghubungkan akun ke koperasimu.";
}
