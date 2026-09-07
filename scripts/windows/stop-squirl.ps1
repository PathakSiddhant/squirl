# Stops Squirl — the whole thing, not just the part answering requests.
#
# Squirl now runs under a supervisor loop (start-squirl.ps1) that relaunches
# `npm start` whenever it exits. Killing only the node process that is
# listening on port 3000 would work for a few seconds and then look like this
# script had failed, because the loop would notice the exit and bring a fresh
# one straight back up. So this stops the loop's own process first — read from
# logs\squirl.pid, which it writes on every start — and `taskkill /T` takes
# the loop's whole process tree with it: the loop itself, and whatever it was
# running underneath.
#
# The port-3000 check that follows is a fallback for the case this predates —
# something started with a plain `npm start` and no supervisor at all — and
# for cleaning up if the pid file is stale.

$pidFile = 'logs\squirl.pid'
$stoppedSomething = $false

if (Test-Path $pidFile) {
    $loopPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($loopPid -and (Get-Process -Id $loopPid -ErrorAction SilentlyContinue)) {
        taskkill /PID $loopPid /T /F 2>$null | Out-Null
        Write-Host "Stopped the supervisor loop (pid $loopPid) and everything under it."
        $stoppedSomething = $true
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $conn | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host "Stopped whatever was still listening on port 3000."
    $stoppedSomething = $true
}

if (-not $stoppedSomething) {
    Write-Host "Squirl was not running."
}
