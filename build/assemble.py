# Bus Countdown V4 assembler: builds the Tasker project from the scripts in js/ and action
# formats copied from the author's own export (so they match their version of Tasker).
import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'helpers.py')).read())
# JS (from helpers.py) reads a script from scripts/ and fills in its shared pieces
def js(file, label): return deco(set_str(T['JS'], 0, JS(file)), label)

def cache_refresh():
    # The same steps in Bus Start and Bus Settings: refresh the route stops cache if it's stale
    return [
        js('cache_check.js', 'Route stops cache up to date? (once a day, or when routes change)'),
        if_('%busfetch', 2, 'yes', 'Out of date: fetch it'),
          deco(set_str(T['FOR'], 1, '1:%busroutecount'), 'For each of my routes'),
            js('cache_route.js', 'Which route'),
            http('https://api.tfl.gov.uk/Line/%busroute/StopPoints?app_key=%TflKey', 'Ask TfL for every stop on it'),
            js('cache_merge.js', 'Add its stops'),
            http('https://api.tfl.gov.uk/Line/%busroute/Route/Sequence/outbound?app_key=%TflKey', 'Ask TfL for its stops in order, one way'),
            js('cache_seq.js', 'Keep that order'),
            http('https://api.tfl.gov.uk/Line/%busroute/Route/Sequence/inbound?app_key=%TflKey', 'And the other way'),
            js('cache_seq.js', 'Keep that order too'),
          T['ENDFOR'],
        endif(),
        js('cache_commit.js', 'Keep what was fetched'),
    ]

def fresh_location():
    # Normal location first (quick, works indoors via Wi-Fi); only if that's stale, force GPS
    return [
        deco(T['GETLOC'], 'Get my location', cont=True),
        js('loc_age.js', 'Is it recent? (Android sometimes hands back an old one)'),
        deco(set_int(T['GETLOC'], 9, 1), 'Too old: try again with GPS', ('%busstale', 2, 'yes'), cont=True),
    ]

def java(ret, obj, func, param, label, cond=None):
    # Java Function (664): ret without % keeps a Java object; with % it's saved as text.
    # param may be one value or a list (up to 7).
    params = param if isinstance(param, list) else ([param] if param != '' else [])
    args = ''.join((f'<Str sr="arg{3+i}" ve="3">{e(params[i] if i < len(params) else "")}</Str>' if i < len(params) and params[i] != '' else f'<Str sr="arg{3+i}" ve="3"/>') for i in range(7))
    x = ('<Action sr="act0" ve="7"><code>664</code>'
         f'<Str sr="arg0" ve="3">{e(ret)}</Str><Str sr="arg1" ve="3">{e(obj)}</Str><Str sr="arg2" ve="3">{e(func)}</Str>'
         + args + '</Action>')
    return deco(x, label, cond, cont=True)

def find_camera():
    # Ask Android where the display cutout (camera hole) is, and how dense the screen is.
    # Route 1: the screen's own cutout. Route 2: the cutout in the current window's insets.
    # Return types are given as {Object}, so Tasker doesn't have to look up the class name.
    return [
        java('dispman', 'CONTEXT', 'getSystemService {Object} (String)', 'display', 'Find the camera: display service'),
        java('disp', 'dispman', 'getDisplay {Display} (int)', '0', 'Main screen'),
        java('cut', 'disp', 'getCutout {Object} ()', '', 'Route 1: its cutout (the camera hole)'),
        js('camera_err.js', 'Keep any error message from that step'),
        java('%busrects', 'cut', 'getBoundingRects {List} ()', '', "The cutout's rectangle, as text"),
        java('winman', 'CONTEXT', 'getSystemService {Object} (String)', 'window', 'Route 2: window service'),
        java('wmetrics', 'winman', 'getCurrentWindowMetrics {Object} ()', '', 'Current window size'),
        java('insets', 'wmetrics', 'getWindowInsets {Object} ()', '', 'Its insets'),
        java('cut2', 'insets', 'getDisplayCutout {Object} ()', '', 'The cutout in them'),
        java('%busrects2', 'cut2', 'getBoundingRects {List} ()', '', "Its rectangle, as text"),
        java('res', 'CONTEXT', 'getResources {Resources} ()', '', 'Screen resources'),
        java('%busmetrics', 'res', 'getDisplayMetrics {DisplayMetrics} ()', '', 'Screen size and density, as text'),
        js('find_camera.js', 'Turn that into island settings'),
        flash('%busfound', 'Say what it found'),
    ]

def show_settings():
    # Full screen, and wait until it's closed (FullscreenWithResult); screen variables come back as locals
    x = set_str(T['SHOW'], 1, '%buslayout')
    x = set_str(set_str(x, 2, 'bussettings'), 3, 'FullscreenWithResult')
    for i in (4, 5, 6, 7, 9, 10): x = set_str(x, i, '')
    x = set_int(set_int(x, 12, 0), 13, 0)
    x = set_str(x, 11, '600000')      # closes itself after 10 minutes, so this task can't wait for ever
    return deco(x, 'Show the settings screen (waits until it is closed; closes itself after 10 minutes)', cont=True)

