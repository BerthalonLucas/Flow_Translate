"""Read-only resource checks. Does not start Docker, download weights or stop workloads."""
from __future__ import annotations
import argparse
import csv
import io
import json
import shutil
import socket
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, timeout=20)


def inspect(profile: str, gpu: str | None = None) -> tuple[dict, bool]:
    lock = json.loads((ROOT / "model-lock.json").read_text(encoding="utf-8"))
    report: dict = {"profile": profile, "image": lock["image"], "checks": []}
    checks = report["checks"]
    if not shutil.which("docker"):
        checks.append({"check": "docker", "ok": False, "detail": "Docker CLI absent"})
    else:
        result = run(["docker", "info", "--format", "{{.ServerVersion}}"])
        checks.append({"check": "docker", "ok": result.returncode == 0,
                       "detail": result.stdout.strip() if result.returncode == 0 else "Docker engine unavailable; not started automatically"})
    gpu_rows = []
    if shutil.which("nvidia-smi"):
        result = run(["nvidia-smi", "--query-gpu=index,uuid,name,memory.total,memory.free", "--format=csv,noheader,nounits"])
        if result.returncode == 0:
            gpu_rows = [[part.strip() for part in row] for row in csv.reader(io.StringIO(result.stdout))]
    report["gpus"] = gpu_rows
    profiles = ["fast", "quality"] if profile == "both" else [profile]
    for name in profiles:
        wanted = gpu if gpu is not None else ("1" if name == "fast" else "0")
        row = next((row for row in gpu_rows if wanted in row[:2]), None)
        # Reservations, not a guarantee that a model and all runtime buffers fit.
        required = 7400 if name == "fast" else 13200
        available = int(row[4]) if row else 0
        checks.append({"check": f"{name}-gpu", "ok": bool(row and available >= required),
                       "gpu": wanted, "freeMiB": available, "minimumFreeMiB": required,
                       "detail": "Reserve estimate only; real loading must still be tested"})
        port = lock["profiles"][name]["port"]
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
                free = True
            except OSError:
                free = False
        checks.append({"check": f"{name}-port", "port": port, "ok": free})
    report["readyForTrial"] = all(check["ok"] for check in checks)
    return report, report["readyForTrial"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=["fast", "quality", "both"], default="both")
    parser.add_argument("--gpu", help="index or UUID, for a single profile")
    args = parser.parse_args()
    if args.gpu and args.profile == "both":
        parser.error("--gpu needs a single --profile")
    report, ok = inspect(args.profile, args.gpu)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if ok else 2)

