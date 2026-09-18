use crate::{
    settings::validate_endpoint,
    types::{Mode, Profile, StreamKind},
};
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
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<Item>, String> {
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
                .map_err(|_| "Le serveur a envoyé un flux UTF-8 invalide.".to_string())?;
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
    pub fn finish(self) -> Result<(), String> {
        if self.buffer.iter().all(u8::is_ascii_whitespace) {
            Ok(())
        } else {
            Err("Le flux du serveur s’est interrompu au milieu d’un événement.".into())
        }
    }
}

pub struct Chunk {
    pub kind: StreamKind,
    pub text: Option<String>,
    pub message: Option<String>,
}

fn api_url(base: &str, route: &str) -> Result<url::Url, String> {
    let mut url = validate_endpoint(base)?;
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

pub async fn stream<F>(
    profile: Profile,
    engine: Mode,
    instruction: String,
    text: String,
    cancel: CancellationToken,
    mut emit: F,
) -> Result<String, String>
where
    F: FnMut(Chunk) -> Result<(), String>,
{
    let endpoint = api_url(&profile.endpoint, "chat/completions")?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|_| "Impossible de créer le client HTTP.".to_string())?;
    let mut extended = true;
    let mut thinking_switch = true;
    let response = loop {
        let mut req = client.post(endpoint.clone()).json(&request_body(&profile, &instruction, &text, extended, thinking_switch));
        if !profile.api_key.is_empty() {
            req = req.bearer_auth(&profile.api_key);
        }
        if cancel.is_cancelled() {
            return Err("Traitement annulé.".into());
        }
        let response = tokio::select! {_ = cancel.cancelled()=>return Err("Traitement annulé.".into()),r=req.send()=>r.map_err(|e|unreachable_message(&profile.endpoint, &e, engine))?};
        if response.status().is_success() {
            break response;
        }
        let status = response.status().as_u16();
        // The server's own message decides the retry; it is never logged nor shown.
        let detail = response.text().await.unwrap_or_default();
        if extended && rejects_extended_sampling(status, &detail) {
            extended = false;
            continue;
        }
        if thinking_switch && rejects_thinking_switch(status, &detail) {
            thinking_switch = false;
            continue;
        }
        return Err(format!(
            "Le serveur a répondu HTTP {status}. Vérifiez l’adresse et la clé dans les Réglages."
        ));
    };
    let mut bytes = response.bytes_stream();
    let mut decoder = SseDecoder::default();
    let mut result = String::new();
    let mut filter = ThinkFilter::default();
    let mut done = false;
    let mut stop = false;
    loop {
        tokio::select! {
            _ = cancel.cancelled() => return Err("Traitement annulé.".into()),
            next = bytes.next() => match next {
                Some(Ok(part)) => for item in decoder.push(&part)? {
                    match item {
                        Item::Done => done = true,
                        Item::Data(data) => {
                            let value: Value = serde_json::from_str(&data).map_err(|_| "Le serveur a envoyé un événement JSON invalide.".to_string())?;
                            if let Some(reason) = value.pointer("/choices/0/finish_reason").and_then(Value::as_str) {
                                if reason == "stop" { stop = true; }
                                else if reason == "length" { return Err("La sortie a atteint la limite; résultat incomplet refusé.".into()); }
                                else { return Err(format!("Le serveur a interrompu la génération ({reason}).")); }
                            }
                            if let Some(delta) = value.pointer("/choices/0/delta/content").and_then(Value::as_str) {
                                let shown = filter.push(delta);
                                if !shown.is_empty() { result.push_str(&shown); emit(Chunk { kind: StreamKind::Delta, text: Some(shown), message: None })?; }
                            }
                        }
                    }
                },
                Some(Err(_)) => return Err("Le flux du serveur a été interrompu. Réessayez.".into()),
                None => break,
            }
        }
    }
    decoder.finish()?;
    let tail = filter.finish();
    if !tail.is_empty() { result.push_str(&tail); emit(Chunk { kind: StreamKind::Delta, text: Some(tail), message: None })?; }
    let result = clean_output(&result);
    if !done || !stop || result.is_empty() {
        return Err("Le serveur n’a pas confirmé une réponse complète. Réessayez.".into());
    }
    if cancel.is_cancelled() {
        return Err("Traitement annulé.".into());
    }
    Ok(result)
}

/// How far the request got. The raw reqwest text names the full URL and the transport;
/// the glass only needs the host and what to do about it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Reach {
    Timeout,
    Refused,
    Other,
}