def show_preview():
    x = set_str(set_str(T['SHOW'], 1, '%buslayout'), 2, 'buspreview')
    x = set_str(set_str(set_str(set_str(x, 4, '%busx'), 5, '%busy'), 6, '%busww'), 7, '%bush')
    x = set_str(x, 11, '6000')
    return deco(x, 'Show it for 6 seconds', cont=True)

def update_slider(element, value, label):
    # Update Scene v2 (481): change one property of one element on the open settings screen
    return deco(f'<Action sr="act0" ve="7"><code>481</code><Str sr="arg0" ve="3">bussettings</Str><Str sr="arg1" ve="3">{element}</Str>'
                f'<Str sr="arg2" ve="3">value</Str><Str sr="arg3" ve="3">{value}</Str><Int sr="arg4" val="0"/><Str sr="arg5" ve="3"/></Action>',
                label, ('%busrebuild', 2, 'yes'), cont=True)

def orientation_check():
    # Android's configuration text says "port" or "land"
    return [
        java('confres', 'CONTEXT', 'getResources {Resources} ()', '', 'Which way up is the phone? (screen settings)'),
        java('%busconfig', 'confres', 'getConfiguration {Object} ()', '', '   As text'),
        js('fullscreen.js', 'Sideways or upright?'),
    ]

def wifi_name():
    # The connected Wi-Fi network's name, from Android: WifiManager.getConnectionInfo().getSSID()
    return [
        java('buswifi', 'CONTEXT', 'getSystemService {Object} (String)', 'wifi', 'Wi-Fi service'),
        java('buswinfo', 'buswifi', 'getConnectionInfo {Object} ()', '', 'Current connection'),
        java('%busssid', 'buswinfo', 'getSSID {String} ()', '', 'Its network name'),
    ]

MOVED = 'net.buscountdown.MOVED'

def moved_intent():
    # The PendingIntent Android uses to push positions to Tasker (the same each time, so a new request
    # replaces the old one and Bus End can cancel it)
    return [
        java('%bus_pkg', 'CONTEXT', 'getPackageName {String} ()', '', "Tasker's package name"),
        java('buslm', 'CONTEXT', 'getSystemService {Object} (String)', 'location', 'Android location service'),
        java('busmint', 'android.content.Intent', 'new {android.content.Intent} (String)', MOVED, 'The message each position comes in'),
        java('busmint', 'busmint', 'setPackage {Object} (String)', '%bus_pkg', '   Addressed to Tasker only'),
        java('busmpi', 'android.app.PendingIntent', 'getBroadcast {Object} (android.content.Context, int, android.content.Intent, int)',
             ['CONTEXT', '7201', 'busmint', '167772160'], '   The PendingIntent Android sends it with'),
    ]

def request_positions(mode, cond=None):
    # Ask Android to push a position as you move: every 20 m (at most every 10 s) during a countdown,
    # every 30 m (at most every 20 s) otherwise, for arriving at stops. One stream: asking again with
    # the same PendingIntent replaces the old request. Fused, else GPS. A method returning nothing is
    # written {} (the {void} form fails); errors are spotted with a marker.
    REQ = 'requestLocationUpdates {} (String, long, float, android.app.PendingIntent)'
    # mode 'var': the interval and distance come from %buspushms / %buspushm (set by push_mode.js)
    ms, m = {'countdown': ('10000', '20'), 'arrive': ('20000', '30'), 'var': ('%buspushms', '%buspushm')}[mode]
    what = f'every {m} m'
    c = cond
    def cc(extra):
        return extra if c is None else c        # Tasker conditions here are single: the caller's condition wins
    mark = [] if mode == 'var' else [deco(set_str(set_str(T['VARSET'], 0, '%BusStatePushMode'), 1, mode), 'Remember how often positions come', c)]
    return [*mark, *[deco(a, None, c) if c else a for a in moved_intent()],
        deco(set_str(set_str(T['VARSET'], 0, '%BusStatePush'), 1, 'not requested'), 'Not requested yet', c),
        deco(set_str(set_str(T['VARSET'], 0, '%errmsg'), 1, 'untouched'), 'Clear the last error, to spot a new one', c),
        java('', 'buslm', REQ, ['fused', ms, m, 'busmpi'], f'Ask Android for a position {what} (fused: GPS, Wi-Fi and mobile)', c),
        deco(set_str(set_str(T['VARSET'], 0, '%BusStatePush'), 1, f'fused, {what}'), '   It worked', ('%errmsg', 2, 'untouched')),
        java('', 'buslm', REQ, ['gps', ms, m, 'busmpi'], 'If that failed: ask GPS instead', ('%BusStatePush', 2, 'not requested')),
        deco(set_str(set_str(T['VARSET'], 0, '%BusStatePush'), 1, f'GPS, {what}'), '   GPS worked', ('%BusStatePush', 2, 'not requested'))]

