[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $repo "package.json") -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Unexpected release version" }
$release = Join-Path $repo "release"
$kit = Join-Path $release "FlowTranslate-$version-test-kit"
$installer = Join-Path $release "FlowTranslate_${version}_x64-setup.exe"
if (-not (Test-Path -LiteralPath $installer)) { throw "Build and copy the installer to $installer first" }
New-Item -ItemType Directory -Path $kit -Force | Out-Null
Copy-Item -LiteralPath $installer -Destination $kit
$serverFiles = git -C $repo ls-files server
if ($LASTEXITCODE -ne 0) { throw "Cannot list tracked server files" }
foreach ($relative in $serverFiles) {
    $destination = Join-Path $kit $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo $relative) -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $repo "docs/ESSAIS-$version.md") -Destination (Join-Path $kit "LIRE-POUR-TESTER.md")
Copy-Item -LiteralPath (Join-Path $repo "docs/VALIDATION.md") -Destination $kit
Copy-Item -LiteralPath (Join-Path $repo "public/THIRD-PARTY-INTERACTION-LICENSES.txt") -Destination $kit
$evaluation = Join-Path $kit "evaluation"
New-Item -ItemType Directory -Path $evaluation -Force | Out-Null
Copy-Item -Path (Join-Path $release "evaluation-$version/*") -Destination $evaluation
Copy-Item -LiteralPath (Join-Path $repo "docs/evaluation/$version/README.md") -Destination $evaluation
@"
FlowTranslate $version - kit de recette Windows

1. Installer avec FlowTranslate_${version}_x64-setup.exe.
2. Sur le poste serveur, demarrer Docker Desktop (moteur Linux), puis depuis ce dossier :
   powershell -NoProfile -ExecutionPolicy Bypass -File .\server\start.ps1 -Profile fast
   powershell -NoProfile -ExecutionPolicy Bypass -File .\server\start.ps1 -Profile quality
   Python 3 et Docker/NVIDIA sont requis sur le poste serveur. Les poids sont telecharges au premier lancement.
3. Ouvrir FlowTranslate via son raccourci. Choisir langue et mode, puis Enregistrer et verifier le moteur.
4. Selectionner du texte et appuyer sur Ctrl+Alt+T. Echap ferme la bulle.

LIRE-POUR-TESTER.md contient la recette detaillee et les chemins deja installes chez Lucas.
Sur un autre poste, employer le chemin choisi par l'installateur et les fichiers du kit.
evaluation contient uniquement des resultats synthetiques, pas de textes utilisateur.
VALIDATION.md distingue tests effectues et controles manuels encore en attente.
Les services tournent uniquement en local par defaut. Fermer le client ne decharge pas les modeles.
Pour arreter uniquement ces deux moteurs sans effacer leurs caches :
docker compose -f .\server\compose.yaml --profile fast --profile quality down
"@ | Set-Content -LiteralPath (Join-Path $kit "COMMENCER.txt") -Encoding UTF8
$manifest = [ordered]@{
    version = $version
    sourceCommit = (git -C $repo rev-parse HEAD)
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    installerSha256 = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
    simulation = $false
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $kit "manifest.json") -Encoding UTF8
$archive = Join-Path $release "FlowTranslate-$version-test-kit.zip"
Compress-Archive -Path (Join-Path $kit '*') -DestinationPath $archive -Force
Get-Item -LiteralPath $archive | Select-Object FullName,Length
