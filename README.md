# Bus Countdown

[Download the latest release](../../releases/latest) · [Changelog](CHANGELOG.md) · [MIT licence](LICENSE)

A Tasker project for Android that shows live London bus arrivals in a small pill around the front camera, in the style of a "dynamic island". It starts when you arrive at a saved bus stop and ends when you leave.

Data comes from the [TfL Unified API](https://api-portal.tfl.gov.uk/). Built and tested on a Pixel 8 Pro.

![The pill around the camera: stop letter, route and destination on the left, minutes on the right](docs/pill.png)

## Quick start

1. Get a free TfL API key from <https://api-portal.tfl.gov.uk/>.
2. Download `Bus_Countdown_V<version>.prj.xml` from the [latest release](../../releases/latest).
3. In [Tasker](https://tasker.joaoapps.com/), long-press the project bar at the bottom, choose Import Project, and pick the file.
4. Run the **Bus Settings** task: paste your key under Setup, set your home and work Wi-Fi, and tap the routes you use at the stops near you.
5. Walk to one of those stops. The pill appears when you slow down there.

[Installation](#installation) has the details, and [Requirements](#requirements) lists the permissions Tasker needs.

## Features

- Live arrivals for your routes at the nearest stop, in a pill around the camera hole, or as a small chip in the status bar.
- Several routes at a stop take turns, and you can swipe between them.
- Tap the pill for the stop board: every bus at the stop, your routes first, then the others by whichever comes soonest, with the camera gap running down the middle.
- Falls back to the published timetable when TfL has no live prediction for a route (it only predicts about 30 minutes ahead) or can't be reached.
- Starts by itself at a saved stop and ends when you walk away.
- Leaving work: once your phone drops off the office Wi-Fi and you start moving, it shows the next buses from your nearest saved stop, so you can see them on the way. (Home, both or neither, in Settings.)
- Heading to a stop: walking towards a saved stop, or on a bus coming up to one, shows its next buses a few minutes before you get there, so you can decide in time (for example, whether to get off at the stop before).
- The right side of the road: where a stop has a partner across the road, the side heading your way comes first. On a weekday morning coming from home, that's the side towards work; coming from work, the side towards home. Weekends and other trips show the nearer side. The other side is always a long press away.
- At work, in an evening window, turning your screen on shows your stop's next buses for a minute.
- Hides while the phone is sideways, for full-screen videos and games.
- A settings screen for everything, including picking your routes at each stop.
- No plugins.

## Requirements

- Android 10 or later.
- [Tasker](https://tasker.joaoapps.com/). The project was exported from Tasker 6.7.6.
- A free TfL API key from <https://api-portal.tfl.gov.uk/>.
- Tasker permissions (the settings screen checks them and opens the right Android page for any that are missing):
  - Location: Allow all the time, with Use precise location on.
  - Display over other apps.
  - Tasker's accessibility service on (needed to draw over the status bar).
  - Battery: Unrestricted.

## Installation

1. Download `Bus_Countdown_V<version>.prj.xml` from the [latest release](../../releases/latest) (or `Bus_Countdown.prj.xml` from this repository, which is the same build of the newest code).
2. In Tasker, long-press the project bar at the bottom, choose Import Project, and pick the file.
3. Run the **Bus Settings** task.

The first time, Bus Settings measures the camera cutout before opening. Enter your TfL key under Setup, set your home and work Wi-Fi, then under Stops and routes tap the routes you want at the stops you use. Stops within 400 m of you are listed with their routes. Go back to the main page and tap its back arrow to save and close. For each stop you've added, it then asks whether to save the stop across the road too, showing its name, letter and direction.

For day-to-day use, add the **Bus** task as a home screen shortcut or Quick Settings tile. It opens a menu: Start countdown (or End countdown while one is running), Settings, Status and Debugging.

After importing a new version you don't need to switch anything on by hand. Imported profiles only start listening once they've been switched off and on, and Bus Wake does that the first time you turn the screen on, open the Bus menu or open Settings.

## Using it

The pill appears by itself when you reach a saved stop and slow down or stop there, even with the phone in your pocket (it's showing when you look). Walking straight past a saved stop doesn't start it: Android's speed reading shows you're still walking. It also appears:

- when you're heading towards a saved stop and due there within 3 minutes, on foot or by bus (Settings: Heading to a stop, Minutes ahead);
- after you leave work Wi-Fi, for your nearest saved stop (home too, or neither, if you choose in Settings);
- at work, between 17:00 and 18:00 by default, for a minute each time you turn your screen on (it carries on as a normal countdown if you've left the Wi-Fi by then);
- whenever you choose Start countdown from the Bus menu, for your nearest saved stop.

| Gesture | Action |
|---|---|
| Short swipe left or right (24 dp or more, short of a dismiss) | Next or previous route |
| Long swipe left or right: 90 dp, or a quick 60 dp fling; with several of your routes at the stop, 130 dp however fast | Dismiss (the whole pill follows your finger and fades as it nears the dismissal point) |
| Long press (0.45 s) | Switch to the next nearby stop, usually the one across the road. It changes as soon as the hold is long enough, with its times already there |
| Tap | Open the stop board: the pill grows down into it, with every bus at the stop, by route. Tap again or swipe up to close it; it closes by itself after 10 s |

The first time the pill appears, a message explains the gestures. The phone gives a short tick when a swipe is long enough to dismiss, and vibrates when the pill is dismissed or a long press switches stop.

A countdown ends when you dismiss it, after `%BusTimeout` minutes (30 by default), on your home or work Wi-Fi, when you walk away from the stop, or once you're on the bus. [When a countdown ends](docs/how-it-works.md#when-a-countdown-ends) has the exact distances and speeds.

After you dismiss a countdown, it won't start again by itself until you've moved away from all your saved stops, or for 30 minutes, whichever comes first. Start countdown from the Bus menu ignores this.

## Reading the pill

![The status bar chip: stop letter, route and minutes](docs/chip.png)

- The ring on the left is the stop's letter, as on TfL's stop flags (one or two letters, such as B or BK). Stops without a letter, where TfL gives something like "opp" or an arrow instead, show no ring.
- When a bus is less than 5 minutes away, the phone gives three 200 ms buzzes (each one noted in the Debugging log), on two refreshes in a row (about 45 seconds apart), and then stays quiet for that bus. One bus at a time: only the soonest bus at the stop, whatever its route, can buzz, and the next only gets its turn once that one has gone, so two routes arriving together give one set of buzzes. It works with the screen off, because times are still fetched while a bus is within 8 minutes. Settings › Island turns it off.
- Each route shows its next bus and the one after, quieter: "5 · 12 min". With only one bus coming, just the one time. (TfL sometimes lists the same bus twice; a time within a minute of the first counts as the same bus.)
- Minutes in white are live. `~12 min` in grey is from the timetable, used when TfL has no live prediction.
- `Due` means under a minute. `Cancelled` replaces the minutes for a cancelled service.
- Minutes turn faint when the times are more than two refreshes old, for example with no signal.
- Dots, at the right-hand end, show how many routes there are and which one is showing. The minutes always start in the same place, just past the camera, so they don't shift as routes take turns.
- Shown as a status bar chip, the pill has just the stop letter, the route and the minutes (separated by a thin line), to the right of the clock.
- An optional border (off by default) drains until the next route or refresh.

## Privacy

Everything stays on the phone. There are no accounts, analytics or servers of this project's own, and the only network requests go to TfL's API.

- **What it reads:** your position (pushed by Android as you move, and fetched when a check needs one), the name of the Wi-Fi network you're on, and whether the screen is on.
- **What it keeps:** Tasker global variables on the phone hold your saved stops and routes, your TfL key (`%TflKey`), your home and work Wi-Fi names, where Bus Watch has learned home and work are (`%BusHomeAt`, `%BusWorkAt`), and the current trip, including your last six positions (see [Settings](docs/configuration.md#settings)).
- **What TfL sees:** each request carries your API key, and TfL sees the phone's IP address as with any website. Live arrivals, timetables and route lists ask about a stop or a route, never where you are. The one exception is the settings screen's list of stops near you, which sends your position to TfL's stop search (`/StopPoint?lat&lon`) each time Settings opens.
- **Trip recordings:** off unless you turn on Record trips. They hold every position checked during the day, with times, and every TfL reply, in `Download/Tasker-bus-trip-data`. Other apps that can read your Downloads folder can read them too. A week is kept, each weekday's file started afresh when that day comes round.
- **Reports:** Bus Status copies its report to the clipboard, and the Debugging report includes your recent positions, so check either before pasting it anywhere public.
- **Sharing your setup:** your key and Wi-Fi names live in Tasker variables, not in the project file, but a Tasker backup includes them. Leave `%TflKey` out of anything you share.

## Documentation

- [How it works](docs/how-it-works.md): the trip states, which bus you're on, battery use, the TfL requests and known limitations, with diagrams.
- [Settings, tasks and profiles](docs/configuration.md): every setting and `%Bus` variable, and what each task and profile does.
- [Trip recorder](docs/trip-recorder.md): recording real journeys and replaying them through the rules.
- [Roadmap](docs/roadmap.md): what might come next.
- [Changelog](CHANGELOG.md): what changed in each version.
- [Contributing](CONTRIBUTING.md): building, testing and releasing.

## Development

The project is built from the scripts in `scripts/` and the task definitions in `build/assemble.py`, and tested without a phone (Node.js 18 or later, Python 3):

```
npm install
npm run build
npm test
```

[CONTRIBUTING.md](CONTRIBUTING.md) explains the build, the tests and how releases are made.

## Credits and licence

Powered by TfL Open Data. Contains OS data © Crown copyright and database rights 2016, and Geomni UK Map data © and database rights [2019]. Bus Countdown is an independent project, not affiliated with or endorsed by Transport for London.

Released under the [MIT licence](LICENSE).
