# Query demand vs source coverage

Run 2026-11-15. Question: what do people actually ask about, and do Wikipedia, Wiktionary, Wikiquote, TVmaze and
MusicBrainz answer it? Companion to `docs/research/source-candidates.md`. Nothing in this file was filled from
memory: every hit/miss below comes from a live request logged in the research session, and anything not
checked is marked **NOT VERIFIED**.

## Method and limits

**Demand.** 60 queries. The WebSearch tool refuses `reddit.com` as a domain filter, so threads were found through a
semantic web-search index (Exa) whose results include Reddit thread pages. No Reddit API, no logins, no scraping by me.
42 of 60 evidence links are Reddit question threads (r/OutOfTheLoop, r/NoStupidQuestions, r/bollywood,
r/tipofmytongue, r/Music, r/IndianDankMemes, r/Animemes, r/ExplainLikeImCalvin, r/funny); the other 18 are
explainer pages (Know Your Meme, news, Times of India, etc.) because no question thread surfaced; those are tagged
`explainer` in the table. **Demand volume was not measured**: a thread existing is the only evidence. The set is
a convenience sample from a search index, skewed to English-language, 2017-2026 Reddit, and to things that have
an explainer; it is not a random draw of user queries. Categories are small (TV/cartoon n=2 testable, Film n=1,
Anime/game n=2), so category percentages there are anecdotes.

**Coverage.** Anonymous GET, header `Api-User-Agent: PopCultureDecoder-research/0.1`, no personal data.
Wikipedia and Wikiquote: `generator=search`, `gsrlimit=5`, namespace 0 (query as typed). Wiktionary: exact title,
lower-case and as typed. TVmaze: `/search/shows?q=`, first 5. MusicBrainz: `artist` and `recording` search,
`limit=5`, `fmt=json`, no custom headers (curl default), tested only on 12 queries where a band/song is the answer
(Music category plus M13 and Q6); other queries are `n/t` (not tested), not misses.
Request volume: about 5 per query on the first pass. That pass was paced too fast (0.4 s between Wikimedia calls,
~1.2 s between MusicBrainz calls) and drew HTTP 429 on 37 Wikimedia calls and 503 on 11 of 24 MusicBrainz calls,
so those cells were re-fetched with 1.5 s+ growing back-off, plus ~70 verification requests (disambiguation and
Wiktionary content checks). That is more than "a few" for some queries. Only final 200 responses are used. **The Wikidata Query Service adapter the app already has was not tested here.**

**Scoring.** Cell values: `H<n>` = the right reference (its own article/entry/recording) at rank n of the top 5;
`P<n>` = only a related page (parent work, genre page, person page) at rank n; `D<n>` = a disambiguation page at
rank n whose slang sense I did not check (NOT VERIFIED); `miss`; `n/t` not tested; `NV` canonical not verified so
not scored. Coverage % counts `H` only (strict) over the 58 queries with a verified canonical reference (2 rows
are NV). "Right reference" was decided by a per-query title pattern, then checked by eye against the returned titles;
cases where a title matched but the page was wrong (e.g. footballer "Nani", "Nani Palkhivala", a TVmaze show called
"Among Us", MusicBrainz joke recordings named "Midwest Emo") were downgraded by hand. Raw JSON was kept in the
session scratchpad, not in the repo.

## Results table

Columns WP = Wikipedia search, WT = Wiktionary exact title, WQ = Wikiquote search, TV = TVmaze, MB = MusicBrainz.
"Misremembered form" shows a second typed variant and whether Wikipedia (WP) / Wikiquote (WQ) found the reference;
origin says whether the variant is attested in a thread/user example or is my own constructed variant.

