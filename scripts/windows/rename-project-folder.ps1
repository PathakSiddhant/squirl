# Renames the project folder from whatever it is now to "Squirl".
#
# This cannot be done while the folder is open in an editor: Windows refuses to
# rename a directory that any process is holding, and a code editor holds the
# whole workspace for file watching. So run this from a plain PowerShell window
# with the editor CLOSED.
#
#   1. Close VS Code.
#   2. Right-click this file -> Run with PowerShell.  (or run it by path)
#
# It stops the server, renames the folder, repairs the login shortcut so it
# points at the new location, and starts Squirl again. Your data is inside the
# folder and moves with it, untouched.

$ErrorActionPreference = 'Stop'

$old = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$parent = Split-Path -Parent $old
$new = Join-Path $parent 'Squirl'

if ($old -eq $new) {
    Write-Host "Already named Squirl. Nothing to do."
    Read-Host "Press Enter to close"
    exit 0
}
if (Test-Path $new) {
    Write-Host "There is already a folder at $new. Move or delete it first." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Renaming:"
Write-Host "  from  $old"
Write-Host "  to    $new"
Write-Host ""

# Free the port and clear any node process still holding files in the folder.
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

try {
    Rename-Item -LiteralPath $old -NewName 'Squirl' -ErrorAction Stop
} catch {
    Write-Host ""
    Write-Host "Could not rename the folder." -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Something still has it open. The usual culprit is VS Code."
    Write-Host "Close every editor and File Explorer window showing that folder, then run this again."
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Renamed." -ForegroundColor Green

# The login shortcut stores an absolute path, so it has to be rewritten.
# The .bat and .vbs work out their own location and need no changes.
$installer = Join-Path $new 'scripts\windows\install-autostart.ps1'
if (Test-Path $installer) {
    & $installer | Out-Null
    Write-Host "Login shortcut repointed at the new folder." -ForegroundColor Green
}

# Bring Squirl back up.
$vbs = Join-Path $new 'scripts\windows\start-squirl.vbs'
if (Test-Path $vbs) {
    Start-Process wscript.exe -ArgumentList "`"$vbs`""
    Write-Host "Squirl is starting. Give it a few seconds, then open http://localhost:3000"
}

Write-Host ""
Write-Host "Done. Reopen the project in your editor at:" -ForegroundColor Green
Write-Host "  $new"
Read-Host "Press Enter to close"
