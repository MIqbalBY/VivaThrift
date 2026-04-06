-- =============================================================================
-- Migration 009 — Auto-insert notifications on order & offer status changes
-- VivaThrift · 2026-04-07
-- =============================================================================
-- Triggers:
--   1. orders: pending_payment → confirmed  → notify seller ("Pembayaran diterima!")
--   2. offers: INSERT (pending)              → notify seller ("Tawaran baru masuk!")
--   3. offers: pending → accepted            → notify buyer  ("Tawaranmu diterima!")
--   4. offers: pending → rejected            → notify buyer  ("Tawaranmu ditolak")
--
-- Note: order_shipped & order_completed notifications are already inserted
-- manually by server/api/orders/[id].patch.ts for richer context (resi, etc.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigger function: order status change → notify
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_on_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Payment confirmed (Xendit webhook sets confirmed) → notify seller
  IF OLD.status = 'pending_payment' AND NEW.status = 'confirmed' THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id)
    VALUES (
      NEW.seller_id,
      'order_paid',
      'Pembayaran diterima! 💰',
      'Pesanan baru sudah dibayar. Segera kemas dan kirim barangnya ya!',
      NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger function: offer events → notify
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_on_offer_change()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_product_title TEXT;
  v_seller_id     UUID;
BEGIN
  -- New offer submitted (INSERT, status = pending) → notify seller
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT p.title, p.seller_id
      INTO v_product_title, v_seller_id
      FROM products p
     WHERE p.id = NEW.product_id;

    IF v_seller_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, product_id, reference_id)
      VALUES (
        v_seller_id,
        'new_offer',
        'Tawaran baru masuk! 🤝',
        'Ada yang nawar ' || COALESCE(v_product_title, 'produkmu') || '. Buka chat untuk merespons.',
        NEW.product_id,
        NEW.chat_id::text
      );
    END IF;
  END IF;

  -- Offer accepted → notify buyer
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT p.title INTO v_product_title
      FROM products p WHERE p.id = NEW.product_id;

    INSERT INTO notifications (user_id, type, title, body, product_id, reference_id)
    VALUES (
      NEW.buyer_id,
      'offer_accepted',
      'Tawaranmu diterima! 🎉',
      'Segera bayar ' || COALESCE(v_product_title, 'pesananmu') || ' sebelum kedaluwarsa.',
      NEW.product_id,
      NEW.chat_id::text
    );
  END IF;

  -- Offer rejected → notify buyer
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    SELECT p.title INTO v_product_title
      FROM products p WHERE p.id = NEW.product_id;

    INSERT INTO notifications (user_id, type, title, body, product_id, reference_id)
    VALUES (
      NEW.buyer_id,
      'offer_rejected',
      'Tawaranmu ditolak 😔',
      'Penjual menolak penawaran untuk ' || COALESCE(v_product_title, 'produk ini') || '. Kamu bisa coba tawar lagi.',
      NEW.product_id,
      NEW.chat_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Attach triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_order_status_notify ON orders;
CREATE TRIGGER trg_order_status_notify
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_order_status_change();

DROP TRIGGER IF EXISTS trg_offer_notify_insert ON offers;
CREATE TRIGGER trg_offer_notify_insert
  AFTER INSERT ON offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_offer_change();

DROP TRIGGER IF EXISTS trg_offer_notify_update ON offers;
CREATE TRIGGER trg_offer_notify_update
  AFTER UPDATE OF status ON offers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_offer_change();