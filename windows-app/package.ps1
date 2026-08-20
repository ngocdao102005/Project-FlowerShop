$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$distDirectory = Join-Path $projectRoot 'dist'
$appImageDirectory = Join-Path $distDirectory 'FloweryStaff'
$packageInputDirectory = Join-Path $projectRoot 'build\package-input'

& (Join-Path $projectRoot 'build.ps1')

$javac = (Get-Command javac -ErrorAction Stop).Source
$jpackage = Join-Path (Split-Path -Parent $javac) 'jpackage.exe'
if (-not (Test-Path -LiteralPath $jpackage)) {
    throw 'The current JDK does not include jpackage. Install a full JDK 21 distribution.'
}

if (Test-Path -LiteralPath $appImageDirectory) {
    Remove-Item -LiteralPath $appImageDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $distDirectory -Force | Out-Null

& $jpackage `
    --type app-image `
    --name FloweryStaff `
    --input $packageInputDirectory `
    --dest $distDirectory `
    --main-jar FloweryStaff.jar `
    --main-class vn.flowery.staff.App `
    --app-version 1.6.1 `
    --vendor 'Nguyen Ngoc Dao' `
    --description 'Flowery Windows App cho nhan vien va quan tri' `
    --java-options '-Dfile.encoding=UTF-8'
if ($LASTEXITCODE -ne 0) {
    throw "jpackage failed with exit code $LASTEXITCODE."
}

$configTarget = Join-Path $appImageDirectory 'config'
New-Item -ItemType Directory -Path $configTarget | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'config\application.properties') `
    -Destination $configTarget
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $appImageDirectory

Write-Host "Packaged application: $appImageDirectory"
