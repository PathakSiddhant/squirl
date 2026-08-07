# Makes Squirl start silently whenever you sign in to Windows.
#
# Uses the per-user Startup folder rather than Task Scheduler. Task Scheduler
# is the tidier mechanism, but creating a task needs privileges this account
# does not have, and the Startup folder needs none at all. Re-running this
# script is safe: it overwrites the existing entry.

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $here 'start-squirl.vbs'
$startup = [Environment]::GetFolderPath('Startup')
$link = Join-Path $startup 'Squirl.lnk'

if (-not (Test-Path $vbs)) {
    Write-Error "Cannot find $vbs"
    exit 1
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = 'wscript.exe'
$shortcut.Arguments = "`"$vbs`""
$shortcut.WorkingDirectory = Split-Path -Parent (Split-Path -Parent $here)
$shortcut.Description = 'Starts the Squirl money ledger in the background'
$shortcut.Save()

Write-Host "Installed."
Write-Host "Squirl will start on its own every time you sign in, with no window."
Write-Host "Shortcut: $link"
Write-Host "Logs:     $(Join-Path (Split-Path -Parent (Split-Path -Parent $here)) 'logs\squirl.log')"
Write-Host ""
Write-Host "To undo it later, run uninstall-autostart.ps1 or just delete that shortcut."
