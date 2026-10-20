# Shopify app 市場缺口

2026-10-20 的公開資料整理。對象係想做 Shopify app、又想避開已擠滿的「排程減價」的人。

## 開工次序

先做一隻 app。分市場唔開第二隻。B2B 等有人用第一隻先至做。

| 次序 | App | 處理的問題 | 點先至開始 |
| --- | --- | --- | --- |
| 1 | 促銷額度 | 同一條產品，頭 N 件促銷價，賣完其餘庫存返原價。唔改 catalog price | 而家。接受可能多賣 1 至 2 件促銷價 |
| 1 的後期 | 同一隻 app 加設定 | 每單上限、分市場、退款回補 | 結帳拆件數跑通之後 |
| 2 | B2B 補貨日程 | 公司客戶每星期自動出帶目錄價的 draft order | 第一隻有付費店，或你已經有批發客 |
| 不做 | 排程改價、Bundles、預購、進銷存 | 檔期、套裝、到貨通知、多倉 ERP | 平台夠，市場已有高分產品 |

### 第一隻的 function 邊度夠

夠，可以直接做結帳：

- Discount Function 可以對一行貨只打折其中幾件。5 件入車，可以 2 件促銷、3 件原價。
- 百分比，或每件固定扣減，都有。
- 時段用自動折扣的開始同結束。
- 規則放喺折扣 metafield。全店 25 個進行中自動折扣，這隻 app 只用 1 格。
- 一般結帳、Shop Pay、POS 都會跑。POS 不能逐個 function 關閉，所以店內單會計入額度。

要自己做，唔使等 Shopify：

- 訂單 webhook 減剩餘件數，寫返同一個 metafield。
- 產品頁劃線價同「尚餘 X 件」用 theme app embed。原生折扣唔會喺產品頁劃線。
- 一個設定大約覆蓋 100 個 variant。Function 讀 metafield 超過 10KB 會變 null。全店一萬款唔係這隻 app 的範圍。

平台未交，第一版寫明，唔好等：

- 公開 app 不能喺結帳時 call 自己的 server。兩張單同一秒會讀到舊餘額，可能多賣 1 至 2 件促銷價。
- 後台改單唔會重跑 function。促銷只保證結帳。
- Google / Meta feed 讀 catalog 價。這隻 app 唔改 feed。

第一版範圍：一個進行中額度、約 100 個 variant、百分比或每件扣減、開始同結束、結帳拆件數、賣出後更新剩餘、暫停、產品頁尚餘件數。

### 第二隻點解押後

B2B 補貨的 draft order、公司地點、目錄價、發票同付款條款，Admin API 已經夠。平台冇的係訂閱合約，文件寫明 B2B 唔支援 purchase options，所以用定時 draft order，唔好等訂閱。訂金條款只限 Plus，單張單最多 500 個 line item。技術可以做，但係另一個客群，同第一隻一齊開會分散。

## 結論

時間表減價已經有成熟產品。NA Bulk Price Editor 4.8 分、222 則評價，可以按 collection、tag 或 CSV 改價，再按時段還原。

未做好的係另一件事：**同一條產品，只限 N 件用促銷價賣；賣完其餘庫存繼續以正常價賣；全程唔改 catalog price。**

Community 有兩條未解的帖：

- 沙發平常 $1,000，想頭 30 件賣 $500，唔開第二條 listing，亦不限制每位客人買幾多（2023-09）。
- 入貨 20 件，只想其中 10 件特價，賣完自動返原價（德文區，2024-10）。

回覆建議的折扣使用次數、複製一件貨、或者用 Flow 喺庫存低過門檻時改價，都對唔上「全店賣出件數」呢個額度。

## 點解現有 app 唔岩

