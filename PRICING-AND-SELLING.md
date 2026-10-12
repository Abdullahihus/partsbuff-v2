# E90 prices, eBay and Ben's listings

## What works now

- 448 of 478 E90 OEM references have recorded USD prices (93.7%).
- 553 priced offers are bundled; 91 references have multiple offers.
- Open a part card, a detail page, or Compare prices to see the chart and table.
- One priced listing produces one row and one chart bar; three priced listings produce three. MSRP is not an additional bar.
- Listings without a finite positive USD price are hidden, including unpriced RockAuto/eBay search placeholders.
- A reference without prices shows an empty message. Condition filters can also produce that state.
- The labels now read **Catalog** and **Find my car**. Supported vehicles remain BMW.
- Shop is ready for real seller inventory and stays empty until inventory is added.

The previous 300 priced references are preserved. New checks add prices for 148 more references. Quotes come from exact-number product pages and the existing saved dealer pages, plus the original CarParts.com and PartsGeek examples. BimmerWorld's replacement bulb and Bosch remanufactured alternator are labeled as replacements, rather than genuine BMW parts. Each quote links to its product/source and records its capture date. These are dated snapshots, not a claim of 448 live prices today.

30 references still have no confirmed displayable price. Discontinued pages with only hidden metadata prices, MSRP-only records, incorrect/superseded numbers and unpriced pages were excluded. No missing amount was estimated. Source stock status is shown when provided; an advertised price can belong to an out-of-stock item. Confirm current availability before ordering. Different brand, condition and pack quantities are not identical products.

The displayed amount follows the seller's advertised price. When the source explicitly includes a refundable core deposit, the amount is marked as included; do not add it again. Older quotes with a separate quoted deposit show it separately. Confirm shipping, tax, any deposit and the final checkout total with the seller.

No scraping script is included and no blocked source was bypassed. Prices remain in data/retailer-offers.json. Counts and unpriced OEM numbers are in data/e90-pricing-coverage.json. Catalog parts and OEM numbers were preserved.

## Optional live eBay prices

The server integration uses eBay's official Browse API and application OAuth tokens. No live account has been connected in this package.

1. Create an eBay Developers Program account and request the production access your application needs. Production approval is not guaranteed.
2. Obtain your **Production Client ID and Client Secret**.
3. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to your local .env.local, or to your Netlify environment variables. env.example shows the names. Keep real secrets out of GitHub and browser code.
4. Restart the local app or redeploy Netlify. Open an E90 part to request eBay listings.

Searches use the OEM number and BMW keyword, US marketplace and fixed-price listings. The adapter retains only USD listings whose title includes the exact OEM number. That title match does not verify authenticity or fitment. Conditions, seller, fetched timestamp and shipping quote are shown when returned. Up to five results are shown in eBay's order. API results are cached for 15 minutes per server instance; failures leave the bundled priced snapshots available. An eBay row appears only when the API supplies a valid priced listing. No checkout is performed through the eBay API.

The live path was checked using controlled mock responses. An end-to-end production check still requires your approved credentials.

Official references:

- [eBay Browse API](https://developer.ebay.com/api-docs/buy/static/api-browse.html)
- [Buy API production requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html)
- [Application OAuth authorization](https://developer.ebay.com/develop/guides/sell/authorization)

## Add Ben's real parts

Edit **data/seller-listings.json**. Its listings array is currently empty. Each active, in-stock listing appears in Shop, in the price chart/table, and beneath offers for its matching E90 OEM number.

This is an **example draft**, not real inventory or a price quote:

~~~json
{
  "schemaVersion": 1,
  "listings": [
    {
      "id": "ben-left-fender-liner",
      "oemNumber": "51717059377",
      "seller": "Ben",
      "title": "Left front fender liner",
      "description": "Replace this with the actual condition, damage and included pieces.",
      "price": 0,
      "currency": "USD",
      "condition": "Used",
      "quantity": 0,
      "status": "draft",
      "purchaseUrl": "https://buy.stripe.com/REPLACE_WITH_YOUR_REAL_PAYMENT_LINK",
      "shippingNote": "Replace this with the actual shipping or pickup terms.",
      "fitmentNote": "Verify the number on the physical part and the buyer's VIN/options.",
      "updatedOn": "2026-10-11"
    }
  ]
}
~~~

Replace the example information with Ben's actual part number, price, quantity, description and checkout link. The OEM number must be one of the E90 catalog references. Set status to active only when it is ready to sell, with a positive price and quantity. Draft, sold, zero-stock or invalid records are hidden.

For a photo, put the real image in public/uploads/ben/ and add imageUrl such as /uploads/ben/left-fender-liner.jpg. Supported extensions are jpg, jpeg, png and webp. Then run npm run build, commit the changed data/photo and push to update the site.

## Checkout for Ben

For this first version, use a **Stripe Payment Link** or Ben's own **eBay item URL** as purchaseUrl. The button opens that hosted checkout/listing. Only Stripe hosted payment URLs or HTTPS eBay /itm/ URLs are accepted.

For Stripe, create the actual product and price, configure shipping/address collection, and paste the resulting link into the listing. For a single used part, set quantity to one in checkout and limit the link to one completed payment. Stripe can deactivate a link after its payment limit is reached. Processor fees apply.

After selling, update quantity and status to sold, disable the payment link, and push the updated listing. The bundled JSON is manual inventory: it does not synchronize orders, reserve stock or receive payment webhooks. Use the processor's inventory/payment limit and confirm the same price in both the listing and hosted checkout. A later database and webhook integration can automate this when real orders justify it.

- [Stripe Payment Links](https://docs.stripe.com/payment-links)
- [Payment limits and shipping collection](https://docs.stripe.com/payment-links/customize)

## Validation

The production build and TypeScript checks pass. Checks cover all 478 E90 pricing endpoints, charts for missing/single/multiple prices, source prices and timestamps, preserved catalog data, seller validation and hidden draft/sold/zero-stock listings. The eBay adapter was tested with mock OAuth/listing responses, token reuse, result filtering and unavailable-service fallback. Real production eBay access and payment processing still require your own configured accounts.
