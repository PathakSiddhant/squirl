# Removes the auto-start entry.
#
# Squirl still runs fine afterwards with `npm start`; it just will not launch
# itself on login anymore. Your data is untouched either way, since it lives in
# data/squirl.db and has nothing to do with how the server gets started.

$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Squirl.lnk'

if (Test-Path $link) {
    Remove-Item $link -Force
    Write-Host "Auto-start removed."
} else {
    Write-Host "Auto-start was not installed."
}

# Older versions of this script used a scheduled task. Clear it if it is there.
schtasks /delete /tn "Squirl" /f 2>$null | Out-Null

Write-Host "Run 'npm start' by hand when you want Squirl running."
