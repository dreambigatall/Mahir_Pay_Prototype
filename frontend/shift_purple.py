import re

with open("src/app/globals.css", "r") as f:
    css = f.read()

# Replace any hsl(241 S% L%) with 270
def replacer(match):
    return f"hsl(270 {match.group(1)}% {match.group(2)}%)"

css = re.sub(r'hsl\(241\s+(\d+)%\s+(\d+)%\)', replacer, css)

# Replace shadow rgba(119, 118, 188
css = css.replace("rgba(119, 118, 188", "rgba(163, 118, 188")

with open("src/app/globals.css", "w") as f:
    f.write(css)
