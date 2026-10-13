# Changelog

All notable changes to Bus Countdown are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers count up by one for each build that went onto the phone (there was no 4.1 to 4.4: the numbering went from 4 straight to 4.5). Versions 4.12 to 4.25 were built between 3 and 6 October 2026 and are listed under the last of those days.

Each release's project file is attached to its [GitHub release](../../releases). Stop names and routes in these notes are the stand-ins used throughout the repository.

## [4.59] - 2026-10-12

### Added

- Moving along your route. With no word from TfL about the bus you're on (no live data for the route, or a bus Bus Watch didn't see you get on), a slow spell no longer ends the ride while you keep moving forward along one of your routes' lines: every position in the last few minutes within 40 m of it, never going back along it, and averaging 1.4 m/s or more within 2 minutes of last moving at bus speed (a crawl in traffic), or 2.2 m/s after that (faster than anyone walks for long). On Monday the 517 had no live data all day, so there was no bus to follow, and both rides to work were taken as over almost at once: 2.5 minutes after leaving Kiln Street, and 35 s after Bus Watch saw you on the second bus; replayed, both now last until you got off. On the recordings since Thursday, replayed without TfL's word on your bus, it keeps you on the bus for 137 of the 222 minutes you rode, up from 75 (Monday: 39 of 53, up from 12), for about a minute and a half more "on the bus" in all after getting off at work (Friday and Monday). Getting off well short and walking on along the road still ends a countdown 2 minutes later, as before (the Corvel Lodge walk): it only stops a crawl reading as "off the bus, on foot". The island shows and ends at the same moments as in 4.58 on all five days. TfL's word comes first: once it has the bus gone on without you, moving along its road doesn't keep you on it. Recorded as `rt` on each position it kept (the pace along the route, m/s).


### Added

- Following your bus. While you ride a bus Bus Watch saw you get on, TfL is asked which stops that bus calls at next (`/Vehicle/{id}/Arrivals`, at most every 45 s, or 20 s while you're moving slowly). The bus is somewhere between the stop before its next one and that stop: if you are too, a slow spell is the bus crawling in traffic, and the ride carries on. Once the bus has gone on past you, or you're well off its road, you got off, and the ride ends as before. On Thursday and Friday Bus Watch had you off the bus for about half of the 148 minutes you rode, and four times called a crawl "off the bus, on foot". Replayed with TfL's word on each bus (worked out from where you rode, as last week's recordings don't have TfL's replies for the bus), it keeps you on for 142 of the 148 minutes, and the one "on foot" left is on a ride Bus Watch hadn't seen you get on. A fix too rough to place you (over 60 m) can't end a ride TfL had with you in the last minute. With nothing from TfL, everything works as in 4.57. A failed request isn't repeated on the next position: it waits 90 s, then 180, then 300 at most, and Bus Watch waits no more than 5 s for an answer. Bus Status shows what TfL last said about your bus. Recorded as `follow` lines (a failed request too), which a replay plays back.

### Changed

- Each day's trip recording has a file of its own, named by its date and weekday (`bus-trip-2026-10-12-Mon.jsonl`), and every day is kept until you delete it. Before, each weekday's file was started afresh when that day came round again, so a week not yet uploaded was lost.

### Fixed

