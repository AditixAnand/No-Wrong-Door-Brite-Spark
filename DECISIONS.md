# DECISIONS.md — No Wrong Door

Okay so this is basically the "why I did what I did" doc. Not a report, just me explaining the thinking behind the project so anyone reading it (a judge, me in 3 months, whoever) understands why it's built this way and not some other way.

## The actual problem

County has two systems that hold info about the same residents — Resident Index (the REST one) and Benefits Register (the XML one, old and slow and unreliable on purpose). Problem is these two systems have literally never talked to each other. Different ID formats, different name formats, different everything. A caseworker has to manually check both to get the full picture of one person. That's it, that's the whole pain point. "No Wrong Door" basically means — doesn't matter which system you'd normally have to open, you open one thing and get everything.

The hard part isn't building an API that hits two services. The hard part is: how do you know `R-10394` in one system and `AS/2024/4702` in the other system are literally the same human being, when nothing links them?

## How I approached it (planning-wise)

I didn't jump straight to code. First thing was reading the spec fully and figuring out the build order — normalize data first, then ingest, then figure out matching, THEN build the API on top of that, then the dashboard, then the extra reliability stuff. Basically bottom-up. No point building a pretty dashboard if the data underneath it is garbage.

Also decided early — don't touch `_pid`. It's literally the ground truth answer key hidden in the data for grading purposes, and using it would mean I'm not actually solving the real problem, just cheating the evaluation. So matching had to work purely off name, DOB, address, town. Nothing else.

## Tech stack — and why

- **Node + Express** for backend. Not because it's trendy, just because it's fast to build with, has good async support (which matters a LOT here since I'm juggling two unreliable external services), and honestly it's what I'm most comfortable in.
- **React (Vite)** for frontend. Same reason — quick to spin up, hot reload is nice for iterating fast, and I didn't need anything heavier like Next.js since this isn't a content site, it's an internal dashboard.
- **MongoDB** for storage. The data here is document-shaped already (a resident record, a benefits record, a link record) — didn't need relational joins, so a document DB made more sense than forcing this into SQL tables.
- **Redis** for caching — talked about this more below because it's actually one of the more interesting parts of the build.
- **JWT** for auth instead of sessions, mainly because it's simpler to reason about for this scale of project and matches the "Caseworker vs Supervisor" role split cleanly — the role just rides along in the token.

Nothing fancy, no random extra frameworks. I tried to keep it boring on purpose — the interesting problem here is the matching and the resilience, not the tech choices.

## The matching problem (this was the actual hard part)

Names invert (`Ashley Kessler` vs `KESSLER, Ashley`), addresses abbreviate differently (`St` vs `Street`), and about 58 XML records don't even have a date of birth — which is normally your strongest signal to tell two "John Smith"s apart.

First I normalize everything into one shape — uppercase, expand the street abbreviations, split names properly. Once both sides speak the same "language," I score how well a REST record and an XML record match, weighting date of birth and last name higher than first name or town, since DOB+lastname together are basically unique.

Where it got tricky — what happens when DOB is missing and TWO different people have the exact same name? You literally cannot tell them apart from data alone. My first instinct honestly was "just pick whichever scores slightly higher," but that felt wrong — if the system silently guesses wrong on someone's benefits record, that's a real person getting a real problem. So instead of guessing, I made ambiguous cases fall through to a review queue for an actual human to look at and decide. That's not me being lazy, that's an intentional design call — a machine shouldn't quietly resolve uncertainty about someone's identity for them.

I actually caught a bug in my own scoring logic while building this — first version was flagging way too many people as "ambiguous" (like 200+ when there should've only been a handful) because it was treating any two similar-ish scores as a tie, even weak coincidental ones. Fixed it so ambiguity only counts when both candidates are otherwise strong enough that they WOULD have auto-linked if not for the tie. Small fix, big difference in output quality (went from 208 false ambiguous cases down to 2 real ones).

## Caching — this is where I tried something a bit more clever

The obvious use of caching is "make things faster." I did that too (short TTL, so repeat lookups on the same person don't hammer the slow XML service every time). But the actually useful bit is this: I keep a SECOND, longer-lived copy of the last good response for each resident. So when the Benefits Register genuinely goes down (which it does, ~40% of the time by design), instead of just showing an error, it serves back that last-known-good data — clearly labeled as "stale, from X minutes ago" — instead of just leaving a blank hole where useful information used to be.

It's a small idea but it changes the whole feel of the app. A caseworker looking someone up doesn't get an error page just because the legacy system hiccuped for a second — they get slightly-old-but-still-useful info and know exactly how old it is. That's the kind of thing that actually matters in a real government office, not just a nice-to-have.

## The Day 2 surprise

Halfway in I got hit with a twist — Benefits Register's failure rate got bumped up permanently to 40% (from 15%), and the challenge specifically said: don't just patch around this one number, build something that would handle ANY source failing, not just this one.

Honestly this didn't break anything for me because of how I'd already structured the integration layer — sources were already being called through one generic function that didn't care WHICH source it was calling, just that it was calling "a source" and needed to handle success/failure/timeout the same way regardless. So the "fix" for the day 2 challenge wasn't really a fix, it was more just formalizing a pattern I'd already leaned toward. I even call this out directly in the code (there's actually a test file that runs the resilience layer against made-up source names like "housing" and "employment" just to PROVE the mechanism doesn't secretly know or care about Benefits Register specifically — I'm not fabricating those as real sources, just proving genericity).

The response now always tells you: complete (everything worked), partial (something failed but you still got useful data), or unavailable (nothing came through) — and that status shows up all the way to the dashboard, never silently swallowed.

## Extra stuff I built beyond the minimum ask

Once the core was solid I kept going and added the reliability/governance layer too, even though it's a stretch beyond the base requirement:

- **Source health monitoring** — live panel showing response times and success rate per source, refreshing every few seconds
- **Login + roles** — Caseworkers can search and view; Supervisors additionally get the review queue, audit logs, and reliability metrics
- **Audit trail** — every resident lookup and every review-queue decision gets logged with who/when/why
- **Reliability metrics + spike alerts** — tracks retry counts and actually flags when a source's failure rate suddenly jumps, which I tested live by cranking the failure rate up and watching the alert trip for real
- **Dark/light theme toggle** — small thing, not asked for, just nice to have

None of this was strictly required by the base spec, but I figured — the whole point of this problem is "stay useful when things go wrong," so it felt right to actually build the tools that let someone SEE that happening, not just claim it in a doc.

## Things I know aren't perfect

Being honest here since that matters more than pretending everything's flawless:
- Entity matching gets close to the real ground-truth numbers but not exact (which is expected and correct — a bit of ambiguity is the nature of the problem, not a bug)
- Review queue works but is fairly minimal — confirm/reject only, no bulk actions or undo
- Login accounts are a small fixed demo set, not a real user management system (spec never asked for one)
- Only tested on macOS/Chrome so far

I'd rather list these honestly than have someone find them and think I didn't notice.

## Wrapping up

The short version: two systems that don't know about each other, no shared ID, one of them actively unreliable — and the job was to make it feel like ONE system anyway, without ever guessing when I genuinely didn't know something, and without falling over when the unreliable one acted up. That's what I built toward the whole time, day 2 twist included.
