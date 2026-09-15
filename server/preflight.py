"""Read-only resource checks. Does not start Docker, download weights or stop workloads."""
from __future__ import annotations
import argparse
import csv
import io
import json
import os
import shutil
import socket
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULTS = {
    "fast": {"gpu": "1", "port": 8001, "minimumFreeMiB": 7400},
    "quality": {"gpu": "0", "port": 8002, "minimumFreeMiB": 13200},
    "general": {"gpu": "0", "port": 8003, "minimumFreeMiB": 12500},
}


def load_env_file(path: Path | None) -> dict[str, str]:
    if path is None or not path.exists():
        return {}
    values: dict[str, str] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Invalid env line {number} in {path}")
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def effective_settings(profile: str, gpu: str | None, env_file: Path | None) -> dict[str, dict]:
    file_values = load_env_file(env_file)
    resolved = {}
    for name in (["fast", "quality"] if profile == "both" else [profile]):
        prefix = name.upper()
        selected_gpu = gpu if gpu is not None else os.environ.get(
            f"{prefix}_GPU", file_values.get(f"{prefix}_GPU", DEFAULTS[name]["gpu"])
        )
        port_text = os.environ.get(
            f"{prefix}_PORT", file_values.get(f"{prefix}_PORT", str(DEFAULTS[name]["port"]))
        )
        try:
            port = int(port_text)
        except ValueError as exc:
            raise ValueError(f"{prefix}_PORT must be an integer") from exc
        if not 1 <= port <= 65535:
            raise ValueError(f"{prefix}_PORT must be between 1 and 65535")
        resolved[name] = {"gpu": selected_gpu, "port": port,
                          "minimumFreeMiB": DEFAULTS[name]["minimumFreeMiB"]}
    return resolved


def run(args: list[str]) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 124, "", "timed out after 20 seconds")


def inspect(profile: str, gpu: str | None = None, env_file: Path | None = ROOT / ".env") -> tuple[dict, bool]:
    lock = json.loads((ROOT / "model-lock.json").read_text(encoding="utf-8"))
    settings = effective_settings(profile, gpu, env_file)
    report: dict = {"profile": profile, "image": lock["image"], "settings": settings, "checks": []}
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
    for name, selected in settings.items():
        wanted = selected["gpu"]
        row = next((row for row in gpu_rows if wanted in row[:2]), None)
        # Reservations, not a guarantee that a model and all runtime buffers fit.
        required = selected["minimumFreeMiB"]
        available = int(row[4]) if row else 0
        checks.append({"check": f"{name}-gpu", "ok": bool(row and available >= required),
                       "gpu": wanted, "freeMiB": available, "minimumFreeMiB": required,
                       "detail": "Reserve estimate only; real loading must still be tested"})
        port = selected["port"]
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
    parser.add_argument("--profile", choices=["fast", "quality", "general", "both"], default="both")
    parser.add_argument("--gpu", help="index or UUID, for a single profile")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env",
                        help="Compose env file to evaluate (default: server/.env when present)")
    args = parser.parse_args()
    if args.gpu and args.profile == "both":
        parser.error("--gpu needs a single --profile")
    try:
        report, ok = inspect(args.profile, args.gpu, args.env_file)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if ok else 2)
