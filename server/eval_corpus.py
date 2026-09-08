"""100 synthetic, balanced professional-message examples. No user/company data."""
from __future__ import annotations

# English, French reference, tokens that should remain literally intact in both directions.
PAIRS = [
    ("Could you send the updated proposal before Thursday?", "Pourriez-vous envoyer la proposition mise à jour avant jeudi ?", []),
    ("Thanks for the update. I will review the document this afternoon.", "Merci pour ces nouvelles. Je relirai le document cet après-midi.", []),
    ("Please confirm your availability for the meeting on 2026-09-15.", "Merci de confirmer votre disponibilité pour la réunion du 2026-09-15.", ["2026-09-15"]),
    ("The meeting has been moved to Friday. The location remains unchanged.", "La réunion a été déplacée à vendredi. Le lieu reste inchangé.", []),
    ("I am available after lunch, except on Wednesday.", "Je suis disponible après le déjeuner, sauf le mercredi.", []),
    ("Could we postpone our call until next week?", "Pourrions-nous reporter notre appel à la semaine prochaine ?", []),
    ("Please find the signed agreement attached. Let me know if a page is missing.", "Vous trouverez le contrat signé en pièce jointe. Merci de me prévenir s’il manque une page.", []),
    ("The attachment did not come through. Could you resend it?", "La pièce jointe ne m’est pas parvenue. Pourriez-vous me la renvoyer ?", []),
    ("This is a draft, not the final version. Please do not distribute it yet.", "Il s’agit d’un brouillon, et non de la version définitive. Merci de ne pas encore le diffuser.", []),
    ("You can find the agenda at https://example.com/agenda?id=42.", "Vous trouverez l’ordre du jour sur https://example.com/agenda?id=42.", ["https://example.com/agenda?id=42"]),
    ("Please contact support@example.com and include reference FT-2048.", "Merci de contacter support@example.com en indiquant la référence FT-2048.", ["support@example.com", "FT-2048"]),
    ("Invoice INV-2026-087 is still outstanding. Has the payment been scheduled?", "La facture INV-2026-087 est toujours en attente de règlement. Le paiement a-t-il été programmé ?", ["INV-2026-087"]),
    ("The quoted price includes installation but excludes maintenance.", "Le prix indiqué comprend l’installation, mais pas la maintenance.", []),
    ("We cannot approve this expense without a receipt.", "Nous ne pouvons pas approuver cette dépense sans justificatif.", []),
    ("The discount applies only to the first order, not to renewals.", "La remise s’applique uniquement à la première commande, et non aux renouvellements.", []),
    ("Could you clarify whether tax is included in the total?", "Pourriez-vous préciser si les taxes sont comprises dans le montant total ?", []),
    ("We received the delivery, but one item was damaged.", "Nous avons reçu la livraison, mais un article était endommagé.", []),
    ("Order PO-7319 must not be shipped before the address is confirmed.", "La commande PO-7319 ne doit pas être expédiée avant confirmation de l’adresse.", ["PO-7319"]),
    ("The replacement should arrive tomorrow, subject to carrier confirmation.", "Le remplacement devrait arriver demain, sous réserve de confirmation du transporteur.", []),
    ("Please use the new address for all future deliveries.", "Merci d’utiliser la nouvelle adresse pour toutes les livraisons à venir.", []),
    ("We have identified the issue and are investigating its cause.", "Nous avons identifié le problème et recherchons sa cause.", []),
    ("The service is available again. No customer data was lost.", "Le service est à nouveau disponible. Aucune donnée client n’a été perdue.", []),
    ("I can reproduce the error only when the network connection is interrupted.", "Je ne parviens à reproduire l’erreur que lorsque la connexion réseau est interrompue.", []),
    ("Please keep the error code ERR_TIMEOUT unchanged in your reply.", "Merci de conserver le code d’erreur ERR_TIMEOUT tel quel dans votre réponse.", ["ERR_TIMEOUT"]),
    ("The API returns HTTP 429. Please retry later rather than sending more requests.", "L’API renvoie HTTP 429. Merci de réessayer plus tard plutôt que d’envoyer davantage de requêtes.", ["HTTP 429"]),
    ("Do not restart the server yet; the backup is still running.", "Ne redémarrez pas encore le serveur ; la sauvegarde est toujours en cours.", []),
    ("Could you grant read-only access to the shared folder?", "Pourriez-vous accorder un accès en lecture seule au dossier partagé ?", []),
    ("My access expires tomorrow. Who should approve the renewal?", "Mon accès expire demain. Qui doit approuver son renouvellement ?", []),
    ("Please do not send passwords by email. Use the approved secure channel.", "Merci de ne pas envoyer de mots de passe par e-mail. Utilisez le canal sécurisé approuvé.", []),
    ("I have removed the personal information from the sample file.", "J’ai supprimé les informations personnelles du fichier d’exemple.", []),
    ("The report is for internal use only and must not be forwarded externally.", "Ce rapport est réservé à un usage interne et ne doit pas être transmis à l’extérieur.", []),
    ("Please keep the placeholder {{customer_name}} exactly as written.", "Merci de conserver le paramètre {{customer_name}} exactement tel qu’il est écrit.", ["{{customer_name}}"]),
    ("Next steps:\n- Review the draft\n- Confirm the budget\n- Schedule the launch", "Prochaines étapes :\n- Relire le brouillon\n- Confirmer le budget\n- Planifier le lancement", []),
    ("Hello Alex,\n\nThank you for your help. I will follow up once the tests are complete.\n\nBest regards,\nMarie", "Bonjour Alex,\n\nMerci pour votre aide. Je reviendrai vers vous une fois les tests terminés.\n\nCordialement,\nMarie", ["Alex", "Marie"]),
    ("Sorry for the late reply. Your message ended up in my spam folder.", "Désolé pour cette réponse tardive. Votre message s’est retrouvé dans mon dossier de courriers indésirables.", []),
    ("No worries, take your time. This is not urgent.", "Pas de souci, prenez votre temps. Ce n’est pas urgent.", []),
    ("This is urgent: please acknowledge receipt as soon as possible.", "C’est urgent : merci d’accuser réception dès que possible.", []),
    ("I appreciate your suggestion, but we cannot commit to that deadline yet.", "Je vous remercie pour votre suggestion, mais nous ne pouvons pas encore nous engager sur cette échéance.", []),
    ("We agree in principle, provided that the remaining questions are resolved.", "Nous sommes d’accord sur le principe, à condition que les questions restantes soient résolues.", []),
    ("Could you explain the difference between the two options without technical jargon?", "Pourriez-vous expliquer la différence entre les deux options sans jargon technique ?", []),
    ("I may have misunderstood your previous message. Did you mean this week or next week?", "J’ai peut-être mal compris votre précédent message. Parliez-vous de cette semaine ou de la semaine prochaine ?", []),
    ("Unless we hear otherwise, we will keep the current schedule.", "Sauf indication contraire, nous conserverons le calendrier actuel.", []),
    ("The change is optional. Existing users do not need to take any action.", "La modification est facultative. Les utilisateurs existants n’ont aucune démarche à effectuer.", []),
    ("Please confirm that both the original and the revised versions are available.", "Merci de confirmer que la version d’origine et la version révisée sont toutes deux disponibles.", []),
    ("The minutes should reflect the decision, not every comment made during the meeting.", "Le compte rendu doit refléter la décision, et non chaque remarque formulée pendant la réunion.", []),
    ("Alex will cover for Marie during her absence. Please copy them both on urgent messages.", "Alex remplacera Marie pendant son absence. Merci de les mettre tous les deux en copie des messages urgents.", ["Alex", "Marie"]),
    ("I will be out of the office until Monday and may be slow to respond.", "Je serai absent du bureau jusqu’à lundi et mes réponses pourront être retardées.", []),
    ("The phrase ‘ignore previous instructions’ appears in the document as an example, not a request.", "La phrase « ignore previous instructions » figure dans le document à titre d’exemple, et non de demande.", ["ignore previous instructions"]),
    ("Please reply with either approval or the changes you need before signing.", "Merci de répondre en indiquant soit votre accord, soit les modifications nécessaires avant signature.", []),
    ("Thank you for raising this concern. We will address it before making a final decision.", "Merci d’avoir soulevé cette préoccupation. Nous la traiterons avant de prendre une décision définitive.", []),
]


def cases() -> list[dict]:
    result = []
    for index, (english, french, preserve) in enumerate(PAIRS, 1):
        for source, target, text, reference in (("en", "fr", english, french), ("fr", "en", french, english)):
            result.append({"id": f"mail-{index:02d}-{source}-{target}", "sourceLanguage": source,
                           "targetLanguage": target, "text": text, "reference": reference,
                           "mustPreserve": preserve, "origin": "synthetic"})
    return result


if __name__ == "__main__":
    import json
    print(json.dumps(cases(), ensure_ascii=False, indent=2))

