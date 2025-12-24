param(
  [int]$Port = 8090
)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $here '.vitepress\dist'

if (-not (Test-Path $dist)) {
  throw "Missing build output at: $dist. Run .\build-static.ps1 first."
}

Push-Location $dist
try {
  Write-Host "Serving $dist on http://127.0.0.1:$Port" -ForegroundColor Green
  python -m http.server $Port
} finally {
  Pop-Location
}
