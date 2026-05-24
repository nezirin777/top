#!D:\Python\Python314\python.exe
# -*- coding: utf-8 -*-

import json
import requests
from decimal import Decimal, InvalidOperation

# =========================
# 設定
# =========================
VIPS_MINT = "vip5TB545snmg5F54HpTHLZv8bUEhBboySa4DSMSnbS"

GECKO_BASE_URL = "https://api.geckoterminal.com/api/v2"
USDJPY_URL = "https://open.er-api.com/v6/latest/USD"

TIMEOUT = 15


def print_json(data, status="200 OK"):
    print(f"Status: {status}")
    print("Content-Type: application/json; charset=utf-8")
    print("Cache-Control: no-store, no-cache, must-revalidate, max-age=0")
    print("Pragma: no-cache")
    print()
    print(json.dumps(data, ensure_ascii=False))


def get_json(url):
    res = requests.get(
        url,
        timeout=TIMEOUT,
        headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    res.raise_for_status()
    return res.json()


def to_decimal(value, default="0"):
    try:
        if value is None or value == "":
            return Decimal(default)
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def get_price_from_token_endpoint():
    """
    GeckoTerminal token endpoint から price_usd を取得
    """
    url = f"{GECKO_BASE_URL}/networks/solana/tokens/{VIPS_MINT}"
    data = get_json(url)

    token = data.get("data") or {}
    attrs = token.get("attributes") or {}

    price_usd = to_decimal(attrs.get("price_usd"))
    name = attrs.get("name", "")
    symbol = attrs.get("symbol", "")

    if price_usd > 0:
        return {
            "price_usd": price_usd,
            "source_url": f"https://www.geckoterminal.com/solana/tokens/{VIPS_MINT}",
            "dex_id": "",
            "pool_address": "",
            "liquidity_usd": attrs.get("total_reserve_in_usd", ""),
            "token_name": name,
            "token_symbol": symbol,
            "via": "token",
        }

    raise ValueError("token endpoint で price_usd を取得できませんでした。")


def get_price_from_pools_endpoint():
    """
    GeckoTerminal token pools endpoint から、
    reserve_in_usd 最大の pool を採用して price_usd を組み立てる
    """
    url = f"{GECKO_BASE_URL}/networks/solana/tokens/{VIPS_MINT}/pools"
    data = get_json(url)

    pools = data.get("data") or []
    if not isinstance(pools, list) or not pools:
        raise ValueError("pools endpoint で pool が見つかりませんでした。")

    candidates = []

    for pool in pools:
        attrs = pool.get("attributes") or {}

        reserve_in_usd = to_decimal(attrs.get("reserve_in_usd"))
        base_token_price_usd = to_decimal(attrs.get("base_token_price_usd"))
        quote_token_price_usd = to_decimal(attrs.get("quote_token_price_usd"))

        # GeckoTerminalの pool レスポンスでは base/quote の token アドレスが
        # relationships / included に出ることがあるが、環境差を避けるため
        # まずは「base_token_price_usd がある pool」を優先して採用する。
        picked_price = Decimal("0")

        if base_token_price_usd > 0:
            picked_price = base_token_price_usd
        elif quote_token_price_usd > 0:
            picked_price = quote_token_price_usd

        if picked_price > 0:
            candidates.append(
                {
                    "reserve_in_usd": reserve_in_usd,
                    "price_usd": picked_price,
                    "pool_address": attrs.get("address", ""),
                    "dex_id": attrs.get("dex_name", ""),
                    "source_url": attrs.get("url", ""),
                    "name": attrs.get("name", ""),
                    "via": "pools",
                }
            )

    if not candidates:
        raise ValueError("pools endpoint に有効な価格候補がありませんでした。")

    candidates.sort(key=lambda x: x["reserve_in_usd"], reverse=True)
    best = candidates[0]
    return {
        "price_usd": best["price_usd"],
        "source_url": best["source_url"] or "",
        "dex_id": best["dex_id"] or "",
        "pool_address": best["pool_address"] or "",
        "liquidity_usd": str(best["reserve_in_usd"]),
        "token_name": best["name"] or "",
        "token_symbol": "",
        "via": "pools",
    }


def get_vips_usd_price():
    errors = []

    try:
        return get_price_from_token_endpoint()
    except Exception as e:
        errors.append("token: " + str(e))

    try:
        return get_price_from_pools_endpoint()
    except Exception as e:
        errors.append("pools: " + str(e))

    raise ValueError(" / ".join(errors))


def get_usdjpy():
    data = get_json(USDJPY_URL)
    rate = data.get("rates", {}).get("JPY")

    if rate is None:
        raise ValueError("USD/JPY の取得に失敗しました。")

    return Decimal(str(rate))


def main():
    try:
        token_data = get_vips_usd_price()
        vips_usd = token_data["price_usd"]
        usd_jpy = get_usdjpy()
        vips_jpy = vips_usd * usd_jpy

        payload = {
            "ok": True,
            "token": {
                "mint": VIPS_MINT,
                "chain": "solana",
                "name": token_data.get("token_name", ""),
                "symbol": token_data.get("token_symbol", ""),
            },
            "price": {
                "vips_usd": format(vips_usd, "f"),
                "usd_jpy": format(usd_jpy, "f"),
                "vips_jpy": format(vips_jpy, "f"),
            },
            "source": {
                "provider": "geckoterminal",
                "via": token_data.get("via", ""),
                "url": token_data.get("source_url", ""),
                "pair_address": token_data.get("pool_address", ""),
                "dex_id": token_data.get("dex_id", ""),
                "liquidity_usd": token_data.get("liquidity_usd", ""),
            },
        }
        print_json(payload)

    except Exception as e:
        print_json({"ok": False, "error": str(e)}, status="500 Internal Server Error")


if __name__ == "__main__":
    main()
