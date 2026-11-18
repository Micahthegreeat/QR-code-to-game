$ErrorActionPreference = "Stop"
$destination = Join-Path $env:USERPROFILE ".vscode/extensions/local.qg-language-1.0.0"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot "qg-language/*") -Destination $destination -Recurse -Force
Write-Host "QG installed. Restart VS Code."
