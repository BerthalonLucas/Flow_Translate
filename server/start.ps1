[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("fast", "quality")]
    [string]$Profile,
    [ValidateRange(30, 3600)]
    [int]$HealthDeadlineSeconds = 900,
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"
if (-not $EnvFile) { $EnvFile = Join-Path $PSScriptRoot ".env" }
$compose = @("compose")
$preflight = @((Join-Path $PSScriptRoot "preflight.py"), "--profile", $Profile)
if (Test-Path -LiteralPath $EnvFile) {
    $resolvedEnv = (Resolve-Path -LiteralPath $EnvFile).Path
    $compose += @("--env-file", $resolvedEnv)
    $preflight += @("--env-file", $resolvedEnv)
}
$compose += @("-f", (Join-Path $PSScriptRoot "compose.yaml"), "--profile", $Profile)

& docker @compose config --quiet
if ($LASTEXITCODE -ne 0) { throw "Compose validation failed; no container was started." }

function Get-ContainerState([string]$Id) {
    $output = & docker inspect --format "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $Id
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect container $Id." }
    $value = if ($null -eq $output) { "" } else { ([string]$output).Trim() }
    if (-not $value) { throw "Docker returned no state for container $Id." }
    $parts = $value.Split("|", 2)
    return @{ Status = $parts[0]; Health = $parts[1] }
}

$containerOutput = & docker @compose ps --all -q $Profile
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the Compose service '$Profile'." }
$containerId = if ($null -eq $containerOutput) { "" } else { ([string]$containerOutput).Trim() }
$needsStart = -not $containerId
if ($containerId) {
    $state = Get-ContainerState $containerId
    if ($state.Status -eq "running" -and $state.Health -eq "healthy") {
        Write-Host "Profile '$Profile' is already healthy (container $containerId)."
        exit 0
    }
    if ($state.Status -in @("created", "exited", "dead")) {
        $needsStart = $true
    } elseif ($state.Status -ne "running") {
        throw "Existing profile '$Profile' is '$($state.Status)' (health '$($state.Health)'). It was left unchanged."
    }
}
if ($needsStart) {
    & python @preflight
    if ($LASTEXITCODE -ne 0) { throw "Preflight failed; no container was started." }
    & docker @compose up -d $Profile
    if ($LASTEXITCODE -ne 0) { throw "Compose could not start profile '$Profile'." }
    $containerOutput = & docker @compose ps -q $Profile
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect the started Compose service '$Profile'." }
    $containerId = if ($null -eq $containerOutput) { "" } else { ([string]$containerOutput).Trim() }
    if (-not $containerId) { throw "Compose did not return a container for profile '$Profile'." }
}

$deadline = (Get-Date).AddSeconds($HealthDeadlineSeconds)
do {
    $state = Get-ContainerState $containerId
    if ($state.Status -ne "running") {
        throw "Profile '$Profile' stopped with state '$($state.Status)' (health '$($state.Health)'). The container was left unchanged."
    }
    if ($state.Health -eq "healthy") {
        Write-Host "Profile '$Profile' is healthy (container $containerId)."
        exit 0
    }
    if ($state.Health -eq "unhealthy") {
        throw "Profile '$Profile' became unhealthy. Inspect its Compose logs."
    }
    Start-Sleep -Seconds 5
} while ((Get-Date) -lt $deadline)

throw "Health deadline (${HealthDeadlineSeconds}s) expired; container $containerId was left running for inspection."
