# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two sides of an SME sale in Colombia.

- Sellers: owners of profitable Colombian companies with annual sales of COP 1.000M to 20.000M, usually 50 to 70 years old, family owned or founder led, often without a successor, selling now or within two years.
- Buyers: strategic acquirers (competitors, suppliers, clients, consolidators) and financial buyers (family offices, search funds, holdings, private equity) come first; individuals (executives, entrepreneurs, Colombians abroad) are also served but are not the lead audience of the buyer landing.

## Product Purpose

Relevo sells profitable Colombian SMEs end to end: free valuation, anonymous confidential listing, verified buyers, negotiation and closing with payment through a fiducia. For buyers, Relevo keeps a registered buy box (standing order) per buyer and sends only companies that match it. Success on the buyer side means qualified buyers registering a precise buy box, not raw signup volume.

## Positioning

- Transparency: Relevo shows owners what their company is worth instead of profiting from them not knowing.
- Buyers register what they want once; Relevo matches verified sellers against those standing orders.
- Relevo helps structure acquisition financing (seller note, bank credit, earn out) as a service. It does not lend and must not claim to.

## Operating Context

- Buyer data lives in Supabase (tables compradores, personas, ordenes; public writes only through the function registrar_comprador). Orders expire after six months unless confirmed.
- Lead notifications arrive by email at felipe@relevobrokers.com through api/notify-lead.js.
- Seller landing at relevobrokers.com (index.html) is optimized for maximum response; the buyer landing at /compradores is optimized to filter noise, so its form is an onboarding step, not the hero.

## Capabilities and Constraints

- Static HTML/CSS/JS on Vercel; no framework.
- Copy in Spanish, using "tú".
- Pricing for buyers is not published.
- Operated by RELEVO BROKERS S.A.S. (NIT 902.117.149-4), constituted 16 Oct 2026; legal representative Juan Felipe Pardo Blanco.

## Brand Commitments

- Name Relevo ("pasar la posta").
- Colors: orange #F47B3D, blue #2C5186, dark navy text #14243D, light blue background #EAF1FA.
- Logo: two offset rounded pills (navy over orange), optionally with wordmark.
- Buyer landing: dark corporate navy, fintech and technical feel, cleaner and more product-like than the seller landing (user pinned, Oct 2026).
- Buyer landing takes the category standard played straight (user chose it over concept directions, Oct 2026); craft bar: Mercury, Stripe, Ramp marketing pages.

## Evidence on Hand

- None publishable yet. Do not show seller counts, deal counts, buyer demand, testimonials, client logos or team bios on the buyer landing. The founding team section is planned for later.

## Product Principles

1. Never claim what Relevo cannot yet prove.
2. Confidentiality first: anonymous teasers before names and numbers.
3. Filter for quality over volume on the buyer side.
4. Standardize the deal so effort scales.
