# Brancher un moteur de traduction

FlowTranslate parle le contrat OpenAI « chat completions » en flux. Tout serveur qui
l’expose fonctionne : le vLLM livré dans `server/`, mais aussi llama.cpp, LM Studio,
Ollama, un vLLM d’entreprise derrière un proxy HTTPS, ou un service en ligne. Cette
page décrit exactement ce que l’application envoie et attend, puis donne les réglages
pour les serveurs courants.

## Où régler

Réglages (icône de notification → Réglages) → **Connexion avancée**. Chaque profil,
**Rapide** et **Qualité**, a trois champs :

| Champ | Contenu |
|---|---|
| Adresse | La base de l’API, par exemple `http://127.0.0.1:8001/v1`. Le suffixe `/v1` est facultatif : il est ajouté s’il manque, jamais doublé. |
| Modèle | Le nom que le serveur attend dans `model` (`flowtranslate-fast`, `qwen3:8b`, `gpt-4o-mini`…). |
| Clé API | Facultative pour un serveur local. Envoyée en `Authorization: Bearer …`, chiffrée par DPAPI sur le poste, jamais écrite en clair. |

« Vérifier » appelle `GET {adresse}/models` avec la clé et exige que le nom du
modèle figure dans la liste renvoyée (`data[].id`), sinon « Le modèle … n’est pas exposé
par le serveur ». Le profil utilisé pour une traduction est celui de « Profil par
défaut » ; le menu ⋯ de la bulle permet de relancer avec l’autre.

## Règles d’adresse

- `http://` n’est accepté que sur une adresse de bouclage (`127.0.0.1`, `localhost`,
  `[::1]`). Partout ailleurs, `https://` est obligatoire : la sélection traduite quitte le
  poste, elle ne doit pas passer en clair.
- Les redirections HTTP ne sont pas suivies.
- Délais : 5 s pour établir la connexion, 120 s pour la traduction complète, 5 s pour
  « Vérifier ».

## Ce que l’application envoie

`POST {adresse}/chat/completions`, corps JSON :

```json
{
  "model": "<Modèle>",
  "messages": [
    { "role": "user", "content": "Translate the following text into French. Note that you should only output the translated result without any additional explanation:\n<texte sélectionné>" }
  ],
  "stream": true,
  "temperature": 0.7,
  "top_p": 0.6,
  "top_k": 20,
  "repetition_penalty": 1.05,
  "max_tokens": 4096
}
```

La langue cible (`French` ou `English`) vient du réglage « Langue cible » ; la langue
source n’est pas indiquée, le modèle la détecte. Il n’y a pas de message `system` :
l’instruction est celle recommandée par les cartes de modèle Hy-MT2, qui sont
entraînés pour ne rendre que la traduction. Un modèle généraliste suit en général la
consigne, mais peut ajouter un commentaire ou des guillemets : à juger à l’usage.

`top_k` et `repetition_penalty` ne font pas partie du contrat OpenAI strict. Un serveur
qui les refuse (l’API OpenAI répond 400 « Unrecognized request argument », d’autres
422) reçoit aussitôt la même requête sans ces deux champs ; rien à configurer.

## Ce que l’application attend

Une réponse `text/event-stream` au format OpenAI :

- des événements `data: {…}` dont `choices[0].delta.content` porte le texte, dans
  l’ordre ; séparateurs `\n\n` ou `\r\n\r\n`, fragments UTF-8 coupés entre paquets
  acceptés ;
- un dernier événement avec `choices[0].finish_reason: "stop"`, puis `data: [DONE]`.

Tout autre fin est refusée, jamais montrée comme une traduction complète :
`finish_reason: "length"` (la sortie a atteint `max_tokens`) donne « résultat incomplet
refusé », une coupure du flux « Le serveur a interrompu la génération », un statut HTTP
différent de 2xx « Le serveur a répondu HTTP n ». Le texte est rendu d’un bloc à la fin
du flux (la bulle n’affiche pas les jetons un à un), les deltas servent seulement à
détecter un serveur qui répond.

## Réglages pour les serveurs courants

| Serveur | Adresse | Modèle | Remarques |
|---|---|---|---|
| vLLM de `server/` (Rapide) | `http://127.0.0.1:8001/v1` | `flowtranslate-fast` | Hy-MT2-1.8B ; voir [server/README.md](../server/README.md) |
| vLLM de `server/` (Qualité) | `http://127.0.0.1:8002/v1` | `flowtranslate-quality` | Hy-MT2-7B-FP8 |
| vLLM ailleurs | `http://127.0.0.1:8000/v1` | la valeur de `--served-model-name` (sinon le chemin du modèle) | Ajouter `--api-key` côté serveur et la clé dans le profil si le port est partagé |
| llama.cpp (`llama-server`) | `http://127.0.0.1:8080/v1` | l’identifiant renvoyé par `/v1/models` (le chemin du fichier GGUF, ou la valeur de `--alias`) | « Vérifier » exige ce nom exact ; `top_k` et `repetition_penalty` compris |
| LM Studio | `http://127.0.0.1:1234/v1` | l’identifiant affiché dans l’onglet serveur | Activer le serveur local dans LM Studio |
| Ollama | `http://127.0.0.1:11434/v1` | le tag du modèle (`qwen3:8b`) | Point d’accès compatible OpenAI d’Ollama ; les champs étendus sont ignorés |
| OpenRouter, ou tout service en ligne | `https://openrouter.ai/api/v1` | l’identifiant du service (`openai/gpt-4o-mini`) | Clé API obligatoire ; HTTPS imposé ; la sélection quitte le poste |
| Serveur d’entreprise | `https://traduction.exemple.fr/v1` | selon le déploiement | Proxy HTTPS authentifié devant vLLM, seules les routes `/v1/models` et `/v1/chat/completions` exposées, sans journalisation des corps (voir [DEPLOYMENT.md](DEPLOYMENT.md)) |

Un endpoint hors bouclage en `http://` est refusé à l’enregistrement, avec le message
« Un serveur distant doit utiliser HTTPS; HTTP est réservé au bouclage local. ».

## Vérifier à la main

Sans FlowTranslate, la même requête en PowerShell (remplacer l’adresse, le modèle et
la clé) :

```powershell
$body = '{"model":"flowtranslate-fast","messages":[{"role":"user","content":"Translate the following text into French. Note that you should only output the translated result without any additional explanation:\nGood morning."}],"stream":true,"temperature":0.7,"top_p":0.6,"max_tokens":4096}'
curl.exe -N -H "Content-Type: application/json" -H "Authorization: Bearer CLE" -d $body http://127.0.0.1:8001/v1/chat/completions
```

La sortie doit se terminer par un événement `"finish_reason":"stop"` puis `data: [DONE]`.

## Confidentialité

Le texte sélectionné n’est envoyé qu’au serveur du profil, jamais ailleurs, et
l’application n’écrit dans aucun journal ni le texte, ni la traduction, ni la clé. Avec
un service en ligne, c’est la politique de ce service qui s’applique au texte envoyé.
