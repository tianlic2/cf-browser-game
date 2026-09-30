$ErrorActionPreference = "Stop"

$port = if ($env:DEPLOY_RUN_PORT) { $env:DEPLOY_RUN_PORT } else { "8000" }

Write-Host "Starting static server on port $port..."
& python -m http.server $port --bind 0.0.0.0
exit $LASTEXITCODE
