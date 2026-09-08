"""Archive only small pinned public model metadata, never model weights."""
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    lock = json.loads((ROOT / "model-lock.json").read_text(encoding="utf-8"))
    for name, profile in lock["profiles"].items():
        folder = ROOT / "metadata" / name
        folder.mkdir(parents=True, exist_ok=True)
        hashes = {}
        for filename in ("config.json", "generation_config.json", "LICENSE.txt"):
            url = f'https://huggingface.co/{profile["repository"]}/resolve/{profile["revision"]}/{filename}'
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read(1_000_001)
            if len(data) > 1_000_000:
                raise ValueError("Unexpectedly large metadata response")
            if filename == "LICENSE.txt" and b"Apache License" not in data:
                raise ValueError("Pinned model license differs from expected Apache license")
            (folder / filename).write_bytes(data)
            hashes[filename] = hashlib.sha256(data).hexdigest()
        (folder / "checksums.json").write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")
        print(f'{name}: archived metadata at revision {profile["revision"]}')


if __name__ == "__main__":
    main()

