# Roadmap

Part of the [Bus Countdown](../README.md) documentation. What might come next, roughly in order.

## Once real trips have shown what TfL's data looks like

- **Following your bus between stops.** 4.28 works out your bus while a countdown shows the stop ahead, and the bus you got on. With an extra TfL request for that vehicle (`/Vehicle/{id}/Arrivals`) while you ride with no countdown, it could also tell a bus crawling in traffic from you having got off, and show "get off here and change?" for any stop on the way.
- **Steadier times.** Predictions jump (5, then 7, then 4 minutes). Following each vehicle across refreshes and smoothing its prediction would make the island count down steadily. (4.27 does the first part: a bus TfL drops while still 2 minutes or more away is kept on its countdown for up to 3 minutes.)

## Later

- Learning from trips: record boarding (at stop to on bus) and getting off (on bus to walking), keep the last 100 trips, and use patterns by stop, day and time for which side comes first, your usual route first and leaving work. To discuss for the next version: holding each pattern as a count that decays exponentially (for example halving every two weeks) instead of a fixed six-week window, and treating time of day as circular (23:50 is close to 00:10).
- A spatial grid for stop lookups, if the number of saved stops grows a lot.
- **Travel mode, on trial since 4.34.** A Kalman filter and a hidden Markov model (`scripts/shared/travelMode.js`) work out still, walking or riding at every position. It's recorded with each position and shown in Bus Status, but nothing decides on it yet: after about two weeks of Record trips on days it wasn't tuned on, compare it with what you actually did (`npm run replay` shows it per position), and if it holds up, let it tell Bus Watch you're riding between stops. Calibrating TfL's times per route and a leave-now buzz wait for three to four weeks of recordings.
- **Probabilistic trip states.** Instead of fixed thresholds (0.8 m/s, 15 km/h, a 0.4 m/s trend), a hidden Markov model would weigh how likely each state is given the last few positions and pick the most likely sequence, which should cope better with borderline cases (shuffling at a stop, slow traffic, walking along the bus route). Worth it once Debugging reports and the tests give real trips to tune against.
- **A Kalman filter** for position and velocity together, in place of the averaging and median speed: smoother, and able to predict where you'll be in 30 seconds. Only if the current window turns out not to be enough.

- Trains. Saved places already carry a type (`bus|…`), and the pill reads a common departure format with `live`, `sched`, `late` and `cancel` states, so a National Rail source can be added without changing the display.
