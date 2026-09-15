//! Short-lived clipboard transaction. Snapshot formats before touching the clipboard;
//! compare sequence numbers while holding OpenClipboard, including on restoration.
//! Unsupported owner-managed formats refuse the operation without destroying data.
use std::{ffi::c_void, ptr::null_mut, time::{Duration, Instant}};
type Handle = *mut c_void;
#[link(name = "user32")]
unsafe extern "system" {
    fn OpenClipboard(owner: Handle) -> i32;
    fn CloseClipboard() -> i32;
    fn EmptyClipboard() -> i32;
    fn EnumClipboardFormats(format: u32) -> u32;
    fn GetClipboardData(format: u32) -> Handle;
    fn SetClipboardData(format: u32, data: Handle) -> Handle;
    fn GetClipboardSequenceNumber() -> u32;
    fn RegisterClipboardFormatW(name: *const u16) -> u32;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GlobalSize(memory: Handle) -> usize;
    fn GlobalLock(memory: Handle) -> Handle;
    fn GlobalUnlock(memory: Handle) -> i32;
    fn GlobalAlloc(flags: u32, bytes: usize) -> Handle;
    fn GlobalFree(memory: Handle) -> Handle;
    fn SetLastError(error: u32);
    fn GetLastError() -> u32;
}
const LIMIT: usize = 64 * 1024 * 1024;
struct Open;
impl Open {
    fn new(owner: Handle) -> Result<Self, String> {
        let start = Instant::now();
        loop {
            if unsafe { OpenClipboard(owner) } != 0 { return Ok(Self); }
            if start.elapsed() >= Duration::from_millis(250) { return Err("Le presse-papiers est occupé.".into()); }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}
impl Drop for Open { fn drop(&mut self) { unsafe { CloseClipboard(); } } }
struct Memory(Handle);
impl Memory {
    fn new(bytes: &[u8]) -> Result<Self, String> {
        let memory = Self(unsafe { GlobalAlloc(0x42, bytes.len().max(1)) }); // MOVEABLE | ZEROINIT
        if memory.0.is_null() { return Err("Mémoire du presse-papiers indisponible.".into()); }
        let pointer = unsafe { GlobalLock(memory.0) };
        if pointer.is_null() { return Err("Lecture du presse-papiers indisponible.".into()); }
        unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), pointer.cast(), bytes.len()); GlobalUnlock(memory.0); }
        Ok(memory)
    }
    fn put(mut self, format: u32) -> Result<(), String> {
        if unsafe { SetClipboardData(format, self.0) }.is_null() { return Err("Écriture du presse-papiers indisponible.".into()); }
        self.0 = null_mut(); // ownership transferred to Windows
        Ok(())
    }
}
impl Drop for Memory { fn drop(&mut self) { if !self.0.is_null() { unsafe { GlobalFree(self.0); } } } }

