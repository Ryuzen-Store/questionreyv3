QuestionRy Multi Quest uses a system font stack (Inter / Segoe UI / Roboto /
Arial / Noto Sans) and does not ship webfont files. This keeps the site fast
and offline-tolerant with zero blocking font requests.

If you wish to self-host custom fonts:
  1. Drop .woff2 files in this directory.
  2. Add @font-face rules in css/style.css.
  3. Delete the inline <style> font-family block in index.html if you want the
     custom stack to take precedence.

System stack used:
  headings : 'Archivo Black', 'Arial Black', 'Inter', system-ui, sans-serif
  body     : 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'
