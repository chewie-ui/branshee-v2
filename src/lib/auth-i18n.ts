import type { SiteLocale } from "@/lib/site-locale";

/** Messages des actions de connexion / inscription, traduits côté navigateur pour le site anglais. */
const EN: Record<string, string> = {
  "Adresse email invalide.": "Please enter a valid email address.",
  "Ce compte a été désactivé. Pour en savoir plus, écrivez-nous depuis la page Contact.": "This account has been disabled. To find out more, contact us.",
  "Code incorrect ou expiré.": "Wrong or expired code.",
  "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez.": "Wrong code. Check your phone's clock and try again.",
  "Double authentification illisible : contactez le support.": "Two-factor authentication can't be read: please contact support.",
  "Email ou mot de passe incorrect.": "Wrong email or password.",
  "Indiquez votre nom.": "Please enter your name.",
  "Le code contient 6 chiffres.": "The code has 6 digits.",
  "Le mot de passe doit contenir au moins 10 caractères.": "Your password must be at least 10 characters long.",
  "10 caractères minimum.": "At least 10 characters.",
  "Saisissez votre mot de passe.": "Please enter your password.",
  "Trop d'essais. Demandez un nouveau code dans quelques minutes.": "Too many attempts. Request a new code in a few minutes.",
  "Trop d'essais. Demandez un nouveau code.": "Too many attempts. Request a new code.",
  "Trop d'essais. Reconnectez-vous dans quelques minutes.": "Too many attempts. Log in again in a few minutes.",
  "Trop de demandes. Réessayez dans quelques minutes.": "Too many requests. Try again in a few minutes.",
  "Trop de tentatives. Réessayez dans une heure.": "Too many attempts. Try again in an hour.",
  "Un compte existe déjà avec cet email. Connectez-vous.": "An account already exists with this email. Please log in.",
};

export function authMsg(msg: string | undefined, locale: SiteLocale): string | undefined {
  if (!msg || locale === "fr") return msg;
  if (EN[msg]) return EN[msg];
  let m = /^Trop de tentatives\. Réessayez dans (\d+) min\.$/.exec(msg);
  if (m) return `Too many attempts. Try again in ${m[1]} min.`;
  m = /^Si un compte existe pour (.+), un code vient d'y être envoyé\.$/.exec(msg);
  if (m) return `If an account exists for ${m[1]}, a code has just been sent to it.`;
  return msg;
}

export const AUTH_T = {
  fr: {
    email: "Email", password: "Mot de passe", forgot: "Mot de passe oublié ?", login: "Se connecter", fullName: "Nom complet", proEmail: "Email professionnel",
    min10: "10 caractères minimum.", create: "Créer mon compte", google: "Continuer avec Google", googleUp: "S'inscrire avec Google", or: "ou",
    accountEmail: "Email du compte", getCode: "Recevoir un code", code: "Code reçu par email", codeHint: "6 chiffres, valable 15 minutes.", newPw: "Nouveau mot de passe", change: "Changer le mot de passe",
  },
  en: {
    email: "Email", password: "Password", forgot: "Forgot your password?", login: "Log in", fullName: "Full name", proEmail: "Work email",
    min10: "At least 10 characters.", create: "Create my account", google: "Continue with Google", googleUp: "Sign up with Google", or: "or",
    accountEmail: "Account email", getCode: "Send me a code", code: "Code received by email", codeHint: "6 digits, valid for 15 minutes.", newPw: "New password", change: "Change password",
  },
} satisfies Record<SiteLocale, Record<string, string>>;
