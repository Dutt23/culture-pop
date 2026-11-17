/**
 * Every prop in the mascot's room is a reference. `thing` is what it looks like (its name for
 * screen readers, so the answer stays a secret); `title` and `line` are what the mascot says when
 * it's tapped. Lines are spoiler-free.
 */
export interface RoomPropInfo {
  thing: string;
  title: string;
  line: string;
}

export const ROOM_PROPS = {
  // The room itself: on every screen size.
  signal: {
    thing: 'A light shining in the sky',
    title: 'A hero signal',
    line: 'A city shines a symbol into the night sky when it needs its masked hero. The mascot made one with its own face.',
  },
  et: {
    thing: 'A bike crossing the moon',
    title: 'E.T. the Extra-Terrestrial (1982)',
    line: 'A boy pedals so hard his bike lifts off and flies across the full moon, one of the most copied shots in film.',
  },
  walkman: {
    thing: 'A cassette player with orange headphones',
    title: 'Guardians of the Galaxy (2014)',
    line: "Peter Quill's Walkman and orange headphones, playing the 'Awesome Mix' tape his mum made him.",
  },
  interstellar: {
    thing: 'Poster of a black hole',
    title: 'Interstellar (2014)',
    line: 'Gargantua, the giant black hole, drawn with help from real physicists. Its glowing ring bends over the top.',
  },
  gundam: {
    thing: 'Poster of a robot head',
    title: 'Gundam (1979)',
    line: "The giant piloted robots of Japan's longest-running mecha anime. The V on the head gives it away.",
  },
  rush: {
    thing: 'Poster of two race cars',
    title: 'Rush (2013)',
    line: 'James Hunt and Niki Lauda, fighting for the 1976 Formula One title: red Ferrari against white McLaren.',
  },
  memento: {
    thing: 'Two instant photos with notes',
    title: 'Memento (2000)',
    line: "A man who can't make new memories keeps track of his life with instant photos and notes.",
  },
  friendsDoor: {
    thing: 'A yellow oval frame',
    title: 'Friends (1994)',
    line: "The yellow frame around the peephole on Monica's purple apartment door.",
  },
  inception: {
    thing: 'Poster of a spinning top',
    title: 'Inception (2010)',
    line: "Cobb's spinning top: it tells him whether he's awake or inside someone's dream.",
  },
  bttf: {
    thing: 'Poster of two trails of fire',
    title: 'Back to the Future (1985)',
    line: 'The DeLorean hits 88 miles an hour and vanishes, leaving two trails of fire.',
  },
  jaws: {
    thing: 'Poster of a fin in the water',
    title: 'Jaws (1975)',
    line: 'Two notes of music and a fin. The film that made a whole summer afraid of the sea.',
  },
  ring: {
    thing: 'A television showing a well',
    title: 'The Ring (2002)',
    line: 'A cursed videotape that ends on an old well. Watch it, and the phone rings.',
  },
  couch: {
    thing: 'A brown leather couch',
    title: 'The Big Bang Theory (2007)',
    line: "Sheldon and Leonard's brown couch, where one cushion is Sheldon's spot. The mascot sits there anyway.",
  },
  mug: {
    thing: 'A very big mug',
    title: 'Friends: Central Perk',
    line: 'The cafe where the gang hangs out, famous for mugs nearly as big as bowls.',
  },
  coin: {
    thing: 'A gold coin',
    title: 'Sholay (1975)',
    line: 'Jai settles every big decision with a toss of his coin.',
  },
  plant: {
    thing: 'A plant in a pot',
    title: 'Guardians of the Galaxy Vol. 2 (2017)',
    line: "Baby Groot, dancing in his pot when he thinks nobody's watching.",
  },
  // The wall above the window and the low row: wide screens only.
  lights: {
    thing: 'Lights over a painted alphabet',
    title: 'Stranger Things (2016)',
    line: 'Christmas lights over a painted alphabet. A mother talks to her missing son one blinking letter at a time.',
  },
  metallica: {
    thing: 'Band poster with a lightning bolt',
    title: 'Metallica',
    line: "Heavy metal since 1981: lightning, thrashing guitars and 'Enter Sandman'.",
  },
  linkinPark: {
    thing: 'Band poster with a hexagon',
    title: 'Linkin Park',
    line: "Rap meets rock. 'In the End' and 'Numb' were on every 2000s playlist.",
  },
  queen: {
    thing: 'Band poster with a crown',
    title: 'Queen',
    line: "Freddie Mercury's band: 'Bohemian Rhapsody', 'We Will Rock You' and a crown on the crest.",
  },
  daftPunk: {
    thing: 'Band poster of two helmets',
    title: 'Daft Punk',
    line: 'The French dance duo who only ever showed up in robot helmets, one gold and one silver.',
  },
  ddlj: {
    thing: 'Poster of mountains and yellow fields',
    title: 'Dilwale Dulhania Le Jayenge (1995)',
    line: 'Raj and Simran, from the Swiss Alps to the mustard fields of Punjab. It ran in one Mumbai cinema for over 25 years.',
  },
  wasseypur: {
    thing: 'Poster of a mine tower',
    title: 'Gangs of Wasseypur (2012)',
    line: 'A feud between families that runs for decades in a coal-mining town. "Keh ke lenge!"',
  },
  dus: {
    thing: 'Poster of a big number',
    title: 'Dus (2005)',
    line: 'An anti-terror squad racing a countdown. "Dus" means ten.',
  },
  dune: {
    thing: 'Poster of a mouth in the sand',
    title: 'Dune (1965 book, 2021 film)',
    line: 'Sandworms the size of trains live under the desert of Arrakis. Walk without rhythm.',
  },
  revolver: {
    thing: 'A pistol in a holster',
    title: 'The Western',
    line: "A cowboy's six-shooter in its holster, the star of every high-noon standoff from Hollywood to Sholay.",
  },
  kitt: {
    thing: 'A black car with a red light',
    title: 'Knight Rider (1982)',
    line: 'KITT, the talking black car with a red light that sweeps from side to side.',
  },
  dhoom: {
    thing: 'A blue superbike',
    title: 'Dhoom (2004)',
    line: 'Superbike thieves and the cops chasing them, with a title song everyone still hums.',
  },
} satisfies Record<string, RoomPropInfo>;

export type RoomPropId = keyof typeof ROOM_PROPS;
