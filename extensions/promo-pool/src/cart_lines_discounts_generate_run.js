import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return {operations: []};
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );
  if (!hasProductDiscountClass) {
    return {operations: []};
  }

  const config = readConfig(input.discount.metafield);
  if (!config) {
    return {operations: []};
  }

  const remainingByVariant = indexPoolRemaining(config.campaigns);
  /** @type {Map<string, {message: string, percent: number, targets: Array<{cartLine: {id: string, quantity: number}}>}>} */
  const candidatesByCampaign = new Map();

  for (const line of input.cart.lines) {
    const merchandise = line.merchandise;
    if (merchandise.__typename !== "ProductVariant") {
      continue;
    }

    const variantId = numericId(merchandise.id);
    const slot = remainingByVariant.get(variantId);
    if (!slot) {
      continue;
    }

    const discountedQty = Math.min(line.quantity, slot.remaining);
    if (discountedQty < 1) {
      continue;
    }
    slot.remaining -= discountedQty;

    let candidate = candidatesByCampaign.get(slot.campaignId);
    if (!candidate) {
      candidate = {
        message: slot.name,
        percent: slot.percent,
        targets: [],
      };
      candidatesByCampaign.set(slot.campaignId, candidate);
    }
    candidate.targets.push({
      cartLine: {
        id: line.id,
        quantity: discountedQty,
      },
    });
  }

  const candidates = [...candidatesByCampaign.values()].map((candidate) => ({
    message: candidate.message,
    targets: candidate.targets,
    value: {
      percentage: {
        value: candidate.percent,
      },
    },
  }));

  if (!candidates.length) {
    return {operations: []};
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}

/**
 * @param {Array<{id?: string, name?: string, p?: number, r?: Record<string, number>}>} campaigns
 */
function indexPoolRemaining(campaigns) {
  /** @type {Map<string, {campaignId: string, name: string, percent: number, remaining: number}>} */
  const remainingByVariant = new Map();

  for (const campaign of campaigns) {
    if (!isPoolCampaign(campaign)) {
      continue;
    }
    for (const [variantId, qty] of Object.entries(campaign.r)) {
      if (remainingByVariant.has(variantId)) {
        continue;
      }
      const remaining = Math.floor(Number(qty));
      if (!Number.isFinite(remaining) || remaining < 1) {
        continue;
      }
      remainingByVariant.set(variantId, {
        campaignId: String(campaign.id),
        name: String(campaign.name),
        percent: campaign.p,
        remaining,
      });
    }
  }

  return remainingByVariant;
}

/**
 * @param {{id?: string, name?: string, p?: number, r?: Record<string, number>} | null | undefined} campaign
 */
function isPoolCampaign(campaign) {
  if (!campaign || !campaign.r || typeof campaign.r !== "object") {
    return false;
  }
  if (typeof campaign.p !== "number" || campaign.p <= 0 || campaign.p > 100) {
    return false;
  }
  return typeof campaign.id === "string" && typeof campaign.name === "string";
}

/**
 * @param {{jsonValue?: unknown} | null | undefined} metafield
 */
function readConfig(metafield) {
  if (!metafield) {
    return null;
  }

  let value = metafield.jsonValue;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || !Array.isArray(value.campaigns)) {
    return null;
  }
  return value;
}

/**
 * @param {string} gid
 */
function numericId(gid) {
  const parts = gid.split("/");
  return parts[parts.length - 1];
}
