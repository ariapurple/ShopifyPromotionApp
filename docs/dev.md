# 本機啟動

App 在 `192.168.50.226` 的 `C:\Users\Purple\promo-pool\promo-pool`。Partner 組織是 InnovationOWL。Shopify app 名稱是 PromoPool。Dashboard 名稱不能包含 Shopify。

## 已完成的登入

在那部電腦的 Windows 用戶 Purple 執行過 `shopify auth login`。之後的 Shopify CLI 指令用同一個用戶。

## 開發商店

```powershell
cd C:\Users\Purple\promo-pool\promo-pool
shopify store create dev --name promo-pool-dev
shopify app dev
```

`shopify app dev` 會建立 tunnel，更新 app URL，並把 app 裝進你選的開發商店。開發商店免費，只能用測試付款。

## 資料庫

開發用 SQLite，檔案是 `prisma/dev.sqlite`。正式環境改 Prisma datasource 做 Postgres，模型不用另起一套。

```powershell
npx prisma migrate dev
npx prisma generate
```

## 規格

- [requirements.md](requirements.md)
- [design.md](design.md)
- [tasks.md](tasks.md)
- [market.md](market.md)
