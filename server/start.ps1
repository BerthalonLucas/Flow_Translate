[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("fast", "quality")]
    [string]$Profile,
    [ValidateRange(30, 3600)]
    [int]$HealthDeadlineSeconds = 900,
    [string]$EnvFile = (Join-Path $PSScriptRoot ".env")
)

$ErrorActionPreference = "Stop"
$compose = @("compose", "--project-name", "flowtranslate-server")
$preflight = @((Join-Path $PSScriptRoot "preflight.py"), "--profile", $Profile)
if (Test-Path -LiteralPath $EnvFile) {
    $resolvedEnv = (Resolve-Path -LiteralPath $EnvFile).Path
    $compose += @("--env-file", $resolvedEnv)
    $preflight += @("--env-file", $resolvedEnv)
}
$compose += @("-f", (Join-Path $PSScriptRoot "compose.yaml"), "--profile", $Profile)

& python @preflight
if ($LASTEXITCODE -ne 0) { throw "Preflight failed; no container was started." }
& docker @compose config --quiet
if ($LASTEXITCODE -ne 0) { throw "Compose validation failed; no container was started." }
& docker @compose up -d $Profile
if ($LASTEXITCODE -ne 0) { throw "Compose could not start profile '$Profile'." }

$containerId = (& docker @compose ps -q $Profile).Trim()
if (-not $containerId) { throw "Compose did not return a container for profile '$Profile'." }
$deadline = (Get-Date).AddSeconds($HealthDeadlineSeconds)
do {
    $health = (& docker inspect --format "{{.State.Health.Status}}" $containerId).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect container $containerId." }
    if ($health -eq "healthy") {
        Write-Host "Profile '$Profile' is healthy (container $containerId)."
        exit 0
    }
    if ($health -eq "unhealthy") {
        throw "Profile '$Profile' became unhealthy. Inspect its Compose logs."
    }
    Start-Sleep -Seconds 5
} while ((Get-Date) -lt $deadline)

throw "Health deadline (${HealthDeadlineSeconds}s) expired; container $containerId was left running for inspection."
