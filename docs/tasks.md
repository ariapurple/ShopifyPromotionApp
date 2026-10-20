# 促銷額度 Tasks

實作 [requirements.md](requirements.md) 和 [design.md](design.md)。由上至下。後期 epic 在第一版驗收通過前不做。

完成的定義：開發商店跑完「第一版驗收」，而且卸載後價錢沒有被改過。

## A. 專案骨架

- [x] A1. 用 Shopify 官方 template 建立 React Router TypeScript app。
- [x] A2. 接上 Prisma。開發用 SQLite，資料模型預留 Postgres。
- [x] A3. 加入 JavaScript Discount Function extension，目標 `cart.lines.discounts.generate.run`。
- [x] A4. 加入 theme app extension，內含一個 product template app block。
- [x] A5. 寫本機啟動步驟：Partner app、開發商店、`shopify app dev`。

## B. 折扣節點和設定

- [ ] B1. 安裝後建立一張 automatic app discount，只含 `PRODUCT` class，預設不與其他產品折扣疊加。把 discount id 存進 Shop。
- [ ] B2. 實作 metafield 發佈。JSON 用 `campaigns` 陣列，即使只有一個活動。寫入前量整份 UTF-8 byte，大於 10,000 就拒絕，不寫入。
- [ ] B3. 商店已有 25 個進行中自動折扣時，保留 draft 並顯示這個原因。
- [ ] B4. 暫停時把 `on` 設為 0 並 deactivate discount。恢復時在時段內而且仍有剩餘才 activate。

## C. Admin

- [ ] C1. 活動頁：名稱、1 到 100 的百分比、第一段開始和結束，以及可留空的第二段。輸入按 `shop.ianaTimezone` 解釋，介面寫明時區名稱。儲存每段的當地時間、IANA 時區和 UTC。不使用瀏覽器時區。兩段重疊、第二段早過第一段結束，或夏令時間不存在或重疊的當地時間，都拒絕儲存。兩段之間折扣、banner 和集合成員都收起，第二段開始時恢復，已售件數不重置。商店時區改動後，舊活動的 UTC 維持不變，並提供「改跟新的商店時區」。
- [ ] C2. 用 App Bridge resource picker 選 variant。每個 variant 填正整數額度。一個活動最多 100 個 variant。
- [ ] C3. 儲存前列出每個 variant 的 catalog 價和促銷價。
- [ ] C4. 進行中顯示每個 variant 的額度、已售、剩餘。剩餘展示最小是 0。
- [ ] C5. 可以暫停、恢復、結束。結束不呼叫產品價錢 mutation。
- [ ] C6. 頁面寫明：可能多賣 1 至 2 件、POS 會計入額度、feed 不顯示促銷價、卸載不改價。
- [ ] C7. 提供把 product app block 加進主題的深連結。

## D. Discount Function

- [ ] D1. Input query 讀每行 id、quantity、variant id、每件金額，以及 discount metafield。
- [ ] D2. `on` 不是 1、metafield 無效、或找不到剩餘時，該行不打折。
- [ ] D3. 打折件數等於 min(行件數, 剩餘)。用 target quantity 只覆蓋這些件數。
- [ ] D4. 單元測試：剩餘 2、買 5，得到 quantity 2 的百分比折扣。剩餘 0 或暫停，得到空操作。
- [ ] D5. 用開發商店結帳確認同一張單同時出現促銷價行和原價件數。

## E. 訂單記帳

- [ ] E1. 訂閱 `orders/create`，驗證 HMAC。
- [ ] E2. 折扣分配未齊時，用 Admin API 再讀訂單。
- [ ] E3. 用商店貨幣的分配金額除以單價乘百分比，四捨五入得到件數。件數必須在 0 和行件數之間。
- [ ] E4. 推不出件數的訂單標成需要查看，不減額度。Admin 能看到這張單。
- [ ] E5. 以 `(orderId, variantId)` 唯一插入 Redemption。重複 webhook 不減第二次。
- [ ] E6. 更新 soldQty，重新發佈 discount metafield 和 variant metafield。
- [ ] E7. 某個額度活動全部剩餘為 0 時，該 campaign 改為 ended。只有再沒有進行中的活動時，才 deactivate discount。
- [ ] E8. 訂閱 `app/uninstalled`。刪除 session 和活動資料。確認沒有產品 update mutation。

