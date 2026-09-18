//! The `Run` value of the notification area's « Lancer à l'ouverture de session ».
//!
//! The plugin names the value after `productName`. The product is about to be renamed,
//! so the name is frozen here, in the version that still carries the old one: a renamed
//! build would otherwise write a second value, leave `Run\FlowTranslate` launching a
//! stale executable, and make `disable()` fail on a value that is no longer there.
//!
//! Nothing reconciled the value with the settings until 0.5.0 — the only switch was in
//! `save_settings`. Reconciliation now goes both ways, because settings recovered from
//! an unreadable file come back with `autostart: false` while Windows keeps launching
//! the application, and a box that is unticked is never toggled.

use crate::settings::SettingsOrigin;
use crate::types::Settings;

/// Frozen: independent of `productName`, so the rename holds in one small commit.
pub const RUN_NAME: &str = "FlowTranslate";

/// What the `Run` value looks like when the application starts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RunValue {
    Absent,
    /// Present, and its command points at the executable that is running.
    Ours,
    /// Present, and pointing somewhere else (an older install, another folder).
    Elsewhere,
}

/// What to do about it. `write` re-enables through the plugin; `adopt` believes the
/// value instead of the settings.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Reconciliation {
    pub write: bool,
    pub adopt: bool,
}

pub fn reconcile(origin: SettingsOrigin, autostart: bool, run: RunValue) -> Reconciliation {
    match (origin, autostart, run) {
        // Settings we trust, asking for autostart: the value must exist and point here.
        (SettingsOrigin::Disk, true, RunValue::Ours) => Reconciliation::default(),
        (SettingsOrigin::Disk, true, _) => Reconciliation { write: true, adopt: false },
        // Settings we fell back to: the value is the only truth left. The box then says
        // yes, tells the truth, and can be unticked — a toggle only fires on a change.
        (SettingsOrigin::Recovered, false, RunValue::Ours) => Reconciliation { write: false, adopt: true },
        (SettingsOrigin::Recovered, true, RunValue::Ours) => Reconciliation::default(),
        (SettingsOrigin::Recovered, true, _) => Reconciliation { write: true, adopt: false },
        // Trusted settings that do not want autostart: nothing is written, ever.
        _ => Reconciliation::default(),
    }
}

/// Raises the flag in memory. `true` means the settings must be written back, so the
/// tick survives the next start.
pub fn apply(settings: &mut Settings, decision: Reconciliation) -> bool {
    if decision.adopt && !settings.autostart {
        settings.autostart = true;
        return true;
    }
    false
}

/// The command stored in `Run` starts with the executable, quoted when it holds a space.
/// Windows compares paths without case.
pub fn classify(command: Option<&str>, exe: &std::path::Path) -> RunValue {
    let Some(command) = command else { return RunValue::Absent };
    let command = command.trim();
    if command.is_empty() {
        return RunValue::Absent;
    }
    let path = if let Some(rest) = command.strip_prefix('"') {
        rest.split('"').next().unwrap_or_default()
    } else {
        command.split_whitespace().next().unwrap_or_default()
    };
    if path.eq_ignore_ascii_case(&exe.to_string_lossy()) {
        RunValue::Ours
    } else {
        RunValue::Elsewhere
    }
}

/// Reads `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. An unreadable value is
/// simply absent: nothing here is worth failing a start for.
#[cfg(windows)]
pub fn read_run_value() -> Option<String> {
    use windows::core::{w, PCWSTR};
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};
    let name = RUN_NAME.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut buffer = [0u16; 1024];
    let mut size = (buffer.len() * 2) as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run"),
            PCWSTR(name.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut size),
        )
    };
    if status.is_err() {
        return None;
    }
    let len = (size as usize / 2).min(buffer.len());
    let text = String::from_utf16_lossy(&buffer[..len]);
    Some(text.trim_end_matches('\0').to_string())
}

#[cfg(not(windows))]
pub fn read_run_value() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn a_recovered_file_lets_the_run_value_speak() {
        // The exact case of the brief: the file was discarded, no backup loaded, so the
        // settings say `autostart: false` while Windows still launches the application.
        let decision = reconcile(SettingsOrigin::Recovered, false, RunValue::Ours);
        assert_eq!(decision, Reconciliation { write: false, adopt: true });
        let mut settings = Settings::default();
        assert!(!settings.autostart);
        assert!(apply(&mut settings, decision));
        assert!(settings.autostart);
        // Nothing is adopted from a value that points elsewhere, or from no value.
        for run in [RunValue::Absent, RunValue::Elsewhere] {
            assert_eq!(reconcile(SettingsOrigin::Recovered, false, run), Reconciliation::default());
        }
    }

    #[test]
    fn trusted_settings_rewrite_a_missing_or_stale_value_and_never_more() {
        assert!(reconcile(SettingsOrigin::Disk, true, RunValue::Absent).write);
        assert!(reconcile(SettingsOrigin::Disk, true, RunValue::Elsewhere).write);
        assert_eq!(reconcile(SettingsOrigin::Disk, true, RunValue::Ours), Reconciliation::default());
        // Autostart off with settings we trust: nothing is written, whatever `Run` holds.
        for run in [RunValue::Absent, RunValue::Ours, RunValue::Elsewhere] {
            assert_eq!(reconcile(SettingsOrigin::Disk, false, run), Reconciliation::default());
        }
        let mut settings = Settings::default();
        assert!(!apply(&mut settings, reconcile(SettingsOrigin::Disk, true, RunValue::Absent)));
        assert!(!settings.autostart);
    }

    #[test]
    fn the_command_is_read_back_to_its_executable() {
        let exe = PathBuf::from(r"C:\Program Files\FlowTranslate\FlowTranslate.exe");
        assert_eq!(classify(Some(r#""C:\Program Files\FlowTranslate\FlowTranslate.exe" --hidden"#), &exe), RunValue::Ours);
        // Unquoted, so without a space in the path — and Windows ignores case.
        let plain = PathBuf::from(r"C:\Apps\FlowTranslate\FlowTranslate.exe");
        assert_eq!(classify(Some(r"C:\APPS\FLOWTRANSLATE\FLOWTRANSLATE.EXE --hidden"), &plain), RunValue::Ours);
        assert_eq!(classify(Some(r#""C:\Old\FlowTranslate.exe""#), &exe), RunValue::Elsewhere);
        assert_eq!(classify(Some("   "), &exe), RunValue::Absent);
        assert_eq!(classify(None, &exe), RunValue::Absent);
    }
}
