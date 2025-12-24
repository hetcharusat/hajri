param(
  [string]$NodeVersion = '20.19.5'
)

$nodeExe = Join-Path $env:APPDATA "nvm\v$NodeVersion\node.exe"
if (-not (Test-Path $nodeExe)) {
  throw "Node v$NodeVersion not found at: $nodeExe. Install via nvm-windows (e.g. `nvm install $NodeVersion`)."
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $here
try {
  & $nodeExe .\node_modules\vitepress\bin\vitepress.js build .
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $dist = Join-Path $here '.vitepress\dist'
  Write-Host "\nStatic site built to: $dist" -ForegroundColor Green
} finally {
  Pop-Location
}
