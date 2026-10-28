$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$mailhogDirectory = Join-Path $workspace '.cache/mailhog'
New-Item -ItemType Directory -Force -Path $mailhogDirectory | Out-Null
$executable = Join-Path $mailhogDirectory 'MailHog.exe'
if (-not (Test-Path -LiteralPath $executable)) {
  Invoke-WebRequest -Uri 'https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_windows_amd64.exe' -OutFile $executable
}
try {
  $null = Invoke-RestMethod -Uri 'http://127.0.0.1:8025/api/v2/messages' -TimeoutSec 2
  Write-Output 'MailHog is already available at http://127.0.0.1:8025'
  exit 0
} catch {}
Start-Process -FilePath $executable -ArgumentList '-smtp-bind-addr','127.0.0.1:1025','-api-bind-addr','127.0.0.1:8025','-ui-bind-addr','127.0.0.1:8025' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $mailhogDirectory 'stdout.log') -RedirectStandardError (Join-Path $mailhogDirectory 'stderr.log')
Write-Output 'MailHog started: SMTP 127.0.0.1:1025; inbox http://127.0.0.1:8025'
