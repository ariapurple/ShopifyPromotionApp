# 促銷額度 Design

對應 [requirements.md](requirements.md)。實作次序見 [tasks.md](tasks.md)。

## 架構

```text
Shopify admin (Polaris)
        |  建立活動、暫停、看剩餘
        v
App backend
        |  寫兩個地方，內容來自同一份計算結果
        +--> Discount metafield     Discount Function 在結帳讀
        +--> Variant metafields     主題 app block 在產品頁讀
        |
        +--> Postgres 或開發用 SQLite
                活動、每個 variant 的額度、已處理訂單

客人結帳
        v
Discount Function
        讀 discount metafield
        只打折 min(行件數, 剩餘)

訂單建立
        v
orders/create webhook
        用折扣分配金額反推件數
        冪等記帳，再發佈 metafield
```

技術選擇：

- Shopify 官方 app template，React Router，TypeScript。
- Discount Function 用 JavaScript，跟 app 同一種語言。
- 主題用 theme app extension 的 product app block。
- 開發資料庫用 SQLite。正式環境用 Postgres。
- 一個商店只有一個 automatic app discount。所有額度規則放進它的 metafield。

不使用 Cart Transform。它不能新增獨立的購物車行，而且展開禮物時件數會乘上母行件數。

## 資料

### Shop

Shopify session 之外，記商店時區和那一個 automatic discount 的 id。

### Campaign

- id
- shop
- name：結帳折扣標題
- status：`draft`、`scheduled`、`active`、`paused`、`ended`
- 一段或兩段時期。每段有當地開始、當地結束，以及換算出來的 UTC。兩段之間額度、banner、集合和百分比都沿用，已售件數不重置。
- percent：整數 1 到 100
- kind：`pool` 或 `collection`
- priority：商家排序，數字小的先顯示、集合折扣也先考慮
- landingCollectionId：banner 連結用的手動集合
- 同一商店可以有多個 `scheduled`、`active` 或 `paused` 的 campaign。第一版介面可以先只建立 `pool`。

### CampaignVariant

- campaignId
- variantId：Shopify GID
- productId
- allocatedQty
- soldQty
- 剩餘 = allocatedQty - soldQty，最小當 0 顯示。soldQty 可以因為併發而大於 allocatedQty，帳目保留真實數字。

### Redemption

- shop
- orderId
- variantId
- qty
- 唯一鍵：`(orderId, variantId)`

Webhook 重送時，已有這列就不再減額度。

## Discount metafield

擁有者是那個 automatic discount。命名空間用 app-reserved namespace。型別 JSON。

Function 讀到的值必須小於或等於 10,000 bytes。超過時 Admin API 仍能儲存，但 Function 會收到 null，等於全單不打折。寫入前先量 byte 數，超過就拒絕儲存。

形狀是活動列表。只有一個活動時，列表裡也是一個元素。

```json
{
  "v": 2,
  "campaigns": [
    { "id": "1111", "name": "雙11", "p": 40, "r": { "123": 10 } },
    { "id": "ann", "name": "週年", "p": 15, "c": "987654321" }
  ]
}
```

- 有 `r` 的是促銷額度。值是 variant 數字 id 對剩餘件數。剩餘 0 的鍵刪掉。
- 有 `c` 的是集合百分比。值是集合的數字 id。沒有件數上限。
- 暫停或結束的活動不要放進這份列表。

全部活動共用 10KB。儲存前量整份 JSON。介面上單個額度活動仍先限 100 個 variant，同時再看剩餘 byte。

輸入 query 不要把 variant id 做成超過 100 個元素的 GraphQL list 變數。整份 JSON 當一個 metafield 讀入，在 Function 裡解析。

## Discount Function

目標：`cart.lines.discounts.generate.run`。

輸入要的欄位：

- 每行的 id、quantity、variant id、每件售價
- discount metafield

邏輯：

1. metafield 缺失或沒有 campaign：回傳沒有折扣。
2. 對每一行先找促銷額度。命中就只用該活動，打折件數 = min(行 quantity, 剩餘)。
3. 沒有額度命中，再看集合百分比。Input query 用 `inAnyCollection` 判斷。多過一個集合命中時，用 priority 較前的活動，整行按該百分比打折。
4. 同一行不會同時拿額度折扣和週年折扣。
5. `message` 用該活動的 name。
6. 不讀網路。公開 app 的 fetch target 只限 enterprise custom app。

