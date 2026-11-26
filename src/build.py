"""묘신령 사주 웹앱 빌드 스크립트.

저장소 루트에서 `python3 src/build.py` 를 실행하면
src/template.html + src/*.js + assets/*.jpg 를 하나의 자립형 index.html 로 합칩니다.
"""
import base64
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
SRC = HERE


def data_uri(path, mime="image/jpeg"):
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()


html = open(os.path.join(SRC, "template.html"), encoding="utf-8").read()
html = html.replace("{{IMG_MAIN}}", data_uri(os.path.join(BASE, "assets", "cat_main_web.jpg")))
html = html.replace("{{IMG_ROAST}}", data_uri(os.path.join(BASE, "assets", "cat_roast_web.jpg")))
html = html.replace("{{IMG_LUCK}}", data_uri(os.path.join(BASE, "assets", "cat_luck_web.jpg")))
html = html.replace("{{TABLE_JS}}", open(os.path.join(SRC, "terms_table.js"), encoding="utf-8").read())
html = html.replace("{{ENGINE_JS}}", open(os.path.join(SRC, "engine.js"), encoding="utf-8").read())
html = html.replace("{{DATA_JS}}", open(os.path.join(SRC, "data.js"), encoding="utf-8").read())

assert "{{" not in html, "치환되지 않은 템플릿 자리표시자가 있습니다"
out = os.path.join(BASE, "index.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, round(os.path.getsize(out) / 1024), "KB")
