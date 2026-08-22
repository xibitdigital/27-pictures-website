/**
 * Front-cover story and subtitle, one block per toon, all four reader languages.
 * Shared FlipFrame chrome (how to read, about, auto-read) lives in flipframeCopy.ts.
 */
import type { LocalizedString } from "./bookReader/flipframeCopy";

export interface CoverCopy {
  subtitle?: LocalizedString;
  synopsis: LocalizedString;
}

export const COVER: Record<string, CoverCopy> = {
  jax: {
    subtitle: {
      en: "Cyberpunk Chronicles",
      it: "Cronache cyberpunk",
      de: "Cyberpunk-Chroniken",
      fr: "Chroniques cyberpunk",
    },
    synopsis: {
      en:
        "In a neon city that sells minds by the megacorp, Jax is a netrunner dying by inches: a rare sickness eats his body while his code still cuts like a blade.\n\n" +
        "He does not rob banks — he steals mind-control tech from the corporations that build it, then turns their own weapons against the leash.\n\n" +
        "A future Robin Hood in a trench coat and chrome, racing the clock inside his own skull: liberate the street, stay human long enough to finish the run.",
      it:
        "In una città al neon che vende le menti a peso di megacorp, Jax è un netrunner che muore a centimetri: una malattia rara gli mangia il corpo mentre il suo codice taglia ancora come una lama.\n\n" +
        "Non rapina banche — ruba alle corporazioni la tecnologia per il controllo mentale, poi rivolge le loro armi contro il guinzaglio.\n\n" +
        "Un Robin Hood del futuro in trench e cromo, in corsa contro l'orologio dentro il proprio cranio: liberare la strada, restare umano abbastanza da finire la corsa.",
      de:
        "In einer Neonstadt, die Gehirne an Megakonzerne verkauft, ist Jax ein Netrunner, der zentimeterweise stirbt: eine seltene Krankheit frisst seinen Körper, während sein Code noch schneidet wie eine Klinge.\n\n" +
        "Er raubt keine Banken — er stiehlt den Konzernen die Gedankenkontrolltechnik, die sie bauen, und dreht ihre eigenen Waffen gegen die Leine.\n\n" +
        "Ein Robin Hood der Zukunft in Trenchcoat und Chrom, im Wettlauf mit der Uhr in seinem eigenen Schädel: die Straße befreien, Mensch bleiben, lange genug für den letzten Run.",
      fr:
        "Dans une ville au néon qui vend les esprits aux mégacorpos, Jax est un netrunner qui meurt au centimètre : une maladie rare lui mange le corps pendant que son code coupe encore comme une lame.\n\n" +
        "Il ne braque pas les banques — il vole aux corporations leur technologie de contrôle mental, puis retourne leurs armes contre la laisse.\n\n" +
        "Un Robin des Bois du futur en trench et chrome, à la course contre l'horloge dans son propre crâne : libérer la rue, rester humain assez longtemps pour finir la run.",
    },
  },
  erin: {
    subtitle: {
      en: "Between two worlds",
      it: "Tra due mondi",
      de: "Zwischen zwei Welten",
      fr: "Entre deux mondes",
    },
    synopsis: {
      en:
        "Erin is half human, half vampire — too much of each world to belong fully to either.\n\n" +
        "She lives in a small town that is not really a town at all: a thin place, a passage between the goblin world and the human one, where roads fold wrong at night and doors open onto forests that do not appear on any map.\n\n" +
        "Blood, bargains, and old names move through her streets. She is the threshold’s keeper — and its most dangerous secret.",
      it:
        "Erin è metà umana, metà vampira — troppa di ciascun mondo per appartenere del tutto a uno dei due.\n\n" +
        "Vive in una piccola città che non è davvero una città: un luogo sottile, un passaggio tra il mondo dei goblin e quello umano, dove di notte le strade si piegano storto e le porte si aprono su boschi che non stanno su nessuna mappa.\n\n" +
        "Sangue, patti e nomi antichi attraversano le sue strade. È la custode della soglia — e il suo segreto più pericoloso.",
      de:
        "Erin ist halb Mensch, halb Vampir — von jeder Welt zu viel, um ganz zu einer zu gehören.\n\n" +
        "Sie lebt in einer Kleinstadt, die keine ist: ein dünner Ort, ein Durchgang zwischen der Goblinwelt und der menschlichen, wo sich nachts Straßen falsch falten und Türen in Wälder führen, die auf keiner Karte stehen.\n\n" +
        "Blut, Handel und alte Namen ziehen durch ihre Gassen. Sie ist die Hüterin der Schwelle — und ihr gefährlichstes Geheimnis.",
      fr:
        "Erin est à moitié humaine, à moitié vampire — trop de chaque monde pour appartenir vraiment à l'un ou à l'autre.\n\n" +
        "Elle vit dans une petite ville qui n'en est pas une : un endroit mince, un passage entre le monde des gobelins et celui des humains, où la nuit les routes se plient de travers et les portes s'ouvrent sur des forêts qui ne figurent sur aucune carte.\n\n" +
        "Le sang, les marchés et les vieux noms traversent ses rues. Elle est la gardienne du seuil — et son secret le plus dangereux.",
    },
  },
  "erin-the-revenge": {
    subtitle: {
      en: "The Revenge",
      it: "La vendetta",
      de: "Die Rache",
      fr: "La vengeance",
    },
    synopsis: {
      en: "Erin tears a portal open and crosses into the goblin world. She wakes in a forest that is already watching her, and something winged and made of stone takes her out of it. What saves her is a stranger who can move the ground itself — and who is willing to teach. Erin came looking for a missing child. She goes back for the debt.",
      it: "Erin squarcia un portale e attraversa il mondo dei goblin. Si sveglia in una foresta che già la osserva, e qualcosa di alato, fatto di pietra, la porta via. A salvarla è uno sconosciuto che muove la terra stessa — e che è disposto a insegnarle. Erin era venuta a cercare un bambino scomparso. Torna per il debito.",
      de: "Erin reißt ein Portal auf und tritt in die Goblinwelt. Sie erwacht in einem Wald, der sie schon beobachtet, und etwas Geflügeltes aus Stein holt sie heraus. Was sie rettet, ist ein Fremder, der den Boden selbst bewegen kann — und der bereit ist zu lehren. Erin kam wegen eines vermissten Kindes. Sie geht zurück wegen der Schuld.",
      fr: "Erin déchire un portail et passe dans le monde des gobelins. Elle se réveille dans une forêt qui la regarde déjà, et quelque chose d'ailé, fait de pierre, l'en arrache. Ce qui la sauve, c'est un inconnu qui peut bouger la terre elle-même — et qui accepte de lui apprendre. Erin venait chercher un enfant disparu. Elle y retourne pour la dette.",
    },
  },
  nero: {
    subtitle: {
      en: "Scotland Yard case",
      it: "Un caso di Scotland Yard",
      de: "Ein Fall für Scotland Yard",
      fr: "Une affaire de Scotland Yard",
    },
    synopsis: {
      en:
        "In a rain-soaked city of wetwork and wet labs, detective Nero — ex-military, one hand lost to a terrorist attack and rebuilt in steel — follows a trail of blood and crystal.\n\n" +
        "His ally Eve, a Scotland Yard forensic specialist whose AI-enhanced glasses can tag faces and materials, reads the evidence he cannot. Between them stands The Dog: a cold-blooded sicario who never misses.\n\n" +
        "Together Nero and Eve must crack the crystal case, hunt The Dog through the rooftops and the lab, and uncover who hired the bullet — and what near-invisible implant tech it was meant to protect.",
      it:
        "In una città fradicia di pioggia, di delitti e di laboratori, il detective Nero — ex militare, una mano persa in un attentato e ricostruita in acciaio — segue una scia di sangue e cristallo.\n\n" +
        "La sua alleata Eve, forense di Scotland Yard con occhiali potenziati dall'IA che etichettano volti e materiali, legge le prove che lui non può. Tra loro c'è The Dog: un sicario a sangue freddo che non sbaglia mai.\n\n" +
        "Insieme Nero ed Eve devono risolvere il caso del cristallo, dare la caccia a The Dog tra tetti e laboratorio, e scoprire chi ha pagato il proiettile — e quale tecnologia da impianto, quasi invisibile, doveva proteggere.",
      de:
        "In einer regenverhangenen Stadt aus Auftragsmord und Nasslaboren folgt Detective Nero — Ex-Militär, eine Hand bei einem Anschlag verloren und aus Stahl neu gebaut — einer Spur aus Blut und Kristall.\n\n" +
        "Seine Verbündete Eve, Forensikerin von Scotland Yard, deren KI-Brille Gesichter und Materialien markiert, liest die Spuren, die er nicht sehen kann. Zwischen ihnen steht The Dog: ein kaltblütiger Killer, der nie danebenliegt.\n\n" +
        "Zusammen müssen Nero und Eve den Kristallfall knacken, The Dog über Dächer und Labor jagen und herausfinden, wer die Kugel bezahlt hat — und welche fast unsichtbare Implantattechnik sie schützen sollte.",
      fr:
        "Dans une ville trempée de pluie, de contrats et de laboratoires, le détective Nero — ex-militaire, une main perdue dans un attentat et reconstruite en acier — suit une traînée de sang et de cristal.\n\n" +
        "Son alliée Eve, légiste de Scotland Yard dont les lunettes dopées à l'IA étiquettent visages et matières, lit les preuves qu'il ne peut pas. Entre eux se tient The Dog : un sicaire de sang-froid qui ne rate jamais.\n\n" +
        "Ensemble, Nero et Eve doivent casser l'affaire du cristal, traquer The Dog sur les toits et dans le labo, et découvrir qui a payé la balle — et quelle techno d'implant presque invisible elle devait protéger.",
    },
  },
  "redsmile-marcus": {
    subtitle: "RED SMILE",
    synopsis: {
      en:
        "The second episode of the RED SMILE series.\n\n" +
        "Marcus is CEO of NEXORA. He works until late. Halina cleans the tower, and nobody in it knows her name.\n\n" +
        "A transmission starts on his laptop. Something darker is lurking.",
      it:
        "Il secondo episodio della serie RED SMILE.\n\n" +
        "Marcus è il CEO di NEXORA. Lavora fino a tardi. Halina pulisce la torre, e nessuno lì dentro sa come si chiama.\n\n" +
        "Sul suo laptop parte una trasmissione. Qualcosa di più oscuro è in agguato.",
      de:
        "Die zweite Folge der Reihe RED SMILE.\n\n" +
        "Marcus ist CEO von NEXORA. Er arbeitet bis spät. Halina putzt den Turm, und niemand darin kennt ihren Namen.\n\n" +
        "Auf seinem Laptop beginnt eine Übertragung. Etwas Dunkleres lauert.",
      fr:
        "Le deuxième épisode de la série RED SMILE.\n\n" +
        "Marcus est le PDG de NEXORA. Il travaille tard. Halina nettoie la tour, et personne à l'intérieur ne connaît son nom.\n\n" +
        "Une transmission démarre sur son ordinateur. Quelque chose de plus sombre rôde.",
    },
  },
  "redsmile-static": {
    subtitle: "RED SMILE",
    synopsis: {
      en:
        "The first episode of the RED SMILE series.\n\n" +
        "Psychological horror drawn in heavy black-and-white gekiga ink — crushed shadows, hand-inked plates, light that never quite reaches the corners.\n\n" +
        "Elena is alone in the flat when the television finds a channel that should not exist.",
      it:
        "Il primo episodio della serie RED SMILE.\n\n" +
        "Horror psicologico a china gekiga, bianco e nero pesante — ombre schiacciate, tavole inchiostrate a mano, una luce che non arriva mai del tutto negli angoli.\n\n" +
        "Elena è sola in casa quando la televisione trova un canale che non dovrebbe esistere.",
      de:
        "Die erste Folge der Reihe RED SMILE.\n\n" +
        "Psychologischer Horror in schwerer Schwarzweiß-Gekiga-Tusche — zerdrückte Schatten, handgetuschte Tafeln, Licht, das die Ecken nie ganz erreicht.\n\n" +
        "Elena ist allein in der Wohnung, als der Fernseher einen Kanal findet, den es nicht geben dürfte.",
      fr:
        "Le premier épisode de la série RED SMILE.\n\n" +
        "Horreur psychologique à l'encre gekiga, noir et blanc dense — ombres écrasées, planches encrées à la main, une lumière qui n'atteint jamais tout à fait les coins.\n\n" +
        "Elena est seule chez elle quand la télévision trouve une chaîne qui ne devrait pas exister.",
    },
  },
};
