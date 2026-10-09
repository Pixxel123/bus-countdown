# Settings, tasks and profiles

Part of the [Bus Countdown](../README.md) documentation: the settings screen, every `%Bus` variable, and what each task and profile does.

## The settings screen

Bus Settings opens a native Tasker screen (Scene V2), laid out like Android's own Settings (4.44). The main page has an entry for each part, saying what it's set to now ("Every 45 s, ends after 30 min"); tap one to open its page. The top bar shows the page's name, and its back arrow goes up a level. On the main page it saves and closes the screen. The pages, most used first:

- **Stops and routes.** Your stops, then other stops within 400 m. Tap the routes you want at each stop; a stop with a chosen route moves up under Your stops. Stops on both sides of a road share one entry showing one side at a time, with ⇄ to switch; each side says which way it goes. Stops you use get an arrival distance: 50, 100 or 200 m, or Custom (up to 200 m) (tap it, type the distance, then Use custom; tapping a preset hides the box again). Custom is always there, and filled only while a custom distance is in use, for example ✓ Custom 70 m. To take a saved stop off your list, tap Remove stop (Undo brings it back); it's removed when the screen closes, and isn't added back automatically as a stop across the road. Its routes stay if you use them at another stop.
- **Countdown.** How often times update, when a countdown stops by itself, how long each route shows, how far Start countdown looks for stops, and whether (and how far ahead) to show a stop you're heading towards.
- **Home and work Wi-Fi.** The two networks (with buttons to use the one you're on, or clear work), which of them shows your nearest stop's next buses when you leave it (work by default), and the heads-up window at work.
- **Island.** Island or status bar, the optional border, how much of the destination to show (3, 6 or 10 letters), and what the stop board shows and when it closes. **Position**, a page of its own one level down, has the gap for the camera, the distance from the top, and where the status bar chip starts. Preview closes the settings, shows the real island for 3 seconds and then its stop board for 4 (the status bar chip, which has no board, for 3), then reopens them. Reset measures the camera again.
- **Setup.** The TfL key, and permissions (one line when they're all on).

Choices save as soon as you tap them. Text, sliders, routes and distances save when the screen closes, with the back arrow on the main page or the back gesture. A message lists what changed.

## Settings

Most of these are on the settings screen. All of them can also be set in Tasker's Vars tab. Empty or invalid values are replaced with the default the next time Bus Start runs.

| Variable | Default | Description |
|---|---|---|
| `%TflKey` | (required) | TfL API key |
| `%BusRoutes` | set in Bus Settings | Your routes, comma-separated, e.g. `25,N25`: every route you've chosen at a stop |
| `%BusPlaces` | set in Bus Settings | Saved stops, one per line: `type\|id\|name\|lat\|lon\|radius` |
| `%BusNearRadius` | 50 | Arrival distance, in metres, for a stop without its own |
| `%BusHomeWifi` | set in Bus Settings | No checks on this network; connecting ends a countdown, leaving starts one |
| `%BusWorkWifi` | optional | The same, for work |
| `%BusApproach` | `both` | Show stops you're heading towards: `off`, `walk` (on foot only) or `both` (on foot and by bus) |
| `%BusApproachMin` | 3 | How many minutes ahead: 2, 3 or 5 |
| `%BusHomeAt`, `%BusWorkAt` | recorded | Where home and work are: a running average of positions seen while on their Wi-Fi |
| `%BusRecord` | `off` | Record trips: `on` writes every position, decision, TfL reply and buzz to a file in Download (see [Trip recorder](trip-recorder.md)) |
| `%BusLeaveShow` | `work` | Which Wi-Fi, when you leave it, shows the next buses from your nearest saved stop: `work`, `home`, `both` or `off`. Otherwise a countdown only starts when you reach a saved stop's arrival distance. |
| `%BusGlanceFrom`, `%BusGlanceTo` | 17:00, 18:00 | Heads-up at work: in this window, on work Wi-Fi, turning the screen on shows your stop's next buses for a minute. `off` turns it off. |
| `%BusRefresh` | 45 | Seconds between refreshes |
| `%BusTimeout` | 30 | Minutes before a countdown ends by itself (unless you're still waiting at the stop: then it carries on, up to 2 hours from the start) |
| `%BusRotate` | 6 | Seconds each route is shown |
| `%BusRadius` | 300 | Metres Bus Start looks for your saved stops |
| `%BusStyle` | `pill` | `pill` (round the camera) or `chip` (in the status bar). Both are drawn by Tasker the same way. |
| `%BusBorder` | `off` | `on` draws a border round the pill that drains until the next route or refresh |
| `%BusDestLetters` | 3 | How many letters of the destination the pill's left side has room for: 3, 6 or 10. The left side is sized to fit the stop letter, the widest route and that many letters. |
| `%BusBoardRoutes` | `all` | What the stop board (tap the pill) shows: `all` routes at the stop, or `mine` for yours only |
| `%BusBoardSecs` | 10 | Seconds before the stop board closes by itself: 10 or 30, or 0 to stay open until you tap it |
| `%BusChipX` | 76 | Where the status bar chip starts, in dp from the left edge |
| `%BusIslandGap` | set by Bus Find Camera | Space left over the camera, in dp |
| `%BusIslandY` | set by Bus Find Camera | Top of the pill in dp, so that it lines up with the camera |
| `%BusCameraX` | set by Bus Find Camera | Camera centre in dp from the left edge. The screen centre is used if not set. |
| `%BusScreenW` | set by Bus Find Camera | Screen width in dp |

### Internal variables

Variables starting with `BusState`, `BusCache` or `BusTemp` are managed by the project. Deleting any of them is safe; they are rebuilt when needed.

- `BusDebugLog`: the last 20 decisions, for Debugging (Bus Status).
- `BusStateTrip`, `BusStateWindow`: the trip's state and the last six positions (see [The trip, step by step](how-it-works.md#the-trip-step-by-step)).
- `BusStateBoard`: `1` while the stop board is open (Bus Island sets it; Bus End and a new countdown clear it). `BusStateBoardSelf`: `1` when the pill's page grew the board itself and keeps it the right size (4.43); `BusStateBoardRows`: how many lines a board drawn as a new window has.
- `BusStateIslandByStop`: the pill's data for the last 4 stops fetched, so a long press shows the stop it switches to at once (4.43), including the stop got ready for it (4.45).
- `BusStatePrefetch`: the live times of the stop a long press goes to, got ready after each refresh, so Bus Refresh can show them straight after a switch (4.45).
- `BusStateSnooze`: the stop you last swiped away, and when (kept apart from the trip so a check running at the same moment can't undo it).
- `BusStateSeen`: the buses TfL last listed at the current stop, so one it drops can be kept on its countdown. `BusStateBuzzed` and `BusStateBuzzAt`: which buses have buzzed at which stop, and when the last buzz was.
- `BusStateMatch`, `BusStateBoarded`, `BusStateCameOn`: the bus you're riding (while it's being worked out, and once known), the bus you last got on, and the bus you last came in on (see [Which bus you're on](how-it-works.md#which-bus-youre-on)).
- `BusStateKF`, `BusStateMode`: the travel mode on trial (4.34): the filter's state between positions, and the latest mode for Bus Status.
- `BusStateFetchAt`, `BusStateFetchStop`: when times last arrived, and for which stop (no second fetch within 20 s).
- `BusStateNextAt`: when the next bus is due (or your own bus reaches the stop), as a time, so Bus Loop can tell with the screen off when it's within 8 minutes.
- `BusStateLastBusAt`: when you were last moving at bus speed (for stops by home and work). `BusStateFarAt`: where you settled, while positions are slowed down far from your stops. `BusStateEndWhy`: why Bus Watch ended the countdown, for the recorder.
- `BusState…`: current state, such as whether a countdown is running, which stop is shown, the last Wi-Fi network seen and what Bus Watch last decided.
- `BusCache…`: every stop on your routes and their order along each route (refreshed daily, or when your routes change), and today's timetables for recently used stops.
- `BusTemp…`: values passed between steps of one task.

`BusPlacesSkip` lists stops you removed on the settings screen, or said no to when offered as a stop across the road, so you aren't offered them again.

## Tasks

| Task | Purpose |
|---|---|
| Bus | Menu: Start countdown (or End countdown while one is running), Settings, Status, Debugging. |
| Bus Settings | The settings screen. On first run it measures the camera before opening. After saving, it refreshes the route stop lists if your stops or routes changed, and offers the stop across the road for each stop you've added (a list with each stop's name, letter and direction: tick the ones to save). |
| Bus Settings Button | Run by the settings screen's buttons: saves choices as they're tapped, records route taps, stop distances and removed stops (in `BusTempTicks`, `BusTempDists` and `BusTempRemoved`) for when the screen closes, or opens the Android settings page for a missing permission. |
| Bus Find Camera | Reads the camera cutout's position and size from Android and sets the island's camera settings. Also run by Reset, which then moves the open screen's sliders to the new values. |
| Bus Start | Applies settings and starts Bus Loop for your saved stops only (using the position just pushed when a pushed check started it, otherwise fetching one), and asks Android to push a position every 20 m you move (to Bus Moved) for the countdown: up to four within `%BusRadius` that your routes call at, nearest first. When Bus Watch starts it because you've reached a saved stop, that stop is shown first; a long press moves on to the others. When started on leaving home or work, or for the heads-up at work, it looks up to 1 km away. Stops you haven't saved are never shown. |
| Bus Loop | Every `%BusRefresh` seconds (twice that while the next bus is more than 10 minutes away), with the screen on (or off, while a bus is within 8 minutes): runs Bus Refresh. Ends with Bus End after `%BusTimeout` minutes, or carries on while you're still waiting at the stop (2 hours at most). Safety net: if no position has been pushed for 2 minutes (10 if you were standing still, when Android rightly sends nothing), it asks Android for them again at the current rate and has Bus Watch check your location, so a countdown still ends when you leave; it also switches Bus Moved off and on in case it stopped listening. |
| Bus Refresh | Gets live arrivals and, after showing the pill, the timetable for any of your routes with no live time. Shows the pill the first time; after that the pill updates itself from `%BusStateIslandData`. Also run by the Bus Hide When Sideways profile: hides the pill while the phone is sideways, and shows it again with fresh times when it's upright. |
| Bus End | Ends the countdown, removes the pill or chip, and sets the pushed positions back to every 30 m. |
| Bus Watch | Every check runs here: a position pushed by Android (the Bus Moved profile), the screen coming on (Bus Wake), Bus Loop's safety net, or you running it by hand (to see what it found and why). Only where the position comes from differs. It applies the Wi-Fi rules, moves the trip on (idle, heading, at stop, on bus, left), starts or ends countdowns, and sets how often Android pushes positions next. |
| Bus Island | Everything the pill's gestures ask of Tasker apart from ending (that's Bus End): the tick when a swipe is far enough to dismiss, switching to the next nearby stop on a long press, and opening or closing the stop board. Since 4.43 the pill's page grows the board out of its own window and Bus Island only notes it (and has Bus Refresh fetch times that are due); without the Scene V2 bridge, it shows the pill again at the board's height, or back to its own. |
| Bus Wake | Once after each import (or when the Bus menu, Bus Settings or Bus Start ask), switches the three profiles off and on so imported ones start listening. Run by the Bus Screen On profile: makes sure positions are being pushed (they stop if the phone restarts) and notes which Wi-Fi network you're on; the heads-up at work if it's due; during a countdown, fresh times; and a Bus Watch check. |
| Bus Status | Shows the current state, the Wi-Fi network you're on, what Bus Watch last decided and why, and the main settings; and, however it's run (Status or Debugging in the Bus menu, or Tasker's run button), copies the full report, with the last 20 decisions, to the clipboard. Debugging (par1 `copy`) just says it's been copied. |

## Profiles

| Profile | Active | Runs |
|---|---|---|
| Bus Screen On | When the screen comes on | Bus Wake |
| Bus Moved | When Android pushes a position (Intent Received, `net.buscountdown.MOVED`) | Bus Watch |
| Bus Hide When Sideways | While Display Orientation is Landscape (runs on entering and leaving) | Bus Refresh |

Losing home or work Wi-Fi only counts as leaving once you're also 50 m from that place, or, with no position, once it has stayed gone for two checks, so a brief drop at your desk is ignored. Bus Watch applies the Wi-Fi rules itself rather than through profile conditions (the profile's only condition besides the time is Display State: On), because Tasker's "not connected to" condition stopped the profile firing at all. It skips the location check on home or work Wi-Fi and while the screen is off, and notices when you connect to or leave either network.
