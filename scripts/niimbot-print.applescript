on run argv
  if (count of argv) < 2 then error "Missing NIIMBOT app name or label image path argument."

  set appName to item 1 of argv
  set labelPath to item 2 of argv

  tell application appName to activate
  delay 1.0

  tell application "System Events"
    if not (exists process appName) then error "NIIMBOT process is not available."

    tell process appName
      -- Try to create a fresh label canvas.
      keystroke "n" using {command down}
      delay 0.8

      -- Open import/open dialog and inject the generated PNG path.
      keystroke "o" using {command down}
      delay 0.8
      keystroke "G" using {command down, shift down}
      delay 0.3
      keystroke labelPath
      delay 0.2
      key code 36
      delay 0.5
      key code 36
      delay 1.0

      -- Print current label.
      keystroke "p" using {command down}
      delay 0.8
      key code 36
    end tell
  end tell

  return "PRINT_SENT"
end run