PROFILES = ['Bus Moved', 'Bus Screen On', 'Bus Hide When Sideways']
VERSION = '4.31'
BUILD = VERSION + '.' + time.strftime('%Y%m%d%H%M')     # changes with every build

def profile_status(name, on, label, cond=None):
    # Profile Status (159): switch a profile off (0) or on (1)
    return deco(f'<Action sr="act0" ve="7"><code>159</code><Str sr="arg0" ve="3">{e(name)}</Str><Int sr="arg1" val="{1 if on else 0}"/></Action>', label, cond, cont=True)

def profiles_check():
    # Once per version: switch the profiles off and on, so imported ones start listening
    return perform('Bus Wake', 'New import? Switch the profiles off and on', ('%BusStateVersion', 3, BUILD), pri=7, par1='profiles')

def dismiss(screen, label):
    return deco(set_str(T['DISMISS'], 0, screen), label, cont=True)

def permission_checks():
    # Java checks the settings screen shows as On or Turn on
    t = 'net.dinglisch.android.taskerm'
    return [
        java('%bp_fine', 'CONTEXT', 'checkSelfPermission {int} (String)', 'android.permission.ACCESS_FINE_LOCATION', 'Permission check: location'),
        java('%bp_bg', 'CONTEXT', 'checkSelfPermission {int} (String)', 'android.permission.ACCESS_BACKGROUND_LOCATION', 'Location all the time'),
        java('%bp_overlay', 'android.provider.Settings', 'canDrawOverlays {boolean} (android.content.Context)', 'CONTEXT', 'Display over other apps'),
        java('resolver', 'CONTEXT', 'getContentResolver {Object} ()', '', 'Settings reader'),
        java('%bp_access', 'android.provider.Settings$Secure', 'getString {String} (android.content.ContentResolver, String)', ['resolver', 'enabled_accessibility_services'], 'Accessibility services that are on'),
        java('power', 'CONTEXT', 'getSystemService {Object} (String)', 'power', 'Power service'),
        java('%bp_battery', 'power', 'isIgnoringBatteryOptimizations {boolean} (String)', t, 'Battery unrestricted'),
    ]

def vibrate(ms, label, cond=None):
    return deco(f'<Action sr="act0" ve="7"><code>61</code><Int sr="arg0" val="{ms}"/></Action>', label, cond)

def list_dialog(items, title, label, multi, cond=None):
    return deco(set_str(set_str(set_int(T['LIST'], 1, 1 if multi else 0), 2, title), 3, items), label, cond, cont=True)

# The island is shown under one of two scene names, buspill and buspill2, taking turns (island_swap.js
# picks which). A redraw shows the new one on top first, then removes the old one, so there's never a
# moment with no island, even if a refresh is interrupted part-way through.
ISLAND_SCENES = ['buspill', 'buspill2']

def show_island():
    x = set_str(T['SHOW'], 1, '%buslayout')
    x = set_str(set_str(set_str(set_str(x, 4, '%busx'), 5, '%busy'), 6, '%busww'), 7, '%bush')
    x = set_str(x, 2, '%busnewscene')
    return deco(x, 'Show it around the camera (on top of the old one, if any)', cont=True)

def dismiss_island(label, cond=None):
    # Both names: whichever is showing goes
    return [deco(set_str(T['DISMISS'], 0, n), label if i == 0 else '   and the other name', cond, cont=True) for i, n in enumerate(ISLAND_SCENES)]

def clear_displays():
    return [*dismiss_island('Clear the island'),
            varset('%BusStateIslandShown', '0', 'Island not showing')]

