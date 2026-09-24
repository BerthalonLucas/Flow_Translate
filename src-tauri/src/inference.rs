use crate::{
    error::{http_status, AppError, ErrorKind},
    settings::validate_endpoint,
    types::{Profile, StreamKind},
};
use std::time::Duration;
use futures_util::StreamExt;
use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;

#[derive(Debug, PartialEq)]
pub enum Item {
    Data(String),
    Done,
}

#[derive(Default)]
pub struct SseDecoder {
    buffer: Vec<u8>,
}
impl SseDecoder {
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<Item>, AppError> {
        self.buffer.extend_from_slice(bytes);
        let mut out = Vec::new();
        loop {
            let lf = self
                .buffer
                .windows(2)
                .position(|w| w == b"\n\n")
                .map(|p| (p, 2));
            let crlf = self
                .buffer
                .windows(4)
                .position(|w| w == b"\r\n\r\n")
                .map(|p| (p, 4));
            let sep = match (lf, crlf) {
                (Some(a), Some(b)) => Some(if a.0 <= b.0 { a } else { b }),
                (Some(a), None) => Some(a),
                (None, Some(b)) => Some(b),
                (None, None) => None,
            };
            let Some((end, sep_len)) = sep else { break };
            let frame: Vec<u8> = self.buffer.drain(..end + sep_len).collect();
            let frame = String::from_utf8(frame[..end].to_vec())
                .map_err(|_| broken("Le serveur a envoyé un flux UTF-8 invalide."))?;
            let data = frame
                .lines()
                .filter_map(|l| l.strip_prefix("data:"))
                .map(str::trim_start)
                .collect::<Vec<_>>()
                .join("\n");
            if data.is_empty() {
                continue;
            }
            out.push(if data == "[DONE]" {
                Item::Done
            } else {
                Item::Data(data)
            });
        }
        Ok(out)
    }
    pub fn finish(self) -> Result<(), AppError> {
        if self.buffer.iter().all(u8::is_ascii_whitespace) {
            Ok(())
        } else {
            Err(broken("Le flux du serveur s’est interrompu au milieu d’un événement."))
        }
    }
}

pub struct Chunk {
    pub kind: StreamKind,
    pub text: Option<String>,
    pub message: Option<String>,
}

fn broken(message: &str) -> AppError {
    AppError::new(ErrorKind::StreamBroken, message)
}
fn cancelled() -> AppError {
    AppError::new(ErrorKind::Cancelled, "Traduction annulée.")
}

/// An invalid address is the address's fault: the error opens its field.
fn api_url(base: &str, route: &str) -> Result<url::Url, AppError> {
    let mut url = validate_endpoint(base).map_err(|message| AppError::new(ErrorKind::BadEndpoint, message))?;
    let path = url.path().trim_end_matches('/');
    let prefix = if path.ends_with("/v1") {
        path.to_string()
    } else {
        format!("{path}/v1")
    };
    url.set_path(&format!("{prefix}/{route}"));
    Ok(url)
}

/// Sampling fields beyond the OpenAI contract: understood by vLLM, llama.cpp and most
/// local servers. An endpoint that rejects unknown fields (the OpenAI API answers 400)
/// gets the request once more without them.
const EXTENDED_SAMPLING: [&str; 2] = ["top_k", "repetition_penalty"];
/// vLLM, SGLang and llama.cpp read `chat_template_kwargs`; it switches the thinking of
/// Qwen3 and Gemma 4 off so a small model answers with the text alone. Dropped the same
/// way when a strict endpoint names it.
const THINKING_SWITCH: &str = "chat_template_kwargs";

/// The instruction is the system message, the text the user message (0.4.0): a small
/// instruct model then transforms the text instead of answering it. Sampling is one
/// conservative setting for any LLM (correction and rewriting want little variance).
fn request_body(profile: &Profile, instruction: &str, text: &str, extended: bool, thinking_switch: bool) -> Value {
    let mut body = json!({"model":profile.model,
        "messages":[{"role":"system","content":instruction},{"role":"user","content":text}],
        "stream":true,"temperature":0.3,"top_p":0.9,"max_tokens":4096});
    if extended {
        body["top_k"] = json!(20);
        body["repetition_penalty"] = json!(1.05);
    }
    if thinking_switch {
        body[THINKING_SWITCH] = json!({"enable_thinking": false});
    }
    body
}

