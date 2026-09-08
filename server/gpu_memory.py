"""Optional local-device VRAM sampling; never attributes other processes to vLLM."""
import subprocess
import threading


class LocalGpuMemory:
    def __init__(self, enabled=False):
        self.enabled = enabled
        self.stop_event = threading.Event()
        self.thread = None
        self.devices = {}
        self.samples = 0

    def sample(self):
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=index,memory.used,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=3, check=True,
            )
            rows = [list(map(int, line.split(","))) for line in result.stdout.strip().splitlines()]
            for index, used, total in rows:
                device = self.devices.setdefault(str(index), {"baselineMiB": used, "peakMiB": used, "totalMiB": total})
                device["peakMiB"] = max(device["peakMiB"], used)
            self.samples += 1
        except (OSError, ValueError, subprocess.SubprocessError):
            pass

    def start(self):
        if self.enabled:
            self.sample()
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()

    def _run(self):
        while not self.stop_event.wait(1):
            self.sample()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=4)

    def report(self):
        return {"requested": self.enabled, "available": self.samples > 0, "samples": self.samples,
                "intervalSeconds": 1, "scope": "local-device-total-including-other-processes",
                "devices": self.devices if self.samples else None}
