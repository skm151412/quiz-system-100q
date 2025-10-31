$ErrorActionPreference = 'Stop'
Write-Host "Watching for APK in remote branch ci/build-apk..."

for ($i = 0; $i -lt 360; $i++) {
  try {
    git fetch origin ci/build-apk | Out-Null
    $exists = git ls-tree -r origin/ci/build-apk --name-only | Select-String -SimpleMatch 'apk/quiz-app-debug.apk' -ErrorAction SilentlyContinue
    if ($exists) {
      git pull origin ci/build-apk | Out-Null
      if (Test-Path -LiteralPath 'apk/quiz-app-debug.apk') {
        Write-Host "APK ready at apk/quiz-app-debug.apk"
        exit 0
      }
    }
  } catch {
    # ignore and keep watching
  }
  Start-Sleep -Seconds 10
}

Write-Error "Timeout waiting for APK"
