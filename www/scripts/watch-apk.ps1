param(
    [string]$Branch = "ci/build-apk",
    [int]$TimeoutSeconds = 1200,
    [int]$PollSeconds = 10
)

$ErrorActionPreference = 'Stop'

Write-Host "Waiting for APK on branch '$Branch'..."

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    git fetch origin $Branch | Out-Null
    $exists = git ls-tree -r origin/$Branch --name-only | Select-String -SimpleMatch 'apk/quiz-app-debug.apk' -ErrorAction SilentlyContinue
    if ($exists) {
        git pull origin $Branch | Out-Null
        if (Test-Path -LiteralPath 'apk/quiz-app-debug.apk') {
            Write-Host "APK ready at apk/quiz-app-debug.apk"
            exit 0
        }
    }
    Start-Sleep -Seconds $PollSeconds
}

Write-Error "Timed out waiting for APK on branch '$Branch' after $TimeoutSeconds seconds."
exit 1
