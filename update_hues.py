import re

with open("src/app/globals.css", "r") as f:
    css = f.read()

# Replace any hsl(H S% L%) where H is between 180 and 205 with 241.
def replacer(match):
    h = int(match.group(1))
    if 180 <= h <= 205:
        return f"hsl(241 {match.group(2)}% {match.group(3)}%)"
    return match.group(0)

css = re.sub(r'hsl\((\d+)\s+(\d+)%\s+(\d+)%\)', replacer, css)

# Replace shadow color rgba(8, 145, 178, X) with rgba(119, 118, 188, X)
css = css.replace("rgba(8, 145, 178", "rgba(119, 118, 188")

with open("src/app/globals.css", "w") as f:
    f.write(css)