集合 id 經 discount metafield 的 input query 變數傳入，列表不超過 100 個。

## 時區

只用商店時區。Admin API 的 `shop.ianaTimezone` 是準則，例如 `Asia/Hong_Kong`。不要用員工瀏覽器時區、伺服器時區，也不要用固定的 `+08:00`。

商家在表單輸入的是商店當地的年月日和時間。後端用 IANA 時區把它轉成 UTC 再儲存。客戶端不要把 `datetime-local` 的值直接做 `new Date().toISOString()`。介面要寫明時區名稱，例如「香港時間 Asia/Hong_Kong」。

每一段時期都保留：

- `startsAtLocal`、`endsAtLocal`：商家輸入的當地時間，沒有時區後綴
- `timezone`：儲存當刻的 `shop.ianaTimezone`
- `startsAt`、`endsAt`：換算出來的 UTC，用來排程和傳給 Shopify

第二段全部留空代表這個活動只有一段。

Shopify GraphQL 的 `DateTime` 用 UTC。香港 11 月 11 日 00:00 寫成 `2026-11-10T16:00:00Z`。

排程器只看 UTC。下一個活動開始或結束的 UTC 一到，後端再發佈 metafield，移出不在時段內的活動。Function 不比較時間。Automatic discount 的 `startsAt` 和 `endsAt` 用所有活動裡最早和最遲的 UTC。

夏令時間用 IANA 資料庫處理。當地時間不存在，或一天裡出現兩次時，拒絕儲存並叫商家改時間。香港沒有夏令時間，但商店時區可以設成倫敦或紐約。

商家之後在 Shopify 改了商店時區：已儲存的 UTC 不變，活動不會偷偷平移。介面顯示原來的時區。商家可以選擇「改跟新的商店時區」，那一步才用同一個當地時間重新計算 UTC。

客人在其他時區一樣在那個 UTC 時刻看到活動開始。產品頁和 banner 若顯示結束時間，用 metafield 裡的 UTC 加上商店 IANA 時區，在瀏覽器用 `Intl` 的 `timeZone` 選項格式化。不要跟瀏覽器當地時區。

一個活動最多兩段時期，第二段可留空。兩段都不可以重疊，第二段的開始不可以早過第一段的結束。只在當前時間落在其中一段裡，活動才算進行中：折扣、banner 和集合成員都會出現。兩段之間這些都收起，已售件數保留。排程看所有段的開始和結束 UTC。

每個活動的時期由 app 在發佈 metafield 時判斷。Function 沒有可靠的時鐘，也不要在函式裡比較時間。

暫停一個活動：把它移出 metafield 列表。只要還有別的活動進行中，automatic discount 保持 active。全部活動都暫停、結束或沒有剩餘時，才 deactivate 這張折扣。

建立折扣時：

- `discountClasses` 只用 `PRODUCT`
- 預設不與其他產品折扣疊加。商家要疊加再在後期開放
- 若商店已有 25 個進行中自動折扣，建立失敗，介面說明要先停用別的自動折扣

## 結帳件數怎樣記帳

`orders/create` 到達後：

1. 驗證 webhook HMAC。
2. 訂單的折扣分配若未齊，用 Admin API 再讀一次訂單。
3. 找出屬於這張 app discount 的 line allocation。
4. 打折件數 = 四捨五入(分配金額 / (單價 × 百分比))。用商店貨幣金額，不用 presentment 展示金額。
5. 件數必須在 0 和該行 quantity 之間。對不上就把這張單標成需要查看，不要猜一個較大的數。
6. 插入 Redemption。唯一鍵衝突就結束。
7. 增加對應 variant 的 soldQty，重新發佈 discount metafield 和 variant metafield。
8. 某個額度活動的全部 variant 剩餘都是 0：該 campaign 改為 `ended` 並移出列表。集合百分比活動不會因為件數結束。只有列表再沒有進行中的活動時，才 deactivate discount。

退款、取消、訂單修改在第一版不改 soldQty。

## 產品頁

每個參與 variant 寫一個 storefront `PUBLIC_READ` metafield：

```json
{
  "p": 20,
  "r": 4,
  "until": "2026-11-01T16:00:00Z"
}
```

活動暫停、結束或剩餘 0：刪除該 metafield，block 不渲染促銷。

