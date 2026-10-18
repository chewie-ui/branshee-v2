import type { SiteSectionType } from "@/db/schema";

/**
 * Modèles de site « Mon site » (repris de l’ancien Branshee) : thème + sections déjà rédigées.
 * Les avis affichés sont toujours les vrais avis de l’établissement (jamais de témoignages inventés),
 * et la section « chiffres » est désactivée par défaut : elle ne doit contenir que des chiffres réels.
 */
export type SiteTheme = { primaryColor: string; bgColor: string; textColor: string; fontFamily: string; headingFont?: string; roundness: "sharp" | "soft" | "round" };
export type SiteSection = { id: string; type: SiteSectionType; enabled: boolean; data: Record<string, unknown> };
export type SiteTemplate = { id: string; name: string; tagline: string; description: string; bestFor: string; thumb: { bg: string; accent: string; text: string }; theme: SiteTheme; seo: { title?: string; description?: string }; sections: SiteSection[] };

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    "id": "atelier",
    "name": "Atelier",
    "tagline": "Coiffeur, barbier, beauté",
    "description": "Un site éditorial chic : titres en serif élégant, tons crème et terracotta, grandes images. Parfait pour les salons de coiffure, barbiers et instituts de beauté qui veulent un rendu haut de gamme.",
    "bestFor": "Coiffeur · Barbier · Institut · Beauté",
    "thumb": {
      "bg": "#f7f3ee",
      "accent": "#b5744e",
      "text": "#211c19"
    },
    "theme": {
      "primaryColor": "#b5744e",
      "bgColor": "#f7f3ee",
      "textColor": "#211c19",
      "fontFamily": "Inter",
      "headingFont": "Playfair Display",
      "roundness": "soft"
    },
    "seo": {
      "title": "Salon de coiffure — Réservez votre rendez-vous en ligne",
      "description": "Coupe, couleur et soins sur-mesure. Réservation en ligne simple et rapide."
    },
    "sections": [
      {
        "id": "hero",
        "type": "hero",
        "enabled": true,
        "data": {
          "title": "Révélez votre plus belle version",
          "subtitle": "Coupe, couleur et soins sur-mesure dans un écrin chaleureux. Une équipe d'expert·e·s à votre écoute, pour une coiffure qui vous ressemble.",
          "ctaText": "Prendre rendez-vous",
          "heroLayout": "full",
          "textAlign": "left",
          "bgImage": "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80",
          "overlayOpacity": 52
        }
      },
      {
        "id": "services",
        "type": "services",
        "enabled": true,
        "data": {
          "title": "Un savoir-faire pour chaque envie",
          "subtitle": "Des prestations pensées pour sublimer votre chevelure, avec des produits nobles et des gestes précis."
        }
      },
      {
        "id": "about",
        "type": "about",
        "enabled": true,
        "data": {
          "subtitle": "LE SALON",
          "title": "Un lieu pensé pour prendre soin de vous",
          "text": "<p>Niché au cœur de la ville, notre atelier est un havre où l'on ralentit. Nous mêlons expertise technique et écoute sincère, pour que chaque visite soit un vrai moment pour soi — et une coiffure dont vous serez fier·e en repartant.</p>",
          "image": "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1400&q=80",
          "layout": "default",
          "values": [
            {
              "title": "Expertise reconnue",
              "desc": "Une équipe formée aux dernières techniques de coupe et de couleur."
            },
            {
              "title": "Produits nobles",
              "desc": "Des soins respectueux de vos cheveux comme de la planète."
            },
            {
              "title": "À votre écoute",
              "desc": "Un diagnostic offert pour définir ensemble la coiffure qui vous ressemble."
            }
          ]
        }
      },
      {
        "id": "stats",
        "type": "stats",
        "enabled": false,
        "data": {
          "title": "La confiance de nos client·e·s",
          "items": [
            {
              "number": "15 ans",
              "label": "D'expérience"
            },
            {
              "number": "4,9/5",
              "label": "+800 avis"
            },
            {
              "number": "8 000+",
              "label": "Client·e·s ravi·e·s"
            },
            {
              "number": "6 experts",
              "label": "À votre service"
            }
          ]
        }
      },
      {
        "id": "gallery",
        "type": "gallery",
        "enabled": true,
        "data": {
          "title": "Nos réalisations",
          "columns": "3",
          "images": [
            {
              "url": "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1400&q=80",
              "caption": "Coupe & brushing"
            },
            {
              "url": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1400&q=80",
              "caption": "Coiffage"
            },
            {
              "url": "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=1400&q=80",
              "caption": "Coloration"
            },
            {
              "url": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=80",
              "caption": "Coupe homme"
            },
            {
              "url": "https://images.unsplash.com/photo-1522337094846-8a818192de1f?auto=format&fit=crop&w=1400&q=80",
              "caption": "Brushing"
            },
            {
              "url": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80",
              "caption": "L'ambiance"
            }
          ]
        }
      },
      {
        "id": "testimonials",
        "type": "testimonials",
        "enabled": true,
        "data": {
          "title": "Ils nous font confiance",
          "source": "reviews",
          "items": []
        }
      },
      {
        "id": "faq",
        "type": "faq",
        "enabled": true,
        "data": {
          "title": "Questions fréquentes",
          "items": [
            {
              "question": "Comment prendre rendez-vous ?",
              "answer": "En ligne, directement sur cette page — choisissez votre prestation et votre créneau en moins d'une minute, sans appel."
            },
            {
              "question": "Puis-je annuler ou reporter ?",
              "answer": "Oui, jusqu'à 24h avant votre rendez-vous, simplement depuis votre e-mail de confirmation."
            },
            {
              "question": "Proposez-vous un diagnostic ?",
              "answer": "Bien sûr — un temps d'échange offert pour comprendre vos envies et définir le meilleur pour vous."
            }
          ]
        }
      },
      {
        "id": "booking",
        "type": "booking",
        "enabled": true,
        "data": {
          "title": "Prêt·e à changer de tête ?",
          "subtitle": "Réservez votre créneau en ligne en moins d'une minute, sans appel.",
          "embedMode": "full"
        }
      },
      {
        "id": "cta",
        "type": "cta",
        "enabled": true,
        "data": {
          "title": "Offrez-vous un moment rien qu'à vous",
          "text": "Nos coiffeur·se·s vous accueillent du mardi au samedi.",
          "buttonText": "Prendre rendez-vous",
          "buttonUrl": "#booking",
          "bg": "gradient"
        }
      },
      {
        "id": "contact",
        "type": "contact",
        "enabled": true,
        "data": {
          "title": "Passez nous voir",
          "phone": "",
          "email": "",
          "address": ""
        }
      }
    ]
  },
  {
    "id": "serenite",
    "name": "Sérénité",
    "tagline": "Bien-être, spa, instituts",
    "description": "Un site tout en douceur : typographie élégante, tons chauds et ambiance apaisante. Idéal pour les instituts, spas et praticien·ne·s du bien-être.",
    "bestFor": "Spa · Institut · Massage · Bien-être",
    "thumb": {
      "bg": "#faf6f0",
      "accent": "#a97b52",
      "text": "#2b2420"
    },
    "theme": {
      "primaryColor": "#a97b52",
      "bgColor": "#faf6f0",
      "textColor": "#2b2420",
      "fontFamily": "Lora",
      "roundness": "round"
    },
    "seo": {
      "title": "Institut bien-être — Réservez votre soin en ligne",
      "description": "Offrez-vous une parenthèse de détente. Réservation en ligne simple et rapide."
    },
    "sections": [
      {
        "id": "hero",
        "type": "hero",
        "enabled": true,
        "data": {
          "title": "L'art de prendre soin de vous",
          "subtitle": "Une parenthèse de détente rien que pour vous. Réservez votre moment bien-être en quelques clics.",
          "ctaText": "Réserver ma séance",
          "heroLayout": "full",
          "textAlign": "center",
          "bgImage": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1400&q=80",
          "overlayOpacity": 45
        }
      },
      {
        "id": "about",
        "type": "about",
        "enabled": true,
        "data": {
          "subtitle": "NOTRE MAISON",
          "title": "Un havre de paix au cœur de la ville",
          "text": "<p>Depuis notre ouverture, nous cultivons un art de vivre où chaque détail compte. Nos praticien·ne·s vous accueillent dans un cocon pensé pour la détente, avec des soins personnalisés et des produits sélectionnés avec soin.</p><p>Ici, on ralentit. On respire. On prend soin de soi.</p>",
          "image": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=80",
          "layout": "default",
          "values": [
            {
              "title": "Produits naturels",
              "desc": "Des soins doux, respectueux de votre peau et de l'environnement."
            },
            {
              "title": "Gestes experts",
              "desc": "Une équipe formée et passionnée, à votre écoute."
            },
            {
              "title": "Sérénité absolue",
              "desc": "Une ambiance apaisante, loin du tumulte du quotidien."
            }
          ]
        }
      },
      {
        "id": "services",
        "type": "services",
        "enabled": true,
        "data": {
          "title": "Nos soins signature",
          "subtitle": "Des prestations pensées pour votre bien-être"
        }
      },
      {
        "id": "stats",
        "type": "stats",
        "enabled": false,
        "data": {
          "title": "La confiance de nos client·e·s",
          "items": [
            {
              "number": "12 000+",
              "label": "Soins prodigués"
            },
            {
              "number": "4,9/5",
              "label": "Note moyenne"
            },
            {
              "number": "10 ans",
              "label": "D'expérience"
            },
            {
              "number": "< 15 min",
              "label": "Réponse garantie"
            }
          ]
        }
      },
      {
        "id": "testimonials",
        "type": "testimonials",
        "enabled": true,
        "data": {
          "title": "Elles et ils en parlent mieux que nous",
          "source": "reviews",
          "items": []
        }
      },
      {
        "id": "gallery",
        "type": "gallery",
        "enabled": true,
        "data": {
          "title": "L'ambiance de notre institut",
          "columns": "3",
          "images": [
            {
              "url": "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=1400&q=80",
              "caption": "Espace détente"
            },
            {
              "url": "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=1400&q=80",
              "caption": "Soins du visage"
            },
            {
              "url": "https://images.unsplash.com/photo-1519824145371-296894a0daa9?auto=format&fit=crop&w=1400&q=80",
              "caption": "Rituel relaxant"
            },
            {
              "url": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80",
              "caption": "Notre cabine"
            }
          ]
        }
      },
      {
        "id": "faq",
        "type": "faq",
        "enabled": true,
        "data": {
          "title": "Questions fréquentes",
          "items": [
            {
              "question": "Comment réserver un soin ?",
              "answer": "Directement en ligne sur cette page, en choisissant la prestation et le créneau qui vous conviennent. C'est immédiat et sans appel."
            },
            {
              "question": "Puis-je annuler ou reporter ?",
              "answer": "Oui, vous pouvez annuler ou reporter jusqu'à 24h avant votre rendez-vous, simplement depuis votre e-mail de confirmation."
            },
            {
              "question": "Proposez-vous des cartes cadeaux ?",
              "answer": "Absolument ! Contactez-nous et offrez un moment de détente à celles et ceux que vous aimez."
            },
            {
              "question": "Faut-il arriver en avance ?",
              "answer": "Nous vous conseillons d'arriver 5 minutes avant afin de profiter pleinement de votre soin dans le calme."
            }
          ]
        }
      },
      {
        "id": "booking",
        "type": "booking",
        "enabled": true,
        "data": {
          "title": "Réservez votre moment",
          "subtitle": "Choisissez le soin et le créneau qui vous conviennent",
          "embedMode": "full"
        }
      },
      {
        "id": "cta",
        "type": "cta",
        "enabled": true,
        "data": {
          "title": "Offrez-vous une pause bien méritée",
          "text": "Nos praticien·ne·s vous accueillent 6 jours sur 7.",
          "buttonText": "Prendre rendez-vous",
          "buttonUrl": "#booking",
          "bg": "gradient"
        }
      },
      {
        "id": "contact",
        "type": "contact",
        "enabled": true,
        "data": {
          "title": "Nous trouver",
          "phone": "",
          "email": "",
          "address": ""
        }
      }
    ]
  },
  {
    "id": "studio",
    "name": "Studio",
    "tagline": "Barbier, coiffure, fitness",
    "description": "Un site sombre et percutant qui met en valeur votre style et vos prestations. Parfait pour les barbiers, salons de coiffure et studios de sport.",
    "bestFor": "Barbier · Coiffure · Fitness · Tatouage",
    "thumb": {
      "bg": "#0f1012",
      "accent": "#e8b04b",
      "text": "#f2f2f0"
    },
    "theme": {
      "primaryColor": "#e8b04b",
      "bgColor": "#0f1012",
      "textColor": "#f2f2f0",
      "fontFamily": "Montserrat",
      "roundness": "sharp"
    },
    "seo": {
      "title": "Studio — Prenez rendez-vous en ligne",
      "description": "Coupes précises, ambiance unique. Réservez votre créneau en ligne, sans appel."
    },
    "sections": [
      {
        "id": "hero",
        "type": "hero",
        "enabled": true,
        "data": {
          "title": "Votre style, notre signature",
          "subtitle": "Coupes précises, ambiance unique. Prenez rendez-vous et repartez transformé·e.",
          "ctaText": "Réserver maintenant",
          "heroLayout": "full",
          "textAlign": "left",
          "bgImage": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=80",
          "overlayOpacity": 60
        }
      },
      {
        "id": "stats",
        "type": "stats",
        "enabled": false,
        "data": {
          "title": "Le studio en chiffres",
          "items": [
            {
              "number": "25 000+",
              "label": "Coupes réalisées"
            },
            {
              "number": "4,9/5",
              "label": "Satisfaction"
            },
            {
              "number": "12 ans",
              "label": "Savoir-faire"
            },
            {
              "number": "7j/7",
              "label": "Ouvert"
            }
          ]
        }
      },
      {
        "id": "services",
        "type": "services",
        "enabled": true,
        "data": {
          "title": "Nos prestations",
          "subtitle": "Le geste juste, à chaque fois"
        }
      },
      {
        "id": "about",
        "type": "about",
        "enabled": true,
        "data": {
          "subtitle": "NOTRE HISTOIRE",
          "title": "Bien plus qu'un salon",
          "text": "<p>Né d'une passion pour le détail et le style, notre studio est un lieu où l'on prend le temps de bien faire. Chaque coupe est une rencontre, chaque client·e repart avec une allure qui lui ressemble.</p><p>Poussez la porte, installez-vous : vous êtes chez vous.</p>",
          "image": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=80",
          "layout": "reverse",
          "values": [
            {
              "title": "Précision",
              "desc": "Des finitions nettes et un savoir-faire technique irréprochable."
            },
            {
              "title": "Sur-mesure",
              "desc": "Une coupe adaptée à votre style de vie et à votre visage."
            },
            {
              "title": "Convivialité",
              "desc": "Une ambiance détendue où l'on aime prendre le temps."
            }
          ]
        }
      },
      {
        "id": "gallery",
        "type": "gallery",
        "enabled": true,
        "data": {
          "title": "Dans notre antre",
          "columns": "3",
          "images": [
            {
              "url": "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1400&q=80",
              "caption": "Le fauteuil"
            },
            {
              "url": "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1400&q=80",
              "caption": "Coupe homme"
            },
            {
              "url": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1400&q=80",
              "caption": "Détails"
            },
            {
              "url": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=80",
              "caption": "L'ambiance"
            }
          ]
        }
      },
      {
        "id": "testimonials",
        "type": "testimonials",
        "enabled": true,
        "data": {
          "title": "Ils nous font confiance",
          "source": "reviews",
          "items": []
        }
      },
      {
        "id": "faq",
        "type": "faq",
        "enabled": true,
        "data": {
          "title": "Vos questions",
          "items": [
            {
              "question": "Comment prendre rendez-vous ?",
              "answer": "En ligne, directement sur cette page. Choisissez votre prestation et votre créneau, c'est réglé en une minute."
            },
            {
              "question": "Puis-je venir sans réserver ?",
              "answer": "Nous privilégions la réservation pour vous garantir un créneau sans attente, mais passez nous voir, on fait toujours au mieux !"
            },
            {
              "question": "Quels moyens de paiement acceptez-vous ?",
              "answer": "Carte, espèces et paiement en ligne. À vous de choisir ce qui vous arrange."
            },
            {
              "question": "Proposez-vous des forfaits ?",
              "answer": "Oui, demandez-nous nos formules fidélité et cartes cadeaux en boutique."
            }
          ]
        }
      },
      {
        "id": "booking",
        "type": "booking",
        "enabled": true,
        "data": {
          "title": "Réservez votre créneau",
          "subtitle": "Simple, rapide, sans appel",
          "embedMode": "full"
        }
      },
      {
        "id": "cta",
        "type": "cta",
        "enabled": true,
        "data": {
          "title": "Prêt·e pour votre nouvelle coupe ?",
          "text": "Réservez en ligne en moins d'une minute.",
          "buttonText": "Je réserve",
          "buttonUrl": "#booking",
          "bg": "dark"
        }
      },
      {
        "id": "contact",
        "type": "contact",
        "enabled": true,
        "data": {
          "title": "Nous trouver",
          "phone": "",
          "email": "",
          "address": ""
        }
      }
    ]
  }
];