/// A client error whose message names one of the extended fields: strict OpenAI contract.
fn rejects_extended_sampling(status: u16, detail: &str) -> bool {
    (400..500).contains(&status) && EXTENDED_SAMPLING.iter().any(|field| detail.contains(field))
}
fn rejects_thinking_switch(status: u16, detail: &str) -> bool {
    (400..500).contains(&status) && detail.contains(THINKING_SWITCH)
}

/// Holds a leading thinking block back from the stream: `<think>…</think>` (Qwen3 without
/// a reasoning parser) or Gemma's `<|channel>thought…<channel|>`. Deltas are kept while
/// the beginning of the output may still turn into one of those markers.
#[derive(Default)]
pub struct ThinkFilter { buffer: String, state: ThinkState }
#[derive(Default, PartialEq)]
enum ThinkState { #[default] Start, Thinking(&'static str), Passing }
const THINK_MARKERS: [(&str, &str); 2] = [("<think>", "</think>"), ("<|channel>thought", "<channel|>")];
impl ThinkFilter {
    /// Returns what may be shown now.
    pub fn push(&mut self, delta: &str) -> String {
        match self.state {
            ThinkState::Passing => delta.to_string(),
            ThinkState::Thinking(_) | ThinkState::Start => {
                self.buffer.push_str(delta);
                self.drain()
            }
        }
    }
    fn drain(&mut self) -> String {
        loop {
            match self.state {
                ThinkState::Start => {
                    let head = self.buffer.trim_start();
                    if let Some((_, close)) = THINK_MARKERS.iter().find(|(open, _)| head.starts_with(open)) {
                        self.state = ThinkState::Thinking(close);
                        continue;
                    }
                    if head.is_empty() || THINK_MARKERS.iter().any(|(open, _)| open.starts_with(head)) {
                        return String::new();
                    }
                    self.state = ThinkState::Passing;
                    return std::mem::take(&mut self.buffer);
                }
                ThinkState::Thinking(close) => {
                    let Some(end) = self.buffer.find(close) else { return String::new() };
                    let rest = self.buffer[end + close.len()..].trim_start().to_string();
                    self.buffer = rest;
                    self.state = ThinkState::Start;
                    continue;
                }
                ThinkState::Passing => return std::mem::take(&mut self.buffer),
            }
        }
    }
    /// The end of the stream: an unfinished marker prefix was text after all; an
    /// unclosed thinking block is dropped.
    pub fn finish(&mut self) -> String {
        match self.state {
            ThinkState::Thinking(_) => { self.buffer.clear(); String::new() }
            _ => std::mem::take(&mut self.buffer),
        }
    }
}

/// The final result: a code fence wrapping the whole answer is removed, trailing
/// whitespace too. Quotes stay (they may belong to the text).
pub fn clean_output(text: &str) -> String {
    let trimmed = text.trim();
    if let Some(inner) = trimmed.strip_prefix("```") {
        if let Some(body) = inner.strip_suffix("```") {
            let body = body.split_once('\n').map_or("", |(_, rest)| rest);
            return body.trim_end().to_string();
        }
    }
    trimmed.to_string()
}

/// How long a connection, then a whole answer, may take (the tests shorten them).
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub connect: Duration,
    pub total: Duration,
}
impl Default for Limits {
    fn default() -> Self {
        Self { connect: Duration::from_secs(5), total: Duration::from_secs(120) }
    }
}

pub async fn stream<F>(
    profile: Profile,
    instruction: String,
    text: String,
    cancel: CancellationToken,
    emit: F,
) -> Result<String, AppError>
where
    F: FnMut(Chunk) -> Result<(), AppError>,
{
    stream_within(profile, instruction, text, cancel, Limits::default(), emit).await
}

