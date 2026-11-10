[CmdletBinding()]
param(
  [string]$EC2Host = "54.81.34.210",
  [string]$User = "ec2-user",
  [string]$KeyPath = "$env:USERPROFILE\Downloads\SDMini.pem"
)

if (-not (Test-Path -LiteralPath $KeyPath)) {
  Write-Error "SSH key not found: $KeyPath"
  exit 1
}

$sshArgs = @(
  "-N",
  "-o", "ExitOnForwardFailure=yes",
  "-o", "ServerAliveInterval=30",
  "-o", "StrictHostKeyChecking=accept-new",
  "-i", $KeyPath,
  "-L", "9460:127.0.0.1:9460",
  "-L", "9461:127.0.0.1:9461",
  "-L", "9462:127.0.0.1:9462",
  "-L", "9463:127.0.0.1:9463",
  "-L", "18080:127.0.0.1:18080",
  "$User@$EC2Host"
)

Write-Host "Opening metrics tunnel to $User@$EC2Host (Ctrl+C to close)"
& ssh @sshArgs
