"""Put the same copyright line at the bottom of every live page on the site.

Shir asked for "@ Shir Sivroni" on all pages and subpages of
shir-openu.github.io. None of the 30 live pages had a <footer> at all.

The styling is on the element itself rather than in a stylesheet on purpose:
the pages do not share one. ode-first-order/* uses assets/lesson.css, the
section pages each carry their own <style>, and a rule added to one of them
would silently miss the others - which is the whole failure mode being fixed
here. Six inline declarations is the smaller price.

Colours are taken from the site's own palette (#120a12 page, muted grey text)
and the border is the same low-contrast white the cards use.

Idempotent: a page that already carries the marker is skipped, so this can be
re-run after new pages are added.

RUN
    python tools/add_copyright_footer.py           (apply)
    python tools/add_copyright_footer.py --check   (report only)
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MARKER = 'site-copyright'

FOOTER = (
    '\n<footer class="site-copyright" '
    'style="margin:56px auto 0;padding:20px 22px 30px;max-width:1100px;'
    'border-top:1px solid rgba(255,255,255,.10);color:#8b8794;'
    'font:0.88rem/1.6 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;'
    'text-align:center;position:relative;z-index:1;">\n'
    '  &copy; Shir Sivroni\n'
    '</footer>\n'
)

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
    added = skipped = nobody = 0
    for p in live_pages():
        rel = os.path.relpath(p, ROOT).replace('\\', '/')
        s = io.open(p, encoding='utf-8').read()

        if MARKER in s:
            print('  skip (already there) %s' % rel)
            skipped += 1
            continue

        i = s.rfind('</body>')
        if i == -1:
            print('  NO </body>          %s' % rel)
            nobody += 1
            continue

        if not check:
            io.open(p, 'w', encoding='utf-8', newline='').write(
                s[:i] + FOOTER + s[i:])
        print('  %s %s' % ('would add ' if check else 'added     ', rel))
        added += 1

    print('\n%s: %d added, %d already had it, %d had no </body>'
          % ('CHECK' if check else 'DONE', added, skipped, nobody))


if __name__ == '__main__':
    main()
