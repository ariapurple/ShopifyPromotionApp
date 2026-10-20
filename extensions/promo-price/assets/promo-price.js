function promoPoolRoots() {
  return document.querySelectorAll(".promo-pool");
}

function selectedVariantId() {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  if (fromUrl) {
    return fromUrl;
  }
  const input = document.querySelector('form[action*="/cart/add"] [name="id"]');
  return input ? input.value : null;
}

function renderPromoPool(root) {
  const dataElement = root.querySelector("[data-promo-pool]");
  const display = root.querySelector("[data-promo-pool-display]");
  if (!dataElement || !display) {
    return;
  }

  const data = JSON.parse(dataElement.textContent || "{}");
  const variantId = selectedVariantId();
  const variant = variantId ? data.variants[variantId] : null;
  const promo = variant && variant.promo;
  const remaining = promo ? Number(promo.r) : 0;
  const percent = promo ? Number(promo.p) : 0;
  const canShow =
    variant &&
    promo &&
    Number.isFinite(remaining) &&
    remaining > 0 &&
    Number.isFinite(percent) &&
    percent > 0 &&
    percent <= 100;

  if (!canShow) {
    display.hidden = true;
    return;
  }

  const promoCents = Math.round((variant.priceCents * (100 - percent)) / 100);
  const currency = data.currency || "USD";
  const format = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });

  const price = root.querySelector("[data-promo-pool-price]");
  const compare = root.querySelector("[data-promo-pool-compare]");
  const remainingText = root.querySelector("[data-promo-pool-remaining]");
  if (price) {
    price.textContent = format.format(promoCents / 100);
  }
  if (compare) {
    compare.textContent = format.format(variant.priceCents / 100);
  }
  if (remainingText) {
    remainingText.textContent = `促銷價尚餘 ${remaining} 件`;
  }
  display.hidden = false;
}

function renderAllPromoPools() {
  promoPoolRoots().forEach(renderPromoPool);
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof Element && target.matches('[name="id"]')) {
    renderAllPromoPools();
  }
});
window.addEventListener("popstate", renderAllPromoPools);
document.addEventListener("DOMContentLoaded", renderAllPromoPools);
renderAllPromoPools();
