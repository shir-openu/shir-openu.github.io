"""One copyright line at the bottom of every live page - and only one.

Shir asked for "(c) Shir Sivroni" on all pages and subpages of
shir-openu.github.io.

WHAT WENT WRONG THE FIRST TIME, AND WHY
---------------------------------------
No page had a <footer> element, so the first version of this script added one
to all 30. A screenshot of the deployed result showed TWO copyright lines
stacked at the bottom of every lesson: 31 pages already carried

    <div class="footer">&copy; Developed by Shir Sivroni</div>

which is a copyright line that simply is not a <footer> tag. Searching for the
tag instead of for the text is what missed it. The lesson is narrow and worth
keeping: when checking whether a page already says something, search for what
it SAYS, not for the element you would have used to say it.

WHAT IT DOES NOW
----------------
  page already has the site's own .footer div
      -> normalise its text to "(c) Shir Sivroni" ("(c) Developed by" reads as
         a mistake), and remove the footer this script added, if present. Their
         div is already styled by the page's own stylesheet and sits inside the
         container, which is the better home.

  page has no copyright line at all
      -> add one, styled on the element, because these pages do not share a
         stylesheet: ode-first-order/* uses assets/lesson.css and each section
         page carries its own <style>, so a rule added to one would silently
         miss the others.

Idempotent, and safe to re-run after new pages are added.

RUN
    python tools/add_copyright_footer.py           (apply)
    python tools/add_copyright_footer.py --check   (report only)
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WANTED = '&copy; Shir Sivroni'
MARKER = 'site-copyright'

ADDED_FOOTER = (
    '\n<footer class="site-copyright" '
    'style="margin:56px auto 0;padding:20px 22px 30px;max-width:1100px;'
    'border-top:1px solid rgba(255,255,255,.10);color:#8b8794;'
    'font:0.88rem/1.6 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;'
    'text-align:center;position:relative;z-index:1;">\n'
    '  ' + WANTED + '\n'
    '</footer>\n'
)

# the site's own footer div, however it is spelled
EXISTING = re.compile(
    r'(<div class="footer">\s*)(?:&copy;|©)\s*(?:Developed by\s*)?Shir Sivroni(\s*</div>)',
    re.IGNORECASE)

# the block this script may have added on a previous run
MINE = re.compile(r'\n?<footer class="site-copyright".*?</footer>\n?', re.DOTALL)

SKIP_PARTS = ('_OLD.html', '_old.html', 'index_20', 'google', 'backup', '.git')


def live_pages():
    out = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', 'media_OLD',
                                                '_AUDIT_2026-08-16')]
        for f in files:
            if not f.endswith('.html'):
                continue
            p = os.path.join(base, f)
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            if any(s in rel for s in SKIP_PARTS):
                continue
            out.append(p)
    return sorted(out)


def main():
    check = '--check' in sys.argv
    normalised = added = untouched = 0

    for p in live_pages():
        rel = os.path.relpath(p, ROOT).replace('\\', '/')
        s = original = io.open(p, encoding='utf-8').read()

        has_own = bool(EXISTING.search(s))

        if has_own:
            s = EXISTING.sub(r'\g<1>' + WANTED + r'\g<2>', s)
            s = MINE.sub('\n', s)          # drop the duplicate we added
            what = 'normalised (site footer kept, duplicate removed)'
            normalised += 1
        elif MARKER in s:
            what = 'already added by this script'
            untouched += 1
        else:
            i = s.rfind('</body>')
            if i == -1:
                print('  NO </body>  %s' % rel)
                continue
            s = s[:i] + ADDED_FOOTER + s[i:]
            what = 'added'
            added += 1

        if s != original and not check:
            io.open(p, 'w', encoding='utf-8', newline='').write(s)
        print('  %-56s %s' % (rel, what))

    print('\n%s: %d normalised, %d added, %d already fine'
          % ('CHECK' if check else 'DONE', normalised, added, untouched))


if __name__ == '__main__':
    main()