TASKS = [
 (73, 'Bus', [
    js('menu.js', 'Only what applies: Start or End, depending on whether a countdown is running'),
    list_dialog('%busmenu', 'Bus countdown', 'Pick what to do', False),
    perform('Bus Start', 'Start countdown', ('%ld_selected', 2, 'Start countdown')),
    perform('Bus End', 'End countdown', ('%ld_selected', 2, 'End countdown'), par1='menu'),
    perform('Bus Settings', 'Settings (priority 6: above Bus Loop, so it opens during a countdown)', ('%ld_selected', 2, 'Settings'), pri=6),
    perform('Bus Status', 'Status', ('%ld_selected', 2, 'Status')),
    perform('Bus Status', 'Debugging', ('%ld_selected', 2, 'Debugging'), par1='copy'),
    profiles_check(),
 ]),
 (74, 'Bus Settings', [
    profiles_check(),
    js('settings_first.js', 'First run? (camera not measured yet)'),
    if_('%busfirst', 2, 'yes', 'First run: measure the camera before opening the screen'),
      *find_camera(),
    endif(),
    getloc(),
    http('https://api.tfl.gov.uk/StopPoint/?lat=%gl_latitude&lon=%gl_longitude&stopTypes=NaptanPublicBusCoachTram&radius=400&app_key=%TflKey', 'Stops within 400 m and their routes'),
    *permission_checks(),
    *wifi_name(),
    js('settings_open.js', 'Build the settings screen'),
    show_settings(),
    dismiss('buspreview', 'Remove the preview island, if showing'),
    js('settings_save.js', 'Save what changed (however the screen was closed)'),
    flash('%busmsg', 'Say what was saved, if anything', ('%busmsg', 3, 'none')),
    if_('%buspreview', 2, 'yes', 'Preview on screen was tapped: show the island or status bar for 6 seconds, then reopen Settings'),
      varset('%busaction', 'preview', 'Preview'),
      js('settings_button.js', 'Sample times and the island size just saved'),
      js('island_show.js', 'Build the island or status bar chip (whichever Show as says)'),
      show_preview(),
      deco(set_int(T['WAIT'], 1, 6), 'Wait 6 seconds'),
      perform('Bus Refresh', 'A countdown is running: put its real times back', ('%BusStateRunning', 2, '1')),
    endif(),
    if_('%busstopschanged', 2, 'yes', 'Stops or routes changed?'),
      *cache_refresh(),
      js('settings_opposite.js', 'The stop across the road, for each stop just added'),
      list_dialog('%busoppitems', 'Also save the stop across the road? Tick to save', 'Ask: save the stop across the road too?', True, ('%busoppask', 2, 'yes')),
      deco(js('settings_opposite_apply.js', 'Save the ones ticked'), None, ('%busoppask', 2, 'yes')),
      flash('%busoppmsg', 'Say what was saved', ('%busoppask', 2, 'yes')),
    endif(),
    perform('Bus Settings', 'After a preview: open Settings again (priority 6, as from the menu)', ('%buspreview', 2, 'yes'), pri=6),
 ]),
 (75, 'Bus Settings Button', [
    js('settings_button.js', 'What was tapped?'),
    if_('%buspreview', 2, 'yes', 'Preview'),
      js('island_show.js', 'Build the island with the unsaved values and sample times'),
      show_preview(),
    endif(),
    java('busint', 'android.content.Intent', 'new {android.content.Intent} (String)', '%busintent', 'Open a settings page: the intent', ('%busintent', 2, 'android*')),
    java('busu', 'android.net.Uri', 'parse {android.net.Uri} (String)', '%busuri', 'For Tasker specifically', ('%busuri', 2, 'package*')),
    java('busint', 'busint', 'setData {android.content.Intent} (android.net.Uri)', 'busu', 'Attach it', ('%busuri', 2, 'package*')),
    java('busint', 'busint', 'addFlags {android.content.Intent} (int)', '268435456', 'Open as a new screen', ('%busintent', 2, 'android*')),
    java('', 'CONTEXT', 'startActivity {} (android.content.Intent)', 'busint', 'Open it', ('%busintent', 2, 'android*')),
 ]),
 (76, 'Bus Find Camera', [
    *find_camera(),
    update_slider('sl_gap', '%BusIslandGap', 'Reset position: move the open screen\'s camera-space slider'),
    update_slider('sl_y', '%BusIslandY', 'Reset position: move the open screen\'s height slider'),
 ]),
 (38, 'Bus Start', [
    profiles_check(),
    js('settings.js', 'Settings: fill in defaults, check TflKey and BusRoutes'),
    flash('Bus countdown: open Bus Settings first (TfL key and routes)', 'Say why it stopped', ('%BusStateReady', 3, 'yes')),
    stop('Stop if TflKey or BusRoutes is missing', ('%BusStateReady', 3, 'yes')),
    js('start_fix.js', 'Started by a pushed position? Then use it (no new fix needed)'),
    deco(T['GETLOC'], 'Otherwise: get my location', ('%busfixok', 3, 'yes'), cont=True),
    deco(js('loc_age.js', '   Is it recent? (Android sometimes hands back an old one)'), None, ('%busfixok', 3, 'yes')),
    deco(set_int(T['GETLOC'], 9, 1), '   Too old: try again with GPS', ('%busstale', 2, 'yes'), cont=True),
    *cache_refresh(),
    js('start.js', 'My saved stops nearby'),
    flash('%busproblem', 'Say why nothing started', ('%busok', 3, 'yes')),
    stop('Nothing to show: stop here', ('%busok', 3, 'yes')),
    stoptask('Bus Loop', 'End any countdown already running'),
    perform('Bus Loop', 'Start refreshing (runs on after this task ends)', pri=5),
 ]),
 (60, 'Bus Loop', [
    *clear_displays(),
    varset('%BusStateFullscreen', 'no', 'Assume the phone is upright to start with'),
    varset('%BusStateRunning', '1', 'Set the running flag'),
    js('loop.js', 'When the countdown ends by itself (BusTimeout)'),
    deco(set_str(T['FOR'], 1, '1:%buscycles'), 'Refresh until time is up'),
      stop('Stop if Bus End was used', ('%BusStateRunning', 2, '0')),
      js('loop_tick.js', 'Time up? And how long to wait after this refresh'),
      perform('Bus End', "Time's up", ('%busdone', 2, 'yes'), par1='timeout'),
      stop('Time\'s up: stop here', ('%busdone', 2, 'yes')),
      deco(js('push_params.js', 'No positions: ask for them again at the current rate'), None, ('%busnopush', 2, 'yes')),
      *request_positions('var', ('%busnopush', 2, 'yes')),
      profile_status('Bus Moved', False, 'No positions: switch Bus Moved off', ('%busnopush', 2, 'yes')),
      profile_status('Bus Moved', True, '   and on again, so it listens', ('%busnopush', 2, 'yes')),
      perform('Bus Watch', 'No position pushed for 2 minutes: check here instead', ('%busnopush', 2, 'yes'), par1='loop'),
      perform('Bus Refresh', 'Fetch and show the latest times (screen on, or a bus within 8 minutes)', ('%busfetch', 2, 'yes')),
      deco(set_int(T['WAIT'], 1, '%buswait', var=True), 'Wait (longer while the next bus is more than 10 minutes away)'),
    T['ENDFOR'],
    perform('Bus End', "Time's up", par1='timeout'),
 ]),
 (59, 'Bus Refresh', [
    varset('%busstart', '%TIMEMS', 'When this refresh started (for the trip recorder)'),
    # Also run by the Bus Hide When Sideways profile, whenever the phone turns sideways or upright
    if_('%caller1', 2, '*Sideways*', 'Started by the phone turning: sideways or upright?'),
      *orientation_check(),
      *dismiss_island('Sideways: hide the island', ('%busfullnow', 2, 'yes')),
      varset('%BusStateIslandShown', '0', 'So it is shown again afterwards'),
      stop('Sideways: nothing more to do', ('%busfullnow', 2, 'yes')),
    endif(),
    stop('Stop if Bus End was used', ('%BusStateRunning', 3, '1')),
    js('tt_check.js', 'Timetable for this stop today? (only fetched once a day per stop)'),
    if_('%busttfetch', 2, 'yes', 'Not yet: fetch it'),
      deco(set_str(T['FOR'], 1, '1:%busttcount'), 'For each of my routes here'),
        js('tt_route.js', 'Which route'),
        http('https://api.tfl.gov.uk/Line/%busttroute/Timetable/%BusStateStopId?app_key=%TflKey', 'Ask TfL for its timetable'),
        js('tt_store.js', "Keep today's departures"),
      T['ENDFOR'],
    endif(),
    http('https://api.tfl.gov.uk/StopPoint/%BusStateStopId/Arrivals?app_key=%TflKey', 'Ask TfL for live arrivals (last, so its answer is the one read next)'),
    js('refresh.js', 'Build the departures: live times, timetable where there are none'),
    stop('No live data and no timetable: keep showing the last times', ('%busnodata', 2, 'yes')),
    # A bus within 5 minutes (before the island steps, so it buzzes even with the phone sideways): three short buzzes (on two refreshes in a row; see refresh.js)
    vibrate(200, 'A bus within 5 minutes: buzz', ('%busbuzz', 2, 'yes')),
    deco(set_int(set_int(T['WAIT'], 0, 200), 1, 0), '   pause', ('%busbuzz', 2, 'yes')),
    vibrate(200, '   buzz', ('%busbuzz', 2, 'yes')),
    deco(set_int(set_int(T['WAIT'], 0, 200), 1, 0), '   pause', ('%busbuzz', 2, 'yes')),
    vibrate(200, '   buzz (three in all)', ('%busbuzz', 2, 'yes')),
    if_('%BusStateIslandShown', 3, '1', 'Island not up yet: show it (after that it updates itself)'),
      *orientation_check(),
      stop('Phone is sideways: keep the island hidden for now', ('%busfullnow', 2, 'yes')),
      js('island_show.js', 'Build the island'),
      js('island_swap.js', 'Which scene name this time? (the other one from last time)'),
      show_island(),
      deco(set_int(set_int(T['WAIT'], 0, 300), 1, 0), 'Let it fade in over the old one', ('%busoldscene', 3, 'none')),
      deco(set_str(T['DISMISS'], 0, '%busoldscene'), 'Now remove the old one', ('%busoldscene', 3, 'none'), cont=True),
      varset('%BusStateIslandShown', '1', 'Island showing'),
      flash('Swipe the island for the next route. Hold it for the other side of the road. Swipe it right across to dismiss it.',
            'First time only: how to use the island', ('%BusStateHintShown', 3, '1')),
      varset('%BusStateHintShown', '1', 'Hint shown'),
    endif(),
 ]),
 (79, 'Bus Wake', [
    # First, once after each import: switch the profiles off and on, so imported ones start listening.
    # Other tasks run Bus Wake with par1 "profiles" just for this.
    *[a for name in PROFILES for a in (profile_status(name, False, f'{name}: off', ('%BusStateVersion', 3, BUILD)), profile_status(name, True, f'{name}: on', ('%BusStateVersion', 3, BUILD)))],
    deco(set_str(set_str(T['VARSET'], 0, '%busbuild'), 1, BUILD), 'This build', ('%BusStateVersion', 3, BUILD)),
    deco(js('profiles_done.js', 'Remember it was done for this build'), None, ('%BusStateVersion', 3, BUILD)),
    flash(f'Bus countdown {VERSION}: profiles switched on', 'Say so', ('%busbuild', 2, BUILD)),
    stop('Only asked to switch the profiles: done', ('%par1', 2, 'profiles')),
    js('push_params.js', 'Positions: ask again at the current rate (Android forgets after a restart)'),
    *request_positions('var'),
    *wifi_name(),
    js('wifi_save.js', 'Remember it for the other tasks'),
    js('glance_check.js', 'At work, in the heads-up window, with no countdown running?'),
    perform('Bus Start', 'Heads-up: show my stop\'s next buses for a minute', ('%busglance', 2, 'yes'), par1='glance'),
    perform('Bus Refresh', 'Screen on during a countdown: fresh times now (none were fetched while it was off)', ('%BusStateRunning', 2, '1')),
    perform('Bus Watch', 'Screen on: check now (starts a countdown at a stop, or ends one if you\'ve walked away)', None, par1='wake'),
 ]),
 (32, 'Bus End', [
    varset('%busreason', '%par1', 'Why it ended, from the task that ended it (scripts can\'t read %par1)'),
    js('end_log.js', 'Note it in the debugging log, with why (and, if you swiped it, snooze)'),
    vibrate(40, 'Dismissed from the island: confirm with a vibration', ('%busfrom', 2, 'island')),
    varset('%BusStateRunning', '0', 'Tell Bus Loop and Bus Refresh to finish'),
    stoptask('Bus Loop', 'End the refresh loop'),
    *clear_displays(),
 ]),
 (31, 'Bus Island', [
    # Everything the island's gestures ask of Tasker, except ending (that's Bus End). The page passes
    # %busisland: "buzz" (swiped far enough to dismiss) or "switch" (held: the next nearby stop).
    vibrate(15, 'A tick: the island has been swiped far enough to dismiss', ('%busisland', 2, 'buzz')),
    stop('That was all', ('%busisland', 2, 'buzz')),
    vibrate(20, 'Held on the island: confirm with a vibration', ('%busisland', 2, 'switch')),
    deco(js('opposite.js', 'Switch to the next nearby stop'), None, ('%busisland', 2, 'switch')),
    perform('Bus Refresh', 'Refresh now', ('%busisland', 2, 'switch')),
 ]),
 (62, 'Bus Watch', [
    # One task for every check: a position pushed by Android (the Bus Moved profile), the screen
    # coming on (Bus Wake), Bus Loop's safety net, or you running it by hand. Only where the position
    # comes from differs.
    varset('%buscaller', '%caller1', 'Who started this: a profile, or run by hand (scripts can\'t read %caller1)'),
    deco(set_str(set_str(T['VARSET'], 0, '%buscaller'), 1, 'profile=moved'), 'Started by Bus Moved: Android pushed a position', ('%caller1', 2, '*Bus Moved*')),
    deco(set_str(set_str(T['VARSET'], 0, '%buscaller'), 1, 'profile=wake'), 'Started by Bus Wake: the screen just came on', ('%par1', 2, 'wake')),
    deco(set_str(set_str(T['VARSET'], 0, '%buscaller'), 1, 'profile=loop'), 'Started by Bus Loop: no positions pushed lately', ('%par1', 2, 'loop')),
    *wifi_name(),
    js('wifi_save.js', 'Remember it for the other tasks'),
    # Pushed: read the position Android just sent (its own copy in the message is unreadable)
    varset('%busmovedok', 'yes', 'Assume a position will be found'),
    java('buslm', 'CONTEXT', 'getSystemService {Object} (String)', 'location', 'Pushed: Android location service', ('%buscaller', 2, 'profile=moved')),
    java('busloc', 'buslm', 'getLastKnownLocation {Object} (String)', 'fused', '   The position just sent', ('%buscaller', 2, 'profile=moved')),
    java('%bus_lastloc', 'busloc', 'toString {String} ()', '', '   As text', ('%buscaller', 2, 'profile=moved')),
    java('%bus_fixtime', 'busloc', 'getTime {long} ()', '', '   When it was measured', ('%buscaller', 2, 'profile=moved')),
    java('%bus_hasspeed', 'busloc', 'hasSpeed {boolean} ()', '', '   Does Android know your speed?', ('%buscaller', 2, 'profile=moved')),
    java('%bus_speed', 'busloc', 'getSpeed {float} ()', '', '   Your speed, in metres a second', ('%buscaller', 2, 'profile=moved')),
    java('%bus_hasbearing', 'busloc', 'hasBearing {boolean} ()', '', '   Does Android know your direction?', ('%buscaller', 2, 'profile=moved')),
    java('%bus_bearing', 'busloc', 'getBearing {float} ()', '', '   Your direction of travel', ('%buscaller', 2, 'profile=moved')),
    java('%bus_acc', 'busloc', 'getAccuracy {float} ()', '', '   How accurate it is', ('%buscaller', 2, 'profile=moved')),
    deco(js('moved.js', '   Read it'), None, ('%buscaller', 2, 'profile=moved')),
    js('watch_due.js', 'Home or work Wi-Fi? Really left it? (50 m away, or gone for two checks)'),
    perform('Bus End', 'On home or work Wi-Fi during a countdown: end it', ('%busend', 2, 'yes'), par1='wifi'),
    perform('Bus Start', 'Just left home or work Wi-Fi: show the next buses from your nearest stop', ('%busleave', 2, 'yes'), par1='leaving'),
    stop('Staying put away from your stops: no new fix (there was one under 2 minutes ago)', ('%busquiet', 2, 'yes')),
    # Otherwise: fetch one
    deco(T['GETLOC'], 'Otherwise: get my location', ('%buscaller', 3, 'profile=moved'), cont=True),
    deco(js('loc_age.js', '   Is it recent? (Android sometimes hands back an old one)'), None, ('%buscaller', 3, 'profile=moved')),
    deco(set_int(T['GETLOC'], 9, 1), '   Too old: try again with GPS', ('%busstale', 2, 'yes'), cont=True),
    stop('No position: nothing to do', ('%busmovedok', 3, 'yes')),
    js('place_record.js', 'On home or work Wi-Fi? Remember where it is'),
    stop('On home or work Wi-Fi: nothing more to check', ('%busdue', 2, 'no')),
    js('watch.js', 'Where are you in the trip? Move it on'),
    # %buscaller, not %caller1: runs from a profile or another task are all marked profile=...
    flash('%busnote', 'Say what it found and why (only when run by hand)', ('%buscaller', 3, 'profile*')),
    *request_positions('var', ('%buspushmode', 3, 'none')),
    perform('Bus Start', 'Arrived: start the countdown (for the saved stop you are at)', ('%busaction', 2, 'start'), pri=9, par1='arrived'),
    perform('Bus Start', 'Heading to a saved stop: show its next buses early', ('%busaction', 2, 'approach'), pri=9, par1='approach'),
    perform('Bus End', 'Left: end the countdown', ('%busaction', 2, 'stop'), pri=9, par1='watch'),
 ]),
 (72, 'Bus Status', [
    # However it's run (Status or Debugging in the Bus menu, or the run button in Tasker), the full
    # report, the status with the last 20 decisions, goes to the clipboard. Status (or running it
    # directly) also shows the status; Debugging (par1 "copy") just says it's been copied.
    js('status.js', 'Gather everything'),
    js('debugging.js', 'Add the last 20 decisions, for the clipboard'),
    deco('<Action sr="act0" ve="7"><code>105</code><Str sr="arg0" ve="3">%busdebug</Str><Int sr="arg1" val="0"/><Str sr="arg2" ve="3"/><Int sr="arg3" val="0"/></Action>', 'Copy it to the clipboard (every time)'),
    deco(set_int(set_int(set_str(T['FLASH'], 0, '%busshown'), 2, 1), 1, 1), 'Show the status (long, Tasker Layout)', ('%par1', 3, 'copy')),
    flash('Debugging info copied to the clipboard: paste it into the chat', 'Say so', ('%par1', 2, 'copy')),
 ]),
]

