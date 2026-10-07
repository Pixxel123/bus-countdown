import re, time
from xml.sax.saxutils import escape as e
import os
HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.path.join(os.getcwd(), 'build')
# Action templates: Tasker's own XML for each kind of action, taken from an exported project
SRC = open(os.path.join(HERE, 'templates.prj.xml'), encoding='utf-8').read()
# Scripts can include shared pieces from scripts/shared: a line that is only "/* @include NAME */"
# is replaced by scripts/shared/NAME.js, indented to match. (tests/harness.js does the same.)
def compose(text):
    def one(m):
        ind, name = m.group(1), m.group(2)
        body = open(os.path.join(HERE, '..', 'scripts', 'shared', name + '.js'), encoding='utf-8').read().strip()
        return '\n'.join(ind + l if l else l for l in body.split('\n'))
    return re.sub(r'^([ \t]*)/\* @include (\w+) \*/[ \t]*$', one, text, flags=re.M)
JS = lambda f: compose(open(os.path.join(HERE, '..', 'scripts', f), encoding='utf-8').read()).strip() + '\n'

def task_xml(tid): return re.search(rf'<Task sr="task{tid}">.*?</Task>', SRC, re.S).group(0)
def tmpl(tid, a):
    x = re.search(rf'<Action sr="{a}" ve="\d+">.*?</Action>', task_xml(tid), re.S).group(0)
    x = re.sub(r'\s*<label>.*?</label>', '', x, flags=re.S)
    x = re.sub(r'\s*<se>\w+</se>', '', x)
    x = re.sub(r'\s*<ConditionList sr="if">.*?</ConditionList>', '', x, flags=re.S)
    return x

T = dict(IF=(38,'act2'), ELSE=(59,'act9'), ENDIF=(38,'act5'), JS=(38,'act6'), GETLOC=(38,'act0'), HTTP=(38,'act1'),
         NOTIFY=(38,'act3'), STOP=(38,'act4'), STOPTASK=(32,'act1'), PERFORM=(32,'act3'), VARSET=(32,'act0'),
         WAIT=(60,'act6'), FOR=(60,'act3'), ENDFOR=(60,'act7'), LIST=(63,'act8'), FLASH=(63,'act10'),
         NCANCEL=(44,'act1'), DISMISS=(44,'act2'), ANCANCEL=(44,'act0'), CHIP=(59,'act8'), SHOW=(59,'act11'),
         ANERR=(59,'act3'), ANCOUNT=(59,'act15'))
T = {k: tmpl(*v) for k, v in T.items()}

def set_str(x, i, v):
    new = f'<Str sr="arg{i}" ve="3">{e(v)}</Str>' if v != '' else f'<Str sr="arg{i}" ve="3"/>'
    x, n = re.subn(rf'<Str sr="arg{i}" ve="3"(?:/>|>.*?</Str>)', lambda m: new, x, count=1, flags=re.S); assert n == 1, (i, x[:80]); return x
def set_int(x, i, v, var=False):
    new = f'<Int sr="arg{i}"><var>{v}</var></Int>' if var else f'<Int sr="arg{i}" val="{v}"/>'
    x, n = re.subn(rf'<Int sr="arg{i}"(?: val="[^"]*"/>|>.*?</Int>)', lambda m: new, x, count=1, flags=re.S); assert n == 1; return x
exec(open(os.path.join(HERE, 'labels.py')).read())          # html(): detailed, styled step labels

def deco(x, label=None, cond=None, cont=False):
    head = re.match(r'(<Action sr="act\d+" ve="\d+">\s*<code>\d+</code>)', x).group(1)
    label = html(label, re.search(r'<code>(\d+)</code>', head).group(1)) if label else label
    extra = ('\n\t\t\t<se>false</se>' if cont else '') + (f'\n\t\t\t<label>{e(label)}</label>' if label else '')
    x = x.replace(head, head + extra, 1)
    if cond:
        c = ''.join(f'<Condition sr="c{i}" ve="3"><lhs>{e(l)}</lhs><op>{op}</op><rhs>{e(r)}</rhs></Condition>' for i, (l, op, r) in enumerate([cond]))
        x = x.replace('</Action>', f'<ConditionList sr="if">{c}</ConditionList></Action>')
    return x

