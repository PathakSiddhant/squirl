# Stops whatever is serving Squirl on port 3000.
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $conn | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host "Stopped Squirl."
} else {
    Write-Host "Squirl was not running."
}
