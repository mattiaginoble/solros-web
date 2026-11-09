/**
 * Configuratori ufficiali di IKEA Italia (dalla mappa del sito
 * https://www.ikea.com/sitemaps/planner-it-IT_1.xml). Sono solo collegamenti:
 * i progetti si fanno e si salvano sul sito IKEA.
 */

export interface IkeaPlanner {
  id: string;
  name: string;
  description: string;
  url: string;
}

export interface IkeaPlannerGroup {
  id: string;
  title: string;
  planners: IkeaPlanner[];
}

const BASE = "https://www.ikea.com/it/it/planners/";
const planner = (id: string, name: string, description: string, url = `${BASE}${id}/`): IkeaPlanner => ({ id, name, description, url });

export const IKEA_PLANNER_GROUPS: IkeaPlannerGroup[] = [
  {
    id: "casa",
    title: "Stanze intere",
    planners: [
      planner("home-design", "IKEA Kreativ", "Arreda una stanza in 3D partendo da un ambiente di esempio o dalle foto della tua.", "https://www.ikea.com/it/it/home-design/"),
      planner("bedroom-planner", "Camera da letto", "Progetta la camera: letto, armadi e contenitori nello spazio che hai."),
      planner("bathroom-planner", "Bagno", "Mobili lavabo, colonne e accessori per il bagno."),
      planner("office-planner", "Spazio di lavoro", "Scrivania, sedia e contenitori per lo studio di casa."),
      planner("outdoor-planner", "Esterni", "Balcone, terrazza o giardino."),
    ],
  },
  {
    id: "cucina",
    title: "Cucina",
    planners: [
      planner("kitchen-planner", "Cucina METOD", "Il progettista di cucine IKEA: mobili, elettrodomestici e accessori in 3D."),
      planner("knoxhult-planner", "Cucina KNOXHULT", "Cucina componibile già pronta, da montare in pochi passaggi."),
      planner("custom-worktop-calculator", "Piani di lavoro su misura", "Calcola il piano di lavoro tagliato sulle tue misure."),
      planner("appliance-guide", "Guida agli elettrodomestici", "Poche domande per trovare forno, frigorifero e lavastoviglie."),
    ],
  },
  {
    id: "armadi",
    title: "Armadi e cabine armadio",
    planners: [
      planner("pax-planner", "Armadi PAX", "Struttura, ante e accessori interni dell’armadio PAX."),
      planner("platsa-planner", "Armadi PLATSA", "Armadi e contenitori componibili PLATSA."),
      planner("skytta-planner", "Ante scorrevoli SKYTTA", "Sistema di ante scorrevoli per nicchie e cabine armadio."),
      planner("elvarli-planner", "Cabina armadio ELVARLI", "Guardaroba aperto, chiuso o misto."),
      planner("boaxel-planner", "Cabina armadio BOAXEL", "Binari, ripiani, cassetti e appendiabiti a parete."),
      planner("jonaxel-planner", "Cabina armadio JONAXEL", "Strutture con cestini e ripiani."),
      planner("lastare-planner", "Guardaroba LASTARE", "Configuratore del guardaroba LASTARE."),
    ],
  },
  {
    id: "soggiorno",
    title: "Soggiorno, librerie e contenitori",
    planners: [
      planner("besta-planner", "Mobili TV e contenitori BESTÅ", "Combinazioni per il soggiorno con ante, cassetti e ripiani."),
      planner("billy-planner", "Librerie BILLY", "Librerie BILLY con ante e moduli aggiuntivi."),
      planner("kallax-planner", "Scaffali KALLAX", "Scaffali a giorno con inserti e contenitori."),
      planner("eket-planner", "Contenitori EKET", "Moduli da combinare a parete o a pavimento."),
      planner("ivar-planner", "Scaffali IVAR", "Scaffali in legno massiccio componibili."),
      planner("bror-planner", "Scaffali BROR", "Scaffalature robuste per garage, cantina ed esterni."),
      planner("ladmakare-planner", "Contenitori LÅDMAKARE", "Configuratore dei contenitori LÅDMAKARE."),
    ],
  },
  {
    id: "divani",
    title: "Divani",
    planners: [
      planner("sofa-platform", "Trova il tuo divano", "Sfoglia i divani IKEA per stile e caratteristiche."),
      planner("soderhamn-planner", "Divani SÖDERHAMN", "Sedute profonde da comporre a piacere."),
      planner("kivik-planner", "Divani KIVIK", "Componi il divano KIVIK in pochi passaggi."),
      planner("vimle-planner", "Divani VIMLE", "Moduli, chaise-longue e rivestimenti VIMLE."),
      planner("jattebo-planner", "Divani JÄTTEBO", "Divano componibile JÄTTEBO."),
      planner("uppakra-planner", "Divani UPPÅKRA", "Divano componibile UPPÅKRA."),
      planner("lillehem-planner", "Divani LILLEHEM", "Moduli in legno e cuscini LILLEHEM."),
    ],
  },
  {
    id: "pranzo-studio",
    title: "Pranzo e scrivanie",
    planners: [
      planner("build-your-own-dining-set", "Set da pranzo", "Abbina tavolo e sedie."),
      planner("build-your-own-dining-table", "Tavoli da pranzo", "Scegli piano e gambe del tavolo."),
      planner("build-your-own-dining-chair", "Sedie da pranzo", "Personalizza le sedie."),
      planner("build-your-own-desk", "Scrivania su misura", "Piano, gambe e accessori della scrivania."),
      planner("build-your-own-mittzon", "Scrivania MITTZON", "Configura la scrivania MITTZON, anche regolabile in altezza."),
    ],
  },
  {
    id: "bambini",
    title: "Camerette",
    planners: [
      planner("smastad-planner", "Cameretta SMÅSTAD", "Letti, armadi e contenitori per la cameretta."),
      planner("trofast-planner", "Contenitori TROFAST", "Strutture con cassette colorate per i giochi."),
    ],
  },
];

export const IKEA_PLANNERS: IkeaPlanner[] = IKEA_PLANNER_GROUPS.flatMap((g) => g.planners);

export function ikeaPlanner(id: string): IkeaPlanner | undefined {
  return IKEA_PLANNERS.find((p) => p.id === id);
}