def task_block(tid, name, acts):
    now = str(int(time.time() * 1000))
    acts = [re.sub(r'<Action sr="act\w+"', f'<Action sr="act{i}"', a, count=1) for i, a in enumerate(acts)]
    return (f'\t<Task sr="task{tid}">\n\t\t<cdate>{now}</cdate>\n\t\t<edate>{now}</edate>\n\t\t<id>{tid}</id>\n'
            f'\t\t<nme>{name}</nme>\n\t\t<pri>6</pri>\n' + (f'\t\t<rty>{COLLISION[tid]}</rty>\n' if tid in COLLISION else '') +
            '\t\t' + '\n\t\t'.join(acts) + '\n\t</Task>')

# Collision handling ("if already running"): Bus Settings replaces an older copy of itself, so
# opening Settings again works even if a previous screen was left open (1 = abort existing task)
# 74 Bus Settings: opening it again replaces the open screen. 59 Bus Refresh: turning the phone
# (the Bus Hide When Sideways profile) or a new refresh replaces one under way, so hiding the island
# is never lost to a refresh that's still running.
COLLISION = {74: 1, 59: 1}

NOW = str(int(time.time() * 1000))
def profile(pid, name, fh, fm, th, tm, ssid, inverted):
    return (f'\t<Profile sr="prof{pid}" ve="2">\n\t\t<cdate>{NOW}</cdate>\n\t\t<edate>{NOW}</edate>\n\t\t<flags>8</flags>\n'
            f'\t\t<id>{pid}</id>\n\t\t<mid0>62</mid0>\n\t\t<nme>{name}</nme>\n'
            f'\t\t<Time sr="con0">\n\t\t\t<fh>{fh}</fh>\n\t\t\t<fm>{fm}</fm>\n\t\t\t<th>{th}</th>\n\t\t\t<tm>{tm}</tm>\n\t\t\t<rep>2</rep>\n\t\t\t<repval>2</repval>\n\t\t</Time>\n'
            f'\t\t<State sr="con1" ve="2">\n\t\t\t<code>160</code>\n' + ('\t\t\t<pin>true</pin>\n' if inverted else '') +
            f'\t\t\t<Str sr="arg0" ve="3">{ssid}</Str>\n\t\t\t<Str sr="arg1" ve="3"/>\n\t\t\t<Str sr="arg2" ve="3"/>\n\t\t\t<Int sr="arg3" val="2"/>\n\t\t</State>\n\t</Profile>')
