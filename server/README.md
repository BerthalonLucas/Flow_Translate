# Separate vLLM server

This server does not depend on the Windows UI. `model-lock.json` records public model revisions, byte sizes, licenses and the verified vLLM 0.28.0 Docker digest. Metadata is archived under `metadata/`; no weights are committed. The two checkpoints remain candidates until GPU and quality evaluation succeeds.

## Local trial (Windows Docker Desktop / Linux engine, or a Linux GPU server)

1. Inspect resources: `python server/preflight.py`. Exit 2 means the trial cannot safely start yet. This command does not start Docker or stop existing processes.
2. Optional: copy `server/.env.example` to `server/.env`, select GPU indices/UUIDs and ports. Default Quality uses GPU 0, Fast uses GPU 1. If overriding ports/reservations, verify those explicitly in addition to preflight defaults.
3. Validate configuration: `docker compose -f server/compose.yaml --profile fast --profile quality config --quiet`.
4. Start one profile first: `docker compose -f server/compose.yaml --profile fast up -d fast`. The first start downloads the pinned image plus about 4.08 GB of weights (engine image/cache overhead is additional). Quality downloads about 8.03 GB of weights. Do not launch while the selected GPU is occupied.
5. Inspect health, then trial Quality separately. Run both only after verifying each budget. No CPU offload or tensor-parallel multi-GPU assumptions are made.
6. Client profiles: `http://127.0.0.1:8001/v1`, model `flowtranslate-fast`; `http://127.0.0.1:8002/v1`, model `flowtranslate-quality`.

Normal endpoint failure never falls back to a mock or a different model. The native app's explicit `--demo` option is separate and labelled.

## Parameters and verification

Context 8192, TP=1, at most 10 sequences. Sampling matches the pinned model generation configuration: temperature .7, top_p .8, top_k 20, repetition penalty 1.05. Benchmark seed 42 is recorded. Use a single user message with the target language's full English name and the official translation-only instruction. Quantization is detected from the quality checkpoint, not forced to a different format. `HunYuanDenseV1ForCausalLM` is present in the source registry at tag v0.28.0. The complete runtime/FP8 compatibility still requires loading.

Request logs are explicitly disabled and the logging level is warning. No payload capture, access-log export or content tracing should be enabled. Only scalar timing/health metrics are appropriate. The Docker health check may take several minutes on a cold first launch.

## Enterprise deployment

Move this configuration to a Linux GPU host; the client still uses the same OpenAI contract. Keep engine ports private. Expose only the required `/v1/models` and `/v1/chat/completions` routes through the company's HTTPS/authenticated reverse proxy, with per-user access control, request size limits and no body logging. Do not expose the entire vLLM API publicly or rely solely on its API-key switch. Configure the authenticated HTTPS endpoint/key under client advanced settings. Provision certificates/identity in the enterprise environment rather than committing private keys here.

## Stop and rollback

`docker compose -f server/compose.yaml --profile fast --profile quality down` stops only this Compose project. Do not use `-v`: retaining volumes preserves downloaded weights and compile caches. To roll back, check out the previous release tag and start its pinned configuration; no automatic latest/nightly upgrades occur. Update profiles only after a new validation report.

## Evaluation

Use the synthetic 100-case corpus and `evaluate.py` after a server is healthy. Outputs stay in ignored `results/`; never substitute real confidential messages into the committed corpus. Human fidelity/fluency review remains necessary; preservation checks and latency are not a claim of translation superiority.
