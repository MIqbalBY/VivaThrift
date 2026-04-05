-- Fix: Chat disappears when product is sold
-- Root cause: RLS only allowed SELECT on products with status='active' (or seller's own).
-- When product became 'sold', buyer couldn't read it via RLS → product join in chat
-- returned NULL → client-side filter removed the chat.
--
-- Fix: Allow reading products with status IN ('active','sold') for everyone.
-- Sold products should still be viewable (product page, chat history, order details)
-- but NOT purchasable (enforced by checkout/offer server logic, not RLS).

-- 1. Drop redundant policy (subset of products_public_select)
DROP POLICY IF EXISTS "public read active products" ON "public"."products";

-- 2. Drop old policy so we can recreate with updated USING clause
DROP POLICY IF EXISTS "products_public_select" ON "public"."products";

-- 3. Recreate: allow anyone to read active + sold products; seller sees all own products
CREATE POLICY "products_public_select" ON "public"."products"
  FOR SELECT
  USING (
    (status)::text IN ('active', 'sold')
    OR seller_id = (SELECT auth.uid())
  );
