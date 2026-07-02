ALTER TABLE "Order" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'paypal';
ALTER TABLE "Order" ADD COLUMN "squarePaymentLinkId" TEXT;
ALTER TABLE "Order" ADD COLUMN "squareOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "squarePaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "squareReceiptUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "squareBuyerEmail" TEXT;

ALTER TABLE "StarPurchase" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'paypal';
ALTER TABLE "StarPurchase" ADD COLUMN "squarePaymentLinkId" TEXT;
ALTER TABLE "StarPurchase" ADD COLUMN "squareOrderId" TEXT;
ALTER TABLE "StarPurchase" ADD COLUMN "squarePaymentId" TEXT;
ALTER TABLE "StarPurchase" ADD COLUMN "squareReceiptUrl" TEXT;
ALTER TABLE "StarPurchase" ADD COLUMN "squareBuyerEmail" TEXT;

CREATE UNIQUE INDEX "Order_squarePaymentLinkId_key" ON "Order"("squarePaymentLinkId");
CREATE UNIQUE INDEX "Order_squareOrderId_key" ON "Order"("squareOrderId");
CREATE UNIQUE INDEX "StarPurchase_squarePaymentLinkId_key" ON "StarPurchase"("squarePaymentLinkId");
CREATE UNIQUE INDEX "StarPurchase_squareOrderId_key" ON "StarPurchase"("squareOrderId");