App block 用 Liquid 讀目前產品所有 variant 的 metafield，把對照表放進頁面。JavaScript 聽產品表單的 variant 變化和網址的 `variant` 參數，換顯示。

顯示：

- 促銷單價 = catalog 單價 × (100 - 百分比) / 100，四捨五入到商店貨幣的小數位
- 原本價錢用刪除線
- 文案：促銷價尚餘 {r} 件

這是展示。真正收費以結帳 Function 為準。兩邊都讀同一份已發佈的剩餘件數。

不提供「自動找主題價錢節點並覆蓋」的嵌入。主題差異太大會把第一版卡在相容性。

Admin 提供開主題編輯器並指向這個 app block 的連結。

## Admin

活動列表。第一版可以只提供新增 `pool`。每行顯示名稱、時間、狀態和百分比。

- 名稱、百分比、開始、結束
- 選擇產品和 variant，每個 variant 填額度
- 儲存前顯示每個 variant 的原價和促銷價
- 進行中顯示已售和剩餘
- 暫停、恢復、結束
- 固定說明：可能多賣 1 至 2 件、POS 會計入、feed 不會劃線、卸載不改價

結束活動只停折扣和刪除展示 metafield，不回寫產品價錢。

## 卸載

`app/uninstalled` 刪除商店的 session、campaign 和 redemption。不呼叫產品價錢 mutation。Shopify 會移除 app 擁有的 metafield 和 automatic discount。

## 首頁 banner 和促銷集合

這是結帳驗收之後的第一個功能。同一個 block 處理所有進行中的活動。

一次設定：首頁模板放一個 app block。它讀 shop metafield 的 banner 陣列。陣列是空就什麼都不輸出。

每個活動有自己的 banner file id、alt，和 landing collection。商家可以改活動排序。

`pool` 變成 active 時，把有額度的產品加進它的 landing collection。`collection` 活動不改集合成員，連結直接去目標集合。

Shop metafield：

```json
{
  "banners": [
    { "img": "https://cdn.shopify.com/...", "alt": "雙11", "href": "/collections/double-11" },
    { "img": "https://cdn.shopify.com/...", "alt": "週年", "href": "/collections/anniversary" }
  ]
}
```

Block 按陣列順序由上至下顯示。暫停、結束或卸載某個活動時，只移走該活動的 banner；`pool` 再只移走它自己加進集合的產品。

集合頁產品卡的價錢繼續用主題。促銷價仍靠產品頁 app block。

## 買 A、B 的後期設計

先做價錢，後做店面。

價錢規則放進同一個 discount metafield，不再開第二張 automatic discount：

```json
{
  "offers": [
    {
      "buy": ["111"],
      "get": "222",
      "p": 100,
      "max": 1
    }
  ]
}
```

Function 見到買入 variant 的件數大於 0，而且得到 variant 已在購物車，才打折得到的那一行，件數不超過 `max`。100 表示免費。

彈窗和自動加車是 theme app extension，不是 Function：

- 彈窗：A 成功加入購物車後詢問。同意才呼叫 Cart AJAX 加 B。
- 自動加：A 加入後立刻加一件 B。A 的件數降到 0 時移除自動加的 B。
- B 用 line item property 標記是 app 加的，避免刪走客人自己加的同一件貨。
- 只實作在有 app block 的 Online Store 主題。

## 失敗行為

| 情況 | 行為 |
| --- | --- |
| Function metafield 超過 10KB | 拒絕儲存，結帳不會靜默失效 |
| 兩個結帳同時讀到舊剩餘 | 兩張單都可能打折。Webhook 之後剩餘可以是負數，展示當 0，之後不再打折 |
| 分配金額推不出件數 | 訂單標成需要查看，不減一個猜測件數 |
| 主題沒加 app block | 結帳仍然正確。產品頁沒有促銷展示 |
| 建立 automatic discount 失敗 | 活動留在 draft，顯示 Shopify 回傳的原因 |

## 決定

- 剩餘件數的權威在 app 資料庫。Metafield 是發佈出去的快照。
- 百分比優先，是為了避開 presentment currency。
- 一個 automatic discount 裝多個活動，是為了不佔滿 25 個名額。同一件貨只套用一個活動。
- 產品頁用 app block，是為了不依賴每個主題的 DOM。
- 第一版不回補退款，是為了先把減額度的冪等做對。
