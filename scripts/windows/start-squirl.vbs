' Runs start-squirl.bat with its console window hidden.
' cmd.exe would otherwise flash a black terminal on every login.
' The 0 is the hidden window style; False means "do not wait for it to exit",
' since the server is meant to keep running.
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & here & "\start-squirl.bat""", 0, False
