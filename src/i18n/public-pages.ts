/**
 * Textes des pages publiques des apps Skydev (commande à table, avis, signature, fidélité, boutique…),
 * en français, néerlandais et anglais (allemand, espagnol, italien : anglais). Pur, partagé serveur / client.
 */
import type { Locale } from "@/i18n/config";

const fr = {
  table: {
    orderFromPhone: "commandez depuis votre téléphone", sections: "Rubriques", notAvailable: "La carte n'est pas encore disponible. Demandez au personnel.",
    add: "Ajouter", addAria: "Ajouter {name}", lessAria: "Un {name} de moins", moreAria: "Un {name} de plus", viewOrder: "Voir ma commande ({n})", myOrder: "Ma commande · {table}",
    precision: "Précision (cuisson, sans oignon…)", precisionAria: "Précision pour {name}", firstName: "Votre prénom (facultatif)", kitchenNote: "Un mot pour la cuisine ? (allergie…)",
    sending: "Envoi…", send: "Envoyer la commande", payAsUsual: "Vous payez au comptoir ou à table, comme d'habitude.", sendError: "Envoi impossible. Vérifiez votre connexion et réessayez.",
    orderNo: "Commande n° {n}", received: "Commande reçue", steps: "Reçue|En préparation|Prête|Servie", progress: "Avancement", orderMore: "Commander autre chose", close: "Fermer", others: "Autres", menu: "La carte",
    status: { new: "Commande reçue", preparing: "En préparation", ready: "Prête, elle arrive", served: "Servie. Bon appétit !", cancelled: "Commande annulée : adressez-vous au personnel" },
  },
  review: {
    thanks: "Merci pour votre visite ! Votre avis nous aide vraiment.", google: "Donner mon avis sur Google", noGoogle: "Les avis Google ne sont pas encore ouverts pour cet établissement.",
    private: "Faire une remarque en privé", rating: "Votre note", ofFive: "{n} sur 5", message: "Votre message (lu uniquement par le responsable)", back: "Retour", sendPrivate: "Envoyer en privé",
    chooseRating: "Choisissez une note.", sent: "Merci, votre message a bien été transmis.",
  },
  sign: {
    title: "Signer le devis", back: "Retour", amount: "Montant : {amount}", name: "Votre nom complet", signature: "Votre signature", erase: "Effacer", hint: "Signez ici avec le doigt ou la souris",
    agree: "Bon pour accord.", agreeText: "J'accepte ce devis et ses conditions.", submit: "Signer le devis", signing: "Signature…", refuse: "Refuser le devis", refuseTitle: "Refuser le devis",
    refuseNote: "Un mot pour votre fournisseur ? (facultatif)", confirmRefuse: "Refuser", legal: "Signature électronique : votre nom, votre tracé, la date, l'heure et l'adresse de connexion sont enregistrés avec une empreinte du devis.",
    signed: "Devis signé", signedBy: "Signé par {name} le {date}, « Bon pour accord ».", hash: "Empreinte du devis : {hash}", print: "Imprimer / PDF",
    declined: "Vous avez refusé ce devis.", expired: "Ce lien a expiré. Demandez un nouveau lien à votre fournisseur.", changed: "Le devis a changé depuis l'envoi. Demandez un nouveau lien à votre fournisseur.", quote: "Devis {n}",
  },
  loyalty: { saveTitle: "Gardez votre carte", saveText: "Ajoutez votre email pour la retrouver si vous changez de téléphone. Ça prend 10 secondes, quand vous voulez.", firstName: "Prénom", email: "Email", save: "Enregistrer ma carte", saving: "Enregistrement…", saved: "C'est fait : votre carte est enregistrée, le lien vous a été envoyé par email.", merged: "Vous aviez déjà une carte avec cette adresse : vos tampons y ont été ajoutés. Ouvrez le lien reçu par email.", account: "Ou créer mon compte client", card: "Carte de fidélité", reward: "Récompense débloquée : {reward}. Demandez-la à votre prochain passage !", left: "Encore {n} passage(s) pour : {reward}", earned: "{n} récompense(s) déjà obtenue(s). Merci de votre fidélité !", stamps: "{n} tampons sur {goal}", added: "Tampon ajouté !", already: "Déjà tamponné aujourd'hui : revenez à votre prochaine visite.", history: "Derniers tampons", book: "Prendre rendez-vous", keep: "Ajoutez cette page à l'écran d'accueil de votre téléphone pour la retrouver en un geste.", src: { manual: "Passage", qr: "QR code scanné", appointment: "Rendez-vous", shop: "Achat en ligne", reward: "Récompense utilisée" } },
  shop: {
    online: "Boutique en ligne", categories: "Catégories", all: "Tout", empty: "Aucun produit en vente pour l'instant.", soldOut: "Épuisé", option: "Taille / couleur", add: "Ajouter", addAria: "Ajouter {name} au panier",
    lessAria: "Un {name} de moins", moreAria: "Un {name} de plus", cart: "Panier ({n})", close: "Fermer", yourOrder: "Votre commande", howGet: "Retrait ou livraison", pickupFree: "Retrait sur place (gratuit)", pickupWhen: "Heure de retrait", asap: "Dès que possible", pickupCode: "Code de retrait", pickupCodeHelp: "Donnez ce code au comptoir pour récupérer votre commande.", loyaltyHas: "Fidélité : cette commande ajoute 1 tampon à votre carte ({stamps}/{goal}) dès qu'elle est payée ou retirée.", loyaltyNew: "Cette commande vous ouvre une carte de fidélité : {goal} tampons = {reward}. Elle arrive par email dès que la commande est payée ou retirée.", seeCard: "Voir ma carte", accountTitle: "Retrouvez toutes vos commandes", accountText: "Créez votre compte avec l'adresse {email} : vos commandes, vos rendez-vous et vos cartes de fidélité au même endroit.", createAccount: "Créer mon compte", signIn: "Se connecter", inMySpace: "Cette commande est aussi dans votre espace client.", openSpace: "Mon espace client", choose: "Choisir", required: "obligatoire", upTo: "{n} maximum", addFor: "Ajouter · {price}", promo: "Promo", missingChoice: "Choisissez : {name}", fromPrice: "dès {price}", hasAccount: "Vous avez un compte ? Connectez-vous : vos infos se remplissent et la commande arrive dans votre espace client.", signInShort: "Se connecter", signedAs: "Connecté : {email}",
    delivery: "Livraison ({fee})", free: "gratuite", name: "Nom", phone: "Téléphone", email: "Email", address: "Adresse de livraison", note: "Un mot pour le vendeur (facultatif)", payment: "Paiement",
    payOnline: "Carte ou Bancontact (en ligne)", payOnDelivery: "À la livraison", payOnPickup: "Au retrait", payTransfer: "Virement bancaire",
    terms: "J'accepte les conditions de vente et je confirme ma commande avec obligation de paiement.", sending: "Envoi…", orderPay: "Commander et payer", order: "Commander", sendError: "Envoi impossible. Vérifiez votre connexion.",
    vatIncl: "Prix TVA comprise. Droit de rétractation de 14 jours pour les achats en ligne (sauf produits périssables ou personnalisés) : contactez le vendeur.", vat: "TVA", bce: "BCE",
    myOrder: "Ma commande", orderNo: "Commande n° {n}", payCancelled: "Paiement annulé", payPending: "Paiement en cours de confirmation…", cancelIfUnpaid: "Votre commande sera annulée si le paiement n'est pas fait.",
    backShop: "Retour à la boutique", deliveryLine: "Livraison", total: "Total TVAC", deliverTo: "Livraison : {address}", pickupInfo: "Retrait sur place : vous recevrez un email quand elle sera prête.",
    transfer: "Virement de {amount} à {name}", comm: "Communication", commValue: "Commande {n}", payLater: "Paiement {when}.", atDelivery: "à la livraison", atPickup: "au retrait",
    status: { pending_payment: "Paiement en attente", new: "Commande reçue", ready: "Prête à retirer", shipped: "Expédiée", done: "Terminée", cancelled: "Annulée" },
  },
  unsub: { title: "Emails de {name}", text: "Vous ne voulez plus recevoir les actualités et offres par email ? Vos rendez-vous et factures continueront de vous être envoyés.", button: "Me désabonner", done: "Vous êtes déjà désabonné : vous ne recevrez plus ces emails." },
};
export type PublicTexts = typeof fr;

