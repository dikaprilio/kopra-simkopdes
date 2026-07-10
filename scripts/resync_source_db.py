"""Re-sync DB panitia -> Postgres lokal, streaming langsung tanpa file perantara.

Pakai: python scripts/resync_source_db.py [nama_tabel ...]
       (tanpa argumen = semua tabel)

Kredensial WAJIB dari environment variable — tidak ada fallback hardcoded
(repo ini publik). Nilai aslinya ada di email panitia / .env tim (jangan commit).

  SRC_DB_HOST, SRC_DB_PORT, SRC_DB_NAME, SRC_DB_USER, SRC_DB_PASS
  LOCAL_DB_HOST, LOCAL_DB_PORT, LOCAL_DB_NAME, LOCAL_DB_USER, LOCAL_DB_PASS
"""
import os
import sys

import psycopg2


def env(key, default=None):
    val = os.getenv(key, default)
    if val is None:
        sys.exit(f"ENV {key} belum di-set. Lihat docstring / email panitia.")
    return val


REMOTE = dict(
    host=env("SRC_DB_HOST"),
    port=int(env("SRC_DB_PORT", "5432")),
    dbname=env("SRC_DB_NAME", "hackathon_2026"),
    user=env("SRC_DB_USER"),
    password=env("SRC_DB_PASS"),
    connect_timeout=15,
)
LOCAL = dict(
    host=env("LOCAL_DB_HOST", "localhost"),
    port=int(env("LOCAL_DB_PORT", "5432")),
    dbname=env("LOCAL_DB_NAME", "hackathon_2026"),
    user=env("LOCAL_DB_USER", "postgres"),
    password=env("LOCAL_DB_PASS"),
)


def main():
    remote = psycopg2.connect(**REMOTE)
    local = psycopg2.connect(**LOCAL)
    rcur, lcur = remote.cursor(), local.cursor()

    if len(sys.argv) > 1:
        tables = sys.argv[1:]
    else:
        rcur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
        )
        tables = [r[0] for r in rcur.fetchall()]

    import io

    for t in tables:
        buf = io.BytesIO()
        rcur.copy_expert(f'COPY "{t}" TO STDOUT WITH CSV HEADER', buf)
        buf.seek(0)
        lcur.execute(f'TRUNCATE "{t}"')
        lcur.copy_expert(f'COPY "{t}" FROM STDIN WITH CSV HEADER', buf)
        local.commit()
        lcur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f"{t}: {lcur.fetchone()[0]} rows")

    remote.close()
    local.close()
    print("RESYNC SELESAI")


if __name__ == "__main__":
    main()
