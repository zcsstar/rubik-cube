param(
  [Parameter(Mandatory = $true)]
  [string]$Label
)

$ErrorActionPreference = "Stop"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$outDir = Join-Path $PSScriptRoot "..\store-assets\screenshots"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$remote = "/sdcard/cubist-shot.png"
$local = Join-Path $outDir ("{0}.png" -f $Label)

& $adb shell screencap -p $remote
& $adb pull $remote $local
& $adb shell rm $remote
Write-Host "Saved $local"