const nl: PublicTexts = {
  table: {
    orderFromPhone: "bestel via je smartphone", sections: "Rubrieken", notAvailable: "De kaart is nog niet beschikbaar. Vraag het aan het personeel.",
    add: "Toevoegen", addAria: "{name} toevoegen", lessAria: "Eén {name} minder", moreAria: "Eén {name} meer", viewOrder: "Mijn bestelling bekijken ({n})", myOrder: "Mijn bestelling · {table}",
    precision: "Opmerking (bakwijze, zonder ui…)", precisionAria: "Opmerking voor {name}", firstName: "Je voornaam (optioneel)", kitchenNote: "Een woordje voor de keuken? (allergie…)",
    sending: "Versturen…", send: "Bestelling versturen", payAsUsual: "Je betaalt zoals gewoonlijk aan de toog of aan tafel.", sendError: "Versturen mislukt. Controleer je verbinding en probeer opnieuw.",
    orderNo: "Bestelling nr. {n}", received: "Bestelling ontvangen", steps: "Ontvangen|In bereiding|Klaar|Geserveerd", progress: "Voortgang", orderMore: "Nog iets bestellen", close: "Sluiten", others: "Overige", menu: "De kaart",
    status: { new: "Bestelling ontvangen", preparing: "In bereiding", ready: "Klaar, komt eraan", served: "Geserveerd. Smakelijk!", cancelled: "Bestelling geannuleerd: vraag het aan het personeel" },
  },
  review: {
    thanks: "Bedankt voor je bezoek! Je mening helpt ons echt.", google: "Mijn review geven op Google", noGoogle: "Google-reviews zijn nog niet beschikbaar voor deze zaak.",
    private: "Een privé-opmerking geven", rating: "Je score", ofFive: "{n} op 5", message: "Je bericht (alleen gelezen door de verantwoordelijke)", back: "Terug", sendPrivate: "Privé versturen",
    chooseRating: "Kies een score.", sent: "Bedankt, je bericht is doorgestuurd.",
  },
  sign: {
    title: "Offerte ondertekenen", back: "Terug", amount: "Bedrag: {amount}", name: "Je volledige naam", signature: "Je handtekening", erase: "Wissen", hint: "Teken hier met je vinger of muis",
    agree: "Voor akkoord.", agreeText: "Ik aanvaard deze offerte en de voorwaarden.", submit: "Offerte ondertekenen", signing: "Ondertekenen…", refuse: "Offerte weigeren", refuseTitle: "Offerte weigeren",
    refuseNote: "Een woordje voor je leverancier? (optioneel)", confirmRefuse: "Weigeren", legal: "Elektronische handtekening: je naam, handtekening, datum, uur en verbindingsadres worden bewaard met een vingerafdruk van de offerte.",
    signed: "Offerte ondertekend", signedBy: "Ondertekend door {name} op {date}, ‘Voor akkoord’.", hash: "Vingerafdruk van de offerte: {hash}", print: "Afdrukken / pdf",
    declined: "Je hebt deze offerte geweigerd.", expired: "Deze link is verlopen. Vraag een nieuwe link aan je leverancier.", changed: "De offerte is gewijzigd sinds het versturen. Vraag een nieuwe link aan je leverancier.", quote: "Offerte {n}",
  },
  loyalty: { saveTitle: "Bewaar je kaart", saveText: "Voeg je e-mail toe om ze terug te vinden als je van telefoon wisselt. Duurt 10 seconden, wanneer je wilt.", firstName: "Voornaam", email: "E-mail", save: "Mijn kaart bewaren", saving: "Opslaan…", saved: "Klaar: je kaart is bewaard, de link is per e-mail verstuurd.", merged: "Je had al een kaart met dit adres: je stempels zijn daar toegevoegd. Open de link in je e-mail.", account: "Of mijn klantaccount aanmaken", card: "Klantenkaart", reward: "Beloning vrijgespeeld: {reward}. Vraag ernaar bij je volgende bezoek!", left: "Nog {n} bezoek(en) voor: {reward}", earned: "Al {n} beloning(en) ontvangen. Bedankt voor je trouw!", stamps: "{n} stempels op {goal}", added: "Stempel toegevoegd!", already: "Vandaag al gestempeld: tot je volgende bezoek.", history: "Laatste stempels", book: "Afspraak maken", keep: "Zet deze pagina op het startscherm van je telefoon om ze snel terug te vinden.", src: { manual: "Bezoek", qr: "QR-code gescand", appointment: "Afspraak", shop: "Online aankoop", reward: "Beloning gebruikt" } },
  shop: {
    online: "Webshop", categories: "Categorieën", all: "Alles", empty: "Nog geen producten te koop.", soldOut: "Uitverkocht", option: "Maat / kleur", add: "Toevoegen", addAria: "{name} aan winkelmandje toevoegen",
    lessAria: "Eén {name} minder", moreAria: "Eén {name} meer", cart: "Winkelmandje ({n})", close: "Sluiten", yourOrder: "Je bestelling", howGet: "Afhalen of levering", pickupFree: "Afhalen ter plaatse (gratis)", pickupWhen: "Afhaaluur", asap: "Zo snel mogelijk", pickupCode: "Afhaalcode", pickupCodeHelp: "Geef deze code aan de toonbank om je bestelling op te halen.", loyaltyHas: "Getrouwheid: deze bestelling voegt 1 stempel toe aan je kaart ({stamps}/{goal}) zodra ze betaald of afgehaald is.", loyaltyNew: "Met deze bestelling krijg je een getrouwheidskaart: {goal} stempels = {reward}. Je ontvangt ze per e-mail zodra de bestelling betaald of afgehaald is.", seeCard: "Mijn kaart bekijken", accountTitle: "Al je bestellingen op één plek", accountText: "Maak je account aan met het adres {email}: je bestellingen, afspraken en getrouwheidskaarten op één plek.", createAccount: "Account aanmaken", signIn: "Inloggen", inMySpace: "Deze bestelling staat ook in je klantenruimte.", openSpace: "Mijn klantenruimte", choose: "Kiezen", required: "verplicht", upTo: "maximaal {n}", addFor: "Toevoegen · {price}", promo: "Promo", missingChoice: "Kies: {name}", fromPrice: "vanaf {price}", hasAccount: "Heb je een account? Log in: je gegevens worden ingevuld en de bestelling komt in je klantenruimte.", signInShort: "Inloggen", signedAs: "Ingelogd: {email}",
    delivery: "Levering ({fee})", free: "gratis", name: "Naam", phone: "Telefoon", email: "E-mail", address: "Leveringsadres", note: "Een woordje voor de verkoper (optioneel)", payment: "Betaling",
    payOnline: "Kaart of Bancontact (online)", payOnDelivery: "Bij levering", payOnPickup: "Bij afhaling", payTransfer: "Overschrijving",
    terms: "Ik aanvaard de verkoopvoorwaarden en bevestig mijn bestelling met betalingsverplichting.", sending: "Versturen…", orderPay: "Bestellen en betalen", order: "Bestellen", sendError: "Versturen mislukt. Controleer je verbinding.",
    vatIncl: "Prijzen incl. btw. Herroepingsrecht van 14 dagen voor online aankopen (behalve bederfelijke of gepersonaliseerde producten): neem contact op met de verkoper.", vat: "Btw", bce: "KBO",
    myOrder: "Mijn bestelling", orderNo: "Bestelling nr. {n}", payCancelled: "Betaling geannuleerd", payPending: "Betaling wordt bevestigd…", cancelIfUnpaid: "Je bestelling wordt geannuleerd als de betaling niet gebeurt.",
    backShop: "Terug naar de webshop", deliveryLine: "Levering", total: "Totaal incl. btw", deliverTo: "Levering: {address}", pickupInfo: "Afhalen ter plaatse: je krijgt een e-mail zodra ze klaar is.",
    transfer: "Overschrijving van {amount} aan {name}", comm: "Mededeling", commValue: "Bestelling {n}", payLater: "Betaling {when}.", atDelivery: "bij levering", atPickup: "bij afhaling",
    status: { pending_payment: "Betaling in afwachting", new: "Bestelling ontvangen", ready: "Klaar om af te halen", shipped: "Verzonden", done: "Afgerond", cancelled: "Geannuleerd" },
  },
  unsub: { title: "E-mails van {name}", text: "Wil je geen nieuws en aanbiedingen meer per e-mail ontvangen? Je afspraken en facturen blijven we je wel sturen.", button: "Uitschrijven", done: "Je bent al uitgeschreven: je ontvangt deze e-mails niet meer." },
};

