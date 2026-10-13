# Changelog

Changes to Bus Countdown, newest first, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Each build that went onto the phone gets the next version number. There was no 4.1 to 4.4, and 4.12 to 4.25, built from 3 to 6 October 2026, are all dated the 6th.

Each release's project file is on its [GitHub release](../../releases).

## [4.61] - 2026-10-13

### Changed

- While you ride, TfL is asked about your bus at the end of each check, for the next one to use. Checks no longer wait for the answer (about a second, up to 5 s on a poor signal) before deciding anything. When it's TfL that shows you've got off, that's seen one check later.
- Bus Watch writes what a check recorded once, after the check. Its three early exits skip to that write instead of stopping, so a Wi-Fi line is never left unwritten. It's 100 steps, down from 116.
- Everything that places you on a route shares one reading of the route lists and one set of sums (`scripts/shared/routeLines.js`) instead of four copies. Replays of every recording since 6 October come out the same as in 4.60.

### Added

- The trip recorder notes how long each check took to reach a decision (`ms`) and how long TfL took to answer about your bus (`took`).

## [4.60] - 2026-10-13

### Fixed

- Walking straight to a stop shows it, even inside its circle. Heading for a stop on foot was only seen outside every circle, so a stop with a big circle waited until you slowed down there. Inside a circle, getting nearer at 60% of your pace or more over 45 seconds, and arriving within the minutes-ahead setting, now counts as heading for it. A stop by home or work only shows this way while you're not getting nearer to home or work. In replays, a stop with a 200 m circle showed 1.5 to 2.5 minutes sooner, and on one morning it showed where before it hadn't at all.

## [4.59] - 2026-10-12

### Added

