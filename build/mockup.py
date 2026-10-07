# Builds docs/mockup.html (the island mockup, also published as an artifact) from docs/mockup.src.html:
# fills in the island's own builder (scripts/island_show.js, with its shared pieces), and the version
# and date of the island's last change. Run by npm run build, after assemble.py.
#   The builder goes inside the page's own <script> tag, where a literal "<!--" followed by "<script"
#   would stop the browser finding the tag's end. Both only occur inside island_show.js's String.raw
#   template, so they're written ${'<'}!-- and ${'<'}script there, which builds the same text.
import os, re
from helpers import compose
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
src = open(os.path.join(ROOT, 'docs', 'mockup.src.html'), encoding='utf-8').read()
island = compose(open(os.path.join(ROOT, 'scripts', 'island_show.js'), encoding='utf-8').read())
start = island.index('String.raw`'); end = island.index('`;', start)
tpl = island[start:end]
assert '${' not in tpl, 'island_show.js template already uses ${...}'
outside = island[:start] + island[end:]
assert not re.search(r'<!--|<script|</script', outside, re.I), 'HTML-unsafe text outside the template'
tpl = tpl.replace('<!--', "${'<'}!--").replace('<script', "${'<'}script")
island = island[:start] + tpl + island[end:]
# The version and date shown are the island's: the newest timeline entry, not the project's version, so
# a version that changes only what happens underneath leaves the page exactly as it was.
version, date = re.search(r"var VERSIONS = \[\s*\['([^']+)', '([^']+)'", src).groups()
MONTHS = {'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'}
date = re.sub(r'.*?(\d+) (\w+)$', lambda m: m.group(1) + ' ' + MONTHS.get(m.group(2), m.group(2)), date)
out = (src.replace('/*{{ISLAND_SHOW}}*/', island.strip())
          .replace('{{VERSION}}', version)
          .replace('{{DATE}}', date))
open(os.path.join(ROOT, 'docs', 'mockup.html'), 'w', encoding='utf-8').write(out)
print('mockup', len(out), 'bytes; island', version)