export const SITE_FONTS = ["Inter", "Poppins", "Lato", "Montserrat", "Playfair Display", "Lora", "Nunito", "DM Sans", "Merriweather", "Cormorant Garamond"] as const;

export const SECTION_LABELS: Record<SiteSectionType, string> = {
  hero: "En-tête",
  services: "Prestations",
  booking: "Réservation",
  about: "À propos",
  gallery: "Galerie",
  testimonials: "Avis",
  faq: "Questions fréquentes",
  contact: "Contact",
  stats: "Chiffres clés",
  cta: "Appel à l’action",
};

/** Sections d’un site neuf, pré-remplies avec les infos de l’établissement. */
export function defaultSections(b: { name: string; photoUrl: string | null; phone: string | null; email: string | null; address: string | null }): SiteSection[] {
  return [
    { id: "hero", type: "hero", enabled: true, data: { title: b.name, subtitle: "Réservez votre rendez-vous en ligne, rapidement et simplement.", ctaText: "Prendre rendez-vous", bgImage: b.photoUrl ?? "", heroLayout: "full", textAlign: "center", overlayOpacity: 45 } },
    { id: "services", type: "services", enabled: true, data: { title: "Nos prestations", subtitle: "Découvrez tous nos services" } },
    { id: "booking", type: "booking", enabled: true, data: { title: "Réservez en ligne", subtitle: "Choisissez votre créneau en quelques clics", embedMode: "full" } },
    { id: "about", type: "about", enabled: true, data: { title: "À propos", text: "<p>Bienvenue ! Présentez ici votre parcours, votre approche et ce qui vous distingue.</p>", image: "" } },
    { id: "testimonials", type: "testimonials", enabled: true, data: { title: "Ce qu’en disent nos clients", source: "reviews", items: [] } },
    { id: "contact", type: "contact", enabled: true, data: { title: "Nous trouver", phone: b.phone ?? "", email: b.email ?? "", address: b.address ?? "" } },
  ];
}
