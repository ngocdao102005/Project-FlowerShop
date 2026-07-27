$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$jarPath = Join-Path $projectRoot 'build\FloweryStaff.jar'

if (-not (Test-Path -LiteralPath $jarPath)) {
    & (Join-Path $projectRoot 'build.ps1')
}

$java = (Get-Command java -ErrorAction Stop).Source
Push-Location $projectRoot
try {
    & $java '-Dfile.encoding=UTF-8' -jar $jarPath
} finally {
    Pop-Location
}
