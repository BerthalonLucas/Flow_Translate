use std::{fs, path::Path};

fn main() {
    // A tiny valid ICO keeps source builds deterministic until the final artwork is supplied.
    let icon = Path::new("icons/icon.ico");
    if !icon.exists() {
        fs::create_dir_all("icons").expect("create icons directory");
        // ICO header + one 1x1 32-bit BMP image (graphite pixel).
        let bytes: [u8; 70] = [
            0,0,1,0,1,0, 1,1,0,0,1,0,32,0,48,0,0,0,22,0,0,0,
            40,0,0,0,1,0,0,0,2,0,0,0,1,0,32,0,0,0,0,0,4,0,0,0,
            0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            45,45,48,255, 0,0,0,0
        ];
        fs::write(icon, bytes).expect("write generated icon");
    }
    tauri_build::build();
}