fn host_port(endpoint: &str) -> String {
    reqwest::Url::parse(endpoint)
        .ok()
        .and_then(|url| {
            url.host_str().map(|host| match url.port() {
                Some(port) => format!("{host}:{port}"),
                None => host.to_string(),
            })
        })
        .unwrap_or_else(|| "l’adresse configurée".to_string())
}

/// « Raison. Quoi faire. », always. The colon of an `hôte:port` is an ordinary colon:
/// no non-breaking space there, whatever the interface rule says elsewhere.
fn unreachable_text(target: &str, reach: Reach, engine: Mode) -> String {
    match reach {
        Reach::Timeout => format!(
            "Le moteur {} ne répond pas. Vérifiez qu’il est démarré sur {target}.",
            engine.label()
        ),
        Reach::Refused => format!("Aucune réponse de {target}. Démarrez le serveur, puis vérifiez."),
        Reach::Other => format!(
            "Connexion au moteur {} impossible. Vérifiez son adresse dans les Réglages.",
            engine.label()
        ),
    }
}

fn unreachable_message(endpoint: &str, error: &reqwest::Error, engine: Mode) -> String {
    let reach = if error.is_timeout() {
        Reach::Timeout
    } else if error.is_connect() {
        Reach::Refused
    } else {
        Reach::Other
    };
    unreachable_text(&host_port(endpoint), reach, engine)
}

pub async fn check(profile: &Profile, engine: Mode) -> Result<(), String> {
    let endpoint = api_url(&profile.endpoint, "models")?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| "Impossible de créer le client HTTP.".to_string())?;
    let mut req = client.get(endpoint);
    if !profile.api_key.is_empty() {
        req = req.bearer_auth(&profile.api_key);
    }
    let response = req
        .send()
        .await
        .map_err(|e| unreachable_message(&profile.endpoint, &e, engine))?;
    if !response.status().is_success() {
        return Err(format!(
            "Le serveur a répondu HTTP {}. Vérifiez l’adresse et la clé dans les Réglages.",
            response.status().as_u16()
        ));
    }
    let value: Value = response
        .json()
        .await
        .map_err(|_| "Réponse /v1/models invalide. Vérifiez l’adresse dans les Réglages.".to_string())?;
    let found = value
        .get("data")
        .and_then(Value::as_array)
        .is_some_and(|v| {
            v.iter()
                .any(|m| m.get("id").and_then(Value::as_str) == Some(profile.model.as_str()))
        });
    if !found {
        return Err(format!(
            "Le modèle {} n’est pas exposé par le serveur. Choisissez-en un autre dans les Réglages.",
            profile.model
        ));
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
    fn an_unreachable_engine_is_named_and_the_host_port_keeps_an_ordinary_colon() {
        assert_eq!(
            unreachable_text("127.0.0.1:8002", Reach::Timeout, Mode::Quality),
            "Le moteur Qualité ne répond pas. Vérifiez qu’il est démarré sur 127.0.0.1:8002."
        );
        assert_eq!(
            unreachable_text("127.0.0.1:8001", Reach::Refused, Mode::Fast),
            "Aucune réponse de 127.0.0.1:8001. Démarrez le serveur, puis vérifiez."
        );
        for reach in [Reach::Timeout, Reach::Refused, Reach::Other] {
            for engine in [Mode::Fast, Mode::Quality] {
                let text = unreachable_text("127.0.0.1:8001", reach, engine);
                assert!(!text.contains('\u{00A0}'), "{text}");
                // « Raison. Quoi faire. »
                assert_eq!(text.matches(". ").count(), 1, "{text}");
                assert!(text.ends_with('.'), "{text}");
            }
        }
        assert_eq!(host_port("http://127.0.0.1:8001/v1"), "127.0.0.1:8001");
        assert_eq!(host_port("https://translate.example.test"), "translate.example.test");
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
        let engine = if mode == "fast" { Mode::Fast } else { Mode::Quality };
        check(&profile, engine).await.expect("live model discovery");
        let mut deltas = String::new();
        let result = stream(profile.clone(), engine, instruction(), "Please confirm the budget of 1250 EUR for project Orion.".into(), CancellationToken::new(), |chunk| {
            if let Some(text) = chunk.text { deltas.push_str(&text); }
            Ok(())
        }).await.expect("live native streaming translation");
        assert_eq!(result, deltas);
        assert!(result.contains("Orion") && result.contains("EUR"));
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        let cancelled = stream(profile, engine, instruction(), "Please translate this message carefully and confirm that the delivery is scheduled for Thursday morning.".into(), cancel, |chunk| {
            if chunk.text.is_some() { trigger.cancel(); }
            Ok(())
        }).await;
        assert_eq!(cancelled.unwrap_err(), "Traitement annulé.");
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
}
