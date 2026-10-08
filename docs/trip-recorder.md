# Trip recorder

Part of the [Bus Countdown](../README.md) documentation.

For tuning against real journeys. With **Record trips** on (Bus Settings › Countdown; off unless you turn it on), each day goes to a file in the Tasker-bus-trip-data folder in Downloads (`Download/Tasker-bus-trip-data` on the phone's storage): `bus-trip-Mon.jsonl` to `bus-trip-Sun.jsonl`, one per weekday, each started afresh when its day comes round again, so a week is kept. Every line is one JSON record:

A day only counts as started once its first line is really written; if that fails, the next line tries again, with the setup. Bus Status shows how many lines today's file has and when the last was written, as Tasker reads it, and the last write error if there was one (4.38). Each new file is announced to Android's media index, so the Files app lists it.

| Kind | What it holds |
|---|---|
| `setup` | First line of each day: your saved stops, routes, the route lists, home and work, and the settings that shape decisions, so the day can be replayed |
| `check` | Each position Bus Watch checked (pushed, screen on, safety net or by hand): where, accuracy, Android's speed and direction, how old, the speed the rules used (`v`), whether that looked like a bus, whether you'd settled, the position rate asked for, what it decided (trip state, action, why), and the travel mode on trial (`mode`: still, walk or ride; `mp`: how sure, per cent each; `kv`: the filtered speed over the last minute); and, when a poor fix (over 25 m) was averaged with the one before it, the fix itself as Android gave it (`rlat`, `rlon`) |
| `tfl` | Each TfL reply: every bus (route, vehicle, seconds away; `l` live, `s` timetable, `k` kept after TfL dropped it), your bus if known (`you`), how long the refresh took, and since 4.41 the stop's other routes (`o`: route, vehicle, seconds away, destination) |
| `start`, `nostart`, `end` | Countdowns starting (which stop, why, battery level) and ending (`from`: island, menu, timeout, wifi or watch, with `why` in words, and the battery level) |
| `match`, `board` | Your bus worked out while riding (route, vehicle, how: from your arrival time, with how many seconds out, or as the bus you got on; `sure` when it's the bus you got on), and the bus you got on at a stop (with how many seconds TfL still had it away when you left) |
| `wifi` | Each change of Wi-Fi network, as `home`, `work`, `other` or `none` (never the network's name) |
| `buzz` | Each buzz: route, vehicle, minutes away, first or second |

The files hold your location history and stay on the phone until you choose to upload them. To see how today's rules would handle a recorded day:

```
npm run replay -- bus-trip-Tue.jsonl
```

It plays every position through Bus Watch, and every TfL reply through Bus Refresh (showing when it would buzz), and marks each position where the current rules decide differently from what happened on the phone (`≠`), which is how a change can be checked against real trips before it reaches the phone. Each position is played as Android gave it: a poor fix the phone averaged with the one before is taken from `rlat` and `rlon`, or, in recordings from before 4.37, the averaging is undone, so it isn't averaged twice (which smoothed away the jumps that misled the phone on Wednesday evening). Countdowns you started by hand, or that ended for another reason (Wi-Fi, time's up), are played as they happened. In recordings from before 4.27, where endings carry no reason, an ending written up to 2 s after a position that stopped the countdown on the phone is taken as Bus Watch's own and left to today's rules. The replay itself is `build/replay-core.js`, which the tests use too.
