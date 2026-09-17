# EngineCard

Un profil de moteur (Qualité, Rapide) : nom, badge Par défaut, état de connexion, Vérifier, puis Adresse, Modèle et Clé API.

## À fournir
`name`, `status` (`unknown`, `checking`, `ok` avec `latency`, `error` avec `message`), les trois valeurs et leurs `on*`, `onCheck`.

## Règles
- Toute modification remet l’état à « Non vérifié ».
- `http://` seulement en bouclage local (`localhost`, 127.x.x.x, `[::1]`) ; sinon `https://`. L’erreur s’affiche sous le champ : « Un serveur distant doit utiliser HTTPS ; HTTP est réservé au bouclage local. »
- Le message d’échec dit quoi faire : « Aucune réponse de 127.0.0.1:8001. Démarrez le serveur, puis vérifiez. » Jamais le texte brut de reqwest.
- La clé n’est jamais réaffichée en clair après enregistrement.