| ID | Query as typed | Canonical reference | Category | Demand evidence | WP | WT | WQ | TV | MB | Misremembered form |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | cash me outside | Cash Me Ousside / Danielle Bregoli (Dr. Phil, 2016) | Meme | [explainer](https://knowyourmeme.com/memes/cash-me-ousside-howbow-dah) | H1 | miss | miss | miss | n/t | "catch me outside" (user example): WP miss, WQ miss |
| M2 | skibidi toilet | Skibidi Toilet (YouTube Shorts series) | Meme | [explainer](https://knowyourmeme.com/memes/skibidi-toilet) | H1 | miss | miss | miss | n/t | - |
| M3 | 6 7 meme | 6-7 meme (Skrilla, Doot Doot) | Meme | [explainer](https://www.nbcnewyork.com/news/national-international/what-do-kids-mean-67/6383058/) | H1 | miss | miss | miss | n/t | "six seven" (constructed): WP H1, WQ miss |
| M4 | understandable have a nice day | 'Understandable, Have a Nice Day' meme | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/hpgxyq/whats_the_deal_with_the_understandable_have_a/) | miss | miss | miss | miss | n/t | - |
| M5 | mcdonalds sprite | McDonald's Sprite meme (spilled-drink tweet) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/qi172f/whats_the_deal_with_mcdonalds_sprite/) | miss | miss | miss | miss | n/t | - |
| M6 | gigachad | Gigachad meme | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/o45xg1/whats_the_deal_with_the_face_on_the_right_it/) | P1 | H | miss | miss | n/t | - |
| M7 | punch the monkey | Punch (Ichikawa City Zoo macaque) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/1rdln5j/whats_the_deal_with_punch_the_monkey/) | H1 | miss | miss | miss | n/t | - |
| M8 | nihilist penguin | Nihilist penguin (Herzog, Encounters at the End of the World) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/1qlfkfw/whats_the_deal_with_these_recent_penguin_memes/) | H1 | miss | miss | miss | n/t | - |
| M9 | ctrl alt del loss comic | Loss (Ctrl+Alt+Del) webcomic / 'Loss' meme | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/yefe3l/whats_the_deal_with_these_unusual_memes/) | H1 | miss | miss | miss | n/t | - |
| M10 | italian brainrot | Italian brainrot (AI animal characters) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/1nh71u7/whats_the_deal_with_this_italian_brain_rot_craze/) | H1 | miss | H1 | miss | n/t | - |
| M11 | tralalero tralala | Tralalero Tralala (Italian brainrot character) | Meme | [explainer](https://meme.fandom.com/wiki/Italian_Brainrot) | P1 | miss | P1 | miss | n/t | - |
| M12 | bombardiro crocodilo | Bombardiro Crocodilo (Italian brainrot character) | Meme | [explainer](https://trending.knowyourmeme.com/editorials/guides/whats-with-the-bombardiro-crocodilo-ai-video-going-viral-on-tiktok-the-italian-brainrot-meme-explained) | P1 | miss | miss | miss | n/t | - |
| M13 | epic sax guy | Epic Sax Guy / 'Run Away' by Sunstroke Project (Eurovision 2010) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/1b9e0n0/whats_the_deal_with_this_sax_solo/) | H5 | miss | miss | miss | H5 | - |
| M14 | waltuh breaking bad | 'Waltuh' meme (Mike/Walter White, Breaking Bad) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/yhcb53/whats_the_deal_with_waltuh_themed_comments/) | miss | miss | miss | miss | n/t | - |
| M15 | its morbin time | 'It's morbin' time' (Morbius, 2022) | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/121342c/whats_the_deal_with_all_of_these_my_favorite_part/) | P1 | miss | miss | miss | n/t | - |
| M16 | sus among us | 'Sus' / Among Us | Meme | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/o6pad0/whats_up_with_everyone_commenting_sus_and_get_out/) | H1 | miss | miss | miss | n/t | - |
| S1 | rizz | rizz (slang) | Slang | [explainer](https://www.merriam-webster.com/slang/rizz) | H1 | H | miss | miss | n/t | - |
| S2 | no cap | no cap (slang) | Slang | [explainer](https://lr.sudovanilla.org/r/etymology/comments/mtwq6u/what_is_the_etymology_of_cap_and_no_cap) | D1 | H | miss | miss | n/t | - |
| S3 | bussin | bussin (slang) | Slang | [explainer](https://meme.com/memes/bussin) | D1 | H | miss | miss | n/t | - |
| S4 | username checks out | 'username checks out' (Reddit idiom) | Slang | [thread](https://www.reddit.com/r/NoStupidQuestions/comments/vooppb/what_does_it_mean_when_people_say_username_checks/) | miss | miss | miss | miss | n/t | - |
| S5 | mods are asleep | 'mods are asleep, upvote X' (Reddit idiom) | Slang | [thread](https://www.reddit.com/r/NoStupidQuestions/comments/8e2pog/what_does_it_mean_when_people_say_mods_are_asleep/) | miss | miss | miss | miss | n/t | - |
| S6 | 420 | 4/20 (cannabis culture) | Slang | [thread](https://www.reddit.com/r/NoStupidQuestions/comments/4f2cd4/420/) | H2 | H | miss | miss | n/t | - |
| S7 | nani | 'Nani' (anime exclamation meme) | Slang | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/6yz7rj/what_is_the_meme_that_people_say_nani/) | D3 | H | miss | miss | n/t | - |
| Q1 | i've fallen and i can't get up | Life Call / 'Help, I've fallen and I can't get up' ad (1989) | Quote | [thread](https://www.reddit.com/r/ExplainLikeImCalvin/comments/1f92tsc/where_did_the_phrase_ive_fallen_and_i_cant_get_up/) | H1 | miss | miss | miss | n/t | - |
| Q2 | where's the beef | Wendy's 'Where's the beef?' (1984, Clara Peller) | Quote | [thread](https://www.reddit.com/r/funny/comments/1j875n/dude_wheres_the_beef/) | H1 | H | miss | miss | n/t | "where is the beef" (constructed): WP H1, WQ miss |
| Q3 | i'm kind of a big deal | Anchorman (Ron Burgundy) | Quote | [explainer](https://memescomefrom.com/memes/kind-of-a-big-deal/) | H2 | miss | miss | miss | n/t | "im kind of a big deal i have many leather bound books" (constructed): WP miss, WQ miss |
| Q4 | show me the money | Jerry Maguire (1996) | Quote | [explainer](https://screenrant.com/famous-movie-quotes-film-originated/) | H2 | miss | miss | miss | n/t | - |
| Q5 | the revolution will not be televised | Gil Scott-Heron poem/song (1970) | Quote | [thread](https://www.reddit.com/r/NoStupidQuestions/comments/1o337xv/what_does_it_mean_when_people_say_the_revolution/) | H1 | H | H1 | miss | n/t | "revolution will not be televised quote" (constructed): WP H1, WQ H2 |
| Q6 | hey baby i hear the news are calling for salads and scrambled eggs | Frasier theme 'Tossed Salads and Scrambled Eggs' | Quote | [thread](https://www.reddit.com/r/NoStupidQuestions/comments/v5qir3/what_does_it_mean_when_people_say_hey_baby_i_hear/) | miss | miss | miss | miss | H1 | "frasier theme song lyrics" (constructed): WP H1, WQ miss |
| Q7 | omae wa mou shindeiru | 'You are already dead' (Fist of the North Star) | Quote | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/70jbk6/why_are_omae_wa_mou_shindeiru_memes_rising_in/) | H2 | miss | miss | miss | n/t | "oh my yo wa moo shin dae doo hee yun knee" (thread-attested): WP miss, WQ miss |
| Q8 | yeah i got time incredibles | The Incredibles ('Yeah, I got time') | Quote | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/6w6z2k/whats_the_deal_with_this_incredibles_meme_thats/) | H1 | miss | H1 | miss | n/t | - |
| Q9 | want a sprite cranberry | King of the Hill 'Chasing Bobby' / Sprite Cranberry ad | Quote | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/b79j0c/whats_the_deal_with_sprite_being_a_meme/) | miss | miss | miss | miss | n/t | - |
| Q10 | that was his mistake big hero 6 | Big Hero 6 ('That was his mistake') | Quote | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/o0di9e/whats_the_deal_with_the_that_was_his_mistake_meme/) | P2 | miss | H1 | miss | n/t | - |
| T1 | baby yoda | Grogu (The Mandalorian) | TV/cartoon | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/e1ogky/whats_the_deal_with_the_baby_yoda_meme/) | H1 | miss | miss | miss | n/t | - |
| T2 | are you ready for your kiss now explodey | Ren & Stimpy ('Stimpy's Cartoon Show', per commenter) | TV/cartoon | [thread](https://www.reddit.com/r/tipofmytongue/comments/c05lzj/tomttelevision1990s2000s_oldtimey_looking_cartoon/) | miss | miss | miss | miss | n/t | - |
| T3 | whoever smelt it dealt it cartoon mayor | NOT VERIFIED (thread unresolved in retrieved text) | TV/cartoon | [thread](https://www.reddit.com/r/tipofmytongue/comments/yk5jpo/tomt_tv_show_90s2000s_animated_seriesmovie_with_a/) | NV | NV | NV | NV | n/t | - |
| F1 | three fingers inglorious bastards | Inglourious Basterds (2009) three-fingers scene | Film | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/1gnee26/whats_the_deal_with_this_photo_on_twitter/) | miss | miss | miss | miss | n/t | "inglorious bastards" (thread-attested (comment spells "Inglorious Bastards")): WP H3, WQ miss |
| B1 | midwest emo | Midwest emo (genre) | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/13uxnzp/whats_the_deal_with_midwest_emo_intro_memes/) | H1 | miss | H1 | miss | miss | - |
| B2 | neutral milk hotel meme | Neutral Milk Hotel (band) | Music | [thread](https://www.reddit.com/r/NoStupidQuestions/comments/5otgj7/what_is_this_neutral_milk_hotel_meme/) | miss | miss | miss | miss | H1 | - |
| B3 | messages from the stars rah band | 'Messages from the Stars' (RAH Band, 1983) | Music | [thread](https://www.reddit.com/r/Music/comments/1i8cbxk/whats_the_deal_with_messages_from_the_stars_by/) | miss | miss | miss | miss | H1 | - |
| B4 | tool band | Tool (band) | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/czfuft/whats_the_deal_with_the_band_tool_and_why_is/) | H1 | miss | H1 | miss | H1 | - |
| B5 | ruler of everything tally hall | 'Ruler of Everything' (Tally Hall) | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/lhf13n/whats_up_with_ruler_of_everything_by_tally_hall/) | H2 | miss | miss | miss | H1 | - |
| B6 | can you play wonderwall | 'Wonderwall' (Oasis) joke | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/cvrtua/whats_up_with_the_wonderwall_joke/) | H1 | miss | miss | miss | miss | - |
| B7 | fucking magnets how do they work | 'Miracles' (Insane Clown Posse) | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/d5c5d1/whats_the_deal_with_all_the_dislikes_on_insane/) | H1 | miss | miss | miss | miss | - |
| B8 | mo bamba | 'Mo Bamba' (Sheck Wes) | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/arautz/whats_the_deal_with_the_sheck_wes_song_mo_bamba/) | H2 | miss | miss | miss | H1 | - |
| B9 | post malone ozzy osbourne | Post Malone / Ozzy Osbourne ('Take What You Want') | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/d1fhji/whats_the_deal_with_people_thinking_post_malone/) | H1 | miss | miss | miss | H1 | - |
| B10 | everywhere at the end of time | The Caretaker, 'Everywhere at the End of Time' | Music | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/jddz54/whats_the_deal_with_the_caretakers_everywhere_at/) | H1 | miss | miss | miss | H1 | - |
| A1 | nah id win | 'Nah, I'd win' (Jujutsu Kaisen ch. 221, Gojo) | Anime/game | [explainer](https://knowyourmeme.com/memes/nah-id-win) | miss | miss | miss | miss | n/t | - |
| A2 | steal a brainrot | Steal a Brainrot (Roblox game) | Anime/game | [thread](https://www.reddit.com/r/OutOfTheLoop/comments/1nh71u7/whats_the_deal_with_this_italian_brain_rot_craze/) | H1 | miss | miss | miss | n/t | - |
| I1 | mogambo khush hua | Mogambo / Mr. India (1987) | India | [explainer](https://www.freepressjournal.in/viral/video-of-arvind-kejriwal-laughing-like-mogambo-khush-hua-goes-viral-after-atishi-marlena-becomes-new-delhi-cm) | H1 | miss | miss | miss | n/t | n/a (same string) |
| I2 | rasode mein kaun tha | Kokilaben / Saath Nibhaana Saathiya (Yashraj Mukhate rap) | India | [explainer](https://timesofindia.indiatimes.com/life-style/food-news/when-twitter-cooked-up-memes-on-kokilabens-viral-video-ki-rasode-me-kaun-tha/articleshow/77735446.cms) | H2 | miss | miss | miss | n/t | "kokilaben rap" (constructed): WP H1, WQ miss |
| I3 | paisa hi paisa hoga | Phir Hera Pheri (2006) | India | [thread](https://www.reddit.com/r/IndianDankMemes/comments/uy4qrn/paisa_hi_paisa_hoga_babu_bhaiya/) | miss | miss | miss | miss | n/t | "babu bhaiya paisa hi paisa hoga" (thread title): WP miss, WQ miss |
| I4 | utha le re baba | Hera Pheri (2000), Baburao | India | [explainer](https://www.thedailyjagran.com/entertainment/news/12-iconic-bollywood-dialogues-that-became-viral-internet-trends-kitne-aadmi-the-utha-le-re-baba-and-more-10314957) | miss | miss | miss | miss | n/t | "uthale re baba" (constructed): WP miss, WQ miss |
| I5 | bilkul ricks nahi lene ka | Hera Pheri (Baburao: 'bilkul risk nahi lene ka') | India | [explainer](https://mews.in/evergreen-indian-meme-templates-in-hindi-with-meaning-how-to-use/) | miss | miss | miss | miss | n/t | "bilkul risk nahi lene ka" (constructed (normalised spelling)): WP miss, WQ miss |
| I6 | kitne aadmi the | Sholay (1975), Gabbar Singh | India | [explainer](https://www.thedailyjagran.com/entertainment/news/12-iconic-bollywood-dialogues-that-became-viral-internet-trends-kitne-aadmi-the-utha-le-re-baba-and-more-10314957) | H2 | miss | H1 | miss | n/t | - |
| I7 | bhai aap kya kehna chahte ho | Shashi Tharoor viral Hindi reply (Aug 2025) | India | [explainer](https://ground.news/article/bhai-aap-kya-kehna-chahte-ho-shashi-tharoors-hilarious-reply-leaves-internet-in-splits) | miss | miss | miss | miss | n/t | - |
| I8 | money follows my brother ravi kishan | Ravi Kishan podcast line (2026) | India | [explainer](https://www.deccanchronicle.com/tabloid/hyderabad-chronicle/gen-z-slang-enters-parliament-debates-1983032) | P1 | miss | miss | miss | n/t | - |
| I9 | average in everything kareena kapoor dialogue | Ek Main Aur Ekk Tu (2012), per commenter | India | [thread](https://www.reddit.com/r/bollywood/comments/vxmjvt/can_anyone_please_tell_which_movie_is_this/) | miss | miss | miss | miss | n/t | - |
| I10 | mil jaye to mitti kho jaye to sona | Ahista Ahista (1981) / Jagjit Singh ghazal, per commenter | India | [thread](https://www.reddit.com/r/BollyBlindsNGossip/comments/1ik37fq/which_movie_is_this_dialogue_from/) | miss | miss | miss | miss | n/t | - |
| I11 | gaadi titanic waali laana tinted | NOT VERIFIED (commenters disagree: Hera Pheri vs Aan: Men at Work) | India | [thread](https://www.reddit.com/r/bollywood/comments/1b92cmv/which_movie_is_this_dialogue_from/) | NV | NV | NV | NV | n/t | - |

Rows T3 and I11: threads exist, but the retrieved text does not settle the answer (T3 unresolved; I11 commenters
disagree between Hera Pheri and Aan: Men at Work), so the canonical reference is **NOT VERIFIED** and they are not scored.
Canonicals marked "per commenter" (T2, I9, I10) rest on one Reddit comment and were not independently verified.
M3/M6/M10-12 etc. canonicals come from the cited explainer or thread answer.

## Coverage per source

| Source | Strict hits | Notes |
|---|---|---|
| Wikipedia search | 31/58 (53%) | +9 partial/disambiguation-only |
| Wiktionary exact title | 8/58 (14%) | Slang only: rizz, no cap, bussin, nani, gigachad, 420, where's the beef, the revolution will not be televised |
| Wikiquote search | 7/58 (12%) | Mostly work/person pages, not the quote line; 1 case not already in Wikipedia |
| TVmaze search (as typed) | 0/58 (0%) | Matches show titles only; see "second hop" below |
| MusicBrainz (12 tested) | 9/12 (75%) | Artist/recording titles; lyric/meme phrasings often fail; see below |
| **Wikipedia + Wiktionary (today's text sources)** | **35/58 (60%)** | |
| **All five combined** | **39/58 (67%)** | MB counted only where tested |

### By category (strict hits)

| Category (n scored) | WP | WT | WQ | TV | MB | WP+WT | All |
|---|---|---|---|---|---|---|---|
| Meme (16) | 9 (56%) | 1 (6%) | 1 (6%) | 0 | 1/1 | 10 (62%) | 10 (62%) |
| Slang (7) | 2 (29%) | 5 (71%) | 0 | 0 | n/t | 5 (71%) | 5 (71%) |
| Quote/catchphrase (10) | 7 (70%) | 2 (20%) | 3 (30%) | 0 | 1/1 | 7 (70%) | 9 (90%) |
| TV/cartoon (2) | 1 | 0 | 0 | 0 | n/t | 1 | 1 |
| Film (1) | 0 | 0 | 0 | 0 | n/t | 0 | 0 |
| Music (10) | 8 (80%) | 0 | 2 (20%) | 0 | 7 (70%) | 8 (80%) | 10 (100%) |
| Anime/game (2) | 1 | 0 | 0 | 0 | n/t | 1 | 1 |
| Indian pop culture (10) | 3 (30%) | 0 | 1 (10%) | 0 | n/t | 3 (30%) | 3 (30%) |

Wiktionary beats Wikipedia on slang (5 of 7 vs 2 of 7): Wikipedia returns disambiguation pages for "no cap", "bussin",
"420", "nani"; Wiktionary has real entries, except that "bussin" is only an alternate-form stub pointing to "bussin'".

### Misremembered and paraphrased forms

Of the 11 variants tested, 6 hit Wikipedia. The 4 with real attestation (M1 "catch me outside", Q7 "oh my yo wa
moo shin dae doo hee yun knee", I3, F1) did poorly, 1 of 4 (F1, rank 3): phonetic or sound-alike misspellings missed everywhere (M1, Q7,
I5 "ricks"). Cases where the variant found it but the typed form did not: Q6 (full lyric as typed returned nothing; "frasier
theme song lyrics" found Frasier) and F1 (typed junk; "inglorious bastards" gave Inglourious Basterds at rank 3).
Cases where the correct canonical wording hit but the sloppy one did not: M1, Q3, Q7. Takeaway: Wikipedia search
is forgiving about spacing and "meme" suffixes ("six seven", "where is the beef") but not about sound-alike spellings.

## Gaps no source covers

19 of 58 have no strict hit in any source tested:

- Memes whose own page does not exist: understandable-have-a-nice-day (M4), McDonald's Sprite (M5), Waltuh (M14),
  nah-I'd-win (A1, JJK page not even surfaced as a partial).
- Brainrot characters and film-meme phrases get only a parent page (partial): tralalero tralala, bombardiro crocodilo
  (-> Italian brainrot), "it's morbin time" (-> Morbius film).
- Reddit/internet idioms: "username checks out" (S4), "mods are asleep" (S5).
- Ad/TV one-liners: "want a sprite cranberry" (Q9, King of the Hill), Ren & Stimpy "Explodey/Poopy" (T2), Inglourious
  Basterds three-fingers scene as typed (F1).
- Indian pop culture, 7 of 10 miss: "paisa hi paisa hoga", "utha le re baba", "bilkul ricks nahi lene ka" (all Hera
  Pheri), "bhai aap kya kehna chahte ho" (Tharoor reply), Ravi Kishan's line (person page only, partial),
  the Kareena dialogue, and the "mil jaye to mitti" couplet. Wikipedia only answered Mogambo, Rasode, Sholay.
  Dialogue-level lookups (a line inside a film) are the clearest hole: Wikipedia indexes film titles, not lines.

## "Second hop": sources that need a title first

TVmaze scored 0/58 on typed queries because it matches show names, not references. Queried by the canonical
title it found every show tried (Frasier, The Ren & Stimpy Show, King of the Hill, Breaking Bad, The Mandalorian,
Saath Nibhaana Saathiya, Taarak Mehta Ka Ooltah Chashmah: 7 of 7). Wikiquote by canonical title found Frasier,
Breaking Bad, King of the Hill, Anchorman, Sholay but not "Mr. India" (checked 6 titles, 5 found). So TVmaze and Wikiquote
work as enrichment after Wikipedia/Wikidata resolves the work, not as discovery sources. MusicBrainz is the only
candidate that discovered things Wikipedia/Wiktionary missed (3 of 12).

## What to add: ranking

Ranked by new strict coverage over Wikipedia + Wiktionary in this sample (n=58, treat as directional):

1. **Query rewriting before search** (not a new source; evidence: ranking effects above). Strip "meme/what is/what does ... mean",
   try the typed string plus a keyword-reduced variant, search several candidates (Wikipedia and Wiktionary both,
   lower-case and as typed). Wiktionary alone added 4 slang hits Wikipedia answered with disambiguation pages, and
   keyword reduction fixed Q6 and F1. Cost: zero new hosts. Phonetic spellings (M1, Q7, I5) still need a fuzzy step; no tested source did it.
2. **MusicBrainz artist/recording search for music-shaped queries**: +3 new hits (Neutral Milk Hotel, RAH Band, the
   Frasier theme) on 12 tested, 9/12 overall. Caveats: user-uploaded joke recordings pollute recording search
   (e.g. "Midwest Emo", "Fucking Magnets"), so match artist first; it returned 503 on 11 of 24 calls at ~1.2 s spacing, so a client needs back-off;
   browser CORS for the client-only app was **NOT VERIFIED** in this run (see `source-candidates.md` for what was checked).
3. **Indian-language and Indian-pop-culture coverage** (largest category gap, 30%). Not tested here and therefore
   **NOT VERIFIED**: Hindi Wikipedia search with Devanagari or romanised queries, Wikidata labels/aliases for dialogue-bearing films.
   An explainer page existed for several missed Indian items (Indian Meme Templates, Times of India, Daily Jagran
   links in the table), but coverage, licence and CORS of those hosts were not checked; treat as link-out candidates only.
4. **Wikiquote**: +1 new hit (Big Hero 6 page) in this sample. It rarely surfaces the quote line itself for casual
   phrasing. Worth adding only as a second hop for film/TV quotes once a work is known.
5. **TVmaze**: 0 discovery value as typed; useful for show metadata after the work is resolved (7/7 by title).
6. **Link-out to meme encyclopedias** (a Know Your Meme page was in the search results for M1, M2, M3, M12, A1, Q7): would plausibly close the Meme and Anime/game gaps (M4, M5, M14, A1, M11, M12) but their coverage was not
   measured here (no API, link-only per existing rule), so the gain is **NOT VERIFIED**.

## Not checked

Wikidata Query Service coverage for these 60 queries; Hindi/other-language Wikipedia; MusicBrainz and Wikiquote browser
CORS; any ingestion or licence terms; Fandom, TV Tropes, Urban Dictionary, Genius, KYM coverage; demand volume or
recency weighting; whether Wikipedia disambiguation pages (D rows: no cap, bussin, nani) list the slang sense.