const en: PublicTexts = {
  table: {
    orderFromPhone: "order from your phone", sections: "Sections", notAvailable: "The menu isn't available yet. Please ask the staff.",
    add: "Add", addAria: "Add {name}", lessAria: "One less {name}", moreAria: "One more {name}", viewOrder: "View my order ({n})", myOrder: "My order · {table}",
    precision: "Note (cooking, no onion…)", precisionAria: "Note for {name}", firstName: "Your first name (optional)", kitchenNote: "A note for the kitchen? (allergy…)",
    sending: "Sending…", send: "Send order", payAsUsual: "You pay at the counter or at the table, as usual.", sendError: "Couldn't send. Check your connection and try again.",
    orderNo: "Order no. {n}", received: "Order received", steps: "Received|Preparing|Ready|Served", progress: "Progress", orderMore: "Order something else", close: "Close", others: "Other", menu: "Menu",
    status: { new: "Order received", preparing: "Preparing", ready: "Ready, on its way", served: "Served. Enjoy!", cancelled: "Order cancelled: please ask the staff" },
  },
  review: {
    thanks: "Thanks for your visit! Your review really helps us.", google: "Leave a Google review", noGoogle: "Google reviews aren't open yet for this business.",
    private: "Send private feedback", rating: "Your rating", ofFive: "{n} out of 5", message: "Your message (only read by the manager)", back: "Back", sendPrivate: "Send privately",
    chooseRating: "Choose a rating.", sent: "Thank you, your message has been sent.",
  },
  sign: {
    title: "Sign the quote", back: "Back", amount: "Amount: {amount}", name: "Your full name", signature: "Your signature", erase: "Clear", hint: "Sign here with your finger or mouse",
    agree: "Approved.", agreeText: "I accept this quote and its terms.", submit: "Sign the quote", signing: "Signing…", refuse: "Decline the quote", refuseTitle: "Decline the quote",
    refuseNote: "A note for your supplier? (optional)", confirmRefuse: "Decline", legal: "Electronic signature: your name, signature, date, time and connection address are stored with a fingerprint of the quote.",
    signed: "Quote signed", signedBy: "Signed by {name} on {date}, “Approved”.", hash: "Quote fingerprint: {hash}", print: "Print / PDF",
    declined: "You declined this quote.", expired: "This link has expired. Ask your supplier for a new one.", changed: "The quote changed since it was sent. Ask your supplier for a new link.", quote: "Quote {n}",
  },
  loyalty: { saveTitle: "Keep your card", saveText: "Add your email so you can find it again if you change phone. Takes 10 seconds, whenever you like.", firstName: "First name", email: "Email", save: "Save my card", saving: "Saving…", saved: "Done: your card is saved and the link was sent by email.", merged: "You already had a card with this address: your stamps were added to it. Open the link in your email.", account: "Or create my customer account", card: "Loyalty card", reward: "Reward unlocked: {reward}. Ask for it on your next visit!", left: "{n} more visit(s) for: {reward}", earned: "{n} reward(s) already earned. Thanks for your loyalty!", stamps: "{n} stamps out of {goal}", added: "Stamp added!", already: "Already stamped today: see you next visit.", history: "Latest stamps", book: "Book an appointment", keep: "Add this page to your phone's home screen to find it in one tap.", src: { manual: "Visit", qr: "QR code scanned", appointment: "Appointment", shop: "Online purchase", reward: "Reward used" } },
  shop: {
    online: "Online shop", categories: "Categories", all: "All", empty: "No products for sale yet.", soldOut: "Sold out", option: "Size / colour", add: "Add", addAria: "Add {name} to cart",
    lessAria: "One less {name}", moreAria: "One more {name}", cart: "Cart ({n})", close: "Close", yourOrder: "Your order", howGet: "Pickup or delivery", pickupFree: "Pickup in store (free)", pickupWhen: "Pickup time", asap: "As soon as possible", pickupCode: "Pickup code", pickupCodeHelp: "Give this code at the counter to collect your order.", loyaltyHas: "Loyalty: this order adds 1 stamp to your card ({stamps}/{goal}) once it's paid or collected.", loyaltyNew: "This order opens a loyalty card for you: {goal} stamps = {reward}. It arrives by email once the order is paid or collected.", seeCard: "See my card", accountTitle: "Find all your orders", accountText: "Create your account with {email}: your orders, appointments and loyalty cards in one place.", createAccount: "Create my account", signIn: "Sign in", inMySpace: "This order is also in your client space.", openSpace: "My client space", choose: "Choose", required: "required", upTo: "up to {n}", addFor: "Add · {price}", promo: "Sale", missingChoice: "Choose: {name}", fromPrice: "from {price}", hasAccount: "Have an account? Sign in: your details are filled in and the order goes to your client space.", signInShort: "Sign in", signedAs: "Signed in: {email}",
    delivery: "Delivery ({fee})", free: "free", name: "Name", phone: "Phone", email: "Email", address: "Delivery address", note: "A note for the seller (optional)", payment: "Payment",
    payOnline: "Card or Bancontact (online)", payOnDelivery: "On delivery", payOnPickup: "On pickup", payTransfer: "Bank transfer",
    terms: "I accept the terms of sale and confirm my order with an obligation to pay.", sending: "Sending…", orderPay: "Order and pay", order: "Order", sendError: "Couldn't send. Check your connection.",
    vatIncl: "Prices include VAT. 14-day right of withdrawal for online purchases (except perishable or personalised products): contact the seller.", vat: "VAT", bce: "Company no.",
    myOrder: "My order", orderNo: "Order no. {n}", payCancelled: "Payment cancelled", payPending: "Confirming payment…", cancelIfUnpaid: "Your order will be cancelled if payment isn't made.",
    backShop: "Back to the shop", deliveryLine: "Delivery", total: "Total incl. VAT", deliverTo: "Delivery: {address}", pickupInfo: "Pickup in store: you'll get an email when it's ready.",
    transfer: "Transfer {amount} to {name}", comm: "Reference", commValue: "Order {n}", payLater: "Payment {when}.", atDelivery: "on delivery", atPickup: "on pickup",
    status: { pending_payment: "Awaiting payment", new: "Order received", ready: "Ready for pickup", shipped: "Shipped", done: "Completed", cancelled: "Cancelled" },
  },
  unsub: { title: "Emails from {name}", text: "Don't want news and offers by email anymore? You'll still receive your appointment and invoice emails.", button: "Unsubscribe", done: "You're already unsubscribed: you won't receive these emails anymore." },
};

export function publicTexts(locale: Locale): PublicTexts {
  return locale === "nl" ? nl : locale === "fr" ? fr : en;
}

/** Remplace {variables}. */
export const fill = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, String(v)), s);