- When TfL stops answering, every one of your routes falls back to its timetable. Each stop's timetable is now fetched for all your routes there on your first visit of the day, not only those with no live time just then. On Monday evening the requests at Wexley (Stop D) failed from 17:43 to 17:48; the 566 had been live when you got there, so it had no timetable to fall back on, and once its last times ran out the island showed only the 517. A timetable request with no reply (or TfL busy or failing: 429, 5xx) is tried again 5 minutes later, rather than being taken as no buses today; Bus Status says which routes are still waiting for one. About 10 more small requests a day.
- A failed request for live times is recorded with why, as Tasker gave it, or the code TfL answered with (`err`), and the debug log says so. Monday's failures at Wexley, and at Corvel Lodge from 17:10 to 17:16, came back in under a second with nothing to say why.
- A countdown lost to Tasker stopping (it restarted, or Android stopped it) starts again while you're still at the stop, or still heading for it, instead of counting as you having left. On Monday morning the countdown at Kiln Street went that way, and "you've just left this stop" kept it away for 10 minutes while you stood at the stop; it also missed you getting on the bus there. Replayed, it comes back 33 s later and sees you board. Only Bus End clears the running flag, so a flag still set with Bus Loop gone means Tasker stopped. If you've already gone (on a bus by the first check after Tasker came back), it's handled as before, so getting on is still seen; and it starts again only once per stop in 15 minutes.
- Opening Settings during a countdown restarted Tasker as the screen was shown, and the countdown with it (Monday 12 October). Settings now takes the island down before showing its screen, as turning the phone sideways does (whether it's showing or due to be drawn again), nothing draws it while Settings is open (a screen turned on, or the phone turned upright, used to), and a refresh brings it back once the screen closes and what was saved has been said, if Bus Loop is really running; since 4.57 the island's page can resize its own window at any moment. Settings also lists only the nearest 6 stops near you besides your saved ones (10 before), which takes up to about 75 KB off the layout Tasker hands to the screen in one go (about 200 KB with a few saved stops, 285 KB with 10).
- No countdown for a stop whose buses all go back the way the bus came, as your bus passes it or within 2 minutes of getting off by it. On Thursday and Friday evenings the 566 home stood by Kiln Street on the other side of the road, close enough to be inside its circle, and a countdown for buses back to Wexley started both times (swiped away within 16 s on Thursday). The bus's way comes from TfL's stops while it has the bus with you (the 566 crawled the last 9 minutes on Friday, never at bus speed), or from your positions at bus speed, so your walk after getting off never counts. Once you're off the bus it only applies within 2 minutes of last moving at bus speed. A stop where a route carries on your way, or turns off, still shows, as does a run by hand, or one you cross the road to later.

## [4.57] - 2026-10-11

### Changed

- The island shrinks at the next refresh with 8 dp or more to spare, instead of waiting for two in a row, and still grows the moment its times need more room. On last week's recordings that's about 50 resizes on a busy day rather than 25 to 29, each the island's own window sliding, for a fit within 1 to 2 dp. (Fitting exactly at every refresh came to 91 to 98, for a fit only 1 to 2 dp closer.)

### Fixed

- A bus turning due between refreshes keeps the next one's time. "1 · 15 min" became "Due · 14 min", which no longer fitted, so the island dropped the second time and left "Due" alone in a gap sized for the longer line: 5 to 14 buses a day last week, for 2½ to 8 minutes a day in all. It now grows to fit the moment it turns due, without waiting for Bus Refresh. If its window can't resize itself, it drops the second time as before.

## [4.56] - 2026-10-09

### Changed

- Holding the island switches to the other side of the road the moment the hold is long enough. The island's page now carries the other stop's times (got ready after each refresh since 4.45), so it shows them itself, then has Tasker make that stop current. Before, it dimmed while it waited for Tasker, a quarter to half a second.
- A stop switched to shows its route, destination and times at once, sliding in as a route does when you swipe. 4.48 showed the stop's name on the left for 0.6 s first, which on stops without a letter came out as "opp · Mar…", and said nothing the destination didn't. Measured on the phone, a switch took 1.6 s from finger down to the route showing; now the new side appears as the hold ends, 0.45 s, and has settled 0.2 s later. The name still fills the island while a stop's times are on their way.

## [4.55] - 2026-10-09

### Fixed

- The screen coming on at home or at work no longer gets a location fix once Bus Watch knows where that place is. The fix only refined `%BusHomeAt` or `%BusWorkAt`, which had stopped gaining weight after 10 positions, and getting it took up to 7 seconds, during which Tasker ran nothing else: a Text to Calendar chip copied just after unlocking at work appeared after 8 seconds instead of 2. Positions Android pushes there still refine it, and running Bus Watch by hand still checks.

## [4.54] - 2026-10-09

### Fixed

- Adjust live no longer stays over the lock screen. Left open when the screen went off, its panel and island showed over the lock screen when it came back on; now they're closed as the screen comes on, as Cancel would, and a countdown's own island comes back.

## [4.53] - 2026-10-09

### Fixed

- Adjust live's Cancel and Done buttons are no longer cut off: the panel is 380 dp tall instead of 300, room for its text at Android's larger font sizes, and scrolls if it's ever taller still. The line under its title ("It moves as you slide. Done saves it.") is gone.

## [4.52] - 2026-10-09

### Added

- Settings › Island › Position › Adjust live: the island shows where it goes, with sliders at the bottom of the screen for the camera gap and the top offset (the offset from the left and the top for the status bar chip). It moves as you slide, without being drawn again: its page moves and resizes its own window. Done saves and reopens Settings on the Position page; Cancel leaves the position as it was. While it's open, a countdown's own island stays hidden, and it comes back where it now goes.

### Removed

- Preview, which Adjust live replaces (and its flash with it).

## [4.51] - 2026-10-09

### Fixed

- Settings' preview flashes less as the stop board appears. The preview's island closed itself after 3 seconds, fading out, while the board was still being built, and the board then faded in. The board is now built while the island shows and appears on top of it at once, and only then does the island go. A short flash is left: the board is a new window, empty for about 0.2 s before its page draws. (4.48 matched their widths, which wasn't the cause.)

## [4.50] - 2026-10-09

### Fixed

- The island's text no longer grows and moves right when the island widens. Since 4.46 the island widens its own window to fit its times (and since 4.47 the stop board widens a little), and the web view zoomed the whole page by the widths' ratio as it did: switching to a stop with more times made the text about 9% bigger, cut short at the island's end ("3 · 14 m"). The page's zoom is pinned at 100%, and if it's zoomed all the same, the island is drawn again at its new width.
- 4.48's sizing for Android's font size is taken out: the island's text is never drawn at Android's font size, and the cut-short times it was meant to fix were this zoom.

## [4.49] - 2026-10-09

### Added

- Settings › Island: the buzz when a bus is under 5 minutes away can be turned off. The island still shows the times as usual, and the main page's Island entry says "no buzz" while it's off.

## [4.48] - 2026-10-09

### Fixed

- The island is sized for Android's font size. Its text is drawn at the size set in Android's Settings (115% on the phone), but its widths were measured at 100%, so since 4.46 the times could be cut short ("3 · 14 m") and the stop board's lines with them. A second after the island appears, its page measures the minutes it drew, and the first time they're drawn at another size than the island was sized for, the island is drawn again to fit; from then on it's sized for it.
- In Settings' preview, the stop board no longer flashes as it appears over the island: the preview's island is drawn at its board's width, so their ends line up, as they did before the board could widen (4.47).

### Changed

- Switching to the other side of the road shows its times as soon as the island changes, with the stop's name on the left for 0.6 s ("Stop B · High Street"). The whole island used to show the name for 1.2 s first, two thirds of the wait. The name still fills the island while a stop's times are on their way.
- A long press is 450 ms instead of 550, so a switch comes 0.1 s sooner. (Not Android's own 400: a tap on the island can last half a second.)

## [4.47] - 2026-10-09

### Changed

- The stop board widens a little when its lines need it: enough for three times on a route ("12 · 24 · 37 min") and for a route badge wider than the island's (N68), so its destination still shows. It grows outwards from the camera gap, as it grows down out of the island, and stops 8 dp short of the screen's edges. Tucking it back in goes back to the island at its own fitted width.

## [4.46] - 2026-10-09

### Changed

- The island is fitted to its times: just wide enough for the widest showing, instead of always keeping room for "88 · 88 min". It grows the moment the times need more room (a second time appearing, "9" becoming "10", a timetable "~", a route coming back), so nothing is cut short, and shrinks only after two refreshes in a row with 8 dp or more to spare, with the screen on and the stop board closed, so it doesn't keep changing size. It resizes its own window to do it, as the stop board grows, so the camera gap stays put and only its right end moves; if the window doesn't change, it's drawn again at the new width instead.
- The route dots always have 10 dp of space between them and the times.

## [4.45] - 2026-10-09

### Changed

- Switching to the other side of the road shows its times at once. After each refresh, while a countdown runs with the screen on, Bus Refresh gets the stop a long press goes to ready: its live times (unless they're under 40 seconds old) and, once a day, its timetable for routes with no live time there. A long press then shows that stop with its times straight away, and Bus Refresh builds the island from them instead of waiting 1 to 2 s for TfL. Bus Loop fetches fresh ones as usual.

## [4.44] - 2026-10-09

### Changed

- Settings is laid out like Android's own. The main page has an entry for each part (Stops and routes, Countdown, Home and work, Island, Setup), each saying what it's set to now, and a tap opens its page. The top bar shows the page's name, and its back arrow goes up a level; on the main page it saves and closes, as Done did. Where the island sits (the camera gap, the distance from the top and the chip's offset, with Preview and Reset) is a page of its own under Island.

## [4.43] - 2026-10-08

### Added

- The stop board grows out of the island and tucks back into it. Tap the island and its own window grows down into the board over 0.4 s: the stop's name fades in and the rows drop in one after another. Closing, the rows fade and the board tucks back up in a quarter of a second. No new window is drawn for it any more, and a route coming or going while it's open resizes it.
- A swipe moves the whole island with your finger, and it fades as it nears the point where letting go dismisses it. Let go there and it's gone at once; short of it, it slides back to its place.

### Changed

- Opening the stop board never waits for TfL. It opens with the times there are and, if they're 20 seconds old or more, fetches new ones straight after, and the board updates itself. Closing never fetches. An open took about 1 s, and 1.8 to 3.4 s when the times were older than 20 seconds; it now takes about half a second either way, and closing about a third of a second.
- With several of your routes at the stop, a quick flick only ever changes route: dismissing takes a long, deliberate drag (130 dp), and the fade only starts past where a route change ends. With one route it's as before: 90 dp, or a quick 60 dp flick.
- Switching stop with a long press shows the new stop at once, with its times if they were fetched in the last 3 minutes, and gets its live times before anything else: 1 to 2 s instead of 4 to 5. The timetable is only fetched for your routes TfL has no live time for, after the island is shown.
- The island answers every touch straight away: its words dim while Tasker works on a tap or a long press.
- Swiping the island away removes it before anything else, and a refresh under way is stopped, so it can't come back.
- The island fades in only when it first appears. Redrawing or removing it no longer fades.
- Fewer scripts run each time the island is drawn (each costs about 0.3 s on the phone): the scene name is picked inside `island_show.js`, and the board doesn't check which way up the phone is.
- The trip recorder's lines are written by Tasker steps straight after each script, not from inside it.

### Fixed

- A long press as a refresh was writing to the trip recorder (the screen coming on, say) hung both for 45 seconds, and the stop never switched. On Thursday at 14:27 the island stayed on the old stop.
- A swipe could be left hanging half-way out, the countdown never ending, when Android didn't say the finger had lifted. Losing the touch now counts as letting go too, and a finger that neither moves nor lifts for 2 seconds is let go without acting on it.

## [4.42] - 2026-10-08

### Added

- The stop board. Tap the island and it grows down into a board of every bus at the stop: your routes first, in Settings order, then the stop's other routes, soonest first, with outlined badges, up to 8 lines. It's the island's own width, and the camera gap runs down the middle, with routes to its left and times to its right ("2 · 8 · 19 min", as many as fit). The first line is the stop and how old its times are. Tap again or swipe up to close it; it closes by itself after 10 seconds, unless your finger is on it. A long press still switches stop, and the board stays open for the new one.
- Settings: what the stop board shows (all routes, or yours only) and when it closes (after 10 or 30 seconds, or only when tapped). Preview shows the island for 3 seconds and then its stop board for 4.

### Changed

- Bus Refresh keeps a third time for each of your routes, for the board.
- Opening or closing the board shows the island again, the new one on top before the old one goes. It only fetches new times if the last were fetched 20 seconds or more ago.

### Fixed

- Drawing the island again at a new size (switching to a stop with a different number of your routes) now removes the old one.

## [4.41] - 2026-10-08

### Added

- Bus Refresh keeps the stop's other routes, the ones that aren't yours: each one's next three times, soonest first, up to 8 routes. They go in the island's data, ready for the stop board (tap the island to see every bus at the stop), which isn't built yet. Nothing on the island changes.
- The trip recorder records those routes with each TfL reply (`o`), so replays can test the stop board.

## [4.40] - 2026-10-08

### Fixed

- Getting on a bus is seen however the countdown ended. Once you've left a stop you'd got to, being 150 m or more along a route that calls there, faster than walking on average since you left, means you got on a bus there, and Bus Watch works out which one. On Tuesday the countdown at Corvel Lodge ended on its own just before the 517 came, so the ride to Wexley never knew its bus, and the 517 stayed on the island there as only "probably" yours. On Wednesday, off the tram at Kiln Street and onto the 566, the ride counted as still being on the tram.
- The stop by home or work stays quiet for 15 minutes after you get off a bus, not 5. On Thursday you got off by work at 09:20, and walking in past the stop at 09:26 started its countdown, until the work Wi-Fi ended it.

## [4.39] - 2026-10-08

### Fixed

- The bus you got on is no longer a bus TfL had already dropped while you were still standing at the stop. On Thursday at Kiln Street it picked the 566 that left a minute before the 517 you caught, so Bus Status said you were on the 566.
- A bus held at a stop on the way to the one shown no longer ends the ride. If the trip ended as "went past" or "no longer coming up soon" while you were riding, and you then keep up bus pace, you're still on the bus, and still on the bus you got on. On Thursday the 517 waited at Wexley a minute and a half and the rest of the ride counted as "just left a stop".
- A tram or bus standing still short of the stop shown no longer ends its countdown. "No longer coming up soon" now takes 2 minutes at walking pace; standing still doesn't count. On Thursday the tram stood still 25 s, the countdown ended, and it came back 2 minutes later.

## [4.38] - 2026-10-08

### Fixed

- A train standing at a station near your bus route no longer shows the bus stop there as one you're riding to. Heading for a stop by bus now needs a fix good to 50 m: on Wednesday evening, standing at Wexley 200 m from the route, one fix of ±100 m landed on it.
- The trip recorder only counts a day as started once its first line is really written; if that write fails, the next line starts the file again, with the setup. Each new file is announced to Android's media index, so the Files app lists it.

### Changed

- Bus Status shows how many lines today's recording has and when the last was written, or that it's missing and the last write error.
- Bus Status's "Last got on" says "(off it now)" once you're no longer riding that bus.

## [4.37] - 2026-10-07

### Added

- The trip recorder also writes the fix as Android gave it (`rlat`, `rlon`) when a poor one was averaged with the one before.

### Fixed

- Replays play each fix as Android gave it. The recordings hold the averaged position, which the replay averaged a second time, smoothing away the very jumps that misled the phone: Wednesday evening's walk replayed as "turned away" on 4.35's rules, though the phone had said "on a bus". It now replays exactly as the phone decided, and 4.36's fix holds on it.

## [4.36] - 2026-10-07

### Fixed

- Walking briskly away from a stop no longer reads as passing it on a bus. A speed worked out from two positions counts as bus speed only if it's still faster than walking once the two fixes' error is allowed for, and when you were walking towards the stop, passing it on a bus takes two fast readings in a row. On Wednesday evening one jumpy fix (±29 m, then ±45 m, 86 m apart in 20 s) and one high reading from Android had ended a walk as "on a bus".

## [4.35] - 2026-10-07

### Fixed

- The 20-second skip for a second fetch (new in 4.34) never ran, because scripts can't read `%caller1`. Bus Refresh now copies it into `%busrefby` first.
- A boarding worked out with the help of a "probably" bus you came in on is saved as not sure, so a wrong guess can't take a bus off the island.
- The bus you got on is forgotten again once the trip is over and you've been off bus speed for 5 minutes.
- Replays: an ending with no reason, in recordings from before 4.27, counts as Bus Watch's own only when it comes up to 2 s after a position that stopped the countdown.
- The travel mode on trial starts again if its saved state is the wrong shape, and Bus Status copes with a missing reading.

### Changed

- The mockup's timeline lists only the versions that changed how the island looks.

## [4.34] - 2026-10-07

### Changed

- Only a bus you were seen getting on at a stop counts as yours. A bus matched on your arrival time alone is "probably" yours: it stays on the island like any other and nothing buzzes while you ride. Coming into Kiln Street on the tram, 4.33 had hidden the very bus you were about to catch.
- A crawl in traffic that read as "left" no longer makes the project forget the bus you got on while you're still moving at bus speed.

### Added

- Bus Loop and the screen coming on no longer both fetch times within 20 seconds for the same stop. Switching stop, a Settings preview or a run by hand always fetch.
- Travel mode on trial: a Kalman filter and a hidden Markov model work out still, walking or riding at every position. It's recorded and shown in Bus Status, but nothing decides on it yet.

## [4.33] - 2026-10-07

### Changed

- Trip recordings go to their own folder, `Download/Tasker-bus-trip-data`, which the project creates when Record trips is on.

## [4.32] - 2026-10-07

### Fixed

- Times are still fetched with the screen off once the next bus is within 8 minutes (it used to keep the minutes from the last fetch).
- Your bus is forgotten when a countdown ends mid-ride.
- Walking the last bit to a stop no longer counts as riding.

## [4.31] - 2026-10-07

### Changed

- While you ride, later buses on your own route keep their place and time but get a grey badge, the island's idle colour, so the next 517 never looks like yours.

## [4.30] - 2026-10-07

### Changed

- While you ride, your own bus leaves the island, so it shows only the buses you could change to. Bus Status says which bus you're on.

## [4.29] - 2026-10-07

### Changed

- Your bus keeps its You label but loses the light blue, so it's the same quiet grey as any destination.

## [4.28] - 2026-10-07

### Added

- Works out which bus you're on. It shows as You (or Your bus, with 6 or 10 letters of destination) in light blue, never buzzes, and Bus Status names your connection.

## [4.27] - 2026-10-07

### Changed

- A bus TfL drops while still 2 minutes or more away stays on its countdown, marked ~, for up to 3 minutes.

### Fixed

- Stops by home or work no longer pop up when you arrive by bus.

## [4.26] - 2026-10-06

### Fixed

- The buzz never vibrated, because one script declared two results on one line.

## [4.25] - 2026-10-06

### Added

- The trip recorder, which saves each day's positions and TfL replies to Downloads for replaying.

### Changed

- A longer buzz.

## [4.24] - 2026-10-06

### Fixed

- The stop you just got on at no longer pops up while the bus is held up inside its circle.

## [4.23] - 2026-10-06

### Changed

- Bus Status copies its report to the clipboard however it's run.

## [4.22] - 2026-10-06

### Fixed

- Standing at a stop counts even when the GPS fix wanders, so the countdown starts.

## [4.21] - 2026-10-06

### Changed

- Only the soonest bus buzzes, so two routes arriving together give one set of buzzes.

## [4.20] - 2026-10-06

### Added

- Three buzzes when a bus is under 5 minutes away, on two refreshes for each bus.

## [4.19] - 2026-10-06

### Changed

- The countdown carries on, for up to 2 hours, while you're still waiting at the stop.

## [4.18] - 2026-10-06

### Fixed

- The countdown ends when you get off short of the stop.
- A bus TfL lists twice no longer shows as "24 · 24".

## [4.17] - 2026-10-06

### Fixed

- Bus Settings opens during a countdown.

## [4.16] - 2026-10-06

### Changed

- The island is narrower again, after the preview looked far too big: room for "88 · 88 min", with the second time left out whenever it wouldn't fit.

## [4.15] - 2026-10-06

### Changed

- The island is sized once per stop, for all your routes there, so a route dropping out of TfL's list never resizes it.

## [4.14] - 2026-10-06

### Fixed

- No more flashing: new times redraw in place, and a new size is shown before the old island goes. (It kept room for "~88 · ~88 min", which made it too wide; 4.16 fixed that.)

## [4.13] - 2026-10-06

### Added

- Shared script helpers, a linter, and tests for how tasks run together.

### Changed

- Four tasks merged into others.

## [4.12] - 2026-10-06

### Fixed

- On a bus, a stop behind you is never picked.
- Waiting still no longer trips the safety net.
- Arrival circles are capped at 200 m.

## [4.11] - 2026-10-03

### Added

- The next two buses on each route ("5 · 17 min", the second quieter).

### Changed

- An easier swipe to dismiss: 90 dp, or a 60 dp flick.

## [4.10] - 2026-10-02

### Added

- A one-minute heads-up at your desk.

### Changed

- Fewer tasks and profiles, and positions are requested at a rate that suits the trip.

## [4.9] - 2026-10-02

### Added

- A trip state machine over your last six positions, with smoothing and your place along the route.

## [4.8] - 2026-10-02

### Changed

- On commutes, the side of the road heading home or to work comes first, and leaving ends the countdown sooner.

## [4.7] - 2026-10-02

### Added

- Bus Status gains a Debugging report.

### Fixed

- Profiles switch themselves on after an import.

## [4.6] - 2026-10-01

### Added

- Starts from your speed and position, and shows a stop you're heading for a few minutes early.

### Changed

- Every step has a plain label.

## [4.5] - 2026-10-01

### Added

- A settings screen.
- The island gains the TfL-style stop-letter ring, a few letters of destination, minutes at a fixed spot and faded old times, and hides when the phone turns sideways.

### Changed

- Only your saved stops are used.

## [4] - 2026-09-28

### Added

- The island becomes the main display, fitted to the measured camera, with the status bar chip as a fallback. A long swipe dismisses it and a long press switches to the stop opposite.

## [3] - 2026-09-28

### Added

- Setup questions, saved stops and starting by itself.
- When TfL has no prediction the timetable fills in, shown with ~ in grey.

## [2] - 2026-09-27

### Added

- A richer notification with Other side and Stop buttons.
- The first island: a black capsule round the camera rotating through routes, with dots and a draining border.

## [1] - 2026-09-27

### Added

- Four tasks: press Start and the next buses at the nearest stop appear in a notification for about ten minutes.
