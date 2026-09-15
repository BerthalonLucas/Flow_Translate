param(
    [Parameter(Mandatory)][ValidateSet('launch', 'find', 'focus', 'keys', 'hotkey', 'setClipboard', 'getClipboard', 'foreground', 'kill', 'cursor')][string]$Action,
    [string]$Path = '',
    [string[]]$Arguments = @(),
    [int]$ProcessId = 0,
    [string]$Text = '',
    [string]$Point = ''
)
# Native side of scripts/capture-matrix.mjs: starts a target application on synthetic
# text, brings it to the foreground, presses keys (System.Windows.Forms.SendKeys, which
# injects through SendInput like a user), reads or sets the clipboard and reports the
# foreground window class. It never reads user documents: every text comes from the
# orchestrator. Output is one JSON object per call.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FlowTranslateMatrix {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
}
"@
function Foreground {
  $h = [FlowTranslateMatrix]::GetForegroundWindow()
  $class = New-Object System.Text.StringBuilder 256; [void][FlowTranslateMatrix]::GetClassName($h, $class, 256)
  $title = New-Object System.Text.StringBuilder 512; [void][FlowTranslateMatrix]::GetWindowText($h, $title, 512)
  $processId = [uint32]0; [void][FlowTranslateMatrix]::GetWindowThreadProcessId($h, [ref]$processId)
  [ordered]@{ hwnd = ('0x{0:X}' -f $h.ToInt64()); class = $class.ToString(); title = $title.ToString(); processId = [int]$processId }
}
switch ($Action) {
  'launch' {
    $process = if ($Arguments.Count) { Start-Process -FilePath $Path -ArgumentList $Arguments -PassThru } else { Start-Process -FilePath $Path -PassThru }
    [ordered]@{ processId = $process.Id } | ConvertTo-Json -Compress
  }
  'find' {
    $deadline = (Get-Date).AddSeconds(20); $found = $null
    while ((Get-Date) -lt $deadline -and -not $found) { $found = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match $Text } | Select-Object -First 1; if (-not $found) { Start-Sleep -Milliseconds 300 } }
    [ordered]@{ processId = $(if ($found) { $found.Id } else { 0 }) } | ConvertTo-Json -Compress
  }
  'focus' {
    $deadline = (Get-Date).AddSeconds(15)
    $done = $false
    while ((Get-Date) -lt $deadline -and -not $done) {
      $window = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
      if ($window) {
        [void][FlowTranslateMatrix]::ShowWindow($window.MainWindowHandle, 9)
        try { [Microsoft.VisualBasic.Interaction]::AppActivate($ProcessId) } catch { [void][FlowTranslateMatrix]::SetForegroundWindow($window.MainWindowHandle) }
        Start-Sleep -Milliseconds 300
        $done = (Foreground).processId -eq $ProcessId
      }
      if (-not $done) { Start-Sleep -Milliseconds 250 }
    }
    (Foreground) + [ordered]@{ focused = $done } | ConvertTo-Json -Compress
  }
  'keys' { [System.Windows.Forms.SendKeys]::SendWait($Text); Start-Sleep -Milliseconds 120; Foreground | ConvertTo-Json -Compress }
  'hotkey' { [System.Windows.Forms.SendKeys]::SendWait('^%t'); [ordered]@{ sentAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress }
  'setClipboard' { Set-Clipboard -Value $Text; [ordered]@{ set = $true } | ConvertTo-Json -Compress }
  'getClipboard' { $value = Get-Clipboard -Raw -ErrorAction SilentlyContinue; [ordered]@{ text = "$value" } | ConvertTo-Json -Compress }
  'foreground' { Foreground | ConvertTo-Json -Compress }
  'kill' { Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue; [ordered]@{ killed = $true } | ConvertTo-Json -Compress }
  'cursor' { $parts = $Point.Split(','); [void][FlowTranslateMatrix]::SetCursorPos([int]$parts[0], [int]$parts[1]); [ordered]@{ moved = $true } | ConvertTo-Json -Compress }
}