# ---- action builders (op 2 = matches, 3 = doesn't match; Tasker patterns: "a/b" = a or b) ----
def js(file, label): return deco(set_str(T['JS'], 0, JS(file)), label)
def if_(l, op, r, label=None): return deco(T['IF'], label, (l, op, r))
def elseif(l, op, r, label=None): return deco(T['ELSE'], label, (l, op, r))
def else_(): return T['ELSE']
def endif(): return T['ENDIF']
def stop(label=None, cond=None): return deco(T['STOP'], label, cond)
def stoptask(name, label=None): return deco(set_str(T['STOPTASK'], 1, name), label)
def perform(name, label=None, cond=None, pri=10, par1=''):
    x = set_int(set_str(T['PERFORM'], 0, name), 1, pri)
    x = set_str(x, 2, par1)
    return deco(x, label, cond)
def varset(name, val, label=None): return deco(set_str(set_str(T['VARSET'], 0, name), 1, val), label)
def getloc(label='Where am I?'): return deco(T['GETLOC'], label, cont=True)
def http(url, label): return deco(set_str(T['HTTP'], 2, url), label, cont=True)
def flash(text, label=None, cond=None):
    # Every flash uses Tasker Layout (arg2)
    return deco(set_int(set_str(T['FLASH'], 0, text), 2, 1), label, cond)
def notify(title, text, label=None, cond=None): return deco(set_str(set_str(T['NOTIFY'], 0, title), 1, text), label, cond)
def raw(k, label=None, cond=None, cont=False, **args):
    x = T[k]
    for i, v in args.items(): x = set_str(x, int(i[1:]), v)
    return deco(x, label, cond, cont)

def ask(title, text, label):
    # Input Dialog (360): the answer arrives in %input
    x = ('<Action sr="act0" ve="7"><code>360</code><Bundle sr="arg0"><Vals sr="val"/></Bundle>'
         f'<Str sr="arg1" ve="3">{e(title)}</Str><Str sr="arg2" ve="3">{e(text)}</Str><Str sr="arg3" ve="3"/>'
         '<Int sr="arg4" val="120"/><Str sr="arg5" ve="3"/><Int sr="arg6" val="0"/><Int sr="arg7" val="0"/>'
         '<Str sr="arg8" ve="3"/></Action>')
    # An empty answer makes Tasker report 'No input provided'; carry on and keep the old value
    return deco(x, label, cont=True)

def clear_input():
    # Variable Clear (549): so an empty answer can't reuse the previous dialog's %input
    return ('<Action sr="act0" ve="7"><code>549</code><label>Forget the last answer: so an old reply from TfL is never mistaken for this one</label>'
            '<Str sr="arg0" ve="3">%input</Str><Int sr="arg1" val="0"/><Int sr="arg2" val="0"/><Int sr="arg3" val="0"/></Action>')

def cache_refresh():
    # The same steps in Bus Start and Bus Add Nearby Stop: refresh the route stops cache if it's stale
    return [
        js('cache_check.js', 'Route stops cache up to date? (once a day, or when routes change)'),
        if_('%busfetch', 2, 'yes', 'Out of date: fetch it'),
          deco(set_str(T['FOR'], 1, '1:%busroutecount'), 'For each of my routes'),
            js('cache_route.js', 'Which route'),
            http('https://api.tfl.gov.uk/Line/%busroute/StopPoints?app_key=%TflKey', 'Ask TfL for every stop on it'),
            js('cache_merge.js', 'Add its stops'),
          T['ENDFOR'],
        endif(),
        js('cache_commit.js', 'Keep what was fetched'),
    ]

