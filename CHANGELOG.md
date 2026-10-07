# Changelog

All notable changes to Bus Countdown are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers count up by one for each build that went onto the phone (there was no 4.1 to 4.4: the numbering went from 4 straight to 4.5). Versions 4.12 to 4.25 were built between 3 and 6 October 2026 and are listed under the last of those days.

Each release's project file is attached to its [GitHub release](../../releases). Stop names and routes in these notes are the stand-ins used throughout the repository.

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