/// Every failure carries its code (lot 10): the status of the answer, the transport, the
/// stream, the finish reason. The server's body decides a retry or a 404 and goes nowhere.
pub async fn stream_within<F>(
    profile: Profile,
    instruction: String,
    text: String,
    cancel: CancellationToken,
    limits: Limits,
    mut emit: F,
) -> Result<String, AppError>
where
    F: FnMut(Chunk) -> Result<(), AppError>,
{
    let endpoint = api_url(&profile.endpoint, "chat/completions")?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(limits.connect)
        .timeout(limits.total)
        .build()
        .map_err(|_| AppError::internal("Impossible de créer le client HTTP."))?;
    let mut extended = true;
    let mut thinking_switch = true;
    let response = loop {
        let mut req = client.post(endpoint.clone()).json(&request_body(&profile, &instruction, &text, extended, thinking_switch));
        if !profile.api_key.is_empty() {
            req = req.bearer_auth(&profile.api_key);
        }
        if cancel.is_cancelled() {
            return Err(cancelled());
        }
        let response = tokio::select! {_ = cancel.cancelled()=>return Err(cancelled()),r=req.send()=>r.map_err(|e|transport(&profile.endpoint, &e))?};
        if response.status().is_success() {
            break response;
        }
        let status = response.status().as_u16();
        // The server's own message decides the retry and the 404; it is never logged nor shown.
        let detail = response.text().await.unwrap_or_default();
        if extended && rejects_extended_sampling(status, &detail) {
            extended = false;
            continue;
        }
        if thinking_switch && rejects_thinking_switch(status, &detail) {
            thinking_switch = false;
            continue;
        }
        return Err(AppError::new(http_status(status, &detail), format!("Le serveur a répondu HTTP {status}.")));
    };
    let mut bytes = response.bytes_stream();
    let mut decoder = SseDecoder::default();
    let mut result = String::new();
    let mut filter = ThinkFilter::default();
    let mut done = false;
    let mut stop = false;
    loop {
        tokio::select! {
            _ = cancel.cancelled() => return Err(cancelled()),
            next = bytes.next() => match next {
                Some(Ok(part)) => for item in decoder.push(&part)? {
                    match item {
                        Item::Done => done = true,
                        Item::Data(data) => {
                            let value: Value = serde_json::from_str(&data).map_err(|_| broken("Le serveur a envoyé un événement JSON invalide."))?;
                            if let Some(reason) = value.pointer("/choices/0/finish_reason").and_then(Value::as_str) {
                                if reason == "stop" { stop = true; }
                                else if reason == "length" { return Err(AppError::new(ErrorKind::Length, "La sortie a atteint la limite; résultat incomplet refusé.")); }
                                // The reason is the server's word: it decides the code, never the message.
                                else { return Err(AppError::new(ErrorKind::ServerError, "Le serveur a interrompu la génération.")); }
                            }
                            if let Some(delta) = value.pointer("/choices/0/delta/content").and_then(Value::as_str) {
                                let shown = filter.push(delta);
                                if !shown.is_empty() { result.push_str(&shown); emit(Chunk { kind: StreamKind::Delta, text: Some(shown), message: None })?; }
                            }
                        }
                    }
                },
                Some(Err(error)) => return Err(if error.is_timeout() {
                    AppError::new(ErrorKind::Timeout, unreachable_message(&profile.endpoint, ErrorKind::Timeout))
                } else {
                    broken("Le flux du serveur a été interrompu.")
                }),
                None => break,
            }
        }
    }
    decoder.finish()?;
    let tail = filter.finish();
    if !tail.is_empty() { result.push_str(&tail); emit(Chunk { kind: StreamKind::Delta, text: Some(tail), message: None })?; }
    let result = clean_output(&result);
    if !done || !stop {
        return Err(broken("Le serveur n’a pas confirmé une réponse complète."));
    }
    if result.is_empty() {
        // A complete answer with nothing in it (a thinking block alone): the server's.
        return Err(AppError::new(ErrorKind::ServerError, "Le serveur n’a pas confirmé une réponse complète."));
    }
    if cancel.is_cancelled() {
        return Err(cancelled());
    }
    Ok(result)
}

