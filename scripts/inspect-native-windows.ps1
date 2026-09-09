param(
    [int]$ProcessId = 0
)
# Lists the top-level HWNDs of FlowTranslate (or of one process) as JSON:
# geometry in physical pixels, window region box, caption-producing styles.
# Evidence for the frameless silhouette that a WebView screenshot cannot give.
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FlowTranslateNativeProbe {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowRgnBox(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$owners = if ($ProcessId) { @($ProcessId) } else { @(Get-Process -Name FlowTranslate -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id) }
$foreground = [FlowTranslateNativeProbe]::GetForegroundWindow()
$rows = New-Object System.Collections.Generic.List[string]
$callback = [FlowTranslateNativeProbe+EnumProc]{ param($h, $l)
  $owner = 0; [void][FlowTranslateNativeProbe]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($owners -contains [int]$owner) {
    $text = New-Object System.Text.StringBuilder 256; [void][FlowTranslateNativeProbe]::GetWindowText($h, $text, 256)
    $style = [int64][FlowTranslateNativeProbe]::GetWindowLongPtr($h, -16)
    $exStyle = [int64][FlowTranslateNativeProbe]::GetWindowLongPtr($h, -20)
    $rect = New-Object FlowTranslateNativeProbe+RECT; [void][FlowTranslateNativeProbe]::GetWindowRect($h, [ref]$rect)
    $box = New-Object FlowTranslateNativeProbe+RECT; $regionType = [FlowTranslateNativeProbe]::GetWindowRgnBox($h, [ref]$box)
    $styles = @()
    if ($style -band 0x00C00000) { $styles += 'CAPTION' }
    if ($style -band 0x00040000) { $styles += 'THICKFRAME' }
    if ($style -band 0x00080000) { $styles += 'SYSMENU' }
    if ($style -band 0x00020000) { $styles += 'MINIMIZEBOX' }
    if ($style -band 0x00010000) { $styles += 'MAXIMIZEBOX' }
    $region = if ($regionType -eq 0) { $null } else { @{ width = $box.R - $box.L; height = $box.B - $box.T } }
    $row = [ordered]@{
      hwnd = ('0x{0:X}' -f [int64]$h)
      title = $text.ToString()
      visible = [FlowTranslateNativeProbe]::IsWindowVisible($h)
      foreground = ($h -eq $foreground)
      x = $rect.L; y = $rect.T; width = $rect.R - $rect.L; height = $rect.B - $rect.T
      region = $region
      styles = $styles
      topmost = [bool]($exStyle -band 0x00000008)
    }
    $rows.Add(($row | ConvertTo-Json -Compress))
  }
  return $true }
[void][FlowTranslateNativeProbe]::EnumWindows($callback, [IntPtr]::Zero)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output ('[' + ($rows -join ',') + ']')
