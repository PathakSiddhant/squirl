# Keeps Squirl running, not just launched.
#
# The version this replaces ran `npm start` once and stopped there. That is
# fine for the ordinary case — sign in, the app comes up, it runs all day —
# and silent about the one that matters: if the server ever exits on its own
# mid-session (an unhandled exception, a port conflict from something else
# grabbing 3000 first, anything), nothing brought it back. It stayed dead
# until someone happened to notice and relaunch it by hand, which for an
# "always on" app is the failure mode that actually shows up.
#
# So this is a loop rather than a single run: every time `npm start` exits,
# for any reason, it is started again. Fast failures back off rather than
# spinning — the same shape Signal's own sync scheduler uses for a failed
# YouTube call (`lib/signal/scheduler.ts`), because a thing that keeps failing
# instantly is a thing to wait longer between retries of, not hammer.
#
# Its own process id is written to logs\squirl.pid so `stop-squirl.ps1` can
# stop the *loop*, not only whatever it is currently running — killing just
# the node process here would look like it worked for the few seconds before
# this noticed and started a fresh one.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

New-Item -ItemType Directory -Force -Path 'logs' | Out-Null
$PID | Out-File -FilePath 'logs\squirl.pid' -Encoding ascii

$log = 'logs\squirl.log'
$backoffSeconds = 5
$maxBackoffSeconds = 300

# The npm run below shells out through cmd.exe for its redirection rather
# than using PowerShell's own `*>>` / `Out-File`, and that is deliberate:
# Windows PowerShell 5.1 defaults `Out-File` (which `*>>` is built on) to
# UTF-16, while `cmd.exe`'s plain `>>` is a byte-level redirect of whatever
# Node itself writes — UTF-8, same as before this script existed. Mixing the
# two in one file interleaves two encodings and the result reads as garbage
# in any plain-text viewer. `Add-Content` with no `-Encoding` matches cmd's
# behaviour, so every line in the file is written the same way.

while ($true) {
    "---- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---- starting" | Add-Content -Path $log

    $startedAt = Get-Date
    & cmd /c "npm start >> `"$log`" 2>&1"
    $ranFor = (Get-Date) - $startedAt

    # Stayed up a while, so whatever just happened was a one-off: forgive it
    # and try again at the normal five-second pace rather than carrying a
    # backoff forward from a failure that is probably unrelated.
    if ($ranFor.TotalSeconds -ge 30) {
        $backoffSeconds = 5
    } else {
        $backoffSeconds = [Math]::Min($backoffSeconds * 2, $maxBackoffSeconds)
    }

    "---- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---- exited after $([int]$ranFor.TotalSeconds)s, retrying in ${backoffSeconds}s" |
        Add-Content -Path $log

    Start-Sleep -Seconds $backoffSeconds
}