/// A request that got no answer: nothing at the address (refused, unknown host, TLS, a
/// connection that never opened in time) or a server that stopped answering in time.
fn transport(endpoint: &str, error: &reqwest::Error) -> AppError {
    let kind = if error.is_timeout() && !error.is_connect() { ErrorKind::Timeout } else { ErrorKind::Unreachable };
    AppError::new(kind, unreachable_message(endpoint, kind))
}

/// The raw reqwest text names the full URL and the transport; the glass only
/// needs the host and what to do about it.
fn unreachable_message(endpoint: &str, kind: ErrorKind) -> String {
    let target = reqwest::Url::parse(endpoint)
        .ok()
        .and_then(|url| {
            url.host_str().map(|host| match url.port() {
                Some(port) => format!("{host}:{port}"),
                None => host.to_string(),
            })
        })
        .unwrap_or_else(|| "configuré".to_string());
    match kind {
        ErrorKind::Timeout => format!("Le serveur {target} ne répond pas."),
        _ => format!("Serveur {target} injoignable. Démarrez-le ou changez de profil dans les Réglages."),
    }
}

/// « Tester la connexion »: the same codes, so the settings can point at the right field.
/// A /v1/models that answers something else than a model list is not an OpenAI API there.
pub async fn check(profile: &Profile) -> Result<(), AppError> {
    let endpoint = api_url(&profile.endpoint, "models")?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| AppError::internal("Impossible de créer le client HTTP."))?;
    let mut req = client.get(endpoint);
    if !profile.api_key.is_empty() {
        req = req.bearer_auth(&profile.api_key);
    }
    let response = req
        .send()
        .await
        .map_err(|e| transport(&profile.endpoint, &e))?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        // No model is named on this route: a 404 is the address.
        return Err(AppError::new(http_status(status, ""), format!("Le serveur a répondu HTTP {status}.")));
    }
    let value: Value = response
        .json()
        .await
        .map_err(|_| AppError::new(ErrorKind::BadEndpoint, "Réponse /v1/models invalide."))?;
    let found = value
        .get("data")
        .and_then(Value::as_array)
        .is_some_and(|v| {
            v.iter()
                .any(|m| m.get("id").and_then(Value::as_str) == Some(profile.model.as_str()))
        });
    if !found {
        return Err(AppError::new(ErrorKind::ModelNotFound, format!(
            "Le modèle {} n’est pas exposé par le serveur.",
            profile.model
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::actions;

    fn instruction() -> String { actions::defaults()[0].prompt_template.clone() }

    #[test]
    fn the_instruction_is_the_system_message_and_the_extras_are_dropped_on_a_strict_endpoint() {
        let profile = Profile { endpoint: "http://127.0.0.1:8001/v1".into(), model: "m".into(), api_key: String::new() };
        let full = request_body(&profile, "Fix it.", "the txt", true, true);
        assert_eq!(full["messages"][0]["role"], "system");
        assert_eq!(full["messages"][0]["content"], "Fix it.");
        assert_eq!(full["messages"][1]["role"], "user");
        assert_eq!(full["messages"][1]["content"], "the txt");
        assert_eq!(full["top_k"], 20);
        assert_eq!(full["repetition_penalty"], 1.05);
        assert_eq!(full["chat_template_kwargs"]["enable_thinking"], false);
        let strict = request_body(&profile, "p", "t", false, false);
        assert!(strict.get("top_k").is_none());
        assert!(strict.get("repetition_penalty").is_none());
        assert!(strict.get("chat_template_kwargs").is_none());
        assert_eq!(strict["temperature"], 0.3);
        assert_eq!(strict["stream"], true);
        assert!(rejects_extended_sampling(400, "Unrecognized request argument supplied: top_k"));
        assert!(rejects_extended_sampling(422, "repetition_penalty: extra inputs are not permitted"));
        assert!(!rejects_extended_sampling(400, "model not found"));
        assert!(!rejects_extended_sampling(500, "top_k"));
        assert!(rejects_thinking_switch(400, "Unrecognized request argument supplied: chat_template_kwargs"));
        assert!(!rejects_thinking_switch(400, "top_k"));
    }
    #[test]
    fn a_leading_thinking_block_is_held_back_and_the_answer_streams_after_it() {
        let mut filter = ThinkFilter::default();
        assert_eq!(filter.push("<thi"), "");
        assert_eq!(filter.push("nk>\nlet me see"), "");
        assert_eq!(filter.push(" more</think>\n\nBonjour"), "Bonjour");
        assert_eq!(filter.push(" le monde"), " le monde");
        assert_eq!(filter.finish(), "");
        let mut gemma = ThinkFilter::default();
        assert_eq!(gemma.push("<|channel>thought\nhmm<channel|>Salut"), "Salut");
        let mut plain = ThinkFilter::default();
        assert_eq!(plain.push("<"), "");
        assert_eq!(plain.push("bold>"), "<bold>");
        let mut cut = ThinkFilter::default();
        assert_eq!(cut.push("<think>never closed"), "");
        assert_eq!(cut.finish(), "");
        let mut prefix = ThinkFilter::default();
        assert_eq!(prefix.push("<th"), "");
        assert_eq!(prefix.finish(), "<th");
    }
    #[test]
    fn the_final_text_loses_a_wrapping_fence_and_trailing_space_but_keeps_its_quotes() {
        assert_eq!(clean_output("```text\nBonjour\n```"), "Bonjour");
        assert_eq!(clean_output("```\nBonjour\n```\n"), "Bonjour");
        assert_eq!(clean_output("« Bonjour »  \n"), "« Bonjour »");
        assert_eq!(clean_output("\n\nBonjour\nmonde\n"), "Bonjour\nmonde");
    }
    #[tokio::test]
    #[ignore = "requires a running local FlowTranslate vLLM profile"]
    async fn live_vllm_stream_and_cancel() {
        let mode = std::env::var("FLOWTRANSLATE_TEST_PROFILE").unwrap_or_else(|_| "fast".into());
        assert!(matches!(mode.as_str(), "fast" | "quality"));
        let profile = Profile {
            endpoint: format!("http://127.0.0.1:{}/v1", if mode == "fast" { 8001 } else { 8002 }),
            model: format!("flowtranslate-{mode}"),
            api_key: String::new(),
        };
        check(&profile).await.expect("live model discovery");
        let mut deltas = String::new();
        let result = stream(profile.clone(), instruction(), "Please confirm the budget of 1250 EUR for project Orion.".into(), CancellationToken::new(), |chunk| {
            if let Some(text) = chunk.text { deltas.push_str(&text); }
            Ok(())
        }).await.expect("live native streaming translation");
        assert_eq!(result, deltas);
        assert!(result.contains("Orion") && result.contains("EUR"));
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        let cancelled = stream(profile, instruction(), "Please translate this message carefully and confirm that the delivery is scheduled for Thursday morning.".into(), cancel, |chunk| {
            if chunk.text.is_some() { trigger.cancel(); }
            Ok(())
        }).await;
        assert_eq!(cancelled.unwrap_err().kind, ErrorKind::Cancelled);
    }
    #[test]
    fn fragmented_utf8_and_frames() {
        let mut d = SseDecoder::default();
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"é\"}}]}\n\n".as_bytes();
        let split = line.iter().position(|b| *b == 0xc3).unwrap() + 1;
        assert!(d.push(&line[..split]).unwrap().is_empty());
        assert_eq!(d.push(&line[split..]).unwrap().len(), 1);
        assert!(d.finish().is_ok());
    }
    #[test]
    fn truncated_frame_refused() {
        let mut d = SseDecoder::default();
        d.push(b"data: {\"x\":").unwrap();
        assert!(d.finish().is_err());
    }
    #[test]
    fn v1_is_not_duplicated() {
        assert_eq!(
            api_url("http://127.0.0.1:8001/v1", "models")
                .unwrap()
                .as_str(),
            "http://127.0.0.1:8001/v1/models"
        );
    }
    #[test]
    fn crlf_frame_is_supported() {
        let mut d = SseDecoder::default();
        assert_eq!(d.push(b"data: [DONE]\r\n\r\n").unwrap(), vec![Item::Done]);
    }

    // A fake OpenAI server (lot 10): every connection gets the same raw answer, after its
    // request was read; `hold` keeps the connection open without answering (a server that
    // stopped). Nothing real is ever contacted: 127.0.0.1 only, a port of our own.
    fn fake_server(answer: Vec<u8>, hold: bool) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for connection in listener.incoming() {
                let Ok(mut connection) = connection else { break };
                let answer = answer.clone();
                std::thread::spawn(move || {
                    let mut head = Vec::new();
                    let mut byte = [0u8; 1];
                    while !head.ends_with(b"\r\n\r\n") && connection.read(&mut byte).is_ok_and(|n| n == 1) { head.push(byte[0]); }
                    let length = String::from_utf8_lossy(&head).lines()
                        .find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap_or(0)))
                        .unwrap_or(0);
                    let mut body = vec![0u8; length];
                    let _ = connection.read_exact(&mut body);
                    if hold { std::thread::sleep(std::time::Duration::from_secs(5)); return; }
                    let _ = connection.write_all(&answer);
                    let _ = connection.flush();
                });
            }
        });
        format!("http://127.0.0.1:{port}/v1")
    }
    fn status(code: u16, body: &str) -> Vec<u8> {
        format!("HTTP/1.1 {code} Status\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).into_bytes()
    }
    fn events(body: &str) -> Vec<u8> {
        format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n{body}").into_bytes()
    }
    const DELTA: &str = "data: {\"choices\":[{\"delta\":{\"content\":\"Bonjour\"}}]}\n\n";
    fn finish(reason: &str) -> String {
        format!("data: {{\"choices\":[{{\"delta\":{{}},\"finish_reason\":\"{reason}\"}}]}}\n\n")
    }
    fn profile(endpoint: String) -> Profile {
        Profile { endpoint, model: "m".into(), api_key: String::new() }
    }
    async fn run_with(endpoint: String, cancel: CancellationToken, limits: Limits) -> Result<String, AppError> {
        stream_within(profile(endpoint), "Fix it.".into(), "texte".into(), cancel, limits, |_| Ok(())).await
    }
    async fn run(endpoint: String) -> Result<String, AppError> {
        run_with(endpoint, CancellationToken::new(), Limits { connect: Duration::from_secs(2), total: Duration::from_secs(5) }).await
    }
    async fn code(endpoint: String) -> ErrorKind {
        run(endpoint).await.expect_err("an error").kind
    }

    #[tokio::test]
    async fn every_server_failure_carries_its_code_and_never_the_servers_words() {
        // The complete answer first: no code at all.
        let ok = fake_server(events(&format!("{DELTA}{}data: [DONE]\n\n", finish("stop"))), false);
        assert_eq!(run(ok).await.unwrap(), "Bonjour");
        // Statuses: the body only splits the 404, and never reaches the message.
        let secret = "The model `m` does not exist. SECRET-BODY";
        for (answer, expected) in [
            (status(401, "{}"), ErrorKind::Unauthorized),
            (status(403, "{}"), ErrorKind::Unauthorized),
            (status(404, &format!("{{\"message\":\"{secret}\"}}")), ErrorKind::ModelNotFound),
            (status(404, "{\"detail\":\"Not Found\"}"), ErrorKind::BadEndpoint),
            (status(301, ""), ErrorKind::BadEndpoint),
            (status(429, "{}"), ErrorKind::Busy),
            (status(503, "{}"), ErrorKind::Busy),
            (status(500, "{}"), ErrorKind::ServerError),
            (status(400, "{\"error\":\"bad request\"}"), ErrorKind::ServerError),
        ] {
            let error = run(fake_server(answer, false)).await.expect_err("a refused request");
            assert_eq!(error.kind, expected);
            assert!(!error.message.contains("SECRET") && !error.message.contains("model `m`"), "the body stays out of the message");
        }
        // The stream: the token limit, another finish reason (the server's word stays out),
        // an unreadable event, a cut in the middle of an event, no [DONE], a body cut short.
        assert_eq!(code(fake_server(events(&format!("{DELTA}{}", finish("length"))), false)).await, ErrorKind::Length);
        let filtered = run(fake_server(events(&format!("{DELTA}{}", finish("content_filter"))), false)).await.unwrap_err();
        assert_eq!(filtered.kind, ErrorKind::ServerError);
        assert!(!filtered.message.contains("content_filter"));
        assert_eq!(code(fake_server(events("data: {not json}\n\n"), false)).await, ErrorKind::StreamBroken);
        assert_eq!(code(fake_server(events(&format!("{DELTA}data: {{\"choices\":")), false)).await, ErrorKind::StreamBroken);
        assert_eq!(code(fake_server(events(DELTA), false)).await, ErrorKind::StreamBroken);
        let short = format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: 4000\r\n\r\n{DELTA}").into_bytes();
        assert_eq!(code(fake_server(short, false)).await, ErrorKind::StreamBroken);
        // A complete answer with nothing in it (a thinking block alone).
        let empty = "data: {\"choices\":[{\"delta\":{\"content\":\"<think>hmm</think>\"}}]}\n\n";
        assert_eq!(code(fake_server(events(&format!("{empty}{}data: [DONE]\n\n", finish("stop"))), false)).await, ErrorKind::ServerError);
    }

    #[tokio::test]
    async fn transport_cancellation_and_our_own_failures_carry_their_codes() {
        // Nothing listens: a port taken then released.
        let closed = { let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap(); listener.local_addr().unwrap().port() };
        assert_eq!(code(format!("http://127.0.0.1:{closed}/v1")).await, ErrorKind::Unreachable);
        // A server that accepts and never answers.
        let silent = fake_server(Vec::new(), true);
        let timeout = run_with(silent, CancellationToken::new(), Limits { connect: Duration::from_secs(2), total: Duration::from_millis(400) }).await.unwrap_err();
        assert_eq!(timeout.kind, ErrorKind::Timeout);
        // An invalid address, and a remote one without HTTPS.
        assert_eq!(code("pas une adresse".into()).await, ErrorKind::BadEndpoint);
        assert_eq!(code("http://example.com/v1".into()).await, ErrorKind::BadEndpoint);
        // Cancelled before the request left.
        let cancel = CancellationToken::new();
        cancel.cancel();
        let ok = fake_server(events(&format!("{DELTA}{}data: [DONE]\n\n", finish("stop"))), false);
        assert_eq!(run_with(ok.clone(), cancel, Limits::default()).await.unwrap_err().kind, ErrorKind::Cancelled);
        // The display failed on our side while the answer streamed.
        let ours = stream_within(profile(ok), "p".into(), "t".into(), CancellationToken::new(), Limits::default(), |_| Err(AppError::internal("Flux d’affichage indisponible."))).await;
        assert_eq!(ours.unwrap_err().kind, ErrorKind::Internal);
    }

    #[tokio::test]
    async fn the_connection_test_points_at_the_field_to_fix() {
        let models = |ids: &str| status(200, &format!("{{\"data\":[{ids}]}}"));
        assert!(check(&profile(fake_server(models("{\"id\":\"m\"}"), false))).await.is_ok());
        let missing = check(&profile(fake_server(models("{\"id\":\"other\"}"), false))).await.unwrap_err();
        assert_eq!(missing.kind, ErrorKind::ModelNotFound);
        assert_eq!(check(&profile(fake_server(status(401, "{}"), false))).await.unwrap_err().kind, ErrorKind::Unauthorized);
        assert_eq!(check(&profile(fake_server(status(404, "{\"detail\":\"model\"}"), false))).await.unwrap_err().kind, ErrorKind::BadEndpoint);
        assert_eq!(check(&profile(fake_server(status(200, "<html>"), false))).await.unwrap_err().kind, ErrorKind::BadEndpoint);
    }
}