PROFILES = [
    # Screen on: one check straight away (Bus Watch skips checks while the screen is off)
    (f'\t<Profile sr="prof72" ve="2">\n\t\t<cdate>{NOW}</cdate>\n\t\t<edate>{NOW}</edate>\n\t\t<flags>8</flags>\n'
     f'\t\t<id>72</id>\n\t\t<mid0>79</mid0>\n\t\t<nme>Bus Screen On</nme>\n'
     f'\t\t<Event sr="con0" ve="2">\n\t\t\t<code>208</code>\n\t\t\t<pri>0</pri>\n\t\t\t<Int sr="arg0" val="1"/>\n\t\t</Event>\n\t</Profile>'),
    # Positions Android pushes during a countdown (Intent Received): runs Bus Moved
    (f'\t<Profile sr="prof74" ve="2">\n\t\t<cdate>{NOW}</cdate>\n\t\t<edate>{NOW}</edate>\n\t\t<flags>8</flags>\n'
     f'\t\t<id>74</id>\n\t\t<mid0>62</mid0>\n\t\t<nme>Bus Moved</nme>\n'
     f'\t\t<Event sr="con0" ve="2">\n\t\t\t<code>599</code>\n\t\t\t<pri>0</pri>\n\t\t\t<Str sr="arg0" ve="3">{MOVED}</Str>\n'
     f'\t\t\t<Int sr="arg1" val="0"/>\n\t\t\t<Int sr="arg2" val="0"/>\n\t\t\t<Str sr="arg3" ve="3"/>\n\t\t\t<Str sr="arg4" ve="3"/>\n'
     f'\t\t\t<Int sr="arg5" val="0"/>\n\t\t\t<Int sr="arg6" val="0"/>\n\t\t</Event>\n\t</Profile>'),
    # Sideways: Display Orientation is Landscape. Entering and leaving both run Bus Hide When Sideways,
    # which asks Android which way up the screen is and hides or shows the island.
    (f'\t<Profile sr="prof73" ve="2">\n\t\t<cdate>{NOW}</cdate>\n\t\t<edate>{NOW}</edate>\n\t\t<flags>8</flags>\n'
     f'\t\t<id>73</id>\n\t\t<mid0>59</mid0>\n\t\t<mid1>59</mid1>\n\t\t<nme>Bus Hide When Sideways</nme>\n'
     f'\t\t<State sr="con0" ve="2">\n\t\t\t<code>122</code>\n\t\t\t<Int sr="arg0" val="1"/>\n\t\t</State>\n\t</Profile>'),
]

proj = ('<Project sr="proj0" ve="2">\n\t\t<cdate>' + NOW + '</cdate>\n\t\t<name>Bus Countdown</name>\n'
        '\t\t<pids>72,73,74</pids>\n\t\t<tids>' + ','.join(str(t[0]) for t in TASKS) + '</tids>\n\t</Project>')
dmetric = re.search(r'<dmetric>.*?</dmetric>', SRC).group(0)
out = ('<TaskerData sr="" dvi="1" tv="6.7.6-beta">\n\t' + dmetric + '\n' + '\n'.join(PROFILES) + '\n\t' + proj + '\n' +
       '\n'.join(task_block(*t) for t in TASKS) + '\n</TaskerData>\n')
import os; OUT = os.environ.get('BUS_OUT', os.path.join(HERE, '..', 'Bus_Countdown.prj.xml'))
open(OUT, 'w', encoding='utf-8').write(out)
import xml.dom.minidom as m; m.parse(OUT)
print('ok', len(out), 'bytes;', len(re.findall(r'<Action sr=', out)), 'actions;', len(TASKS), 'tasks')