- Moving along your route keeps you on the bus when TfL has nothing on it (no live data for the route, or a bus Bus Watch didn't see you get on). A slow spell doesn't end the ride while every recent position is within 40 m of one of your routes and moving forward along it at 1.4 m/s or more, or 2.2 m/s once you've been off bus speed for 2 minutes. Replayed without TfL, the recordings since 8 October keep you on the bus for 137 of the 222 minutes ridden, up from 75. Getting off early and walking on still ends a countdown 2 minutes later, and TfL's word on your bus still comes first. Recorded as `rt`.

## [4.58] - 2026-10-12

### Added

- Following your bus. While you ride a bus Bus Watch saw you get on, TfL is asked which stops it calls at next (`/Vehicle/{id}/Arrivals`, every 45 s, or 20 s while you're moving slowly). If you're still between its last stop and its next one, a slow spell is traffic and the ride carries on. Replayed, it keeps you on the bus for 142 of 148 minutes, up from about half. Without TfL it works as 4.57 did. A failed request waits 90 s, then 180, then 300 at most, and Bus Watch never waits more than 5 s for an answer. Bus Status shows the last answer, and the trip recorder logs it as `follow`.

### Changed

- Each day's trip recording has its own dated file (`bus-trip-2026-10-12-Mon.jsonl`), kept until you delete it. Before, each weekday's file was started afresh a week later.

### Fixed

- When TfL stops answering, every route falls back to its timetable. Each stop's timetable is fetched for all your routes on your first visit of the day, not only the ones with no live time then. A failed timetable request is tried again after 5 minutes instead of being read as no buses today, and Bus Status lists the routes still waiting for one.
- A failed request for live times is recorded with the reason Tasker or TfL gave (`err`).
- A countdown cut off by Tasker stopping starts again if you're still at the stop or heading for it, instead of counting as you having left. It starts again once per stop in 15 minutes.
- Opening Settings during a countdown no longer restarts Tasker. Settings takes the island down first, nothing draws it while Settings is open, and a refresh brings it back afterwards. Settings lists the nearest 6 stops instead of 10, making its layout up to 75 KB smaller.
- No countdown starts for a stop whose buses all go back the way your bus came, as you pass it or within 2 minutes of getting off. A stop with a route going your way, or turning off, still shows, and so does one you cross the road to later.

## [4.57] - 2026-10-11

### Changed

- The island shrinks at the next refresh with 8 dp or more to spare, instead of after two in a row. It still grows straight away. That's about 50 resizes on a busy day, up from 25 to 29.

### Fixed

- A bus turning due between refreshes keeps the next one's time. "1 · 15 min" becoming "Due · 14 min" no longer fitted, so the second time was dropped and "Due" sat alone in a gap. The island now grows to fit. If its window can't resize itself, it drops the second time as before.

## [4.56] - 2026-10-09

### Changed

- Holding the island switches sides as soon as the hold is long enough. The island's page already has the other stop's times, so it shows them itself and then tells Tasker. Before, it dimmed for a quarter to half a second while Tasker caught up.
- The new side shows its route, destination and times at once, sliding in as a route does when you swipe. 4.48 showed the stop's name first for 0.6 s. A switch took 1.6 s and now takes 0.45 s. The name still fills the island while a stop's times are on their way.

## [4.55] - 2026-10-09

### Fixed

- The screen coming on at home or work no longer waits for a location fix once Bus Watch knows where that place is. The fix took up to 7 s, and Tasker ran nothing else in the meantime. Positions Android sends still refine the place, and running Bus Watch by hand still checks.

## [4.54] - 2026-10-09

### Fixed

- Adjust live no longer stays over the lock screen. It closes as the screen comes on, as Cancel would, and a countdown's island comes back.

## [4.53] - 2026-10-09

### Fixed

- Adjust live's Cancel and Done buttons are no longer cut off. The panel is 380 dp tall instead of 300 and scrolls if it needs to. The line under its title is gone.

## [4.52] - 2026-10-09

### Added

- Settings › Island › Position › Adjust live shows the island where it goes, with sliders for the camera gap and the top offset (the left and top offsets for the status bar chip). It moves as you slide. Done saves and returns to the Position page, and Cancel leaves the position as it was. A countdown's island is hidden while it's open.

### Removed

- Preview, which Adjust live replaces.

## [4.51] - 2026-10-09

### Fixed

- Less flashing as the stop board appears in Settings' preview. The board is built while the island shows and appears on top of it before the island goes. About 0.2 s of flash is left while the board's new window draws.

## [4.50] - 2026-10-09

### Fixed

- The island's text no longer grows and moves right when the island widens. The web view zoomed the page as the window widened, making the text about 9% bigger and cutting times short. The zoom is pinned at 100%, and the island is drawn again if it zooms anyway.
- 4.48's sizing for Android's font size is taken out. The island's text is never drawn at Android's font size, and the cut-short times it was meant to fix were caused by this zoom.

## [4.49] - 2026-10-09

### Added

- Settings › Island: the buzz when a bus is under 5 minutes away can be turned off. The Island entry says "no buzz" while it's off.

## [4.48] - 2026-10-09

### Fixed

- The island is sized for Android's font size. Its widths were measured at 100% but its text was drawn at Android's size (115% on the phone), so times could be cut short. The page measures what it drew and draws the island again once if the size differs.
- In Settings' preview, the stop board no longer flashes as it appears. The preview's island is drawn at the board's width so their ends line up.

### Changed

- Switching sides shows the new times as soon as the island changes, with the stop's name on the left for 0.6 s. Before, the name filled the island for 1.2 s first.
- A long press is 450 ms instead of 550. It isn't Android's 400, because a tap on the island can last half a second.

## [4.47] - 2026-10-09

### Changed

- The stop board widens a little when its lines need it: for three times on a route ("12 · 24 · 37 min") or a route badge wider than the island's. It grows outwards from the camera gap and stops 8 dp from the screen's edges. Closing it goes back to the island's own width.

## [4.46] - 2026-10-09

### Changed

- The island fits its times instead of always keeping room for "88 · 88 min". It grows as soon as the times need more room, so nothing is cut short, and shrinks only after two refreshes in a row with 8 dp or more to spare, with the screen on and the stop board closed. It resizes its own window, so the camera gap stays put and only its right end moves. If the window doesn't change, the island is drawn again at the new width.
- The route dots always have 10 dp between them and the times.

## [4.45] - 2026-10-09

### Changed

- Switching sides shows the other stop's times at once. After each refresh, while a countdown runs with the screen on, Bus Refresh gets the other stop's live times (unless they're under 40 s old) and, once a day, its timetable. A long press shows them straight away instead of waiting 1 to 2 s for TfL.

## [4.44] - 2026-10-09

### Changed

- Settings is laid out like Android's own. The main page lists each part (Stops and routes, Countdown, Home and work, Island, Setup) with what it's set to, and a tap opens it. The back arrow goes up a level, and on the main page it saves and closes. Where the island sits has its own page under Island.

## [4.43] - 2026-10-08

### Added

- The stop board grows out of the island and tucks back into it. A tap grows the island's own window down into the board over 0.4 s, and closing tucks it back up in a quarter of a second. No new window is drawn for it, and a route coming or going while it's open resizes it.
- A swipe moves the island with your finger, and it fades as it nears the point where letting go dismisses it. Let go there and it's gone at once. Short of it, it slides back.

### Changed

- Opening the stop board never waits for TfL. It opens with the times it has and fetches new ones afterwards if they're 20 s old or more. Closing never fetches. Opening takes about half a second, down from 1 to 3.4 s.
- With several of your routes at the stop, a quick flick only changes route, and dismissing takes a 130 dp drag. With one route it's 90 dp, or a 60 dp flick, as before.
- A long press shows the new stop at once, with its times if they were fetched in the last 3 minutes, and gets its live times first: 1 to 2 s instead of 4 to 5. The timetable is fetched afterwards, only for routes TfL has no live time for.
- The island answers every touch straight away, dimming its text while Tasker works on a tap or long press.
- Swiping the island away removes it first and stops any refresh under way, so it can't come back.
- The island fades in only when it first appears.
- Fewer scripts run each time the island is drawn (each costs about 0.3 s on the phone).
- The trip recorder's lines are written by Tasker steps after each script instead of from inside it.

### Fixed

- A long press while a refresh was writing to the trip recorder hung both for 45 seconds, and the stop never switched.
- A swipe could be left half-way out, with the countdown never ending, when Android didn't say the finger had lifted. Losing the touch now counts as letting go, and a finger that neither moves nor lifts for 2 seconds is let go without acting on it.

## [4.42] - 2026-10-08

### Added

- The stop board. Tap the island and it grows down into a board of every bus at the stop, up to 8 lines: your routes first in Settings order, then the stop's other routes, soonest first. Routes sit left of the camera gap and times right of it ("2 · 8 · 19 min"). The first line is the stop and how old its times are. Tap again or swipe up to close it. It closes by itself after 10 seconds unless your finger is on it. A long press still switches stop, and the board stays open.
- Settings for what the stop board shows (all routes, or yours only) and when it closes (after 10 or 30 seconds, or only when tapped). Preview shows the island for 3 seconds, then its stop board for 4.

### Changed

- Bus Refresh keeps a third time for each of your routes, for the board.
- Opening or closing the board shows the island again, the new one on top before the old one goes. It only fetches times if the last were fetched 20 seconds or more ago.

### Fixed

- Drawing the island again at a new size removes the old one.

## [4.41] - 2026-10-08

### Added

- Bus Refresh keeps the next three times for up to 8 other routes at the stop, ready for the stop board. Nothing on the island changes yet.
- The trip recorder records those routes with each TfL reply (`o`).

## [4.40] - 2026-10-08

### Fixed

- Getting on a bus is seen however the countdown ended. Once you've left a stop, being 150 m or more along a route that calls there, faster than walking on average, means you got on a bus there, and Bus Watch works out which one. Before, a countdown that ended by itself just before the bus came left the ride without a known bus.
- The stop by home or work stays quiet for 15 minutes after you get off a bus, up from 5.

## [4.39] - 2026-10-08

### Fixed

- The bus you got on can no longer be one TfL had already dropped while you were still at the stop.
- A bus held at a stop on the way no longer ends the ride. If the trip ended as "went past" or "no longer coming up soon" and you then keep up bus pace, you're still on the same bus.
- A tram or bus standing still short of the stop no longer ends its countdown. "No longer coming up soon" now takes 2 minutes at walking pace, and standing still doesn't count.

## [4.38] - 2026-10-08

### Fixed

- A train standing near your bus route no longer makes the bus stop there look like one you're riding to. Heading for a stop by bus now needs a fix good to 50 m.
- The trip recorder only counts a day as started once its first line is written. If that write fails, the next line starts the file again. Each new file is announced to Android's media index, so the Files app lists it.

### Changed

- Bus Status shows how many lines today's recording has and when the last was written, or that it's missing and the last write error.
- Bus Status's "Last got on" says "(off it now)" once you're off that bus.

## [4.37] - 2026-10-07

### Added

- The trip recorder also writes the fix as Android gave it (`rlat`, `rlon`) when a poor one was averaged with the one before.

### Fixed

- Replays play each fix as Android gave it, instead of averaging already averaged positions again. They now decide exactly as the phone did.

## [4.36] - 2026-10-07

### Fixed

- Walking briskly away from a stop no longer reads as passing it on a bus. A speed from two positions only counts as bus speed if it's still faster than walking once both fixes' error is allowed for, and if you were walking towards the stop it takes two fast readings in a row.

## [4.35] - 2026-10-07

### Fixed

- The 20-second skip for a second fetch (new in 4.34) never ran, because scripts can't read `%caller1`. Bus Refresh now copies it into `%busrefby` first.
- A boarding worked out from a "probably" bus is saved as not sure, so a wrong guess can't take a bus off the island.
- The bus you got on is forgotten once the trip is over and you've been off bus speed for 5 minutes.
- Replays: in recordings from before 4.27, an ending with no reason counts as Bus Watch's own only up to 2 s after a position that stopped the countdown.
- The travel mode on trial starts again if its saved state is the wrong shape, and Bus Status copes with a missing reading.

### Changed

- The mockup's timeline lists only the versions that changed how the island looks.

## [4.34] - 2026-10-07

### Changed

- Only a bus you were seen getting on at a stop counts as yours. A bus matched on your arrival time alone is "probably" yours: it stays on the island and nothing buzzes while you ride. Arriving by tram, 4.33 had hidden the bus you were about to catch.
- A crawl in traffic that read as "left" no longer makes Bus Watch forget your bus while you're still at bus speed.

### Added

- Bus Loop and the screen coming on no longer both fetch times for the same stop within 20 seconds. Switching stop, a Settings preview or a run by hand always fetch.
- Travel mode on trial: a Kalman filter and a hidden Markov model work out still, walking or riding at every position. It's recorded and shown in Bus Status, but nothing uses it yet.

## [4.33] - 2026-10-07

### Changed

- Trip recordings go to their own folder, `Download/Tasker-bus-trip-data`, created when Record trips is on.

## [4.32] - 2026-10-07

### Fixed

- Times are still fetched with the screen off once the next bus is within 8 minutes, instead of keeping the minutes from the last fetch.
- Your bus is forgotten when a countdown ends mid-ride.
- Walking the last bit to a stop no longer counts as riding.

## [4.31] - 2026-10-07

### Changed

- While you ride, later buses on your own route keep their place and time but get a grey badge, so none of them looks like yours.

## [4.30] - 2026-10-07

### Changed

- While you ride, your own bus leaves the island, so it shows only the buses you could change to. Bus Status says which bus you're on.

## [4.29] - 2026-10-07

### Changed

- Your bus keeps its You label but loses the light blue, so it's the same grey as any destination.

## [4.28] - 2026-10-07

### Added

- Works out which bus you're on. It shows as You (or Your bus, with 6 or 10 letters of destination) in light blue and never buzzes, and Bus Status names your connection.

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

- The island is narrower again, with room for "88 · 88 min" and the second time left out when it wouldn't fit.

## [4.15] - 2026-10-06

### Changed

- The island is sized once per stop, for all your routes there, so a route dropping out of TfL's list never resizes it.

## [4.14] - 2026-10-06

### Fixed

- No more flashing: new times are drawn in place, and a new size is shown before the old island goes. It kept room for "~88 · ~88 min", which made it too wide until 4.16.

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

- A Debugging report in Bus Status.

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
- The island gets the TfL-style stop-letter ring, a few letters of destination, minutes in a fixed place and faded old times, and hides when the phone turns sideways.

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

- A fuller notification with Other side and Stop buttons.
- The first island: a black capsule round the camera rotating through routes, with dots and a draining border.

## [1] - 2026-09-27

### Added

- Four tasks: press Start and the next buses at the nearest stop appear in a notification for about ten minutes.
