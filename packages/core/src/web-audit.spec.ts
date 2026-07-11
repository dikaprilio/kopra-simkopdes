import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@kopra/db";
import {
  WEB_AUDIT_MUTATION,
  WEB_AUDIT_RESOURCE,
  webAuditAction,
  writeWebMutationAudit,
} from "./web-audit.js";

let koperasiId = "";
let actorId = "";

beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const koperasi = await prisma.koperasi.create({ data: { nama: `Audit ${suffix}` } });
  koperasiId = koperasi.id;
  const actor = await prisma.user.create({
    data: {
      email: `audit-${suffix}@example.test`,
      passwordHash: "x",
      name: "Audit Actor",
      koperasiId,
    },
  });
  actorId = actor.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { koperasiId } });
  await prisma.user.deleteMany({ where: { id: actorId } });
  await prisma.koperasi.deleteMany({ where: { id: koperasiId } });
});

describe("WEB mutation audit adapter", () => {
  it("stores standard names and redacts NIK, phone, password, token, and OTP payloads", async () => {
    const secrets = {
      nik: "3402010203040506",
      phone: "081234567890",
      waNumber: "6281234567890",
      whatsappNumber: "+62 812 3456 7890",
      whatsapp: "62 812-3456-7890",
      nomorWa: "+62 813 2222 3333",
      noHp: "0813 4444 5555",
      password: "kopra-secret",
      accessToken: "token-secret",
      otpCode: "654321",
    };
    await writeWebMutationAudit({
      koperasiId,
      actorId,
      resourceType: WEB_AUDIT_RESOURCE.MEMBER,
      mutation: WEB_AUDIT_MUTATION.CREATE,
      resourceRef: "member-safe-ref",
      payload: {
        ...secrets,
        nested: { passwordHash: "hash-secret", refreshToken: "refresh-secret" },
        contacts: ["+62 815 6666 7777", "62 816-8888-9999"],
        note: `kontak ${secrets.phone} dengan NIK ${secrets.nik}`,
      },
    });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { koperasiId, actorId, resourceRef: "member-safe-ref" },
      orderBy: { createdAt: "desc" },
    });
    expect(row).toMatchObject({
      channel: "WEB",
      action: "member.create",
      resourceType: "member",
      result: "OK",
    });
    expect(row.action).toBe(webAuditAction(
      WEB_AUDIT_RESOURCE.MEMBER,
      WEB_AUDIT_MUTATION.CREATE,
    ));

    const serialized = JSON.stringify(row.payloadJson);
    for (const value of [
      ...Object.values(secrets),
      "hash-secret",
      "refresh-secret",
      "+62 815 6666 7777",
      "62 816-8888-9999",
    ]) expect(serialized).not.toContain(value);
    expect(row.payloadJson).toMatchObject({
      nik: "[REDACTED]",
      phone: "[REDACTED]",
      waNumber: "[REDACTED]",
      whatsappNumber: "[REDACTED]",
      whatsapp: "[REDACTED]",
      nomorWa: "[REDACTED]",
      noHp: "[REDACTED]",
      password: "[REDACTED]",
      accessToken: "[REDACTED]",
      otpCode: "[REDACTED]",
      nested: { passwordHash: "[REDACTED]", refreshToken: "[REDACTED]" },
    });
  });

  it("does not fail the caller when audit persistence fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(writeWebMutationAudit({
        koperasiId: "missing-koperasi",
        actorId: "missing-actor",
        resourceType: WEB_AUDIT_RESOURCE.PRODUCT,
        mutation: WEB_AUDIT_MUTATION.UPDATE,
        resourceRef: "product-ref",
        payload: { nama: "Produk" },
      })).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