| 做法 | 問題 |
| --- | --- |
| 複製一件特價貨，庫存設為 N | SEO、廣告、庫存分家 |
| 折扣「最多用 N 次」 | 計訂單唔計件數；產品頁冇劃線價 |
| Flow 按總庫存改返原價 | 倉裡有 200 件、只想特價 10 件時，門檻唔會喺第 10 件觸發 |
| Bold、Wi、Fantastic Markets 這類改價 app | 還原失敗、卸載後促銷價留低、compare-at 變 $0。Bold 504 則裡 72 則一星（14%） |
| Steppun Discount（4.8 / 43，$6.99） | 每張單的件數或金額上限已解決。冇全店共用額度 |
| Lightning Deals（5.0 / 4）、Heartly（0 則） | 文案有件數上限，但樣本太少。Heartly 的促銷頁係自己 host。額度用完多數係結束 deal，唔係同一張單裡額度內外兩個價 |
| SmartStockCap、限購類 | 額度到頂會藏起產品或擋 checkout。商家想繼續賣，只係返原價 |

2026 年新出的 Revertly、AutoRevert、SalePilot、Salesloop 解決的係「唔好忘記收檔」，同促銷額度無關。

## 建議做的產品

商家設定 variant、時段、折扣或一口價、額度 N、可選每單上限。

- 產品頁顯示劃線價同「促銷價尚餘 X 件」。
- Checkout 用 Discount Function：額度內的件數促銷價，超出的件數原價。剩 2 件、客人加 5 件，就係 2 件促銷加 3 件原價。
- 額度用盡或時段結束，劃線價消失，同一條 URL 繼續賣原價。
- 唔寫 `product.price` 同 compare-at。卸載後價錢唔會被改壞。
- 退款可選是否回補額度。

建議月費約 $12。免費計劃只得 1 個進行中額度。唔好用成交抽成。

要寫明的限制：

- 公開 app 的 Discount Function 唔可以喺 checkout 即時 call 自己的 server。Network access 只限 Shopify for enterprises 的 custom app。併發單可能多賣一兩件促銷價。
- Discount Function 不能排除 POS，店內單會食同一個額度。
- Google 同 Meta 的產品 feed 讀 catalog price。唔改價就 feed 唔會顯示促銷價。需要 feed 劃線價的店應繼續用改價工具。

會買的店：清一批低成本存貨，但唔想成個碼或成個色都減。家具、家品、有尺寸的服裝最接近。

## 次選，唔好當第一個產品

- **分市場短期促銷。** Fantastic Markets Discounts 2.1 分 / 17 則，活動完價唔返，香港同澳洲店都投訴過。永久區域價用 Markets 就得。App 只值得做有開始有結束、而且唔改價目表的活動。
- **B2B 補貨日程。** Shopify 明文 B2B 唔支援訂閱、預購、try before you buy。咖啡店每週固定落單，要自己定時開 draft order。批發 app 已經很多，只做「補貨日曆」先有分別，銷售週期亦較長。
- **官方 Bundles 好差（2.8 / 570），但第三方 bundle app 已經很多。** 多倉庫存、平均月費高的進銷存，轉換成本高，細 app 打唔入。

## 唔好做

再做一個黑五排程、自動還原的減價 app。預購按鈕亦唔好做：Notify Me 同 STOQ 各有約 3,800 則評價。

## 來源

- Shopify App Store：NA Bulk Price Editor、Bold Discounts、Wi Flash Sale、Lightning Deals、Heartly、Revertly、AutoRevert、SalePilot、Steppun Discount、Fantastic Markets Discounts、Shopify Bundles、HK Pickup
- Shopify Help Center：折扣同 compare-at 的分別、折扣使用次數、Bundles 限制、B2B 不相容功能
- Shopify.dev：Discount Function API、Functions network access（公開 app 不可用 fetch target）
- Shopify Community：沙發限量特價帖（2023-09）、德文區「只賣其中 10 件特價」帖（2024-10）、多倉負庫存帖（到 2025 年仍有回覆）
- 第三方目錄（只作方向）：GapQuery、AppStorefy。庫存類約 137 個 app、平均月費約 $193、評分約 4.12，係抓取估計，唔係 Shopify 官方統計
