# Vendor Fulfillment Data Boundary

## Approved operating model

This application operates as a **single trusted restaurant operator**. A user with the canonical `user_roles.role = 'vendor'` role may see fulfillment information for all restaurant orders, but cannot use direct database access to read billing, customer-account, or pricing data.

The privileged vendor interface is limited to two authenticated RPCs. `list_vendor_fulfillment_orders()` returns the order number, fulfillment type, delivery-address snapshot when delivery is selected, operational status, customer-provided operational notes, creation time, and item names, quantities, and food customizations. `update_vendor_order_fulfillment()` accepts only an order ID, a status, and operational notes. The existing trigger remains the authority for valid status transitions and immutable order fields.

| Permitted for vendor fulfillment | Excluded from the vendor contract |
| --- | --- |
| Order number and creation time | Customer `user_id` and profile records |
| Delivery/pickup fulfillment details | `items_total`, `delivery_fee`, and `grand_total` |
| Delivery address snapshot when needed | Dish price and line-total data |
| Item name, quantity, and customizations | Direct reads of `orders` or `order_items` tables |
| Valid status changes and operational notes | Direct order mutation or arbitrary SQL/RPC execution |

## Operational safeguards

The vendor role is not a customer-support, accounting, or analytics role. Any staff member who needs billing, customer-account, refund, or reporting access must receive a separate audited capability rather than an expanded vendor policy. Delivery addresses and customer notes are operational personal data; access must be limited to staff actively fulfilling the order, and vendor sessions must use the same sign-out, device, and incident-response controls as other authenticated staff sessions.

If the business evolves into a marketplace with multiple independent restaurants, this contract must be replaced before onboarding a second operator. Every order, menu, role, and fulfillment query will need a stable tenant identifier and tenant-scoped authorization rules.
