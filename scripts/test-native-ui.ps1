param(
    [string]$Executable = "$env:USERPROFILE\Apps\FlowTranslate\FlowTranslate.exe",
    [int]$Port = 9227,
    [string]$OutputDirectory = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'release\native-ui-probe' }
$resolvedExe = (Resolve-Path -LiteralPath $Executable).Path
if (Get-Process -Name FlowTranslate -ErrorAction SilentlyContinue) {
    throw 'Fermez FlowTranslate avant ce test : le contrôle ne doit pas rejoindre une session utilisateur existante.'
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Le port $Port est occupé. Choisissez un autre port."
}
$previousArgs = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$previousData = $env:WEBVIEW2_USER_DATA_FOLDER
$previousEndpoint = $env:FLOWTRANSLATE_CDP_URL
$testProcess = $null
try {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
    $env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $projectRoot "release\native-profiles\$([guid]::NewGuid())"
    $env:FLOWTRANSLATE_CDP_URL = "http://127.0.0.1:$Port"
    $testProcess = Start-Process -FilePath $resolvedExe -ArgumentList '--demo-selection' -WindowStyle Hidden -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $null = Invoke-RestMethod "$env:FLOWTRANSLATE_CDP_URL/json/version" -TimeoutSec 1; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw 'WebView2 ne répond pas sur le port de test.' }
    & node (Join-Path $PSScriptRoot 'probe-native-ui.mjs') $OutputDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Le test WebView2 a échoué. Voir la sortie précédente.' }
} finally {
    # Only stop the process launched by this test, never all FlowTranslate processes.
    if ($testProcess -and -not $testProcess.HasExited) { $testProcess.Kill(); $testProcess.WaitForExit(5000) | Out-Null }
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArgs
    $env:WEBVIEW2_USER_DATA_FOLDER = $previousData
    $env:FLOWTRANSLATE_CDP_URL = $previousEndpoint
}
