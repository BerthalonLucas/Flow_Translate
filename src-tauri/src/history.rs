use crate::{crypto, types::{HistoryEntry, Language, Mode}};
use chrono::{Duration, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct HistoryStore { path: PathBuf }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretPayload { source_text: String, translated_text: String }

impl HistoryStore {
    pub fn new(root: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(root).map_err(|_| "Impossible de créer le dossier d’historique.".to_string())?;
        let this = Self { path: root.join("history.sqlite3") };
        let conn=this.connection()?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
             CREATE TABLE IF NOT EXISTS history(
               id TEXT PRIMARY KEY, created_at TEXT NOT NULL, target_language TEXT NOT NULL,
               mode TEXT NOT NULL, payload_dpapi BLOB NOT NULL
             );"
        ).map_err(|_| "Impossible d’initialiser l’historique.".to_string())?;
        Self::prune(&conn)?;
        Ok(this)
    }

    fn connection(&self) -> Result<Connection, String> {
        Connection::open(&self.path).map_err(|_| "Impossible d’ouvrir l’historique.".to_string())
    }

    pub fn add(&self, entry: &HistoryEntry) -> Result<(), String> {
        let payload = serde_json::to_vec(&SecretPayload {
            source_text: entry.source_text.clone(), translated_text: entry.translated_text.clone(),
        }).map_err(|_| "Impossible de préparer l’historique.".to_string())?;
        let cipher = crypto::protect(&payload)?;
        let conn = self.connection()?;
        conn.execute("INSERT OR REPLACE INTO history(id,created_at,target_language,mode,payload_dpapi) VALUES(?1,?2,?3,?4,?5)",
            params![entry.id, entry.created_at, lang_str(entry.target_language), mode_str(entry.mode), cipher])
            .map_err(|_| "Impossible d’ajouter l’entrée à l’historique.".to_string())?;
        Self::prune(&conn)
    }

    fn prune(conn: &Connection) -> Result<(), String> {
        let cutoff = (Utc::now() - Duration::days(7)).to_rfc3339();
        conn.execute("DELETE FROM history WHERE created_at < ?1", [cutoff]).map_err(|_| "Impossible de purger l’historique.".to_string())?;
        conn.execute("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC LIMIT 100)", [])
            .map_err(|_| "Impossible de limiter l’historique.".to_string())?;
        Ok(())
    }

    pub fn maintain(&self) -> Result<(), String> { Self::prune(&self.connection()?) }

    pub fn list(&self) -> Result<Vec<HistoryEntry>, String> {
        let conn = self.connection()?;
        Self::prune(&conn)?;
        let mut stmt = conn.prepare("SELECT id,created_at,target_language,mode,payload_dpapi FROM history ORDER BY created_at DESC")
            .map_err(|_| "Impossible de lire l’historique.".to_string())?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?,row.get::<_,String>(3)?,row.get::<_,Vec<u8>>(4)?)))
            .map_err(|_| "Impossible de lire l’historique.".to_string())?;
        let mut result = Vec::new();
        for row in rows {
            let (id, created_at, target, mode, cipher) = row.map_err(|_| "Une entrée d’historique est invalide.".to_string())?;
            let payload: SecretPayload = serde_json::from_slice(&crypto::unprotect(&cipher)?)
                .map_err(|_| "Une entrée d’historique est illisible.".to_string())?;
            result.push(HistoryEntry { id, source_text: payload.source_text, translated_text: payload.translated_text,
                target_language: parse_lang(&target)?, mode: parse_mode(&mode)?, created_at });
        }
        Ok(result)
    }

    pub fn delete(&self, id: Option<&str>) -> Result<(), String> {
        let conn = self.connection()?;
        match id {
            Some(id) => { conn.execute("DELETE FROM history WHERE id=?1", [id]).map_err(|_| "Impossible de supprimer l’entrée.".to_string())?; }
            None => { conn.execute("DELETE FROM history", []).map_err(|_| "Impossible de vider l’historique.".to_string())?; }
        }
        Ok(())
    }
}

fn lang_str(v: Language) -> &'static str { match v { Language::Fr => "fr", Language::En => "en" } }
fn mode_str(v: Mode) -> &'static str { match v { Mode::Fast => "fast", Mode::Quality => "quality" } }
fn parse_lang(v: &str) -> Result<Language,String> { match v { "fr"=>Ok(Language::Fr),"en"=>Ok(Language::En),_=>Err("Langue d’historique invalide.".into()) } }
fn parse_mode(v: &str) -> Result<Mode,String> { match v { "fast"=>Ok(Mode::Fast),"quality"=>Ok(Mode::Quality),_=>Err("Mode d’historique invalide.".into()) } }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retention_prunes_age_and_count() {
        let root=std::env::temp_dir().join(format!("flowtranslate-history-test-{}",uuid::Uuid::new_v4()));
        let store=HistoryStore::new(&root).unwrap();
        let old=HistoryEntry{id:"old".into(),source_text:"secret".into(),translated_text:"secret".into(),target_language:Language::En,mode:Mode::Fast,created_at:(Utc::now()-Duration::days(8)).to_rfc3339()};
        store.add(&old).unwrap();
        for n in 0..101 {store.add(&HistoryEntry{id:format!("fresh-{n:03}"),source_text:"a".into(),translated_text:"b".into(),target_language:Language::Fr,mode:Mode::Quality,created_at:(Utc::now()+Duration::milliseconds(n)).to_rfc3339()}).unwrap();}
        let entries=store.list().unwrap();assert_eq!(entries.len(),100);assert!(!entries.iter().any(|e|e.id=="old"));
        store.delete(None).unwrap();assert!(store.list().unwrap().is_empty());drop(store);let _=std::fs::remove_dir_all(root);
    }
}
