use crate::{
    settings::validate_endpoint,
    types::{Language, Profile, StreamKind},
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

pub async fn stream<F>(
    profile: Profile,
    text: String,
    lang: Language,
    cancel: CancellationToken,
    mut emit: F,
) -> Result<String, String>
where
    F: FnMut(Chunk) -> Result<(), String>,
{
    let endpoint = api_url(&profile.endpoint, "chat/completions")?;
    let target = match lang {
        Language::Fr => "French",
        Language::En => "English",
    };
    let prompt = format!("Translate the text below into {target}. Return only the translation, preserving tone, formatting, names, numbers, and links.\n\n{text}");
    let body = json!({"model":profile.model,"messages":[{"role":"user","content":prompt}],"stream":true,
        "temperature":0.7,"top_p":0.8,"top_k":20,"repetition_penalty":1.05,"max_tokens":4096});
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|_| "Impossible de créer le client HTTP.".to_string())?;
    let mut req = client.post(endpoint).json(&body);
    if !profile.api_key.is_empty() {
        req = req.bearer_auth(&profile.api_key);
    }
    if cancel.is_cancelled() {
        return Err("Traduction annulée.".into());
    }
    let response = tokio::select! {_ = cancel.cancelled()=>return Err("Traduction annulée.".into()),r=req.send()=>r.map_err(|e|format!("Connexion au serveur impossible: {e}"))?};
    if !response.status().is_success() {
        return Err(format!(
            "Le serveur a répondu HTTP {}.",
            response.status().as_u16()
        ));
    }
    let mut bytes = response.bytes_stream();
    let mut decoder = SseDecoder::default();
    let mut result = String::new();
    let mut done = false;
    let mut stop = false;
    loop {
        tokio::select! {
            _ = cancel.cancelled() => return Err("Traduction annulée.".into()),
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
                                result.push_str(delta); emit(Chunk { kind: StreamKind::Delta, text: Some(delta.into()), message: None })?;
                            }
                        }
                    }
                },
                Some(Err(_)) => return Err("Le flux du serveur a été interrompu.".into()),
                None => break,
            }
        }
    }
    decoder.finish()?;
    if !done || !stop || result.is_empty() {
        return Err("Le serveur n’a pas confirmé une traduction complète.".into());
    }
    if cancel.is_cancelled() {
        return Err("Traduction annulée.".into());
    }
    Ok(result)
}

pub async fn check(profile: &Profile) -> Result<(), String> {
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
        .map_err(|_| "Serveur injoignable.".to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Le serveur a répondu HTTP {}.",
            response.status().as_u16()
        ));
    }
    let value: Value = response
        .json()
        .await
        .map_err(|_| "Réponse /v1/models invalide.".to_string())?;
    let found = value
        .get("data")
        .and_then(Value::as_array)
        .is_some_and(|v| {
            v.iter()
                .any(|m| m.get("id").and_then(Value::as_str) == Some(profile.model.as_str()))
        });
    if !found {
        return Err(format!(
            "Le modèle {} n’est pas exposé par le serveur.",
            profile.model
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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
