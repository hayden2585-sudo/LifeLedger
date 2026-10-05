<#
  LifeLedger GitHub release updater — prepared for universal distribution.
  Usage:
    .\tools\update-from-github.ps1 -Repo 'OWNER/REPOSITORY'
    .\tools\update-from-github.ps1 -Repo 'OWNER/REPOSITORY' -Apply
  The script never uploads local data and does not modify LifeLedger backups.
#>
param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [switch]$Apply,
  [string]$DownloadDir = "$env:TEMP\LifeLedgerUpdate"
)
$ErrorActionPreference='Stop'
$api="https://api.github.com/repos/$Repo/releases/latest"
$release=Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent'='LifeLedger-Updater' }
$latest=$release.tag_name.TrimStart('v')
Write-Host "Latest LifeLedger release: $latest"
$assetName="LifeLedger Setup $latest.exe"
$asset=$release.assets | Where-Object name -eq $assetName | Select-Object -First 1
if(-not $asset){ throw "Release asset not found: $assetName" }
$current=$null
$installCandidates=@(
  "$env:LOCALAPPDATA\Programs\LifeLedger\LifeLedger.exe",
  "$env:LOCALAPPDATA\LifeLedger\LifeLedger.exe"
)
foreach($p in $installCandidates){ if(Test-Path $p){$current=(Get-Item $p).VersionInfo.ProductVersion;break} }
if($current){
  try{ if([version]$latest -le [version]$current){ Write-Host "Already current: $current"; exit 0 } }catch{}
}
New-Item -ItemType Directory -Force $DownloadDir | Out-Null
$installer=Join-Path $DownloadDir $assetName
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer
$checks=$release.assets | Where-Object name -eq 'SHA256SUMS.txt' | Select-Object -First 1
if($checks){
  $sumFile=Join-Path $DownloadDir 'SHA256SUMS.txt'
  Invoke-WebRequest -Uri $checks.browser_download_url -OutFile $sumFile
  $expected=(Select-String -Path $sumFile -Pattern ([regex]::Escape($assetName))).Line.Split(' ')[0].ToLower()
  $actual=(Get-FileHash -Algorithm SHA256 -Path $installer).Hash.ToLower()
  if($expected -and $expected -ne $actual){ throw "SHA-256 mismatch for $assetName" }
  Write-Host "SHA-256 verified."
}else{ Write-Warning 'No SHA256SUMS.txt published; refusing automatic install.'; exit 2 }
if(-not $Apply){
  Write-Host "Downloaded and verified: $installer"
  Write-Host 'Preview mode only. Re-run with -Apply to launch the installer.'
  exit 0
}
Write-Host "Launching $assetName ..."
Start-Process -FilePath $installer -Wait
Write-Host 'Installer completed. Re-run this script to verify the installed version.'