## F. 產品頁

- [ ] F1. 參與中的 variant 寫 storefront public-read metafield。暫停、結束或剩餘 0 時刪除。
- [ ] F2. App block 用 Liquid 輸出該產品全部 variant 的百分比、剩餘和結束時間。
- [ ] F3. JavaScript 在 variant 切換時更新促銷價、刪除線原價和「促銷價尚餘 X 件」。
- [ ] F4. 沒有 metafield 時 block 不顯示任何促銷，主題原價保持可見。

## G. 第一版驗收

- [ ] G1. 額度 5、8 折，買 2。訂單 2 件都是 8 折，剩餘變 3，產品頁顯示尚餘 3。
- [ ] G2. 剩餘 2 時買 5。訂單 2 件 8 折、3 件原價。之後新結帳不再打折。
- [ ] G3. 暫停時加購是原價。恢復後再次打折。
- [ ] G4. 結束時間之後不再打折，產品頁促銷消失，catalog 價未變。
- [ ] G5. 卸載後 price 和 compare-at 與活動前一致。
- [ ] G6. 嘗試儲存超過 100 個 variant 或超過 10KB 的設定，儲存失敗且現有活動仍有效。
- [ ] G7. 在 POS 下一張含活動 variant 的單，確認它會打折並減少剩餘。把結果記在驗收筆記。

## J. 首頁 banner 和同時多個活動

第一版驗收通過後先做這段。

- [ ] J1. 活動列表可以同時有多個活動。每個活動上傳自己的 banner、alt，並選擇自己的手動集合。商家可以改排序。
- [ ] J2. 新增集合百分比活動：選定已有集合和百分比，不設件數上限，不加不移產品。
- [ ] J3. 兩個促銷額度若包含同一個 variant，儲存失敗。同一件貨有額度時，Function 不用集合百分比。多個集合都命中時，用排序較前的活動。Automatic discount 覆蓋所有活動、所有時期裡最早和最遲的 UTC。排程器到任何一段的開始或結束 UTC 再發佈。
- [ ] J4. 用 Shopify Files 儲存圖片。額度活動變成 active 時，把有額度的產品加進它自己的集合。
- [ ] J5. Shop metafield 寫 banner 陣列。暫停或結束只移走該活動的 banner 和它自己加入的產品。
- [ ] J6. 首頁一個 app block 按順序由上至下顯示所有進行中的 banner。沒有活動就什麼都不渲染。
- [ ] J7. 開發商店同時開雙 11 額度同週年集合折扣。兩張 banner 都在。雙 11 的 variant 只拿額度折扣。週年集合裡的其他產品拿週年折扣。
- [ ] J8. 介面說明：集合產品卡是 catalog 價；促銷價在產品頁。只得部分 variant 有額度時，整件產品仍會出現。所有活動共用 10KB。

## H. 上架前，未算第一版

- [ ] H1. App pricing：免費一個進行中活動，付費計劃先按每月 12 美元起草。
- [ ] H2. 補 Shopify 要求的 privacy、資料刪除 webhook 和上架清單。

## I. 後期，第一版通過先不要做

- [ ] I1. 每張單上限，和全店剩餘取較小值。
- [ ] I2. 用折扣的市場資格限制活動市場。
- [ ] I3. 退款 webhook 按商家設定回補額度，一樣要冪等。
- [ ] I4. 只在商店單一貨幣時開放固定金額折扣。
- [ ] I5. 買 A、B 打折或免費。B 已在購物車才由 Function 打折，不自動加件。
- [ ] I6. A 加入購物車後彈窗詢問是否加 B。
- [ ] I7. 買 A 送 B：自動加一件帶標記的 B；A 件數歸零時只移除帶標記的 B。
- [ ] I8. 歐洲 30 日最低價展示。
