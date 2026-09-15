//! Opt-in real desktop driver. Never compiled into the shipped application.
//! scripts/test-replacement-windows.mjs owns all synthetic documents and processes.
use std::io::{BufRead, BufReader, Write};
#[test]
#[ignore = "requires isolated interactive Windows desktop; run scripts/test-replacement-windows.mjs"]
fn replacement_desktop_driver() {
    let port_file = std::env::var("FLOWTRANSLATE_REPLACEMENT_PORT_FILE").expect("isolated test harness required");
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    std::fs::write(port_file, listener.local_addr().unwrap().port().to_string()).unwrap();
    let mut target = None;
    let mut clipboard = None;
    for stream in listener.incoming() {
        let mut stream = stream.unwrap();
        let mut line = String::new();
        BufReader::new(&stream).read_line(&mut line).unwrap();
        let command: serde_json::Value = serde_json::from_str(&line).unwrap();
        let response = match command["op"].as_str().unwrap() {
            "capture" | "capture-copy" => {
                target = None;
                let capture = if command["op"] == "capture-copy" {
                    crate::capture::clipboard_capture(crate::host::foreground())
                } else { crate::capture::capture_current(false, crate::host::foreground()) };
                match capture {
                    Ok(capture) => {
                        target = capture.target.as_ref().and_then(crate::capture::complete_target);
                        serde_json::json!({"ok": true, "replaceable": target.is_some(), "origin": capture.public.origin, "selected_length": capture.public.text.chars().count(), "document_length": target.as_ref().and_then(|t| t.document.as_ref().map(|d| d.chars().count())),
                            "route": target.as_ref().map(|t| if t.win32.is_some() {"win32"} else if t.copied_selection && t.document_from_value {"copy-value"} else if t.copied_selection {"copy-text"} else {"uia-paste"})})
                    }
                    Err(error) => serde_json::json!({"ok": false, "error": error}),
                }
            }
            "replace" => match target.take().ok_or("target unavailable".to_string()).and_then(|t| crate::capture::replace_automatic(&t, command["value"].as_str().unwrap())) {
                Ok(()) => serde_json::json!({"ok": true}),
                Err(error) => serde_json::json!({"ok": false, "error": error}),
            },
            "clipboard-race" => {
                let before = crate::clipboard_guard::Snapshot::capture().unwrap();
                let sequence = before.put_text("temporary synthetic result").unwrap();
                let mut other = arboard::Clipboard::new().unwrap();
                other.set_text("new synthetic user copy").unwrap();
                let refused = before.restore(sequence).is_err();
                serde_json::json!({"ok": refused && other.get_text().unwrap() == "new synthetic user copy"})
            }
            "clipboard-seed" => {
                crate::clipboard_guard::seed_test_formats();
                clipboard = Some(crate::clipboard_guard::Snapshot::capture().unwrap());
                serde_json::json!({"ok": true})
            }
            "clipboard-check" => serde_json::json!({"ok": clipboard.as_ref().unwrap().same_test_formats()}),
            "quit" => { writeln!(stream, "{{\"ok\":true}}").unwrap(); break; }
            _ => panic!("unknown test command"),
        };
        writeln!(stream, "{response}").unwrap();
    }
}
