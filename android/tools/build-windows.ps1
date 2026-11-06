param(
    [string]$StageRoot = $env:TEMP
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stageParent = [IO.Path]::GetFullPath($StageRoot)
if ($stageParent -match '[^\x00-\x7F]') {
    throw 'Choose an ASCII StageRoot for the Android/Gradle Windows toolchain.'
}
if ($stageParent.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or $stageParent -eq $sourceRoot) {
    throw 'StageRoot must be outside the source project.'
}
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) {
    throw 'Set JAVA_HOME (JDK 17) and ANDROID_HOME (SDK 36) for this terminal first.'
}
$stage = Join-Path $stageParent ('spoty-android-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null

function Copy-ProjectSources([string]$From, [string]$To) {
    foreach ($entry in Get-ChildItem -LiteralPath $From -Force) {
        if ($entry.Name -in @('build', '.gradle', '.kotlin', 'local.properties', '.idea', '.git')) { continue }
        if ($entry.Name -match '\.(jks|keystore|pem)$' -or $entry.Name -eq '.env') { continue }
        $target = Join-Path $To $entry.Name
        if ($entry.PSIsContainer) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
            Copy-ProjectSources $entry.FullName $target
        } else { Copy-Item -LiteralPath $entry.FullName -Destination $target }
    }
}

Copy-ProjectSources $sourceRoot $stage
Write-Host "Building isolated source copy: $stage"
Push-Location -LiteralPath $stage
try {
    & (Join-Path $stage 'gradlew.bat') --no-daemon --console=plain :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle failed ($LASTEXITCODE). Original source remains at $sourceRoot; staged reports remain at $stage." }
} finally { Pop-Location }

$artifactRoot = Join-Path $sourceRoot 'app\build'
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
foreach ($category in @('outputs', 'reports', 'test-results')) {
    $artifact = Join-Path $stage "app\build\$category"
    if (Test-Path -LiteralPath $artifact) { Copy-Item -LiteralPath $artifact -Destination $artifactRoot -Recurse -Force }
}
Write-Host "Verified debug APK: $(Join-Path $artifactRoot 'outputs\apk\debug\app-debug.apk')"
Write-Host "Staged build retained for diagnosis: $stage"
