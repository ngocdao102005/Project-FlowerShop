param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$buildDirectory = Join-Path $projectRoot 'build'
$classesDirectory = Join-Path $buildDirectory 'classes'
$testClassesDirectory = Join-Path $buildDirectory 'test-classes'
$packageInputDirectory = Join-Path $buildDirectory 'package-input'

$javac = (Get-Command javac -ErrorAction Stop).Source
$javaBinDirectory = Split-Path -Parent $javac
$java = Join-Path $javaBinDirectory 'java.exe'
$jar = Join-Path $javaBinDirectory 'jar.exe'

if (Test-Path -LiteralPath $buildDirectory) {
    Remove-Item -LiteralPath $buildDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $classesDirectory | Out-Null
New-Item -ItemType Directory -Path $packageInputDirectory | Out-Null

$mainSources = @(
    Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src\main\java') -Recurse -Filter '*.java' |
        ForEach-Object { $_.FullName }
)
if ($mainSources.Count -eq 0) {
    throw 'Java source files were not found.'
}

& $javac -encoding UTF-8 -d $classesDirectory @mainSources
if ($LASTEXITCODE -ne 0) {
    throw "javac failed with exit code $LASTEXITCODE."
}

$jarPath = Join-Path $buildDirectory 'FloweryStaff.jar'
& $jar --create --file $jarPath --main-class vn.flowery.staff.App -C $classesDirectory .
if ($LASTEXITCODE -ne 0) {
    throw "jar failed with exit code $LASTEXITCODE."
}
Copy-Item -LiteralPath $jarPath -Destination $packageInputDirectory

if (-not $SkipTests) {
    New-Item -ItemType Directory -Path $testClassesDirectory | Out-Null
    $testSources = @(
        Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src\test\java') -Recurse -Filter '*.java' |
            ForEach-Object { $_.FullName }
    )
    & $javac --add-modules jdk.httpserver -encoding UTF-8 `
        -d $testClassesDirectory @mainSources @testSources
    if ($LASTEXITCODE -ne 0) {
        throw "Test compilation failed with exit code $LASTEXITCODE."
    }
    & $java --add-modules jdk.httpserver -ea '-Dfile.encoding=UTF-8' `
        -cp $testClassesDirectory vn.flowery.staff.AllTests
    if ($LASTEXITCODE -ne 0) {
        throw "Tests failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Created: $jarPath"
