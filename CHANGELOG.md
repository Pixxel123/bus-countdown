# Changelog

All notable changes to Bus Countdown are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers count up by one for each build that went onto the phone (there was no 4.1 to 4.4: the numbering went from 4 straight to 4.5). Versions 4.12 to 4.25 were built between 3 and 6 October 2026 and are listed under the last of those days.

Each release's project file is attached to its [GitHub release](../../releases). Stop names and routes in these notes are the stand-ins used throughout the repository.

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