pub struct Snapshot { formats: Vec<(u32, Vec<u8>)>, pub sequence: u32 }
impl Snapshot {
    pub fn capture() -> Result<Self, String> {
        let _open = Open::new(null_mut())?;
        let mut formats = Vec::new();
        let mut format = 0;
        let mut total = 0usize;
        let mut bitmap = false;
        loop {
            unsafe { SetLastError(0); }
            format = unsafe { EnumClipboardFormats(format) };
            if format == 0 {
                if unsafe { GetLastError() } != 0 { return Err("Inventaire du presse-papiers indisponible.".into()); }
                break;
            }
            // Windows synthesizes CF_BITMAP from DIB/DIBV5 (including its palette).
            if format == 2 || format == 9 { bitmap = true; continue; }
            if matches!(format, 3 | 14 | 0x80..=0x8e | 0x200..=0x2ff) {
                return Err("Ce format du presse-papiers ne peut pas être conservé. Copiez du texte puis réessayez.".into());
            }
            let handle = unsafe { GetClipboardData(format) };
            if handle.is_null() { return Err("Un format du presse-papiers est indisponible.".into()); }
            let size = unsafe { GlobalSize(handle) };
            total = total.saturating_add(size);
            if size == 0 || total > LIMIT { return Err("Le presse-papiers ne peut pas être sauvegardé sans perte.".into()); }
            let pointer = unsafe { GlobalLock(handle) };
            if pointer.is_null() { return Err("Le presse-papiers ne peut pas être sauvegardé sans perte.".into()); }
            let bytes = unsafe { std::slice::from_raw_parts(pointer.cast::<u8>(), size).to_vec() };
            unsafe { GlobalUnlock(handle); }
            formats.push((format, bytes));
        }
        if bitmap && !formats.iter().any(|(f, _)| matches!(f, 8 | 17)) {
            return Err("L’image du presse-papiers ne peut pas être conservée.".into());
        }
        Ok(Self { formats, sequence: unsafe { GetClipboardSequenceNumber() } })
    }
    pub fn put_text(&self, text: &str) -> Result<u32, String> {
        let bytes = text.encode_utf16().chain(Some(0)).flat_map(u16::to_le_bytes).collect::<Vec<_>>();
        write_formats(&[(13, bytes)], self.sequence)
    }
    pub fn restore(&self, expected: u32) -> Result<(), String> {
        write_formats(&self.formats, expected).map(|_| ())
    }
}
fn write_formats(formats: &[(u32, Vec<u8>)], expected: u32) -> Result<u32, String> {
    use windows::{core::w, Win32::UI::WindowsAndMessaging::{CreateWindowExW, DestroyWindow, HWND_MESSAGE, WINDOW_EX_STYLE, WINDOW_STYLE}};
    // Allocate before EmptyClipboard so allocation failures leave the original intact.
    let mut memory = formats.iter().map(|(f, bytes)| Memory::new(bytes).map(|m| (*f, m))).collect::<Result<Vec<_>, _>>()?;
    for name in ["ExcludeClipboardContentFromMonitorProcessing", "CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"] {
        let name = name.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        let format = unsafe { RegisterClipboardFormatW(name.as_ptr()) };
        if format == 0 { return Err("Protection du presse-papiers indisponible.".into()); }
        memory.retain(|(f, _)| *f != format);
        memory.push((format, Memory::new(&[0; 4])?));
    }
    let owner = unsafe { CreateWindowExW(WINDOW_EX_STYLE::default(), w!("STATIC"), w!(""), WINDOW_STYLE::default(), 0, 0, 0, 0, Some(HWND_MESSAGE), None, None, None) }
        .map_err(|_| "Presse-papiers temporaire indisponible.".to_string())?;
    let result = (|| {
        let _open = Open::new(owner.0)?;
        if unsafe { GetClipboardSequenceNumber() } != expected { return Err("Le presse-papiers a changé; son nouveau contenu est conservé.".into()); }
        if unsafe { EmptyClipboard() } == 0 { return Err("Le presse-papiers est occupé.".into()); }
        for (format, block) in memory { block.put(format)?; }
        Ok(unsafe { GetClipboardSequenceNumber() })
    })();
    unsafe { let _ = DestroyWindow(owner); }
    result
}

#[cfg(test)]
pub fn seed_test_formats() {
    let mut formats = vec![(13, "clipboard sentinel 🚀".encode_utf16().chain(Some(0)).flat_map(u16::to_le_bytes).collect())];
    for (name, bytes) in [("HTML Format", b"<b>synthetic clipboard</b>\0".as_slice()), ("Rich Text Format", b"{\\rtf1 synthetic clipboard}\0".as_slice())] {
        let name = name.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        formats.push((unsafe { RegisterClipboardFormatW(name.as_ptr()) }, bytes.to_vec()));
    }
    // A real 1x1 32-bit DIB (BITMAPINFOHEADER + pixel), exercise image restoration.
    let mut dib = vec![0u8; 44];
    dib[0..4].copy_from_slice(&40u32.to_le_bytes());
    dib[4..8].copy_from_slice(&1i32.to_le_bytes());
    dib[8..12].copy_from_slice(&1i32.to_le_bytes());
    dib[12..14].copy_from_slice(&1u16.to_le_bytes());
    dib[14..16].copy_from_slice(&32u16.to_le_bytes());
    dib[40..44].copy_from_slice(&[32, 64, 128, 255]);
    formats.push((8, dib));
    write_formats(&formats, unsafe { GetClipboardSequenceNumber() }).unwrap();
}
#[cfg(test)]
impl Snapshot {
    pub fn same_test_formats(&self) -> bool {
        Self::capture().is_ok_and(|after| self.formats.iter().all(|entry| after.formats.contains(entry)))
    }
}
