/* Bus · Menu items: "End countdown" while one is running, "Start countdown" otherwise */
var running = global('BusStateRunning') === '1';
var busmenu = (running ? 'End countdown' : 'Start countdown') + ',Settings,Status,Debugging';
