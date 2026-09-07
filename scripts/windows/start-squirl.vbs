' Runs start-squirl.ps1 with its window hidden.
' Launching PowerShell directly rather than a batch file, since the loop
' itself now lives in the .ps1 — see that file for why it is a loop at all.
' -ExecutionPolicy Bypass only affects this one invocation, not the machine's
' default policy, and is the same flag the README's install instructions use.
' The 0 is the hidden window style; False means "do not wait for it to exit",
' since the loop is meant to keep running for as long as Windows is signed in.
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
ps1 = """" & here & "\start-squirl.ps1"""
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & ps1, 0, False
