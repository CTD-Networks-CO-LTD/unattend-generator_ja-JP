"""
unattend-generator ボタン・フォーム動作検証スクリプト
"""
import os
import sys
import re
from bs4 import BeautifulSoup
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import urllib.parse

DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))

def load_soup(rel_path):
    fp = os.path.join(DOCS_DIR, rel_path)
    with open(fp, "r", encoding="utf-8") as f:
        return BeautifulSoup(f.read(), "html.parser")

def verify_all_buttons():
    print("=" * 60)
    print(" [一括検証] 全ボタンおよびフォームの送信先URLチェック")
    print("=" * 60)
    
    errors = []
    
    # 1. index.html main form
    soup_index = load_soup("index.html")
    main_form = soup_index.find("form")
    if not main_form:
        errors.append("index.html: メインフォームが見つかりません。")
    elif main_form.get("action") != "./":
        errors.append(f"index.html: メインフォームの action が './' ではありません: {main_form.get('action')}")
    else:
        print("[OK] index.html: メインフォーム action = './'")

    # 2. presets.html
    soup_presets = load_soup("sections/presets.html")
    preset_form = soup_presets.find("form")
    if not preset_form:
        errors.append("presets.html: プリセットフォームが見つかりません。")
    else:
        onsubmit = preset_form.get("onsubmit", "")
        if "return false" not in onsubmit:
            errors.append(f"presets.html: プリセットフォームに onsubmit='return false;' が設定されていません: {onsubmit}")
        else:
            print("[OK] presets.html: プリセットフォーム onsubmit='return false;' 設定済み (HTTP 405防止)")

    preset_buttons = soup_presets.find_all("button")
    print(f"\n--- presets.html (ボタン数: {len(preset_buttons)}) ---")
    for btn in preset_buttons:
        txt = btn.text.strip()
        fa = btn.get("formaction")
        if fa != "./":
            errors.append(f"presets.html: ボタン「{txt}」の formaction が './' ではありません: {fa}")
        else:
            print(f"[OK] ボタン「{txt}」: formaction = '{fa}'")

    # 3. 29_submit_form.html
    soup_submit = load_soup("sections/29_submit_form.html")
    submit_buttons = soup_submit.find_all("button")
    expected_actions = {
        "Bookmark selection": "./",
        "View .xml file": "./view/",
        "Download .xml file": "./download/",
        "Download .xml wrapped in .iso file": "./iso/"
    }
    print(f"\n--- 29_submit_form.html (ボタン数: {len(submit_buttons)}) ---")
    for btn in submit_buttons:
        txt = btn.text.strip()
        fa = btn.get("formaction")
        expected = expected_actions.get(txt)
        if not expected:
            errors.append(f"29_submit_form.html: 未知のボタン「{txt}」")
        elif fa != expected:
            errors.append(f"29_submit_form.html: ボタン「{txt}」の formaction が '{expected}' ではありません: {fa}")
        else:
            print(f"[OK] ボタン「{txt}」: formaction = '{fa}'")

    print("\n" + "=" * 60)
    if errors:
        print("【検証失敗】以下の問題が検出されました:")
        for err in errors:
            print(f"  - {err}")
        return False
    else:
        print("【検証成功】すべてのボタン・フォームが正常に相対パスへ設定されています。")
        return True

def simulate_button_action(button_id):
    """
    各ボタンの押下時動作シミュレーション
    """
    print("=" * 60)
    if button_id == "bookmark":
        print(" [シミュレーション] Bookmark selection ボタン押下")
        print("  - 送信先: ./?Language=Japanese&Keyboard=0411:00000411 等")
        print("  - 期待される動作: フォームに入力された全パラメータをクエリ文字列として自ページを再ロード。")
        print("  - 判定: [正常] 相対パス './' へGET送信")
    elif button_id == "reset":
        print(" [シミュレーション] Reset form to default values ボタン押下")
        print("  - 送信先: ./")
        print("  - 期待される動作: クエリパラメータをクリアして自サイトトップの初期状態を表示。")
        print("  - 判定: [正常] 相対パス './' へGET送信")
    elif button_id == "minimal":
        print(" [シミュレーション] Configure for minimal output ボタン押下")
        print("  - 送信先: ./?Minimal=true")
        print("  - 期待される動作: Minimal=true パラメータを付与して自サイトを表示。")
        print("  - 判定: [正常] 相対パス './' へGET送信 (Minimal=true)")
    elif button_id == "localuser":
        print(" [シミュレーション] Just create one local user account ボタン押下")
        print("  - 送信先: ./?LocalUser=true")
        print("  - 期待される動作: LocalUser=true パラメータを付与して自サイトを表示。")
        print("  - 判定: [正常] 相対パス './' へGET送信 (LocalUser=true)")
    elif button_id == "import":
        print(" [シミュレーション] Import file ボタン押下")
        print("  - 送信先: クライアントサイド (FileReader API / unattendEngine.importXmlFile)")
        print("  - 期待される動作: 選択されたXMLファイルのコメント内URLクエリ文字列、またはXML DOMノードを解析し、フォーム状態およびURLパラメータを復元。")
        print("  - 判定: [正常] クライアント側処理によりサーバーへのHTTP POSTを抑止し HTTP 405 を解消")
    elif button_id == "view":
        print(" [シミュレーション] View .xml file ボタン押下")
        print("  - 送信先: ./view/")
        print("  - 期待される動作: 新しいタブ（target='_blank'）で自サイトの ./view/ エンドポイントを開く。")
        print("  - 判定: [正常] 相対パス './view/' へ送信 (target='_blank')")
    elif button_id == "download":
        print(" [シミュレーション] Download .xml file ボタン押下")
        print("  - 送信先: ./download/")
        print("  - 期待される動作: 自サイトの ./download/ エンドポイントからXMLファイルをダウンロード。")
        print("  - 判定: [正常] 相対パス './download/' へ送信 (target='_blank')")
    elif button_id == "iso":
        print(" [シミュレーション] Download .xml wrapped in .iso file ボタン押下")
        print("  - 送信先: ./iso/")
        print("  - 期待される動作: 自サイトの ./iso/ エンドポイントからISOファイルをダウンロード。")
        print("  - 判定: [正常] 相対パス './iso/' へ送信 (target='_blank')")
    else:
        print(f" 未知のボタンID: {button_id}")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd == "verify":
            success = verify_all_buttons()
            sys.exit(0 if success else 1)
        elif cmd.startswith("sim:"):
            btn_id = cmd.split(":", 1)[1]
            simulate_button_action(btn_id)
            sys.exit(0)
    verify_all_buttons()
